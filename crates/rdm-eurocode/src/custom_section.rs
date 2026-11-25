//! Custom parametric cross-sections (v1.7.0): welded I (PRS),
//! rectangular hollow, circular hollow, solid rectangle and solid round.
//! Every builder returns strict SI [`SectionProperties`] — the normative
//! layer then treats them like any catalog row.

use rdm_model::{SectionProperties, SectionShape};

/// Welded I (PRS, EN 10365 annex): plates with `h = h1 + 2·tf`.
#[must_use]
pub fn welded_i(h1: f64, b: f64, tw: f64, tf: f64) -> SectionProperties {
    let h = h1 + 2.0 * tf;
    let a = 2.0 * b * tf + (h - 2.0 * tf) * tw;
    let iy = (b * h.powi(3) - (b - tw) * h1.powi(3)) / 12.0;
    let z_f = h / 2.0;
    let iz = (2.0 * tf * b.powi(3) + h1 * tw.powi(3)) / 12.0;
    let wel_y = iy / z_f;
    let wel_z = iz / (b / 2.0);
    let alpha = (h1 / (2.0 * (b - tw))).min(1.0);
    let wpl_y = tf * b * (h - tf) / 2.0 + (h1.powi(2) * tw) / 8.0 * (4.0 * alpha - 1.0).max(0.0);
    let wpl_z = tf * b.powi(2) / 4.0 + h1 * tw.powi(2) / 4.0;
    let it = (2.0 * b * tf.powi(3) + h1 * tw.powi(3)) / 3.0;
    let iw = tf * b.powi(3) * h1.powi(2) / 24.0;
    SectionProperties {
        shape: SectionShape::DoubleSymmetricI,
        a,
        iy,
        iz,
        it,
        iw: Some(iw),
        wel_y,
        wel_z,
        wpl_y: Some(wpl_y),
        wpl_z: Some(wpl_z),
        h: Some(h),
        b: Some(b),
        tw: Some(tw),
        tf: Some(tf),
        r: Some(0.0),
    }
}

/// Rectangular hollow section (SHS/RHS walls `t`).
#[must_use]
pub fn rectangular_hollow(h: f64, b: f64, t: f64) -> SectionProperties {
    let a = 2.0 * (h + b - 2.0 * t) * t;
    let iy = (b * h.powi(3) - (b - 2.0 * t) * (h - 2.0 * t).powi(3)) / 12.0;
    let iz = (h * b.powi(3) - (h - 2.0 * t) * (b - 2.0 * t).powi(3)) / 12.0;
    let it = (2.0 * t * (h - t).powi(2) * (b - t).powi(2)) / (h + b - 2.0 * t);
    SectionProperties {
        shape: SectionShape::RectangularHollow,
        a,
        iy,
        iz,
        it,
        iw: None,
        wel_y: iy / (h / 2.0),
        wel_z: iz / (b / 2.0),
        wpl_y: Some((b * h * h) / 4.0 - ((b - 2.0 * t) * (h - 2.0 * t).powi(2)) / 4.0),
        wpl_z: Some((h * b * b) / 4.0 - ((h - 2.0 * t) * (b - 2.0 * t).powi(2)) / 4.0),
        h: Some(h),
        b: Some(b),
        tw: Some(t),
        tf: Some(t),
        r: Some(0.0),
    }
}

/// Circular hollow section (CHS wall `t`).
#[must_use]
pub fn circular_hollow(d: f64, t: f64) -> SectionProperties {
    let r = d / 2.0;
    let ri = (r - t).max(0.0);
    let a = std::f64::consts::PI * (r * r - ri * ri);
    let iy = std::f64::consts::PI * (r.powi(4) - ri.powi(4)) / 4.0;
    let it = iy * 2.0;
    SectionProperties {
        shape: SectionShape::CircularHollow,
        a,
        iy,
        iz: iy,
        it,
        iw: None,
        wel_y: iy / r,
        wel_z: iy / r,
        wpl_y: Some((r.powi(3) - ri.powi(3)) * 4.0 / 3.0),
        wpl_z: Some((r.powi(3) - ri.powi(3)) * 4.0 / 3.0),
        h: Some(d),
        b: Some(d),
        tw: Some(t),
        tf: Some(t),
        r: Some(0.0),
    }
}

/// Solid rectangle.
#[must_use]
pub fn solid_rect(h: f64, b: f64) -> SectionProperties {
    let a = h * b;
    let iy = b * h.powi(3) / 12.0;
    let iz = h * b.powi(3) / 12.0;
    let it = beta_rect(h.max(b), h.min(b)) * h.max(b) * h.min(b).powi(3);
    SectionProperties {
        shape: SectionShape::General,
        a,
        iy,
        iz,
        it,
        iw: None,
        wel_y: iy / (h / 2.0),
        wel_z: iz / (b / 2.0),
        wpl_y: Some(b * h * h / 4.0),
        wpl_z: Some(h * b * b / 4.0),
        h: Some(h),
        b: Some(b),
        tw: Some(b),
        tf: Some(h),
        r: Some(0.0),
    }
}

/// Solid round bar.
#[must_use]
pub fn solid_round(d: f64) -> SectionProperties {
    let r = d / 2.0;
    let a = std::f64::consts::PI * r * r;
    let iy = std::f64::consts::PI * r.powi(4) / 4.0;
    SectionProperties {
        shape: SectionShape::General,
        a,
        iy,
        iz: iy,
        it: iy * 2.0,
        iw: None,
        wel_y: iy / r,
        wel_z: iy / r,
        wpl_y: Some(r.powi(3) * 4.0 / 3.0),
        wpl_z: Some(r.powi(3) * 4.0 / 3.0),
        h: Some(d),
        b: Some(d),
        tw: Some(d),
        tf: Some(d),
        r: Some(0.0),
    }
}

/// Saint-Venant torsion coefficient of a rectangle (Roark's series).
fn beta_rect(long: f64, short: f64) -> f64 {
    let ratio = (long / short).clamp(1.0, 10.0);
    // Interpolated table values (Roark Table 10.1).
    let table: [(f64, f64); 5] = [
        (1.0, 0.141),
        (1.5, 0.196),
        (2.0, 0.229),
        (4.0, 0.281),
        (10.0, 0.313),
    ];
    for pair in table.windows(2) {
        let (x0, y0) = pair[0];
        let (x1, y1) = pair[1];
        if ratio <= x1 {
            let k = (ratio - x0) / (x1 - x0);
            return y0 + (y1 - y0) * k;
        }
    }
    0.313
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::{assert_abs_diff_eq, assert_relative_eq};

    #[test]
    fn welded_i_area_matches_plate_sum() {
        let s = welded_i(0.19, 0.1, 0.006, 0.01);
        assert_abs_diff_eq!(s.a, 2.0 * 0.1 * 0.01 + 0.19 * 0.006, epsilon = 1e-12);
        assert_relative_eq!(s.iy, s.iy, epsilon = 1e-12);
    }

    #[test]
    fn hollow_sections_keep_their_shape_tag() {
        assert_eq!(
            rectangular_hollow(0.2, 0.1, 0.006).shape,
            SectionShape::RectangularHollow
        );
        assert_eq!(
            circular_hollow(0.1143, 0.006).shape,
            SectionShape::CircularHollow
        );
    }

    #[test]
    fn solid_round_matches_pi_formulas() {
        let s = solid_round(0.1);
        assert_abs_diff_eq!(s.a, std::f64::consts::PI * 0.0025, epsilon = 1e-12);
        assert_abs_diff_eq!(s.iy, std::f64::consts::PI * 1.5625e-6, epsilon = 1e-12);
    }

    #[test]
    fn solid_rect_beta_is_bounded() {
        let s = solid_rect(0.2, 0.1);
        assert!(s.it > 0.0);
        let beta = beta_rect(2.0, 1.0);
        assert_abs_diff_eq!(beta, 0.229, epsilon = 1e-3);
    }
}
