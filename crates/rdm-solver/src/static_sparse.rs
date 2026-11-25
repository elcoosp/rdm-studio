//! Sparse CSC assembly + Cholesky `LLᵀ` factorization (faer) + mechanism
//! detection, per ARCHITECTURE.md §5 (`static_sparse.rs`).
//!
//! The stiffness matrix is factorized **once**; every elementary load case
//! is then solved by back-substitution, and ULS/SLS envelopes are obtained
//! by linear superposition without any refactorization.

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
    }

    let assemble = |i: usize, j: usize, v: f64, map: &mut BTreeMap<(usize, usize), f64>| {
        if v == 0.0 {
            return;
        }
        *map.entry((i, j)).or_insert(0.0) += v;
    };

    for data in &elements {
        // Uncondensed element for assembly: releases produce a condensed
        // retained block, assembled at the retained global DOFs.
        let element = build_case_element(data, &zero_load())
            .map_err(|e| SolveError::Load(LoadVectorError::from(e)))?;
        for i in 0..element.n_retained {
            let gi = data.local_to_global[element.retained_local_dof[i]];
            for j in 0..element.n_retained {
                let gj = data.local_to_global[element.retained_local_dof[j]];
                assemble(gi, gj, element.k_retained[(i, j)], &mut stiffness);
            }
        }
    }
    for (dof, k) in springs {
        assemble(dof, dof, k, &mut stiffness);
    }

    // --- Reduced (free) system: upper triangle for the Cholesky -----------
    let locked: Vec<bool> = locked_dofs(structure)?;
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
    let reduced_mat = SparseColMat::<usize, f64>::try_new_from_triplets(n_free, n_free, &reduced)
        .map_err(|e| SolveError::Sparse {
        message: e.to_string(),
    })?;
    let symbolic = SymbolicLlt::try_new(reduced_mat.symbolic(), Side::Upper).map_err(|e| {
        SolveError::UnstableMechanism {
            message: format!("symbolic factorization failed: {e}"),
        }
    })?;
    let llt =
        Llt::try_new_with_symbolic(symbolic, reduced_mat.as_ref(), Side::Upper).map_err(|e| {
            SolveError::UnstableMechanism {
                message: format!(
                    "the reduced stiffness matrix is not positive definite ({e}): \
                 check supports and end releases"
                ),
            }
        })?;

    // --- Solve each case --------------------------------------------------
    let mut solutions = Vec::with_capacity(cases.len());
    for case in &cases {
        let rhs = assemble_case_vector(structure, &elements, *case)?;
        let mut reduced_rhs = faer::Mat::<f64>::zeros(n_free, 1);
        for (slot, &dof) in free.iter().enumerate() {
            reduced_rhs[(slot, 0)] = rhs[dof];
        }
        llt.solve_in_place(&mut reduced_rhs);

        let mut displacements = vec![0.0f64; ndof];
        for (slot, &dof) in free.iter().enumerate() {
            displacements[dof] = reduced_rhs[(slot, 0)];
        }

        // Reactions on constrained DOFs: R = K u - F. The map holds both
        // (i, j) and (j, i); walk the upper triangle once so each row term
        // is accumulated exactly once (diagonal drops: U_locked = 0).
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
        for (i, r) in reactions.iter_mut().enumerate().take(ndof) {
            if locked[i] {
                *r -= rhs[i];
            } else {
                *r = 0.0;
            }
        }

        // Local beam end forces for this case.
        let mut beam_end_forces = vec![0.0f64; ELEMENT_DOFS * structure.beams.len()];
        for (b, data) in elements.iter().enumerate() {
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

    Ok(SolvedModel {
        n_nodes: structure.nodes.len(),
        n_beams: structure.beams.len(),
        cases: solutions,
    })
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

fn zero_load() -> SMatrix<f64, ELEMENT_DOFS, 1> {
    SMatrix::zeros()
}

fn locked_dofs(structure: &Structure) -> Result<Vec<bool>, SolveError> {
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
