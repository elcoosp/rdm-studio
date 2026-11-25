//! Elementary load cases and load definitions.
//!
//! The solver solves each elementary case once (§4 of ARCHITECTURE.md) and
//! the normative layer superimposes ULS/SLS combinations, so a load always
//! belongs to exactly one [`LoadCase`].

use serde::{Deserialize, Serialize};

/// Elementary load case of the model.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LoadCase {
    /// Permanent loads `G` (dead loads + automatic self-weight).
    Permanent,
    /// Imposed variable load `Q`.
    Variable,
    /// Wind `W`.
    Wind,
    /// Snow `S`.
    Snow,
    /// Inertial acceleration case `Acc` (solved, not in the ULS envelope).
    Acceleration,
}

impl LoadCase {
    /// Short code used in reports and catalogs (`G`, `Q`, `W`, `S`, `Acc`).
    pub fn code(self) -> &'static str {
        match self {
            Self::Permanent => "G",
            Self::Variable => "Q",
            Self::Wind => "W",
            Self::Snow => "S",
            Self::Acceleration => "Acc",
        }
    }
}

/// A single concentrated action expressed in **global** coordinates.
///
/// Translations are `N`, rotations are `N·m`.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct GlobalForces {
    /// Force along global X (N).
    pub fx: f64,
    /// Force along global Y (N).
    pub fy: f64,
    /// Force along global Z (N).
    pub fz: f64,
    /// Moment about global X (N·m).
    pub mx: f64,
    /// Moment about global Y (N·m).
    pub my: f64,
    /// Moment about global Z (N·m).
    pub mz: f64,
}

impl GlobalForces {
    /// Zero action (convenient default for partial definitions).
    pub fn zero() -> Self {
        Self {
            fx: 0.0,
            fy: 0.0,
            fz: 0.0,
            mx: 0.0,
            my: 0.0,
            mz: 0.0,
        }
    }

    /// Vertical gravity-like action `fz` (N, positive up).
    pub fn vertical(fz: f64) -> Self {
        Self { fz, ..Self::zero() }
    }
}

/// Direction of a distributed load, expressed as a global unit vector.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Direction {
    /// Global X component (unitless).
    pub x: f64,
    /// Global Y component (unitless).
    pub y: f64,
    /// Global Z component (unitless).
    pub z: f64,
}

impl Direction {
    /// Normalizes a raw direction vector.
    ///
    /// # Errors
    ///
    /// Returns [`LoadError::ZeroDirection`] when the vector has zero norm.
    pub fn normalized(x: f64, y: f64, z: f64) -> Result<Self, LoadError> {
        let norm = (x * x + y * y + z * z).sqrt();
        if !(norm > 0.0) {
            return Err(LoadError::ZeroDirection);
        }
        Ok(Self {
            x: x / norm,
            y: y / norm,
            z: z / norm,
        })
    }

    /// Downward gravity direction (global `-Z`).
    pub fn gravity() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            z: -1.0,
        }
    }
}

/// Load applied to a node or a beam span, in strict SI units.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Load {
    /// Elementary case this load belongs to.
    pub case: LoadCase,
    /// Where the load acts and how it is distributed.
    pub kind: LoadKind,
}

/// Spatial definition of a load.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum LoadKind {
    /// Concentrated action applied directly at a node.
    Nodal {
        /// Loaded node id.
        node_id: u32,
        /// Global force/moment vector.
        forces: GlobalForces,
    },
    /// Concentrated action applied at `position_ratio` along a beam span
    /// (0 = node `n1`, 1 = node `n2`); eliminates artificial intermediate
    /// nodes per ARCHITECTURE.md §6.1.
    PointOnSpan {
        /// Loaded beam id.
        beam_id: u32,
        /// Position along the span, in `[0, 1]`.
        position_ratio: f64,
        /// Global force/moment vector at that point.
        forces: GlobalForces,
    },
    /// Trapezoidally distributed transverse load on a beam span,
    /// `q_start` at `n1` and `q_end` at `n2` (N/m), acting along `direction`.
    Trapezoid {
        /// Loaded beam id.
        beam_id: u32,
        /// Intensity at the start node (N/m).
        q_start: f64,
        /// Intensity at the end node (N/m).
        q_end: f64,
        /// Global direction of the load intensity vector.
        direction: Direction,
    },
}

/// Load definition errors.
#[derive(Debug, Clone, Copy, PartialEq, thiserror::Error)]
pub enum LoadError {
    /// A distributed-load direction vector had zero norm.
    #[error("distributed load direction has zero norm")]
    ZeroDirection,
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_abs_diff_eq;

    #[test]
    fn direction_normalization_is_idempotent() {
        let d = Direction::normalized(0.0, 3.0, -4.0).unwrap();
        assert_abs_diff_eq!(d.y, 0.6);
        assert_abs_diff_eq!(d.z, -0.8);
        assert_abs_diff_eq!((d.x * d.x + d.y * d.y + d.z * d.z), 1.0);
    }

    #[test]
    fn zero_direction_is_rejected() {
        assert_eq!(
            Direction::normalized(0.0, 0.0, 0.0),
            Err(LoadError::ZeroDirection)
        );
    }

    #[test]
    fn case_codes_match_rdm_names() {
        assert_eq!(LoadCase::Permanent.code(), "G");
        assert_eq!(LoadCase::Acceleration.code(), "Acc");
    }
}
