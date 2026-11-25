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
use rdm_solver::{
    SolveError, SolvedModel, build_elements, span_loads_local, station_forces, superimpose,
    validate_and_solve, von_mises_grid,
};

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
    /// Resistance name of the governing check at the max utilization
    /// (v1.3.0), e.g. `Mb,Rd`, `Nb,Rd,z`, `Von Mises`.
    pub governing_check: String,
    /// Every individual check ratio at the governing station (v1.4.0):
    /// `NEd/Npl,Rd`, `Nb,Rd,y`, `Nb,Rd,z`, `Mb,Rd`, `Vpl,Rd`, `Von Mises`.
    pub checks: Vec<(String, f64)>,
    /// Governing cross-section class 1..=4 (v1.4.0, `None` = n/a).
    pub class_index: Option<u8>,
    /// Flexural buckling factor y (v1.4.0, `None` = tension/no check).
    pub chi_y: Option<f64>,
    /// Flexural buckling factor z (v1.4.0).
    pub chi_z: Option<f64>,
    /// LTB factor χLT (v1.4.0, `None` = laterally restrained).
    pub chi_lt: Option<f64>,
    /// Governing bending resistance (v1.4.0, N·m) — `Mb,Rd` under LTB,
    /// otherwise the elastic `Mel,Rd`, for the uPlot capacity line.
    pub m_rd: f64,
    /// Maximum von Mises stress over the span stations (v1.3.0, Pa).
    pub max_sigma_vm: f64,
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
    let elements = build_elements(structure)?;

    for combo in &combos {
        let (_u, _r, f) = superimpose(solved, &combo.multipliers)?;
        let mut beams = Vec::with_capacity(structure.beams.len());
        for (index, beam) in structure.beams.iter().enumerate() {
            let section = structure.sections.get(&beam.section_id);
            let material = structure.materials.get(&beam.material_id);
            let (
                utilization,
                deflection,
                governing_check,
                max_sigma_vm,
                checks,
                class_index,
                chi_y,
                chi_z,
                chi_lt,
                m_rd,
            ) = match (section, material) {
                (Some(section), Some(material)) => {
                    let length = beam_length(structure, beam).unwrap_or(0.0);
                    // v1.0.0 bug 3: evaluate the EN 1993-1-1 check at span
                    // stations [0, 0.25, 0.5, 0.75, 1] — end forces alone
                    // miss midspan sagging (PL/4, qL²/8). Span loads are
                    // superposed with the same combination weights.
                    let data = &elements[index];
                    let mut spans = rdm_solver::SpanLoads::default();
                    for (case, weight) in &combo.multipliers {
                        if *weight == 0.0 {
                            continue;
                        }
                        let case_spans = span_loads_local(structure, data, *case)?;
                        for &(a, fy, fz) in &case_spans.points {
                            spans.points.push((a, weight * fy, weight * fz));
                        }
                        for &(qy1, qy2, qz1, qz2) in &case_spans.trapezoids {
                            spans.trapezoids.push((
                                weight * qy1,
                                weight * qy2,
                                weight * qz1,
                                weight * qz2,
                            ));
                        }
                    }
                    let end = 12 * index;
                    let block = &f[end..end + 12];
                    let mut utilization = 0.0f64;
                    let mut governing_check = String::from("-");
                    let mut governing_detail: Option<rdm_eurocode::MemberCheck> = None;
                    let mut max_sigma_vm = 0.0f64;
                    for ratio in rdm_solver::STATIONS {
                        let forces = station_forces(block, &spans, length, ratio);
                        // v1.3.0: von Mises stress (Pa) at every station.
                        if let Ok(sigma_vm) = rdm_eurocode::von_mises_stress(
                            forces.n_axial,
                            forces.my,
                            forces.mz,
                            forces.vz,
                            forces.t,
                            section,
                        ) {
                            max_sigma_vm = max_sigma_vm.max(sigma_vm.abs());
                        }
                        let check = member_check(rdm_eurocode::MemberCheckInput {
                            beam_id: beam.id,
                            length,
                            k_buckling: (beam.k_buckling_y, beam.k_buckling_z),
                            section,
                            material,
                            forces: (forces.n_axial, forces.my, forces.mz, forces.vz, forces.t),
                            combination: combo.label(),
                        });
                        if let Ok(check) = check
                            && let Some((name, value)) =
                                check.utilizations.iter().max_by(|a, b| a.1.total_cmp(&b.1))
                            && *value > utilization
                        {
                            utilization = *value;
                            name.clone_into(&mut governing_check);
                            // v1.4.0: keep the whole check for the UI.
                            governing_detail = Some(check);
                        }
                    }
                    // v1.4.0: full EC3 detail from the governing station.
                    let (checks, class_index, chi_y, chi_z, chi_lt, m_rd) = match governing_detail {
                        Some(detail) => {
                            let m_rd_elastic = section.wel_y * material.fy / rdm_eurocode::GAMMA_M0;
                            let m_rd = detail.ltb.as_ref().map_or(m_rd_elastic, |ltb| ltb.m_b_rd);
                            (
                                detail.utilizations,
                                detail.class.map(rdm_eurocode::Classification::as_u8),
                                detail.chi.map(|chi| chi.0),
                                detail.chi.map(|chi| chi.1),
                                detail.ltb.as_ref().map(|ltb| ltb.chi_lt),
                                m_rd,
                            )
                        }
                        None => (Vec::new(), None, None, None, None, 0.0),
                    };
                    let deflection = rdm_solver::midspan_deflection_metric(
                        structure,
                        solved,
                        index,
                        &combo.multipliers,
                    )?;
                    (
                        utilization,
                        deflection,
                        governing_check,
                        max_sigma_vm,
                        checks,
                        class_index,
                        chi_y,
                        chi_z,
                        chi_lt,
                        m_rd,
                    )
                }
                _ => (
                    0.0,
                    0.0,
                    String::from("-"),
                    0.0,
                    Vec::new(),
                    None,
                    None,
                    None,
                    None,
                    0.0,
                ),
            };
            beams.push(BeamCombinationResult {
                beam_id: beam.id,
                utilization,
                governing_check,
                checks,
                class_index,
                chi_y,
                chi_z,
                chi_lt,
                m_rd,
                max_sigma_vm,
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
// Modal + section-cut engines (v1.0.0)
// --------------------------------------------------------------------------

/// Serializable modal DTO (solver types stay serde-free).
#[derive(Debug, Clone, Serialize)]
pub struct ModeShapeDto {
    /// 1-based mode index.
    pub mode_index: usize,
    /// Natural frequency (Hz).
    pub frequency_hz: f64,
    /// Circular frequency (rad/s).
    pub omega: f64,
    /// Global modal displacements `[6n]`.
    pub displacements: Vec<f64>,
}

/// Serializable modal report.
#[derive(Debug, Clone, Serialize)]
pub struct ModalReportDto {
    /// Number of extracted modes.
    pub n_modes: usize,
    /// Modes, ascending frequency.
    pub modes: Vec<ModeShapeDto>,
}

/// Serializable stress point.
#[derive(Debug, Clone, Serialize)]
pub struct StressPointDto {
    /// Local horizontal coordinate (m).
    pub y: f64,
    /// Local vertical coordinate (m).
    pub z: f64,
    /// Von Mises equivalent stress (Pa).
    pub sigma_vm: f64,
}

/// Serializable cross-section stress grid.
#[derive(Debug, Clone, Serialize)]
pub struct StressGridDto {
    /// Section extremes `(y0, y1, z0, z1)` in m.
    pub bounds: (f64, f64, f64, f64),
    /// Grid points.
    pub points: Vec<StressPointDto>,
}

/// Combination weights for the requested kind (`ULS`/`SLS`).
fn combination_weights(solved: &SolvedModel, kind: &str) -> Option<Vec<(LoadCase, f64)>> {
    let present: Vec<LoadCase> = solved.cases.iter().map(|(c, _)| *c).collect();
    let combos = build_combinations(&present, &Factors::default());
    combos
        .iter()
        .find(|c| c.kind.code() == kind)
        .map(|c| c.multipliers.clone())
}

// --------------------------------------------------------------------------
// wasm_bindgen wrappers
// --------------------------------------------------------------------------

/// Serializable section outline metadata for the 3D extrusion (bug 2).
#[derive(Debug, Clone, Serialize)]
pub struct SectionShapeDto {
    /// Profile designation (`IPE 200`, ...).
    pub designation: String,
    /// Shape family name (`DoubleSymmetricI`, ...).
    pub shape: String,
    /// Overall depth h (m).
    pub h: Option<f64>,
    /// Flange width b (m).
    pub b: Option<f64>,
    /// Web thickness tw (m).
    pub tw: Option<f64>,
    /// Flange thickness tf (m).
    pub tf: Option<f64>,
}

/// Lists every profile with its true SI outline dimensions (bug 2: real
/// extruded profiles instead of 80 mm square boxes).
///
/// # Errors
///
/// Returns a `JsValue` fault when serialization fails.
#[wasm_bindgen]
pub fn catalog_section_shapes() -> Result<JsValue, JsValue> {
    let profiles = rdm_eurocode::profile_catalog();
    let shapes: Vec<SectionShapeDto> = profiles
        .designations()
        .into_iter()
        .filter_map(|d| {
            let props = profiles.properties(d).ok()?;
            Some(SectionShapeDto {
                designation: d.to_owned(),
                shape: format!("{:?}", props.shape),
                h: props.h,
                b: props.b,
                tw: props.tw,
                tf: props.tf,
            })
        })
        .collect();
    serde_wasm_bindgen::to_value(&shapes).map_err(Into::into)
}

/// Serializable EN 10365 properties for the Step 1 inspector.
#[derive(Debug, Clone, Serialize)]
pub struct SectionPropertiesDto {
    /// Profile designation.
    pub designation: String,
    /// Area A (m²).
    pub a: f64,
    /// Strong-axis second moment Iy (m⁴).
    pub iy: f64,
    /// Weak-axis second moment Iz (m⁴).
    pub iz: f64,
    /// St-Venant torsion constant It (m⁴).
    pub it: f64,
    /// Warping constant Iw (m⁶, optional).
    pub iw: Option<f64>,
    /// Elastic strong-axis modulus Wely (m³).
    pub wel_y: f64,
    /// Plastic strong-axis modulus Wply (m³, optional).
    pub wpl_y: Option<f64>,
    /// Linear mass (kg/m).
    pub mass_per_m: f64,
}

/// Full catalog properties of one designation (EN 10365 inspector row).
///
/// # Errors
///
/// Returns a `JsValue` fault when the designation is unknown or
/// serialization fails.
#[wasm_bindgen]
pub fn catalog_section_properties(designation: &str) -> Result<JsValue, JsValue> {
    let profiles = rdm_eurocode::profile_catalog();
    let outcome = (|| {
        let props = profiles
            .properties(designation)
            .map_err(|e| e.to_string())?;
        let mass_per_m = props.a * 7850.0;
        Ok(SectionPropertiesDto {
            designation: designation.to_owned(),
            a: props.a,
            iy: props.iy,
            iz: props.iz,
            it: props.it,
            iw: props.iw,
            wel_y: props.wel_y,
            wpl_y: props.wpl_y,
            mass_per_m,
        })
    })();
    match outcome {
        Ok(dto) => serde_wasm_bindgen::to_value(&dto).map_err(Into::into),
        Err(message) => serde_wasm_bindgen::to_value(&SolveFault {
            kind: "Catalog".to_owned(),
            message,
        })
        .map_err(Into::into),
    }
}

/// Serializable internal forces at one span station.
#[derive(Debug, Clone, Serialize)]
pub struct SpanForcesDto {
    /// Ratio along the member (0..1).
    pub ratio: f64,
    /// Axial force N (N).
    pub n: f64,
    /// Bending My (N·m).
    pub my: f64,
    /// Bending Mz (N·m).
    pub mz: f64,
    /// Shear Vz (N).
    pub vz: f64,
}

/// n-point internal-force sampling of one member under a combination
/// (Step 4 docked diagrams).
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on invalid inputs.
#[wasm_bindgen]
pub fn beam_span_forces(
    project_json: &str,
    beam_id: u32,
    combo_kind: &str,
    n_ratios: usize,
) -> Result<JsValue, JsValue> {
    let outcome = (|| -> Result<Vec<SpanForcesDto>, SolveError> {
        let project: rdm_model::ProjectFile =
            serde_json::from_str(project_json).map_err(|e| SolveError::InvalidModel {
                message: format!("malformed .rdm payload: {e}"),
            })?;
        let mut structure = project.structure;
        resolve_properties(&mut structure);
        let solved = validate_and_solve(&structure)?;
        let index =
            structure
                .beams
                .iter()
                .position(|b| b.id == beam_id)
                .ok_or(SolveError::Sparse {
                    message: format!("unknown beam id {beam_id}"),
                })?;
        let weights = combination_weights(&solved, combo_kind).ok_or(SolveError::Sparse {
            message: format!("unknown combination kind {combo_kind}"),
        })?;
        let state = rdm_solver::superimposed_beam_state(&structure, &solved, &weights, index)?;
        let n = n_ratios.max(2);
        let stations = rdm_solver::beam_forces_at(&state, n).map_err(SolveError::Load)?;
        Ok(stations
            .iter()
            .map(|(a, f)| SpanForcesDto {
                ratio: *a,
                n: f.n_axial,
                my: f.my,
                mz: f.mz,
                vz: f.vz,
            })
            .collect())
    })();
    match outcome {
        Ok(dtos) => serde_wasm_bindgen::to_value(&dtos).map_err(Into::into),
        Err(err) => {
            let fault: SolveFault = SolveFault::from(&err);
            serde_wasm_bindgen::to_value(&fault).map_err(Into::into)
        }
    }
}

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

    /// v1.4.0: the combination result exposes every individual EC3
    /// ratio, the buckling factors and the governing bending resistance.
    #[test]
    fn combination_result_exposes_full_ec3_detail() {
        let report = build_solve_report(&demo_project()).unwrap();
        let uls = report
            .combinations
            .iter()
            .find(|c| c.kind == "ULS")
            .expect("ULS combination present");
        let beam = &uls.beams[0];
        assert!(!beam.checks.is_empty(), "checks must list every ratio");
        assert!(
            beam.checks.iter().any(|(name, _)| name == "NEd/Npl,Rd"),
            "axial ratio present, got {:?}",
            beam.checks
        );
        assert!(beam.utilization > 0.0);
        assert_ne!(beam.governing_check, "-");
        assert!(beam.m_rd > 0.0, "governing bending resistance > 0");
    }

    /// v1.4.0: the canonical SHA-256 fingerprint is a 64-char hex string.
    #[test]
    fn project_fingerprint_returns_64_char_hex() {
        let text = project_fingerprint_structure(&demo_project()).expect("fingerprint");
        assert_eq!(text.len(), 64, "sha-256 hex length, got {text}");
        assert!(
            text.chars().all(|c| c.is_ascii_hexdigit()),
            "hex alphabet only: {text}"
        );
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

/// Natural frequencies and mode shapes (v1.0.0 Step 4 KPI 4 + modal table).
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on invalid models or solver
/// failure.
#[wasm_bindgen]
pub fn modal_analysis(project_json: &str, n_modes: usize) -> Result<JsValue, JsValue> {
    let outcome = (|| -> Result<ModalReportDto, SolveError> {
        let project: rdm_model::ProjectFile =
            serde_json::from_str(project_json).map_err(|e| SolveError::InvalidModel {
                message: format!("malformed .rdm payload: {e}"),
            })?;
        let mut structure = project.structure;
        resolve_properties(&mut structure);
        let _solved = validate_and_solve(&structure)?;
        // v1.3.0: clean exposure of up to 6 eigenmodes (clamp the request).
        let report = rdm_solver::modal_analysis(&structure, n_modes.clamp(1, 6)).map_err(|e| {
            SolveError::Sparse {
                message: e.to_string(),
            }
        })?;
        Ok(ModalReportDto {
            n_modes: report.n_modes,
            modes: report
                .modes
                .iter()
                .map(|m| ModeShapeDto {
                    mode_index: m.mode_index,
                    frequency_hz: m.frequency_hz,
                    omega: m.omega,
                    displacements: m.displacements.clone(),
                })
                .collect(),
        })
    })();
    match outcome {
        Ok(dto) => serde_wasm_bindgen::to_value(&dto).map_err(Into::into),
        Err(err) => {
            let fault: SolveFault = SolveFault::from(&err);
            serde_wasm_bindgen::to_value(&fault).map_err(Into::into)
        }
    }
}

/// `sigma_vM(y, z)` cross-section grid at one span station (Step 4 heatmap).
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on invalid inputs.
#[wasm_bindgen]
pub fn section_stress_grid(
    project_json: &str,
    beam_id: u32,
    combo_kind: &str,
    ratio: f64,
    grid_n: usize,
) -> Result<JsValue, JsValue> {
    let outcome = (|| -> Result<StressGridDto, SolveError> {
        let project: rdm_model::ProjectFile =
            serde_json::from_str(project_json).map_err(|e| SolveError::InvalidModel {
                message: format!("malformed .rdm payload: {e}"),
            })?;
        let mut structure = project.structure;
        resolve_properties(&mut structure);
        let solved = validate_and_solve(&structure)?;
        let index =
            structure
                .beams
                .iter()
                .position(|b| b.id == beam_id)
                .ok_or(SolveError::Sparse {
                    message: format!("unknown beam id {beam_id}"),
                })?;
        let weights = combination_weights(&solved, combo_kind).ok_or({
            SolveError::Sparse {
                message: format!("unknown combination kind {combo_kind}"),
            }
        })?;
        let state = rdm_solver::superimposed_beam_state(&structure, &solved, &weights, index)?;
        let beam = &structure.beams[index];
        let section = structure.sections.get(&beam.section_id).ok_or({
            SolveError::Sparse {
                message: format!("unknown section {}", beam.section_id),
            }
        })?;
        let length = beam_length(&structure, beam).unwrap_or(1.0);
        let forces = rdm_solver::station_forces(&state.end_forces, &state.spans, length, ratio);
        let grid = von_mises_grid(section, forces, grid_n);
        Ok(StressGridDto {
            bounds: grid.bounds,
            points: grid
                .points
                .iter()
                .map(|p| StressPointDto {
                    y: p.y,
                    z: p.z,
                    sigma_vm: p.sigma_vm,
                })
                .collect(),
        })
    })();
    match outcome {
        Ok(dto) => serde_wasm_bindgen::to_value(&dto).map_err(Into::into),
        Err(err) => {
            let fault: SolveFault = SolveFault::from(&err);
            serde_wasm_bindgen::to_value(&fault).map_err(Into::into)
        }
    }
}

/// Imports a DXF drawing as a fresh `.rdm` model (v1.0.0 Step 1 CAD modal):
/// `LINE` / polyline entities become members, coincident nodes merge within
/// a 1 mm tolerance and T/X intersections split. Every member gets the
/// default `IPE 200` / `S235JR` designation; the user refines afterwards.
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on parse or topology failure.
#[wasm_bindgen]
pub fn import_dxf(bytes: &[u8], project_name: &str) -> Result<JsValue, JsValue> {
    let outcome = import_cad_structure(bytes, "import.dxf", project_name);
    match outcome {
        Ok(json) => serde_wasm_bindgen::to_value(&json).map_err(Into::into),
        Err(message) => serde_wasm_bindgen::to_value(&SolveFault {
            kind: "Cad".to_owned(),
            message,
        })
        .map_err(Into::into),
    }
}

/// Imports a `.dxf`, `.step`/`.stp` or `.igs`/`.iges` wireframe as a
/// `.rdm` project JSON (v1.3.0): extension-dispatched CAD import with
/// dense sequential 1-based member ids.
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on unsupported extensions,
/// parse failures or empty topologies.
#[wasm_bindgen]
pub fn import_cad(bytes: &[u8], filename: &str, project_name: &str) -> Result<JsValue, JsValue> {
    let outcome = import_cad_structure(bytes, filename, project_name);
    match outcome {
        Ok(json) => serde_wasm_bindgen::to_value(&json).map_err(Into::into),
        Err(message) => serde_wasm_bindgen::to_value(&SolveFault {
            kind: "Cad".to_owned(),
            message,
        })
        .map_err(Into::into),
    }
}

/// Pure fingerprint helper behind [`project_fingerprint`] (native-testable).
///
/// # Errors
///
/// Returns a message string on malformed payloads or canonicalization
/// failures.
fn project_fingerprint_structure(project_json: &str) -> Result<String, String> {
    let project: rdm_model::ProjectFile =
        serde_json::from_str(project_json).map_err(|e| format!("malformed .rdm payload: {e}"))?;
    project.fingerprint().map_err(|e| e.to_string())
}

/// Deterministic SHA-256 fingerprint of the canonical `.rdm`
/// serialization (v1.4.0): surfaces on the Step 5 A4 sheet and the
/// Takumi PDF so every printed note carries a verifiable model hash.
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on malformed payloads.
#[wasm_bindgen]
pub fn project_fingerprint(project_json: &str) -> Result<JsValue, JsValue> {
    let outcome = project_fingerprint_structure(project_json);
    match outcome {
        Ok(hash) => serde_wasm_bindgen::to_value(&hash).map_err(Into::into),
        Err(message) => serde_wasm_bindgen::to_value(&SolveFault {
            kind: "InvalidModel".to_owned(),
            message,
        })
        .map_err(Into::into),
    }
}

/// Pure CAD -> `.rdm` import used by [`import_cad`] / [`import_dxf`]
/// (testable off-wasm). Dispatches on the filename extension.
///
/// # Errors
///
/// Returns a message string on parse or topology failure.
fn import_cad_structure(
    bytes: &[u8],
    filename: &str,
    project_name: &str,
) -> Result<String, String> {
    let segments = rdm_cad::import_cad(bytes, filename).map_err(|e| e.to_string())?;
    let topology = rdm_cad::clean_topology(&segments, 1e-3).map_err(|e| e.to_string())?;
    let nodes: Vec<rdm_model::Node> = topology
        .nodes
        .iter()
        .map(|n| rdm_model::Node::new(n.id, n.position[0], n.position[1], n.position[2]))
        .collect();
    // v1.1.0 bug 1: dense sequential 1-based member ids (the previous
    // `n1.max(n2)` colliding id scheme silently dropped members).
    let beams: Vec<rdm_model::Beam> = topology
        .beams
        .iter()
        .enumerate()
        .map(|(idx, b)| rdm_model::Beam::frame((idx + 1) as u32, b.n1, b.n2, "IPE 200", "S235JR"))
        .collect();
    let structure = rdm_model::Structure {
        nodes,
        beams,
        supports: Vec::new(),
        loads: Vec::new(),
        sections: BTreeMap::new(),
        materials: BTreeMap::new(),
        self_weight_enabled: true,
    };
    let project = rdm_model::ProjectFile {
        version: 1,
        name: project_name.to_owned(),
        structure,
    };
    serde_json::to_string(&project).map_err(|e| e.to_string())
}

#[cfg(test)]
mod dxf_import_tests {
    use super::*;

    const TWO_BEAM_DXF: &str = "0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nRDM\n10\n0.0\n11\n4.0\n20\n0.0\n21\n0.0\n30\n0.0\n31\n0.0\n0\nLINE\n8\nRDM\n10\n4.0\n11\n4.0\n20\n0.0\n21\n0.0\n30\n0.0\n31\n3.0\n0\nENDSEC\n0\nEOF\n";

    #[test]
    fn import_dxf_assigns_sequential_distinct_beam_ids() {
        let json =
            import_cad_structure(TWO_BEAM_DXF.as_bytes(), "plan.dxf", "plan").expect("import");
        let project: rdm_model::ProjectFile = serde_json::from_str(&json).expect("parse");
        let ids: Vec<u32> = project.structure.beams.iter().map(|b| b.id).collect();
        assert_eq!(project.structure.beams.len(), 2);
        assert_eq!(ids, vec![1, 2], "ids must be dense 1..n, got {ids:?}");
    }

    #[test]
    fn import_dxf_rejects_garbage() {
        assert!(import_cad_structure(b"junk", "junk.dxf", "x").is_err());
    }
}
