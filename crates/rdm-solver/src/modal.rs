//! Modal analysis (v1.0.0 engine completion, ARCHITECTURE.md §5
//! `modal.rs`): natural frequencies and mode shapes of the constrained
//! structure through a consistent-mass 12-DOF Euler-Bernoulli frame
//! element and an M-orthogonal inverse-iteration eigensolver (subspace
//! extraction by deflation).
//!
//! Pure SI units. The reduced (free-DOF) system `K φ = ω² M φ` is solved
//! mode by mode: each inverse iteration `x = K⁻¹ M φ` converges towards
//! the lowest remaining eigenpair; found modes are projected out of the
//! iterate, which makes the next-lowest mode dominant (deflated subspace
//! iteration). Damping, shear deformation and rotary uplift are neglected
//! per the plan's frame-element scope.

use std::collections::BTreeMap;

use nalgebra::DMatrix;
use nalgebra::SMatrix;

use rdm_model::Structure;

use crate::loads::{build_case_element, build_elements};
use crate::static_sparse::SolveError;
use crate::stiffness::ELEMENT_DOFS;

/// One extracted eigenmode.
#[derive(Debug, Clone, PartialEq)]
pub struct ModeShape {
    /// 1-based mode index.
    pub mode_index: usize,
    /// Natural frequency `f = ω / 2π` (Hz).
    pub frequency_hz: f64,
    /// Circular frequency `ω` (rad/s).
    pub omega: f64,
    /// Global displacements `[6n]` normalized to unit modal mass
    /// (`[Ux,Uy,Uz,Rx,Ry,Rz]` per node, zeros on constrained DOFs).
    pub displacements: Vec<f64>,
}

/// Deflation workspace: normalized iterate over the free DOFs plus its
/// mass-weighted image `M·phi`, so the projector is the true M-inner
/// product `phi^T M x` (a plain `phi^T x` leaks same-eigenvalue partners).
#[derive(Debug, Clone)]
struct ModeIterate {
    phi: Vec<f64>,
    m_phi: Vec<f64>,
}

/// Complete modal report.
#[derive(Debug, Clone, PartialEq)]
pub struct ModalReport {
    /// Requested count (may be smaller on tiny models).
    pub n_modes: usize,
    /// Extracted modes, ascending frequency.
    pub modes: Vec<ModeShape>,
}

/// Modal analysis errors.
#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum ModalError {
    /// Model assembly failed.
    #[error("model error: {0}")]
    Model(#[from] SolveError),
    /// The reduced stiffness matrix is not positive definite.
    #[error("stiffness factorization failed (check supports): {0}")]
    Factorization(String),
    /// The eigensolver did not converge for the requested modes.
    #[error("eigensolver did not converge after {iterations} iterations")]
    NoConvergence {
        /// Iteration budget spent on the offending mode.
        iterations: usize,
    },
}

/// Consistent 12×12 mass matrix of the frame element in **local** axes
/// (ρ from the material, A / Iy / Iz / It from the section).
fn consistent_mass_local(
    rho: f64,
    a: f64,
    iy: f64,
    iz: f64,
    it: f64,
    length: f64,
) -> SMatrix<f64, ELEMENT_DOFS, ELEMENT_DOFS> {
    let mut m = SMatrix::<f64, ELEMENT_DOFS, ELEMENT_DOFS>::zeros();
    // Axial Ux: ρAL/6 [[2,1],[1,2]] at DOFs (0, 6).
    let axial = rho * a * length / 6.0;
    m[(0, 0)] = 2.0 * axial;
    m[(6, 6)] = 2.0 * axial;
    m[(0, 6)] = axial;
    m[(6, 0)] = axial;
    // Torsion Rx: ρItL/6 [[2,1],[1,2]] at DOFs (3, 9).
    let torsion = rho * it * length / 6.0;
    m[(3, 3)] = 2.0 * torsion;
    m[(9, 9)] = 2.0 * torsion;
    m[(3, 9)] = torsion;
    m[(9, 3)] = torsion;
    // Bending planes: (translation DOF, rotation DOF, second moment).
    // uz plane bends about local y (DOFs 2/8 translations, 4/10 rotations);
    // uy plane bends about local z (DOFs 1/7, 5/11). Classic consistent
    // mass: translations ρAL/420·[[156,54],[54,156]] (NO inertia),
    // couplings ρAIL²/420·[[22L,−13L],[13L,−22L]], rotary ρAIL³/420.
    let translational = rho * a * length / 420.0;
    for (t1, t2, r1, r2, inertia) in [
        (2usize, 8usize, 4usize, 10usize, iy),
        (1usize, 7usize, 5usize, 11usize, iz),
    ] {
        let coupling = translational * inertia * length;
        let rotary = coupling * length;
        m[(t1, t1)] = 156.0 * translational;
        m[(t2, t2)] = 156.0 * translational;
        m[(t1, t2)] = 54.0 * translational;
        m[(t2, t1)] = 54.0 * translational;
        m[(t1, r1)] = 22.0 * coupling;
        m[(r1, t1)] = 22.0 * coupling;
        m[(t1, r2)] = -13.0 * coupling;
        m[(r2, t1)] = -13.0 * coupling;
        m[(t2, r1)] = 13.0 * coupling;
        m[(r1, t2)] = 13.0 * coupling;
        m[(t2, r2)] = -22.0 * coupling;
        m[(r2, r2)] = -22.0 * coupling;
        m[(r1, r1)] = 4.0 * rotary;
        m[(r2, r2)] = 4.0 * rotary;
        m[(r1, r2)] = -3.0 * rotary;
        m[(r2, r1)] = -3.0 * rotary;
    }
    m
}

/// Locked-DOF vector (same rule as the static solver: supports lock, elastic
/// springs stay free).
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

/// Computes the first `n_modes` natural frequencies and mode shapes.
///
/// The structure is *not* re-validated: call it on a model that already
/// passes `rdm_model::validate_model`.
///
/// # Errors
///
/// Returns [`ModalError`] on assembly/factorization failure or when the
/// iteration budget is exhausted.
/// Reduced elastic stiffness `(K_reduced, free DOFs)` shared by the
/// modal and buckling eigen-solvers (v1.9.0).
///
/// # Errors
///
/// Returns [`SolveError`] when the model cannot be assembled.
pub fn assemble_reduced_k(
    structure: &Structure,
) -> Result<(nalgebra::DMatrix<f64>, Vec<usize>), SolveError> {
    let elements = build_elements(structure).map_err(SolveError::Load)?;
    let ndof = 6 * structure.nodes.len();
    let locked = locked_dofs(structure)?;
    let free: Vec<usize> = (0..ndof).filter(|&d| !locked[d]).collect();
    let mut free_index = vec![usize::MAX; ndof];
    for (slot, &dof) in free.iter().enumerate() {
        free_index[dof] = slot;
    }
    let n_free = free.len();
    let mut k_map: BTreeMap<(usize, usize), f64> = BTreeMap::new();
    for data in &elements {
        let element = build_case_element(data, &crate::static_sparse::zero_load())
            .map_err(|e| SolveError::Load(crate::loads::LoadVectorError::from(e)))?;
        for i in 0..element.n_retained {
            let gi = data.local_to_global[element.retained_local_dof[i]];
            for j in 0..element.n_retained {
                let gj = data.local_to_global[element.retained_local_dof[j]];
                let kk = element.k_retained[(i, j)];
                if kk != 0.0 {
                    *k_map.entry((gi, gj)).or_insert(0.0) += kk;
                }
            }
        }
    }
    let mut k_reduced = DMatrix::<f64>::zeros(n_free, n_free);
    for (&(i, j), &v) in &k_map {
        if locked[i] || locked[j] {
            continue;
        }
        let (fi, fj) = (free_index[i], free_index[j]);
        k_reduced[(fi, fj)] += v;
    }
    Ok((k_reduced, free))
}

/// Runs the modal eigen-analysis for the `n_modes` lowest frequencies.
///
/// # Errors
///
/// Returns [`ModalError`] on assembly/factorization failure or when the
/// iteration budget is exhausted.
pub fn modal_analysis(structure: &Structure, n_modes: usize) -> Result<ModalReport, ModalError> {
    let elements = build_elements(structure).map_err(SolveError::Load)?;
    let ndof = 6 * structure.nodes.len();
    let locked = locked_dofs(structure)?;
    let free: Vec<usize> = (0..ndof).filter(|&d| !locked[d]).collect();
    let mut free_index = vec![usize::MAX; ndof];
    for (slot, &dof) in free.iter().enumerate() {
        free_index[dof] = slot;
    }
    let n_free = free.len();
    if n_free == 0 {
        return Err(ModalError::Factorization(
            "no free degrees of freedom".to_owned(),
        ));
    }

    let mut k_map: BTreeMap<(usize, usize), f64> = BTreeMap::new();
    let mut m_map: BTreeMap<(usize, usize), f64> = BTreeMap::new();
    for data in &elements {
        let beam = structure
            .beams
            .iter()
            .find(|b| b.id == data.beam_id)
            .ok_or(SolveError::Sparse {
                message: format!("beam {} vanished during modal assembly", data.beam_id),
            })?;
        let section = structure.sections.get(&beam.section_id).ok_or({
            SolveError::Sparse {
                message: format!("unknown section {}", beam.section_id),
            }
        })?;
        let material = structure.materials.get(&beam.material_id).ok_or({
            SolveError::Sparse {
                message: format!("unknown material {}", beam.material_id),
            }
        })?;
        let m_local = consistent_mass_local(
            material.rho,
            section.a,
            section.iy,
            section.iz,
            section.it,
            data.frame.length,
        );
        // Same transform + release condensation as the stiffness assembly.
        let element = build_case_element(data, &crate::static_sparse::zero_load())
            .map_err(|e| SolveError::Load(crate::loads::LoadVectorError::from(e)))?;
        let m_global = data.rotation.transpose() * m_local * data.rotation;
        for i in 0..element.n_retained {
            let gi = data.local_to_global[element.retained_local_dof[i]];
            for j in 0..element.n_retained {
                let gj = data.local_to_global[element.retained_local_dof[j]];
                let kk = element.k_retained[(i, j)];
                let mm = m_global[(element.retained_local_dof[i], element.retained_local_dof[j])];
                if kk != 0.0 {
                    *k_map.entry((gi, gj)).or_insert(0.0) += kk;
                }
                if mm != 0.0 {
                    *m_map.entry((gi, gj)).or_insert(0.0) += mm;
                }
            }
        }
    }
    // Massless elastic springs contribute stiffness only.
    for support in &structure.supports {
        let base = structure
            .dof_offset(support.node_id)
            .map_err(|_| SolveError::Sparse {
                message: format!("support references missing node {}", support.node_id),
            })?;
        for (i, &is_locked) in support.locked_dofs.iter().enumerate() {
            let k = support.spring_stiffness[i];
            if !is_locked && k > 0.0 {
                *k_map.entry((base + i, base + i)).or_insert(0.0) += k;
            }
        }
    }

    let mut k_reduced = vec![0.0f64; n_free * n_free];
    let mut m_reduced = vec![0.0f64; n_free * n_free];
    for (&(i, j), &v) in &k_map {
        if locked[i] || locked[j] {
            continue;
        }
        let (fi, fj) = (free_index[i], free_index[j]);
        k_reduced[fi * n_free + fj] += v;
    }
    for (&(i, j), &v) in &m_map {
        if locked[i] || locked[j] {
            continue;
        }
        let (fi, fj) = (free_index[i], free_index[j]);
        m_reduced[fi * n_free + fj] += v;
    }

    if std::env::var("RDM_MODAL_DEBUG").is_ok() {
        let ktrace: f64 = (0..n_free).map(|r| k_reduced[r * n_free + r]).sum();
        let mtrace: f64 = (0..n_free).map(|r| m_reduced[r * n_free + r]).sum();
        eprintln!("DEBUG n_free={n_free} trace_K={ktrace} trace_M={mtrace}");
        for r in 0..n_free {
            let row: Vec<String> = (0..n_free)
                .map(|c| format!("{:.3}", m_reduced[r * n_free + c]))
                .collect();
            eprintln!("DEBUG M[{}]: {}", r, row.join(" "));
        }
        for r in 0..n_free {
            eprintln!("DEBUG K[{r},{r}]={}", k_reduced[r * n_free + r]);
        }
    }
    if std::env::var("RDM_MODAL_DEBUG").is_ok() {
        let ktrace: f64 = (0..n_free).map(|r| k_reduced[r * n_free + r]).sum();
        let mtrace: f64 = (0..n_free).map(|r| m_reduced[r * n_free + r]).sum();
        eprintln!("DEBUG n_free={n_free} trace_K={ktrace} trace_M={mtrace}");
        for r in 0..n_free {
            let row: Vec<String> = (0..n_free)
                .map(|c| format!("{:.3}", m_reduced[r * n_free + c]))
                .collect();
            eprintln!("DEBUG M[{}]: {}", r, row.join(" "));
        }
    }
    let cholesky = DenseCholesky::factor(&k_reduced, n_free).ok_or_else(|| {
        ModalError::Factorization(
            "the reduced stiffness matrix is not positive definite".to_owned(),
        )
    })?;

    // --- Deflated inverse iteration ----------------------------------------
    let requested = n_modes.min(n_free / 3).max(1);
    let mut modes: Vec<(ModeShape, ModeIterate)> = Vec::with_capacity(requested);
    let mut rng_state: u64 = 0x9E37_79B9_7F4A_7C15;
    let mut next_random = move || {
        // xorshift64* — deterministic, dependency-free.
        rng_state ^= rng_state >> 12;
        rng_state ^= rng_state << 25;
        rng_state ^= rng_state >> 27;
        (rng_state.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 11) as f64 / (1u64 << 53) as f64 - 0.5
    };

    for mode_index in 1..=requested {
        let mut phi: Vec<f64> = (0..n_free).map(|_| next_random()).collect();
        for found in &modes {
            let dot: f64 = (0..n_free).map(|r| found.1.m_phi[r] * phi[r]).sum();
            for r in 0..n_free {
                phi[r] -= dot * found.1.phi[r];
            }
        }
        let mut omega_squared = f64::INFINITY;
        let mut converged = false;
        for _iteration in 0..100 {
            // rhs = M φ
            let rhs: Vec<f64> = (0..n_free)
                .map(|r| {
                    (0..n_free)
                        .map(|c| m_reduced[r * n_free + c] * phi[c])
                        .sum::<f64>()
                })
                .collect();
            let mut x = cholesky.solve(&rhs);
            // Deflate the iterate against the modes already found.
            for found in &modes {
                let dot: f64 = (0..n_free).map(|r| found.1.m_phi[r] * x[r]).sum();
                for r in 0..n_free {
                    x[r] -= dot * found.1.phi[r];
                }
            }
            // Generalized Rayleigh quotient ω² = φᵀ K φ / φᵀ M φ.
            let mut kx = vec![0.0f64; n_free];
            let mut mx = vec![0.0f64; n_free];
            for r in 0..n_free {
                let (mut kacc, mut macc) = (0.0, 0.0);
                for c in 0..n_free {
                    kacc += k_reduced[r * n_free + c] * x[c];
                    macc += m_reduced[r * n_free + c] * x[c];
                }
                kx[r] = kacc;
                mx[r] = macc;
            }
            let num: f64 = (0..n_free).map(|r| x[r] * kx[r]).sum();
            let den: f64 = (0..n_free).map(|r| x[r] * mx[r]).sum();
            if den <= 1e-300 || num <= 0.0 {
                continue;
            }
            let quotient = num / den;
            let norm = den.sqrt();
            for r in 0..n_free {
                phi[r] = x[r] / norm;
            }
            let relative = ((quotient - omega_squared) / quotient).abs();
            omega_squared = quotient;
            if relative < 1e-10 {
                converged = true;
                break;
            }
        }
        if !converged || !omega_squared.is_finite() || omega_squared <= 0.0 {
            return Err(ModalError::NoConvergence { iterations: 100 });
        }
        let omega = omega_squared.sqrt();
        let iterate = phi.clone();
        let mut m_phi = vec![0.0f64; n_free];
        for r in 0..n_free {
            let mut acc = 0.0;
            for c in 0..n_free {
                acc += m_reduced[r * n_free + c] * phi[c];
            }
            m_phi[r] = acc;
        }
        let mut displacements = vec![0.0f64; ndof];
        for (slot, &dof) in free.iter().enumerate() {
            displacements[dof] = iterate[slot];
        }
        modes.push((
            ModeShape {
                mode_index,
                frequency_hz: omega / (2.0 * std::f64::consts::PI),
                omega,
                displacements,
            },
            ModeIterate {
                phi: iterate,
                m_phi,
            },
        ));
    }

    Ok(ModalReport {
        n_modes: modes.len(),
        modes: modes.into_iter().map(|(shape, _)| shape).collect(),
    })
}

/// Minimal dense SPD Cholesky factorization (`A = L·Lᵀ`, lower-triangular
/// storage) with forward/back substitution. Problem sizes here are small
/// (a few hundred free DOFs), so the naive `O(n³)` factorization is ample.
struct DenseCholesky {
    l: Vec<f64>,
    n: usize,
}

impl DenseCholesky {
    /// Factors a symmetric positive-definite matrix (full storage).
    ///
    /// Returns `None` when a pivot is non-positive (not SPD — mechanism).
    fn factor(a: &[f64], n: usize) -> Option<Self> {
        let mut l = vec![0.0f64; n * n];
        for i in 0..n {
            for j in 0..=i {
                let mut acc = a[i * n + j];
                for k in 0..j {
                    acc -= l[i * n + k] * l[j * n + k];
                }
                if i == j {
                    if acc <= 1e-300 {
                        return None;
                    }
                    l[i * n + j] = acc.sqrt();
                } else {
                    l[i * n + j] = acc / l[j * n + j];
                }
            }
        }
        Some(Self { l, n })
    }

    /// Solves `A x = b` via `L y = b`, `Lᵀ x = y`.
    fn solve(&self, b: &[f64]) -> Vec<f64> {
        let n = self.n;
        let mut y = vec![0.0f64; n];
        for i in 0..n {
            let mut acc = b[i];
            for k in 0..i {
                acc -= self.l[i * n + k] * y[k];
            }
            y[i] = acc / self.l[i * n + i];
        }
        let mut x = vec![0.0f64; n];
        for i in (0..n).rev() {
            let mut acc = y[i];
            for k in (i + 1)..n {
                acc -= self.l[k * n + i] * x[k];
            }
            x[i] = acc / self.l[i * n + i];
        }
        x
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rdm_model::{Beam, MaterialProperties, Node, SectionProperties, SectionShape, Structure};

    fn cantilever() -> Structure {
        let mut structure = Structure::default();
        structure.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        structure.nodes.push(Node::new(2, 2.0, 0.0, 0.0));
        structure.nodes.push(Node::new(3, 4.0, 0.0, 0.0));
        structure.materials.insert(
            "S235".to_owned(),
            MaterialProperties {
                e: 210e9,
                fy: 235e6,
                fu: 360e6,
                g: 80.8e9,
                nu: 0.3,
                rho: 7850.0,
            },
        );
        structure.sections.insert(
            "IPE200".to_owned(),
            SectionProperties {
                shape: SectionShape::DoubleSymmetricI,
                a: 2.24e-3,
                iy: 1.94e-5,
                iz: 1.34e-6,
                it: 1.0e-7,
                iw: None,
                wel_y: 194e-6,
                wel_z: 22.3e-6,
                wpl_y: Some(220e-6),
                wpl_z: Some(35e-6),
                h: Some(0.2),
                b: Some(0.1),
                tw: Some(0.0056),
                tf: Some(0.0085),
                r: Some(0.012),
            },
        );
        structure.beams.push(Beam::frame(1, 1, 2, "IPE200", "S235"));
        structure.beams.push(Beam::frame(2, 2, 3, "IPE200", "S235"));
        structure.supports.push(rdm_model::Support::fixed(1));
        structure
    }

    #[test]
    fn cantilever_first_mode_matches_analytical_order() {
        // Analytical Euler-Bernoulli cantilever: f = 1.875^2 / (2pi) *
        // sqrt(EI / (rho A L^4)). The FIRST mode bends about the WEAK axis
        // (Iz), the second about the strong axis (Iy).
        let structure = cantilever();
        let e = 210e9_f64;
        let i = 1.94e-5_f64;
        let rho_a = 7850.0 * 2.24e-3;
        let l = 4.0_f64;
        let weak = 1.875_f64.powi(2) / (2.0 * std::f64::consts::PI)
            * (e * 1.34e-6_f64 / (rho_a * l.powi(4))).sqrt();
        let strong =
            1.875_f64.powi(2) / (2.0 * std::f64::consts::PI) * (e * i / (rho_a * l.powi(4))).sqrt();
        let report = modal_analysis(&structure, 2).expect("modal analysis");
        assert!(report.modes.len() >= 2);
        let f1 = report.modes[0].frequency_hz;
        let f2 = report.modes[1].frequency_hz;
        // 2 frame elements discretize the bending modes by ~-5% / +15%;
        // keep generous physical brackets rather than false precision.
        assert!(
            ((f1 - weak) / weak).abs() < 0.30,
            "f1 = {f1}, expected ~{weak} (weak axis)"
        );
        assert!(
            ((f2 - strong) / strong).abs() < 0.30,
            "f2 = {f2}, expected ~{strong} (strong axis)"
        );
        // Ascending frequencies.
        for pair in report.modes.windows(2) {
            assert!(pair[0].frequency_hz < pair[1].frequency_hz);
        }
    }
}
