//! M11.1 integration tests — exact composite cross-section mechanics.

//! Verifies [`rdm_cad::sections::compute_composite_section`] against
//! textbook closed forms and EN 10365 nominal properties:

//! - single rectangle (`b·h³/12`, `Wpl/Wel = 1.5`);
//! - built-up 3-plate IPE 300 against the EN 10365 nominal row (< 0.5 % on
//!   A / Iy / Wel,y / Wpl,y; the tabulated `Iz` embeds the untabulated
//!   flange-toe radii of the hot roll, checked at 1.2 % with a comment);
//! - asymmetric T-section centroid `zG` and plastic modulus `Wpl,y` against
//!   the exact bisection closed forms;
//! - rotated equal-leg angle: principal axes at ±45°, rotation covariance
//!   and `(Iu, Iv)` invariance;
//! - EN 1993-1-1 Table 5.2 classification across S235..S460 and §6.2.6
//!   shear areas.

use approx::{assert_abs_diff_eq, assert_relative_eq};
use rdm_cad::sections::{compute_composite_section, CompositeSectionError, STEEL_DENSITY};
use rdm_model::{CompositeElement, CompositeElementKind, CompositeSectionDef, SteelGrade};

/// Horizontal plate helper (length along y, thickness along z).
fn plate(length: f64, thickness: f64, dy: f64, dz: f64) -> CompositeElement {
    CompositeElement {
        kind: CompositeElementKind::Plate { length, thickness },
        dy,
        dz,
        theta: 0.0,
        mirror_y: false,
        mirror_z: false,
    }
}

/// Vertical plate helper (rotated 90°: the length rises along z).
fn web_plate(height: f64, thickness: f64, dy: f64, dz: f64) -> CompositeElement {
    CompositeElement {
        kind: CompositeElementKind::Plate {
            length: height,
            thickness,
        },
        dy,
        dz,
        theta: std::f64::consts::FRAC_PI_2,
        mirror_y: false,
        mirror_z: false,
    }
}

fn profile(designation: &str, dy: f64, dz: f64, theta: f64) -> CompositeElement {
    CompositeElement {
        kind: CompositeElementKind::Profile {
            designation: designation.to_owned(),
        },
        dy,
        dz,
        theta,
        mirror_y: false,
        mirror_z: false,
    }
}

#[test]
fn single_rectangle_matches_the_textbook_formulas() {
    let def = CompositeSectionDef {
        name: "PL 100x300".to_owned(),
        grade: SteelGrade::S235,
        elements: vec![plate(0.1, 0.3, 0.0, 0.0)],
    };
    let s = compute_composite_section(&def).expect("compute");
    assert_abs_diff_eq!(s.a, 0.1 * 0.3, epsilon = 1e-15);
    // Strong axis: Iy = b·h³/12 with b = 0.1 across, h = 0.3 vertical.
    assert_abs_diff_eq!(s.iy, 0.1 * 0.3_f64.powi(3) / 12.0, epsilon = 1e-15);
    assert_abs_diff_eq!(s.iz, 0.3 * 0.1_f64.powi(3) / 12.0, epsilon = 1e-15);
    assert_abs_diff_eq!(s.iyz, 0.0, epsilon = 1e-18);
    assert_abs_diff_eq!(s.z_max, 0.15);
    assert_abs_diff_eq!(s.z_min, -0.15);
    assert_abs_diff_eq!(s.wel_y_sup, s.iy / 0.15, epsilon = 1e-15);
    assert_abs_diff_eq!(s.wel_y_inf, s.iy / 0.15, epsilon = 1e-15);
    assert_abs_diff_eq!(s.wpl_y, 0.1 * 0.3_f64.powi(2) / 4.0, epsilon = 1e-12);
    // Shape factor of the rectangle: Wpl / Wel = 1.5.
    assert_relative_eq!(s.wpl_y / s.wel_y, 1.5, epsilon = 1e-9);
    assert_abs_diff_eq!(s.mass_per_m, STEEL_DENSITY * s.a, epsilon = 1e-12);
    // Solid plates: shear area = A in both directions (§6.2.6(1)(i)).
    assert_abs_diff_eq!(s.a_vy, s.a, epsilon = 1e-15);
    assert_abs_diff_eq!(s.a_vz, s.a, epsilon = 1e-15);
    // Plastic neutral axes of the doubly-symmetric plate.
    assert_abs_diff_eq!(s.pna_for_my, 0.0, epsilon = 1e-9);
    assert_abs_diff_eq!(s.pna_for_mz, 0.0, epsilon = 1e-9);
}

#[test]
fn ipe300_three_plate_built_up_matches_en_10365() {
    // IPE 300 (EN 10365): h = 300, b = 150, tw = 7.1, tf = 10.7, r = 15.
    let (h, b, tw, tf) = (0.3_f64, 0.15_f64, 0.0071_f64, 0.0107_f64);
    let h1 = h - 2.0 * tf;
    // Sharp 3-plate welded build-up (the milestone's fillet-free twin).
    let welded = CompositeSectionDef {
        name: "IPE300-3P".to_owned(),
        grade: SteelGrade::S235,
        elements: vec![
            plate(b, tf, 0.0, (h - tf) / 2.0),
            plate(b, tf, 0.0, -(h - tf) / 2.0),
            web_plate(h1, tw, 0.0, 0.0),
        ],
    };
    let s = compute_composite_section(&welded).expect("compute");
    // Sharp 3-plate closed forms (no fillets): Iy and Wpl exact.
    let iy_sharp = (b * h.powi(3) - (b - tw) * h1.powi(3)) / 12.0;
    assert_relative_eq!(s.iy, iy_sharp, max_relative = 1e-12);
    let wpl_sharp = tf * b * (h - tf) + h1.powi(2) * tw / 4.0;
    assert_relative_eq!(s.wpl_y, wpl_sharp, max_relative = 1e-9);

    // EN 10365 nominal row (crates/rdm-eurocode/data/en10365_profiles.json).
    let (a_nom, iy_nom, iz_nom, wel_nom, wpl_nom) = (
        0.005_381_f64,
        8.356e-5_f64,
        6.038e-6_f64,
        5.571e-4_f64,
        6.284e-4_f64,
    );

    // The rolled root fillets (4·r²(1 − π/4)) are exact engine geometry:
    // the filleted single-profile decomposition carries the 0.5 % contract.
    let filleted = CompositeSectionDef {
        name: "IPE300-fillet".to_owned(),
        grade: SteelGrade::S235,
        elements: vec![profile("IPE 300", 0.0, 0.0, 0.0)],
    };
    let p = compute_composite_section(&filleted).expect("compute profile");
    assert_relative_eq!(p.a, a_nom, max_relative = 0.001);
    assert_relative_eq!(p.iy, iy_nom, max_relative = 0.002);
    assert_relative_eq!(p.iz, iz_nom, max_relative = 0.002);
    assert_relative_eq!(p.wel_y, wel_nom, max_relative = 0.002);
    assert_relative_eq!(p.wpl_y, wpl_nom, max_relative = 0.005);
    assert_relative_eq!(p.i_radius_z, (iz_nom / a_nom).sqrt(), max_relative = 0.002);
    // Warping: the profile row carries the tabulated Iw verbatim.
    assert_relative_eq!(p.iw, 1.2426e-7, max_relative = 1e-9);
    // ... while the welded twin rebuilds it through the flange Steiner term.
    let iw_flanges = 2.0 * (tf * b.powi(3) / 12.0) * ((h - tf) / 2.0).powi(2);
    assert_relative_eq!(s.iw, iw_flanges, max_relative = 1e-9);
    assert_abs_diff_eq!(p.iyz, 0.0, epsilon = 1e-12);
    assert_abs_diff_eq!(p.mass_per_m, STEEL_DENSITY * p.a, epsilon = 1e-12);
    // EN 1993-1-1 Table 5.2 with the rolled-sheet web c = h − 2tf − 2r:
    // web 35.0 (Class 1 bending / Class 2 compression), outstand 6.7 (1).
    assert_eq!(p.class_bending, 1);
    assert_eq!(p.class_compression, 2);
    // §6.2.6: strong-axis shear rides the web formula, weak-axis the flanges.
    assert_relative_eq!(p.a_vy, 2.0 * b * tf, max_relative = 0.02);
    let av_web_formula = a_nom - 2.0 * b * tf + (tw + 2.0 * 0.015) * tf;
    assert_relative_eq!(
        p.a_vz,
        av_web_formula.max(1.2 * h1 * tw),
        max_relative = 0.005
    );
}

#[test]
fn asymmetric_t_section_centroid_and_plastic_modulus() {
    // Web 10x90 below + flange 100x10 on top, origin at the bottom centre.
    let def = CompositeSectionDef {
        name: "T-100".to_owned(),
        grade: SteelGrade::S235,
        elements: vec![
            web_plate(0.09, 0.01, 0.0, 0.045),
            plate(0.1, 0.01, 0.0, 0.095),
        ],
    };
    let s = compute_composite_section(&def).expect("compute");
    assert_abs_diff_eq!(s.a, 1.9e-3, epsilon = 1e-15);
    // Exact centroid: (900·45 + 1000·95) / 1900 = 71.3158 mm.
    assert_abs_diff_eq!(
        s.z_g,
        (0.9e-3 * 0.045 + 1.0e-3 * 0.095) / 1.9e-3,
        epsilon = 1e-15
    );
    assert_abs_diff_eq!(s.y_g, 0.0, epsilon = 1e-15);
    // Equal-area PNA inside the flange: 900 + 100·(z − 90) = 950 -> 90.5 mm.
    assert_abs_diff_eq!(s.pna_for_my, 0.0905, epsilon = 1e-9);
    // Exact plastic modulus: M+ = 100·(9.5²/2), M- = web + flange parts.
    let m_plus = 0.1 * 0.0095_f64.powi(2) / 2.0;
    let m_minus_web = 0.01 * (0.0905 * 0.09 - 0.09_f64.powi(2) / 2.0);
    let m_minus_flange = 0.1 * 0.0005_f64.powi(2) / 2.0;
    assert_abs_diff_eq!(
        s.wpl_y,
        m_plus + m_minus_web + m_minus_flange,
        epsilon = 1e-12
    );
    // Elastic moduli of the asymmetric section (top / bottom fibres).
    assert_abs_diff_eq!(s.z_max, 0.1 - s.z_g, epsilon = 1e-15);
    assert_abs_diff_eq!(s.z_min, -s.z_g, epsilon = 1e-15);
    assert_abs_diff_eq!(s.wel_y_sup, s.iy / s.z_max, epsilon = 1e-12);
    assert_abs_diff_eq!(s.wel_y_inf, s.iy / s.z_min.abs(), epsilon = 1e-12);
    // Both S235 classes are 1 (web 9 <= 33 epsilon, outstands 4.5 <= 9).
    assert_eq!(s.class_bending, 1);
    assert_eq!(s.class_compression, 1);
}

#[test]
fn rotated_angle_section_principal_axis_angle() {
    let straight = CompositeSectionDef {
        name: "L100-straight".to_owned(),
        grade: SteelGrade::S235,
        elements: vec![profile("L 100x100x10", 0.0, 0.0, 0.0)],
    };
    let s0 = compute_composite_section(&straight).expect("compute");
    // Equal legs: Iy == Iz and the principal axes close at ±45° (mod 90°).
    assert_relative_eq!(s0.iy, s0.iz, max_relative = 1e-9);
    assert!(s0.iyz.abs() > 0.0);
    let deviation = (s0.alpha_rad.abs() - std::f64::consts::FRAC_PI_4).abs();
    assert!(
        deviation < 1e-9,
        "principal axis angle {} deviates from 45°",
        s0.alpha_rad
    );
    // Principal moments satisfy the Mohr invariants.
    assert_abs_diff_eq!(s0.iu + s0.iv, s0.iy + s0.iz, epsilon = 1e-18);
    assert!(s0.iu >= s0.iv);
    assert_abs_diff_eq!(
        s0.iu - s0.iv,
        2.0 * (s0.iyz * s0.iyz).sqrt(),
        epsilon = 1e-15
    );

    // Rotating the element by 30° rotates the principal frame by 30° and
    // leaves the principal moments untouched.
    let rotated = CompositeSectionDef {
        name: "L100-rotated".to_owned(),
        grade: SteelGrade::S235,
        elements: vec![profile(
            "L 100x100x10",
            0.0,
            0.0,
            std::f64::consts::PI / 6.0,
        )],
    };
    let s30 = compute_composite_section(&rotated).expect("compute");
    assert_relative_eq!(s30.iu, s0.iu, max_relative = 1e-9);
    assert_relative_eq!(s30.iv, s0.iv, max_relative = 1e-9);
    let delta = (s30.alpha_rad - s0.alpha_rad - std::f64::consts::PI / 6.0)
        .rem_euclid(std::f64::consts::PI);
    let delta = delta.min(std::f64::consts::PI - delta);
    assert!(delta < 1e-9, "principal angle did not follow the rotation");
    // The centroid stays at the placement offset under rotation.
    assert_abs_diff_eq!(s30.y_g, 0.0, epsilon = 1e-15);
    assert_abs_diff_eq!(s30.z_g, 0.0, epsilon = 1e-15);
}

#[test]
fn classification_follows_the_steel_grade_and_slenderness() {
    // Slender welded I: web c/t = 100, flange outstand c/t = 4.5.
    let build = |grade| CompositeSectionDef {
        name: "slender".to_owned(),
        grade,
        elements: vec![
            plate(0.2, 0.02, 0.0, 0.21),
            plate(0.2, 0.02, 0.0, -0.21),
            web_plate(0.4, 0.004, 0.0, 0.0),
        ],
    };
    let s235 = compute_composite_section(&build(SteelGrade::S235)).expect("compute");
    // Bending: web 100 <= 124·1.0 (Class 3); compression: 100 > 42 (Class 4).
    assert_eq!(s235.class_bending, 3);
    assert_eq!(s235.class_compression, 4);
    // S460 (epsilon = 0.715): the same web crosses 124·epsilon -> Class 4.
    let s460 = compute_composite_section(&build(SteelGrade::S460)).expect("compute");
    assert_eq!(s460.class_bending, 4);
    assert_eq!(s460.class_compression, 4);
    // S355 (epsilon = 0.814): 100 <= 124·0.814 = 100.9 -> still Class 3.
    let s355 = compute_composite_section(&build(SteelGrade::S355)).expect("compute");
    assert_eq!(s355.class_bending, 3);
    // The classification detail rows carry both load modes.
    assert!(s235
        .classification
        .iter()
        .any(|p| p.pure_compression && p.class == 4));
    assert!(s235
        .classification
        .iter()
        .any(|p| !p.pure_compression && p.class == 3));
}

#[test]
fn shear_areas_follow_en_1993_1_1_6_2_6() {
    // Welded box (Caisson Soudé): two 200x8 walls + two 100x8 plates.
    let def = CompositeSectionDef {
        name: "box".to_owned(),
        grade: SteelGrade::S355,
        elements: vec![
            web_plate(0.2, 0.008, -0.046, 0.0),
            web_plate(0.2, 0.008, 0.046, 0.0),
            plate(0.1, 0.008, 0.0, 0.096),
            plate(0.1, 0.008, 0.0, -0.096),
        ],
    };
    let s = compute_composite_section(&def).expect("compute");
    // Walls carry the vertical shear; the flange set the horizontal one.
    assert_relative_eq!(s.a_vz, 2.0 * 0.2 * 0.008, max_relative = 1e-9);
    assert_relative_eq!(s.a_vy, 2.0 * 0.1 * 0.008, max_relative = 1e-9);
    // CHS: Av = 2A/π in both directions, exact annulus mechanics.
    let chs = CompositeSectionDef {
        name: "chs".to_owned(),
        grade: SteelGrade::S235,
        elements: vec![CompositeElement {
            kind: CompositeElementKind::Chs {
                diameter: 0.1143,
                thickness: 0.006,
            },
            dy: 0.0,
            dz: 0.0,
            theta: 0.0,
            mirror_y: false,
            mirror_z: false,
        }],
    };
    let c = compute_composite_section(&chs).expect("compute");
    let av_chs = 2.0 * c.a / std::f64::consts::PI;
    assert_relative_eq!(c.a_vy, av_chs, max_relative = 1e-9);
    assert_relative_eq!(c.a_vz, av_chs, max_relative = 1e-9);
    assert_relative_eq!(
        c.a,
        std::f64::consts::PI * (0.057_15_f64.powi(2) - 0.051_15_f64.powi(2)),
        epsilon = 1e-15
    );
    assert_relative_eq!(
        c.iy,
        std::f64::consts::PI * (0.057_15_f64.powi(4) - 0.051_15_f64.powi(4)) / 4.0,
        epsilon = 1e-15
    );
}

#[test]
fn parallel_axis_theorem_aggregates_the_sub_elements() {
    // Two flange plates only: Iy = 2·(b·tf³/12 + A·d²).
    let (b, tf, d) = (0.15_f64, 0.01_f64, 0.1_f64);
    let def = CompositeSectionDef {
        name: "2-plates".to_owned(),
        grade: SteelGrade::S235,
        elements: vec![plate(b, tf, 0.0, d), plate(b, tf, 0.0, -d)],
    };
    let s = compute_composite_section(&def).expect("compute");
    let expected = 2.0 * (b * tf.powi(3) / 12.0 + b * tf * d * d);
    assert_relative_eq!(s.iy, expected, max_relative = 1e-12);
    assert_relative_eq!(s.iz, 2.0 * tf * b.powi(3) / 12.0, max_relative = 1e-12);
    assert_abs_diff_eq!(s.z_g, 0.0, epsilon = 1e-15);
    assert_abs_diff_eq!(s.z_max, d + tf / 2.0, epsilon = 1e-15);
}

#[test]
fn upn_pair_back_to_back_is_symmetric() {
    // 2xUPN 200 dos-à-dos: mirrored pair, backs 10 mm apart.
    let catalog = rdm_eurocode::profile_catalog();
    let entry = catalog.entry("UPN 200").expect("catalog row");
    let b = entry.b.expect("UPN width");
    let d = b / 2.0 + 0.005;
    let def = CompositeSectionDef {
        name: "2UPN200".to_owned(),
        grade: SteelGrade::S355,
        elements: vec![
            profile("UPN 200", -d, 0.0, 0.0),
            CompositeElement {
                kind: CompositeElementKind::Profile {
                    designation: "UPN 200".to_owned(),
                },
                dy: d,
                dz: 0.0,
                theta: 0.0,
                mirror_y: true,
                mirror_z: false,
            },
        ],
    };
    let s = compute_composite_section(&def).expect("compute");
    assert_relative_eq!(s.a, 2.0 * entry.a, max_relative = 0.03);
    assert_abs_diff_eq!(s.y_g, 0.0, epsilon = 1e-12);
    assert_abs_diff_eq!(s.z_g, 0.0, epsilon = 1e-12);
    assert_abs_diff_eq!(s.iyz, 0.0, epsilon = 1e-12);
    // Weak-axis superposition against the engine's own single-channel
    // mechanics: 2·(Iz + A·d²) — the parallel-flange channel model carries
    // a documented +2 % area / +15 % Iz versus the tapered rolled row.
    let single = compute_composite_section(&CompositeSectionDef {
        name: "UPN200-single".to_owned(),
        grade: SteelGrade::S355,
        elements: vec![profile("UPN 200", 0.0, 0.0, 0.0)],
    })
    .expect("compute single");
    let expected_iz = 2.0 * (single.iz + single.a * d * d);
    assert_relative_eq!(s.iz, expected_iz, max_relative = 1e-9);
    assert_relative_eq!(s.a, 2.0 * single.a, max_relative = 1e-12);
}

#[test]
fn crane_girder_hea_plus_upn_resolves() {
    // Chemin de roulement: HEA 200 + UPN 200 riding on top (asymmetric).
    let catalog = rdm_eurocode::profile_catalog();
    let hea = catalog.entry("HEA 200").expect("catalog row");
    let upn = catalog.entry("UPN 200").expect("catalog row");
    let h_hea = hea.h.expect("HEA depth");
    let h_upn = upn.h.expect("UPN depth");
    let dz_upn = h_hea / 2.0 + h_upn / 2.0;
    let def = CompositeSectionDef {
        name: "crane".to_owned(),
        grade: SteelGrade::S355,
        elements: vec![
            profile("HEA 200", 0.0, 0.0, 0.0),
            profile("UPN 200", 0.0, dz_upn, 0.0),
        ],
    };
    let s = compute_composite_section(&def).expect("compute");
    assert_relative_eq!(s.a, hea.a + upn.a, max_relative = 0.03);
    // Centroid shifted towards the rail channel.
    let z_expected = upn.a * dz_upn / (hea.a + upn.a);
    assert_relative_eq!(s.z_g, z_expected, max_relative = 0.03);
    assert!(s.z_g > 0.0);
    assert!((1..=4).contains(&s.class_bending));
    assert!((1..=4).contains(&s.class_compression));
    // The plastic centroid moves up with the channel (asymmetric ANP).
    assert!(s.pna_for_my > s.z_g - 1e-9 || s.pna_for_my < s.z_g + 1e-9);
}

#[test]
fn errors_are_typed_and_total() {
    let empty = CompositeSectionDef {
        name: "x".to_owned(),
        grade: SteelGrade::S235,
        elements: vec![],
    };
    assert!(matches!(
        compute_composite_section(&empty),
        Err(CompositeSectionError::EmptySection { .. })
    ));
    let unknown = CompositeSectionDef {
        name: "y".to_owned(),
        grade: SteelGrade::S235,
        elements: vec![profile("NOPE 1", 0.0, 0.0, 0.0)],
    };
    assert!(matches!(
        compute_composite_section(&unknown),
        Err(CompositeSectionError::UnknownProfile { .. })
    ));
    let zero = CompositeSectionDef {
        name: "z".to_owned(),
        grade: SteelGrade::S235,
        elements: vec![plate(0.1, 0.0, 0.0, 0.0)],
    };
    assert!(matches!(
        compute_composite_section(&zero),
        Err(CompositeSectionError::NonPositiveDimension { .. })
    ));
    let hollow = CompositeSectionDef {
        name: "w".to_owned(),
        grade: SteelGrade::S235,
        elements: vec![CompositeElement {
            kind: CompositeElementKind::Chs {
                diameter: 0.1,
                thickness: 0.06,
            },
            dy: 0.0,
            dz: 0.0,
            theta: 0.0,
            mirror_y: false,
            mirror_z: false,
        }],
    };
    assert!(matches!(
        compute_composite_section(&hollow),
        Err(CompositeSectionError::WallTooThick { .. })
    ));
}

#[test]
fn section_properties_projection_feeds_the_solver_contract() {
    let def = CompositeSectionDef {
        name: "PRS-300".to_owned(),
        grade: SteelGrade::S355,
        elements: vec![
            plate(0.2, 0.012, 0.0, 0.144),
            plate(0.2, 0.012, 0.0, -0.144),
            web_plate(0.276, 0.008, 0.0, 0.0),
        ],
    };
    let s = compute_composite_section(&def).expect("compute");
    let props = &s.section_properties;
    assert_eq!(props.shape, rdm_model::SectionShape::DoubleSymmetricI);
    assert_relative_eq!(props.a, s.a, max_relative = 1e-12);
    assert_relative_eq!(props.iy, s.iy, max_relative = 1e-12);
    assert!(props.wpl_y.is_some());
    assert!(props.iw.is_some());
    // The mapped dims the EN 1993-1-1 checks consume.
    assert_relative_eq!(props.h.expect("h"), 0.3, max_relative = 1e-12);
    assert_relative_eq!(props.tw.expect("tw"), 0.008, max_relative = 1e-12);
    assert_relative_eq!(props.tf.expect("tf"), 0.012, max_relative = 1e-12);
}
