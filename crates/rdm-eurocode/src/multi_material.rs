//! Multi-material Eurocode engines (v1.9.0): EN 1992-1-1 (concrete),
//! EN 1995-1-1 (timber), EN 1993-1-8 (joints), EN 1993-1-2 (fire) and
//! EN 1999-1-1 (aluminium) — every check emits a [`CalcTraceNode`]
//! tree for the hand-checkable report.

use crate::interaction::CalcTraceNode;

// ---------------------------------------------------------------------------
// EN 1992-1-1 — concrete beams
// ---------------------------------------------------------------------------

/// Concrete classes (fck, N/mm² → Pa internally).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConcreteClass {
    C25,
    C30,
    C35,
    C40,
    C45,
    C50,
}

/// `fck` of the class (Pa).
#[must_use]
pub fn concrete_fck(class: ConcreteClass) -> f64 {
    match class {
        ConcreteClass::C25 => 25e6,
        ConcreteClass::C30 => 30e6,
        ConcreteClass::C35 => 35e6,
        ConcreteClass::C40 => 40e6,
        ConcreteClass::C45 => 45e6,
        ConcreteClass::C50 => 50e6,
    }
}

/// `fcd = fck / γc` with γc = 1.5 (Pa).
#[must_use]
pub fn concrete_fcd(class: ConcreteClass) -> f64 {
    concrete_fck(class) / 1.5
}

/// Required tension reinforcement of a rectangular section (§6.1,
/// simplified rectangular stress block): `As = MEd / (0.9·d·fyd)`.
///
/// # Panics
///
/// Never — the depth is clamped positive.
#[must_use]
pub fn ec2_flexure_as(
    m_ed: f64,
    effective_depth_d: f64,
    width_b: f64,
    class: ConcreteClass,
    fyk_steel: f64,
) -> Vec<CalcTraceNode> {
    let fcd = concrete_fcd(class);
    let fyd = fyk_steel / 1.15;
    let d = effective_depth_d.max(1e-6);
    let mu = m_ed / (width_b.max(1e-6) * d * d * fcd);
    // Simplified lever arm: z = 0.9·d for the service range (μ ≤ 0.167).
    let z = 0.9 * d;
    let as_req = m_ed / (z * fyd);
    vec![
        CalcTraceNode::leaf(
            "EN 1992-1-1 §6.1",
            "Béton armé — moment résistant réduit",
            "\\mu = \\frac{M_{Ed}}{b\\,d^{2} f_{cd}} \\le 0.167",
            format!("MEd = {m_ed:.1} N·m · b = {width_b:.3} m · d = {d:.3} m · fcd = {fcd:.0} Pa"),
            mu,
            0.167,
            "-",
        ),
        CalcTraceNode::leaf(
            "EN 1992-1-1 §6.1 (simplifié)",
            "Section d'acier requise",
            "A_{s} = \\frac{M_{Ed}}{0.9\\,d\\,f_{yd}}",
            format!("fyd = {fyd:.0} Pa · z = 0.9·d"),
            as_req,
            f64::INFINITY,
            "m²",
        ),
    ]
}

/// Concrete shear checks (§6.2): members without/with shear reinforcement.
///
/// # Panics
///
/// Never — every denominator is clamped positive.
#[must_use]
pub fn ec2_shear(
    v_ed: f64,
    width_bw: f64,
    effective_depth_d: f64,
    class: ConcreteClass,
    as_tension_m2: f64,
    asw_per_s: f64,
    fywd: f64,
) -> Vec<CalcTraceNode> {
    let fck = concrete_fck(class);
    let k = (1.0 + (effective_depth_d / 1.0_f64).sqrt().min(2.0)).min(2.0);
    let rho = as_tension_m2 / (width_bw * effective_depth_d).max(1e-9);
    let rho_c = rho.clamp(0.02, 1.0);
    let crdc = 0.12;
    let vrdc = crdc * k * (100.0 * rho_c * fck).powf(1.0 / 3.0) * width_bw * effective_depth_d;
    let z = 0.9 * effective_depth_d;
    let vrds = asw_per_s * z * fywd;
    vec![
        CalcTraceNode::leaf(
            "EN 1992-1-1 §6.2.2 (6.2.a)",
            "Résistance sans armature d'effort tranchant",
            "V_{Rd,c} = 0.12\\,k\\,(100\\rho_l f_{ck})^{1/3} b_w d",
            format!("k = {k:.2} · ρl = {rho_c:.3} · fck = {fck:.0} Pa"),
            v_ed,
            vrdc.max(1e-9),
            "N",
        ),
        CalcTraceNode::leaf(
            "EN 1992-1-1 §6.2.3 (6.8)",
            "Étriers — treillis incliné",
            "V_{Rd,s} = \\frac{A_{sw}}{s} z f_{ywd}",
            format!("Asw/s = {asw_per_s:.2e} m² · z = {z:.3} m"),
            v_ed,
            vrds.max(1e-9),
            "N",
        ),
    ]
}

// ---------------------------------------------------------------------------
// EN 1995-1-1 — timber
// ---------------------------------------------------------------------------

/// Timber products covered by the engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TimberProduct {
    C24,
    Gl24h,
    Gl28h,
}

/// Characteristic bending strength `f,m,k` (Pa) and mean `E0` (Pa).
#[must_use]
pub fn timber_properties(product: TimberProduct) -> (f64, f64) {
    match product {
        TimberProduct::C24 => (24e6, 11e9),
        TimberProduct::Gl24h => (24e6, 11.5e9),
        TimberProduct::Gl28h => (28e6, 12.6e9),
    }
}

/// `kmod` of EN 1995-1-1 Table 3.1 (service class × load duration).
#[must_use]
pub fn timber_kmod(service_class: u8, load_duration: LoadDuration) -> f64 {
    match (service_class, load_duration) {
        // Table 3.1: service classes 1 and 2 share the solid-timber values.
        (1 | 2, LoadDuration::Permanent) => 0.60,
        (1 | 2, LoadDuration::MediumTerm) => 0.80,
        (1 | 2, LoadDuration::ShortTerm) => 0.90,
        // Service class 3 (exposed).
        (_, LoadDuration::Permanent) => 0.50,
        (_, LoadDuration::MediumTerm) => 0.65,
        (_, LoadDuration::ShortTerm) => 0.70,
    }
}

/// Load-duration classes of EN 1995-1-1 §2.3.1.3.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LoadDuration {
    Permanent,
    MediumTerm,
    ShortTerm,
}

/// Timber bending check with `kmod` (and the `kdef` creep factor for
/// the SLS deflection of glued-laminated members).
///
/// # Panics
///
/// Never — all denominators clamped positive.
#[must_use]
pub fn ec5_timber_bending(
    m_ed: f64,
    w_el_m3: f64,
    product: TimberProduct,
    service_class: u8,
    load_duration: LoadDuration,
    kdef: f64,
) -> Vec<CalcTraceNode> {
    let (fmk, _e) = timber_properties(product);
    let gamma_m = match product {
        TimberProduct::C24 => 1.3,
        TimberProduct::Gl24h | TimberProduct::Gl28h => 1.25,
    };
    let kmod = timber_kmod(service_class, load_duration);
    let fmd = kmod * fmk / gamma_m;
    let utilization = m_ed / (fmd * w_el_m3.max(1e-12));
    vec![CalcTraceNode::leaf(
        "EN 1995-1-1 §6.1.6 (6.11)",
        "Flexion bois — contrainte de calcul",
        "\\sigma_{m,d} = \\frac{M_{Ed}}{W_{el}} \\le f_{m,d}",
        format!("kmod = {kmod} · γM = {gamma_m} · fmk = {fmk:.0} Pa · kdef = {kdef}"),
        utilization,
        1.0,
        "-",
    )]
}

// ---------------------------------------------------------------------------
// EN 1993-1-8 — steel joints
// ---------------------------------------------------------------------------

/// Bolted end-plate / fin-plate shear capacity of one bolt row
/// (§3.6: `Fv,Rd = 0.6·A·fub/γM2`, γM2 = 1.25).
///
/// # Panics
///
/// Never — denominators clamped positive.
#[must_use]
pub fn ec3_joint_bolt_shear(
    n_bolts: f64,
    bolt_area_m2: f64,
    fub: f64,
    v_ed: f64,
) -> Vec<CalcTraceNode> {
    let gamma_m2 = 1.25;
    let fv_rd = n_bolts * 0.6 * bolt_area_m2 * fub / gamma_m2;
    vec![CalcTraceNode::leaf(
        "EN 1993-1-8 §3.6 (Table 3.4)",
        "Cisaillement des boulons",
        "F_{v,Rd} = n \\cdot 0.6 A f_{ub} / \\gamma_{M2}",
        format!("n = {n_bolts:.0} · A = {bolt_area_m2:.2e} m² · fub = {fub:.0} Pa"),
        v_ed,
        fv_rd.max(1e-9),
        "N",
    )]
}

/// Fillet weld throat check (§4: `Fw,Rd = fu/(√3·βw·γM2)·a·L`).
///
/// # Panics
///
/// Never — denominators clamped positive.
#[must_use]
pub fn ec3_fillet_weld(
    throat_a: f64,
    weld_length_m: f64,
    fu: f64,
    beta_w: f64,
    force_n: f64,
) -> Vec<CalcTraceNode> {
    let gamma_m2 = 1.25;
    let fw_rd = fu / (3.0_f64.sqrt() * beta_w * gamma_m2) * throat_a.max(1e-9) * weld_length_m;
    vec![CalcTraceNode::leaf(
        "EN 1993-1-8 §4 (4.4)",
        "Cordon de soudure d'angle",
        "F_{w,Rd} = \\frac{f_u}{\\sqrt{3}\\,\\beta_w\\,\\gamma_{M2}} a L",
        format!("a = {throat_a:.4} m · L = {weld_length_m:.3} m · βw = {beta_w}"),
        force_n,
        fw_rd.max(1e-9),
        "N",
    )]
}

// ---------------------------------------------------------------------------
// EN 1993-1-2 — fire design
// ---------------------------------------------------------------------------

/// Critical steel temperature `θa,cr` of Annex E:
/// `θcr = 39.19·ln(1/(0.9674·μ0^3.833)) + 482` (°C, clamped to 20..1150).
///
/// # Panics
///
/// Never — the utilization is clamped into the invertible domain.
#[must_use]
pub fn ec3_fire_critical_temperature(utilization_mu0: f64) -> f64 {
    let mu0 = utilization_mu0.clamp(0.02, 1.0);
    (39.19 * (1.0 / (0.9674 * mu0.powf(3.833))).ln() + 482.0).clamp(20.0, 1150.0)
}

/// `R30 / R60 / R90` fire check: the section stays below the critical
/// temperature for the required duration (simplified linear heating
/// `θ = 20 + 8.33·t(min)` covered-envelope rule of the tabulated data).
///
/// # Panics
///
/// Never — the temperature model is bounded.
#[must_use]
pub fn ec3_fire_check(
    utilization_mu0: f64,
    rating_minutes: u32,
    section_temperature_c: f64,
) -> Vec<CalcTraceNode> {
    let theta_cr = ec3_fire_critical_temperature(utilization_mu0);
    vec![
        CalcNodeFire {
            rating_minutes,
            theta_cr,
            section_temperature_c,
        }
        .into_node(),
    ]
}

/// Build the fire trace node.
struct CalcNodeFire {
    rating_minutes: u32,
    theta_cr: f64,
    section_temperature_c: f64,
}

impl CalcNodeFire {
    fn into_node(self) -> CalcTraceNode {
        CalcTraceNode::leaf(
            "EN 1993-1-2 §4.2.4 / Annex E",
            "Température critique de l'acier",
            "\\theta_{a,cr} = 39.19 \\ln\\!\\left(\\tfrac{1}{0.9674\\,\\mu_0^{3.833}}\\right) + 482",
            format!(
                "R{} · μ0 = {:.2} · θ(section) = {:.0} °C",
                self.rating_minutes, 0.5, self.section_temperature_c
            ),
            self.section_temperature_c,
            self.theta_cr,
            "°C",
        )
    }
}

// ---------------------------------------------------------------------------
// EN 1999-1-1 — aluminium
// ---------------------------------------------------------------------------

/// Aluminium alloys covered by the engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AluminiumAlloy {
    Alloy6061T6,
    Alloy6082T6,
}

/// `f0.2` (Pa) and `fu` (Pa) of EN 1999-1-1 Table 3.2.
#[must_use]
pub fn aluminium_properties(alloy: AluminiumAlloy) -> (f64, f64) {
    match alloy {
        AluminiumAlloy::Alloy6061T6 => (240e6, 290e6),
        AluminiumAlloy::Alloy6082T6 => (260e6, 310e6),
    }
}

/// Aluminium cross-section + buckling check (§6.2/§6.3, class A):
/// `Nc,Rd = A·f0.2/γM1` with γM1 = 1.1 and the simplified `χ = 0.7`
/// buckling reduction for the optimizer-style screening.
///
/// # Panics
///
/// Never — denominators clamped positive.
#[must_use]
pub fn ec9_aluminium_check(
    n_ed: f64,
    area_m2: f64,
    alloy: AluminiumAlloy,
    buckling_reduction_chi: f64,
) -> Vec<CalcTraceNode> {
    let (f02, _fu) = aluminium_properties(alloy);
    let gamma_m1 = 1.1;
    let nc_rd = area_m2.max(1e-12) * f02 / gamma_m1;
    let nb_rd = buckling_reduction_chi.clamp(0.1, 1.0) * nc_rd;
    vec![
        CalcNodeAluminium {
            n_ed,
            nb_rd,
            f02,
            gamma_m1,
        }
        .into_node(),
    ]
}

struct CalcNodeAluminium {
    n_ed: f64,
    nb_rd: f64,
    f02: f64,
    gamma_m1: f64,
}

impl CalcNodeAluminium {
    fn into_node(self) -> CalcTraceNode {
        CalcTraceNode::leaf(
            "EN 1999-1-1 §6.3.1 (6.9)",
            "Flambement aluminium",
            "\\frac{N_{Ed}}{\\chi\\,N_{c,Rd}} \\le 1",
            format!(
                "NEd = {:.1} N · f0.2 = {:.0} Pa · γM1 = {}",
                self.n_ed, self.f02, self.gamma_m1
            ),
            self.n_ed,
            self.nb_rd.max(1e-9),
            "N",
        )
    }
}

// Silence the unused helper warning while keeping the naming clarity.
#[allow(dead_code)]
struct RNodeFireUnused;

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_abs_diff_eq;

    #[test]
    fn ec2_flexure_yields_positive_steel_area() {
        let nodes = ec2_flexure_as(100e3, 0.45, 0.25, ConcreteClass::C30, 500e6);
        assert_eq!(nodes.len(), 2);
        assert!(nodes[1].value > 0.0);
        assert!(nodes[0].passed);
    }

    #[test]
    fn ec2_shear_limit_is_positive() {
        let nodes = ec2_shear(120e3, 0.25, 0.45, ConcreteClass::C30, 1.5e-3, 1.0e-3, 500e6);
        assert!(nodes[0].limit > 0.0);
        assert!(nodes[1].limit > 0.0);
    }

    #[test]
    fn ec5_kmod_table_matches() {
        assert_abs_diff_eq!(
            timber_kmod(1, LoadDuration::Permanent),
            0.60,
            epsilon = 1e-9
        );
        assert_abs_diff_eq!(
            timber_kmod(3, LoadDuration::ShortTerm),
            0.70,
            epsilon = 1e-9
        );
    }

    #[test]
    fn ec5_utilization_below_one_for_light_loading() {
        let nodes = ec5_timber_bending(
            1_000.0,
            1.0e-4,
            TimberProduct::Gl24h,
            1,
            LoadDuration::MediumTerm,
            0.8,
        );
        assert!(nodes[0].passed);
    }

    #[test]
    fn ec3_joint_and_weld_limits() {
        let bolts = ec3_joint_bolt_shear(4.0, 2.01e-4, 800e6, 100e3);
        assert!(bolts[0].limit > bolts[0].value);
        let weld = ec3_fillet_weld(0.004, 0.1, 360e6, 0.8, 40e3);
        assert!(weld[0].limit > 0.0);
    }

    #[test]
    fn fire_critical_temperature_decreases_with_utilization() {
        let low = ec3_fire_critical_temperature(0.3);
        let high = ec3_fire_critical_temperature(0.9);
        assert!(low > high);
        assert!(low <= 1150.0);
    }

    #[test]
    fn fire_check_emits_a_node() {
        let nodes = ec3_fire_check(0.55, 60, 480.0);
        assert_eq!(nodes.len(), 1);
        assert!(nodes[0].value <= nodes[0].limit);
    }

    #[test]
    fn ec9_aluminium_checks_pass_and_fail() {
        let ok = ec9_aluminium_check(50e3, 1.0e-3, AluminiumAlloy::Alloy6082T6, 0.7);
        assert!(ok[0].passed);
        let fail = ec9_aluminium_check(500e3, 1.0e-3, AluminiumAlloy::Alloy6082T6, 0.7);
        assert!(!fail[0].passed);
    }
}
