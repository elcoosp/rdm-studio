//! The `.rdm` project file: canonical JSON + SHA-256 fingerprint.
//!
//! The file format is deliberately canonical: field order follows the struct
//! declaration order, maps are `BTreeMap` (sorted keys), so a given model
//! always serializes to the same bytes and the SHA-256 fingerprint is a
//! stable identity for the project (used by reports and the URL share).

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::Structure;

/// Canonical on-disk representation of a project (`.rdm`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProjectFile {
    /// Format version, currently 1.
    pub version: u32,
    /// Human-facing project name.
    pub name: String,
    /// The structural model (SI units).
    pub structure: Structure,
}

/// Current `.rdm` format version.
pub const PROJECT_FORMAT_VERSION: u32 = 1;

impl ProjectFile {
    /// Creates a v1 project from a model and a display name.
    pub fn new(name: impl Into<String>, structure: Structure) -> Self {
        Self {
            version: PROJECT_FORMAT_VERSION,
            name: name.into(),
            structure,
        }
    }

    /// Serializes the project to canonical JSON bytes.
    pub fn to_canonical_json(&self) -> Result<Vec<u8>, serde_json::Error> {
        serde_json::to_vec(self)
    }

    /// Parses a project from JSON bytes.
    ///
    /// # Errors
    ///
    /// Returns the underlying [`serde_json::Error`] on malformed payloads.
    pub fn from_json(bytes: &[u8]) -> Result<Self, serde_json::Error> {
        serde_json::from_slice(bytes)
    }

    /// SHA-256 fingerprint of the canonical serialization (hex-encoded).
    ///
    /// # Errors
    ///
    /// Propagates [`ProjectFile::to_canonical_json`] failures.
    pub fn fingerprint(&self) -> Result<String, serde_json::Error> {
        let bytes = self.to_canonical_json()?;
        let digest = Sha256::digest(&bytes);
        let mut hex = String::with_capacity(64);
        for byte in digest {
            hex.push_str(&format!("{byte:02x}"));
        }
        Ok(hex)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::MaterialProperties;
    use crate::geometry::{Beam, Node, SectionProperties, SectionShape};
    use approx::assert_abs_diff_eq;

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
    fn roundtrip_preserves_model() {
        let project = sample();
        let bytes = project.to_canonical_json().unwrap();
        let parsed = ProjectFile::from_json(&bytes).unwrap();
        assert_eq!(parsed, project);
    }

    #[test]
    fn fingerprint_is_stable_and_hex() {
        let project = sample();
        let fp1 = project.fingerprint().unwrap();
        let fp2 = sample().fingerprint().unwrap();
        assert_eq!(fp1, fp2, "fingerprint must be deterministic");
        assert_eq!(fp1.len(), 64);
        assert!(fp1.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn fingerprint_changes_with_content() {
        let mut project = sample();
        project.name = "Renamed".to_owned();
        assert_ne!(
            project.fingerprint().unwrap(),
            sample().fingerprint().unwrap()
        );
    }

    #[test]
    fn malformed_json_is_rejected() {
        assert!(ProjectFile::from_json(b"{ not json").is_err());
    }

    #[test]
    fn version_is_recorded() {
        assert_abs_diff_eq!(sample().version as f64, 1.0);
    }
}
