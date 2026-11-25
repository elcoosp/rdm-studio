//! Canonical 3D structural model for RDM Studio.
//!
//! Everything in this crate uses **strict SI units** (`m`, `N`, `Pa`, `rad`,
//! `kg/m³`), as mandated by `ARCHITECTURE.md` §19.4. Display conversions
//! (`mm`, `kN`, `MPa`) live exclusively in `apps/web`.
//!
//! The crate is the root of the dependency graph: every other domain crate
//! (`rdm-eurocode`, `rdm-solver`) may depend on `rdm-model`, and nothing ever
//! depends on the Web layer from here.
//!
//! # Layout
//!
//! - `geometry` module: [`Node`] and [`Beam`] (the 12-DOF frame element)
//! - `boundary` module: [`Support`] (6-DOF restraint matrix per node)
//! - `loads` module: elementary load cases (`G`, `Q`, `W`, `S`, `Acc`)
//! - `validator` module: pre-solve validation with pedagogical diagnostics
//! - `project` module: the `.rdm` canonical JSON file + SHA-256 fingerprint

pub mod boundary;
pub mod geometry;
pub mod loads;
pub mod project;
pub mod validator;

pub use boundary::Support;
pub use geometry::{Beam, Node, SectionProperties, SectionShape};
pub use loads::{Direction, GlobalForces, Load, LoadCase, LoadKind};
pub use project::ProjectFile;
pub use validator::{ModelIssue, ModelIssueCode, validate_model};

use std::collections::BTreeMap;

/// Material constants used by the solver and the Eurocode checks.
///
/// All values are nominal SI magnitudes (`Pa`, dimensionless, `kg/m³`).
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct MaterialProperties {
    /// Young's modulus `E` (Pa).
    pub e: f64,
    /// Shear modulus `G` (Pa).
    pub g: f64,
    /// Poisson's ratio (dimensionless).
    pub nu: f64,
    /// Density `rho` (`kg/m³`) used for automatic self-weight.
    pub rho: f64,
    /// Nominal yield strength `f_y` (Pa).
    pub fy: f64,
    /// Nominal ultimate strength `f_u` (Pa).
    pub fu: f64,
}

/// The complete calculation model handed to the solver.
///
/// Sections and materials are stored as resolved property tables keyed by the
/// `section_id` / `material_id` strings referenced by [`Beam`]. The web layer
/// resolves catalog designations into these tables through `rdm-wasm`; the
/// solver never reads the normative catalogs directly.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct Structure {
    /// Model nodes in global Cartesian coordinates (m).
    pub nodes: Vec<Node>,
    /// Frame elements (12-DOF Euler-Bernoulli beams).
    pub beams: Vec<Beam>,
    /// Restraints applied at nodes.
    pub supports: Vec<Support>,
    /// Nodal, point-on-span and trapezoidal loads grouped by elementary case.
    pub loads: Vec<Load>,
    /// Section property table keyed by designation (SI units).
    pub sections: BTreeMap<String, SectionProperties>,
    /// Material property table keyed by designation (SI units).
    pub materials: BTreeMap<String, MaterialProperties>,
    /// When true (the default) each beam's self-weight `rho * A * g` is added
    /// to the `Permanent` case, per ARCHITECTURE.md section 6.1.
    pub self_weight_enabled: bool,
}

impl Default for Structure {
    fn default() -> Self {
        Self {
            nodes: Vec::new(),
            beams: Vec::new(),
            supports: Vec::new(),
            loads: Vec::new(),
            sections: BTreeMap::new(),
            materials: BTreeMap::new(),
            self_weight_enabled: true,
        }
    }
}

impl Structure {
    /// Returns the position of the node with the given id.
    ///
    /// # Errors
    ///
    /// Returns [`ModelError::UnknownNode`] when `node_id` does not exist.
    pub fn node(&self, node_id: u32) -> Result<&Node, ModelError> {
        self.nodes
            .iter()
            .find(|n| n.id == node_id)
            .ok_or(ModelError::UnknownNode { id: node_id })
    }

    /// Returns the beam with the given id.
    ///
    /// # Errors
    ///
    /// Returns [`ModelError::UnknownBeam`] when `beam_id` does not exist.
    pub fn beam(&self, beam_id: u32) -> Result<&Beam, ModelError> {
        self.beams
            .iter()
            .find(|b| b.id == beam_id)
            .ok_or(ModelError::UnknownBeam { id: beam_id })
    }

    /// Global DOF offset of a node: node `i` owns DOFs `6i .. 6i + 6`.
    ///
    /// DOF order within a node is `[Ux, Uy, Uz, Rx, Ry, Rz]`.
    ///
    /// # Errors
    ///
    /// Returns [`ModelError::UnknownNode`] when `node_id` does not exist.
    pub fn dof_offset(&self, node_id: u32) -> Result<usize, ModelError> {
        let idx = self
            .nodes
            .iter()
            .position(|n| n.id == node_id)
            .ok_or(ModelError::UnknownNode { id: node_id })?;
        Ok(6 * idx)
    }
}

/// Domain errors shared by the model layer.
#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum ModelError {
    /// A node id referenced by a beam, support or load does not exist.
    #[error("unknown node id {id}")]
    UnknownNode {
        /// Missing node id.
        id: u32,
    },
    /// A beam id referenced by a load does not exist.
    #[error("unknown beam id {id}")]
    UnknownBeam {
        /// Missing beam id.
        id: u32,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dof_offset_follows_node_order() {
        let mut s = Structure::default();
        s.nodes.push(Node::new(10, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(20, 1.0, 0.0, 0.0));
        assert_abs_diff_eq!(s.dof_offset(10).unwrap() as f64, 0.0);
        assert_abs_diff_eq!(s.dof_offset(20).unwrap() as f64, 6.0);
        assert_eq!(s.dof_offset(99), Err(ModelError::UnknownNode { id: 99 }));
    }

    use approx::assert_abs_diff_eq;
}
