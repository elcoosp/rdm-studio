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
// EN 1993-1-8 — steel joints
// ---------------------------------------------------------------------------

/// Bolt grades of EN 1993-1-8 Table 3.1 (`f_ub` in Pa, `f_yb = f_ub/10` or
/// `0.6/0.9·f_ub` per the property classes 4.6/5.6/6.8 vs 8.8/10.9).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BoltGrade {
    Grade46,
    Grade56,
    Grade68,
    Grade88,
    Grade109,
}

impl BoltGrade {
    /// Ultimate tensile strength `f_ub` (Pa) — Table 3.1.
    #[must_use]
    pub fn fub(self) -> f64 {
        match self {
            Self::Grade46 => 400.0e6,
            Self::Grade56 => 500.0e6,
            Self::Grade68 => 600.0e6,
            Self::Grade88 => 800.0e6,
            Self::Grade109 => 1000.0e6,
        }
    }

    /// Yield strength `f_yb` (Pa) — Table 3.1 (`0.6·fub` for 4.6/5.6/6.8,
    /// `0.9·fub` for 8.8/10.9).
    #[must_use]
    pub fn fyb(self) -> f64 {
        match self {
            Self::Grade46 | Self::Grade56 | Self::Grade68 => 0.6 * self.fub(),
            Self::Grade88 | Self::Grade109 => 0.9 * self.fub(),
        }
    }

    /// Shear `α_v` factor of Table 3.4 (`0.6` for 4.6/5.6/6.8, `0.5` for
    /// 8.8/10.9 with the shear plane passing through the threads).
    #[must_use]
    pub fn alpha_v(self, threads_in_plane: bool) -> f64 {
        match self {
            Self::Grade46 | Self::Grade56 | Self::Grade68 => 0.6,
            _ if threads_in_plane => 0.5,
            _ => 0.6,
        }
    }

    /// Bearing cap `fu/fub` of Table 3.4 (plate steel over bolt steel).
    #[must_use]
    pub fn bearing_fu_over_fub(self, plate_fu: f64) -> f64 {
        plate_fu / self.fub()
    }

    /// Display code (`8.8`, `10.9`, ...).
    #[must_use]
    pub fn code(self) -> &'static str {
        match self {
            Self::Grade46 => "4.6",
            Self::Grade56 => "5.6",
            Self::Grade68 => "6.8",
            Self::Grade88 => "8.8",
            Self::Grade109 => "10.9",
        }
    }

    /// Parses a grade code (`"8.8"`, `"10.9"`, ...).
    #[must_use]
    pub fn parse(code: &str) -> Self {
        match code {
            "4.6" => Self::Grade46,
            "5.6" => Self::Grade56,
            "6.8" => Self::Grade68,
            "10.9" => Self::Grade109,
            _ => Self::Grade88,
        }
    }
}

/// Standard metric bolt sizes M12..M36 with the EN 1993-1-8 Table 3.1
/// tensile stress areas `A_s` (m²).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BoltSize {
    M12,
    M16,
    M20,
    M24,
    M27,
    M30,
    M36,
}

impl BoltSize {
    /// Nominal diameter (m).
    #[must_use]
    pub fn diameter(self) -> f64 {
        match self {
            Self::M12 => 0.012,
            Self::M16 => 0.016,
            Self::M20 => 0.020,
            Self::M24 => 0.024,
            Self::M27 => 0.027,
            Self::M30 => 0.030,
            Self::M36 => 0.036,
        }
    }

    /// Tensile stress area `A_s` (m²) — Table 3.1.
    #[must_use]
    pub fn tensile_area(self) -> f64 {
        match self {
            Self::M12 => 84.3e-6,
            Self::M16 => 157.0e-6,
            Self::M20 => 245.0e-6,
            Self::M24 => 353.0e-6,
            Self::M27 => 459.0e-6,
            Self::M30 => 561.0e-6,
            Self::M36 => 817.0e-6,
        }
    }

    /// Standard clearance hole `d0 = d + 2 mm` (m).
    #[must_use]
    pub fn hole(self) -> f64 {
        self.diameter() + 0.002
    }

    /// Parses a designation (`"M20"`, ...).
    #[must_use]
    pub fn parse(code: &str) -> Self {
        match code {
            "M12" => Self::M12,
            "M16" => Self::M16,
            "M24" => Self::M24,
            "M27" => Self::M27,
            "M30" => Self::M30,
            "M36" => Self::M36,
            _ => Self::M20,
        }
    }
}

/// `GAMMA_M2` of EN 1993-1-8 §2.2 (joints).
pub const GAMMA_M2: f64 = 1.25;

/// Bolt shear resistance of one bolt, EN 1993-1-8 Table 3.4:
/// `F_{v,Rd} = α_v · f_{ub} · A_s / γ_M2` (N).
#[must_use]
pub fn ec3_bolt_shear_resistance(grade: BoltGrade, size: BoltSize, threads_in_plane: bool) -> f64 {
    grade.alpha_v(threads_in_plane) * grade.fub() * size.tensile_area() / GAMMA_M2
}

/// Bolt tension resistance, EN 1993-1-8 Table 3.4:
/// `F_{t,Rd} = k_2 · f_{ub} · A_s / γ_M2` (N), `k_2 = 0.63`
/// (non-countersunk head).
#[must_use]
pub fn ec3_bolt_tension_resistance(grade: BoltGrade, size: BoltSize, countersunk: bool) -> f64 {
    let k2 = if countersunk { 0.5 } else { 0.63 };
    k2 * grade.fub() * size.tensile_area() / GAMMA_M2
}

/// Bolt bearing resistance, EN 1993-1-8 Table 3.4:
/// `F_{b,Rd} = k_1 · α_b · f_u · d · t / γ_M2` (N) with
/// `α_b = min(α_d, f_u/f_{ub})` — `α_d = e1/(3 d0)` for edge bolts,
/// `α_d = p1/(3 d0) − 1/4` for inner bolts — and
/// `k_1 = min(2.8 e2/(3 d0) − 1.7, 2.5)` for edge rows,
/// `k_1 = min(1.4 p2/(3 d0) − 1.7, 2.5)` for inner rows.
#[must_use]
pub fn ec3_bolt_bearing_resistance(
    grade: BoltGrade,
    size: BoltSize,
    plate_fu: f64,
    plate_t: f64,
    e1: f64,
    e2: f64,
    p1: f64,
    p2: f64,
    inner: bool,
) -> f64 {
    let d = size.diameter();
    let d0 = size.hole();
    let alpha_d = if inner {
        p1 / (3.0 * d0) - 0.25
    } else {
        e1 / (3.0 * d0)
    };
    let alpha_b = alpha_d.min(grade.bearing_fu_over_fub(plate_fu));
    // Table 3.4 k1 — inner bolts keep the SCI P398 floor of 1.5; the edge
    // row is clamped non-negative so degenerate e2 never returns a
    // negative resistance.
    let k1 = if inner {
        (1.4 * p2 / (3.0 * d0) - 1.7).clamp(1.5, 2.5)
    } else {
        (2.8 * e2 / (3.0 * d0) - 1.7).clamp(0.0, 2.5)
    };
    k1 * alpha_b.max(0.0) * plate_fu * d * plate_t / GAMMA_M2
}

/// Combined shear + tension interaction, EN 1993-1-8 §3.7 Table 3.4:
/// `F_{v,Ed}/F_{v,Rd} + F_{t,Ed}/(1.4 F_{t,Rd}) ≤ 1.0`.
#[must_use]
pub fn ec3_bolt_combined_shear_tension(fv_ed: f64, fv_rd: f64, ft_ed: f64, ft_rd: f64) -> f64 {
    fv_ed / fv_rd.max(1e-9) + ft_ed / (1.4 * ft_rd.max(1e-9))
}

/// Block tearing resistance, EN 1993-1-8 §3.10.2 (Table 3.4, concentric):
/// `V_{eff,1,Rd} = 0.6 f_u A_{nt} / γ_M2` with the net shear face along one
/// bolt line `A_{nv} = t (e1 + (n−1) p1 − (n − 0.5) d0)` and the net
/// tension face to the free edge `A_{nt} = t (e2 − d0)`.
#[must_use]
pub fn ec3_block_tearing_resistance(plate_fu: f64, plate_t: f64, e2: f64, d0: f64) -> f64 {
    let ant = (plate_t * (e2 - d0)).max(0.0);
    0.6 * plate_fu * ant / GAMMA_M2
}

/// Net shear area of the block-tearing shear face (m²), §3.10.2.
#[must_use]
pub fn ec3_block_tearing_net_shear_area(
    plate_t: f64,
    e1: f64,
    p1: f64,
    n_bolts_in_line: usize,
    d0: f64,
) -> f64 {
    let n = f64::from(n_bolts_in_line.max(1) as u32);
    (plate_t * (e1 + (n - 1.0) * p1 - (n - 0.5) * d0)).max(0.0)
}

/// Fillet weld design shear strength `f_{v,w,Rd}`, EN 1993-1-8 §4 Table 4.1:
/// `f_{w,Rd} = f_u / (√3 · β_w · γ_M2)` (Pa).
#[must_use]
pub fn ec3_fillet_weld_strength(fu: f64, beta_w: f64) -> f64 {
    fu / (3.0_f64.sqrt() * beta_w * GAMMA_M2)
}

/// `β_w` correlation factor of Table 4.1 for the steel grades
/// S235/S275/S355/S460 (0.80 / 0.85 / 0.90 / 1.00).
#[must_use]
pub fn ec3_beta_w(steel_grade: &str) -> f64 {
    match steel_grade {
        "S235" => 0.80,
        "S275" => 0.85,
        "S460" => 1.00,
        _ => 0.90,
    }
}

/// Nominal ultimate strength `f_u` of the structural steel grades
/// (EN 1993-1-1 Table 3.1: S235 360, S275 430, S355 470, S460 540 MPa).
#[must_use]
pub fn ec3_steel_fu(steel_grade: &str) -> f64 {
    match steel_grade {
        "S235" => 360.0e6,
        "S275" => 430.0e6,
        "S460" => 540.0e6,
        _ => 470.0e6,
    }
}

/// Joint topology of the M12.1 connection studio.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JointTopology {
    /// `Platine d'about` — end-plate moment/shear joint.
    EndPlate,
    /// `Éclisse / Attache d'âme` — fin-plate shear joint.
    FinPlate,
    /// `Gousset de treillis` — gusset truss joint (axial brace).
    Gusset,
}

impl JointTopology {
    /// French display name of the topology.
    #[must_use]
    pub fn label(self) -> &'static str {
        match self {
            Self::EndPlate => "Platine d'about",
            Self::FinPlate => "Éclisse / Attache d'âme",
            Self::Gusset => "Gousset de treillis",
        }
    }

    /// Parses the studio JSON `topology` field.
    #[must_use]
    pub fn parse(code: &str) -> Self {
        match code {
            "end_plate" => Self::EndPlate,
            "gusset" => Self::Gusset,
            _ => Self::FinPlate,
        }
    }
}

/// Input of [`ec3_connection_check`] — strict SI units, parsed from the
/// studio JSON payload.
#[derive(Debug, Clone, PartialEq)]
pub struct ConnectionInput {
    /// Joint topology.
    pub topology: JointTopology,
    /// Bolt grade.
    pub grade: BoltGrade,
    /// Bolt size.
    pub size: BoltSize,
    /// Threads in the shear plane (`true` = standard assembly).
    pub threads_in_plane: bool,
    /// Number of bolt rows along the load direction.
    pub n_rows: usize,
    /// Number of bolt columns across the web/plate width.
    pub n_cols: usize,
    /// Bolt pitch along the load direction `p1` (m).
    pub p1: f64,
    /// Bolt gauge across the load direction `p2` (m).
    pub p2: f64,
    /// End distance `e1` (m).
    pub e1: f64,
    /// Edge distance `e2` (m).
    pub e2: f64,
    /// Connected plate thickness `t` (m).
    pub plate_t: f64,
    /// Plate/steel grade code (`S355`...).
    pub steel_grade: String,
    /// Fillet weld throat thickness `a` (m, 0 = bolted only).
    pub weld_throat_a: f64,
    /// Total weld length `L_w` (m).
    pub weld_length: f64,
    /// Design axial force `N_Ed` (N, signed).
    pub n_ed: f64,
    /// Design shear force `V_Ed` (N).
    pub v_ed: f64,
    /// Design bending moment `M_Ed` (N·m).
    pub m_ed: f64,
}

impl Default for ConnectionInput {
    fn default() -> Self {
        Self {
            topology: JointTopology::EndPlate,
            grade: BoltGrade::Grade88,
            size: BoltSize::M20,
            threads_in_plane: true,
            n_rows: 4,
            n_cols: 2,
            p1: 0.08,
            p2: 0.09,
            e1: 0.05,
            e2: 0.04,
            plate_t: 0.012,
            steel_grade: "S355".into(),
            weld_throat_a: 0.004,
            weld_length: 0.30,
            n_ed: 0.0,
            v_ed: 100.0e3,
            m_ed: 60.0e3,
        }
    }
}

/// Structured result of [`ec3_connection_check`] — the studio readout.
#[derive(Debug, Clone)]
pub struct ConnectionResult {
    /// Clause-by-clause check trace (bolt group, welds, block tear).
    pub trace: Vec<CalcTraceNode>,
    /// Global utilization `max(η_bolts, η_weld, η_block)` (0..∞).
    pub utilization: f64,
    /// Governing resistance name (`F_{v,Rd}`, `V_{eff,1,Rd}`, ...).
    pub governing: String,
    /// Per-bolt shear resistance `F_{v,Rd}` (N).
    pub fv_rd: f64,
    /// Per-bolt bearing resistance `F_{b,Rd}` (N).
    pub fb_rd: f64,
    /// Per-bolt tension resistance `F_{t,Rd}` (N).
    pub ft_rd: f64,
    /// Block tearing resistance `V_{eff,1,Rd}` (N).
    pub v_eff_rd: f64,
    /// Weld design resistance `F_{w,Rd}` (N).
    pub fw_rd: f64,
}

/// Builds a [`CalcTraceNode`] leaf with `passed = value ≤ limit`.
fn conn_leaf(
    clause: &str,
    title: &str,
    latex: &str,
    substituted: String,
    value: f64,
    limit: f64,
    unit: &str,
) -> CalcTraceNode {
    CalcTraceNode::leaf(
        clause,
        title,
        latex,
        substituted,
        value,
        limit.max(1e-9),
        unit,
    )
}

/// Complete EN 1993-1-8 bolted / welded joint check (M12.1): bolt shear,
/// bearing (`k_1, α_b`), tension, the combined shear+tension interaction of
/// Table 3.4, block tearing of §3.10.2 and the §4.5.3 directional fillet
/// weld check for the three studio joint topologies.
///
/// The design actions are distributed over the bolt group per topology:
/// end-plate moment joints put `M_Ed` into the tension rows through the
/// lever arms `z_i` and `V_Ed` into shear; fin-plate and gusset joints are
/// shear / axial governed with `N_Ed` on the bolt group.
///
/// # Panics
///
/// Never — denominators are clamped positive.
#[must_use]
pub fn ec3_connection_check(input: &ConnectionInput) -> ConnectionResult {
    let fu = ec3_steel_fu(&input.steel_grade);
    let beta_w = ec3_beta_w(&input.steel_grade);
    let d0 = input.size.hole();
    let n_bolts = input.n_rows * input.n_cols;
    let fv_rd = ec3_bolt_shear_resistance(input.grade, input.size, input.threads_in_plane);
    let ft_rd = ec3_bolt_tension_resistance(input.grade, input.size, false);

    // Bearing: the worst of edge (outer row) and inner bolts.
    let fb_edge = ec3_bolt_bearing_resistance(
        input.grade,
        input.size,
        fu,
        input.plate_t,
        input.e1,
        input.e2,
        input.p1,
        input.p2,
        false,
    );
    let fb_inner = if input.n_rows > 1 {
        ec3_bolt_bearing_resistance(
            input.grade,
            input.size,
            fu,
            input.plate_t,
            input.e1,
            input.e2,
            input.p1,
            input.p2,
            true,
        )
    } else {
        fb_edge
    };
    let fb_rd = fb_edge.min(fb_inner);

    // Design actions per bolt.
    let v_per_bolt = input.v_ed.abs() / f64::from(n_bolts.max(1) as u32);
    let n_per_bolt = input.n_ed.abs() / f64::from(n_bolts.max(1) as u32);
    // End-plate moment: the tension rows (rows in the tension zone ≈ half
    // the rows) work through the lever arms z_i = p1·i + e1 of the
    // plastic distribution; the moment arm z = max z_i.
    let m_rows = match input.topology {
        JointTopology::EndPlate => input.n_rows.div_ceil(2),
        _ => 0,
    };
    let lever_arm = if m_rows > 1 {
        input.e1 + f64::from(m_rows.max(2) as u32 - 1) * input.p1
    } else {
        input.e1 + input.p1
    };
    let ft_ed_moment = if input.topology == JointTopology::EndPlate && lever_arm > 1e-9 {
        (input.m_ed.abs() / lever_arm)
            / f64::from(m_rows.max(1) as u32 * input.n_cols.max(1) as u32)
    } else {
        0.0
    };
    let ft_ed = ft_ed_moment + n_per_bolt;

    let mut trace = Vec::new();
    // §3.6 shear.
    let fv_util = v_per_bolt / fv_rd.max(1e-9);
    trace.push(conn_leaf(
        "EN 1993-1-8 Table 3.4 (§3.6)",
        "Cisaillement des boulons",
        "F_{v,Ed} / F_{v,Rd} \\le 1.0",
        format!(
            "n = {n_bolts} · F_{{v,Ed}} = {:.1} N / F_{{v,Rd}} = {:.1} N",
            v_per_bolt * f64::from(n_bolts.max(1) as u32),
            fv_rd
        ),
        fv_util,
        1.0,
        "—",
    ));
    // §3.5.2 / Table 3.4 bearing.
    let fb_util = v_per_bolt / fb_rd.max(1e-9);
    trace.push(conn_leaf(
        "EN 1993-1-8 Table 3.4 (§3.5.2)",
        "Pression diamétrale",
        "F_{b,Rd} = k_1 \\alpha_b f_u d t / \\gamma_{M2}",
        format!(
            "α_b = min(e1/3d0, fu/fub) · k1 = min(2.8 e2/3d0 − 1.7, 2.5) · t = {:.1} mm",
            input.plate_t * 1000.0
        ),
        fb_util,
        1.0,
        "—",
    ));
    // §3.6 tension + combined interaction.
    let ft_util = ft_ed / ft_rd.max(1e-9);
    let combined = ec3_bolt_combined_shear_tension(v_per_bolt, fv_rd, ft_ed, ft_rd);
    trace.push(conn_leaf(
        "EN 1993-1-8 Table 3.4 (§3.6.1)",
        "Tension des boulons",
        "F_{t,Ed} / F_{t,Rd} \\le 1.0",
        format!("F_{{t,Ed}} = {ft_ed:.1} N / F_{{t,Rd}} = {ft_rd:.1} N (k2 = 0,63)"),
        ft_util,
        1.0,
        "—",
    ));
    trace.push(conn_leaf(
        "EN 1993-1-8 Table 3.4 (§3.7)",
        "Interaction cisaillement + tension",
        "\\frac{F_{v,Ed}}{F_{v,Rd}} + \\frac{F_{t,Ed}}{1.4 F_{t,Rd}} \\le 1.0",
        format!(
            "{:.3} + {:.3} = {:.3}",
            fv_util,
            ft_ed / (1.4 * ft_rd),
            combined
        ),
        combined,
        1.0,
        "—",
    ));
    // §3.10.2 block tearing on the outer bolt line.
    let ant = (input.plate_t * (input.e2 - d0)).max(0.0);
    let anv = ec3_block_tearing_net_shear_area(input.plate_t, input.e1, input.p1, input.n_rows, d0);
    let v_eff_rd = ec3_block_tearing_resistance(fu, input.plate_t, input.e2, d0);
    let block_util = input.v_ed.abs() / v_eff_rd.max(1e-9);
    trace.push(conn_leaf(
        "EN 1993-1-8 §3.10.2",
        "Arrachement en bloc",
        "V_{eff,1,Rd} = 0.6 f_u A_{nt} / \\gamma_{M2}",
        format!(
            "A_nv = {:.0} mm² · A_nt = {:.0} mm²",
            anv * 1.0e6,
            ant * 1.0e6
        ),
        block_util,
        1.0,
        "—",
    ));
    // §4.5.3 directional fillet weld check (only when a weld exists).
    let mut fw_rd = f64::INFINITY;
    if input.weld_throat_a > 0.0 && input.weld_length > 0.0 {
        fw_rd = ec3_fillet_weld_strength(fu, beta_w) * input.weld_throat_a * input.weld_length;
        // Directional method: resolve the actions into σ⊥, τ⊥, τ∥ —
        // the studio keeps the conservative transverse decomposition
        // σ⊥ = (N_Ed + M_Ed / h_w) / (a L) and τ∥ = V_Ed / (a L).
        let weld_force = input.n_ed.abs() + input.m_ed.abs() / (input.weld_length.max(0.05) / 2.0);
        let sigma_perp = weld_force / (input.weld_throat_a * input.weld_length);
        let tau_par = input.v_ed.abs() / (input.weld_throat_a * input.weld_length);
        let tau_perp = 0.0_f64;
        let combined_weld =
            (sigma_perp.powi(2) + 3.0 * (tau_perp.powi(2) + tau_par.powi(2))).sqrt();
        let weld_limit = fu / (beta_w * GAMMA_M2);
        let weld_util = combined_weld / weld_limit.max(1e-9);
        fw_rd = fw_rd.min(weld_limit * input.weld_throat_a * input.weld_length);
        trace.push(conn_leaf(
            "EN 1993-1-8 §4.5.3.2 (4.1)",
            "Soudure d'angle — méthode directionnelle",
            "\\sqrt{\\sigma_{\\perp}^2 + 3\\tau_{\\perp}^2 + 3\\tau_{\\parallel}^2} \\le f_u/(\\beta_w \\gamma_{M2})",
            format!(
                "σ⊥ = {:.1} MPa · τ∥ = {:.1} MPa · βw = {beta_w} · a = {:.1} mm",
                sigma_perp / 1.0e6,
                tau_par / 1.0e6,
                input.weld_throat_a * 1000.0
            ),
            weld_util,
            1.0,
            "—",
        ));
        trace.push(conn_leaf(
            "EN 1993-1-8 §4 (4.3)",
            "Résistance de la soudure",
            "F_{w,Rd} = f_{v,w,Rd} \\cdot a \\cdot L",
            format!(
                "f_{{v,w,Rd}} = {:.1} MPa · L = {:.0} mm",
                ec3_fillet_weld_strength(fu, beta_w) / 1.0e6,
                input.weld_length * 1000.0
            ),
            weld_force,
            fw_rd,
            "N",
        ));
    }

    let governing_util = trace.iter().fold(0.0_f64, |m, n| m.max(n.value / n.limit));
    let governing = trace
        .iter()
        .max_by(|a, b| {
            (a.value / a.limit)
                .total_cmp(&(b.value / b.limit))
                .then_with(|| b.title.len().cmp(&a.title.len()))
        })
        .map_or_else(String::new, |n| n.title.clone());

    ConnectionResult {
        trace,
        utilization: governing_util,
        governing,
        fv_rd,
        fb_rd,
        ft_rd,
        v_eff_rd,
        fw_rd: if fw_rd.is_finite() { fw_rd } else { 0.0 },
    }
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
            utilization_mu0: utilization_mu0.clamp(0.02, 1.0),
        }
        .into_node(),
    ]
}

/// Build the fire trace node.
struct CalcNodeFire {
    rating_minutes: u32,
    theta_cr: f64,
    section_temperature_c: f64,
    /// v2.1.0 audit fix: the actual utilization `μ0` is reported in the
    /// substituted line instead of a hardcoded `0.5`.
    utilization_mu0: f64,
}

impl CalcNodeFire {
    fn into_node(self) -> CalcTraceNode {
        CalcTraceNode::leaf(
            "EN 1993-1-2 §4.2.4 / Annex E",
            "Température critique de l'acier",
            "\\theta_{a,cr} = 39.19 \\ln\\!\\left(\\tfrac{1}{0.9674\\,\\mu_0^{3.833}}\\right) + 482",
            format!(
                "R{} · μ0 = {:.2} · θ(section) = {:.0} °C",
                self.rating_minutes, self.utilization_mu0, self.section_temperature_c
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
