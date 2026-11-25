//! Section cuts (v1.0.0 engine completion, ARCHITECTURE.md §5
//! `section_cut.rs`): n-point span sampling of the superimposed internal
//! forces and a 2D `σ_vM(y, z)` cross-section stress grid for the Step 4
//! thermal heatmap.
//!
//! The bending/axial stresses are exact for the reconstructed internal
//! forces; the shear contribution uses a thin-walled approximation
//! (`τ = 1.5·V/A` at the neutral axis, fading to zero at the flange tips),
//! documented as a visualization-grade estimate.

use rdm_model::{SectionProperties, SectionShape, Structure};

use crate::internal_forces::{StationForces, station_forces};
use crate::loads::{LoadVectorError, build_elements};
use crate::results::SpanLoads;
use crate::results::span_loads_local;
use crate::static_sparse::SolvedModel;
use rdm_model::LoadCase;

/// One point of the stress grid.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct StressPoint {
    /// Local horizontal coordinate (m, section width axis).
    pub y: f64,
    /// Local vertical coordinate (m, section depth axis).
    pub z: f64,
    /// Von Mises equivalent stress (Pa).
    pub sigma_vm: f64,
}

/// 2D cross-section stress grid.
#[derive(Debug, Clone, PartialEq)]
pub struct StressGrid {
    /// Section outline extremes `(y_min, y_max, z_min, z_max)` in m.
    pub bounds: (f64, f64, f64, f64),
    /// Grid points.
    pub points: Vec<StressPoint>,
}

/// Superimposed mechanical state of one beam under a combination.
#[derive(Debug, Clone)]
pub struct BeamState {
    /// Superimposed element end forces `[12]` (N / N·m).
    pub end_forces: Vec<f64>,
    /// Weighted span loads (local axes).
    pub spans: SpanLoads,
    /// Member length (m).
    pub length: f64,
}

/// Superposes end forces and span loads of `beam_index` over a combination.
///
/// `weights` maps each elementary case to its combination factor.
///
/// # Errors
///
/// Returns [`LoadVectorError`] when element data or property lookups fail.
pub fn superimposed_beam_state(
    structure: &Structure,
    solved: &SolvedModel,
    weights: &[(LoadCase, f64)],
    beam_index: usize,
) -> Result<BeamState, LoadVectorError> {
    let elements = build_elements(structure)?;
    let data = &elements[beam_index];
    let beam = &structure.beams[beam_index];
    let n1 = structure
        .node(beam.n1)
        .map_err(|_| LoadVectorError::UnknownProperty(beam.id))?;
    let n2 = structure
        .node(beam.n2)
        .map_err(|_| LoadVectorError::UnknownProperty(beam.id))?;
    let length = ((n2.x - n1.x).powi(2) + (n2.y - n1.y).powi(2) + (n2.z - n1.z).powi(2)).sqrt();

    let mut end_forces = vec![0.0f64; 12];
    let mut spans = SpanLoads::default();
    for (case, weight) in weights {
        if *weight == 0.0 {
            continue;
        }
        if let Some(per_case) = solved
            .cases
            .iter()
            .find(|(c, _)| *c == *case)
            .map(|(_, solution)| solution.beam_end_forces.as_slice())
        {
            let block = 12 * beam_index;
            if block + 12 <= per_case.len() {
                for i in 0..12 {
                    end_forces[i] += weight * per_case[block + i];
                }
            }
        }
        let case_spans = span_loads_local(structure, data, *case)?;
        for &(a, fy, fz) in &case_spans.points {
            spans.points.push((a, weight * fy, weight * fz));
        }
        for &(qy1, qy2, qz1, qz2) in &case_spans.trapezoids {
            spans
                .trapezoids
                .push((weight * qy1, weight * qy2, weight * qz1, weight * qz2));
        }
    }
    Ok(BeamState {
        end_forces,
        spans,
        length,
    })
}

/// Internal forces at `n_ratios` evenly spaced stations of the member.
///
/// # Errors
///
/// Returns [`LoadVectorError`] when span assembly fails.
pub fn beam_forces_at(
    state: &BeamState,
    n_ratios: usize,
) -> Result<Vec<(f64, StationForces)>, LoadVectorError> {
    let n = n_ratios.max(2);
    Ok((0..n)
        .map(|i| {
            let a = f64::from(i as u32) / f64::from((n - 1) as u32);
            let forces = station_forces(&state.end_forces, &state.spans, state.length, a);
            (a, forces)
        })
        .collect())
}

/// Computes the `σ_vM(y, z)` grid over the section outline.
///
/// `grid_n` points per shape part (total ≈ `5 × grid_n`). The grid lies in
/// the local section axes: `y` horizontal, `z` vertical (strong axis).
pub fn von_mises_grid(
    section: &SectionProperties,
    forces: StationForces,
    grid_n: usize,
) -> StressGrid {
    let parts = outline_rectangles(section);
    let (y_min, y_max, z_min, z_max) = section_bounds(&parts);
    let n = grid_n.max(3);
    let mut points = Vec::with_capacity(parts.len() * n);
    for (y0, y1, z0, z1, thickness_axis) in parts {
        for i in 0..n {
            // Fraction along the long axis determines the shear fade.
            let t = f64::from(i as u32) / f64::from((n - 1) as u32);
            let (y, z, fade) = if thickness_axis {
                // Vertical part (web): sample z, fixed thin y.
                let y_mid = f64::midpoint(y0, y1);
                let z = z0 + t * (z1 - z0);
                let mid = ((z - f64::midpoint(z0, z1)) / ((z1 - z0) / 2.0)).abs();
                (y_mid, z, (1.0 - mid * mid).max(0.0))
            } else {
                // Horizontal part (flange/leg): sample y, fixed thin z.
                let z_mid = f64::midpoint(z0, z1);
                let y = y0 + t * (y1 - y0);
                let mid = ((y - f64::midpoint(y0, y1)) / ((y1 - y0) / 2.0)).abs();
                (y, z_mid, (1.0 - mid * mid).max(0.0))
            };
            let sigma = forces.n_axial / section.a + forces.my * z / section.iy
                - forces.mz * y / section.iz;
            // Thin-wall shear estimate: peak 1.5·V/A at the neutral axis.
            let tau = 1.5 * forces.vz / section.a * fade;
            let sigma_vm = (sigma * sigma + 3.0 * tau * tau).sqrt();
            points.push(StressPoint { y, z, sigma_vm });
        }
    }
    StressGrid {
        bounds: (y_min, y_max, z_min, z_max),
        points,
    }
}

/// Outline rectangles `(y0, y1, z0, z1, vertical)` of the section shape.
fn outline_rectangles(section: &SectionProperties) -> Vec<(f64, f64, f64, f64, bool)> {
    let h = section.h.unwrap_or(0.1);
    let b = section.b.unwrap_or(0.1);
    let tw = section.tw.unwrap_or(0.01);
    let tf = section.tf.unwrap_or(0.01);
    match section.shape {
        SectionShape::DoubleSymmetricI | SectionShape::Channel => {
            let flange_y_offset = if section.shape == SectionShape::Channel {
                // UPN/UPE: single-sided flanges (web on the -y side).
                -b / 4.0
            } else {
                0.0
            };
            if section.shape == SectionShape::Channel {
                // Web on the +y edge, two flanges towards -y.
                vec![
                    (
                        (b / 2.0 - tw / 2.0) + flange_y_offset,
                        b / 2.0 + flange_y_offset,
                        -h / 2.0,
                        h / 2.0,
                        true,
                    ),
                    (
                        -b / 2.0 + flange_y_offset,
                        -b / 2.0 + tf + flange_y_offset,
                        -h / 2.0,
                        -h / 2.0 + tf,
                        false,
                    ),
                    (
                        -b / 2.0 + flange_y_offset,
                        -b / 2.0 + tf + flange_y_offset,
                        h / 2.0 - tf,
                        h / 2.0,
                        false,
                    ),
                ]
            } else {
                vec![
                    (-tw / 2.0, tw / 2.0, -h / 2.0 + tf, h / 2.0 - tf, true),
                    (-b / 2.0, b / 2.0, h / 2.0 - tf, h / 2.0, false),
                    (-b / 2.0, b / 2.0, -h / 2.0, -h / 2.0 + tf, false),
                ]
            }
        }
        SectionShape::CircularHollow => {
            // Approximated by the bounding box walls for grid purposes.
            let r = h / 2.0;
            vec![
                (-r, r, -r, -r + tf, false),
                (-r, r, r - tf, r, false),
                (-r, -r + tf, -r + tf, r - tf, true),
                (r - tf, r, -r + tf, r - tf, true),
            ]
        }
        SectionShape::RectangularHollow => vec![
            (-b / 2.0, b / 2.0, -h / 2.0, -h / 2.0 + tf, false),
            (-b / 2.0, b / 2.0, h / 2.0 - tf, h / 2.0, false),
            (-b / 2.0, -b / 2.0 + tf, -h / 2.0 + tf, h / 2.0 - tf, true),
            (b / 2.0 - tf, b / 2.0, -h / 2.0 + tf, h / 2.0 - tf, true),
        ],
        SectionShape::Angle => vec![
            (-b / 2.0, b / 2.0, h / 2.0 - tf, h / 2.0, false),
            (-b / 2.0, -b / 2.0 + tw, -h / 2.0, h / 2.0 - tf, true),
        ],
        SectionShape::General => {
            // Solid rectangle fallback from h × b (conservative envelope).
            vec![(-b / 2.0, b / 2.0, -h / 2.0, h / 2.0, false)]
        }
    }
}

fn section_bounds(parts: &[(f64, f64, f64, f64, bool)]) -> (f64, f64, f64, f64) {
    let (mut y0, mut y1, mut z0, mut z1) = (
        f64::INFINITY,
        f64::NEG_INFINITY,
        f64::INFINITY,
        f64::NEG_INFINITY,
    );
    for &(py0, py1, pz0, pz1, _) in parts {
        y0 = y0.min(py0);
        y1 = y1.max(py1);
        z0 = z0.min(pz0);
        z1 = z1.max(pz1);
    }
    (y0, y1, z0, z1)
}
