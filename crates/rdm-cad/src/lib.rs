//! CAD import (v1.0.0 engine completion, ARCHITECTURE.md §5 `rdm-cad`):
//! DXF entity extraction, coincident-node merging (tolerance `ε`) and
//! T/X intersection splitting for wireframe structural models.
//!
//! SI units: DXF coordinates are consumed as metres. `LINE` entities
//! become member segments; `LWPOLYLINE` / `POLYLINE` vertices become
//! consecutive segments.

pub mod dxf_importer;
pub mod step_importer;
pub mod topology_cleaner;

pub use dxf_importer::{import_dxf, RawSegment};
pub use step_importer::import_step_or_iges;
pub use topology_cleaner::{clean_topology, Topology, TopologyError};

/// CAD format flavours accepted by [`import_cad`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CadFormat {
    /// AutoCAD DXF (`LINE` / `LWPOLYLINE` / `POLYLINE` entities).
    Dxf,
    /// ISO-10303-21 STEP (`LINE` / `TRIMMED_CURVE` entities).
    Step,
    /// IGES (`110` Line entities).
    Iges,
}

/// Detects the CAD flavour from a filename extension (case-insensitive).
#[must_use]
pub fn detect_cad_format(filename: &str) -> Option<CadFormat> {
    let ext = std::path::Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase);
    match ext.as_deref() {
        Some("dxf") => Some(CadFormat::Dxf),
        Some("step" | "stp") => Some(CadFormat::Step),
        Some("igs" | "iges") => Some(CadFormat::Iges),
        _ => None,
    }
}

/// Extracts raw segments from any supported CAD payload, dispatching on the
/// filename extension (`import_cad`, v1.3.0).
///
/// # Errors
///
/// Returns [`CadError::Parse`] for unknown extensions or malformed
/// payloads and [`CadError::Empty`] when nothing importable remains.
pub fn import_cad(bytes: &[u8], filename: &str) -> Result<Vec<RawSegment>, CadError> {
    match detect_cad_format(filename) {
        Some(CadFormat::Dxf) => import_dxf(bytes),
        Some(CadFormat::Step | CadFormat::Iges) => import_step_or_iges(bytes),
        None => Err(CadError::Parse(format!(
            "unsupported CAD extension: {filename}"
        ))),
    }
}

/// Import errors.
#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum CadError {
    /// The DXF payload could not be parsed.
    #[error("dxf parse error: {0}")]
    Parse(String),
    /// The drawing contains no usable entities.
    #[error("no importable entities found")]
    Empty,
}
