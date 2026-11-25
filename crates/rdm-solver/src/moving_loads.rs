//! Influence lines & simplified EN 1991-2 LM1 moving loads (v1.9.0).

use rdm_model::{Direction, Load, LoadCase, LoadKind, Structure};

use crate::static_sparse::{SolveError, superimpose};

/// LM1 lane loads of EN 1991-2 Table 4.2 (simplified single-lane):
/// tandem system `TS = 300 kN` (two 150 kN wheels) plus the
/// uniformly distributed `UDL = 9 kN/m²` on the 3 m lane width.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Lm1Loads {
    /// Tandem-system axle load per wheel (N; 150 kN each, 300 kN per axle).
    pub ts_wheel_n: f64,
    /// Distributed lane load (N/m²).
    pub udl_n_m2: f64,
    /// Lane width (m).
    pub lane_width_m: f64,
}

impl Default for Lm1Loads {
    fn default() -> Self {
        Self {
            ts_wheel_n: 150_000.0,
            udl_n_m2: 9_000.0,
            lane_width_m: 3.0,
        }
    }
}

/// Influence line of a response function along one beam: unit vertical
/// load at `n_stations + 1` positions, response = `R(x)` (N per N).
///
/// # Errors
///
/// Returns [`SolveError`] when any station solve fails.
pub fn influence_line(
    structure: &Structure,
    beam_index: usize,
    response: ResponseKind,
    n_stations: usize,
) -> Result<Vec<f64>, SolveError> {
    let mut out = Vec::with_capacity(n_stations + 1);
    for station in 0..=n_stations {
        let ratio = f64::from(station as u32) / f64::from(n_stations as u32);
        let mut s = structure.clone();
        s.loads.push(Load {
            case: LoadCase::Variable,
            kind: LoadKind::PointOnSpan {
                beam_id: structure.beams.get(beam_index).map_or(u32::MAX, |b| b.id),
                position_ratio: ratio,
                forces: rdm_model::GlobalForces {
                    fx: 0.0,
                    fy: 0.0,
                    fz: -1.0,
                    mx: 0.0,
                    my: 0.0,
                    mz: 0.0,
                },
            },
        });
        let solved = crate::static_sparse::solve_model(&s)?;
        let Some((_, solution)) = solved.cases.iter().find(|(c, _)| *c == LoadCase::Variable)
        else {
            out.push(0.0);
            continue;
        };
        let base = 12 * beam_index;
        let value = match response {
            ResponseKind::ReactionSupport => solution.reactions[2],
            ResponseKind::AxialEnd => solution.beam_end_forces.get(base).map_or(0.0, |f| -*f),
            ResponseKind::MomentMy => solution
                .beam_end_forces
                .get(base + 4)
                .map_or(0.0, |f| f.abs()),
            ResponseKind::ShearVz => solution
                .beam_end_forces
                .get(base + 2)
                .map_or(0.0, |f| f.abs()),
        };
        out.push(value);
    }
    Ok(out)
}

/// Response functions covered by the influence-line scan.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResponseKind {
    /// Vertical support reaction of node 1.
    ReactionSupport,
    /// Member axial force at end 1.
    AxialEnd,
    /// Strong-axis end moment magnitude.
    MomentMy,
    /// End shear magnitude.
    ShearVz,
}

/// Applies the LM1 lane loads to a deck beam: the UDL over the full
/// span plus the tandem pair placed at `position_ratio` (two wheels
/// spaced 1.2 m across the lane are merged into one line load).
///
/// # Errors
///
/// Returns [`rdm_model::LoadError::ZeroDirection`] indirectly via the
/// shared `Direction::gravity()` constant (never zero).
#[must_use]
pub fn lm1_deck_loads(beam_id: u32, span_m: f64, position_ratio: f64) -> Vec<Load> {
    let _ = span_m;
    let lm1 = Lm1Loads::default();
    let udl = lm1.udl_n_m2 * lm1.lane_width_m;
    let tandem = 2.0 * lm1.ts_wheel_n;
    vec![
        Load {
            case: LoadCase::Variable,
            kind: LoadKind::Trapezoid {
                beam_id,
                q_start: -udl,
                q_end: -udl,
                direction: Direction::gravity(),
                a_start: None,
                a_end: None,
                local_axes: None,
            },
        },
        Load {
            case: LoadCase::Variable,
            kind: LoadKind::PointOnSpan {
                beam_id,
                position_ratio: position_ratio.clamp(0.0, 1.0),
                forces: rdm_model::GlobalForces {
                    fx: 0.0,
                    fy: 0.0,
                    fz: -tandem,
                    mx: 0.0,
                    my: 0.0,
                    mz: 0.0,
                },
            },
        },
    ]
}

/// Max response of a beam under the tandem crossing the span
/// (`n_positions` tandem placements, response via superposition).
///
/// # Errors
///
/// Returns [`SolveError`] when a placement solve fails.
pub fn tandem_envelope(
    structure: &Structure,
    beam_index: usize,
    n_positions: usize,
) -> Result<f64, SolveError> {
    let mut max_abs = 0.0_f64;
    for position in 0..=n_positions {
        let ratio = f64::from(position as u32) / f64::from(n_positions as u32);
        let mut s = structure.clone();
        s.loads.push(Load {
            case: LoadCase::Variable,
            kind: LoadKind::PointOnSpan {
                beam_id: structure.beams.get(beam_index).map_or(u32::MAX, |b| b.id),
                position_ratio: ratio,
                forces: rdm_model::GlobalForces {
                    fx: 0.0,
                    fy: 0.0,
                    fz: -300_000.0,
                    mx: 0.0,
                    my: 0.0,
                    mz: 0.0,
                },
            },
        });
        let solved = crate::static_sparse::solve_model(&s)?;
        let (_, sol, _) = superimpose(&solved, &[(LoadCase::Variable, 1.0)])?;
        let v = sol[2].abs();
        max_abs = max_abs.max(v);
    }
    Ok(max_abs)
}
