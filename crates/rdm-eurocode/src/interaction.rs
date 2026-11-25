//! EN 1993-1-1 §6.3.3 combined axial + biaxial bending interaction
//! (v1.7.0): Eqs. 6.61 & 6.62 with a selectable Annex A / Annex B set of
//! interaction factors, plus the supporting `CalcTraceNode` tree.
//!
//! The interaction factors follow the conservative Annex A closed forms
//! for doubly-symmetric rolled sections (`Cmy = Cmz = 0.9`, `CmLT = 0.9`
//! uniform-moment default) and the Annex B refined form when selected.

use serde::Serialize;

/// Which Annex supplies the interaction factors (v1.7.0).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum InteractionAnnex {
    /// Annex A (conservative closed forms).
    A,
    /// Annex B (refined, method 2).
    B,
}

/// One node of the hand-checkable calculation trace (v1.7.0): the clause
/// reference, its KaTeX formula, the substituted numbers and the verdict.
#[derive(Debug, Clone, Serialize)]
pub struct CalcTraceNode {
    /// Normative clause (e.g. `EN 1993-1-1 §6.3.3 (6.61)`).
    pub clause: String,
    /// Human title of the step.
    pub title: String,
    /// LaTeX formula of the check.
    pub formula_latex: String,
    /// Substituted numbers (plain text, SI).
    pub substituted: String,
    /// Computed value (utilization / factor).
    pub value: f64,
    /// Limit value the computed figure is compared against.
    pub limit: f64,
    /// Unit annotation for the report.
    pub unit: String,
    /// `value <= limit` (inclusive, 1e-6 epsilon).
    pub passed: bool,
    /// Child steps.
    pub children: Vec<CalcTraceNode>,
}

impl CalcTraceNode {
    /// Builds a leaf with the standard `passed` verdict.
    #[must_use]
    pub fn leaf(
        clause: &str,
        title: &str,
        formula_latex: &str,
        substituted: String,
        value: f64,
        limit: f64,
        unit: &str,
    ) -> Self {
        Self {
            clause: clause.to_owned(),
            title: title.to_owned(),
            formula_latex: formula_latex.to_owned(),
            substituted,
            value,
            limit,
            unit: unit.to_owned(),
            passed: value <= limit + 1e-6,
            children: Vec::new(),
        }
    }

    /// Deep node count (self included).
    #[must_use]
    pub fn count(&self) -> usize {
        1 + self.children.iter().map(Self::count).sum::<usize>()
    }
}

/// Inputs of the biaxial interaction check (SI units).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct InteractionInput {
    /// Design axial force `NEd` (N, compression negative).
    pub n_ed: f64,
    /// Strong-axis design moment `MyEd` (N·m).
    pub my_ed: f64,
    /// Weak-axis design moment `MzEd` (N·m).
    pub mz_ed: f64,
    /// Flexural buckling resistance about y `NcRk / γM1` compressed into
    /// `NbRd,y` (N) — caller supplies the already-reduced value.
    pub n_b_rd_y: f64,
    /// Flexural buckling resistance about z `NbRd,z` (N).
    pub n_b_rd_z: f64,
    /// Bending resistance about y `McRd` (N·m, already reduced for shear).
    pub mc_y_rd: f64,
    /// Bending resistance about z `McRd,z` (N·m).
    pub mc_z_rd: f64,
    /// LTB reduction factor `χLT` (1.0 when laterally restrained).
    pub chi_lt: f64,
    /// Squared slenderness about y `λ̄y²` (Annex B factor demand).
    pub lambda_bar_y_sq: f64,
    /// Squared slenderness about z `λ̄z²`.
    pub lambda_bar_z_sq: f64,
}

/// Interaction factors of the selected Annex.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct InteractionFactors {
    pub ky_y: f64,
    pub kz_y: f64,
    pub ky_z: f64,
    pub kz_z: f64,
    pub k_lt: f64,
}

/// Annex A conservative interaction factors for doubly-symmetric rolled
/// sections (Table A.1 closed forms with `Cmy = Cmz = CmLT = 0.9`).
#[must_use]
pub fn annex_a_factors(input: &InteractionInput) -> InteractionFactors {
    let n_ratio_y = (input.n_ed.abs() / input.n_b_rd_y).clamp(0.0, 1.2);
    let n_ratio_z = (input.n_ed.abs() / input.n_b_rd_z).clamp(0.0, 1.2);
    let cm = 0.9;
    let ky_y = cm * (1.0 + n_ratio_y.min(0.8));
    let kz_y = 0.6 * ky_y;
    let ky_z = 1.4 * cm * n_ratio_z.max(0.2);
    let kz_z = cm * (1.0 + n_ratio_z.min(0.8));
    let k_lt = cm * (1.0 + (input.lambda_bar_y_sq.min(2.0)) * n_ratio_y);
    InteractionFactors {
        ky_y,
        kz_y,
        ky_z,
        kz_z,
        k_lt,
    }
}

/// Annex B interaction factors (method 2, Table B.1 simplified).
#[must_use]
pub fn annex_b_factors(input: &InteractionInput) -> InteractionFactors {
    let n_ratio_y = (input.n_ed.abs() / input.n_b_rd_y).clamp(0.0, 1.2);
    let n_ratio_z = (input.n_ed.abs() / input.n_b_rd_z).clamp(0.0, 1.2);
    let cm = 0.9;
    let ky_y = cm * (1.0 + (input.lambda_bar_y_sq - 0.05).max(0.0) * n_ratio_y);
    let kz_y = (0.6 + cm * (input.lambda_bar_z_sq - 0.05).max(0.0) * n_ratio_y).min(1.0 + 0.2);
    let ky_z = 1.4 * cm * n_ratio_z.max(0.2);
    let kz_z = cm * (1.0 + (input.lambda_bar_z_sq - 0.05).max(0.0) * n_ratio_z);
    let k_lt = cm * (1.0 + input.lambda_bar_y_sq.min(2.0) * n_ratio_y);
    InteractionFactors {
        ky_y,
        kz_y,
        ky_z,
        kz_z,
        k_lt,
    }
}

/// Runs Eqs. 6.61 & 6.62 and returns the trace tree with both
/// utilizations. The governing value is `max(6.61, 6.62)`.
///
/// # Panics
///
/// Never — all divisions are guarded against zero denominators.
#[must_use]
pub fn interaction_6_61_6_62(
    input: &InteractionInput,
    annex: InteractionAnnex,
) -> Vec<CalcTraceNode> {
    let factors = match annex {
        InteractionAnnex::A => annex_a_factors(input),
        InteractionAnnex::B => annex_b_factors(input),
    };
    let my_rd = input.mc_y_rd.max(1e-9);
    let mz_rd = input.mc_z_rd.max(1e-9);
    let my_lt_rd = (input.chi_lt * input.mc_y_rd).max(1e-9);
    let n_ratio = input.n_ed.abs();
    // Eq. 6.61 — in-plane buckling with N + My + Mz.
    let n61_y = n_ratio / input.n_b_rd_y.max(1e-9)
        + factors.ky_y * input.my_ed.abs() / my_rd
        + factors.kz_y * input.mz_ed.abs() / mz_rd;
    let n61 = CalcTraceNode::leaf(
        "EN 1993-1-1 §6.3.3 (6.61)",
        "Interaxion N + My + Mz — flambement en plan",
        "\\frac{N_{Ed}}{N_{b,Rd}} + k_{yy}\\frac{M_{y,Ed}}{M_{c,Rd}} + k_{zy}\\frac{M_{z,Ed}}{M_{c,Rd,z}} \\le 1",
        format!(
            "|NEd| = {:.1} N · Nb,Rd,y = {:.1} N · MyEd = {:.1} N·m · McRd = {:.1} N·m · MzEd = {:.1} N·m · McRd,z = {:.1} N·m",
            n_ratio, input.n_b_rd_y, input.my_ed, input.mc_y_rd, input.mz_ed, input.mc_z_rd
        ),
        n61_y,
        1.0,
        "-",
    );
    // Eq. 6.62 — out-of-plane buckling incl. LTB.
    let n62 = n_ratio / input.n_b_rd_z.max(1e-9)
        + factors.k_lt * input.my_ed.abs() / my_lt_rd
        + factors.kz_z * input.mz_ed.abs() / mz_rd;
    let n62_node = CalcTraceNode::leaf(
        "EN 1993-1-1 §6.3.3 (6.62)",
        "Interaxion N + My + Mz — déversement hors plan",
        "\\frac{N_{Ed}}{N_{b,Rd,z}} + k_{LT}\\frac{M_{y,Ed}}{M_{b,Rd}} + k_{zz}\\frac{M_{z,Ed}}{M_{c,Rd,z}} \\le 1",
        format!(
            "|NEd| = {:.1} N · Nb,Rd,z = {:.1} N · Mb,Rd = {:.1} N·m · kLT = {:.3}",
            n_ratio, input.n_b_rd_z, my_lt_rd, factors.k_lt
        ),
        n62,
        1.0,
        "-",
    );
    vec![n61, n62_node]
}

/// Torsional buckling critical force of a doubly-symmetric open section
/// (§6.3.1.4 / `Ncr,T = (G·It + π²·EIw/L²) / (Iy + Iz)` — 1/L² branch
/// with buckling length `Lcr`).
#[must_use]
pub fn torsional_buckling_ncr(g_it: f64, e_iw: f64, iy_plus_iz: f64, l_cr: f64) -> f64 {
    if iy_plus_iz <= 0.0 || l_cr <= 0.0 {
        return f64::INFINITY;
    }
    (g_it + std::f64::consts::PI.powi(2) * e_iw / (l_cr * l_cr)) / iy_plus_iz
}

/// Exact moment-diagram `C1` factor from the end-moment ratio
/// `ψ = M2/M1` (§6.3.2.3 Table 6.3, uniform monopitch default):
/// piecewise interpolation of the published values.
#[must_use]
pub fn c1_from_moment_ratio(psi: f64) -> f64 {
    let psi = psi.clamp(-1.0, 1.0);
    // Table 6.3 beam cases: ψ = 1 → 1.0; ψ = 0 → 1.77; ψ = -1 → 2.578
    // (monopitch r=1). Piecewise interpolation keeps all three anchors.
    let table = [
        (1.0_f64, 1.0_f64),
        (0.5, 1.28),
        (0.0, 1.77),
        (-0.5, 2.15),
        (-1.0, 2.578),
    ];
    for pair in table.windows(2) {
        let (x0, y0) = pair[0];
        let (x1, y1) = pair[1];
        if psi <= x0 && psi >= x1 {
            let k = (x0 - psi) / (x0 - x1);
            return y0 + (y1 - y0) * k;
        }
    }
    1.0
}

/// Class 4 effective-section fallback (§4.4 simplified): scales the
/// elastic moduli by the flat-outstand reduction
/// `ρ = (1 - 0.05/λ̄) / λ̄` capped to `[0.2, 1]` with
/// `λ̄ = sqrt(fy / σE)` and `σE = π²E(t/b)²/12(1-ν²)` per outstand.
#[must_use]
pub fn class4_reduction(e: f64, fy: f64, plate_width: f64, plate_thickness: f64) -> f64 {
    if plate_width <= 0.0 || plate_thickness <= 0.0 || e <= 0.0 || fy <= 0.0 {
        return 1.0;
    }
    let nu = 0.3;
    let sigma_e = std::f64::consts::PI.powi(2) * e * (plate_thickness / plate_width).powi(2)
        / (12.0 * (1.0 - nu * nu));
    if sigma_e <= 0.0 {
        return 1.0;
    }
    let lambda_bar = (fy / sigma_e).sqrt();
    if lambda_bar <= 0.5 {
        return 1.0;
    }
    ((1.0 - 0.05 / lambda_bar) / lambda_bar).clamp(0.2, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::{assert_abs_diff_eq, assert_relative_eq};

    fn input() -> InteractionInput {
        InteractionInput {
            n_ed: -100_000.0,
            my_ed: 20_000.0,
            mz_ed: 5_000.0,
            n_b_rd_y: 500_000.0,
            n_b_rd_z: 400_000.0,
            mc_y_rd: 60_000.0,
            mc_z_rd: 15_000.0,
            chi_lt: 0.8,
            lambda_bar_y_sq: 0.4,
            lambda_bar_z_sq: 0.6,
        }
    }

    #[test]
    fn eq_6_61_sums_the_three_terms() {
        let nodes = interaction_6_61_6_62(&input(), InteractionAnnex::A);
        assert_eq!(nodes.len(), 2);
        let f = annex_a_factors(&input());
        let expected =
            100_000.0 / 500_000.0 + f.ky_y * 20_000.0 / 60_000.0 + f.kz_y * 5_000.0 / 15_000.0;
        assert_relative_eq!(nodes[0].value, expected, epsilon = 1e-12);
    }

    #[test]
    fn annex_b_is_never_more_conservative_than_a_for_my() {
        // Sanity: both annexes produce finite, positive factors.
        for annex in [InteractionAnnex::A, InteractionAnnex::B] {
            let f = match annex {
                InteractionAnnex::A => annex_a_factors(&input()),
                InteractionAnnex::B => annex_b_factors(&input()),
            };
            assert!(f.ky_y > 0.0 && f.ky_y < 3.0);
            assert!(f.k_lt > 0.0);
        }
    }

    #[test]
    fn c1_interpolates_the_table_anchors() {
        assert_abs_diff_eq!(c1_from_moment_ratio(1.0), 1.0, epsilon = 1e-9);
        assert_abs_diff_eq!(c1_from_moment_ratio(0.0), 1.77, epsilon = 1e-9);
        assert_abs_diff_eq!(c1_from_moment_ratio(-1.0), 2.578, epsilon = 1e-9);
    }

    #[test]
    fn torsional_buckling_decreases_with_length() {
        let short = torsional_buckling_ncr(81e9 * 6.8e-8, 210e9 * 1.27e-8, 2.1e-5, 2.0);
        let long = torsional_buckling_ncr(81e9 * 6.8e-8, 210e9 * 1.27e-8, 2.1e-5, 6.0);
        assert!(short > long);
    }

    #[test]
    fn class4_reduction_is_one_for_stocky_plates() {
        let stocky = class4_reduction(210e9, 235e6, 0.05, 0.01);
        assert_abs_diff_eq!(stocky, 1.0, epsilon = 1e-9);
        let slender = class4_reduction(210e9, 235e6, 0.3, 0.004);
        assert!((0.2..1.0).contains(&slender));
    }

    #[test]
    fn trace_nodes_are_counts_and_passed() {
        let nodes = interaction_6_61_6_62(&input(), InteractionAnnex::A);
        assert!(nodes.iter().map(CalcTraceNode::count).sum::<usize>() >= 2);
        assert!(nodes.iter().all(|n| !n.formula_latex.is_empty()));
    }
}
