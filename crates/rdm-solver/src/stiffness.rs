//! 12×12 Euler-Bernoulli frame element: local stiffness, 3D rotation with
//! roll angle, end-release condensation and consistent load vectors.
//!
//! Local axes: `x` along `n1 -> n2`; `y`/`z` are built from the global `Z`
//! reference (or `X` for vertical members) then rotated by the beam roll
//! angle `theta_x`. DOF order in every 12-vector is
//! `[ux, uy, uz, rx, ry, rz]` per node.

use glam::DVec3;
use nalgebra::SMatrix;

/// Number of DOFs of one frame element.
pub const ELEMENT_DOFS: usize = 12;

/// Standard gravity used for automatic self-weight (BIPM, `m/s²`).
pub const STANDARD_GRAVITY: f64 = 9.80665;

/// Orthonormal local frame of a beam.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LocalFrame {
    /// Unit vector along the beam axis (`n1 -> n2`).
    pub ex: DVec3,
    /// Unit local `y` axis (after roll angle).
    pub ey: DVec3,
    /// Unit local `z` axis (after roll angle).
    pub ez: DVec3,
    /// Member length (m).
    pub length: f64,
}

/// Frame construction errors.
#[derive(Debug, Clone, Copy, PartialEq, thiserror::Error)]
pub enum FrameError {
    /// Beam length is zero or numerically degenerate.
    #[error("degenerate beam geometry: zero length or collinear reference")]
    DegenerateGeometry,
}

/// Builds the local frame of a beam from node coordinates.
///
/// The reference vector is global `+Z`; for vertical members (axis parallel
/// to `Z`) global `+X` is used instead, matching common CAD behaviour.
///
/// # Errors
///
/// Returns [`FrameError::DegenerateGeometry`] when both nodes coincide.
pub fn beam_local_frame(
    p1: DVec3,
    p2: DVec3,
    roll_angle_rad: f64,
) -> Result<LocalFrame, FrameError> {
    let axis = p2 - p1;
    let length = axis.length();
    if !(length > 1e-12) {
        return Err(FrameError::DegenerateGeometry);
    }
    let ex = axis / length;
    let reference = if ex.z.abs() > 0.999_999 {
        DVec3::X
    } else {
        DVec3::Z
    };
    // Gram-Schmidt: ez = projected reference (global Z for horizontal
    // beams), ey = ez x ex so that (ex, ey, ez) stays right-handed.
    let ez0 = (reference - ex * reference.dot(ex)).normalize_or_zero();
    if ez0.length_squared() < 1e-12 {
        return Err(FrameError::DegenerateGeometry);
    }
    let ey0 = ez0.cross(ex);
    // Roll rotation about local x by theta_x.
    let (sin, cos) = roll_angle_rad.sin_cos();
    let ey = ey0 * cos + ez0 * sin;
    let ez = ez0 * cos - ey0 * sin;
    Ok(LocalFrame {
        ex,
        ey: ey.normalize_or_zero(),
        ez: ez.normalize_or_zero(),
        length,
    })
}

/// 12×12 direction-cosine matrix mapping local vectors to global ones:
/// `f_global = T^T f_local`, `u_local = T u_global`.
pub fn rotation_matrix(frame: &LocalFrame) -> SMatrix<f64, ELEMENT_DOFS, ELEMENT_DOFS> {
    let mut t = SMatrix::<f64, ELEMENT_DOFS, ELEMENT_DOFS>::zeros();
    let r_rows = [
        [frame.ex.x, frame.ex.y, frame.ex.z],
        [frame.ey.x, frame.ey.y, frame.ey.z],
        [frame.ez.x, frame.ez.y, frame.ez.z],
    ];
    // The same 3x3 direction-cosine block acts on translations AND
    // rotations: four blocks at DOFs 0-2, 3-5, 6-8, 9-11.
    for block in 0..4 {
        for (i, row) in r_rows.iter().enumerate() {
            for (j, &value) in row.iter().enumerate() {
                t[(3 * block + i, 3 * block + j)] = value;
            }
        }
    }
    t
}

/// Local 12×12 stiffness of a prismatic Euler-Bernoulli frame element.
///
/// `ea`: axial stiffness `E·A` (N), `gj`: `G·It` (N·m²), `eiy`/`eiz`:
/// bending stiffnesses `E·I` about local y / z (N·m²), `l`: length (m).
pub fn local_stiffness_matrix(
    ea: f64,
    gj: f64,
    eiy: f64,
    eiz: f64,
    l: f64,
) -> SMatrix<f64, ELEMENT_DOFS, ELEMENT_DOFS> {
    let mut k = SMatrix::<f64, ELEMENT_DOFS, ELEMENT_DOFS>::zeros();
    // Axial: DOFs 0 (ux1) and 6 (ux2).
    let ax = ea / l;
    k[(0, 0)] = ax;
    k[(0, 6)] = -ax;
    k[(6, 0)] = -ax;
    k[(6, 6)] = ax;
    // Torsion: DOFs 3 (rx1) and 9 (rx2).
    let tr = gj / l;
    k[(3, 3)] = tr;
    k[(3, 9)] = -tr;
    k[(9, 3)] = -tr;
    k[(9, 9)] = tr;
    // Bending in the x-y plane (deflection uy, rotation rz) with EIz.
    let kz = eiz / (l * l * l);
    let c = [
        [12.0, 6.0 * l, -12.0, 6.0 * l],
        [6.0 * l, 4.0 * l * l, -6.0 * l, 2.0 * l * l],
        [-12.0, -6.0 * l, 12.0, -6.0 * l],
        [6.0 * l, 2.0 * l * l, -6.0 * l, 4.0 * l * l],
    ];
    // Local DOFs: uy1=1, rz1=5, uy2=7, rz2=11.
    let idx = [1usize, 5, 7, 11];
    for (i, &ii) in idx.iter().enumerate() {
        for (j, &jj) in idx.iter().enumerate() {
            k[(ii, jj)] += kz * c[i][j];
        }
    }
    // Bending in the x-z plane (deflection uz, rotation ry) with EIy; the
    // coupling signs flip because ry points opposite to the y-plane normal.
    let ky = eiy / (l * l * l);
    let c2 = [
        [12.0, -6.0 * l, -12.0, -6.0 * l],
        [-6.0 * l, 4.0 * l * l, 6.0 * l, 2.0 * l * l],
        [-12.0, 6.0 * l, 12.0, 6.0 * l],
        [-6.0 * l, 2.0 * l * l, 6.0 * l, 4.0 * l * l],
    ];
    // Local DOFs: uz1=2, ry1=4, uz2=8, ry2=10.
    let idx2 = [2usize, 4, 8, 10];
    for (i, &ii) in idx2.iter().enumerate() {
        for (j, &jj) in idx2.iter().enumerate() {
            k[(ii, jj)] += ky * c2[i][j];
        }
    }
    k
}

/// Frame element with end releases condensed out (zero force on released
/// DOFs), ready for global assembly.
#[derive(Debug, Clone)]
pub struct Element {
    /// Condensed stiffness acting on the retained local DOFs.
    pub k_retained: SMatrix<f64, ELEMENT_DOFS, ELEMENT_DOFS>,
    /// Condensed consistent load vector on the retained DOFs.
    pub f_retained: SMatrix<f64, ELEMENT_DOFS, 1>,
    /// Global DOF index of each retained slot (active first).
    pub retained_global: [usize; ELEMENT_DOFS],
    /// Local DOF index held by each retained slot (active first).
    pub retained_local_dof: [usize; ELEMENT_DOFS],
    /// Number of retained DOFs (12 minus released).
    pub n_retained: usize,
}

/// Element construction errors.
#[derive(Debug, Clone, Copy, PartialEq, thiserror::Error)]
pub enum ElementError {
    /// Releasing the same component at both ends creates a local mechanism.
    #[error(
        "member mechanism: component {component} is released at both ends or has a singular pivot"
    )]
    MemberMechanism {
        /// Local DOF index (0..12) of the offending component.
        component: usize,
    },
}

impl Element {
    /// Builds the element from its local stiffness, consistent local load
    /// vector and release flags (`[start 6 | end 6]`, `true` = released).
    ///
    /// `local_to_global` maps a local DOF index to its global DOF index.
    ///
    /// # Errors
    ///
    /// Returns [`ElementError::MemberMechanism`] when both ends of the same
    /// component are released (a local mechanism) or a released pivot is
    /// singular.
    pub fn build(
        k: SMatrix<f64, ELEMENT_DOFS, ELEMENT_DOFS>,
        f: SMatrix<f64, ELEMENT_DOFS, 1>,
        released: &[bool; ELEMENT_DOFS],
        local_to_global: &[usize; ELEMENT_DOFS],
    ) -> Result<Self, ElementError> {
        // Everything lives in "slot" space: slot i currently holds local DOF
        // order[i]; k and f are permuted alongside every swap.
        let mut k = k;
        let mut f = f;
        let mut order: [usize; ELEMENT_DOFS] = core::array::from_fn(|i| i);
        let mut released_mask = *released;
        let mut active = ELEMENT_DOFS;

        let swap_slot = |m: &mut SMatrix<f64, ELEMENT_DOFS, ELEMENT_DOFS>,
                         v: &mut SMatrix<f64, ELEMENT_DOFS, 1>,
                         a: usize,
                         b: usize| {
            for col in 0..ELEMENT_DOFS {
                m.swap((a, col), (b, col));
            }
            for row in 0..ELEMENT_DOFS {
                m.swap((row, a), (row, b));
            }
            v.swap((a, 0), (b, 0));
        };

        // Sequentially condense one released DOF at a time (Schur complement
        // with f_c = 0 on the released component).
        while let Some(pos) = (0..active).find(|&p| released_mask[order[p]]) {
            order.swap(pos, active - 1);
            swap_slot(&mut k, &mut f, pos, active - 1);
            let c = active - 1;
            let pivot = k[(c, c)];
            if pivot.abs() < 1e-14 {
                // Fully detached released DOF (e.g. the second end of a
                // plane whose stiffness was already condensed away): it
                // carries no force and contributes nothing - drop it.
                for i in 0..c {
                    k[(c, i)] = 0.0;
                    k[(i, c)] = 0.0;
                }
                f[c] = 0.0;
                released_mask[order[c]] = false;
                active -= 1;
                continue;
            }
            for i in 0..c {
                let kic = k[(i, c)] / pivot;
                for j in 0..c {
                    k[(i, j)] -= kic * k[(c, j)];
                }
                f[i] -= kic * f[c];
            }
            for i in 0..c {
                k[(c, i)] = 0.0;
                k[(i, c)] = 0.0;
            }
            f[c] = 0.0;
            released_mask[order[c]] = false;
            active -= 1;
        }

        let mut retained_global = [0usize; ELEMENT_DOFS];
        let mut retained_local_dof = [0usize; ELEMENT_DOFS];
        let mut k_retained = SMatrix::zeros();
        let mut f_retained = SMatrix::zeros();
        for i in 0..active {
            retained_global[i] = local_to_global[order[i]];
            retained_local_dof[i] = order[i];
            f_retained[(i, 0)] = f[(i, 0)];
            for j in 0..active {
                k_retained[(i, j)] = k[(i, j)];
            }
        }
        Ok(Self {
            k_retained,
            f_retained,
            retained_global,
            retained_local_dof,
            n_retained: active,
        })
    }

    /// Local end forces `[12]` in local-DOF order, given the solved local
    /// displacements (`u_local` also in local-DOF order, full 12 entries).
    /// Released components are zero by construction (free end).
    pub fn end_forces(
        &self,
        u_local: &SMatrix<f64, ELEMENT_DOFS, 1>,
    ) -> SMatrix<f64, ELEMENT_DOFS, 1> {
        let mut out = SMatrix::zeros();
        for i in 0..self.n_retained {
            let local_i = self.retained_local_dof[i];
            let mut value = -self.f_retained[(i, 0)];
            for j in 0..self.n_retained {
                value += self.k_retained[(i, j)] * u_local[(self.retained_local_dof[j], 0)];
            }
            out[(local_i, 0)] = value;
        }
        out
    }
}

/// Consistent local load vector of a trapezoidal distributed load.
///
/// `q1`/`q2` are intensities (N/m) at `n1`/`n2` along ONE local axis
/// (`axis = 0` axial, `1` local y, `2` local z); returns the 12-vector
/// contribution.
pub fn trapezoid_local_vector(
    q1: f64,
    q2: f64,
    axis: usize,
    l: f64,
) -> SMatrix<f64, ELEMENT_DOFS, 1> {
    let mut v = SMatrix::<f64, ELEMENT_DOFS, 1>::zeros();
    let base = axis; // ux1=0, uy1=1, uz1=2 share the low offsets
    match axis {
        0 => {
            // Axial: linear shape functions N = [1-xi, xi].
            v[(0, 0)] = l * (2.0 * q1 + q2) / 6.0;
            v[(6, 0)] = l * (q1 + 2.0 * q2) / 6.0;
        }
        1 => {
            // Bending in x-y plane: fy1, rz1, fy2, rz2.
            v[(base, 0)] = l * (7.0 * q1 + 3.0 * q2) / 20.0;
            v[(base + 4, 0)] = l * l * (3.0 * q1 + 2.0 * q2) / 60.0;
            v[(base + 6, 0)] = l * (3.0 * q1 + 7.0 * q2) / 20.0;
            v[(base + 10, 0)] = -l * l * (2.0 * q1 + 3.0 * q2) / 60.0;
        }
        _ => {
            // Bending in x-z plane: fz1, ry1, fz2, ry2 (moment signs flip).
            v[(base, 0)] = l * (7.0 * q1 + 3.0 * q2) / 20.0;
            v[(base + 2, 0)] = -l * l * (3.0 * q1 + 2.0 * q2) / 60.0;
            v[(base + 6, 0)] = l * (3.0 * q1 + 7.0 * q2) / 20.0;
            v[(base + 8, 0)] = l * l * (2.0 * q1 + 3.0 * q2) / 60.0;
        }
    }
    v
}

/// Consistent local load vector of a concentrated action applied at
/// `position_ratio` along the span (Hermite shape functions).
///
/// `local` holds the 6 force components `[fx, fy, fz, mx, my, mz]` at the
/// application point, in local axes.
pub fn point_local_vector(
    local: &[f64; 6],
    position_ratio: f64,
    l: f64,
) -> SMatrix<f64, ELEMENT_DOFS, 1> {
    let mut v = SMatrix::<f64, ELEMENT_DOFS, 1>::zeros();
    let a = position_ratio.clamp(0.0, 1.0);
    let li = 1.0 - a;
    // Axial + torsion: linear distribution.
    v[(0, 0)] = local[0] * li;
    v[(6, 0)] = local[0] * a;
    v[(3, 0)] = local[3] * li;
    v[(9, 0)] = local[3] * a;
    // Transverse + bending: Hermite polynomials.
    let n1 = 1.0 - 3.0 * a * a + 2.0 * a * a * a;
    let n2 = l * (a - 2.0 * a * a + a * a * a);
    let n3 = 3.0 * a * a - 2.0 * a * a * a;
    let n4 = l * (-a * a + a * a * a);
    v[(1, 0)] = local[1] * n1;
    v[(5, 0)] = local[1] * n2;
    v[(7, 0)] = local[1] * n3;
    v[(11, 0)] = local[1] * n4;
    v[(2, 0)] = local[2] * n1;
    v[(8, 0)] = local[2] * n3;
    // x-z plane: ry is the right-handed rotation about +y (slope = -ry),
    // so its Hermite shape functions carry the opposite sign.
    v[(4, 0)] = -local[2] * n2;
    v[(10, 0)] = -local[2] * n4;
    // Point moments applied on the span: linear transfer (free vectors).
    v[(4, 0)] += local[4] * li;
    v[(10, 0)] += local[4] * a;
    v[(5, 0)] += local[5] * li;
    v[(11, 0)] += local[5] * a;
    v
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::{assert_abs_diff_eq, assert_relative_eq};

    fn steel_props() -> (f64, f64, f64, f64) {
        // E*A = 210e9 * 28.48e-4, G*It, E*Iy, E*Iz for IPE 200 / S235.
        (
            210e9 * 2.848e-3,
            81e9 * 6.846e-8,
            210e9 * 1.943e-5,
            210e9 * 1.424e-6,
        )
    }

    #[test]
    fn stiffness_matrix_is_symmetric() {
        let (ea, gj, eiy, eiz) = steel_props();
        let k = local_stiffness_matrix(ea, gj, eiy, eiz, 4.0);
        for i in 0..ELEMENT_DOFS {
            for j in 0..ELEMENT_DOFS {
                assert_relative_eq!(k[(i, j)], k[(j, i)], epsilon = 1e-12);
            }
        }
    }

    #[test]
    fn axial_block_matches_ea_over_l() {
        let (ea, gj, eiy, eiz) = steel_props();
        let k = local_stiffness_matrix(ea, gj, eiy, eiz, 4.0);
        assert_relative_eq!(k[(0, 0)], ea / 4.0, epsilon = 1e-9);
        assert_relative_eq!(k[(3, 3)], gj / 4.0, epsilon = 1e-9);
    }

    #[test]
    fn bending_uy1_block_matches_hand_formula() {
        let (ea, gj, eiy, eiz) = steel_props();
        let l = 4.0;
        let k = local_stiffness_matrix(ea, gj, eiy, eiz, l);
        let kz = eiz / (l * l * l);
        assert_relative_eq!(k[(1, 1)], 12.0 * kz, epsilon = 1e-9);
        assert_relative_eq!(k[(1, 5)], 6.0 * kz * l, epsilon = 1e-9);
        assert_relative_eq!(k[(5, 5)], 4.0 * kz * l * l, epsilon = 1e-9);
        // x-z plane block with EIy, sign-flipped coupling.
        let ky = eiy / (l * l * l);
        assert_relative_eq!(k[(2, 2)], 12.0 * ky, epsilon = 1e-9);
        assert_relative_eq!(k[(2, 4)], -6.0 * ky * l, epsilon = 1e-9);
    }

    #[test]
    fn unit_axial_load_vector_is_symmetric() {
        let v = trapezoid_local_vector(100.0, 100.0, 0, 3.0);
        assert_relative_eq!(v[(0, 0)], 150.0, epsilon = 1e-12);
        assert_relative_eq!(v[(6, 0)], 150.0, epsilon = 1e-12);
    }

    #[test]
    fn trapezoid_vector_matches_hand_values() {
        // Uniform q in local y: fy1 = fy2 = qL/2, mz1 = qL^2/12, mz2 = -qL^2/12.
        let v = trapezoid_local_vector(-1000.0, -1000.0, 1, 4.0);
        assert_relative_eq!(v[(1, 0)], -2000.0, epsilon = 1e-9);
        assert_relative_eq!(v[(5, 0)], -1000.0 * 16.0 / 12.0, epsilon = 1e-9);
        assert_relative_eq!(v[(11, 0)], 1000.0 * 16.0 / 12.0, epsilon = 1e-9);
        // Triangular q (0 at n1, q at n2): fy1 = 3qL/20, fy2 = 7qL/20.
        let v2 = trapezoid_local_vector(0.0, -1000.0, 1, 4.0);
        assert_relative_eq!(v2[(1, 0)], -3.0 * 1000.0 * 4.0 / 20.0, epsilon = 1e-9);
        assert_relative_eq!(v2[(7, 0)], -7.0 * 1000.0 * 4.0 / 20.0, epsilon = 1e-9);
    }

    #[test]
    fn point_vector_midspan_matches_hand_values() {
        let v = point_local_vector(&[-1e4, 0.0, 0.0, 0.0, 0.0, 0.0], 0.5, 4.0);
        assert_relative_eq!(v[(0, 0)], -5e3, epsilon = 1e-9);
        assert_relative_eq!(v[(6, 0)], -5e3, epsilon = 1e-9);
        let v2 = point_local_vector(&[0.0, -1e4, 0.0, 0.0, 0.0, 0.0], 0.5, 4.0);
        assert_relative_eq!(v2[(1, 0)], -5e3, epsilon = 1e-9);
        assert_relative_eq!(v2[(5, 0)], -1e4 * 4.0 * 0.125, epsilon = 1e-9);
    }

    #[test]
    fn rotation_matrix_has_four_blocks() {
        let f = beam_local_frame(DVec3::ZERO, DVec3::new(4.0, 0.0, 0.0), 0.0).unwrap();
        let t = rotation_matrix(&f);
        // Identity for an X-beam, on every 3x3 block (translations+rotations).
        for b in 0..4 {
            for i in 0..3 {
                for j in 0..3 {
                    let expected = if i == j { 1.0 } else { 0.0 };
                    assert_relative_eq!(t[(3 * b + i, 3 * b + j)], expected, epsilon = 1e-12);
                }
            }
        }
    }

    #[test]
    fn frame_of_horizontal_beam_is_z_up() {
        let f = beam_local_frame(DVec3::ZERO, DVec3::new(4.0, 0.0, 0.0), 0.0).unwrap();
        assert_relative_eq!(f.ex.x, 1.0, epsilon = 1e-12);
        assert_relative_eq!(f.ez.z, 1.0, epsilon = 1e-12);
    }

    #[test]
    fn vertical_beam_falls_back_to_x_reference() {
        let f = beam_local_frame(DVec3::ZERO, DVec3::new(0.0, 0.0, 3.0), 0.0).unwrap();
        assert_relative_eq!(f.ex.z, 1.0, epsilon = 1e-12);
        assert_relative_eq!(f.ez.x, 1.0, epsilon = 1e-12);
        assert_relative_eq!(f.ey.y, -1.0, epsilon = 1e-12);
    }

    #[test]
    fn roll_angle_rotates_local_axes() {
        let a = std::f64::consts::FRAC_PI_2;
        let f = beam_local_frame(DVec3::ZERO, DVec3::new(2.0, 0.0, 0.0), a).unwrap();
        // ey0 = Y (0,1,0), ez0 = Z (0,0,1): a quarter roll swaps them.
        assert_relative_eq!(f.ey.z, a.sin(), epsilon = 1e-12);
        assert_relative_eq!(f.ey.y, a.cos(), epsilon = 1e-12);
        assert_relative_eq!(f.ez.y, -a.sin(), epsilon = 1e-12);
    }

    #[test]
    fn zero_length_frame_is_rejected() {
        assert!(beam_local_frame(DVec3::ZERO, DVec3::ZERO, 0.0).is_err());
    }

    #[test]
    fn released_truss_element_carries_axial_only() {
        let (ea, gj, eiy, eiz) = steel_props();
        let k = local_stiffness_matrix(ea, gj, eiy, eiz, 4.0);
        let mut released = [false; ELEMENT_DOFS];
        for i in 1..6 {
            released[i] = true;
            released[i + 6] = true;
        }
        let l2g: [usize; ELEMENT_DOFS] = core::array::from_fn(|i| i);
        let el = Element::build(k, SMatrix::zeros(), &released, &l2g).unwrap();
        assert_eq!(el.n_retained, 2, "only ux1 and ux2 remain");
        // Apply axial relative displacement: 1 mm elongation (ux2 = 1 mm).
        let mut u = SMatrix::<f64, ELEMENT_DOFS, 1>::zeros();
        u[(6, 0)] = 0.001;
        let f = el.end_forces(&u);
        let n = ea / 4.0 * 0.001;
        let values: Vec<f64> = (0..el.n_retained)
            .map(|i| f[(el.retained_local_dof[i], 0)])
            .collect();
        assert!(
            values
                .iter()
                .any(|&v| (v - n).abs() < 1e-6 * n.abs() + 1e-9)
        );
        assert!(
            values
                .iter()
                .any(|&v| (v + n).abs() < 1e-6 * n.abs() + 1e-9)
        );
    }

    #[test]
    fn end_release_zeroes_moment_and_keeps_shear() {
        // Cantilever: moment release at the free (second) end.
        let (ea, gj, eiy, eiz) = steel_props();
        let k = local_stiffness_matrix(ea, gj, eiy, eiz, 4.0);
        let mut released = [false; ELEMENT_DOFS];
        released[11] = true; // rz2 released
        let l2g: [usize; ELEMENT_DOFS] = core::array::from_fn(|i| i);
        let el = Element::build(k, SMatrix::zeros(), &released, &l2g).unwrap();
        assert_eq!(el.n_retained, 11);
        // Impose uy2 = -1 mm with all other retained DOFs fixed.
        let mut u = SMatrix::<f64, ELEMENT_DOFS, 1>::zeros();
        u[(7, 0)] = -0.001; // local uy2
        let f = el.end_forces(&u);
        // mz2 (dof 11) is released: zero end moment.
        assert_abs_diff_eq!(f[(11, 0)], 0.0, epsilon = 1e-9);
        // Shear at node 1 (uy1, dof 1) must react upwards (positive).
        assert!(f[(1, 0)] > 0.0);
    }

    #[test]
    fn fully_released_element_keeps_nothing() {
        let (ea, gj, eiy, eiz) = steel_props();
        let k = local_stiffness_matrix(ea, gj, eiy, eiz, 4.0);
        let released = [true; ELEMENT_DOFS];
        let l2g: [usize; ELEMENT_DOFS] = core::array::from_fn(|i| i);
        let el = Element::build(k, SMatrix::zeros(), &released, &l2g).unwrap();
        assert_eq!(el.n_retained, 0, "every DOF detached");
    }
}
