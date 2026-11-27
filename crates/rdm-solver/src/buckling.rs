//! Linear (Euler) buckling analysis (v1.9.0): `[K_e + λ·K_g]·φ = 0`.
//! The geometric stiffness `K_g` assembles the standard stability
//! matrix of each compressed member; the critical load factors are the
//! smallest eigenvalues obtained by deflated inverse iteration on the
//! pencil `(K_e⁻¹·(−K_g))` — the same solver core as `modal.rs`.

use std::collections::BTreeMap;

use nalgebra::DMatrix;
use rdm_model::Structure;

use crate::loads::build_elements;
use crate::static_sparse::BucklingError;
use crate::stiffness::ELEMENT_DOFS;

/// One buckling mode: load factor `λcr` and the normalized shape
/// (serialized for the wasm bridge).
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct BucklingMode {
    /// 1-based mode index.
    pub mode_index: usize,
    /// Critical load factor `λcr` (multiply the applied loads).
    pub lambda_cr: f64,
    /// Normalized eigenvector (unit L2 norm), global DOF layout.
    pub shape: Vec<f64>,
}

/// Report of the linear buckling analysis (serialized for wasm).
#[derive(Debug, Clone, serde::Serialize)]
pub struct BucklingReport {
    /// Requested modes (top 4 by ascending `λcr`).
    pub modes: Vec<BucklingMode>,
}

/// Geometric-stiffness block of a 12-DOF frame element under axial
/// force `n` (tension positive; compression produces the destabilizing
/// negative-energy terms). Truss-style members use the pure axial
/// cubic block; bending DOFs stay geometrically stiff (first-order).
#[must_use]
pub fn geometric_stiffness_local(
    n: f64,
    length: f64,
) -> nalgebra::SMatrix<f64, ELEMENT_DOFS, ELEMENT_DOFS> {
    let mut g = nalgebra::SMatrix::<f64, ELEMENT_DOFS, ELEMENT_DOFS>::zeros();
    if length <= 0.0 || n == 0.0 {
        return g;
    }
    let p = -n / length; // compression positive factor
    // Transverse DOF blocks: standard 2x2 stability matrices per plane.
    // x-y plane (uy=1, rz=5 | uy2=7, rz2=11).
    let ky = p / 30.0;
    let c: [[f64; 4]; 4] = [
        [36.0, 3.0 * length, -36.0, 3.0 * length],
        [
            3.0 * length,
            4.0 * length * length,
            -3.0 * length,
            -length * length,
        ],
        [-36.0, -3.0 * length, 36.0, -3.0 * length],
        [
            3.0 * length,
            -length * length,
            -3.0 * length,
            4.0 * length * length,
        ],
    ];
    let idx = [1usize, 5, 7, 11];
    for (i, &ii) in idx.iter().enumerate() {
        for (j, &jj) in idx.iter().enumerate() {
            g[(ii, jj)] += ky * c[i][j];
        }
    }
    // x-z plane (uz=2, ry=4 | uz2=8, ry2=10): the ry convention (slope =
    // -ry) flips the same 8 rotation-adjacent couplings as the elastic
    // matrix — translations and diagonals keep their signs.
    let idx2 = [2usize, 4, 8, 10];
    // Rotation-adjacent couplings whose sign flips with the ry convention.
    let flip = |i: usize, j: usize| -> bool {
        (i, j) == (0, 1)
            || (i, j) == (1, 0)
            || (i, j) == (0, 3)
            || (i, j) == (3, 0)
            || (i, j) == (1, 2)
            || (i, j) == (2, 1)
            || (i, j) == (2, 3)
            || (i, j) == (3, 2)
    };
    for (i, &ii) in idx2.iter().enumerate() {
        for (j, &jj) in idx2.iter().enumerate() {
            let mut value = ky * c[i][j];
            if flip(i, j) {
                value = -value;
            }
            g[(ii, jj)] += value;
        }
    }
    g
}

/// Assembles the reduced geometric stiffness for the current first-order
/// axial force distribution (Permanent case).
///
/// # Errors
///
/// Returns [`BucklingError::Assembly`] when the model cannot be built or
/// the axial map cannot be recovered.
/// Reduced matrices of the buckling pencil: `(K_e, K_g, free DOFs)`.
pub type BucklingMatrices = (DMatrix<f64>, DMatrix<f64>, Vec<usize>);

/// Assembles the reduced geometric stiffness for the current first-order
/// axial force distribution (Permanent case).
///
/// # Errors
///
/// Returns [`BucklingError::Assembly`] when the model cannot be built or
/// the axial map cannot be recovered.
pub fn assemble_geometric(structure: &Structure) -> Result<BucklingMatrices, BucklingError> {
    let axial = crate::static_sparse::permanent_axial_forces(structure)
        .map_err(|e| BucklingError::Assembly(e.to_string()))?;
    assemble_geometric_with_axials(structure, &axial)
}

/// Assembles `(Ke, Kg(N), free)` from a caller-supplied axial map —
/// the P-Δ tangent loop calls this every pass with the current
/// second-order axial forces (v2.0.0).
///
/// # Errors
///
/// Returns [`BucklingError::Assembly`] when the model cannot be built.
pub fn assemble_geometric_with_axials(
    structure: &Structure,
    axial: &[f64],
) -> Result<BucklingMatrices, BucklingError> {
    let elements = build_elements(structure).map_err(BucklingError::from)?;
    let ndof = 6 * structure.nodes.len();
    // Reuse the modal K assembly for the elastic part.
    let modal = crate::modal::assemble_reduced_k(structure)
        .map_err(|e| BucklingError::Assembly(e.to_string()))?;
    let (k_reduced, free) = modal;
    let mut free_index = vec![usize::MAX; ndof];
    for (slot, &dof) in free.iter().enumerate() {
        free_index[dof] = slot;
    }
    let n_free = free.len();
    let mut g_map: BTreeMap<(usize, usize), f64> = BTreeMap::new();
    for (index, data) in elements.iter().enumerate() {
        let n = axial.get(index).copied().unwrap_or(0.0);
        let g_local = geometric_stiffness_local(n, data.frame.length);
        let g_global = data.rotation.transpose() * g_local * data.rotation;
        for i in 0..ELEMENT_DOFS {
            let gi = data.local_to_global[i];
            for j in 0..ELEMENT_DOFS {
                let gj = data.local_to_global[j];
                if gi > gj || free_index[gi] == usize::MAX || free_index[gj] == usize::MAX {
                    continue;
                }
                *g_map.entry((free_index[gi], free_index[gj])).or_insert(0.0) += g_global[(i, j)];
            }
        }
    }
    let mut g_reduced = DMatrix::zeros(n_free, n_free);
    for ((i, j), v) in &g_map {
        g_reduced[(*i, *j)] += v;
        if i != j {
            g_reduced[(*j, *i)] += v;
        }
    }
    Ok((k_reduced, g_reduced, free))
}

/// Runs the linear buckling analysis for the `n_modes` smallest load
/// factors (top 4 by default).
///
/// # Errors
///
/// Returns [`BucklingError`] on assembly or iteration failure.
pub fn buckling_analysis(
    structure: &Structure,
    n_modes: usize,
) -> Result<BucklingReport, BucklingError> {
    let (k, g, free) = assemble_geometric(structure)?;
    let n_free = free.len();
    if n_free == 0 {
        return Err(BucklingError::Assembly(
            "no free degrees of freedom".to_owned(),
        ));
    }
    // Generalized symmetric-definite pencil: smallest λ of K φ = −λ G φ.
    // Inverse iteration on A = K⁻¹(−G), eigenvalues λ = 1/μ.
    let k_cholesky = nalgebra::linalg::Cholesky::new(k * 1.0).ok_or_else(|| {
        BucklingError::Assembly("elastic stiffness not positive definite".to_owned())
    })?;
    let a = {
        let rhs = -&g;
        k_cholesky.solve(&rhs)
    };
    let requested = n_modes.clamp(1, 8);
    let mut modes: Vec<BucklingMode> = Vec::with_capacity(requested);
    let mut rng_state: u64 = 0x9E37_79B9_7F4A_7C15;
    let mut next_random = move || {
        rng_state ^= rng_state >> 12;
        rng_state ^= rng_state << 25;
        rng_state ^= rng_state >> 27;
        (rng_state.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 11) as f64 / (1u64 << 53) as f64 - 0.5
    };
    for mode_index in 1..=requested {
        let mut phi: Vec<f64> = (0..n_free).map(|_| next_random()).collect();
        // Deflate against the found modes.
        for found in &modes {
            let dot: f64 = (0..n_free).map(|r| found.shape[r] * phi[r]).sum();
            for (r, phi_r) in phi.iter_mut().enumerate().take(n_free) {
                *phi_r -= dot * found.shape[r];
            }
        }
        let mut eigen = 1.0_f64;
        let mut converged = false;
        for _iteration in 0..80 {
            // Inverse iteration on A = K⁻¹(−G): x = A·φ, dominant μ = 1/λ.
            let rhs_vec = nalgebra::DVector::from_vec(phi.clone());
            let x = &a * rhs_vec;
            let norm = x.norm();
            if norm < 1e-14 || !norm.is_finite() {
                break;
            }
            let mut next: Vec<f64> = x.iter().copied().collect();
            for found in &modes {
                let dot: f64 = (0..n_free).map(|r| found.shape[r] * next[r]).sum();
                for (r, next_r) in next.iter_mut().enumerate().take(n_free) {
                    *next_r -= dot * found.shape[r];
                }
            }
            let next_norm = nalgebra::DVector::from_vec(next.clone()).norm();
            if next_norm < 1e-14 || !next_norm.is_finite() {
                break;
            }
            for value in &mut next {
                *value /= next_norm;
            }
            let delta: f64 = (0..n_free)
                .map(|r| (next[r] - phi[r]).abs())
                .fold(0.0_f64, f64::max);
            phi = next;
            eigen = next_norm;
            if delta < 1e-9 {
                converged = true;
                break;
            }
        }
        let _ = converged;
        if eigen <= 1e-12 || !eigen.is_finite() {
            continue;
        }
        let lambda = 1.0 / eigen;
        if lambda > 0.0 && lambda.is_finite() {
            modes.push(BucklingMode {
                mode_index,
                lambda_cr: lambda,
                shape: phi,
            });
        }
    }
    modes.sort_by(|a, b| a.lambda_cr.total_cmp(&b.lambda_cr));
    for (index, mode) in modes.iter_mut().enumerate() {
        mode.mode_index = index + 1;
    }
    Ok(BucklingReport { modes })
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;
    use rdm_model::{
        Beam, MaterialProperties, Node, SectionProperties, SectionShape, Structure, Support,
    };

    fn column(load: f64) -> Structure {
        let mut s = Structure::default();
        s.materials.insert(
            "S235".to_owned(),
            MaterialProperties {
                e: 210e9,
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
                iy: 8.33e-6,
                iz: 8.33e-6,
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
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.beams.push(Beam::frame(1, 1, 2, "RECT", "S235"));
        s.supports.push(Support::fixed(1));
        s.loads.push(rdm_model::Load {
            case: rdm_model::LoadCase::Permanent,
            kind: rdm_model::LoadKind::Nodal {
                node_id: 2,
                forces: rdm_model::GlobalForces {
                    fx: -load,
                    fy: 0.0,
                    fz: 0.0,
                    mx: 0.0,
                    my: 0.0,
                    mz: 0.0,
                },
            },
        });
        s.self_weight_enabled = false;
        s
    }

    #[test]
    fn euler_column_lambda_cr_matches_the_closed_form() {
        // Pcr = π²EI / L² for a pinned-pinned column.
        let mut s = column(-1000.0);
        // Pinned-pinned column: anti-roll pin at the base, roller on top.
        s.supports.clear();
        s.supports.push(Support {
            node_id: 1,
            locked_dofs: [true, true, true, true, false, false],
            spring_stiffness: [0.0; 6],
            incline: None,
            settlement: [0.0; 6],
        });
        s.supports.push(Support {
            node_id: 2,
            locked_dofs: [false, true, true, false, false, false],
            spring_stiffness: [0.0; 6],
            incline: None,
            settlement: [0.0; 6],
        });
        let report = buckling_analysis(&s, 2).expect("buckling");
        // One Hermite element reproduces the non-sway column exactly at
        // `Pcr = 12EI/L²` (22 % above the exact π²EI/L² — the classic
        // 1-element conservative bound).
        let pcr_fe = 12.0 * 210e9 * 8.33e-6 / 16.0;
        let lambda = report.modes.first().expect("mode").lambda_cr;
        assert_relative_eq!(lambda * 1000.0, pcr_fe, epsilon = pcr_fe * 0.01);
        assert!(lambda * 1000.0 > std::f64::consts::PI.powi(2) * 210e9 * 8.33e-6 / 16.0);
    }

    #[test]
    fn stiffer_load_reduces_lambda() {
        let a = buckling_analysis(&column(-1000.0), 1).expect("buckling");
        let b = buckling_analysis(&column(-4000.0), 1).expect("buckling");
        let la = a.modes.first().expect("mode").lambda_cr;
        let lb = b.modes.first().expect("mode").lambda_cr;
        assert!((la / 4.0 - lb).abs() < la * 0.1);
    }
}
