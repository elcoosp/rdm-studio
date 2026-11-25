//! EN 1991 action generators (v1.7.0): imposed loads (EN 1991-1-1),
//! snow (EN 1991-1-3) and wind (EN 1991-1-4) — each returns the loads
//! to append to a model for the matching elementary case.

use rdm_model::{Direction, GlobalForces, Load, LoadCase, LoadKind};

/// Imposed-load categories of EN 1991-1-1 Table 6.2 (recommended `q_k`
/// and `Q_k` values, kN/m² and kN).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImposedCategory {
    /// Category A — residential (floors: 2.0 kN/m²).
    A,
    /// Category B — offices (3.0 kN/m²).
    B,
    /// Category C — congregation (4.0 kN/m²).
    C,
    /// Category D — shopping (5.0 kN/m²).
    D,
    /// Category E — storage (7.5 kN/m²).
    E,
}

/// Recommended `q_k` of the category (kN/m² → N/m²).
#[must_use]
pub fn imposed_qk(category: ImposedCategory) -> f64 {
    match category {
        ImposedCategory::A => 2_000.0,
        ImposedCategory::B => 3_000.0,
        ImposedCategory::C => 4_000.0,
        ImposedCategory::D => 5_000.0,
        ImposedCategory::E => 7_500.0,
    }
}

/// Builds a downward uniformly distributed imposed load per member.
#[must_use]
pub fn imposed_load(beam_id: u32, category: ImposedCategory, tributary_width_m: f64) -> Load {
    let q = imposed_qk(category) * tributary_width_m;
    Load {
        case: LoadCase::Variable,
        kind: LoadKind::Trapezoid {
            beam_id,
            q_start: q,
            q_end: q,
            direction: Direction::gravity(),
            a_start: None,
            a_end: None,
            local_axes: None,
        },
    }
}

/// Snow load (EN 1991-1-3 §5.2): `s = μ1 · Ce · Ct · sk` for a monopitch
/// roof; `μ1` interpolates on the roof slope (0.8 up to 15°, then the
/// 15°..60° linear branch down to 0.8 at 60°).
#[must_use]
pub fn snow_load(beam_id: u32, sk: f64, roof_slope_deg: f64, tributary_width_m: f64) -> Load {
    let alpha = roof_slope_deg.clamp(0.0, 60.0);
    // EN 1991-1-3 Table 5.2: μ1 = 0.8 up to 30°, linear 0.8 → 0 to 60°.
    let mu1 = if alpha <= 30.0 {
        0.8
    } else {
        0.8 * (60.0 - alpha) / 30.0
    };
    let s = mu1 * 1.0 * 1.0 * sk * tributary_width_m;
    Load {
        case: LoadCase::Snow,
        kind: LoadKind::Trapezoid {
            beam_id,
            q_start: s,
            q_end: s,
            direction: Direction::gravity(),
            a_start: None,
            a_end: None,
            local_axes: None,
        },
    }
}

/// Wind base velocity parameters (EN 1991-1-4 §4).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct WindParameters {
    /// Basic wind velocity `vb` (m/s).
    pub vb: f64,
    /// Reference height `z` (m) for the profile.
    pub z: f64,
    /// Terrain category factor (0 = I rough sea .. 4 = urban; k_r, z_min
    /// bundled here as a single exposure multiplier for the generator).
    pub exposure: f64,
    /// Force coefficient `c_f` of the member (Table 7.6 shape factor).
    pub cf: f64,
    /// Member tributary area (m²).
    pub area_m2: f64,
}

/// Peak velocity pressure `q_p(z)` (N/m²) with the §4.5 recommended
/// expression `q_p = (1 + 7·Iv) · ½ρ·v_m²`, simplified to the exposure
/// bundle of [`WindParameters`].
#[must_use]
pub fn peak_velocity_pressure(p: &WindParameters) -> f64 {
    let rho_air = 1.25;
    let v = p.vb * p.exposure;
    1.25 * 0.5 * rho_air * v * v * 2.0
}

/// Horizontal wind force `Fw = cf · qp(z) · A` applied along +Y (N).
#[must_use]
pub fn wind_load(beam_id: u32, p: &WindParameters) -> Load {
    let force = p.cf * peak_velocity_pressure(p) * p.area_m2;
    Load {
        case: LoadCase::Wind,
        kind: LoadKind::Nodal {
            node_id: beam_id,
            forces: GlobalForces {
                fx: 0.0,
                fy: force,
                fz: 0.0,
                mx: 0.0,
                my: 0.0,
                mz: 0.0,
            },
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_abs_diff_eq;

    #[test]
    fn imposed_categories_match_recommended_values() {
        assert_abs_diff_eq!(imposed_qk(ImposedCategory::A), 2000.0);
        assert_abs_diff_eq!(imposed_qk(ImposedCategory::E), 7500.0);
    }

    #[test]
    fn snow_mu1_branches_match_table_5_2() {
        let flat = snow_load(1, 1000.0, 10.0, 1.0);
        let LoadKind::Trapezoid { q_start, .. } = flat.kind else {
            panic!("trapezoid expected");
        };
        assert_abs_diff_eq!(q_start, 800.0, epsilon = 1e-9);
        let steep = snow_load(1, 1000.0, 60.0, 1.0);
        let LoadKind::Trapezoid { q_start, .. } = steep.kind else {
            panic!("trapezoid expected");
        };
        assert_abs_diff_eq!(q_start, 0.0, epsilon = 1e-9);
    }

    #[test]
    fn wind_force_scales_with_area_and_cf() {
        let p = WindParameters {
            vb: 28.0,
            z: 10.0,
            exposure: 1.0,
            cf: 1.3,
            area_m2: 2.0,
        };
        let load = wind_load(1, &p);
        let LoadKind::Nodal { forces, .. } = load.kind else {
            panic!("nodal expected");
        };
        assert!(forces.fy > 0.0);
        assert_abs_diff_eq!(
            forces.fy,
            1.3 * peak_velocity_pressure(&p) * 2.0,
            epsilon = 1e-6
        );
    }
}
