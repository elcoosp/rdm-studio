//! CAD import (v1.0.0 engine completion, ARCHITECTURE.md §5 `rdm-cad`):
//! DXF entity extraction, coincident-node merging (tolerance `ε`) and
//! T/X intersection splitting for wireframe structural models.
//!
//! SI units: DXF coordinates are consumed as metres. `LINE` entities
//! become member segments; `LWPOLYLINE` / `POLYLINE` vertices become
//! consecutive segments.

pub mod dxf_importer;
pub mod topology_cleaner;

pub use dxf_importer::{import_dxf, RawSegment};
pub use topology_cleaner::{clean_topology, Topology, TopologyError};

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
