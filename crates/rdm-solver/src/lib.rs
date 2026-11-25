//! 3D finite-element static solver for RDM Studio.
//!
//! Pure Rust, strict SI units, no web dependencies. The public API solves
//! each elementary load case once through a sparse Cholesky `LLᵀ`
//! factorization (faer, CSC assembly) and returns per-case displacements,
//! reactions and local beam end forces; ULS/SLS superposition is delegated
//! to `rdm-eurocode` (linear superposition, ARCHITECTURE.md §4).

pub mod loads;
pub mod results;
pub mod static_sparse;
pub mod stiffness;

pub use loads::{
    BeamElementData, LoadVectorError, assemble_case_vector, beam_case_load_local,
    build_case_element, build_elements, scatter_element_load,
};
pub use results::{SpanLoads, beam_deflection_at, midspan_deflection_metric, span_loads_local};
pub use static_sparse::{CaseSolution, SolveError, SolvedModel, solve_model, superimpose};
pub use stiffness::{LocalFrame, beam_local_frame, local_stiffness_matrix};

use rdm_model::Structure;

/// Convenience: validate + solve in one call.
///
/// # Errors
///
/// Returns [`SolveError::InvalidModel`] when `rdm_model::validate_model`
/// rejects the structure, or the factorization/solve errors otherwise.
pub fn validate_and_solve(structure: &Structure) -> Result<SolvedModel, SolveError> {
    rdm_model::validate_model(structure).map_err(|issues| SolveError::InvalidModel {
        message: issues
            .iter()
            .map(|issue| issue.message.clone())
            .collect::<Vec<_>>()
            .join("; "),
    })?;
    solve_model(structure)
}
