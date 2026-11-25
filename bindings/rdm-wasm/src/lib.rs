//! WASM facade of the RDM Studio core (ARCHITECTURE.md §5, `bindings/rdm-wasm`).
//!
//! The worker calls:
//! - [`catalog_sections`] / [`catalog_materials`] for the UI pickers,
//! - [`solve`] which validates the `.rdm` JSON model, solves every
//!   elementary case through the sparse Cholesky and returns a typed report
//!   (per-case displacements/reactions/end forces + ULS/SLS combinations
//!   with Eurocode 3 utilizations).
//!
//! Zero-copy buffers live in [`buffers`]; the report payload itself uses
//! `serde-wasm-bindgen` (structured pass-through, §2.2).

pub mod buffers;

use std::collections::BTreeMap;

use serde::Serialize;
use wasm_bindgen::prelude::*;

use rdm_eurocode::{Factors, build_combinations, member_check};
use rdm_model::{LoadCase, MaterialProperties, SectionProperties, Structure};
use rdm_solver::{SolveError, SolvedModel, superimpose, validate_and_solve};

/// One case of the solve report (flat arrays, SI units).
#[derive(Debug, Clone, Serialize)]
pub struct CaseReport {
    /// Elementary case code (`G`, `Q`, `W`, `S`, `Acc`).
    pub code: String,
    /// Global displacements `[6n]` (m / rad).
    pub displacements: Vec<f64>,
    /// Support reactions `[6n]` (N / N·m).
    pub reactions: Vec<f64>,
    /// Local beam end forces `[12m]` (N / N·m).
    pub beam_end_forces: Vec<f64>,
}

/// Combination-level result for one beam.
#[derive(Debug, Clone, Serialize)]
pub struct BeamCombinationResult {
    /// Beam id.
    pub beam_id: u32,
    /// Maximum EN 1993-1-1 utilization of the member (0.0 when no check applies).
    pub utilization: f64,
    /// Midspan elastic deflection proxy: local transverse deflection at the
    /// span middle, in metres (unsigned).
    pub midspan_deflection: f64,
}

/// One ULS/SLS combination result.
#[derive(Debug, Clone, Serialize)]
pub struct CombinationReport {
    /// `ULS` or `SLS`.
    pub kind: String,
    /// Human-readable superposition, e.g. `1.35G + 1.50Q`.
    pub label: String,
    /// Per-beam results, aligned with the model beam order.
    pub beams: Vec<BeamCombinationResult>,
}

/// Complete typed report returned to the worker.
#[derive(Debug, Clone, Serialize)]
pub struct SolveReport {
    /// Node count of the solved model.
    pub n_nodes: usize,
    /// Beam count of the solved model.
    pub n_beams: usize,
    /// One entry per solved elementary case.
    pub cases: Vec<CaseReport>,
    /// ULS/SLS superpositions with Eurocode checks.
    pub combinations: Vec<CombinationReport>,
}

/// Summary of one profile designation for the UI pickers.
#[derive(Debug, Clone, Serialize)]
pub struct SectionSummary {
    /// EN designation (e.g. `IPE 200`, `CHS 114.3x6`).
    pub designation: String,
    /// Series family (`IPE`, `HEA`, ...).
    pub family: String,
    /// Governing standard (e.g. `EN 10365`).
    pub standard: String,
}

/// Model errors surfaced to JS.
#[derive(Debug, Clone, Serialize)]
pub struct SolveFault {
    /// Machine-readable kind (`invalid_model`, `mechanism`, `sparse`...).
    pub kind: String,
    /// Pedagogical message (EN).
    pub message: String,
}

impl From<&SolveError> for SolveFault {
    fn from(err: &SolveError) -> Self {
        let (kind, message) = match err {
            SolveError::InvalidModel { message } => ("invalid_model", message.clone()),
            SolveError::UnstableMechanism { message } => ("mechanism", message.clone()),
            SolveError::Load(err) => ("load", err.to_string()),
            SolveError::Sparse { message } => ("sparse", message.clone()),
        };
        Self {
            kind: kind.to_owned(),
            message,
        }
    }
}

/// Resolves the section/material tables of a structure from the embedded
/// catalogs (mutates `sections`/`materials` only when a designation is
/// known; unknown ids stay and validation reports them).
pub fn resolve_properties(structure: &mut Structure) {
    let profiles = rdm_eurocode::profile_catalog();
    let materials = rdm_eurocode::material_catalog();
    let mut sections: BTreeMap<String, SectionProperties> = BTreeMap::new();
    for beam in &structure.beams {
        if let Ok(props) = profiles.properties(&beam.section_id) {
            sections.insert(beam.section_id.clone(), props);
        }
    }
    let mut mats: BTreeMap<String, MaterialProperties> = BTreeMap::new();
    for beam in &structure.beams {
        if let Ok(props) = materials.properties(&beam.material_id) {
            mats.insert(beam.material_id.clone(), props);
        }
    }
    structure.sections.extend(sections);
    structure.materials.extend(mats);
}

/// Builds the full report (validation + solve + combinations + EC3 checks).
///
/// # Errors
///
/// Returns [`SolveError`] when validation, assembly, factorization or the
/// normative checks fail.
pub fn build_solve_report(project_json: &str) -> Result<SolveReport, SolveError> {
    let project: rdm_model::ProjectFile =
        serde_json::from_str(project_json).map_err(|e| SolveError::InvalidModel {
            message: format!("malformed .rdm payload: {e}"),
        })?;
    let mut structure = project.structure;
    resolve_properties(&mut structure);
    let solved = validate_and_solve(&structure)?;

    let mut cases = Vec::new();
    for (case, solution) in &solved.cases {
        cases.push(CaseReport {
            code: case.code().to_owned(),
            displacements: solution.displacements.clone(),
            reactions: solution.reactions.clone(),
            beam_end_forces: solution.beam_end_forces.clone(),
        });
    }

    let combinations = build_combination_reports(&structure, &solved)?;
    Ok(SolveReport {
        n_nodes: solved.n_nodes,
        n_beams: solved.n_beams,
        cases,
        combinations,
    })
}

fn build_combination_reports(
    structure: &Structure,
    solved: &SolvedModel,
) -> Result<Vec<CombinationReport>, SolveError> {
    let present: Vec<LoadCase> = solved.cases.iter().map(|(c, _)| *c).collect();
    let combos = build_combinations(&present, &Factors::default());
    let mut reports = Vec::new();

    for combo in &combos {
        let (_u, _r, f) = superimpose(solved, &combo.multipliers)?;
        let mut beams = Vec::with_capacity(structure.beams.len());
        for (index, beam) in structure.beams.iter().enumerate() {
            let section = structure.sections.get(&beam.section_id);
            let material = structure.materials.get(&beam.material_id);
            let (utilization, deflection) = match (section, material) {
                (Some(section), Some(material)) => {
                    let length = beam_length(structure, beam).unwrap_or(0.0);
                    // Local end forces layout: [ux uy uz rx ry rz] * 2 nodes.
                    let end = 12 * index;
                    let n_ed = f[end];
                    let my_ed = f[end + 4];
                    let mz_ed = f[end + 5];
                    let vz_ed = f[end + 2];
                    let t_ed = f[end + 3];
                    let check = member_check(rdm_eurocode::MemberCheckInput {
                        beam_id: beam.id,
                        length,
                        k_buckling: (beam.k_buckling_y, beam.k_buckling_z),
                        section,
                        material,
                        forces: (n_ed, my_ed, mz_ed, vz_ed, t_ed),
                        combination: combo.label(),
                    });
                    let utilization = match check {
                        Ok(check) => check
                            .utilizations
                            .iter()
                            .map(|(_, v)| *v)
                            .fold(0.0f64, f64::max),
                        Err(_) => 0.0,
                    };
                    let deflection = rdm_solver::midspan_deflection_metric(
                        structure,
                        solved,
                        index,
                        &combo.multipliers,
                    )?;
                    (utilization, deflection)
                }
                _ => (0.0, 0.0),
            };
            beams.push(BeamCombinationResult {
                beam_id: beam.id,
                utilization,
                midspan_deflection: deflection,
            });
        }
        reports.push(CombinationReport {
            kind: combo.kind.code().to_owned(),
            label: combo.label(),
            beams,
        });
    }
    Ok(reports)
}

fn beam_length(structure: &Structure, beam: &rdm_model::Beam) -> Option<f64> {
    let n1 = structure.node(beam.n1).ok()?;
    let n2 = structure.node(beam.n2).ok()?;
    Some(((n2.x - n1.x).powi(2) + (n2.y - n1.y).powi(2) + (n2.z - n1.z).powi(2)).sqrt())
}

// --------------------------------------------------------------------------
// wasm_bindgen wrappers
// --------------------------------------------------------------------------

/// Lists every profile designation of the embedded catalogs.
///
/// # Errors
///
/// Returns a [`JsValue`] fault when serialization fails.
#[wasm_bindgen]
pub fn catalog_sections() -> Result<JsValue, JsValue> {
    let profiles = rdm_eurocode::profile_catalog();
    let summaries: Vec<SectionSummary> = profiles
        .designations()
        .iter()
        .filter_map(|d| {
            profiles.entry(d).ok().map(|entry| SectionSummary {
                designation: entry.designation.clone(),
                family: format!("{:?}", entry.family),
                standard: entry.family.standard().to_owned(),
            })
        })
        .collect();
    serde_wasm_bindgen::to_value(&summaries).map_err(Into::into)
}

/// Lists every material designation of the embedded catalog.
///
/// # Errors
///
/// Returns a [`JsValue`] fault when serialization fails.
#[wasm_bindgen]
pub fn catalog_materials() -> Result<JsValue, JsValue> {
    let materials = rdm_eurocode::material_catalog();
    serde_wasm_bindgen::to_value(&materials.designations()).map_err(Into::into)
}

/// Solves the `.rdm` JSON project and returns the typed report.
///
/// # Errors
///
/// Returns a serialized [`SolveFault`] on any model, solve or check failure.
#[wasm_bindgen]
pub fn solve(project_json: &str) -> Result<JsValue, JsValue> {
    match build_solve_report(project_json) {
        Ok(report) => serde_wasm_bindgen::to_value(&report).map_err(Into::into),
        Err(err) => {
            let fault: SolveFault = SolveFault::from(&err);
            serde_wasm_bindgen::to_value(&fault).map_err(Into::into)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;
    use rdm_model::{Beam, Node, Support};

    fn demo_project() -> String {
        // Simply supported IPE 200 beam, 4 m, point load 10 kN at midspan.
        let mut s = Structure::default();
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.beams.push(Beam::frame(1, 1, 2, "IPE 200", "S235JR"));
        // Pin + torsional restraint (prevents free spin about the axis).
        s.supports.push(Support {
            node_id: 1,
            locked_dofs: [true, true, true, true, false, false],
            spring_stiffness: [0.0; 6],
        });
        // Fork support at node 2: Uy+Uz (restrains the yaw rigid mode).
        s.supports.push(Support {
            node_id: 2,
            locked_dofs: [false, true, true, false, false, false],
            spring_stiffness: [0.0; 6],
        });
        s.loads.push(rdm_model::Load {
            case: LoadCase::Variable,
            kind: rdm_model::LoadKind::PointOnSpan {
                beam_id: 1,
                position_ratio: 0.5,
                forces: rdm_model::GlobalForces::vertical(-10_000.0),
            },
        });
        serde_json::to_string(&rdm_model::ProjectFile::new("demo", s)).unwrap()
    }

    #[test]
    fn report_contains_cases_and_combinations() {
        let report = build_solve_report(&demo_project()).unwrap();
        assert_eq!(report.n_nodes, 2);
        assert_eq!(report.n_beams, 1);
        assert!(report.cases.iter().any(|c| c.code == "G"));
        assert!(report.cases.iter().any(|c| c.code == "Q"));
        let uls = report
            .combinations
            .iter()
            .find(|c| c.kind == "ULS")
            .expect("ULS combination present");
        assert_eq!(uls.label, "1.35G + 1.50Q");
        let beam = &uls.beams[0];
        assert!(beam.utilization > 0.0);
    }

    #[test]
    fn midspan_deflection_matches_analytical_value() {
        let report = build_solve_report(&demo_project()).unwrap();
        let sls = report
            .combinations
            .iter()
            .find(|c| c.kind == "SLS")
            .unwrap();
        // SLS = G + Q: midspan point load + self-weight UDL.
        // Point load: P L^3 / 48 E I; self-weight: 5 (rho A g) L^4 / 384 E I.
        let q_self = 7850.0 * 2.848e-3 * 9.80665;
        let expected = 10_000.0 * 64.0 / (48.0 * 210e9 * 1.943e-5)
            + 5.0 * q_self * 256.0 / (384.0 * 210e9 * 1.943e-5);
        assert_relative_eq!(sls.beams[0].midspan_deflection, expected, epsilon = 1e-9);
    }

    #[test]
    fn malformed_json_is_a_clean_fault() {
        let err = build_solve_report("nope").unwrap_err();
        let fault = SolveFault::from(&err);
        assert_eq!(fault.kind, "invalid_model");
        assert!(fault.message.contains("malformed"));
    }

    #[test]
    fn resolve_properties_fills_catalog_entries() {
        let project: rdm_model::ProjectFile = serde_json::from_str(&demo_project()).unwrap();
        let mut structure = project.structure;
        assert!(structure.sections.is_empty());
        resolve_properties(&mut structure);
        assert!(structure.sections.contains_key("IPE 200"));
        assert!(structure.materials.contains_key("S235JR"));
    }
}
