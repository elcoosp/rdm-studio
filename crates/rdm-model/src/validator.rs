//! Pre-solve model validation with pedagogical diagnostics.
//!
//! The validator runs before every solve (ARCHITECTURE.md §6.1): it rejects
//! degenerate models and explains *which* rigid-body motion is unconstrained
//! instead of letting the factorization fail opaquely inside WASM.

use std::collections::{BTreeMap, BTreeSet};

use crate::geometry::Beam;
use crate::loads::LoadKind;
use crate::{ModelError, Structure};

/// Category of a model issue.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModelIssueCode {
    /// Node not connected to any beam.
    OrphanNode,
    /// Two beams share the same unordered node pair.
    DuplicateBeam,
    /// Beam shorter than the `1e-4 m` tolerance.
    TooShortBeam,
    /// Beam references a section id missing from the property table.
    UnknownSection,
    /// Beam references a material id missing from the property table.
    UnknownMaterial,
    /// Support references a node that does not exist.
    UnknownSupportNode,
    /// Nodal load references a node that does not exist.
    UnknownLoadNode,
    /// Span load references a beam that does not exist.
    UnknownLoadBeam,
    /// `position_ratio` outside `[0, 1]`.
    InvalidPositionRatio,
    /// Negative spring stiffness.
    NegativeSpring,
    /// Two supports defined on the same node.
    DuplicateSupport,
    /// Beam released on every DOF: it carries no stiffness at all.
    FullyReleasedBeam,
    /// A rigid-body mode of the whole model is unrestrained.
    UnconstrainedRigidBody,
}

impl ModelIssueCode {
    /// Stable machine code used by the web layer for i18n keys.
    pub fn slug(self) -> &'static str {
        match self {
            Self::OrphanNode => "orphan_node",
            Self::DuplicateBeam => "duplicate_beam",
            Self::TooShortBeam => "too_short_beam",
            Self::UnknownSection => "unknown_section",
            Self::UnknownMaterial => "unknown_material",
            Self::UnknownSupportNode => "unknown_support_node",
            Self::UnknownLoadNode => "unknown_load_node",
            Self::UnknownLoadBeam => "unknown_load_beam",
            Self::InvalidPositionRatio => "invalid_position_ratio",
            Self::NegativeSpring => "negative_spring",
            Self::DuplicateSupport => "duplicate_support",
            Self::FullyReleasedBeam => "fully_released_beam",
            Self::UnconstrainedRigidBody => "unconstrained_rigid_body",
        }
    }
}

/// One validation finding, with a human-readable (EN) explanation.
#[derive(Debug, Clone, PartialEq)]
pub struct ModelIssue {
    /// Issue category.
    pub code: ModelIssueCode,
    /// Entity the issue is about (node/beam id, designation...).
    pub subject: String,
    /// Pedagogical explanation of the problem.
    pub message: String,
}

impl ModelIssue {
    fn new(
        code: ModelIssueCode,
        subject: impl std::fmt::Display,
        message: impl Into<String>,
    ) -> Self {
        Self {
            code,
            subject: subject.to_string(),
            message: message.into(),
        }
    }
}

/// Validates the structure before it reaches the solver.
///
/// # Errors
///
/// Returns the full list of [`ModelIssue`]s when the model is not solvable;
/// an empty list would mean the model passed (never returned as `Ok(())`
/// wrapper is `Result<(), Vec<_>>`, so success is `Err(vec![])`-free).
pub fn validate_model(structure: &Structure) -> Result<(), Vec<ModelIssue>> {
    let mut issues: Vec<ModelIssue> = Vec::new();

    check_topology(structure, &mut issues);
    check_references(structure, &mut issues);
    check_loads(structure, &mut issues);
    check_restraints(structure, &mut issues);
    check_rigid_body_modes(structure, &mut issues);

    if issues.is_empty() {
        Ok(())
    } else {
        Err(issues)
    }
}

fn beam_ids(beams: &[Beam]) -> BTreeSet<u32> {
    beams.iter().map(|b| b.id).collect()
}

fn check_topology(structure: &Structure, issues: &mut Vec<ModelIssue>) {
    let mut connected: BTreeMap<u32, usize> = BTreeMap::new();
    let mut pairs: BTreeSet<(u32, u32)> = BTreeSet::new();
    let node_ids: BTreeSet<u32> = structure.nodes.iter().map(|n| n.id).collect();

    for beam in &structure.beams {
        let (a, b) = if beam.n1 <= beam.n2 {
            (beam.n1, beam.n2)
        } else {
            (beam.n2, beam.n1)
        };
        if a == b {
            issues.push(ModelIssue::new(
                ModelIssueCode::TooShortBeam,
                beam.id,
                "beam is a zero-length loop on the same node",
            ));
            continue;
        }
        if !pairs.insert((a, b)) {
            issues.push(ModelIssue::new(
                ModelIssueCode::DuplicateBeam,
                beam.id,
                format!("beam duplicates the member {a}-{b}"),
            ));
        }
        for end in [beam.n1, beam.n2] {
            if !node_ids.contains(&end) {
                issues.push(ModelIssue::new(
                    ModelIssueCode::UnknownSupportNode,
                    beam.id,
                    format!("beam endpoint {end} does not exist"),
                ));
            }
            *connected.entry(end).or_default() += 1;
        }

        let length = beam_length(structure, beam);
        if let Ok(len) = length
            && len < 1e-4
        {
            issues.push(ModelIssue::new(
                ModelIssueCode::TooShortBeam,
                beam.id,
                format!("beam length {len:.3e} m is below the 1e-4 m tolerance"),
            ));
        }

        if beam.releases_start.iter().all(|&r| r) && beam.releases_end.iter().all(|&r| r) {
            issues.push(ModelIssue::new(
                ModelIssueCode::FullyReleasedBeam,
                beam.id,
                "beam is released on all six DOFs at both ends and carries no stiffness",
            ));
        }
    }

    for node in &structure.nodes {
        if !connected.contains_key(&node.id) {
            issues.push(ModelIssue::new(
                ModelIssueCode::OrphanNode,
                node.id,
                format!("node {} has no connected beam", node.id),
            ));
        }
    }
    let ids = beam_ids(&structure.beams);
    if ids.len() != structure.beams.len() {
        issues.push(ModelIssue::new(
            ModelIssueCode::DuplicateBeam,
            "*",
            "beam ids are not unique",
        ));
    }
}

fn beam_length(structure: &Structure, beam: &Beam) -> Result<f64, ModelError> {
    let n1 = structure.node(beam.n1)?;
    let n2 = structure.node(beam.n2)?;
    let dx = n2.x - n1.x;
    let dy = n2.y - n1.y;
    let dz = n2.z - n1.z;
    Ok((dx * dx + dy * dy + dz * dz).sqrt())
}

fn check_references(structure: &Structure, issues: &mut Vec<ModelIssue>) {
    for beam in &structure.beams {
        if !structure.sections.contains_key(&beam.section_id) {
            issues.push(ModelIssue::new(
                ModelIssueCode::UnknownSection,
                beam.id,
                format!(
                    "section \"{}\" is not in the section table",
                    beam.section_id
                ),
            ));
        }
        if !structure.materials.contains_key(&beam.material_id) {
            issues.push(ModelIssue::new(
                ModelIssueCode::UnknownMaterial,
                beam.id,
                format!(
                    "material \"{}\" is not in the material table",
                    beam.material_id
                ),
            ));
        }
    }
}

fn check_loads(structure: &Structure, issues: &mut Vec<ModelIssue>) {
    let node_ids: BTreeSet<u32> = structure.nodes.iter().map(|n| n.id).collect();
    let beam_ids: BTreeSet<u32> = structure.beams.iter().map(|b| b.id).collect();
    for load in &structure.loads {
        match load.kind {
            LoadKind::Nodal { node_id, .. } => {
                if !node_ids.contains(&node_id) {
                    issues.push(ModelIssue::new(
                        ModelIssueCode::UnknownLoadNode,
                        node_id,
                        format!("nodal load targets missing node {node_id}"),
                    ));
                }
            }
            LoadKind::PointOnSpan {
                beam_id,
                position_ratio,
                ..
            } => {
                if !beam_ids.contains(&beam_id) {
                    issues.push(ModelIssue::new(
                        ModelIssueCode::UnknownLoadBeam,
                        beam_id,
                        format!("span load targets missing beam {beam_id}"),
                    ));
                }
                if !(0.0..=1.0).contains(&position_ratio) {
                    issues.push(ModelIssue::new(
                        ModelIssueCode::InvalidPositionRatio,
                        beam_id,
                        format!("position ratio {position_ratio} is outside [0, 1]"),
                    ));
                }
            }
            LoadKind::Trapezoid { beam_id, .. } => {
                if !beam_ids.contains(&beam_id) {
                    issues.push(ModelIssue::new(
                        ModelIssueCode::UnknownLoadBeam,
                        beam_id,
                        format!("distributed load targets missing beam {beam_id}"),
                    ));
                }
            }
            LoadKind::AccelerationField { .. } => {
                // A global field targets no entity; the finite-component
                // contract is enforced by the serialization schema.
            }
        }
    }
}

fn check_restraints(structure: &Structure, issues: &mut Vec<ModelIssue>) {
    let node_ids: BTreeSet<u32> = structure.nodes.iter().map(|n| n.id).collect();
    let mut seen: BTreeSet<u32> = BTreeSet::new();
    for support in &structure.supports {
        if !node_ids.contains(&support.node_id) {
            issues.push(ModelIssue::new(
                ModelIssueCode::UnknownSupportNode,
                support.node_id,
                format!("support targets missing node {}", support.node_id),
            ));
        }
        if !seen.insert(support.node_id) {
            issues.push(ModelIssue::new(
                ModelIssueCode::DuplicateSupport,
                support.node_id,
                format!("several supports defined on node {}", support.node_id),
            ));
        }
        for &k in &support.spring_stiffness {
            if k < 0.0 {
                issues.push(ModelIssue::new(
                    ModelIssueCode::NegativeSpring,
                    support.node_id,
                    format!("support on node {} has a negative spring", support.node_id),
                ));
                break;
            }
        }
    }
}

/// Rigid-body diagnostics: finds which of the six global rigid-body modes are
/// unrestrained, so the engineer knows *why* the mechanism is unstable.
fn check_rigid_body_modes(structure: &Structure, issues: &mut Vec<ModelIssue>) {
    if structure.nodes.is_empty() {
        return;
    }
    let centroid = model_centroid(structure);
    // 6 candidate rigid-body modes: 3 translations + 3 rotations (rad) about
    // the centroid. Each locked translational DOF constrains
    // dir . (t + w x r); each locked rotational DOF constrains dir . w.
    let modes = rigid_body_modes();
    let mut constraints: Vec<[f64; 6]> = Vec::new();
    for support in &structure.supports {
        let Ok(node) = structure.node(support.node_id) else {
            continue;
        };
        let r = [
            node.x - centroid[0],
            node.y - centroid[1],
            node.z - centroid[2],
        ];
        for (dof, &locked) in support.locked_dofs.iter().enumerate() {
            if !locked {
                continue;
            }
            let mut row = [0.0f64; 6];
            if dof < 3 {
                let dir = unit_axis(dof);
                for (mode_idx, mode) in modes.iter().enumerate() {
                    let arm = cross3(mode.angular, r);
                    row[mode_idx] = dot3(mode.linear, dir) + dot3(arm, dir);
                }
            } else {
                let dir = unit_axis(dof - 3);
                for (mode_idx, mode) in modes.iter().enumerate() {
                    row[mode_idx] = dot3(mode.angular, dir);
                }
            }
            constraints.push(row);
        }
    }
    if constraints.is_empty() {
        issues.push(ModelIssue::new(
            ModelIssueCode::UnconstrainedRigidBody,
            "*",
            "the model has no support at all: it can translate and rotate freely",
        ));
        return;
    }

    let free = free_modes(&constraints);
    for mode in free {
        issues.push(ModelIssue::new(
            ModelIssueCode::UnconstrainedRigidBody,
            "*",
            describe_free_mode(mode),
        ));
    }
}

struct RigidBodyMode {
    linear: [f64; 3],
    angular: [f64; 3],
}

fn rigid_body_modes() -> [RigidBodyMode; 6] {
    // Pure rotation modes carry zero uniform translation; the lever arm
    // `omega x r` is applied per-node in the constraint rows.
    let zero = [0.0; 3];
    [
        RigidBodyMode {
            linear: [1.0, 0.0, 0.0],
            angular: zero,
        },
        RigidBodyMode {
            linear: [0.0, 1.0, 0.0],
            angular: zero,
        },
        RigidBodyMode {
            linear: [0.0, 0.0, 1.0],
            angular: zero,
        },
        RigidBodyMode {
            linear: zero,
            angular: [1.0, 0.0, 0.0],
        },
        RigidBodyMode {
            linear: zero,
            angular: [0.0, 1.0, 0.0],
        },
        RigidBodyMode {
            linear: zero,
            angular: [0.0, 0.0, 1.0],
        },
    ]
}

fn unit_axis(i: usize) -> [f64; 3] {
    let mut a = [0.0; 3];
    a[i] = 1.0;
    a
}

fn dot3(a: [f64; 3], b: [f64; 3]) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

fn cross3(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

fn model_centroid(structure: &Structure) -> [f64; 3] {
    let n = structure.nodes.len() as f64;
    let sum: [f64; 3] = structure.nodes.iter().fold([0.0; 3], |acc, node| {
        [acc[0] + node.x, acc[1] + node.y, acc[2] + node.z]
    });
    [sum[0] / n, sum[1] / n, sum[2] / n]
}

/// Returns the indices (0..6) of rigid-body modes lying in the null space of
/// the constraint rows, using exact reduced row echelon on the small matrix.
fn free_modes(constraints: &[[f64; 6]]) -> Vec<usize> {
    const COLS: usize = 6;
    let mut a = constraints.to_vec();
    let rows = a.len();
    let mut pivot_cols: Vec<usize> = Vec::new();
    let mut r = 0usize;
    for col in 0..COLS {
        let Some(pivot_row) = (r..rows).find(|&i| a[i][col].abs() > 1e-9) else {
            continue;
        };
        a.swap(r, pivot_row);
        let pivot_val = a[r][col];
        for value in &mut a[r] {
            *value /= pivot_val;
        }
        for i in 0..rows {
            if i == r {
                continue;
            }
            let factor = a[i][col];
            if factor == 0.0 {
                continue;
            }
            let pivot_row = a[r];
            for (av, pv) in a[i].iter_mut().zip(pivot_row.iter()) {
                *av -= factor * *pv;
            }
        }
        pivot_cols.push(col);
        r += 1;
        if r == rows {
            break;
        }
    }
    (0..COLS).filter(|c| !pivot_cols.contains(c)).collect()
}

fn describe_free_mode(mode: usize) -> String {
    match mode {
        0 => "the model can translate along global X without any resistance".to_owned(),
        1 => "the model can translate along global Y without any resistance".to_owned(),
        2 => "the model can translate along global Z without any resistance".to_owned(),
        3 => "the model can rotate about global X without any resistance".to_owned(),
        4 => "the model can rotate about global Y without any resistance".to_owned(),
        5 => "the model can rotate about global Z without any resistance".to_owned(),
        _ => "unknown rigid-body mode".to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::geometry::{Beam, Node, SectionProperties, SectionShape};
    use crate::loads::{Direction, GlobalForces, Load, LoadCase, LoadKind};
    use approx::assert_abs_diff_eq;

    fn props() -> SectionProperties {
        SectionProperties {
            shape: SectionShape::DoubleSymmetricI,
            a: 1e-3,
            iy: 1e-6,
            iz: 1e-7,
            it: 1e-8,
            iw: None,
            wel_y: 1e-5,
            wel_z: 1e-6,
            wpl_y: None,
            wpl_z: None,
            h: Some(0.2),
            b: Some(0.1),
            tw: Some(0.006),
            tf: Some(0.008),
            r: Some(0.012),
        }
    }

    fn beam_frame(id: u32, n1: u32, n2: u32) -> Beam {
        Beam::frame(id, n1, n2, "SEC", "MAT")
    }

    fn simple_structure() -> Structure {
        let mut s = Structure::default();
        s.sections.insert("SEC".to_owned(), props());
        s.materials.insert(
            "MAT".to_owned(),
            crate::MaterialProperties {
                e: 210e9,
                g: 81e9,
                nu: 0.3,
                rho: 7850.0,
                fy: 235e6,
                fu: 360e6,
            },
        );
        s
    }

    #[test]
    fn valid_simply_supported_beam_passes() {
        let mut s = simple_structure();
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.beams.push(beam_frame(1, 1, 2));
        // Pin + torsional restraint at node 1 (a bare pin lets the beam
        // spin about its own axis - a true mechanism), roller at node 2.
        s.supports.push(crate::Support {
            node_id: 1,
            locked_dofs: [true, true, true, true, false, false],
            spring_stiffness: [0.0; 6],
        });
        // Fork support at node 2: Uy+Uz (restrains the yaw rigid mode).
        s.supports.push(crate::Support {
            node_id: 2,
            locked_dofs: [false, true, true, false, false, false],
            spring_stiffness: [0.0; 6],
        });
        s.loads.push(Load {
            case: LoadCase::Variable,
            kind: LoadKind::Nodal {
                node_id: 2,
                forces: GlobalForces::vertical(-1e4),
            },
        });
        assert!(validate_model(&s).is_ok(), "unexpected issues");
    }

    #[test]
    fn duplicate_and_short_beams_are_reported() {
        let mut s = simple_structure();
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 5e-5, 0.0, 0.0));
        s.beams.push(beam_frame(1, 1, 2));
        s.beams.push(beam_frame(2, 2, 1));
        let issues = validate_model(&s).unwrap_err();
        assert!(
            issues
                .iter()
                .any(|i| i.code == ModelIssueCode::DuplicateBeam)
        );
        assert!(
            issues
                .iter()
                .any(|i| i.code == ModelIssueCode::TooShortBeam)
        );
    }

    #[test]
    fn free_model_reports_all_six_modes() {
        let mut s = simple_structure();
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.beams.push(beam_frame(1, 1, 2));
        let issues = validate_model(&s).unwrap_err();
        let rigid = issues
            .iter()
            .filter(|i| i.code == ModelIssueCode::UnconstrainedRigidBody)
            .count();
        assert_eq!(rigid, 1, "expected one summarizing unrestrained report");
        assert!(!issues.iter().any(|i| i.code == ModelIssueCode::OrphanNode));
    }

    #[test]
    fn missing_z_restraint_is_explained() {
        let mut s = simple_structure();
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.beams.push(beam_frame(1, 1, 2));
        // only Ux/Uy locked: vertical translation stays free
        s.supports.push(crate::Support {
            node_id: 1,
            locked_dofs: [true, true, false, false, false, false],
            spring_stiffness: [0.0; 6],
        });
        let issues = validate_model(&s).unwrap_err();
        let rigid_msgs: Vec<&str> = issues
            .iter()
            .filter(|i| i.code == ModelIssueCode::UnconstrainedRigidBody)
            .map(|i| i.message.as_str())
            .collect();
        assert!(
            rigid_msgs
                .iter()
                .any(|m| m.contains("translate along global Z"))
        );
    }

    #[test]
    fn direction_validator_rejects_zero_norm() {
        assert!(Direction::normalized(0.0, 0.0, 0.0).is_err());
    }

    #[test]
    fn beam_length_matches_geometry() {
        let mut s = simple_structure();
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 3.0, 4.0, 0.0));
        let b = beam_frame(1, 1, 2);
        assert_abs_diff_eq!(beam_length(&s, &b).unwrap(), 5.0, epsilon = 1e-12);
    }
}
