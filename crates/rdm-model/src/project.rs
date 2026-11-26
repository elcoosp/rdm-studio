//! The `.rdm` project file: canonical JSON + SHA-256 fingerprint.
//!
//! **v1.7.0 — schema v2.** The field set of the model grows with custom
//! elementary load cases (`category`, `ψ0/ψ1/ψ2`, per-case self-weight),
//! member groups, storey levels and solver/standard `settings`. The Rust
//! structs are the single source of truth;
//! `apps/web/public/schema/rdm-v2.schema.json` mirrors them for editor
//! tooling.
//!
//! Loading is version-tolerant: a v1 payload parses into the same structs
//! (all v2 fields are `#[serde(default)]`) and
//! [`ProjectFile::load_json`] runs the automatic v1 → v2 migration
//! (bump the version, synthesize the five canonical load-case
//! definitions, keep every other default).

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::Structure;

/// Current `.rdm` format version.
pub const PROJECT_FORMAT_VERSION: u32 = 2;

/// National Annex selector carried by the model settings (v1.7.0); the
/// normative factors live in `rdm-eurocode`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum NationalAnnex {
    /// French NA (default).
    #[default]
    FR,
    /// Belgian NA.
    BE,
    /// German NA.
    DE,
    /// UK NA.
    UK,
    /// Recommended values (no national choice).
    EN,
}

impl NationalAnnex {
    /// Wire code used by the UI (`FR` / `BE` / `DE` / `UK` / `EN`).
    #[must_use]
    pub fn code(self) -> &'static str {
        match self {
            Self::FR => "FR",
            Self::BE => "BE",
            Self::DE => "DE",
            Self::UK => "UK",
            Self::EN => "EN",
        }
    }

    /// Parses a wire code; unknown codes fall back to the default.
    #[must_use]
    pub fn parse(code: &str) -> Self {
        match code.to_ascii_uppercase().as_str() {
            "BE" => Self::BE,
            "DE" => Self::DE,
            "UK" => Self::UK,
            "EN" => Self::EN,
            _ => Self::FR,
        }
    }
}

/// EN 1990 §6.4.3 combination method (v1.7.0): expression `6.10` or the
/// less conservative `6.10a` + `6.10b` pair.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum CombinationMethod {
    /// Single expression `6.10` (default).
    #[default]
    Eq610,
    /// Alternatives `6.10a` + `6.10b`.
    Eq610ab,
}

/// Solver / standard settings of a model (v1.7.0, schema v2).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct ModelSettings {
    /// National Annex for the normative factors.
    #[serde(default)]
    pub national_annex: NationalAnnex,
    /// EN 1990 combination method.
    #[serde(default)]
    pub combination_method: CombinationMethod,
    /// v2.0.0: second-order P-Δ analysis — each case re-solves with the
    /// geometric stiffness `Kg(N)` assembled from the current axial force
    /// distribution until the displacement residual converges.
    #[serde(default)]
    pub p_delta: bool,
    /// Timoshenko shear deformation (`Φ = 12 EI / (G Av L²)`); default on,
    /// auto-disabled with a warning flag when `L / h < 8` (shear-dominated
    /// deep members still solve, but the flag marks the approximation).
    #[serde(default = "default_true")]
    pub shear_deformation: bool,
    /// 2D plane-frame mode: `Uy`, `Rx`, `Rz` DOFs are constrained.
    #[serde(default)]
    pub plane_frame_2d: bool,
}

fn default_true() -> bool {
    true
}

impl Default for ModelSettings {
    fn default() -> Self {
        Self {
            national_annex: NationalAnnex::FR,
            combination_method: CombinationMethod::Eq610,
            p_delta: false,
            shear_deformation: true,
            plane_frame_2d: false,
        }
    }
}

/// Category of a custom elementary load case (v1.7.0).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CaseCategory {
    /// Permanent actions.
    Permanent,
    /// Imposed / variable actions.
    Variable,
    /// Wind actions.
    Wind,
    /// Snow actions.
    Snow,
    /// Accidental actions.
    Accidental,
    /// Seismic actions.
    Seismic,
    /// Thermal actions.
    Temperature,
}

/// Custom elementary load case definition (v1.7.0, schema v2): the
/// canonical `G | Q | W | S | Acc` remain implicit; every additional case
/// is declared here with its EN 1990 Annex A1 ψ factors.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LoadCaseDef {
    /// Stable load-case id.
    pub id: u32,
    /// Short code used in reports (`Q2`, `S+`, `T1`, ...).
    pub code: String,
    /// Normative category driving the combination factors.
    pub category: CaseCategory,
    /// ψ0 combination factor (characteristic combinations).
    pub psi0: f64,
    /// ψ1 frequent-combination factor.
    pub psi1: f64,
    /// ψ2 quasi-permanent factor.
    pub psi2: f64,
    /// Whether the member self-weight joins this case.
    pub include_self_weight: bool,
}

impl LoadCaseDef {
    /// Builds a definition with explicit EN 1990 Annex A1 ψ values.
    #[must_use]
    pub fn new(
        id: u32,
        code: &str,
        category: CaseCategory,
        psi0: f64,
        psi1: f64,
        psi2: f64,
    ) -> Self {
        Self {
            id,
            code: code.to_owned(),
            category,
            psi0,
            psi1,
            psi2,
            include_self_weight: false,
        }
    }
}

/// Named group of members (v1.7.0): batch section / releases edits and
/// report filtering.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MemberGroup {
    /// Stable group id.
    pub id: u32,
    /// Display name.
    pub name: String,
    /// Member ids belonging to the group.
    pub beam_ids: Vec<u32>,
}

/// Storey level (v1.7.0): elevation plane used by the UI and reports.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Level {
    /// Stable level id.
    pub id: u32,
    /// Elevation in metres (global Z).
    pub elevation: f64,
    /// Optional display name (`RDC`, `R+1`, ...).
    pub name: Option<String>,
}

/// Canonical on-disk representation of a project (`.rdm`, schema v2).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProjectFile {
    /// Format version, currently 2.
    pub version: u32,
    /// Human-facing project name.
    pub name: String,
    /// The structural model (SI units, settings + load cases + groups).
    pub structure: Structure,
}

impl ProjectFile {
    /// Creates a v2 project from a model and a display name.
    pub fn new(name: impl Into<String>, structure: Structure) -> Self {
        Self {
            version: PROJECT_FORMAT_VERSION,
            name: name.into(),
            structure,
        }
    }

    /// Serializes the project to canonical JSON bytes.
    ///
    /// # Errors
    ///
    /// Returns the underlying [`serde_json::Error`] on serialization failure.
    pub fn to_canonical_json(&self) -> Result<Vec<u8>, serde_json::Error> {
        serde_json::to_vec(self)
    }

    /// Parses a project from JSON bytes (any schema version).
    ///
    /// # Errors
    ///
    /// Returns the underlying [`serde_json::Error`] on malformed payloads.
    pub fn from_json(bytes: &[u8]) -> Result<Self, serde_json::Error> {
        serde_json::from_slice(bytes)
    }

    /// Parses a project and migrates it to schema v2 (v1 → v2 on load).
    ///
    /// # Errors
    ///
    /// Returns the underlying [`serde_json::Error`] on malformed payloads.
    pub fn load_json(bytes: &[u8]) -> Result<Self, serde_json::Error> {
        let mut project: Self = serde_json::from_slice(bytes)?;
        migrate_to_v2(&mut project);
        Ok(project)
    }

    /// SHA-256 fingerprint of the canonical serialization (hex-encoded).
    ///
    /// # Errors
    ///
    /// Propagates [`ProjectFile::to_canonical_json`] failures.
    pub fn fingerprint(&self) -> Result<String, serde_json::Error> {
        use core::fmt::Write as _;

        let bytes = self.to_canonical_json()?;
        let digest = Sha256::digest(&bytes);
        let mut hex = String::with_capacity(64);
        for byte in digest {
            let _ = write!(hex, "{byte:02x}");
        }
        Ok(hex)
    }
}

/// Automatic v1 → v2 migration (v1.7.0): bumps the version, synthesizes
/// the canonical load-case definitions with the EN 1990 Annex A1 ψ
/// values and groups members by section designation as the default
/// grouping. Idempotent on already-v2 payloads.
pub fn migrate_to_v2(project: &mut ProjectFile) {
    if project.structure.load_cases.is_empty() {
        project.structure.load_cases = canonical_load_cases();
    }
    if project.structure.groups.is_empty() {
        let mut groups: Vec<MemberGroup> = Vec::new();
        for beam in &project.structure.beams {
            if let Some(group) = groups.iter_mut().find(|g| g.name == beam.section_id) {
                group.beam_ids.push(beam.id);
            } else {
                groups.push(MemberGroup {
                    id: groups.len() as u32 + 1,
                    name: beam.section_id.clone(),
                    beam_ids: vec![beam.id],
                });
            }
        }
        project.structure.groups = groups;
    }
    project.version = PROJECT_FORMAT_VERSION;
}

/// The five canonical elementary cases with EN 1990 A1.1 ψ values.
#[must_use]
pub fn canonical_load_cases() -> Vec<LoadCaseDef> {
    vec![
        LoadCaseDef::new(1, "G", CaseCategory::Permanent, 1.0, 1.0, 1.0),
        LoadCaseDef::new(2, "Q", CaseCategory::Variable, 0.7, 0.5, 0.3),
        LoadCaseDef::new(3, "W", CaseCategory::Wind, 0.6, 0.2, 0.0),
        LoadCaseDef::new(4, "S", CaseCategory::Snow, 0.5, 0.2, 0.0),
        LoadCaseDef::new(5, "Acc", CaseCategory::Accidental, 1.0, 1.0, 1.0),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::MaterialProperties;
    use crate::geometry::{Beam, Node, SectionProperties, SectionShape};

    fn sample() -> ProjectFile {
        let mut s = Structure::default();
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 2.0, 0.0, 0.0));
        s.beams.push(Beam::frame(1, 1, 2, "IPE 200", "S235JR"));
        s.sections.insert(
            "IPE 200".to_owned(),
            SectionProperties {
                shape: SectionShape::DoubleSymmetricI,
                a: 2.85e-3,
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
        s.materials.insert(
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
        ProjectFile::new("Demo frame", s)
    }

    #[test]
    fn roundtrip_preserves_model_and_version() {
        let project = sample();
        let bytes = project.to_canonical_json().expect("serialize");
        let parsed = ProjectFile::from_json(&bytes).expect("parse");
        assert_eq!(parsed, project);
        assert_eq!(parsed.version, PROJECT_FORMAT_VERSION);
    }

    #[test]
    fn v1_payload_migrates_to_v2() {
        let v1 = r#"{
            "version": 1,
            "name": "Legacy",
            "structure": {
                "nodes": [{"id": 1, "x": 0.0, "y": 0.0, "z": 0.0},
                          {"id": 2, "x": 4.0, "y": 0.0, "z": 0.0}],
                "beams": [{"id": 1, "n1": 1, "n2": 2,
                           "section_id": "IPE 200", "material_id": "S235JR"}],
                "supports": [],
                "loads": [],
                "sections": {},
                "materials": {},
                "self_weight_enabled": true
            }
        }"#;
        let migrated = ProjectFile::load_json(v1.as_bytes()).expect("migrate");
        assert_eq!(migrated.version, 2);
        assert_eq!(migrated.name, "Legacy");
        assert_eq!(migrated.structure.load_cases.len(), 5);
        assert!(migrated.structure.settings.shear_deformation);
        assert_eq!(
            migrated.structure.settings.national_annex,
            NationalAnnex::FR
        );
        // The default grouping clusters members by section designation.
        assert_eq!(migrated.structure.groups.len(), 1);
        assert_eq!(migrated.structure.groups[0].beam_ids, vec![1]);
        // The migration is idempotent on an already-v2 payload.
        let bytes = migrated.to_canonical_json().expect("serialize");
        let again = ProjectFile::load_json(&bytes).expect("reload");
        assert_eq!(again, migrated);
    }

    #[test]
    fn fingerprint_is_stable_for_the_same_model() {
        let a = sample().fingerprint().expect("fp");
        let b = sample().fingerprint().expect("fp");
        assert_eq!(a, b);
        assert_eq!(a.len(), 64);
    }
}
