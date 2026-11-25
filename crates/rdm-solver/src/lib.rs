//! 3D finite-element static solver for RDM Studio.
//!
//! Pure Rust, strict SI units, no web dependencies. The public API solves
//! each elementary load case once through a sparse Cholesky `LLᵀ`
//! factorization (faer, CSC assembly) and returns per-case displacements,
//! reactions and local beam end forces; ULS/SLS superposition is delegated
//! to `rdm-eurocode` (linear superposition, ARCHITECTURE.md §4).

pub mod buckling;
pub mod envelopes;
pub mod internal_forces;
pub mod loads;
pub mod modal;
pub mod moving_loads;
pub mod p_delta;
pub mod results;
pub mod section_cut;
pub mod seismic;
pub mod static_sparse;
pub mod stiffness;
pub mod validation;

pub use buckling::{BucklingMode, BucklingReport, buckling_analysis, geometric_stiffness_local};
pub use envelopes::{BeamEnvelope, compute_envelopes};
pub use internal_forces::{STATIONS, StationForces, station_envelope, station_forces};
pub use loads::{
    BeamElementData, LoadVectorError, assemble_case_vector, beam_case_load_local,
    build_case_element, build_elements, scatter_element_load,
};
pub use modal::{ModalError, ModalReport, ModeShape, modal_analysis};
pub use moving_loads::{Lm1Loads, ResponseKind, influence_line, lm1_deck_loads, tandem_envelope};
pub use p_delta::{PDeltaReport, p_delta_solve};
pub use results::{SpanLoads, beam_deflection_at, midspan_deflection_metric, span_loads_local};
pub use section_cut::{
    BeamState, StressGrid, StressPoint, beam_forces_at, superimposed_beam_state, von_mises_grid,
};
pub use seismic::{
    GroundType, ModalResponse, SpectrumType, combine_cqc, combine_srss, cumulative_mass_ratio,
    elastic_spectrum, spectrum_parameters,
};
pub use static_sparse::{BucklingError, permanent_axial_forces};
pub use static_sparse::{CaseSolution, SolveError, SolvedModel, solve_model, superimpose};
pub use stiffness::{LocalFrame, beam_local_frame, local_stiffness_matrix};
pub use validation::{BenchResult, run_validation_suite};

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
