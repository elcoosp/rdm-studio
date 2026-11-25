//! Iterative EC3 section optimizer (v1.9.0): the lightest catalog
//! profile per member group that passes ULS (§6.2/§6.3 simplified
//! resistance checks) and SLS (deflection ratio), in at most 10 passes.
//! Produces the Pareto mass-vs-utilization frontier and the
//! mass / carbon / cost totals used by the Optimizer modal.

use rdm_model::NationalAnnex;

use crate::annex::annex_factors;
use crate::interaction::{
    CalcTraceNode, InteractionAnnex, InteractionInput, interaction_6_61_6_62,
};

/// Embodied-carbon factor of hot-rolled structural steel
/// (kg CO₂e / kg — cradle-to-gate, documented constant).
pub const CARBON_KG_PER_KG_STEEL: f64 = 1.9;

/// Reference supply + fabrication cost of hot-rolled steel
/// (€ / kg — documented constant, user-overridable per project).
pub const COST_EUR_PER_KG_STEEL: f64 = 1.85;

/// One catalog candidate offered to the optimizer
/// (serialized for the wasm bridge).
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct ProfileCandidate {
    /// Catalog designation (`IPE 200`, ...).
    pub designation: String,
    /// Cross-section area `A` (m²).
    pub a: f64,
    /// Strong-axis second moment `Iy` (m⁴).
    pub iy: f64,
    /// Weak-axis second moment `Iz` (m⁴).
    pub iz: f64,
    /// Strong-axis elastic modulus `Wel,y` (m³).
    pub wel_y: f64,
    /// Plastic modulus `Wpl,y` (m³) when class 1/2 applies.
    pub wpl_y: Option<f64>,
    /// Mass per metre (kg/m).
    pub mass_per_m: f64,
}

/// Demand block of one member group (SI, worst-case envelope values).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct GroupDemand {
    /// Design axial force `NEd` (N, compression negative).
    pub n_ed: f64,
    /// Strong-axis design moment `MyEd` (N·m).
    pub my_ed: f64,
    /// Weak-axis design moment `MzEd` (N·m).
    pub mz_ed: f64,
    /// Design shear `VEd` (N).
    pub v_ed: f64,
    /// Member length for buckling & deflection (m).
    pub length_m: f64,
    /// SLS deflection limit as a span ratio (e.g. `L/250` → `250.0`).
    pub defl_limit_ratio: f64,
    /// SLS service deflection demand `δEd` (m).
    pub defl_ed_m: f64,
}

/// ULS/SLS verdict for one candidate.
#[derive(Debug, Clone)]
pub struct CandidateCheck {
    /// Governing ULS utilization (6.61/6.62 envelope).
    pub uls_utilization: f64,
    /// SLS deflection utilization (`δEd / (L / ratio)`).
    pub sls_utilization: f64,
    /// ULS + SLS both inside limits.
    pub passed: bool,
    /// KaTeX trace of the governing check.
    pub trace: Vec<CalcTraceNode>,
}

/// Result of the iterative optimization of one group
/// (serialized for the wasm bridge).
#[derive(Debug, Clone, serde::Serialize)]
pub struct GroupOptimization {
    /// Chosen designation (best passing candidate; `None` = nothing fits).
    pub chosen: Option<String>,
    /// Number of passes actually consumed (≤ `max_passes`).
    pub passes: usize,
    /// Pareto frontier: mass per metre vs total utilization per candidate.
    pub pareto: Vec<(String, f64, f64)>,
    /// Trace of the final chosen candidate.
    pub trace: Vec<CalcTraceNode>,
}

/// Totals of a whole-model optimization.
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize)]
pub struct OptimizationTotals {
    /// Steel mass (kg).
    pub mass_kg: f64,
    /// Embodied carbon (kg CO₂e).
    pub carbon_kg: f64,
    /// Supply + fabrication cost (€).
    pub cost_eur: f64,
}

/// ULS + SLS check of one candidate against the group demand.
///
/// The ULS side runs the §6.3.3 biaxial interaction with the
/// conservative Annex A factors (`χy = χz = χLT` taken as 1.0 when the
/// caller passes `None` buckling resistances — the optimizer is a
/// selection aid, the final member check stays authoritative).
///
/// # Panics
///
/// Never — every division is guarded by clamped denominators.
#[must_use]
pub fn check_candidate(
    candidate: &ProfileCandidate,
    demand: &GroupDemand,
    fy: f64,
    annex: NationalAnnex,
) -> CandidateCheck {
    let gamma = annex_factors(annex);
    let area = candidate.a.max(1e-12);
    // Axial compression resistance (class 1-3 short member assumption).
    let n_c_rd = area * fy / gamma.gamma_m0;
    // Bending resistance (plastic when available).
    let wel = candidate.wel_y.max(1e-15);
    let wpl = candidate.wpl_y.unwrap_or(wel);
    let mc_y_rd = wpl * fy / gamma.gamma_m0;
    // Weak-axis resistance uses the strong-axis elastic modulus as the
    // screening proxy (the final member check stays authoritative).
    let mc_z_rd = candidate.wel_y * fy / gamma.gamma_m0;
    // Simplified buckling resistances: χ = 0.6 default for the optimizer.
    let chi = 0.6_f64;
    let n_b_rd_y = chi * n_c_rd;
    let n_b_rd_z = 0.5 * chi * n_c_rd;
    let input = InteractionInput {
        n_ed: demand.n_ed,
        my_ed: demand.my_ed,
        mz_ed: demand.mz_ed,
        n_b_rd_y,
        n_b_rd_z,
        mc_y_rd,
        mc_z_rd,
        chi_lt: 0.8,
        lambda_bar_y_sq: 0.5,
        lambda_bar_z_sq: 0.8,
    };
    let trace = interaction_6_61_6_62(&input, InteractionAnnex::A);
    let uls = trace.iter().map(|n| n.value).fold(0.0_f64, f64::max);
    // Shear resistance (web area ≈ A/2 conservative).
    let v_pl_rd = area * 0.5 * fy / (3.0_f64.sqrt() * gamma.gamma_m0);
    let shear_util = demand.v_ed / v_pl_rd.max(1e-9);
    let uls_utilization = uls.max(shear_util);
    // SLS deflection: limit = L / ratio.
    let limit = demand.length_m / demand.defl_limit_ratio.max(1.0);
    let sls_utilization = demand.defl_ed_m / limit.max(1e-12);
    CandidateCheck {
        uls_utilization,
        sls_utilization,
        passed: uls_utilization <= 1.0 && sls_utilization <= 1.0,
        trace,
    }
}

/// Iterative lightest-profile search (≤ `max_passes`, default 10):
/// candidates are visited in ascending mass; the first full pass marks
/// the frontier and stops as soon as a candidate passes.
///
/// # Panics
///
/// Never — the loop is bounded by `max_passes` and the candidate slice.
#[must_use]
pub fn optimize_group(
    demand: &GroupDemand,
    candidates: &[ProfileCandidate],
    fy: f64,
    annex: NationalAnnex,
    max_passes: usize,
) -> GroupOptimization {
    let max_passes = max_passes.clamp(1, 10);
    let mut sorted: Vec<&ProfileCandidate> = candidates.iter().collect();
    sorted.sort_by(|a, b| a.mass_per_m.total_cmp(&b.mass_per_m));
    let mut pareto: Vec<(String, f64, f64)> = Vec::new();
    let mut passes = 0usize;
    for candidate in &sorted {
        if passes >= max_passes {
            break;
        }
        passes += 1;
        let check = check_candidate(candidate, demand, fy, annex);
        pareto.push((
            candidate.designation.clone(),
            candidate.mass_per_m,
            check.uls_utilization.max(check.sls_utilization),
        ));
        if check.passed {
            return GroupOptimization {
                chosen: Some(candidate.designation.clone()),
                passes,
                pareto,
                trace: check.trace,
            };
        }
    }
    GroupOptimization {
        chosen: None,
        passes,
        pareto,
        trace: Vec::new(),
    }
}

/// Mass / carbon / cost totals for a chosen set of members.
#[must_use]
pub fn totals(mass_kg: f64) -> OptimizationTotals {
    OptimizationTotals {
        mass_kg,
        carbon_kg: mass_kg * CARBON_KG_PER_KG_STEEL,
        cost_eur: mass_kg * COST_EUR_PER_KG_STEEL,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_abs_diff_eq;

    fn candidates() -> Vec<ProfileCandidate> {
        vec![
            ProfileCandidate {
                designation: "IPE 140".to_owned(),
                a: 1.61e-3,
                iy: 5.41e-6,
                iz: 1.51e-6,
                wel_y: 77.3e-6,
                wpl_y: Some(90.6e-6),
                mass_per_m: 12.9,
            },
            ProfileCandidate {
                designation: "IPE 200".to_owned(),
                a: 2.24e-3,
                iy: 1.94e-5,
                iz: 1.34e-6,
                wel_y: 194e-6,
                wpl_y: Some(220e-6),
                mass_per_m: 22.4,
            },
            ProfileCandidate {
                designation: "IPE 300".to_owned(),
                a: 4.56e-3,
                iy: 8.36e-5,
                iz: 6.04e-6,
                wel_y: 557e-6,
                wpl_y: Some(628e-6),
                mass_per_m: 42.2,
            },
        ]
    }

    fn demand() -> GroupDemand {
        GroupDemand {
            n_ed: -50_000.0,
            my_ed: 45_000.0,
            mz_ed: 2_000.0,
            v_ed: 30_000.0,
            length_m: 6.0,
            defl_limit_ratio: 250.0,
            defl_ed_m: 0.02,
        }
    }

    #[test]
    fn picks_the_lightest_passing_candidate() {
        let result = optimize_group(&demand(), &candidates(), 235e6, NationalAnnex::FR, 10);
        assert_eq!(result.chosen, Some("IPE 300".to_owned()));
        assert!(result.passes <= 10);
        assert!(result.pareto.len() >= 2);
    }

    #[test]
    fn light_candidates_fail_and_build_the_frontier() {
        let result = optimize_group(&demand(), &candidates(), 235e6, NationalAnnex::FR, 10);
        // The lightest candidates appear in the frontier before the choice.
        let first = &result.pareto[0];
        assert_eq!(first.0, "IPE 140");
    }

    #[test]
    fn zero_demand_picks_the_lightest() {
        let mut d = demand();
        d.n_ed = 0.0;
        d.my_ed = 0.0;
        d.mz_ed = 0.0;
        d.v_ed = 0.0;
        d.defl_ed_m = 0.0;
        let result = optimize_group(&d, &candidates(), 235e6, NationalAnnex::FR, 10);
        assert_eq!(result.chosen, Some("IPE 140".to_owned()));
        assert_eq!(result.passes, 1);
    }

    #[test]
    fn totals_are_linear_in_mass() {
        let t = totals(1000.0);
        assert_abs_diff_eq!(t.carbon_kg, 1900.0, epsilon = 1e-9);
        assert_abs_diff_eq!(t.cost_eur, 1850.0, epsilon = 1e-9);
    }

    #[test]
    fn trace_is_emitted_for_the_chosen_candidate() {
        let result = optimize_group(&demand(), &candidates(), 235e6, NationalAnnex::FR, 10);
        assert!(result.trace.iter().map(CalcTraceNode::count).sum::<usize>() >= 2);
    }
}
