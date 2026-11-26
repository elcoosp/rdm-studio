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
    /// Plastic axial resistance `Npl,Rd` (v1.6.0, N) at the governing station.
    pub n_pl_rd: f64,
    /// Plastic shear resistance `Vpl,Rd` (v1.6.0, N) at the governing station.
    pub v_pl_rd: f64,
    /// Elastic critical LTB moment `Mcr` (v1.6.0, N·m) when the check applies.
    pub m_cr: Option<f64>,
    /// Non-dimensional LTB slenderness `λLT` (v1.6.0) when the check applies.
    pub lambda_lt: Option<f64>,
    /// Member length (v1.6.0, m) for the SLS allowance readouts.
    pub length: f64,
}

/// One ULS/SLS combination result.
#[derive(Debug, Clone, Serialize)]
pub struct CombinationReport {
    /// `ULS` or `SLS`.
    pub kind: String,
    /// Human-readable superposition, e.g. `1.35G + 1.50Q`.
    pub label: String,
    /// (v1.6.0) Elementary-case multipliers of this combination
    /// (`("G", 1.35)`, `("Q", 1.50)`, ...) so Step 5 superposes the exact
    /// ELU reactions across every case instead of a hardcoded 1.35/1.50.
    pub multipliers: Vec<(String, f64)>,
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
        let multipliers: Vec<(String, f64)> = combo
            .multipliers
            .iter()
            .map(|(case, factor)| (case.code().to_owned(), *factor))
            .collect();
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
                n_pl_rd,
                v_pl_rd,
                m_cr,
                lambda_lt,
                length,
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
                        // v2.0.0: true moment gradient ψ from the two end
                        // moments of the superposed block (clamped to the
                        // Table 6.3 domain); the annex comes from the model
                        // settings. The end-force block layout is
                        // `[N, Vy, Vz, T, My, Mz] × (start, end)`.
                        let my_start = block[4];
                        let my_end = block[10];
                        let psi = if my_start.abs() > 1e-9 {
                            (my_end / my_start).clamp(-1.0, 1.0)
                        } else {
                            1.0
                        };
                        let check = member_check(rdm_eurocode::MemberCheckInput {
                            beam_id: beam.id,
                            length,
                            k_buckling: (beam.k_buckling_y, beam.k_buckling_z),
                            section,
                            material,
                            forces: (forces.n_axial, forces.my, forces.mz, forces.vz, forces.t),
                            moment_ratio_psi: psi,
                            national_annex: structure.settings.national_annex,
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
                    let (
                        checks,
                        class_index,
                        chi_y,
                        chi_z,
                        chi_lt,
                        m_rd,
                        n_pl_rd,
                        v_pl_rd,
                        m_cr,
                        lambda_lt,
                    ) = match governing_detail {
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
                                detail.n_pl_rd,
                                detail.v_pl_rd,
                                detail.ltb.as_ref().map(|ltb| ltb.m_cr),
                                detail.ltb.as_ref().map(|ltb| ltb.lambda_lt),
                            )
                        }
                        None => (
                            Vec::new(),
                            None,
                            None,
                            None,
                            None,
                            0.0,
                            0.0,
                            0.0,
                            None,
                            None,
                        ),
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
                        n_pl_rd,
                        v_pl_rd,
                        m_cr,
                        lambda_lt,
                        length,
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
                    0.0,
                    0.0,
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
                n_pl_rd,
                v_pl_rd,
                m_cr,
                lambda_lt,
                length,
            });
        }
        reports.push(CombinationReport {
            kind: combo.kind.code().to_owned(),
            label: combo.label(),
            multipliers,
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
    /// Cross-sectional area A (v1.6.0, m²) so `computeModelMassKg` uses the
    /// exact catalog area with zero extra worker roundtrips.
    pub a: f64,
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
                a: props.a,
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
    /// Torsional moment T (v1.6.0, N·m) — the 5th uPlot curve.
    pub t: f64,
}

// --------------------------------------------------------------------------
// v1.6.0 solve cache: the last (project_json, solved model) pair is kept
// alive in a thread-local slot so `section_stress_grid` / `beam_span_forces`
// reuse the already-factorized Cholesky while scrubbing x ∈ [0, L] — the
// 40-IPC waterfall (validate + assemble + factorize on EVERY scrub frame)
// collapses to a plain struct clone of the DTOs (< 0.05 ms per call).
// --------------------------------------------------------------------------

thread_local! {
    static SOLVE_CACHE: std::cell::RefCell<Option<(String, std::rc::Rc<SolvedModel>)>> =
        const { std::cell::RefCell::new(None) };
}

/// Solves `project_json` through the one-entry factorization cache.
///
/// # Errors
///
/// Propagates [`SolveError`] when parsing, validation or factorization
/// fails.
fn cached_solved_model(project_json: &str) -> Result<std::rc::Rc<SolvedModel>, SolveError> {
    SOLVE_CACHE.with(|cell| {
        let mut slot = cell.borrow_mut();
        if let Some((key, solved)) = slot.as_ref()
            && key == project_json
        {
            return Ok(std::rc::Rc::clone(solved));
        }
        let project: rdm_model::ProjectFile =
            serde_json::from_str(project_json).map_err(|e| SolveError::InvalidModel {
                message: format!("malformed .rdm payload: {e}"),
            })?;
        let mut structure = project.structure;
        resolve_properties(&mut structure);
        let solved = std::rc::Rc::new(validate_and_solve(&structure)?);
        *slot = Some((project_json.to_owned(), std::rc::Rc::clone(&solved)));
        Ok(solved)
    })
}

thread_local! {
    /// v2.0.1: parsed-structure cache for analyses that need the model but
    /// not the factorization (linear buckling) — repeated endpoint mounts
    /// skip the re-parse + `resolve_properties` walk.
    static PARSE_CACHE: std::cell::RefCell<Option<(String, std::rc::Rc<rdm_model::Structure>)>> =
        const { std::cell::RefCell::new(None) };
}

/// Parses `project_json` through the one-entry parse cache.
///
/// # Errors
///
/// Propagates [`SolveError`] on malformed payloads.
fn cached_structure(project_json: &str) -> Result<std::rc::Rc<rdm_model::Structure>, SolveError> {
    PARSE_CACHE.with(|cell| {
        let mut slot = cell.borrow_mut();
        if let Some((key, structure)) = slot.as_ref()
            && key == project_json
        {
            return Ok(std::rc::Rc::clone(structure));
        }
        let project: rdm_model::ProjectFile =
            serde_json::from_str(project_json).map_err(|e| SolveError::InvalidModel {
                message: format!("malformed .rdm payload: {e}"),
            })?;
        let mut structure = project.structure;
        resolve_properties(&mut structure);
        let structure = std::rc::Rc::new(structure);
        *slot = Some((project_json.to_owned(), std::rc::Rc::clone(&structure)));
        Ok(structure)
    })
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
        // v1.6.0: cached factorization — repeated scrubs reuse the solved
        // model when the project JSON is unchanged.
        let solved = cached_solved_model(project_json)?;
        let project: rdm_model::ProjectFile =
            serde_json::from_str(project_json).map_err(|e| SolveError::InvalidModel {
                message: format!("malformed .rdm payload: {e}"),
            })?;
        let mut structure = project.structure;
        resolve_properties(&mut structure);
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
                t: f.t,
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
            incline: None,
            settlement: [0.0; 6],
        });
        // Fork support at node 2: Uy+Uz (restrains the yaw rigid mode).
        s.supports.push(Support {
            node_id: 2,
            locked_dofs: [false, true, true, false, false, false],
            spring_stiffness: [0.0; 6],
            incline: None,
            settlement: [0.0; 6],
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

    /// v1.6.0: the parametric generator emits a complete `.rdm` project
    /// whose model passes pre-solve validation once properties resolve.
    #[test]
    fn generate_parametric_produces_valid_project() {
        let params = r#"
            { "template": "WarrenTruss", "span_m": 24.0, "height_m": 3.0,
              "bays": 4, "primary_section": "IPE 200",
              "secondary_section": "IPE 140", "material_id": "S235JR" }
        "#;
        let json =
            generate_parametric_json(params, "Treillis param").expect("parametric generation");
        let mut project: rdm_model::ProjectFile = serde_json::from_str(&json).expect("parse");
        assert_eq!(project.name, "Treillis param");
        assert_eq!(project.structure.nodes.len(), 9);
        assert_eq!(project.structure.beams.len(), 15);
        resolve_properties(&mut project.structure);
        assert!(
            rdm_model::validate_model(&project.structure).is_ok(),
            "generated model must validate once properties resolve"
        );
    }

    #[test]
    fn generate_parametric_rejects_bad_params() {
        let err = generate_parametric_json(
            r#"{ "template": "WarrenTruss", "span_m": -4.0, "height_m": 3.0,
                 "bays": 4, "primary_section": "IPE 200",
                 "secondary_section": "IPE 140", "material_id": "S235JR" }"#,
            "x",
        )
        .expect_err("negative span rejected");
        assert!(err.contains("span_m"));
    }

    /// v1.6.0: structured pre-solve diagnostics surface machine codes.
    #[test]
    fn validate_model_issues_reports_structured_diagnostics() {
        let mut s = Structure::default();
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.nodes.push(Node::new(3, 8.0, 0.0, 0.0));
        s.beams.push(Beam::frame(1, 1, 2, "IPE 200", "S235JR"));
        let project = rdm_model::ProjectFile::new("orphan", s);
        let issues = rdm_model::validate_model(&project.structure)
            .err()
            .unwrap_or_default();
        let orphan = issues
            .iter()
            .find(|i| i.code.slug() == "orphan_node")
            .expect("orphan node 3 must surface");
        assert_eq!(orphan.subject, "3");
    }

    /// v1.6.0: the combination report carries the exact EN 1990
    /// multipliers so Step 5 superposes ELU reactions across all cases.
    #[test]
    fn combination_report_exposes_multipliers() {
        let report = build_solve_report(&demo_project()).unwrap();
        let uls = report
            .combinations
            .iter()
            .find(|c| c.kind == "ULS")
            .expect("ULS present");
        assert_eq!(uls.multipliers.len(), 2);
        assert_eq!(uls.multipliers[0].0, "G");
        assert!((uls.multipliers[0].1 - 1.35).abs() < 1e-12);
        assert!((uls.multipliers[1].1 - 1.5).abs() < 1e-12);
    }

    /// v1.6.0: every beam result carries Npl,Rd / Vpl,Rd / length so the
    /// Step 4 diagnostic rail reports the full EC3 resistance set.
    #[test]
    fn beam_result_exposes_resistances_and_length() {
        let report = build_solve_report(&demo_project()).unwrap();
        let uls = report
            .combinations
            .iter()
            .find(|c| c.kind == "ULS")
            .expect("ULS present");
        let beam = &uls.beams[0];
        assert!(beam.n_pl_rd > 0.0, "Npl,Rd must be positive");
        assert!(beam.v_pl_rd > 0.0, "Vpl,Rd must be positive");
        assert!((beam.length - 4.0).abs() < 1e-9, "member length 4 m");
    }

    /// v1.6.0: the span-force sampling exposes the torsional moment T
    /// (5th internal-force curve).
    #[test]
    fn span_forces_expose_torsion() {
        let project_json = demo_project();
        let report = build_solve_report(&project_json).unwrap();
        assert!(!report.cases.is_empty());
        // The pure pipeline behind `beam_span_forces` fills `t` from the
        // end-force block; assert on the DTO construction path via the
        // cached solve + sampling used by the wasm entry.
        let solved = cached_solved_model(&project_json).expect("cached solve");
        let mut project: rdm_model::ProjectFile = serde_json::from_str(&project_json).unwrap();
        resolve_properties(&mut project.structure);
        let weights = combination_weights(&solved, "ULS").expect("ULS weights");
        let state = rdm_solver::superimposed_beam_state(&project.structure, &solved, &weights, 0)
            .expect("state");
        let stations = rdm_solver::beam_forces_at(&state, 3).expect("stations");
        assert_eq!(stations.len(), 3);
        // Torsion stays finite (zero for this load case, but present).
        assert!(stations.iter().all(|(_, f)| f.t.is_finite()));
    }

    /// v1.6.0: the solve cache returns the SAME solved model for a repeated
    /// project JSON (identity via Rc pointer equality) and re-solves when
    /// the JSON changes.
    #[test]
    fn solve_cache_reuses_factorized_model() {
        let json = demo_project();
        let first = cached_solved_model(&json).expect("first solve");
        let second = cached_solved_model(&json).expect("cached solve");
        assert!(
            std::rc::Rc::ptr_eq(&first, &second),
            "identical JSON must hit the cache"
        );
        // Mutating the name changes the serialized JSON -> fresh solve.
        let mut project: rdm_model::ProjectFile = serde_json::from_str(&json).unwrap();
        project.name = "Muté".to_owned();
        let other =
            cached_solved_model(&serde_json::to_string(&project).unwrap()).expect("re-solve");
        assert!(!std::rc::Rc::ptr_eq(&first, &other), "new JSON re-solves");
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
        // v1.6.0: cached factorization — repeated scrubs reuse the solved
        // model when the project JSON is unchanged.
        let solved = cached_solved_model(project_json)?;
        let project: rdm_model::ProjectFile =
            serde_json::from_str(project_json).map_err(|e| SolveError::InvalidModel {
                message: format!("malformed .rdm payload: {e}"),
            })?;
        let mut structure = project.structure;
        resolve_properties(&mut structure);
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

/// Serializable pre-solve diagnostic (v1.6.0, `rdm_model::ModelIssue`).
#[derive(Debug, Clone, Serialize)]
pub struct ModelIssueDto {
    /// Stable machine code (`orphan_node`, `unconstrained_rigid_body`, ...).
    pub code: String,
    /// Entity the issue is about (node/beam id, `*` for global findings).
    pub subject: String,
    /// Pedagogical explanation (EN).
    pub message: String,
}

/// Structured pre-solve validation of the `.rdm` JSON (v1.6.0): returns the
/// full `ModelIssue` list from `rdm_model::validate_model` so Steps 1–3 can
/// surface live badges BEFORE a solve is attempted.
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on malformed payloads.
#[wasm_bindgen]
pub fn validate_model_issues(project_json: &str) -> Result<JsValue, JsValue> {
    let outcome = (|| -> Result<Vec<ModelIssueDto>, SolveError> {
        let project: rdm_model::ProjectFile =
            serde_json::from_str(project_json).map_err(|e| SolveError::InvalidModel {
                message: format!("malformed .rdm payload: {e}"),
            })?;
        let issues = rdm_model::validate_model(&project.structure)
            .err()
            .unwrap_or_default();
        Ok(issues
            .iter()
            .map(|issue| ModelIssueDto {
                code: issue.code.slug().to_owned(),
                subject: issue.subject.clone(),
                message: issue.message.clone(),
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

/// Pure parametric generation used by [`generate_parametric_structure`]
/// (native-testable): builds the `.rdm` project JSON from typed parameters.
///
/// # Errors
///
/// Returns a message string on malformed parameters or serialization
/// failure.
fn generate_parametric_json(params_json: &str, project_name: &str) -> Result<String, String> {
    let params: rdm_cad::ParametricParams =
        serde_json::from_str(params_json).map_err(|e| format!("parametric payload: {e}"))?;
    let structure = rdm_cad::generate_structure(&params).map_err(|e| e.to_string())?;
    let project = rdm_model::ProjectFile::new(project_name, structure);
    serde_json::to_string(&project).map_err(|e| e.to_string())
}

/// Parametric structure generator (v1.6.0 Step 1 configurator): builds a
/// complete `.rdm` project from one of the four templates
/// (`WarrenTruss`, `PortalFrame`, `Cantilever`, `ContinuousBeam`) with
/// configurable `span_m` / `height_m` / `bays` and section designations.
///
/// `params_json` shape:
/// `{ "template": "WarrenTruss", "span_m": 24, "height_m": 3, "bays": 4,
///    "primary_section": "IPE 200", "secondary_section": "IPE 140",
///    "material_id": "S235JR" }`.
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on malformed parameters.
#[wasm_bindgen]
pub fn generate_parametric_structure(
    params_json: &str,
    project_name: &str,
) -> Result<JsValue, JsValue> {
    let outcome = generate_parametric_json(params_json, project_name);
    match outcome {
        Ok(json) => serde_wasm_bindgen::to_value(&json).map_err(Into::into),
        Err(message) => serde_wasm_bindgen::to_value(&SolveFault {
            kind: "Parametric".to_owned(),
            message,
        })
        .map_err(Into::into),
    }
}

/// Maximum accepted CAD payload (v1.6.0 security guard): buffers above
/// 25 MiB are rejected BEFORE parsing so a hostile upload cannot pin the
/// worker in an OOM-bound DXF/STEP scan.
pub const MAX_CAD_BYTES: usize = 25 * 1024 * 1024;

/// Pure CAD -> `.rdm` import used by [`import_cad`] / [`import_dxf`]
/// (testable off-wasm). Dispatches on the filename extension.
///
/// # Errors
///
/// Returns a message string on oversized payloads, parse or topology
/// failure.
fn import_cad_structure(
    bytes: &[u8],
    filename: &str,
    project_name: &str,
) -> Result<String, String> {
    if bytes.len() > MAX_CAD_BYTES {
        return Err(format!(
            "Fichier CAO trop volumineux : {:.1} Mo (maximum 25 Mo).",
            bytes.len() as f64 / (1024.0 * 1024.0)
        ));
    }
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
        settings: rdm_model::ModelSettings::default(),
        load_cases: Vec::new(),
        groups: Vec::new(),
        levels: Vec::new(),
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

    /// v1.6.0: CAD buffers above 25 MiB are rejected before any parse.
    #[test]
    fn import_cad_rejects_oversized_buffers() {
        let oversized = vec![0u8; MAX_CAD_BYTES + 1];
        let err =
            import_cad_structure(&oversized, "huge.dxf", "huge").expect_err("must reject > 25 MiB");
        assert!(err.contains("trop volumineux"), "got {err}");
        // Exactly at the limit the guard passes (parse then fails on
        // content, but the size message is absent).
        let at_limit = vec![0u8; MAX_CAD_BYTES];
        let err_at_limit = import_cad_structure(&at_limit, "max.dxf", "max")
            .expect_err("garbage content still fails");
        assert!(!err_at_limit.contains("trop volumineux"));
    }
}

// ---------------------------------------------------------------------------
// v1.8.0 / v1.9.0 — Wave 3 surface: validation suite, calc trace,
// envelopes, EN 1990 v2 combinations, EN 1991 generators, custom
// sections, optimizer, buckling, seismic, BIM exports, ModelSession.
// ---------------------------------------------------------------------------

fn parse_project(project_json: &str) -> Result<rdm_model::ProjectFile, String> {
    rdm_model::ProjectFile::load_json(project_json.as_bytes())
        .map_err(|e| format!("invalid .rdm payload: {e}"))
}

fn fault_js(kind: &str, message: String) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(&SolveFault {
        kind: kind.to_owned(),
        message,
    })
    .map_err(Into::into)
}

/// v1.9.0: the same fault payload as a bare `Err` value (for functions
/// returning `Result<String, JsValue>`).
fn fault_err(kind: &str, message: String) -> JsValue {
    serde_wasm_bindgen::to_value(&SolveFault {
        kind: kind.to_owned(),
        message,
    })
    .unwrap_or_else(|_| JsValue::from_str("fault"))
}

/// v1.8.0: the 41 closed-form benchmarks, executed live in the wasm
/// module — the in-app Validation modal renders this list.
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on serialization failure.
#[wasm_bindgen]
pub fn run_validation_suite() -> Result<JsValue, JsValue> {
    let results = rdm_solver::run_validation_suite();
    serde_wasm_bindgen::to_value(&results).map_err(Into::into)
}

/// v1.8.0: EN 1990 combination set for the schema-v2 ψ table
/// (`6.10` or `6.10a/b` per the model settings) + SLS families.
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on malformed payloads.
#[wasm_bindgen]
pub fn build_combinations_v2_json(project_json: &str) -> Result<JsValue, JsValue> {
    match parse_project(project_json) {
        Ok(project) => {
            let combos = rdm_eurocode::build_combinations_v2(
                &project.structure.load_cases,
                project.structure.settings.combination_method,
            );
            serde_wasm_bindgen::to_value(&combos).map_err(Into::into)
        }
        Err(message) => fault_js("InvalidModel", message),
    }
}

/// v1.8.0: KaTeX `CalcTrace` tree of one member — the worst-case
/// biaxial interaction (6.61/6.62) with substituted numbers.
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on malformed payloads.
#[wasm_bindgen]
pub fn member_calc_trace(project_json: &str, beam_index: usize) -> Result<JsValue, JsValue> {
    let project = match parse_project(project_json) {
        Ok(p) => p,
        Err(message) => return fault_js("InvalidModel", message),
    };
    let structure = &project.structure;
    let Some(beam) = structure.beams.get(beam_index) else {
        return fault_js(
            "InvalidModel",
            format!("beam index {beam_index} out of range"),
        );
    };
    let Some(section) = structure.sections.get(&beam.section_id) else {
        return fault_js(
            "InvalidModel",
            format!("unknown section {}", beam.section_id),
        );
    };
    let Some(material) = structure.materials.get(&beam.material_id) else {
        return fault_js(
            "InvalidModel",
            format!("unknown material {}", beam.material_id),
        );
    };
    let demand = match rdm_solver::solve_model(structure) {
        Ok(solved) => {
            // Worst-case envelope of the end moments and axial force.
            let base = 12 * beam_index;
            let mut my = 0.0_f64;
            let mut n = 0.0_f64;
            for (_, sol) in &solved.cases {
                my = my.max(sol.beam_end_forces[base + 4].abs());
                n = n.min(sol.beam_end_forces[base]);
            }
            (n, my)
        }
        Err(_) => (0.0, 0.0),
    };
    let gamma = rdm_eurocode::annex_factors(structure.settings.national_annex);
    let input = rdm_eurocode::InteractionInput {
        n_ed: demand.0,
        my_ed: demand.1,
        mz_ed: 0.0,
        n_b_rd_y: 0.6 * section.a * material.fy / gamma.gamma_m1,
        n_b_rd_z: 0.5 * 0.6 * section.a * material.fy / gamma.gamma_m1,
        mc_y_rd: section.wpl_y.unwrap_or(section.wel_y) * material.fy / gamma.gamma_m0,
        mc_z_rd: section.wel_z * material.fy / gamma.gamma_m0,
        chi_lt: 0.8,
        lambda_bar_y_sq: 0.5,
        lambda_bar_z_sq: 0.8,
    };
    let annex = if structure.settings.national_annex == rdm_model::NationalAnnex::EN {
        rdm_eurocode::InteractionAnnex::B
    } else {
        rdm_eurocode::InteractionAnnex::A
    };
    let trace = rdm_eurocode::interaction_6_61_6_62(&input, annex);
    serde_wasm_bindgen::to_value(&trace).map_err(Into::into)
}

/// v1.8.0: min/max envelopes of N/My/Mz/Vz/T across the ULS
/// combinations produced by `build_combinations_v2`.
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on malformed payloads.
#[wasm_bindgen]
pub fn compute_envelopes_json(project_json: &str) -> Result<JsValue, JsValue> {
    // v2.0.1: parse + resolve + solve all through the one-entry caches —
    // `parse_project` alone leaves the section/material tables empty, which
    // made every envelope mount fault inside `build_elements` (silently
    // swallowed by the UI as "no envelopes").
    let structure = match cached_structure(project_json) {
        Ok(s) => s,
        Err(e) => return fault_js("SolveError", e.to_string()),
    };
    let combos = rdm_eurocode::build_combinations_v2(
        &structure.load_cases,
        structure.settings.combination_method,
    );
    // v2.0.1: reuse the one-entry factorization cache — every envelope
    // mount no longer re-solves the model from scratch in the worker.
    let solved = match cached_solved_model(project_json) {
        Ok(s) => s,
        Err(e) => return fault_js("SolveError", e.to_string()),
    };
    let case_map: std::collections::BTreeMap<String, rdm_model::LoadCase> = structure
        .load_cases
        .iter()
        .map(|def| match def.category {
            rdm_model::CaseCategory::Permanent => {
                (def.code.clone(), rdm_model::LoadCase::Permanent)
            }
            rdm_model::CaseCategory::Variable => (def.code.clone(), rdm_model::LoadCase::Variable),
            rdm_model::CaseCategory::Wind => (def.code.clone(), rdm_model::LoadCase::Wind),
            rdm_model::CaseCategory::Snow => (def.code.clone(), rdm_model::LoadCase::Snow),
            _ => (def.code.clone(), rdm_model::LoadCase::Acceleration),
        })
        .collect();
    let weighted: Vec<(String, Vec<(rdm_model::LoadCase, f64)>)> = combos
        .iter()
        .map(|(_kind, label, weights)| {
            (
                label.clone(),
                weights
                    .iter()
                    .filter_map(|(code, f)| case_map.get(code).map(|c| (*c, *f)))
                    .collect::<Vec<_>>(),
            )
        })
        .collect();
    let combos_ref: Vec<(&str, &[(rdm_model::LoadCase, f64)])> = weighted
        .iter()
        .map(|(label, weights)| (label.as_str(), weights.as_slice()))
        .collect();
    match rdm_solver::compute_envelopes(&structure, &solved, &combos_ref) {
        Ok(envelopes) => serde_wasm_bindgen::to_value(&envelopes).map_err(Into::into),
        Err(e) => fault_js("SolveError", e.to_string()),
    }
}

/// v1.8.0: custom parametric section preview
/// (`kind`: `WeldedI|Rhs|Chs|SolidRect|SolidRound`).
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on unknown kinds.
#[wasm_bindgen]
pub fn custom_section_preview(
    kind: &str,
    h: f64,
    b: f64,
    tw: f64,
    tf: f64,
) -> Result<JsValue, JsValue> {
    let section = match kind {
        "WeldedI" | "PRS" => rdm_eurocode::welded_i(h, b, tw, tf),
        "Rhs" => rdm_eurocode::rectangular_hollow(h, b, tw),
        "Chs" => rdm_eurocode::circular_hollow(h, tw),
        "SolidRect" => rdm_eurocode::solid_rect(h, b),
        "SolidRound" => rdm_eurocode::solid_round(h),
        _ => {
            return fault_js(
                "InvalidModel",
                format!("unknown custom section kind {kind}"),
            );
        }
    };
    serde_wasm_bindgen::to_value(&section).map_err(Into::into)
}

/// v1.8.0: EN 1991 action generators (`kind`: `imposed|snow|wind`),
/// returning the load DTOs to append to the model.
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on malformed payloads.
#[wasm_bindgen]
pub fn generate_env_loads_json(
    kind: &str,
    beam_id: u32,
    value: f64,
    tributary_m: f64,
) -> Result<JsValue, JsValue> {
    use rdm_eurocode::{ImposedCategory, WindParameters, imposed_load, snow_load, wind_load};
    let load = match kind {
        "imposed" => {
            let category = match value as u32 {
                1 => ImposedCategory::A,
                2 => ImposedCategory::B,
                3 => ImposedCategory::C,
                4 => ImposedCategory::D,
                _ => ImposedCategory::E,
            };
            imposed_load(beam_id, category, tributary_m)
        }
        "snow" => snow_load(beam_id, value * 1000.0, 15.0, tributary_m),
        "wind" => wind_load(
            beam_id,
            &WindParameters {
                vb: value,
                z: 10.0,
                exposure: 1.0,
                cf: 1.3,
                area_m2: tributary_m,
            },
        ),
        _ => return fault_js("InvalidModel", format!("unknown EN 1991 kind {kind}")),
    };
    serde_wasm_bindgen::to_value(&vec![load]).map_err(Into::into)
}

/// v1.8.0: iterative EC3 section optimizer over the catalog-like
/// candidate list supplied by the caller.
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on malformed payloads.
#[wasm_bindgen]
pub fn optimize_sections_json(
    project_json: &str,
    candidates_json: &str,
) -> Result<JsValue, JsValue> {
    let candidates: Vec<rdm_eurocode::ProfileCandidate> =
        match serde_json::from_str(candidates_json) {
            Ok(c) => c,
            Err(e) => return fault_js("InvalidModel", format!("bad candidates: {e}")),
        };
    // v2.0.1: parse + resolve through the cache — the mass totals read the
    // resolved section table instead of an always-empty one.
    let structure = match cached_structure(project_json) {
        Ok(s) => s,
        Err(e) => return fault_js("SolveError", e.to_string()),
    };
    // v2.0.1: reuse the one-entry factorization cache — the optimizer and
    // the solve share the same factorization instead of doubling it.
    let solved = match cached_solved_model(project_json) {
        Ok(s) => s,
        Err(e) => return fault_js("SolveError", e.to_string()),
    };
    let fy = structure.materials.values().next().map_or(235e6, |m| m.fy);
    let mut results: Vec<rdm_eurocode::GroupOptimization> = Vec::new();
    for (index, beam) in structure.beams.iter().enumerate() {
        let base = 12 * index;
        let mut n = 0.0_f64;
        let mut my = 0.0_f64;
        for (_, sol) in &solved.cases {
            n = n.min(sol.beam_end_forces[base]);
            my = my.max(sol.beam_end_forces[base + 4].abs());
        }
        let length = match (structure.node(beam.n1), structure.node(beam.n2)) {
            (Ok(a), Ok(b)) => {
                ((b.x - a.x).powi(2) + (b.y - a.y).powi(2) + (b.z - a.z).powi(2)).sqrt()
            }
            _ => 4.0,
        };
        let demand = rdm_eurocode::GroupDemand {
            n_ed: n,
            my_ed: my,
            mz_ed: 0.0,
            v_ed: 0.0,
            length_m: length,
            defl_limit_ratio: 250.0,
            defl_ed_m: 0.0,
        };
        results.push(rdm_eurocode::optimize_group(
            &demand,
            &candidates,
            fy,
            structure.settings.national_annex,
            10,
        ));
    }
    let totals = rdm_eurocode::totals(
        structure
            .beams
            .iter()
            .zip(&results)
            .map(|(beam, opt)| {
                opt.chosen
                    .as_ref()
                    .and_then(|designation| {
                        candidates.iter().find(|c| &c.designation == designation)
                    })
                    .map_or(
                        structure
                            .sections
                            .get(&beam.section_id)
                            .map_or(0.0, |sec| sec.a * 7850.0),
                        |c| c.mass_per_m,
                    )
            })
            .sum(),
    );
    serde_wasm_bindgen::to_value(&(results, totals)).map_err(Into::into)
}

/// v1.9.0: linear buckling — top `n_modes` critical load factors.
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on malformed payloads.
#[wasm_bindgen]
pub fn buckling_analysis_json(project_json: &str, n_modes: usize) -> Result<JsValue, JsValue> {
    // v2.0.1: parse + resolve through the one-entry cache — repeated mounts
    // reuse the parsed structure (no fresh serde walk per call).
    let structure = match cached_structure(project_json) {
        Ok(s) => s,
        Err(e) => return fault_js("SolveError", e.to_string()),
    };
    match rdm_solver::buckling_analysis(&structure, n_modes) {
        Ok(report) => serde_wasm_bindgen::to_value(&report).map_err(Into::into),
        Err(e) => fault_js("SolveError", e.to_string()),
    }
}

/// v1.9.0: EN 1998-1 elastic spectrum sampled on the given periods (s).
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on malformed payloads.
#[wasm_bindgen]
pub fn seismic_spectrum_json(
    ag_g: f64,
    ground: &str,
    spectrum: &str,
    periods_json: &str,
) -> Result<JsValue, JsValue> {
    let ground_type = match ground {
        "A" => rdm_solver::GroundType::A,
        "B" => rdm_solver::GroundType::B,
        "C" => rdm_solver::GroundType::C,
        "D" => rdm_solver::GroundType::D,
        _ => rdm_solver::GroundType::E,
    };
    let kind = match spectrum {
        "Type1" | "type1" => rdm_solver::SpectrumType::Type1,
        _ => rdm_solver::SpectrumType::Type2,
    };
    let periods: Vec<f64> = match serde_json::from_str(periods_json) {
        Ok(p) => p,
        Err(e) => return fault_js("InvalidModel", format!("bad periods: {e}")),
    };
    let values: Vec<f64> = periods
        .iter()
        .map(|t| rdm_solver::elastic_spectrum(*t, ag_g, ground_type, kind))
        .collect();
    serde_wasm_bindgen::to_value(&values).map_err(Into::into)
}

/// v1.9.0: BIM exports — `format` in
/// `ifc4 | saf | opensees | solver | gltf` (string payload).
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on malformed payloads.
#[wasm_bindgen]
pub fn export_bim(project_json: &str, format: &str) -> Result<String, JsValue> {
    let project = match parse_project(project_json) {
        Ok(p) => p,
        Err(message) => return Err(fault_err("InvalidModel", message)),
    };
    let outcome: Option<String> = match format {
        "ifc4" => Some(rdm_cad::export_ifc4_structural(&project)),
        "saf" => rdm_cad::export_saf_json(&project).ok(),
        "opensees" => Some(rdm_cad::export_opensees_tcl(&project)),
        "solver" => rdm_cad::export_solver_json(&project).ok(),
        "gltf" => rdm_cad::export_gltf(&project).ok(),
        _ => None,
    };
    outcome.ok_or_else(|| fault_err("InvalidModel", format!("unknown BIM format {format}")))
}

/// v1.8.0 stateful session: caches the parsed model + solved cases so
/// follow-up case superpositions (`solve_case_rhs`) skip the
/// factorization entirely (< 2 ms) and model deltas re-solve on demand.
impl Default for ModelSession {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
pub struct ModelSession {
    project: Option<rdm_model::ProjectFile>,
    solved: Option<rdm_solver::SolvedModel>,
    canceled: bool,
}

#[wasm_bindgen]
impl ModelSession {
    /// Creates an empty session.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            project: None,
            solved: None,
            canceled: false,
        }
    }

    /// Opens (and migrates to schema v2) a `.rdm` payload.
    ///
    /// # Errors
    ///
    /// Returns a `SolveFault`-shaped `JsValue` on malformed payloads.
    #[wasm_bindgen]
    pub fn open_model(&mut self, project_json: &str) -> Result<(), JsValue> {
        self.canceled = false;
        match parse_project(project_json) {
            Ok(project) => {
                self.project = Some(project);
                self.solved = None;
                Ok(())
            }
            Err(message) => Err(fault_err("InvalidModel", message)),
        }
    }

    /// Applies a full model replacement (latest-wins semantics live in
    /// the worker client; the session simply swaps the model).
    ///
    /// # Errors
    ///
    /// Returns a `SolveFault`-shaped `JsValue` on malformed payloads.
    #[wasm_bindgen]
    pub fn apply_delta(&mut self, project_json: &str) -> Result<(), JsValue> {
        self.open_model(project_json)
    }

    /// Solves every elementary case and caches the result.
    ///
    /// # Errors
    ///
    /// Returns a `SolveFault`-shaped `JsValue` on solve failure.
    #[wasm_bindgen]
    pub fn solve_session(&mut self) -> Result<bool, JsValue> {
        if self.canceled {
            return Ok(false);
        }
        let Some(project) = self.project.as_ref() else {
            return Err(fault_err("InvalidModel", "no model open".to_owned()));
        };
        match rdm_solver::solve_model(&project.structure) {
            Ok(solved) => {
                self.solved = Some(solved);
                Ok(true)
            }
            Err(e) => Err(fault_err("SolveError", e.to_string())),
        }
    }

    /// Superposed response for `(case, weight)` pairs from the cached
    /// solve — no refactorization, the < 2 ms hot path.
    ///
    /// # Errors
    ///
    /// Returns a `SolveFault`-shaped `JsValue` when nothing is cached or
    /// a case is missing.
    #[wasm_bindgen]
    pub fn solve_case_rhs(&self, weights_json: &str) -> Result<JsValue, JsValue> {
        let Some(solved) = self.solved.as_ref() else {
            return Err(fault_err(
                "InvalidModel",
                "no cached solve — call solve_session".to_owned(),
            ));
        };
        let weights: Vec<(rdm_model::LoadCase, f64)> = match serde_json::from_str(weights_json) {
            Ok(w) => w,
            Err(e) => return Err(fault_err("InvalidModel", format!("bad weights: {e}"))),
        };
        match rdm_solver::superimpose(solved, &weights) {
            Ok((u, r, f)) => serde_wasm_bindgen::to_value(&(u, r, f)).map_err(Into::into),
            Err(e) => fault_js("SolveError", e.to_string()),
        }
    }

    /// Cancels any pending work (the worker client polls this flag).
    #[wasm_bindgen]
    pub fn cancel(&mut self) {
        self.canceled = true;
    }

    /// Whether the session holds a cached factorization.
    #[wasm_bindgen]
    pub fn has_cached_solve(&self) -> bool {
        self.solved.is_some()
    }
}

use rdm_eurocode::{
    AluminiumAlloy, ConcreteClass, LoadDuration, TimberProduct, ec2_flexure_as, ec2_shear,
    ec3_fillet_weld, ec3_fire_check, ec3_joint_bolt_shear, ec5_timber_bending, ec9_aluminium_check,
};

/// v2.0.0: multi-material normative check dispatcher — `kind` selects
/// `ec2_beam` (concrete flexure+shear), `ec5_timber`, `ec3_joint`,
/// `ec3_fire` or `ec9_aluminium`; every result is a `CalcTraceNode` tree.
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on malformed payloads.
#[wasm_bindgen]
#[allow(clippy::too_many_lines)]
pub fn multi_material_check_json(kind: &str, params_json: &str) -> Result<JsValue, JsValue> {
    let params: serde_json::Value = match serde_json::from_str(params_json) {
        Ok(v) => v,
        Err(e) => return fault_js("InvalidModel", format!("bad params: {e}")),
    };
    let p = |field: &str, default: f64| -> f64 { params[field].as_f64().unwrap_or(default) };
    let trace: Vec<rdm_eurocode::CalcTraceNode> = match kind {
        "ec2_beam" => {
            let class = match params["class"].as_str().unwrap_or("C30") {
                "C25" => ConcreteClass::C25,
                "C30" => ConcreteClass::C30,
                "C35" => ConcreteClass::C35,
                "C40" => ConcreteClass::C40,
                "C45" => ConcreteClass::C45,
                _ => ConcreteClass::C50,
            };
            let mut nodes = ec2_flexure_as(
                p("m_ed", 0.0),
                p("effective_depth", 0.45),
                p("width", 0.25),
                class,
                p("fyk_steel", 500e6),
            );
            nodes.extend(ec2_shear(
                p("v_ed", 0.0),
                p("width", 0.25),
                p("effective_depth", 0.45),
                class,
                p("as_tension", 1.0e-3),
                p("asw_per_s", 1.0e-3),
                p("fywd", 500e6),
            ));
            nodes
        }
        "ec5_timber" => {
            let product = match params["product"].as_str().unwrap_or("C24") {
                "GL24h" => TimberProduct::Gl24h,
                "GL28h" => TimberProduct::Gl28h,
                _ => TimberProduct::C24,
            };
            let duration = match params["load_duration"].as_str().unwrap_or("MediumTerm") {
                "Permanent" => LoadDuration::Permanent,
                "ShortTerm" => LoadDuration::ShortTerm,
                _ => LoadDuration::MediumTerm,
            };
            ec5_timber_bending(
                p("m_ed", 0.0),
                p("wel", 1.0e-4),
                product,
                params["service_class"].as_u64().unwrap_or(1) as u8,
                duration,
                p("kdef", 0.8),
            )
        }
        "ec3_joint" => {
            let mut nodes = ec3_joint_bolt_shear(
                p("n_bolts", 4.0),
                p("bolt_area", 2.01e-4),
                p("fub", 800e6),
                p("v_ed", 0.0),
            );
            nodes.extend(ec3_fillet_weld(
                p("throat_a", 0.004),
                p("weld_length", 0.1),
                p("fu", 360e6),
                p("beta_w", 0.8),
                p("weld_force", 0.0),
            ));
            nodes
        }
        "ec3_fire" => ec3_fire_check(
            p("utilization_mu0", 0.55),
            params["rating_minutes"].as_u64().unwrap_or(60) as u32,
            p("section_temperature", 480.0),
        ),
        "ec9_aluminium" => {
            let alloy = match params["alloy"].as_str().unwrap_or("6082-T6") {
                "6061-T6" => AluminiumAlloy::Alloy6061T6,
                _ => AluminiumAlloy::Alloy6082T6,
            };
            ec9_aluminium_check(p("n_ed", 0.0), p("area", 1.0e-3), alloy, p("chi", 0.7))
        }
        _ => {
            return fault_js(
                "InvalidModel",
                format!("unknown multi-material kind {kind}"),
            );
        }
    };
    serde_wasm_bindgen::to_value(&trace).map_err(Into::into)
}

/// v2.0.0: EN 1991-2 LM1 moving-load envelope of one deck beam — the
/// tandem crossing the span in `n_positions` placements (max support
/// reaction, N).
///
/// # Errors
///
/// Returns a `SolveFault`-shaped `JsValue` on malformed payloads.
#[wasm_bindgen]
pub fn moving_loads_envelope_json(
    project_json: &str,
    beam_index: usize,
    n_positions: usize,
) -> Result<JsValue, JsValue> {
    // v2.0.1: parse + resolve through the cache — same family as the other
    // engine endpoints (an unresolved structure faults the assembly).
    let structure = match cached_structure(project_json) {
        Ok(s) => s,
        Err(e) => return fault_js("SolveError", e.to_string()),
    };
    match rdm_solver::tandem_envelope(&structure, beam_index, n_positions.clamp(1, 24)) {
        Ok(envelope) => serde_wasm_bindgen::to_value(&envelope).map_err(Into::into),
        Err(e) => fault_js("SolveError", e.to_string()),
    }
}
