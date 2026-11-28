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
            ResponseKind::DisplacementUz => structure
                .beams
                .get(beam_index)
                .and_then(|b| node_dof(structure, b.n1, 2))
                .map_or(0.0, |i| {
                    solution.displacements.get(i).map_or(0.0, |v| v.abs())
                }),
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
    /// M12.2: vertical displacement `uz` of the member end-1 node (m/N —
    /// flexibility coefficient).
    DisplacementUz,
}

impl ResponseKind {
    /// Parses the studio/JSON response code (`uz`, `My`, `Vy`, `N`, `Rz`).
    #[must_use]
    pub fn parse(code: &str) -> Self {
        match code {
            "uz" => Self::DisplacementUz,
            "My" => Self::MomentMy,
            "Vy" => Self::ShearVz,
            "N" => Self::AxialEnd,
            _ => Self::ReactionSupport,
        }
    }

    /// Canonical JSON code of the response.
    #[must_use]
    pub fn code(self) -> &'static str {
        match self {
            Self::DisplacementUz => "uz",
            Self::MomentMy => "My",
            Self::ShearVz => "Vy",
            Self::AxialEnd => "N",
            Self::ReactionSupport => "Rz",
        }
    }
}

/// DOF index of one node's translation (0-based node position in the model).
fn node_dof(structure: &Structure, node_id: u32, dof: usize) -> Option<usize> {
    let position = structure.nodes.iter().position(|n| n.id == node_id)?;
    Some(6 * position + dof)
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

// ---------------------------------------------------------------------------
// M12.2 — custom axle trains (Pont roulant / Convoi personnalisé)
// ---------------------------------------------------------------------------

/// One moving axle train (M12.2): `n` wheel loads with `n − 1` axle
/// spacings, crossing a member. Covers the EN 1991-2 LM1 tandem
/// (`2 × 150 kN` wheels spaced `1.2 m` across the lane — merged into a
/// single line load by [`lm1_deck_loads`]) and arbitrary custom trains
/// (overhead bridge crane *Pont roulant* with 2..4 wheel loads, LM71
/// rail convoys, ...).
#[derive(Debug, Clone, PartialEq)]
pub struct AxleTrain {
    /// Wheel / axle loads in order (N, positive magnitudes).
    pub wheel_loads_n: Vec<f64>,
    /// Axle spacings between consecutive wheels (m, `len = wheels − 1`).
    pub axle_spacings_m: Vec<f64>,
    /// Transverse wheel spacing merged into a single line load (kept for
    /// the studio readout; the FE model takes the total axle force).
    pub wheel_spacing_m: f64,
}

impl AxleTrain {
    /// EN 1991-2 LM1 tandem: one axle `2 × 150 kN` (two 150 kN wheels
    /// spaced 1.2 m across the lane) per the simplified single-lane model.
    #[must_use]
    pub fn lm1_tandem() -> Self {
        Self {
            wheel_loads_n: vec![300_000.0],
            axle_spacings_m: Vec::new(),
            wheel_spacing_m: 1.2,
        }
    }

    /// Overhead bridge crane *Pont roulant*: two twin wheel pairs
    /// (`4 × wheel load`) with the end-carriage spacing.
    #[must_use]
    pub fn bridge_crane(wheel_n: f64, end_carriage_spacing_m: f64) -> Self {
        Self {
            wheel_loads_n: vec![wheel_n, wheel_n, wheel_n, wheel_n],
            axle_spacings_m: vec![end_carriage_spacing_m, 0.0, end_carriage_spacing_m],
            wheel_spacing_m: 0.0,
        }
    }

    /// Total train length (m).
    #[must_use]
    pub fn length_m(&self) -> f64 {
        self.axle_spacings_m.iter().sum()
    }

    /// Cumulative axle offsets from the leading wheel (m).
    #[must_use]
    pub fn axle_offsets(&self) -> Vec<f64> {
        let mut offsets = Vec::with_capacity(self.wheel_loads_n.len());
        let mut x = 0.0;
        for (i, _) in self.wheel_loads_n.iter().enumerate() {
            if i > 0 {
                x += self.axle_spacings_m.get(i - 1).copied().unwrap_or_default();
            }
            offsets.push(x);
        }
        offsets
    }
}

/// Governing moving-load envelope of one member crossed by an
/// [`AxleTrain`]: the train walks `n_positions + 1` placements from the
/// member start to its end and the response is superimposed from the
/// single `Variable` solve of each placement.
#[derive(Debug, Clone, serde::Serialize)]
pub struct TrainEnvelope {
    /// Maximum member end moment `My` (N·m, signed max).
    pub my_max: f64,
    /// Minimum member end moment `My` (N·m, signed min).
    pub my_min: f64,
    /// Maximum end shear magnitude `|Vz|` (N).
    pub vz_max: f64,
    /// Maximum axial magnitude `|N|` (N).
    pub n_max: f64,
    /// Maximum support reaction magnitude `|Rz|` (N).
    pub rz_max: f64,
    /// Maximum vertical displacement magnitude `|uz|` (m).
    pub uz_max: f64,
    /// Governing train position ratio of [`TrainEnvelope::my_max`] (0..1).
    pub governing_ratio: f64,
    /// Per-placement total vertical train load actually applied (N).
    pub train_total_n: f64,
}

/// Computes the [`TrainEnvelope`] of one member under a crossing train.
///
/// # Errors
///
/// Returns [`SolveError`] when any placement solve fails.
pub fn train_envelope(
    structure: &Structure,
    beam_index: usize,
    train: &AxleTrain,
    n_positions: usize,
) -> Result<TrainEnvelope, SolveError> {
    let Some(beam) = structure.beams.get(beam_index) else {
        return Err(SolveError::InvalidModel {
            message: format!("beam index {beam_index} out of range"),
        });
    };
    let beam_id = beam.id;
    let node =
        |id: u32| -> Option<&rdm_model::Node> { structure.nodes.iter().find(|n| n.id == id) };
    let (Some(p1), Some(p2)) = (
        node(beam.n1).map(|n| glam::DVec3::new(n.x, n.y, n.z)),
        node(beam.n2).map(|n| glam::DVec3::new(n.x, n.y, n.z)),
    ) else {
        return Err(SolveError::InvalidModel {
            message: format!("beam {} references missing nodes", beam.id),
        });
    };
    let span = (p2 - p1).length();
    let offsets = train.axle_offsets();
    let train_total = train.wheel_loads_n.iter().sum::<f64>();
    let mut my_max = 0.0_f64;
    let mut my_min = 0.0_f64;
    let mut vz_max = 0.0_f64;
    let mut n_max = 0.0_f64;
    let mut rz_max = 0.0_f64;
    let mut uz_max = 0.0_f64;
    let mut governing_ratio = 0.0_f64;
    for position in 0..=n_positions {
        let ratio = f64::from(position as u32) / f64::from(n_positions.clamp(1, 96) as u32);
        let mut s = structure.clone();
        for (load_n, offset) in train.wheel_loads_n.iter().zip(&offsets) {
            let x = ratio * span + *offset;
            let axle_ratio = if span > 1e-9 {
                (x / span).clamp(0.0, 1.0)
            } else {
                0.0
            };
            s.loads.push(Load {
                case: LoadCase::Variable,
                kind: LoadKind::PointOnSpan {
                    beam_id,
                    position_ratio: axle_ratio,
                    forces: rdm_model::GlobalForces {
                        fx: 0.0,
                        fy: 0.0,
                        fz: -load_n.abs(),
                        mx: 0.0,
                        my: 0.0,
                        mz: 0.0,
                    },
                },
            });
        }
        let solved = crate::static_sparse::solve_model(&s)?;
        let Some((_, sol)) = solved.cases.iter().find(|(c, _)| *c == LoadCase::Variable) else {
            continue;
        };
        let base = 12 * beam_index;
        let my = sol.beam_end_forces.get(base + 4).copied().unwrap_or(0.0);
        let vz = sol.beam_end_forces.get(base + 2).copied().unwrap_or(0.0);
        let n = sol.beam_end_forces.get(base).copied().unwrap_or(0.0);
        let rz = sol
            .reactions
            .iter()
            .step_by(6)
            .fold(0.0_f64, |m, r| m.max(r.abs()));
        let uz = sol
            .displacements
            .iter()
            .skip(2)
            .step_by(6)
            .fold(0.0_f64, |m, d| m.max(d.abs()));
        if my > my_max {
            governing_ratio = ratio;
        }
        my_max = my_max.max(my);
        my_min = my_min.min(my);
        vz_max = vz_max.max(vz.abs());
        n_max = n_max.max(n.abs());
        rz_max = rz_max.max(rz);
        uz_max = uz_max.max(uz);
    }
    Ok(TrainEnvelope {
        my_max,
        my_min,
        vz_max,
        n_max,
        rz_max,
        uz_max,
        governing_ratio,
        train_total_n: train_total,
    })
}
