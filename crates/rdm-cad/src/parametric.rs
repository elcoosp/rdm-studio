//! Parametric structure generator (v1.6.0, ARCHITECTURE.md §5 `rdm-cad`):
//! configurable Warren truss, portal frame, cantilever and multi-span
//! continuous beam templates.
//!
//! Every template consumes strict SI parameters (`span_m`, `height_m`,
//! `bays`) plus catalog section/material designations and emits a complete
//! [`rdm_model::Structure`]: valid topology, rigid-body-safe default
//! supports and clean dense 1-based sequential node/beam ids.
//!
//! Members are generated as rigid frame elements (the Step 1 inspector
//! exposes a 1-click `Beam::truss` articulation toggle for the user to
//! pin-joint selected diagonals afterwards): a fully released plane truss
//! is a singular 3D mechanism (free out-of-plane sway of the top chord),
//! so the generator never ships an unstable topology by default.

use serde::Deserialize;

use rdm_model::{Beam, Node, Structure, Support};

/// Parametric template family exposed to the Step 1 configurator.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
pub enum ParametricTemplate {
    /// Warren truss on two supports.
    WarrenTruss,
    /// Portal frame with moment-connected rafters.
    PortalFrame,
    /// Cantilever column + boom + tie back to the base.
    Cantilever,
    /// Multi-span continuous beam on fork supports.
    ContinuousBeam,
}

/// SI parameters of one parametric generation request.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct ParametricParams {
    /// Template family.
    pub template: ParametricTemplate,
    /// Total span (m), split into `bays` equal divisions.
    pub span_m: f64,
    /// Structural height (m); `0.0` selects the template default.
    pub height_m: f64,
    /// Panel / span / subdivision count (1..=24).
    pub bays: u32,
    /// Primary member section (chords, columns, boom, beam).
    pub primary_section: String,
    /// Secondary member section (diagonals, rafters, tie).
    pub secondary_section: String,
    /// Material designation for every member.
    pub material_id: String,
}

/// Generation errors with pedagogical messages (surfaced by the UI).
#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum ParametricError {
    /// A numeric parameter is outside its physical range.
    #[error("invalid parametric parameter: {0}")]
    InvalidParameter(String),
}

impl ParametricParams {
    /// Validates the numeric ranges before topology generation.
    ///
    /// # Errors
    ///
    /// Returns [`ParametricError::InvalidParameter`] when the span is not
    /// strictly positive, the height is negative or `bays` is out of range.
    pub fn validate(&self) -> Result<(), ParametricError> {
        if !(self.span_m.is_finite() && self.span_m > 0.0) {
            return Err(ParametricError::InvalidParameter(
                "span_m must be a positive finite length (m)".to_owned(),
            ));
        }
        if !(self.height_m.is_finite() && self.height_m >= 0.0) {
            return Err(ParametricError::InvalidParameter(
                "height_m must be a non-negative finite height (m)".to_owned(),
            ));
        }
        if self.bays == 0 || self.bays > 24 {
            return Err(ParametricError::InvalidParameter(
                "bays must lie in 1..=24".to_owned(),
            ));
        }
        Ok(())
    }
}

/// Support builders shared by every template.
/// Fork / lateral fork: `Uy` + `Uz` locked (kills the yaw / roll rigid
/// modes on line supports) plus optional `Ux`.
fn fork(node_id: u32, lock_x: bool) -> Support {
    Support {
        node_id,
        locked_dofs: [lock_x, true, true, false, false, false],
        spring_stiffness: [0.0; 6],
    }
}

/// Column foot: pinned + `Rx` on the first foot (blocks the out-of-plane
/// rigid rotation of a planar frame), plain fork elsewhere.
fn frame_base(node_id: u32, first: bool) -> Support {
    Support {
        node_id,
        locked_dofs: [true, true, true, first, false, false],
        spring_stiffness: [0.0; 6],
    }
}

/// Fully clamped foot (cantilever base).
fn fixed(node_id: u32) -> Support {
    Support {
        node_id,
        locked_dofs: [true; 6],
        spring_stiffness: [0.0; 6],
    }
}

/// Generates the parametric structure for `params`.
///
/// # Errors
///
/// Returns [`ParametricError::InvalidParameter`] when the request is out of
/// range (see [`ParametricParams::validate`]).
pub fn generate_structure(params: &ParametricParams) -> Result<Structure, ParametricError> {
    params.validate()?;
    let mut structure = Structure {
        self_weight_enabled: true,
        ..Structure::default()
    };
    match params.template {
        ParametricTemplate::WarrenTruss => warren_truss(params, &mut structure),
        ParametricTemplate::PortalFrame => portal_frame(params, &mut structure),
        ParametricTemplate::Cantilever => cantilever(params, &mut structure),
        ParametricTemplate::ContinuousBeam => continuous_beam(params, &mut structure),
    }
    Ok(structure)
}

/// Pushes a node and returns its dense 1-based id.
fn push_node(structure: &mut Structure, x: f64, y: f64, z: f64) -> u32 {
    let id = structure.nodes.len() as u32 + 1;
    structure.nodes.push(Node::new(id, x, y, z));
    id
}

/// Pushes a frame member and returns its dense 1-based id.
fn push_frame(structure: &mut Structure, n1: u32, n2: u32, section: &str, material: &str) -> u32 {
    let id = structure.beams.len() as u32 + 1;
    structure
        .beams
        .push(Beam::frame(id, n1, n2, section, material));
    id
}

/// Pushes a pinned-truss member (axial only) and returns its dense id.
fn push_truss(structure: &mut Structure, n1: u32, n2: u32, section: &str, material: &str) -> u32 {
    let id = structure.beams.len() as u32 + 1;
    structure
        .beams
        .push(Beam::truss(id, n1, n2, section, material));
    id
}

/// Warren truss: `bays` bottom panels, `bays` top nodes at mid-panels,
/// chords and diagonals. Pinned + fork supports at the bottom chord ends.
fn warren_truss(params: &ParametricParams, structure: &mut Structure) {
    let bays = params.bays;
    let panel = params.span_m / f64::from(bays);
    // A zero height degenerates the diagonals onto the chords; the
    // template default is a quarter-span rise.
    let height = if params.height_m > 1e-6 {
        params.height_m
    } else {
        params.span_m / 4.0
    };
    // Bottom chord: bays + 1 nodes at z = 0.
    let mut bottom = Vec::with_capacity(bays as usize + 1);
    for i in 0..=bays {
        bottom.push(push_node(structure, f64::from(i) * panel, 0.0, 0.0));
    }
    // Top chord: bays nodes at panel midpoints, z = height.
    let mut top = Vec::with_capacity(bays as usize);
    for i in 0..bays {
        top.push(push_node(
            structure,
            (f64::from(i) + 0.5) * panel,
            0.0,
            height,
        ));
    }
    // Bottom chords (primary).
    for window in bottom.windows(2) {
        let (n1, n2) = (window[0], window[1].to_owned());
        push_frame(
            structure,
            n1,
            n2,
            &params.primary_section,
            &params.material_id,
        );
    }
    // Top chords (primary) between consecutive top nodes.
    for window in top.windows(2) {
        let (n1, n2) = (window[0], window[1].to_owned());
        push_frame(
            structure,
            n1,
            n2,
            &params.primary_section,
            &params.material_id,
        );
    }
    // Warren diagonals (secondary): top node i spans the two adjacent
    // bottom nodes (W pattern).
    for (i, &top_id) in top.iter().enumerate() {
        push_frame(
            structure,
            bottom[i],
            top_id,
            &params.secondary_section,
            &params.material_id,
        );
        push_frame(
            structure,
            top_id,
            bottom[i + 1],
            &params.secondary_section,
            &params.material_id,
        );
    }
    // Default supports: pinned + anti-roll Rx on the left end (a plane
    // truss can otherwise roll about its own bottom-chord axis), fork on
    // the right end.
    structure.supports.push(frame_base(bottom[0], true));
    structure
        .supports
        .push(fork(bottom[bottom.len() - 1], false));
}

/// Portal frame: `bays` bays of width `span / bays`, columns of `height`
/// and flat rafters. The first foot also locks `Rx` (out-of-plane mode).
fn portal_frame(params: &ParametricParams, structure: &mut Structure) {
    let bays = params.bays.max(1);
    let bay_width = params.span_m / f64::from(bays);
    let height = if params.height_m > 1e-6 {
        params.height_m
    } else {
        3.0
    };
    // Column feet.
    let mut feet = Vec::with_capacity(bays as usize + 1);
    for i in 0..=bays {
        feet.push(push_node(structure, f64::from(i) * bay_width, 0.0, 0.0));
    }
    // Rafter level nodes.
    let mut heads = Vec::with_capacity(bays as usize + 1);
    for i in 0..=bays {
        heads.push(push_node(structure, f64::from(i) * bay_width, 0.0, height));
    }
    // Columns (primary).
    for (&foot, &head) in feet.iter().zip(&heads) {
        push_frame(
            structure,
            foot,
            head,
            &params.primary_section,
            &params.material_id,
        );
    }
    // Rafters (secondary, moment-connected to the columns).
    for window in heads.windows(2) {
        let (n1, n2) = (window[0], window[1].to_owned());
        push_frame(
            structure,
            n1,
            n2,
            &params.secondary_section,
            &params.material_id,
        );
    }
    for (i, &foot) in feet.iter().enumerate() {
        structure.supports.push(frame_base(foot, i == 0));
    }
}

/// Cantilever: clamped column of `height`, boom of `span` split into
/// `bays` segments, articulated tie back to the base (axially active).
fn cantilever(params: &ParametricParams, structure: &mut Structure) {
    let bays = params.bays;
    let height = if params.height_m > 1e-6 {
        params.height_m
    } else {
        3.0
    };
    let base = push_node(structure, 0.0, 0.0, 0.0);
    let column_head = push_node(structure, 0.0, 0.0, height);
    push_frame(
        structure,
        base,
        column_head,
        &params.primary_section,
        &params.material_id,
    );
    // Boom: bays collinear segments at the column head.
    let segment = params.span_m / f64::from(bays);
    let mut boom = Vec::with_capacity(bays as usize + 1);
    boom.push(column_head);
    for i in 1..=bays {
        boom.push(push_node(structure, f64::from(i) * segment, 0.0, height));
    }
    for window in boom.windows(2) {
        let (n1, n2) = (window[0], window[1].to_owned());
        push_frame(
            structure,
            n1,
            n2,
            &params.primary_section,
            &params.material_id,
        );
    }
    // Tie (secondary, articulated) from the boom tip back to the base.
    let tip = boom[boom.len() - 1];
    push_truss(
        structure,
        tip,
        base,
        &params.secondary_section,
        &params.material_id,
    );
    structure.supports.push(fixed(base));
}

/// Multi-span continuous beam: `bays` equal spans. The first support is
/// pinned with `Rx` (the beam line is a degenerate rigid rotation about
/// its own axis), then a locking fork, then simple forks.
fn continuous_beam(params: &ParametricParams, structure: &mut Structure) {
    let bays = params.bays;
    let span = params.span_m / f64::from(bays);
    let mut line = Vec::with_capacity(bays as usize + 1);
    for i in 0..=bays {
        line.push(push_node(structure, f64::from(i) * span, 0.0, 0.0));
    }
    for window in line.windows(2) {
        let (n1, n2) = (window[0], window[1].to_owned());
        push_frame(
            structure,
            n1,
            n2,
            &params.primary_section,
            &params.material_id,
        );
    }
    for (i, &node_id) in line.iter().enumerate() {
        structure.supports.push(if i == 0 {
            frame_base(node_id, true)
        } else {
            fork(node_id, i == 1)
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_abs_diff_eq;

    fn params(template: ParametricTemplate, span: f64, height: f64, bays: u32) -> ParametricParams {
        ParametricParams {
            template,
            span_m: span,
            height_m: height,
            bays,
            primary_section: "IPE 200".to_owned(),
            secondary_section: "IPE 140".to_owned(),
            material_id: "S235JR".to_owned(),
        }
    }

    /// Minimal catalog entries so `validate_model` reference checks pass
    /// (the wasm facade fills them from the embedded catalogs).
    fn with_catalog(mut structure: Structure) -> Structure {
        use rdm_model::{MaterialProperties, SectionProperties, SectionShape};
        structure.sections.insert(
            "IPE 200".to_owned(),
            SectionProperties {
                shape: SectionShape::DoubleSymmetricI,
                a: 2.848e-3,
                iy: 1.943e-5,
                iz: 1.424e-6,
                it: 6.846e-8,
                iw: Some(1.2746e-8),
                wel_y: 1.943e-4,
                wel_z: 2.847e-5,
                wpl_y: Some(2.206e-4),
                wpl_z: Some(4.461e-5),
                h: Some(0.2),
                b: Some(0.1),
                tw: Some(0.0056),
                tf: Some(0.0085),
                r: Some(0.012),
            },
        );
        structure.sections.insert(
            "IPE 140".to_owned(),
            SectionProperties {
                shape: SectionShape::DoubleSymmetricI,
                a: 1.643e-3,
                iy: 7.412e-6,
                iz: 5.393e-7,
                it: 2.323e-8,
                iw: Some(1.993e-9),
                wel_y: 1.059e-4,
                wel_z: 1.539e-5,
                wpl_y: Some(1.174e-4),
                wpl_z: Some(2.437e-5),
                h: Some(0.14),
                b: Some(0.073),
                tw: Some(0.0047),
                tf: Some(0.0069),
                r: Some(0.009),
            },
        );
        structure.materials.insert(
            "S235JR".to_owned(),
            MaterialProperties {
                e: 210e9,
                g: 81e9,
                nu: 0.3,
                rho: 7850.0,
                fy: 235e6,
                fu: 360e6,
            },
        );
        structure
    }

    #[test]
    fn warren_topology_is_complete_and_dense() {
        let structure = generate_structure(&params(ParametricTemplate::WarrenTruss, 24.0, 3.0, 4))
            .expect("warren");
        // 4 panels: 5 bottom + 4 top nodes.
        assert_eq!(structure.nodes.len(), 9);
        // 4 bottom chords + 3 top chords + 8 diagonals.
        assert_eq!(structure.beams.len(), 15);
        for (index, node) in structure.nodes.iter().enumerate() {
            assert_eq!(node.id, index as u32 + 1);
        }
        for (index, beam) in structure.beams.iter().enumerate() {
            assert_eq!(beam.id, index as u32 + 1);
        }
        assert_eq!(structure.supports.len(), 2);
        let last_bottom = &structure.nodes[4];
        assert_abs_diff_eq!(last_bottom.x, 24.0);
        // Top chord rises to the template height.
        assert_abs_diff_eq!(structure.nodes[5].z, 3.0);
    }

    #[test]
    fn portal_frame_topology_and_restraints() {
        let structure = generate_structure(&params(ParametricTemplate::PortalFrame, 18.0, 5.0, 2))
            .expect("portal");
        assert_eq!(structure.nodes.len(), 6);
        assert_eq!(structure.beams.len(), 5, "3 columns + 2 rafters");
        assert_eq!(structure.supports.len(), 3);
        // First base locks Rx (out-of-plane rigid rotation)…
        assert!(structure.supports[0].locked_dofs[3]);
        // …the other bases do not.
        assert!(!structure.supports[1].locked_dofs[3]);
        let max_x = structure.nodes.iter().fold(0.0f64, |m, n| m.max(n.x));
        assert_abs_diff_eq!(max_x, 18.0);
        assert_abs_diff_eq!(structure.nodes[3].z, 5.0);
    }

    #[test]
    fn cantilever_has_clamped_base_and_tie() {
        let structure = generate_structure(&params(ParametricTemplate::Cantilever, 6.0, 4.0, 3))
            .expect("cantilever");
        // base + column head + 3 boom points.
        assert_eq!(structure.nodes.len(), 5);
        // column + 3 boom segments + 1 tie.
        assert_eq!(structure.beams.len(), 5);
        assert!(structure.supports[0].locked_dofs.iter().all(|&l| l));
        // The tie is the articulated (truss) member.
        let tie = structure.beams.last().expect("tie");
        assert!(tie.releases_start[1] && tie.releases_end[1]);
        let tip = structure.nodes.iter().max_by(|a, b| a.x.total_cmp(&b.x));
        assert_abs_diff_eq!(tip.expect("tip").x, 6.0);
    }

    #[test]
    fn continuous_beam_spans_and_supports() {
        let structure =
            generate_structure(&params(ParametricTemplate::ContinuousBeam, 12.0, 0.0, 3))
                .expect("beam");
        assert_eq!(structure.nodes.len(), 4);
        assert_eq!(structure.beams.len(), 3);
        assert_eq!(structure.supports.len(), 4);
        // First support pins Rx (beam-line rotation about its own axis).
        assert!(structure.supports[0].locked_dofs[3]);
        let second = &structure.supports[1];
        assert!(second.locked_dofs[0], "second support locks Ux (fork)");
        let third = &structure.supports[2];
        assert!(!third.locked_dofs[0], "third support frees Ux (roller)");
    }

    #[test]
    fn generated_models_pass_pre_solve_validation() {
        for template in [
            ParametricTemplate::WarrenTruss,
            ParametricTemplate::PortalFrame,
            ParametricTemplate::Cantilever,
            ParametricTemplate::ContinuousBeam,
        ] {
            let structure =
                with_catalog(generate_structure(&params(template, 12.0, 3.0, 3)).expect("s"));
            let issues = rdm_model::validate_model(&structure);
            assert!(issues.is_ok(), "{template:?} must validate clean");
        }
    }

    #[test]
    fn invalid_parameters_are_rejected() {
        assert!(generate_structure(&params(ParametricTemplate::WarrenTruss, 0.0, 3.0, 4)).is_err());
        assert!(
            generate_structure(&params(ParametricTemplate::WarrenTruss, -1.0, 3.0, 4)).is_err()
        );
        assert!(
            generate_structure(&params(ParametricTemplate::WarrenTruss, 12.0, -2.0, 4)).is_err()
        );
        assert!(
            generate_structure(&params(ParametricTemplate::WarrenTruss, 12.0, 3.0, 0)).is_err()
        );
        assert!(
            generate_structure(&params(ParametricTemplate::WarrenTruss, 12.0, 3.0, 25)).is_err()
        );
        assert!(
            generate_structure(&params(ParametricTemplate::WarrenTruss, 12.0, 3.0, 24)).is_ok()
        );
    }
}
