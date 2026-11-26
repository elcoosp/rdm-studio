//! P-Δ second-order analysis (v2.0.0): true iterative tangent-stiffness
//! loop — each pass assembles `Kg(N)` from the current axial force
//! distribution, re-solves `[Ke + Kg(N)]·Δu = F − Ke·u` on the free
//! DOFs and stops when the displacement residual converges.

use nalgebra::{Cholesky, DMatrix, DVector};
use rdm_model::Structure;

use crate::buckling::assemble_geometric_with_axials;
use crate::static_sparse::{PDeltaError, SolvedModel};

/// Result of the P-Δ iteration.
#[derive(Debug, Clone, PartialEq)]
pub struct PDeltaReport {
    /// One solved model per pass (the last one is the answer).
    pub passes: usize,
    /// Converged: the max displacement change between passes.
    pub residual: f64,
}

/// Axial force of every member (N, **compression positive** — the
/// convention of `permanent_axial_forces` and the geometric-stiffness
/// assembly) computed directly from a displacement field:
/// `N = −EA/L · (e_x · (u2 − u1))` — pure post-processing, no re-solve.
///
/// # Panics
///
/// Never — unknown materials/sections yield `N = 0` for that member.
#[must_use]
pub fn axial_from_displacements(structure: &Structure, displacements: &[f64]) -> Vec<f64> {
    let Ok(elements) = crate::loads::build_elements(structure) else {
        return vec![0.0; structure.beams.len()];
    };
    let node_index = |id: u32| -> usize {
        structure
            .nodes
            .iter()
            .position(|n| n.id == id)
            .unwrap_or(usize::MAX)
    };
    elements
        .iter()
        .enumerate()
        .map(|(index, data)| {
            let beam = &structure.beams[index];
            let ea = structure
                .materials
                .get(&beam.material_id)
                .zip(structure.sections.get(&beam.section_id))
                .map_or(0.0, |(m, s)| m.e * s.a);
            let length = data.frame.length.max(1e-12);
            let (i1, i2) = (node_index(beam.n1), node_index(beam.n2));
            if i1 == usize::MAX || i2 == usize::MAX {
                return 0.0;
            }
            let mut du = 0.0;
            for (axis, &component) in data.frame.ex.as_ref().iter().enumerate() {
                let d1 = displacements[6 * i1 + axis];
                let d2 = displacements[6 * i2 + axis];
                du += component * (d2 - d1);
            }
            -ea / length * du
        })
        .collect()
}

/// Runs the P-Δ tangent loop for ONE load case (free-DOF reduced form).
///
/// * `ke_reduced` — elastic stiffness on the free DOFs.
/// * `f_reduced`  — the case load vector on the free DOFs, already
///   corrected for prescribed settlements.
/// * `u_linear`   — the first-order solution (free-DOF layout).
///
/// Returns the converged free-DOF displacements and the pass report.
///
/// # Errors
///
/// Returns [`PDeltaError::Diverged`] when the tangent stiffness loses
/// positive definiteness (applied load beyond the critical value).
pub fn refine_with_geometric(
    structure: &Structure,
    ke_reduced: &DMatrix<f64>,
    f_reduced: &DVector<f64>,
    u_linear: &DVector<f64>,
    max_passes: usize,
    tol: f64,
) -> Result<(DVector<f64>, PDeltaReport), PDeltaError> {
    let n_free = u_linear.len();
    let mut u_prev = u_linear.clone();
    let mut passes = 0usize;
    let mut residual = 0.0_f64;
    for _pass in 0..max_passes.clamp(1, 12) {
        passes += 1;
        // 1. Axial map of the CURRENT displacement field (free-slot → DOF).
        let mut full = vec![0.0_f64; 6 * structure.nodes.len()];
        let free_list = {
            let locked = crate::static_sparse::locked_dofs(structure)
                .map_err(|e| PDeltaError::Diverged(e.to_string()))?;
            (0..6 * structure.nodes.len())
                .filter(|&d| !locked[d])
                .collect::<Vec<usize>>()
        };
        for (slot, value) in u_prev.iter().enumerate() {
            if let Some(&dof) = free_list.get(slot) {
                full[dof] = *value;
            }
        }
        // NOTE: locked DOFs are zero in the reduced layout; settlements
        // enter through F only (the first-order path already accounted
        // for them in the RHS), so the axial map of the free DOFs is
        // exact for the loop.
        let axials = axial_from_displacements(structure, &full);

        // 2. Kg(N) on the same reduced layout.
        let (_ke, kg, _free) = assemble_geometric_with_axials(structure, &axials)
            .map_err(|e| PDeltaError::Diverged(e.to_string()))?;
        if kg.nrows() != n_free {
            return Err(PDeltaError::Diverged(
                "reduced layout mismatch between K_e and K_g".to_owned(),
            ));
        }
        // 3. Tangent stiffness and re-solve.
        let k_tangent = ke_reduced + kg;
        let Some(chol) = Cholesky::new(k_tangent) else {
            return Err(PDeltaError::Diverged(
                "tangent stiffness not positive definite: applied load exceeds the critical value"
                    .to_owned(),
            ));
        };
        let u_next = chol.solve(f_reduced);
        // 4. Residual on the free DOFs.
        residual = (0..n_free)
            .map(|r| (u_next[r] - u_prev[r]).abs())
            .fold(0.0_f64, f64::max);
        u_prev = u_next;
        if residual < tol {
            break;
        }
    }
    Ok((u_prev, PDeltaReport { passes, residual }))
}

/// Convenience wrapper used by tests and the wasm bridge: solves the
/// model linearly, refines it with the P-Δ loop and returns the
/// refined `SolvedModel` plus the pass report.
///
/// # Errors
///
/// Returns [`PDeltaError`] on solve or tangent failure.
pub fn p_delta_solve(
    structure: &Structure,
    _max_passes: usize,
    _tol: f64,
) -> Result<(SolvedModel, PDeltaReport), PDeltaError> {
    // The second-order loop lives inside `solve_model_with_diagnostics`
    // (wired per-case in `solve_once` when `settings.p_delta` is set);
    // this wrapper surfaces its report without re-refining.
    let mut structure = structure.clone();
    structure.settings.p_delta = true;
    let (model, report) = crate::static_sparse::solve_model_with_diagnostics(&structure)
        .map_err(|e| PDeltaError::Diverged(e.to_string()))?;
    Ok((
        model,
        report.unwrap_or(PDeltaReport {
            passes: 1,
            residual: 0.0,
        }),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;
    use rdm_model::{
        Beam, MaterialProperties, Node, SectionProperties, SectionShape, Structure, Support,
    };

    const E: f64 = 210e9;
    const IY: f64 = 8.33e-6;
    const LENGTH: f64 = 4.0;

    /// Fixed-free cantilever column with axial compression and a tip
    /// transverse load — the sway amplification benchmark.
    fn cantilever(axial: f64, transverse: f64) -> Structure {
        let mut s = Structure::default();
        s.materials.insert(
            "S235".to_owned(),
            MaterialProperties {
                e: E,
                g: 80.8e9,
                nu: 0.3,
                rho: 7850.0,
                fy: 235e6,
                fu: 360e6,
            },
        );
        s.sections.insert(
            "RECT".to_owned(),
            SectionProperties {
                shape: SectionShape::General,
                a: 0.01,
                iy: IY,
                iz: IY,
                it: 2.29e-7,
                iw: None,
                wel_y: 1.666e-4,
                wel_z: 1.666e-4,
                wpl_y: Some(2.5e-4),
                wpl_z: Some(2.5e-4),
                h: Some(0.1),
                b: Some(0.1),
                tw: Some(0.1),
                tf: Some(0.1),
                r: Some(0.0),
            },
        );
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, LENGTH, 0.0, 0.0));
        s.beams.push(Beam::frame(1, 1, 2, "RECT", "S235"));
        s.supports.push(Support::fixed(1));
        s.loads.push(rdm_model::Load {
            case: rdm_model::LoadCase::Permanent,
            kind: rdm_model::LoadKind::Nodal {
                node_id: 2,
                forces: rdm_model::GlobalForces {
                    fx: -axial,
                    fy: -transverse,
                    fz: 0.0,
                    mx: 0.0,
                    my: 0.0,
                    mz: 0.0,
                },
            },
        });
        s.self_weight_enabled = false;
        s.settings.p_delta = true;
        s
    }

    #[test]
    fn sway_amplification_matches_the_second_order_closed_form() {
        // Exact cantilever: Pcr = π²EI / (4L²); the 1-element FE value is
        // ≈ 2.45 EI/L² — the amplification at P = 0.5·Pcr_exact is ≈ 2.
        let pcr_exact = std::f64::consts::PI.powi(2) * E * IY / (4.0 * LENGTH * LENGTH);
        let p_half = 0.5 * pcr_exact;
        let s = cantilever(p_half, 10_000.0);
        let (refined, report) = p_delta_solve(&s, 12, 1e-12).expect("p-delta");
        assert!(
            report.passes >= 2,
            "the loop must iterate, passes={}",
            report.passes
        );
        let linear = crate::static_sparse::solve_model(&cantilever(0.0, 10_000.0)).expect("linear");
        let lin = &linear.cases.first().expect("case").1;
        let sec = &refined.cases.first().expect("case").1;
        let tip_linear = lin.displacements[7];
        let tip_second = sec.displacements[7];
        let amplification = tip_second / tip_linear;
        assert_relative_eq!(amplification, 2.0, epsilon = 0.25);
    }

    #[test]
    fn without_axial_force_the_refinement_is_identity() {
        let s = cantilever(0.0, 10_000.0);
        let (refined, report) = p_delta_solve(&s, 8, 1e-12).expect("p-delta");
        // Numerically the re-solve reproduces the linear field to ~1e-15.
        assert!(report.residual < 1e-12, "residual={}", report.residual);
        let linear = crate::static_sparse::solve_model(&s).expect("linear");
        let a = &refined.cases.first().expect("case").1.displacements;
        let b = &linear.cases.first().expect("case").1.displacements;
        for (x, y) in a.iter().zip(b.iter()) {
            assert_relative_eq!(x, y, epsilon = 1e-9);
        }
    }

    #[test]
    fn diverges_past_the_critical_load() {
        let pcr_exact = std::f64::consts::PI.powi(2) * E * IY / (4.0 * LENGTH * LENGTH);
        let s = cantilever(1.2 * pcr_exact, 10_000.0);
        let outcome = p_delta_solve(&s, 8, 1e-12);
        assert!(outcome.is_err());
    }
}
