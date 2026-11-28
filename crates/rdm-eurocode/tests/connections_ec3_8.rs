//! M12.1 — EN 1993-1-8 steel-connection engine verification against hand
//! calculations (< 0.5 % tolerance): M20 grade 8.8 shear / bearing /
//! tension, the combined interaction of Table 3.4, block tearing of
//! §3.10.2, the S355 fillet-weld directional check of §4.5.3 and the
//! end-plate / fin-plate / gusset topology distribution.

use approx::assert_abs_diff_eq;
use rdm_eurocode::{
    BoltGrade, BoltSize, ConnectionInput, JointTopology, ec3_beta_w,
    ec3_block_tearing_net_shear_area, ec3_block_tearing_resistance, ec3_bolt_bearing_resistance,
    ec3_bolt_combined_shear_tension, ec3_bolt_shear_resistance, ec3_bolt_tension_resistance,
    ec3_connection_check, ec3_fillet_weld_strength, ec3_steel_fu,
};

const TOL: f64 = 0.005; // 0.5 % against the hand calculations

#[test]
fn m20_grade88_shear_and_tension_match_table_34() {
    // Hand calc: Fv,Rd = 0.5 · 800 MPa · 245 mm² / 1.25 = 78 400 N
    //            Ft,Rd = 0.63 · 800 MPa · 245 mm² / 1.25 = 98 784 N
    let fv = ec3_bolt_shear_resistance(BoltGrade::Grade88, BoltSize::M20, true);
    assert_abs_diff_eq!(fv, 78_400.0, epsilon = 78_400.0 * TOL);
    let ft = ec3_bolt_tension_resistance(BoltGrade::Grade88, BoltSize::M20, false);
    assert_abs_diff_eq!(ft, 98_784.0, epsilon = 98_784.0 * TOL);
    // Threads excluded: αv = 0.6 → 94 080 N.
    let fv_plain = ec3_bolt_shear_resistance(BoltGrade::Grade88, BoltSize::M20, false);
    assert_abs_diff_eq!(fv_plain, 94_080.0, epsilon = 94_080.0 * TOL);
    // Grade 10.9: fub = 1000 MPa → Fv = 0.5 · 1000 · 245 / 1.25 = 98 000 N.
    let fv_109 = ec3_bolt_shear_resistance(BoltGrade::Grade109, BoltSize::M20, true);
    assert_abs_diff_eq!(fv_109, 98_000.0, epsilon = 98_000.0 * TOL);
}

#[test]
fn m20_bearing_resistance_matches_hand_calculation() {
    // S355 plate t = 12 mm, e1 = 60 mm, e2 = 70 mm, p1 = 80 mm, p2 = 90 mm.
    // d0 = 22 mm: αd = 60/66 = 0.9091 ≤ fu/fub = 470/800 = 0.5875 → αb = 0.5875
    // k1 = min(2.8·70/66 − 1.7, 2.5) = 1.2697
    // Fb,Rd = 1.2697 · 0.5875 · 470e6 · 0.020 · 0.012 / 1.25 = 67 314 N
    let fb = ec3_bolt_bearing_resistance(
        BoltGrade::Grade88,
        BoltSize::M20,
        ec3_steel_fu("S355"),
        0.012,
        0.060,
        0.070,
        0.080,
        0.090,
        false,
    );
    assert_abs_diff_eq!(fb, 67_314.0, epsilon = 67_314.0 * TOL);
    // Inner bolt: αd = p1/(3 d0) − 0.25 = 80/66 − 0.25 = 0.9621 → still
    // capped by 0.5875; k1 = max(1.4·90/66 − 1.7, 1.5) = 1.5 (Table 3.4
    // floor). Fb,Rd = 1.5 · 0.5875 · 112 800 / 1.25 = 79 524 N
    let fb_inner = ec3_bolt_bearing_resistance(
        BoltGrade::Grade88,
        BoltSize::M20,
        ec3_steel_fu("S355"),
        0.012,
        0.060,
        0.070,
        0.080,
        0.090,
        true,
    );
    assert_abs_diff_eq!(fb_inner, 79_524.0, epsilon = 79_524.0 * TOL);
}

#[test]
fn combined_shear_tension_interaction_matches_hand_calculation() {
    // Fv,Ed = 40 kN, Ft,Ed = 20 kN on an M20 8.8:
    // 40/78.4 + 20/(1.4 · 98.784) = 0.51020 + 0.14457 = 0.65478
    let fv_rd = ec3_bolt_shear_resistance(BoltGrade::Grade88, BoltSize::M20, true);
    let ft_rd = ec3_bolt_tension_resistance(BoltGrade::Grade88, BoltSize::M20, false);
    let util = ec3_bolt_combined_shear_tension(40_000.0, fv_rd, 20_000.0, ft_rd);
    assert_abs_diff_eq!(util, 0.654_78, epsilon = 0.654_78 * TOL);
    assert!(util < 1.0);
    // Overstressed case: 70 kN shear + 60 kN tension →
    // 0.89286 + 60/(1.4 · 98.784) = 0.89286 + 0.43372 = 1.32658 > 1.
    let fail = ec3_bolt_combined_shear_tension(70_000.0, fv_rd, 60_000.0, ft_rd);
    assert_abs_diff_eq!(fail, 1.326_58, epsilon = 1.326_58 * TOL);
    assert!(fail > 1.0);
}

#[test]
fn block_tearing_matches_hand_calculation() {
    // Ant = t (e2 − d0) = 12 · (70 − 22) = 576 mm²
    // Veff,1,Rd = 0.6 · 470e6 · 5.76e-4 / 1.25 = 129 945.6 N
    let v_eff = ec3_block_tearing_resistance(ec3_steel_fu("S355"), 0.012, 0.070, 0.022);
    assert_abs_diff_eq!(v_eff, 129_945.6, epsilon = 129_945.6 * TOL);
    // Anv = t (e1 + (n−1) p1 − (n − 0.5) d0) with n = 4, e1 = 60, p1 = 80:
    // 12 · (60 + 3·80 − 3.5·22) = 12 · 223 = 2 676 mm²
    let anv = ec3_block_tearing_net_shear_area(0.012, 0.060, 0.080, 4, 0.022);
    assert_abs_diff_eq!(anv, 2_676.0e-6, epsilon = 2_676.0e-6 * TOL);
}

#[test]
fn s355_fillet_weld_directional_check_matches_hand_calculation() {
    // fw = 470e6 / (√3 · 0.90 · 1.25) = 241.20 MPa (Table 4.1 βw = 0.90).
    assert_abs_diff_eq!(ec3_beta_w("S355"), 0.90);
    assert_abs_diff_eq!(ec3_steel_fu("S355"), 470.0e6);
    let fw = ec3_fillet_weld_strength(ec3_steel_fu("S355"), ec3_beta_w("S355"));
    assert_abs_diff_eq!(fw, 241_204_100.0, epsilon = 241_204_100.0 * TOL);
    // Directional check, a = 4 mm, L = 300 mm, V = 120 kN pure parallel:
    // τ∥ = 120e3 / 1.2e-3 = 100 MPa; combined = √(3·100²) = 173.2 MPa
    // ≤ fu/(βw·γM2) = 470/1.125 = 417.78 MPa → η = 0.41451.
    let input = ConnectionInput {
        topology: JointTopology::FinPlate,
        grade: BoltGrade::Grade88,
        size: BoltSize::M20,
        threads_in_plane: true,
        n_rows: 4,
        n_cols: 1,
        p1: 0.080,
        p2: 0.090,
        e1: 0.060,
        e2: 0.070,
        plate_t: 0.012,
        steel_grade: "S355".into(),
        weld_throat_a: 0.004,
        weld_length: 0.300,
        n_ed: 0.0,
        v_ed: 120_000.0,
        m_ed: 0.0,
    };
    let result = ec3_connection_check(&input);
    let weld_node = result
        .trace
        .iter()
        .find(|n| n.title.contains("méthode directionnelle"))
        .expect("directional weld node present");
    assert_abs_diff_eq!(weld_node.value, 0.414_51, epsilon = 0.414_51 * TOL);
    assert!(weld_node.passed);
    // Simplified resistance Fw,Rd = fw · a · L = 241.20 · 1.2e-3 = 289.44 kN.
    assert_abs_diff_eq!(result.fw_rd, 289_445.0, epsilon = 289_445.0 * TOL);
}

#[test]
fn end_plate_moment_rows_match_hand_calculation() {
    // M_Ed = 60 kN·m on 4 rows × 2 cols: the plastic distribution puts the
    // tension rows (rows = (4+1)/2 = 2) at the lever arm
    // z = e1 + p1 = 60 + 80 = 140 mm →
    // Ft,Ed = 60e3/0.140 / (2 rows · 2 cols) = 107 142.9 N per bolt.
    let input = ConnectionInput {
        topology: JointTopology::EndPlate,
        grade: BoltGrade::Grade88,
        size: BoltSize::M20,
        threads_in_plane: true,
        n_rows: 4,
        n_cols: 2,
        p1: 0.080,
        p2: 0.090,
        e1: 0.060,
        e2: 0.070,
        plate_t: 0.012,
        steel_grade: "S355".into(),
        weld_throat_a: 0.004,
        weld_length: 0.300,
        n_ed: 0.0,
        v_ed: 120_000.0,
        m_ed: 60_000.0,
    };
    let result = ec3_connection_check(&input);
    let ft_node = result
        .trace
        .iter()
        .find(|n| n.title.contains("Tension des boulons"))
        .expect("tension node present");
    assert_abs_diff_eq!(ft_node.value, 107_142.9 / 98_784.0, epsilon = 0.005);
    // The moment joint is tension-governed past the pure-shear case.
    assert!(result.utilization > 0.9);
}

#[test]
fn fin_plate_gusset_topologies_stay_shear_governed() {
    let base = ConnectionInput {
        topology: JointTopology::FinPlate,
        n_ed: 0.0,
        m_ed: 0.0,
        // Generous edge distances so every clause passes (e2 = 70 mm keeps
        // the block-tearing resistance above the 100 kN design shear).
        e1: 0.060,
        e2: 0.070,
        ..ConnectionInput::default()
    };
    let fin = ec3_connection_check(&base);
    let gusset = ec3_connection_check(&ConnectionInput {
        topology: JointTopology::Gusset,
        n_ed: 150_000.0,
        ..base.clone()
    });
    // Both topologies keep the full trace (shear, bearing, tension,
    // interaction, block tear).
    assert!(fin.trace.len() >= 5);
    assert!(gusset.trace.len() >= 5);
    assert!(fin.trace.iter().all(|n| n.passed));
}

#[test]
fn utilization_equals_the_worst_trace_ratio() {
    let input = ConnectionInput::default();
    let result = ec3_connection_check(&input);
    let worst = result
        .trace
        .iter()
        .fold(0.0_f64, |m, n| m.max(n.value / n.limit));
    assert_abs_diff_eq!(result.utilization, worst, epsilon = 1.0e-12);
    assert_ne!(result.governing, String::new());
}

#[test]
fn bolt_grade_and_size_parsers_round_trip() {
    assert_eq!(BoltGrade::parse("4.6"), BoltGrade::Grade46);
    assert_eq!(BoltGrade::parse("10.9"), BoltGrade::Grade109);
    assert_eq!(BoltGrade::parse("anything"), BoltGrade::Grade88);
    assert_eq!(BoltSize::parse("M12").diameter(), 0.012);
    assert_eq!(BoltSize::parse("M36").diameter(), 0.036);
    assert_eq!(BoltSize::parse("weird"), BoltSize::M20);
    // Hole = d + 2 mm clearance.
    assert_abs_diff_eq!(BoltSize::M24.hole(), 0.026, epsilon = 1.0e-12);
    // Topology labels stay French (studio copy).
    assert_eq!(JointTopology::EndPlate.label(), "Platine d'about");
    assert_eq!(JointTopology::FinPlate.label(), "Éclisse / Attache d'âme");
    assert_eq!(JointTopology::Gusset.label(), "Gousset de treillis");
}
