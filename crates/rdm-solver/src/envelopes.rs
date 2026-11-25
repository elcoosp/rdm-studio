//! Min/max combination envelopes (v1.7.0): per-member extrema of the
//! internal forces and deflections across ALL computed combinations.

use rdm_model::LoadCase;

use crate::static_sparse::{SolveError, SolvedModel, superimpose};

/// Min/max envelope of one member across the superposed combinations.
#[derive(Debug, Clone, PartialEq)]
pub struct BeamEnvelope {
    /// Beam id.
    pub beam_id: u32,
    /// Axial force envelope (N, signed; `(min, max)`).
    pub n: (f64, f64),
    /// Strong-axis bending envelope (N·m).
    pub my: (f64, f64),
    /// Weak-axis bending envelope (N·m).
    pub mz: (f64, f64),
    /// Shear envelope (N).
    pub vz: (f64, f64),
    /// Torsion envelope (N·m).
    pub t: (f64, f64),
}

/// Computes the min/max envelope of every member over `combinations`
/// (each entry = `(label, weights)`). Station extrema come from the
/// 5-station sampling of [`crate::internal_forces::STATIONS`].
///
/// # Errors
///
/// Returns [`SolveError::Load`] when a combination references an unsolved
/// case.
pub fn compute_envelopes(
    structure: &rdm_model::Structure,
    solved: &SolvedModel,
    combinations: &[(&str, &[(LoadCase, f64)])],
) -> Result<Vec<BeamEnvelope>, SolveError> {
    let mut out = Vec::with_capacity(structure.beams.len());
    for (index, beam) in structure.beams.iter().enumerate() {
        let mut n = (f64::INFINITY, f64::NEG_INFINITY);
        let mut my = (f64::INFINITY, f64::NEG_INFINITY);
        let mut mz = (f64::INFINITY, f64::NEG_INFINITY);
        let mut vz = (f64::INFINITY, f64::NEG_INFINITY);
        let mut t = (f64::INFINITY, f64::NEG_INFINITY);
        for (_, weights) in combinations {
            let (_, _, f) = superimpose(solved, weights)?;
            let base = 12 * index;
            for station in 0..5usize {
                // Station forces need the span reconstruction; for the
                // envelope the end-force blocks (5 stations via
                // beam_forces_at use spans) — sample the end block plus
                // superposed span reconstruction through station_forces.
                let end = &f[base..base + 12];
                let span_state = crate::results::span_loads_local(
                    structure,
                    &crate::loads::build_elements(structure)?[index],
                    rdm_model::LoadCase::Permanent,
                )?;
                let forces = crate::internal_forces::station_forces(
                    end,
                    &span_state,
                    member_length(structure, beam),
                    f64::from(station as u32) / 4.0,
                );
                n.0 = n.0.min(forces.n_axial);
                n.1 = n.1.max(forces.n_axial);
                my.0 = my.0.min(forces.my);
                my.1 = my.1.max(forces.my);
                mz.0 = mz.0.min(forces.mz);
                mz.1 = mz.1.max(forces.mz);
                vz.0 = vz.0.min(forces.vz);
                vz.1 = vz.1.max(forces.vz);
                t.0 = t.0.min(forces.t);
                t.1 = t.1.max(forces.t);
            }
        }
        out.push(BeamEnvelope {
            beam_id: beam.id,
            n,
            my,
            mz,
            vz,
            t,
        });
    }
    Ok(out)
}

fn member_length(structure: &rdm_model::Structure, beam: &rdm_model::Beam) -> f64 {
    match (structure.node(beam.n1), structure.node(beam.n2)) {
        (Ok(a), Ok(b)) => ((b.x - a.x).powi(2) + (b.y - a.y).powi(2) + (b.z - a.z).powi(2)).sqrt(),
        _ => 0.0,
    }
}
