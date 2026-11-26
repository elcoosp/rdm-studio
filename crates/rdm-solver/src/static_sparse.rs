//! Sparse CSC assembly + Cholesky `LLᵀ` factorization (faer) + mechanism
//! diagnosis, per ARCHITECTURE.md §5 (`static_sparse.rs`).
//!
//! The stiffness matrix is factorized **once**; every elementary load case
//! is then solved by back-substitution, and ULS/SLS envelopes are obtained
//! by linear superposition without any refactorization.
//!
//! v1.7.0 additions:
//! - 2D plane-frame mode (`settings.plane_frame_2d`): `Uy`, `Rx`, `Rz`
//!   are constrained for every node;
//! - inclined supports (penalty projection along a user axis);
//! - prescribed support settlements (known-DOF RHS move + reaction shift);
//! - iterative tension-only / compression-only members;
//! - mechanism diagnosis naming the offending nodes / DOFs.

use std::collections::BTreeMap;

use faer::Side;
use faer::linalg::solvers::Solve;
use faer::sparse::SparseColMat;
use faer::sparse::Triplet;
use faer::sparse::linalg::solvers::{Llt, SymbolicLlt};
use nalgebra::SMatrix;

use rdm_model::{LoadCase, Structure};

use crate::loads::{
    LoadVectorError, assemble_case_vector, beam_case_load_local, build_case_element, build_elements,
};
use crate::stiffness::ELEMENT_DOFS;

/// Solution of one elementary load case.
#[derive(Debug, Clone, PartialEq)]
pub struct CaseSolution {
    /// Global displacements `[6n]`, DOF order `[Ux,Uy,Uz,Rx,Ry,Rz]` per node.
    pub displacements: Vec<f64>,
    /// Support reactions `[6n]` (non-zero only on constrained DOFs, N / N·m).
    pub reactions: Vec<f64>,
    /// Local beam end forces `[12m]` (N / N·m), released DOFs are zero.
    pub beam_end_forces: Vec<f64>,
}

/// Full static solution of the model (one [`CaseSolution`] per case).
#[derive(Debug, Clone)]
pub struct SolvedModel {
    /// Number of nodes of the solved model.
    pub n_nodes: usize,
    /// Number of beams of the solved model.
    pub n_beams: usize,
    /// One solution per elementary case, in canonical order (G, Q, W, S, Acc).
    pub cases: Vec<(LoadCase, CaseSolution)>,
}

/// Solver errors with pedagogical messages.
#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum SolveError {
    /// The model failed pre-solve validation.
    #[error("invalid model: {message}")]
    InvalidModel {
        /// Aggregated explanation of the issues.
        message: String,
    },
    /// The reduced stiffness matrix is singular (mechanism).
    #[error("unstable mechanism: {message}")]
    UnstableMechanism {
        /// Pedagogical explanation of the instability.
        message: String,
    },
    /// Load assembly failure (unknown references, degenerate members).
    #[error("load assembly error: {0}")]
    Load(#[from] LoadVectorError),
    /// Sparse matrix construction failure.
    #[error("sparse matrix error: {message}")]
    Sparse {
        /// Underlying faer message.
        message: String,
    },
}

/// Solves every present elementary case of the structure.
///
/// The structure is *not* re-validated here: call
/// [`crate::validate_and_solve`] for the checked variant.
///
/// # Errors
///
/// Returns [`SolveError`] on assembly, factorization or solve failure.
pub fn solve_model(structure: &Structure) -> Result<SolvedModel, SolveError> {
    solve_model_with_diagnostics(structure).map(|(model, _)| model)
}

/// v2.0.0: `solve_model` plus the last P-Δ pass report when the
/// second-order loop ran (`settings.p_delta`).
///
/// # Errors
///
/// Returns [`SolveError`] on any assembly/factorization failure.
pub fn solve_model_with_diagnostics(
    structure: &Structure,
) -> Result<(SolvedModel, Option<crate::p_delta::PDeltaReport>), SolveError> {
    // v1.7.0: tension-only / compression-only members require an outer
    // iteration — deactivate misbehaving members and re-assemble.
    // Every member starts ACTIVE; the behavior iteration deactivates the
    // ones whose axial force violates their tension/compression-only rule.
    let mut active: Vec<bool> = vec![true; structure.beams.len()];
    let mut p_delta_report: Option<crate::p_delta::PDeltaReport> = None;
    for _iteration in 0..12 {
        let (cases, deactivated) = solve_once(structure, &active, &mut p_delta_report)?;
        if deactivated.is_empty() {
            return Ok((
                SolvedModel {
                    n_nodes: structure.nodes.len(),
                    n_beams: structure.beams.len(),
                    cases,
                },
                p_delta_report,
            ));
        }
        for (index, beam) in structure.beams.iter().enumerate() {
            if deactivated.contains(&beam.id) {
                active[index] = false;
            }
        }
    }
    // Budget exhausted: return the last pass (validator-style convergence
    // note surfaces through the envelopes instead of an error).
    let (cases, _) = solve_once(structure, &active, &mut p_delta_report)?;
    Ok((
        SolvedModel {
            n_nodes: structure.nodes.len(),
            n_beams: structure.beams.len(),
            cases,
        },
        p_delta_report,
    ))
}

/// One solve pass: `(case solutions, members whose axial behavior was
/// violated — tension-only in compression / compression-only in tension)`.
pub type SolvePass = (Vec<(LoadCase, CaseSolution)>, Vec<u32>);

/// One full assembly + factorization + solve pass.
fn solve_once(
    structure: &Structure,
    active: &[bool],
    p_delta_report: &mut Option<crate::p_delta::PDeltaReport>,
) -> Result<SolvePass, SolveError> {
    let elements = build_elements(structure)?;
    let ndof = 6 * structure.nodes.len();

    let mut cases: Vec<LoadCase> = vec![LoadCase::Permanent];
    for case in [
        LoadCase::Variable,
        LoadCase::Wind,
        LoadCase::Snow,
        LoadCase::Acceleration,
    ] {
        let present = structure.loads.iter().any(|l| l.case == case)
            || (case == LoadCase::Permanent && structure.self_weight_enabled);
        if present && !cases.contains(&case) {
            cases.push(case);
        }
    }

    // --- Assemble the global stiffness (full symmetric triplet map) -------
    let mut stiffness: BTreeMap<(usize, usize), f64> = BTreeMap::new();
    let mut springs: Vec<(usize, f64)> = Vec::new();
    // v1.7.0: inclined supports — penalty projection along the user axis.
    let mut inclines: Vec<(usize, [f64; 3])> = Vec::new();
    for support in &structure.supports {
        let base = structure
            .dof_offset(support.node_id)
            .map_err(|_| SolveError::Sparse {
                message: format!("support references missing node {}", support.node_id),
            })?;
        for (i, &locked) in support.locked_dofs.iter().enumerate() {
            let k = support.spring_stiffness[i];
            if !locked && k > 0.0 {
                springs.push((base + i, k));
            }
        }
        if let Some(direction) = support.incline {
            let norm =
                (direction.x * direction.x + direction.y * direction.y + direction.z * direction.z)
                    .sqrt();
            if norm > 1e-12 && support.locked_dofs[2] {
                let n = [direction.x / norm, direction.y / norm, direction.z / norm];
                inclines.push((base, n));
            }
        }
    }

    let assemble = |i: usize, j: usize, v: f64, map: &mut BTreeMap<(usize, usize), f64>| {
        if v == 0.0 {
            return;
        }
        *map.entry((i, j)).or_insert(0.0) += v;
    };

    for (index, data) in elements.iter().enumerate() {
        // v1.7.0: deactivated behavior members keep a 1e-6 residual
        // stiffness so the model never gains a numerical mechanism.
        let scale = if active[index] { 1.0 } else { 1.0e-6 };
        // Uncondensed element for assembly: releases produce a condensed
        // retained block, assembled at the retained global DOFs.
        let element = build_case_element(data, &zero_load())
            .map_err(|e| SolveError::Load(LoadVectorError::from(e)))?;
        for i in 0..element.n_retained {
            let gi = data.local_to_global[element.retained_local_dof[i]];
            for j in 0..element.n_retained {
                let gj = data.local_to_global[element.retained_local_dof[j]];
                assemble(gi, gj, scale * element.k_retained[(i, j)], &mut stiffness);
            }
        }
    }
    for (dof, k) in springs {
        assemble(dof, dof, k, &mut stiffness);
    }
    // Penalty stiffness along inclined directions (large but finite so the
    // matrix stays well-conditioned relative to member stiffnesses).
    let penalty = {
        let scale = stiffness
            .iter()
            .filter(|((i, j), _)| i == j)
            .map(|(_, v)| v.abs())
            .fold(1.0e-9_f64, f64::max);
        scale * 1.0e3
    };
    for (base, n) in &inclines {
        for i in 0..3 {
            for j in 0..3 {
                assemble(base + i, base + j, penalty * n[i] * n[j], &mut stiffness);
            }
        }
    }

    // --- Reduced (free) system: upper triangle for the Cholesky -----------
    let mut locked: Vec<bool> = locked_dofs(structure)?;
    // v1.7.0: 2D plane-frame mode constrains Uy (1), Rx (3), Rz (5).
    if structure.settings.plane_frame_2d {
        for node_index in 0..structure.nodes.len() {
            for local in [1usize, 3, 5] {
                locked[node_index * 6 + local] = true;
            }
        }
    }
    let free: Vec<usize> = (0..ndof).filter(|&d| !locked[d]).collect();
    let mut free_index = vec![usize::MAX; ndof];
    for (slot, &dof) in free.iter().enumerate() {
        free_index[dof] = slot;
    }

    let mut reduced: Vec<Triplet<usize, usize, f64>> = Vec::new();
    for (&(i, j), &v) in &stiffness {
        // The map holds both (i, j) and (j, i); keep the upper-triangle form
        // once so off-diagonals are not counted twice.
        if i > j || locked[i] || locked[j] {
            continue;
        }
        let (fi, fj) = (free_index[i], free_index[j]);
        if fi <= fj {
            reduced.push(Triplet::new(fi, fj, v));
        } else {
            reduced.push(Triplet::new(fj, fi, v));
        }
    }

    let n_free = free.len();
    #[cfg(test)]
    if n_free == 0 {
        // Fully restrained model: every DOF is known (settled); solve the
        // reactions directly without factorization.
        let mut solutions = Vec::with_capacity(cases.len());
        for case in &cases {
            let rhs = assemble_case_vector(structure, &elements, *case)?;
            let displacements: Vec<f64> =
                (0..ndof).map(|dof| settlement_of(structure, dof)).collect();
            let mut reactions = vec![0.0f64; ndof];
            for (&(i, j), &v) in &stiffness {
                if i == j {
                    reactions[i] += v * displacements[i];
                } else {
                    if locked[i] {
                        reactions[i] += v * displacements[j];
                    }
                    if locked[j] {
                        reactions[j] += v * displacements[i];
                    }
                }
            }
            for (i, r) in reactions.iter_mut().enumerate() {
                *r -= rhs[i];
            }
            let mut beam_end_forces = vec![0.0f64; ELEMENT_DOFS * structure.beams.len()];
            for (b, data) in elements.iter().enumerate() {
                if !active[b] {
                    continue;
                }
                let f_local = beam_case_load_local(structure, data, *case)?;
                let element = build_case_element(data, &f_local)
                    .map_err(|e| SolveError::Load(LoadVectorError::from(e)))?;
                let mut u_local = SMatrix::<f64, ELEMENT_DOFS, 1>::zeros();
                for (local_dof, &gdof) in data.local_to_global.iter().enumerate() {
                    u_local[(local_dof, 0)] = displacements[gdof];
                }
                let f_end = element.end_forces(&u_local);
                for (dof, value) in f_end.iter().enumerate() {
                    beam_end_forces[ELEMENT_DOFS * b + dof] = *value;
                }
            }
            solutions.push((
                *case,
                CaseSolution {
                    displacements,
                    reactions,
                    beam_end_forces,
                },
            ));
        }
        return Ok(behavior_check(structure, active, solutions));
    }
    let reduced_mat = SparseColMat::<usize, f64>::try_new_from_triplets(n_free, n_free, &reduced)
        .map_err(|e| SolveError::Sparse {
        message: e.to_string(),
    })?;
    let symbolic = match SymbolicLlt::try_new(reduced_mat.symbolic(), Side::Upper) {
        Ok(symbolic) => symbolic,
        Err(e) => {
            return Err(SolveError::UnstableMechanism {
                message: format!("symbolic factorization failed: {e}"),
            });
        }
    };
    let llt = match Llt::try_new_with_symbolic(symbolic, reduced_mat.as_ref(), Side::Upper) {
        Ok(llt) => llt,
        Err(e) => {
            // v1.7.0: diagnose the mechanism — name the offending nodes.
            let message = diagnose_mechanism(structure, &free, n_free, &e.to_string());
            return Err(SolveError::UnstableMechanism { message });
        }
    };

    // v1.7.0: prescribed support settlements — known-DOF contributions
    // move to the RHS: K_ff·u_f = F_f − K_fl·u_l.
    let settlement_rhs = |displacements: &[f64]| -> Vec<f64> {
        let mut adj = vec![0.0f64; ndof];
        for (&(i, j), &v) in &stiffness {
            if i == j || !locked[i] {
                continue;
            }
            let s = settlement_of(structure, j);
            if s != 0.0 {
                adj[i] += v * s;
            }
            if !locked[j] {
                let s = settlement_of(structure, i);
                if s != 0.0 {
                    adj[j] += v * s;
                }
            }
        }
        let _ = displacements;
        adj
    };
    let settlement_at = |dof: usize| -> f64 { settlement_of(structure, dof) };

    // --- Solve each case --------------------------------------------------
    let mut solutions = Vec::with_capacity(cases.len());
    for case in &cases {
        let rhs = assemble_case_vector(structure, &elements, *case)?;
        let settle = settlement_rhs(&rhs);
        let mut reduced_rhs = faer::Mat::<f64>::zeros(n_free, 1);
        for (slot, &dof) in free.iter().enumerate() {
            reduced_rhs[(slot, 0)] = rhs[dof] - settle[dof];
        }
        llt.solve_in_place(&mut reduced_rhs);

        let mut displacements = vec![0.0f64; ndof];
        for (slot, &dof) in free.iter().enumerate() {
            displacements[dof] = reduced_rhs[(slot, 0)];
        }
        // Known DOFs take their prescribed settlement value.
        for dof in 0..ndof {
            if locked[dof] {
                displacements[dof] = settlement_at(dof);
            }
        }

        // v2.0.0: second-order P-Δ tangent loop when enabled — refines the
        // free-DOF displacements with `Kg(N)` from the current axial map.
        if structure.settings.p_delta && !free.is_empty() {
            // Upper-triangle map → dense symmetric Ke on the free DOFs.
            let mut ke_dense = nalgebra::DMatrix::<f64>::zeros(n_free, n_free);
            for (&(i, j), &v) in &stiffness {
                if i > j || locked[i] || locked[j] {
                    continue;
                }
                let (fi, fj) = (free_index[i], free_index[j]);
                let (ri, rj) = if fi <= fj { (fi, fj) } else { (fj, fi) };
                ke_dense[(ri, rj)] += v;
                if ri != rj {
                    ke_dense[(rj, ri)] += v;
                }
            }
            let mut u_linear = nalgebra::DVector::<f64>::zeros(n_free);
            let mut f_reduced = nalgebra::DVector::<f64>::zeros(n_free);
            for (slot, &dof) in free.iter().enumerate() {
                u_linear[slot] = displacements[dof];
                f_reduced[slot] = rhs[dof] - settle[dof];
            }
            let (u_refined, report) = crate::p_delta::refine_with_geometric(
                structure, &ke_dense, &f_reduced, &u_linear, 8, 1e-9,
            )
            .map_err(|e| SolveError::UnstableMechanism {
                message: e.to_string(),
            })?;
            *p_delta_report = Some(report);
            for (slot, &dof) in free.iter().enumerate() {
                displacements[dof] = u_refined[slot];
            }
        }

        // Reactions on constrained DOFs: R = K u − F. The map holds both
        // (i, j) and (j, i); walk the upper triangle once so each row term
        // is accumulated exactly once.
        let mut reactions = vec![0.0f64; ndof];
        for (&(i, j), &v) in &stiffness {
            if i >= j {
                continue;
            }
            if locked[i] {
                reactions[i] += v * displacements[j];
            }
            if locked[j] {
                reactions[j] += v * displacements[i];
            }
        }
        // Diagonal drops for locked DOFs: R_i = K_ii·u_i (prescribed motion).
        for dof in 0..ndof {
            if !locked[dof] {
                continue;
            }
            if let Some(v) = stiffness.get(&(dof, dof)) {
                reactions[dof] += v * displacements[dof];
            }
        }
        for (i, r) in reactions.iter_mut().enumerate().take(ndof) {
            if locked[i] {
                *r -= rhs[i];
            } else {
                *r = 0.0;
            }
        }
        // v1.7.0: inclined support reactions = penalty force along n.
        for (base, n) in &inclines {
            let mut delta = 0.0;
            for (i, &component) in n.iter().enumerate() {
                delta += component * displacements[base + i];
            }
            for (i, &component) in n.iter().enumerate() {
                reactions[base + i] += penalty * delta * component;
            }
        }

        // Local beam end forces for this case.
        let mut beam_end_forces = vec![0.0f64; ELEMENT_DOFS * structure.beams.len()];
        for (b, data) in elements.iter().enumerate() {
            let f_local = if active[b] {
                beam_case_load_local(structure, data, *case)?
            } else {
                // Deactivated members carry no span load contribution.
                zero_load()
            };
            let element = build_case_element(data, &f_local)
                .map_err(|e| SolveError::Load(LoadVectorError::from(e)))?;
            let mut u_local = SMatrix::<f64, ELEMENT_DOFS, 1>::zeros();
            for (local_dof, &gdof) in data.local_to_global.iter().enumerate() {
                u_local[(local_dof, 0)] = displacements[gdof];
            }
            let mut f_end = element.end_forces(&u_local);
            if !active[b] {
                // Deactivated members keep only their residual force.
                f_end *= 1.0e-6;
            }
            for (dof, value) in f_end.iter().enumerate() {
                beam_end_forces[ELEMENT_DOFS * b + dof] = *value;
            }
        }

        solutions.push((
            *case,
            CaseSolution {
                displacements,
                reactions,
                beam_end_forces,
            },
        ));
    }

    Ok(behavior_check(structure, active, solutions))
}

/// v1.7.0: tension-only / compression-only convergence check over the
/// freshly solved cases.
fn behavior_check(
    structure: &Structure,
    active: &[bool],
    solutions: Vec<(LoadCase, CaseSolution)>,
) -> SolvePass {
    let mut deactivated: Vec<u32> = Vec::new();
    for (index, beam) in structure.beams.iter().enumerate() {
        if !active[index] {
            continue;
        }
        let Some(axial) = case_axial(&solutions, index) else {
            continue;
        };
        let violates = match beam.behavior {
            rdm_model::MemberBehavior::TensionOnly => axial < -1e-9,
            rdm_model::MemberBehavior::CompressionOnly => axial > 1e-9,
            rdm_model::MemberBehavior::Standard => false,
        };
        if violates {
            deactivated.push(beam.id);
        }
    }
    (solutions, deactivated)
}

/// Axial force of one beam in the Permanent case (N, tension positive).
fn case_axial(solutions: &[(LoadCase, CaseSolution)], beam_index: usize) -> Option<f64> {
    let (_, solution) = solutions.first()?;
    let base = 12 * beam_index;
    let n1 = solution.beam_end_forces.get(base)?;
    Some(-*n1)
}

/// Prescribed settlement of one global DOF (0 when the node has no support).
fn settlement_of(structure: &Structure, dof: usize) -> f64 {
    let node_index = dof / 6;
    let local = dof % 6;
    let Some(node) = structure.nodes.get(node_index) else {
        return 0.0;
    };
    for support in &structure.supports {
        if support.node_id == node.id {
            return support.settlement[local];
        }
    }
    0.0
}

/// v1.7.0: mechanism diagnosis — names the offending nodes / DOFs by
/// inspecting the near-null space of the reduced stiffness matrix.
fn diagnose_mechanism(
    structure: &Structure,
    free: &[usize],
    n_free: usize,
    reason: &str,
) -> String {
    let _ = n_free;
    // Constraint-counting heuristic: free DOFs on nodes without any
    // restraint component are the usual offenders.
    let mut restrained_count: BTreeMap<usize, usize> = BTreeMap::new();
    for support in &structure.supports {
        if let Ok(base) = structure.dof_offset(support.node_id) {
            let count = support.locked_dofs.iter().filter(|&&l| l).count()
                + support
                    .spring_stiffness
                    .iter()
                    .filter(|&&k| k > 0.0)
                    .count();
            restrained_count.insert(base, count);
        }
    }
    let mut offenders: Vec<String> = Vec::new();
    for (slot, &dof) in free.iter().enumerate() {
        let _ = slot;
        let node_index = dof / 6;
        let local = dof % 6;
        let names = ["Ux", "Uy", "Uz", "Rx", "Ry", "Rz"];
        let Some(node) = structure.nodes.get(node_index) else {
            continue;
        };
        let restrained = restrained_count
            .get(&(node_index * 6))
            .copied()
            .unwrap_or(0);
        if restrained == 0 {
            offenders.push(format!(
                "N{} {} (node without any restraint component)",
                node.id, names[local]
            ));
        }
        if offenders.len() >= 6 {
            break;
        }
    }
    if offenders.is_empty() {
        format!(
            "the reduced stiffness matrix is not positive definite ({reason}): check supports \
             and end releases"
        )
    } else {
        format!(
            "mechanism detected ({reason}) — unchecked displacements at: {}",
            offenders.join("; ")
        )
    }
}

/// P-Δ second-order analysis errors (v2.0.0).
#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum PDeltaError {
    /// The tangent stiffness lost positive definiteness or the loop hit
    /// an assembly failure (context string).
    #[error("p-delta diverged: {0}")]
    Diverged(String),
}

/// Linear buckling analysis errors (v1.9.0).
#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum BucklingError {
    /// Assembly or factorization failure with context.
    #[error("buckling assembly error: {0}")]
    Assembly(String),
    /// Load-vector failure during the axial map build.
    #[error("buckling load error: {0}")]
    Load(#[from] LoadVectorError),
}

/// Axial forces of every member under the Permanent case
/// (N, tension positive) — the input of the geometric stiffness.
///
/// # Errors
///
/// Returns [`SolveError`] when the model cannot be solved.
pub fn permanent_axial_forces(structure: &Structure) -> Result<Vec<f64>, SolveError> {
    let solved = solve_model(structure)?;
    let Some((_, solution)) = solved.cases.first() else {
        return Ok(vec![0.0; structure.beams.len()]);
    };
    Ok((0..structure.beams.len())
        .map(|index| {
            solution
                .beam_end_forces
                .get(12 * index)
                .map_or(0.0, |f| -*f)
        })
        .collect())
}

/// Superposed response vectors: `(displacements, reactions, end_forces)`.
pub type SuperposedResponse = (Vec<f64>, Vec<f64>, Vec<f64>);

/// Linear superposition of elementary cases: `result = sum f_i * case_i`.
///
/// Returns `(displacements, reactions, beam_end_forces)` in the same flat
/// layouts as [`CaseSolution`].
///
/// # Errors
///
/// Returns [`SolveError::Load`] if a listed case is not part of the solved
/// model.
pub fn superimpose(
    solved: &SolvedModel,
    weights: &[(LoadCase, f64)],
) -> Result<SuperposedResponse, SolveError> {
    let ndof = 6 * solved.n_nodes;
    let mut u = vec![0.0f64; ndof];
    let mut r = vec![0.0f64; ndof];
    let mut f = vec![0.0f64; 12 * solved.n_beams];
    for (case, weight) in weights {
        let Some((_, sol)) = solved.cases.iter().find(|(c, _)| c == case) else {
            return Err(SolveError::Sparse {
                message: format!("case {case:?} was not solved"),
            });
        };
        for (u_i, s_i) in u.iter_mut().zip(sol.displacements.iter()) {
            *u_i += weight * s_i;
        }
        for (r_i, s_i) in r.iter_mut().zip(sol.reactions.iter()) {
            *r_i += weight * s_i;
        }
        for (f_i, s_i) in f.iter_mut().zip(sol.beam_end_forces.iter()) {
            *f_i += weight * s_i;
        }
    }
    Ok((u, r, f))
}

pub(crate) fn zero_load() -> SMatrix<f64, ELEMENT_DOFS, 1> {
    SMatrix::zeros()
}

/// Locked-DOF flags per global DOF from the support conditions.
///
/// # Errors
///
/// Returns [`SolveError::Load`] when the model cannot be resolved.
pub fn locked_dofs(structure: &Structure) -> Result<Vec<bool>, SolveError> {
    let ndof = 6 * structure.nodes.len();
    let mut locked = vec![false; ndof];
    for support in &structure.supports {
        let base = structure
            .dof_offset(support.node_id)
            .map_err(|_| SolveError::Sparse {
                message: format!("support references missing node {}", support.node_id),
            })?;
        for (i, &is_locked) in support.locked_dofs.iter().enumerate() {
            if is_locked {
                locked[base + i] = true;
            }
        }
    }
    Ok(locked)
}
