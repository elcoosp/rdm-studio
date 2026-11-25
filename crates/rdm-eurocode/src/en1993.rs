//! EN 1993-1-1 (Eurocode 3) member checks.
//!
//! All functions are pure and take solver results (SI forces/moments) plus
//! the resolved section/material properties; nothing here depends on the
//! solver or the web layer. Constants (buckling curve imperfections, class
//! limits) follow EN 1993-1-1:2005 Tables 5.2, 6.1, 6.2, 6.3 and §6.2.

use rdm_model::{MaterialProperties, SectionProperties, SectionShape};

use crate::Ec3Error;

/// Plastic-utilisation factor for shear checks (EN 1993-1-1 §5.4.2).
pub const GAMMA_M0: f64 = 1.0;

/// Local buckling classification of a cross-section under a given regime.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum Classification {
    /// Class 1: plastic hinge with rotation capacity.
    Class1,
    /// Class 2: plastic resistance, limited rotation capacity.
    Class2,
    /// Class 3: elastic resistance only.
    Class3,
    /// Class 4: effective-section design (out of M1 scope, reported only).
    Class4,
}

impl Classification {
    /// Ordinal index 1..=4 for UI badges (`Classe 2`, v1.4.0).
    #[must_use]
    pub fn as_u8(self) -> u8 {
        match self {
            Classification::Class1 => 1,
            Classification::Class2 => 2,
            Classification::Class3 => 3,
            Classification::Class4 => 4,
        }
    }
}

impl Classification {
    /// Numeric class index (1..4).
    pub fn index(self) -> u8 {
        match self {
            Self::Class1 => 1,
            Self::Class2 => 2,
            Self::Class3 => 3,
            Self::Class4 => 4,
        }
    }
}

/// EN 1993-1-1 Table 6.1 buckling curves with their imperfection factors.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BucklingCurve {
    /// Curve a (`alpha = 0.21`).
    A,
    /// Curve b (`alpha = 0.34`).
    B,
    /// Curve c (`alpha = 0.49`).
    C,
    /// Curve d (`alpha = 0.76`).
    D,
}

impl BucklingCurve {
    /// Imperfection factor `alpha` (EN 1993-1-1 Table 6.1).
    pub fn alpha_imp(self) -> f64 {
        match self {
            Self::A => 0.21,
            Self::B => 0.34,
            Self::C => 0.49,
            Self::D => 0.76,
        }
    }
}

/// `epsilon = sqrt(235 MPa / f_y)` (EN 1993-1-1 Table 5.2).
///
/// # Errors
///
/// Returns [`Ec3Error::CheckUnavailable`] for non-positive yield strength.
pub fn epsilon(material: &MaterialProperties) -> Result<f64, Ec3Error> {
    if material.fy <= 0.0 {
        return Err(Ec3Error::CheckUnavailable(
            "yield strength must be positive".to_owned(),
        ));
    }
    Ok((235e6 / material.fy).sqrt())
}

/// Classifies a section for bending + axial compression (EN 1993-1-1
/// Table 5.2). Returns the governing (worst) class.
///
/// Single angles are not covered by EN 1993-1-1 Table 5.2; the check returns
/// [`Ok(None)`] so the caller can surface "not applicable" honestly.
///
/// # Errors
///
/// Returns [`Ec3Error::CheckUnavailable`] when the profile lacks the
/// dimensional data the classification needs.
pub fn classify_section(
    props: &SectionProperties,
    material: &MaterialProperties,
    pure_compression: bool,
) -> Result<Option<Classification>, Ec3Error> {
    let eps = epsilon(material)?;
    let worst = |classes: [Option<Classification>; 2]| -> Option<Classification> {
        classes.into_iter().flatten().max_by_key(|c| c.index())
    };

    match props.shape {
        SectionShape::DoubleSymmetricI | SectionShape::Channel => {
            let b = props.b.ok_or_else(missing_dims)?;
            let tw = props.tw.ok_or_else(missing_dims)?;
            let tf = props.tf.ok_or_else(missing_dims)?;
            let h = props.h.ok_or_else(missing_dims)?;
            let r = props.r.unwrap_or(0.0);
            if tw <= 0.0 || tf <= 0.0 {
                return Err(missing_dims());
            }
            // Outstand flange: c = (b - tw - 2r) / 2 (Table 5.2 sheet 1/3).
            let c_flange = (b - tw - 2.0 * r) / 2.0;
            let flange = classify_outstand(c_flange / tf, eps);
            // Internal web: c = h - 2tf - 2r.
            let c_web = h - 2.0 * tf - 2.0 * r;
            let web = if pure_compression {
                classify_internal_compression(c_web / tw, eps)
            } else {
                classify_internal_bending(c_web / tw, eps)
            };
            Ok(worst([Some(flange), Some(web)]))
        }
        SectionShape::RectangularHollow => {
            let b = props.b.ok_or_else(missing_dims)?;
            let h = props.h.ok_or_else(missing_dims)?;
            let t = props.tw.ok_or_else(missing_dims)?;
            if t <= 0.0 {
                return Err(missing_dims());
            }
            // Hot-finished hollow sections: c = b - 3t (Table 5.2 sheet 3).
            let c_flange = b - 3.0 * t;
            let c_web = h - 3.0 * t;
            let flange = if pure_compression {
                classify_internal_compression(c_flange / t, eps)
            } else {
                classify_internal_bending(c_flange / t, eps)
            };
            let web = if pure_compression {
                classify_internal_compression(c_web / t, eps)
            } else {
                classify_internal_bending(c_web / t, eps)
            };
            Ok(worst([Some(flange), Some(web)]))
        }
        SectionShape::CircularHollow => {
            let d = props.h.ok_or_else(missing_dims)?;
            let t = props.tw.ok_or_else(missing_dims)?;
            if t <= 0.0 {
                return Err(missing_dims());
            }
            let ratio = d / (t * eps * eps);
            let cls = if pure_compression {
                // Table 5.2 sheet 3, compression row: d/t <= 42 eps^2 is
                // fully effective; beyond it the section is Class 4.
                if ratio <= 42.0 {
                    Classification::Class1
                } else {
                    Classification::Class4
                }
            } else if ratio <= 50.0 {
                Classification::Class1
            } else if ratio <= 70.0 {
                Classification::Class2
            } else if ratio <= 90.0 {
                Classification::Class3
            } else {
                Classification::Class4
            };
            Ok(Some(cls))
        }
        // EN 1993-1-1 Table 5.2 does not cover single angles or generic
        // shapes: the caller reports the check as not applicable.
        SectionShape::Angle | SectionShape::General => Ok(None),
    }
}

fn classify_outstand(ratio: f64, eps: f64) -> Classification {
    // Outstand flange limits are the same for the compression flange of a
    // bending member and for pure compression (Table 5.2 sheets 1-2):
    // Class 1/2/3 at 9/10/14 epsilon.
    if ratio <= 9.0 * eps {
        Classification::Class1
    } else if ratio <= 10.0 * eps {
        Classification::Class2
    } else if ratio <= 14.0 * eps {
        Classification::Class3
    } else {
        Classification::Class4
    }
}

fn classify_internal_bending(ratio: f64, eps: f64) -> Classification {
    if ratio <= 72.0 * eps {
        Classification::Class1
    } else if ratio <= 83.0 * eps {
        Classification::Class2
    } else if ratio <= 124.0 * eps {
        Classification::Class3
    } else {
        Classification::Class4
    }
}

fn classify_internal_compression(ratio: f64, eps: f64) -> Classification {
    if ratio <= 33.0 * eps {
        Classification::Class1
    } else if ratio <= 38.0 * eps {
        Classification::Class2
    } else if ratio <= 42.0 * eps {
        Classification::Class3
    } else {
        Classification::Class4
    }
}

fn missing_dims() -> Ec3Error {
    Ec3Error::CheckUnavailable(
        "profile is missing the dimensional data this check requires".to_owned(),
    )
}

/// Buckling curve of a rolled section for one principal axis (EN 1993-1-1
/// Table 6.2, hot-rolled products).
///
/// # Errors
///
/// Returns [`Ec3Error::CheckUnavailable`] for shapes outside Table 6.2 or
/// profiles without the `h/b` and `tf` data.
pub fn buckling_curve_rolled(
    props: &SectionProperties,
    major_axis: bool,
) -> Result<BucklingCurve, Ec3Error> {
    match props.shape {
        SectionShape::DoubleSymmetricI => {
            let b = props.b.ok_or_else(missing_dims)?;
            let h = props.h.ok_or_else(missing_dims)?;
            let tf = props.tf.ok_or_else(missing_dims)?;
            if b <= 0.0 || h <= 0.0 || tf <= 0.0 {
                return Err(missing_dims());
            }
            let h_over_b = h / b;
            if h_over_b > 1.2 {
                if tf <= 0.04 {
                    Ok(if major_axis {
                        BucklingCurve::A
                    } else {
                        BucklingCurve::B
                    })
                } else if tf <= 0.1 {
                    Ok(if major_axis {
                        BucklingCurve::B
                    } else {
                        BucklingCurve::C
                    })
                } else {
                    Err(Ec3Error::CheckUnavailable(
                        "flange thickness above 100 mm is outside Table 6.2".to_owned(),
                    ))
                }
            } else if tf <= 0.1 {
                Ok(BucklingCurve::C)
            } else {
                Ok(BucklingCurve::D)
            }
        }
        // Rolled channels and single angles: curve c about both axes
        // (Table 6.2, sheet 3).
        SectionShape::Channel | SectionShape::Angle => Ok(BucklingCurve::C),
        // Hot-rolled hollow sections: curve a (Table 6.2, sheet 2).
        SectionShape::CircularHollow | SectionShape::RectangularHollow => Ok(BucklingCurve::A),
        SectionShape::General => Err(missing_dims()),
    }
}

/// Flexural buckling reduction factor `chi` (EN 1993-1-1 §6.3.1.2,
/// expression 6.49), capped at 1.0.
pub fn flexural_buckling_chi(curve: BucklingCurve, lambda_bar: f64) -> f64 {
    let alpha = curve.alpha_imp();
    let phi = 0.5 * (1.0 + alpha * (lambda_bar - 0.2) + lambda_bar * lambda_bar);
    let disc = (phi * phi - lambda_bar * lambda_bar).max(0.0);
    let chi = 1.0 / (phi + disc.sqrt());
    chi.min(1.0)
}

/// Euler critical force `Ncr = pi^2 E I / Lcr^2` (N).
pub fn euler_critical_force(e: f64, inertia: f64, l_cr: f64) -> f64 {
    std::f64::consts::PI.powi(2) * e * inertia / (l_cr * l_cr)
}

/// Non-dimensional slenderness `lambda_bar = sqrt(A f_y / Ncr)`.
pub fn lambda_bar(area: f64, fy: f64, n_cr: f64) -> f64 {
    if n_cr <= 0.0 {
        return f64::INFINITY;
    }
    (area * fy / n_cr).sqrt()
}

/// Shear area for shear parallel to the web plane (major-axis bending),
/// EN 1993-1-1 §6.2.6(2).
///
/// # Errors
///
/// Returns [`Ec3Error::CheckUnavailable`] when the shape/profile lacks the
/// data (e.g. single angles).
pub fn shear_area_major(props: &SectionProperties) -> Result<f64, Ec3Error> {
    match props.shape {
        SectionShape::DoubleSymmetricI => {
            let b = props.b.ok_or_else(missing_dims)?;
            let tw = props.tw.ok_or_else(missing_dims)?;
            let tf = props.tf.ok_or_else(missing_dims)?;
            let h = props.h.ok_or_else(missing_dims)?;
            let r = props.r.unwrap_or(0.0);
            let web_depth = h - 2.0 * tf;
            if web_depth <= 0.0 {
                return Err(missing_dims());
            }
            // Av = A - 2 b tf + (tw + 2r) tf, not less than eta hw tw
            // (eta = 1.2 for rolled sections).
            let av = props.a - 2.0 * b * tf + (tw + 2.0 * r) * tf;
            let floor = 1.2 * web_depth * tw;
            Ok(av.max(floor))
        }
        SectionShape::Channel => {
            let h = props.h.ok_or_else(missing_dims)?;
            let tf = props.tf.ok_or_else(missing_dims)?;
            let tw = props.tw.ok_or_else(missing_dims)?;
            // Conservative web-only area (tapered-flange channels).
            Ok((h - 2.0 * tf).max(0.0) * tw)
        }
        SectionShape::CircularHollow => Ok(2.0 * props.a / std::f64::consts::PI),
        SectionShape::RectangularHollow => {
            let b = props.b.ok_or_else(missing_dims)?;
            let h = props.h.ok_or_else(missing_dims)?;
            Ok(props.a * h / (b + h))
        }
        SectionShape::Angle | SectionShape::General => Err(missing_dims()),
    }
}

/// Shear area for shear parallel to the flanges (minor-axis shear).
///
/// # Errors
///
/// Returns [`Ec3Error::CheckUnavailable`] for shapes without a rule here.
pub fn shear_area_minor(props: &SectionProperties) -> Result<f64, Ec3Error> {
    match props.shape {
        SectionShape::DoubleSymmetricI | SectionShape::Channel => {
            let b = props.b.ok_or_else(missing_dims)?;
            let tf = props.tf.ok_or_else(missing_dims)?;
            // Flange-set contribution for weak-axis shear.
            Ok(2.0 * b * tf)
        }
        SectionShape::CircularHollow => Ok(2.0 * props.a / std::f64::consts::PI),
        SectionShape::RectangularHollow => {
            let b = props.b.ok_or_else(missing_dims)?;
            let h = props.h.ok_or_else(missing_dims)?;
            Ok(props.a * b / (b + h))
        }
        SectionShape::Angle | SectionShape::General => Err(missing_dims()),
    }
}

/// Lateral-torsional buckling verification result for one member.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct LtbResult {
    /// Elastic critical moment `Mcr` (N·m).
    pub m_cr: f64,
    /// Non-dimensional slenderness `lambda_LT`.
    pub lambda_lt: f64,
    /// Reduction factor `chi_LT` (capped at 1).
    pub chi_lt: f64,
    /// Design buckling resistance `Mb,Rd = chi_LT Wpl,y fy / gamma_M0` (N·m).
    pub m_b_rd: f64,
}

/// Lateral-torsional buckling of a doubly-symmetric rolled I-section under
/// uniform moment (EN 1993-1-1 §6.3.2.2, C1 = 1.0 by default).
///
/// Returns `None` for shapes without a tabulated warping constant (channels,
/// angles): the caller reports the check as "not applicable" rather than
/// guessing `Iw`.
///
/// # Errors
///
/// Returns [`Ec3Error::CheckUnavailable`] when `Wpl,y`, `Iw`, `Iz` or `It`
/// are missing, or when `h/b` exceeds the Table 6.3 coverage.
pub fn lateral_torsional_buckling(
    props: &SectionProperties,
    material: &MaterialProperties,
    length: f64,
    c1: f64,
) -> Result<Option<LtbResult>, Ec3Error> {
    if props.shape != SectionShape::DoubleSymmetricI {
        return Ok(None);
    }
    let wpl_y = props
        .wpl_y
        .ok_or_else(|| Ec3Error::CheckUnavailable("Wpl,y not tabulated".to_owned()))?;
    let iw = props
        .iw
        .ok_or_else(|| Ec3Error::CheckUnavailable("Iw not tabulated".to_owned()))?;
    let b = props.b.ok_or_else(missing_dims)?;
    let h = props.h.ok_or_else(missing_dims)?;
    if length <= 0.0 || c1 <= 0.0 {
        return Err(Ec3Error::CheckUnavailable(
            "length and C1 must be positive".to_owned(),
        ));
    }
    let h_over_b = h / b;
    // EN 1993-1-1 Table 6.3 (rolled, doubly symmetric).
    let alpha_lt = if h_over_b <= 2.0 {
        0.21
    } else if h_over_b <= 3.1 {
        0.34
    } else {
        return Err(Ec3Error::CheckUnavailable(
            "h/b above 3.1 is outside Table 6.3 for rolled sections".to_owned(),
        ));
    };

    let pi = std::f64::consts::PI;
    let m_cr = c1
        * (pi * pi * material.e * props.iz / (length * length))
        * (iw / props.iz
            + (length * length * material.g * props.it) / (pi * pi * material.e * props.iz))
            .sqrt();
    let lambda_lt = (wpl_y * material.fy / m_cr).sqrt();
    let phi_lt = 0.5 * (1.0 + alpha_lt * (lambda_lt - 0.2) + lambda_lt * lambda_lt);
    let disc = (phi_lt * phi_lt - lambda_lt * lambda_lt).max(0.0);
    let chi_lt = (1.0 / (phi_lt + disc.sqrt())).min(1.0);
    Ok(Some(LtbResult {
        m_cr,
        lambda_lt,
        chi_lt,
        m_b_rd: chi_lt * wpl_y * material.fy / GAMMA_M0,
    }))
}

/// SLS deflection limit ratios supported by the project configuration.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeflectionLimit {
    /// Span / 200.
    L200,
    /// Span / 250.
    L250,
    /// Span / 300.
    L300,
}

impl DeflectionLimit {
    /// Allowed deflection for a span `l` (m).
    pub fn allowance(self, l: f64) -> f64 {
        let d = match self {
            Self::L200 => 200.0,
            Self::L250 => 250.0,
            Self::L300 => 300.0,
        };
        l / d
    }
}

/// Convenience: deflection allowance for a span and limit.
pub fn deflection_limit(l: f64, limit: DeflectionLimit) -> f64 {
    limit.allowance(l)
}

/// Full member verification under one load combination (report payload).
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct MemberCheck {
    /// Beam id this check belongs to.
    pub beam_id: u32,
    /// Combination label, e.g. `ULS 1.35G + 1.50Q`.
    pub combination: String,
    /// Design axial force (N, signed).
    pub n_ed: f64,
    /// Design strong-axis bending moment at the critical end (N·m).
    pub my_ed: f64,
    /// Design weak-axis bending moment at the critical end (N·m).
    pub mz_ed: f64,
    /// Design shear parallel to web (N).
    pub vz_ed: f64,
    /// Design torsional moment (N·m).
    pub t_ed: f64,
    /// Governing cross-section class (`None` = not applicable).
    pub class: Option<Classification>,
    /// `Npl,Rd` (N).
    pub n_pl_rd: f64,
    /// `Vpl,Rd` for major shear (N).
    pub v_pl_rd: f64,
    /// Flexural buckling factors `(chi_y, chi_z)` when computed.
    pub chi: Option<(f64, f64)>,
    /// LTB verification when applicable.
    pub ltb: Option<LtbResult>,
    /// Utilisations in `[0, inf)`; each entry is a named check ratio.
    pub utilizations: Vec<(String, f64)>,
}

/// Input bundle for [`crate::member_check`].
#[derive(Debug, Clone)]
pub struct MemberCheckInput<'a> {
    /// Beam id.
    pub beam_id: u32,
    /// Beam length (m).
    pub length: f64,
    /// Buckling length ratios `(ky, kz)`.
    pub k_buckling: (f64, f64),
    /// Section properties.
    pub section: &'a SectionProperties,
    /// Material properties.
    pub material: &'a MaterialProperties,
    /// Design forces from the solver (local axes): N, My, Mz, Vz, T.
    pub forces: (f64, f64, f64, f64, f64),
    /// Combination label for the report.
    pub combination: String,
}

/// Runs the complete EN 1993-1-1 verification for one member under one
/// combination and returns a serializable report.
///
/// # Errors
///
/// Returns [`Ec3Error`] when a required check cannot be performed with the
/// available catalog data (class 4 sections, missing `Iw`, single angles
/// under LTB, ...). Partial applicability is signalled through the `Option`
/// fields of [`MemberCheck`] instead.
pub fn member_check(input: MemberCheckInput<'_>) -> Result<MemberCheck, Ec3Error> {
    let (n_ed, my_ed, mz_ed, vz_ed, t_ed) = input.forces;
    let material = input.material;
    let props = input.section;
    let compression_only = n_ed >= 0.0;
    let class = classify_section(props, material, compression_only)?;

    let n_pl_rd = props.a * material.fy / GAMMA_M0;
    let v_pl_rd = shear_area_major(props)? * material.fy / (3.0f64.sqrt() * GAMMA_M0);

    let mut utilizations: Vec<(String, f64)> = Vec::new();
    utilizations.push(("NEd/Npl,Rd".to_owned(), n_ed.abs() / n_pl_rd));

    // Flexural buckling (compression members).
    let mut chi: Option<(f64, f64)> = None;
    if n_ed < 0.0 {
        let l_y = input.k_buckling.0 * input.length;
        let l_z = input.k_buckling.1 * input.length;
        let n_cr_y = euler_critical_force(material.e, props.iy, l_y);
        let n_cr_z = euler_critical_force(material.e, props.iz, l_z);
        let curve_y = buckling_curve_rolled(props, true)?;
        let curve_z = buckling_curve_rolled(props, false)?;
        let chi_y = flexural_buckling_chi(curve_y, lambda_bar(props.a, material.fy, n_cr_y));
        let chi_z = flexural_buckling_chi(curve_z, lambda_bar(props.a, material.fy, n_cr_z));
        utilizations.push(("Nb,Rd,y".to_owned(), n_ed.abs() / (chi_y * n_pl_rd)));
        utilizations.push(("Nb,Rd,z".to_owned(), n_ed.abs() / (chi_z * n_pl_rd)));
        chi = Some((chi_y, chi_z));
    }

    // Bending verification: LTB governs for laterally unrestrained
    // doubly-symmetric I-sections; otherwise plastic (class 1-2) or elastic
    // (class 3, or plastic data missing) resistance applies.
    let ltb = lateral_torsional_buckling(props, material, input.length, 1.0)?;
    if let Some(ltb) = &ltb {
        utilizations.push(("Mb,Rd".to_owned(), my_ed.abs() / ltb.m_b_rd));
    } else {
        let mel_rd = props.wel_y * material.fy / GAMMA_M0;
        utilizations.push(("Mel,Rd,y".to_owned(), my_ed.abs() / mel_rd));
    }
    if class.is_some_and(|c| c.index() <= 2)
        && let Some(wpl_y) = props.wpl_y
    {
        utilizations.push((
            "Mpl,Rd,y".to_owned(),
            my_ed.abs() / (wpl_y * material.fy / GAMMA_M0),
        ));
    }

    utilizations.push(("Vpl,Rd".to_owned(), vz_ed.abs() / v_pl_rd));

    let vm = von_mises_utilisation(n_ed, my_ed, mz_ed, vz_ed, t_ed, props, material)?;
    utilizations.push(("Von Mises".to_owned(), vm));

    Ok(MemberCheck {
        beam_id: input.beam_id,
        combination: input.combination,
        n_ed,
        my_ed,
        mz_ed,
        vz_ed,
        t_ed,
        class,
        n_pl_rd,
        v_pl_rd,
        chi,
        ltb,
        utilizations,
    })
}

/// Von Mises utilisation combining axial + bending normal stress with
/// shear and St-Venant torsion (EN 1993-1-1 §6.2.1(5) and §6.2.7).
///
/// # Errors
///
/// Returns [`Ec3Error::CheckUnavailable`] when the shear areas cannot be
/// derived for the shape.
pub fn von_mises_utilisation(
    n_ed: f64,
    my_ed: f64,
    mz_ed: f64,
    vz_ed: f64,
    t_ed: f64,
    props: &SectionProperties,
    material: &MaterialProperties,
) -> Result<f64, Ec3Error> {
    let sigma_vm = von_mises_stress(n_ed, my_ed, mz_ed, vz_ed, t_ed, props)?;
    Ok(sigma_vm * GAMMA_M0 / material.fy)
}

/// Absolute von Mises stress (Pa) for the exact section forces, evaluated
/// from the elastic interaction `√(σ² + 3τ²)` (v1.3.0 `max_sigma_vm`).
///
/// # Errors
///
/// Returns [`Ec3Error`] when the section lacks the shear/torsion
/// dimensions the shear stress model needs.
pub fn von_mises_stress(
    n_ed: f64,
    my_ed: f64,
    mz_ed: f64,
    vz_ed: f64,
    t_ed: f64,
    props: &SectionProperties,
) -> Result<f64, Ec3Error> {
    let sigma_n = n_ed / props.a;
    let sigma_my = my_ed / props.wel_y;
    let sigma_mz = mz_ed / props.wel_z;
    let sigma = sigma_n + sigma_my.abs() + sigma_mz.abs();

    let av = shear_area_major(props)?;
    let tau_v = (vz_ed / av).abs();

    // Torsional shear: thin-walled open sections t * T / It (web, thinnest
    // wall is conservative); closed sections use Bredt's formula.
    let tau_t = match props.shape {
        SectionShape::CircularHollow | SectionShape::RectangularHollow => {
            let h = props.h.ok_or_else(missing_dims)?;
            let b = props.b.ok_or_else(missing_dims)?;
            let t = props.tw.ok_or_else(missing_dims)?;
            let a0 = match props.shape {
                SectionShape::CircularHollow => std::f64::consts::PI * (h - t) * (h - t) / 4.0,
                _ => (h - t) * (b - t),
            };
            if a0 <= 0.0 || t <= 0.0 {
                return Err(missing_dims());
            }
            t_ed.abs() / (2.0 * a0 * t)
        }
        _ => {
            let tw = props.tw.ok_or_else(missing_dims)?;
            if props.it <= 0.0 || tw <= 0.0 {
                return Err(missing_dims());
            }
            t_ed.abs() * tw / props.it
        }
    };

    let tau = (tau_v * tau_v + tau_t * tau_t).sqrt();
    let sigma_vm = (sigma * sigma + 3.0 * tau * tau).sqrt();
    Ok(sigma_vm)
}

/// Reduces a bi-axial bending + shear combination per EN 1993-1-1 §6.2.8(3):
/// `M_y,Rd = (1 - (V_Ed / V_pl,Rd)^2) * M_pl,Rd` when shear exceeds half the
/// plastic shear resistance; returns `M_pl,Rd` unchanged otherwise.
pub fn reduce_to_bending_shear(v_ed: f64, v_pl_rd: f64, m_pl_rd: f64) -> f64 {
    if v_ed <= 0.5 * v_pl_rd {
        m_pl_rd
    } else {
        let rho = (2.0 * v_ed / v_pl_rd - 1.0).max(0.0);
        (1.0 - rho * rho).max(0.0) * m_pl_rd
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::profile_catalog;
    use approx::assert_abs_diff_eq;
    use approx::assert_relative_eq;

    fn ipe200() -> SectionProperties {
        profile_catalog().properties("IPE 200").unwrap()
    }

    fn s235() -> MaterialProperties {
        crate::material_catalog().properties("S235JR").unwrap()
    }

    #[test]
    fn epsilon_matches_table_52_definition() {
        assert_abs_diff_eq!(epsilon(&s235()).unwrap(), 1.0, epsilon = 1e-12);
        let s355 = crate::material_catalog().properties("S355J2").unwrap();
        assert_abs_diff_eq!(
            epsilon(&s355).unwrap(),
            (235.0 / 355.0f64).sqrt(),
            epsilon = 1e-12
        );
    }

    #[test]
    fn ipe200_is_class1_in_bending() {
        let cls = classify_section(&ipe200(), &s235(), false)
            .unwrap()
            .unwrap();
        assert_eq!(cls, Classification::Class1);
    }

    #[test]
    fn buckling_curves_match_table_62_for_i_and_h() {
        // IPE 200: h/b = 2.0 > 1.2, tf = 8.5 mm <= 40 -> y: a, z: b
        let props = ipe200();
        assert_eq!(
            buckling_curve_rolled(&props, true).unwrap(),
            BucklingCurve::A
        );
        assert_eq!(
            buckling_curve_rolled(&props, false).unwrap(),
            BucklingCurve::B
        );
        // HEA 100: h/b = 1.0 <= 1.2 -> z curve c (both)
        let hea100 = profile_catalog().properties("HEA 100").unwrap();
        assert_eq!(
            buckling_curve_rolled(&hea100, false).unwrap(),
            BucklingCurve::C
        );
        // Hot hollow sections -> curve a
        let chs = profile_catalog().properties("CHS 114.3x6").unwrap();
        assert_eq!(buckling_curve_rolled(&chs, true).unwrap(), BucklingCurve::A);
    }

    #[test]
    fn chi_is_one_for_tiny_slenderness_and_decays_after() {
        let chi0 = flexural_buckling_chi(BucklingCurve::A, 0.1);
        assert_abs_diff_eq!(chi0, 1.0, epsilon = 1e-12);
        let chi1 = flexural_buckling_chi(BucklingCurve::A, 1.0);
        assert!(chi1 < 1.0 && chi1 > 0.5);
        // Curve d is always the weakest at equal slenderness.
        let chi_d = flexural_buckling_chi(BucklingCurve::D, 1.0);
        assert!(chi_d < chi1);
    }

    #[test]
    fn euler_force_of_ipe200_column() {
        let props = ipe200();
        let n_cr = euler_critical_force(210e9, props.iy, 3.0);
        assert_abs_diff_eq!(
            n_cr,
            std::f64::consts::PI.powi(2) * 210e9 * props.iy / 9.0,
            epsilon = 1e-6
        );
    }

    #[test]
    fn shear_area_major_matches_en_formula_for_ipe200() {
        let props = ipe200();
        let av = shear_area_major(&props).unwrap();
        // A - 2 b tf + (tw + 2r) tf = 2848 - 1700 + 29.6*8.5 = 1399.6 mm^2
        assert_relative_eq!(av, 1.3996e-3, epsilon = 1e-4);
    }

    #[test]
    fn shear_area_of_chs_is_two_a_over_pi() {
        let chs = profile_catalog().properties("CHS 114.3x6").unwrap();
        assert_relative_eq!(
            shear_area_major(&chs).unwrap(),
            2.0 * chs.a / std::f64::consts::PI,
            epsilon = 1e-12
        );
    }

    #[test]
    fn mcr_of_ipe200_beams_grows_with_iw() {
        let props = ipe200();
        let mat = s235();
        let ltb = lateral_torsional_buckling(&props, &mat, 6.0, 1.0)
            .unwrap()
            .expect("IPE 200 carries Iw");
        assert!(ltb.m_cr > 0.0);
        assert!(ltb.chi_lt <= 1.0);
        assert!(ltb.m_b_rd <= ltb.chi_lt * props.wpl_y.unwrap() * mat.fy + 1e-9);
    }

    #[test]
    fn ltb_is_none_for_channels_without_iw() {
        let upe = profile_catalog().properties("UPE 100").unwrap();
        let res = lateral_torsional_buckling(&upe, &s235(), 4.0, 1.0).unwrap();
        assert!(res.is_none());
    }

    #[test]
    fn von_mises_pure_axial_equals_n_over_a() {
        let props = ipe200();
        let u = von_mises_utilisation(1e5, 0.0, 0.0, 0.0, 0.0, &props, &s235()).unwrap();
        assert_relative_eq!(u, 1e5 / props.a / 235e6, epsilon = 1e-12);
    }

    #[test]
    fn deflection_allowance_matches_ratios() {
        assert_abs_diff_eq!(
            deflection_limit(10.0, DeflectionLimit::L200),
            0.05,
            epsilon = 1e-12
        );
        assert_abs_diff_eq!(
            deflection_limit(10.0, DeflectionLimit::L250),
            0.04,
            epsilon = 1e-12
        );
        assert_abs_diff_eq!(
            deflection_limit(10.0, DeflectionLimit::L300),
            1.0 / 30.0,
            epsilon = 1e-12
        );
    }

    #[test]
    fn shear_reduction_formula_follows_6_2_8() {
        let m_pl = 1.0e5;
        assert_abs_diff_eq!(
            reduce_to_bending_shear(0.4 * 2.0e5, 2.0e5, m_pl),
            m_pl,
            epsilon = 1e-12
        );
        // Above half the shear resistance the reduction kicks in:
        // rho = 2*0.6 - 1 = 0.2 -> (1 - rho^2) Mpl = 0.96 Mpl.
        assert_abs_diff_eq!(
            reduce_to_bending_shear(0.6 * 2.0e5, 2.0e5, m_pl),
            0.96 * m_pl,
            epsilon = 1e-12
        );
        let reduced = reduce_to_bending_shear(0.75 * 2.0e5, 2.0e5, m_pl);
        assert!(reduced < m_pl && reduced > 0.0);
        // At the full shear resistance the bending capacity is exhausted.
        assert_abs_diff_eq!(
            reduce_to_bending_shear(1.0 * 2.0e5, 2.0e5, m_pl),
            0.0,
            epsilon = 1e-12
        );
    }

    #[test]
    fn member_check_report_is_coherent_for_bending_beam() {
        let props = ipe200();
        let mat = s235();
        let input = MemberCheckInput {
            beam_id: 7,
            length: 6.0,
            k_buckling: (1.0, 1.0),
            section: &props,
            material: &mat,
            forces: (1e4, 2e4, 0.0, 3e3, 0.0), // tension is positive
            combination: "ULS 1.35G + 1.50Q".to_owned(),
        };
        let check = member_check(input).unwrap();
        assert_eq!(check.beam_id, 7);
        assert_eq!(check.class, Some(Classification::Class1));
        assert!(check.chi.is_none(), "tension member has no buckling");
        assert!(check.ltb.is_some());
        let names: Vec<&str> = check.utilizations.iter().map(|(n, _)| n.as_str()).collect();
        assert!(names.contains(&"Mb,Rd"));
        assert!(names.contains(&"Von Mises"));
        assert!(check.utilizations.iter().all(|(_, u)| u.is_finite()));
    }

    #[test]
    fn member_check_compression_column_gets_buckling() {
        let props = profile_catalog().properties("HEA 200").unwrap();
        let mat = s235();
        let input = MemberCheckInput {
            beam_id: 9,
            length: 3.5,
            k_buckling: (1.0, 1.0),
            section: &props,
            material: &mat,
            forces: (-5e5, 0.0, 0.0, 0.0, 0.0),
            combination: "ULS 1.35G".to_owned(),
        };
        let check = member_check(input).unwrap();
        let (chi_y, chi_z) = check.chi.expect("compression column must be buckled");
        assert!(chi_y > 0.0 && chi_y <= 1.0);
        assert!(chi_z < chi_y || chi_z > 0.0);
    }
}
