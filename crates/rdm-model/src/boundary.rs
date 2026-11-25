//! Boundary conditions: 6-DOF restraint matrix per node.
//!
//! A [`Support`] either fully locks a DOF (`locked_dofs`) or attaches a linear
//! spring (`spring_stiffness`, `N/m` for translations, `N·m/rad` for
//! rotations). A DOF that is locked ignores its spring value; a DOF that is
//! neither locked nor sprung is free.

use serde::{Deserialize, Serialize};

/// Restraint of a node, following the RDM 7 six-DOF matrix convention.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Support {
    /// Restrained node id.
    pub node_id: u32,
    /// Locked DOFs `[Ux, Uy, Uz, Rx, Ry, Rz]`, `true` = blocked.
    pub locked_dofs: [bool; 6],
    /// Spring stiffness `[N/m x3, N.m/rad x3]`, `0.0` when rigid/free.
    pub spring_stiffness: [f64; 6],
}

impl Support {
    /// Fully fixed support (all six DOFs locked).
    pub fn fixed(node_id: u32) -> Self {
        Self {
            node_id,
            locked_dofs: [true; 6],
            spring_stiffness: [0.0; 6],
        }
    }

    /// Pinned support: translations locked, rotations free.
    pub fn pinned(node_id: u32) -> Self {
        Self {
            node_id,
            locked_dofs: [true, true, true, false, false, false],
            spring_stiffness: [0.0; 6],
        }
    }

    /// Roller support on the global `Z` reaction plane: `Ux`/`Uy` free,
    /// `Uz` locked, rotations free.
    pub fn roller_z(node_id: u32) -> Self {
        Self {
            node_id,
            locked_dofs: [false, false, true, false, false, false],
            spring_stiffness: [0.0; 6],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn presets_match_rdm_convention() {
        let f = Support::fixed(1);
        assert!(f.locked_dofs.iter().all(|&l| l));
        let p = Support::pinned(2);
        assert!(p.locked_dofs[..3].iter().all(|&l| l));
        assert!(!p.locked_dofs[3..].iter().any(|&l| l));
        let r = Support::roller_z(3);
        assert!(r.locked_dofs[2]);
        assert_eq!(r.locked_dofs.iter().filter(|&&l| l).count(), 1);
    }
}
