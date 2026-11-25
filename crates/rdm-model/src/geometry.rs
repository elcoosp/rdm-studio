//! Geometry primitives: nodes in global coordinates and 12-DOF frame beams.
//!
//! The field set of [`Beam`] is the canonical contract of ARCHITECTURE.md
//! §19.4 (roll angle, end releases, buckling length factors).

use serde::{Deserialize, Serialize};

/// A node of the structure in global Cartesian coordinates.
///
/// Coordinates are metres; the model is strictly right-handed with `Z` up
/// (gravity acts along `-Z`).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Node {
    /// Unique node id.
    pub id: u32,
    /// Global X coordinate (m).
    pub x: f64,
    /// Global Y coordinate (m).
    pub y: f64,
    /// Global Z coordinate (m).
    pub z: f64,
}

impl Node {
    /// Creates a node at global position `(x, y, z)` (m).
    pub fn new(id: u32, x: f64, y: f64, z: f64) -> Self {
        Self { id, x, y, z }
    }
}

/// Shape family of a cross-section, used by the normative layer to pick the
/// correct EN 1993-1-1 rules (buckling curve, classification sheet).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SectionShape {
    /// Doubly-symmetric rolled I-profile (IPE / HEA / HEB / HEM).
    DoubleSymmetricI,
    /// Channel with parallel or tapered flanges (UPN / UPE).
    Channel,
    /// Circular hollow section (CHS).
    CircularHollow,
    /// Rectangular hollow section (SHS / RHS).
    RectangularHollow,
    /// Single angle (L).
    Angle,
    /// Any other shape handled with generic formulas.
    General,
}

/// Cross-section properties of a beam, all in strict SI units.
///
/// Fields that do not apply to a shape (e.g. `Iw` for hollow sections) are
/// `None`; the normative layer treats a `None` value as "check not
/// applicable" rather than inventing a number.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SectionProperties {
    /// Shape family.
    pub shape: SectionShape,
    /// Cross-sectional area `A` (m²).
    pub a: f64,
    /// Second moment of area about the strong axis `Iy` (m⁴).
    pub iy: f64,
    /// Second moment of area about the weak axis `Iz` (m⁴).
    pub iz: f64,
    /// St-Venant torsion constant `It` (m⁴).
    pub it: f64,
    /// Warping constant `Iw` (m⁶) when tabulated for the shape.
    pub iw: Option<f64>,
    /// Strong-axis elastic modulus `Wel,y` (m³).
    pub wel_y: f64,
    /// Weak-axis elastic modulus `Wel,z` (m³).
    pub wel_z: f64,
    /// Strong-axis plastic modulus `Wpl,y` (m³) when tabulated.
    pub wpl_y: Option<f64>,
    /// Weak-axis plastic modulus `Wpl,z` (m³) when tabulated.
    pub wpl_z: Option<f64>,
    /// Overall depth `h` (m) when applicable.
    pub h: Option<f64>,
    /// Flange width `b` (m) when applicable.
    pub b: Option<f64>,
    /// Web thickness `tw` (m) when applicable.
    pub tw: Option<f64>,
    /// Flange thickness `tf` (m) when applicable.
    pub tf: Option<f64>,
    /// Root radius `r` (m) when applicable.
    pub r: Option<f64>,
}

/// A 12-DOF Euler-Bernoulli frame element between two nodes.
///
/// Local axes follow the beam axis convention: local `x` runs from `n1` to
/// `n2`; local `y`/`z` are built from the global `Z` reference vector and
/// rotated by [`Beam::roll_angle_rad`] about the local `x` axis.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Beam {
    /// Unique beam id.
    pub id: u32,
    /// First end node id.
    pub n1: u32,
    /// Second end node id.
    pub n2: u32,
    /// Key into [`crate::Structure::sections`].
    pub section_id: String,
    /// Key into [`crate::Structure::materials`].
    pub material_id: String,
    /// Local roll angle `theta_x` (rad) rotating the section about its axis.
    pub roll_angle_rad: f64,
    /// End releases at `n1`: `[Ux, Uy, Uz, Rx, Ry, Rz]`, `true` = released.
    pub releases_start: [bool; 6],
    /// End releases at `n2`: `[Ux, Uy, Uz, Rx, Ry, Rz]`, `true` = released.
    pub releases_end: [bool; 6],
    /// Buckling length ratio `Lcr,y / L` (default 1.0).
    pub k_buckling_y: f64,
    /// Buckling length ratio `Lcr,z / L` (default 1.0).
    pub k_buckling_z: f64,
}

/// Helper marking a DOF index pair as fully released (truss behaviour).
const TRUSS_RELEASED: [bool; 6] = [false, true, true, true, true, true];

impl Beam {
    /// Creates a rigid frame beam with no releases and unit buckling ratios.
    pub fn frame(id: u32, n1: u32, n2: u32, section_id: &str, material_id: &str) -> Self {
        Self {
            id,
            n1,
            n2,
            section_id: section_id.to_owned(),
            material_id: material_id.to_owned(),
            roll_angle_rad: 0.0,
            releases_start: [false; 6],
            releases_end: [false; 6],
            k_buckling_y: 1.0,
            k_buckling_z: 1.0,
        }
    }

    /// Creates a pinned-truss beam: all DOFs released at both ends except the
    /// axial one, matching RDM practice for bracing members.
    pub fn truss(id: u32, n1: u32, n2: u32, section_id: &str, material_id: &str) -> Self {
        Self {
            releases_start: TRUSS_RELEASED,
            releases_end: TRUSS_RELEASED,
            ..Self::frame(id, n1, n2, section_id, material_id)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frame_beam_defaults_are_rigid() {
        let b = Beam::frame(1, 2, 3, "IPE 200", "S235JR");
        assert!(!b.releases_start.iter().any(|&r| r));
        assert_abs_diff_eq!(b.k_buckling_y, 1.0);
        assert_abs_diff_eq!(b.k_buckling_z, 1.0);
        assert_abs_diff_eq!(b.roll_angle_rad, 0.0);
    }

    #[test]
    fn truss_beam_releases_everything_but_axial() {
        let b = Beam::truss(1, 2, 3, "CHS 114.3x6", "S355J2");
        assert!(!b.releases_start[0]);
        assert!(!b.releases_end[0]);
        for i in 1..6 {
            assert!(b.releases_start[i]);
            assert!(b.releases_end[i]);
        }
    }

    use approx::assert_abs_diff_eq;
}
