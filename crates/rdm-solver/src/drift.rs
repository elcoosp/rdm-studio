//! Inter-storey drift check (M12.3): SLS relative displacement `d_r`
//! between consecutive storey levels against the EN 1993-1-1 Annex A
//! brittle-finishes limit `h/300` (or the stricter `h/500`).

use rdm_model::Structure;

use crate::static_sparse::{SolveError, superimpose};

/// One level's drift result.
#[derive(Debug, Clone, serde::Serialize)]
pub struct LevelDrift {
    /// Level elevation (m, global Z).
    pub elevation: f64,
    /// Display name (`RDC`, `R+1`, ... or `Niveau 1`).
    pub name: String,
    /// Storey height `h` down to the level below (m, 0 for the ground).
    pub storey_height_m: f64,
    /// Maximum relative SLS displacement `d_r` of the paired nodes (m).
    pub drift_m: f64,
    /// Utilization `d_r / h · 300` (or 500 per `limit`).
    pub ratio: f64,
    /// Drift limit applied (`300` or `500`).
    pub limit_denominator: u32,
    /// `d_r ≤ h / limit`.
    pub passed: bool,
}

/// Full drift report across the model's storey levels.
#[derive(Debug, Clone, serde::Serialize)]
pub struct StoreyDriftReport {
    /// One entry per level above the lowest (ground level skips).
    pub levels: Vec<LevelDrift>,
    /// Elevation of the ground reference level (lowest level).
    pub ground_elevation: f64,
}

/// Computes the SLS inter-storey drift between the consecutive storey
/// levels of `structure.levels`: nodes are paired vertically (same
/// horizontal coordinates) and `d_r = max |uz_top − uz_bottom|` under
/// the first SLS combination (`G + Q`, EN 1990).
///
/// # Errors
///
/// Returns [`SolveError`] when the model fails to solve.
pub fn interstorey_drift(
    structure: &Structure,
    limit_denominator: u32,
) -> Result<StoreyDriftReport, SolveError> {
    let mut levels = structure.levels.clone();
    levels.sort_by(|a, b| a.elevation.total_cmp(&b.elevation));
    let Some(lowest) = levels.first().map(|l| l.elevation) else {
        return Ok(StoreyDriftReport {
            levels: Vec::new(),
            ground_elevation: 0.0,
        });
    };
    let solved = crate::static_sparse::solve_model(structure)?;
    // First SLS superposition: every solved case contributes with its
    // EN 1990 characteristic weight (G, Q, W, S at 1.0; Acc excluded).
    let sls_weights: Vec<(rdm_model::LoadCase, f64)> = solved
        .cases
        .iter()
        .map(|(c, _)| match c {
            rdm_model::LoadCase::Acceleration => (*c, 0.0),
            _ => (*c, 1.0),
        })
        .collect();
    let (displacements, _reactions, _forces) = superimpose(&solved, &sls_weights)?;
    let uz = |node_id: u32| -> Option<f64> {
        let position = structure.nodes.iter().position(|n| n.id == node_id)?;
        displacements.get(6 * position + 2).copied()
    };

    let mut out = Vec::new();
    for window in levels.windows(2) {
        let (bottom, top) = (&window[0], &window[1]);
        let h = top.elevation - bottom.elevation;
        let mut drift = 0.0_f64;
        // Pair every top-level node with the nearest bottom-level node
        // sharing its horizontal footprint (same column line within 1 cm).
        for top_node in &structure.nodes {
            if (top_node.z - top.elevation).abs() > 1.0e-6 {
                continue;
            }
            let Some(bottom_node) = structure.nodes.iter().find(|n| {
                (n.z - bottom.elevation).abs() <= 1.0e-6
                    && (n.x - top_node.x).hypot(n.y - top_node.y) <= 0.01
            }) else {
                continue;
            };
            if let (Some(u_top), Some(u_bottom)) = (uz(top_node.id), uz(bottom_node.id)) {
                drift = drift.max((u_top - u_bottom).abs());
            }
        }
        let ratio = if h > 1.0e-9 {
            drift / h * f64::from(limit_denominator)
        } else {
            0.0
        };
        out.push(LevelDrift {
            elevation: top.elevation,
            name: top
                .name
                .clone()
                .unwrap_or_else(|| format!("Z = {:.2} m", top.elevation)),
            storey_height_m: h,
            drift_m: drift,
            ratio,
            limit_denominator,
            passed: ratio <= 1.0,
        });
    }
    Ok(StoreyDriftReport {
        levels: out,
        ground_elevation: lowest,
    })
}
