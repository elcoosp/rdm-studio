//! Internal force reconstruction along a member span (v1.0.0 bug 3 +
//! `section_cut.rs` feed).
//!
//! The linear end-force array alone cannot see midspan sagging (`PL/4`,
//! `qL²/8`): the span loads are superposed as simply-supported statics on
//! top of the linear interpolation of the end moments. Stations are
//! evaluated at `[0, 0.25, 0.5, 0.75, 1.0]` and the EN 1993-1-1 check is
//! run at every station; the governing (largest) utilization is reported.
//!
//! Sign conventions follow the element end-force array `[Ux Uy Uz Rx Ry Rz]`
//! per node (indices `0..6` at `n1`, `6..12` at `n2`): `f[4]`/`f[5]` are the
//! bending moments about local `y`/`z` at `n1`, `f[10]`/`f[11]` at `n2`.
//! The reconstruction keeps magnitudes physically consistent; every
//! downstream check consumes absolute values.

use crate::results::SpanLoads;

/// Span stations (ratios of the member length) evaluated by the member check.
pub const STATIONS: [f64; 5] = [0.0, 0.25, 0.5, 0.75, 1.0];

/// Internal forces at one span station, local member axes.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct StationForces {
    /// Axial force `N` (N, signed).
    pub n_axial: f64,
    /// Bending moment about the local strong axis `My` (N·m).
    pub my: f64,
    /// Bending moment about the local weak axis `Mz` (N·m).
    pub mz: f64,
    /// Shear along local `z` `Vz` (N).
    pub vz: f64,
    /// Torsion `T` (N·m).
    pub t: f64,
}

/// Simply-supported contributions at ratio `a` from the span loads:
/// `(my_ss, mz_ss, vz_ss)`. Gravity-type transverse loads produce sagging.
fn simple_span_contribution(spans: &SpanLoads, length: f64, a: f64) -> (f64, f64, f64) {
    let mut my_ss = 0.0;
    let mut mz_ss = 0.0;
    let mut vz_ss = 0.0;

    // Concentrated loads `(ratio, fy, fz)`: sagging moment
    // P·L·min(a, ap)·(1 − max(a, ap)), shear jumps at `ap`.
    for &(ap, fy, fz) in &spans.points {
        let lower = a.min(ap);
        let upper = a.max(ap);
        let lever = lower * (1.0 - upper);
        // Sagging when the load pushes towards -z (gravity in local axes).
        my_ss += (-fz) * length * lever;
        mz_ss += (-fy) * length * lever;
        if a <= ap {
            vz_ss += (-fz) * (1.0 - ap) + (-fy) * (1.0 - ap);
        } else {
            vz_ss += fz * ap + fy * ap;
        }
    }

    // Trapezoids `(qy1, qy2, qz1, qz2)` over the full span (N/m, local axes,
    // sign as the stored force components): sagging-positive q = -qz.
    // R_left = q1·L/2 + (q2−q1)·L/6; M(a) = aL·R − q1a²L²/2 − (q2−q1)a³L²/6;
    // V(a) = R − q1·aL − (q2−q1)·a²L/2. Closes exactly at a = 0 and a = 1.
    for &(qy1, qy2, qz1, qz2) in &spans.trapezoids {
        let (q1, q2) = (-qz1, -qz2);
        let r_left = q1 * length / 2.0 + (q2 - q1) * length / 6.0;
        my_ss += a * length * r_left
            - q1 * a * a * length * length / 2.0
            - (q2 - q1) * a.powi(3) * length * length / 6.0;
        vz_ss += r_left - q1 * a * length - (q2 - q1) * a * a * length / 2.0;
        let (q1, q2) = (-qy1, -qy2);
        let r_left = q1 * length / 2.0 + (q2 - q1) * length / 6.0;
        mz_ss += a * length * r_left
            - q1 * a * a * length * length / 2.0
            - (q2 - q1) * a.powi(3) * length * length / 6.0;
    }

    (my_ss, mz_ss, vz_ss)
}

/// Reconstructs the internal forces at ratio `a` of one member from its
/// element end-force block `end[0..12]` plus the span loads.
///
/// `end` is the slice of the case's `beam_end_forces` for this beam.
pub fn station_forces(end: &[f64], spans: &SpanLoads, length: f64, a: f64) -> StationForces {
    let (my_ss, mz_ss, vz_ss) = simple_span_contribution(spans, length, a);
    let one_minus = 1.0 - a;
    StationForces {
        // Axial: linear between n1 (f[0]) and the internal value at n2
        // (action/reaction flips the sign of the node-2 element force).
        n_axial: end[0] * one_minus - end[6] * a,
        // Bending: linear end moments + simply-supported sagging.
        my: end[4] * one_minus + end[10] * a + my_ss,
        mz: end[5] * one_minus + end[11] * a + mz_ss,
        // Shear: linear interpolation of the end shears + span contribution.
        vz: end[2] * one_minus + end[8] * a + vz_ss,
        // Torsion: constant between the (equal-magnitude) end values.
        t: (end[3].abs()).max(end[9].abs()) * end[3].signum(),
    }
}

/// Internal forces at every [`STATIONS`] entry.
pub fn station_envelope(end: &[f64], spans: &SpanLoads, length: f64) -> Vec<(f64, StationForces)> {
    STATIONS
        .iter()
        .map(|&a| (a, station_forces(end, spans, length, a)))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uniform_load_sags_to_ql2_over_8() {
        // 1 m span, uniform qz = -2 N/m (gravity): M(0.5) = 2·1²/8 = 0.25 N·m.
        let spans = SpanLoads {
            points: Vec::new(),
            trapezoids: vec![(0.0, 0.0, -2.0, -2.0)],
        };
        let forces = station_forces(&[0.0; 12], &spans, 1.0, 0.5);
        assert!((forces.my - 0.25).abs() < 1e-12, "got {}", forces.my);
    }

    #[test]
    fn point_load_at_midspan_matches_pl_over_4() {
        // 2 m span, P = 10 N at a = 0.5: M(0.5) = 10·2/4 = 5 N·m.
        let spans = SpanLoads {
            points: vec![(0.5, 0.0, -10.0)],
            trapezoids: Vec::new(),
        };
        let forces = station_forces(&[0.0; 12], &spans, 2.0, 0.5);
        assert!((forces.my - 5.0).abs() < 1e-12, "got {}", forces.my);
    }

    #[test]
    fn end_moments_interpolate_linearly() {
        // M1 = 8 at n1, M2 = -4 at n2 (index 10): M(0.25) = 8·0.75 - 4·0.25 = 5.
        let mut end = [0.0f64; 12];
        end[4] = 8.0;
        end[10] = -4.0;
        let forces = station_forces(&end, &SpanLoads::default(), 3.0, 0.25);
        assert!((forces.my - 5.0).abs() < 1e-12, "got {}", forces.my);
    }
}
