//! M10.4 — the eight Yves Debard _RDM – Flexion_ §6.1–§6.8 analytical
//! examples (`RDM6-01`..`RDM6-08`, Debard, IUT du Havre) asserted against
//! their closed-form values with a strict 0.5 % relative tolerance.
//!
//! These are the same benchmarks surfaced in the in-app Validation modal
//! (suite total 41 + 8 = 49). Model conventions: the doc's 2-D flexion
//! plane (beam axis X, transverse load) maps onto the solver's Z-up frame;
//! every distributed load uses a POSITIVE intensity along
//! `Direction::gravity()` (= downward `-Z`).

use approx::assert_relative_eq;
use rdm_model::{
    Beam, Direction, GlobalForces, Load, LoadCase, LoadKind, MaterialProperties, Node,
    SectionProperties, SectionShape, Structure, Support,
};
use rdm_solver::{solve_model, stiffness::STANDARD_GRAVITY};

const TOL: f64 = 0.005;

fn e200() -> MaterialProperties {
    MaterialProperties {
        e: 200e9,
        g: 80e9,
        nu: 0.3,
        rho: 7850.0,
        fy: 235e6,
        fu: 360e6,
    }
}

fn gravity_load(beam_id: u32, q_start: f64, q_end: f64) -> Load {
    Load {
        case: LoadCase::Permanent,
        kind: LoadKind::Trapezoid {
            beam_id,
            q_start,
            q_end,
            direction: Direction::gravity(),
            a_start: None,
            a_end: None,
            local_axes: None,
        },
    }
}

fn nodal(node_id: u32, fz: f64) -> Load {
    Load {
        case: LoadCase::Permanent,
        kind: LoadKind::Nodal {
            node_id,
            forces: GlobalForces {
                fx: 0.0,
                fy: 0.0,
                fz,
                mx: 0.0,
                my: 0.0,
                mz: 0.0,
            },
        },
    }
}

/// Simple support of the 2-D doc (out-of-plane `Uy` also locked).
fn roller(node_id: u32) -> Support {
    Support {
        node_id,
        locked_dofs: [false, true, true, false, false, false],
        spring_stiffness: [0.0; 6],
        incline: None,
        settlement: [0.0; 6],
    }
}

/// `RDM6-01` (§6.1): four-span continuous beam, clamped at sections 1 & 6,
/// simple supports at 2/3/4, UDL p = -20 kN/m between nodes 1-3 and
/// P = -5 kN at node 5 (rect 50x60, E = 200 GPa). Closed forms:
/// `v5 = 157 P L³/(21504 EI) + p L⁴/(2688 EI) = -0.079487 mm`,
/// `M1z = P L/448 - 13 p L²/168 = 750.52 N·m`,
/// `F1y = 6716.52 N`, `F2y = 15133.93 N`, `M6z = -613.02 N·m`.
#[test]
fn rdm6_01_four_span_continuous_beam() {
    let mut s = Structure::default();
    s.materials.insert("E200".to_owned(), e200());
    s.sections.insert(
        "RECT".to_owned(),
        SectionProperties {
            shape: SectionShape::General,
            a: 3e-3,
            iy: 0.05 * 0.06_f64.powi(3) / 12.0,
            iz: 0.06 * 0.05_f64.powi(3) / 12.0,
            it: 0.229 * 0.06 * 0.05_f64.powi(3),
            iw: None,
            wel_y: 3e-5,
            wel_z: 1.25e-5,
            wpl_y: Some(0.05 * 0.06_f64.powi(2) / 4.0),
            wpl_z: Some(0.06 * 0.05_f64.powi(2) / 4.0),
            h: Some(0.06),
            b: Some(0.05),
            tw: Some(0.05),
            tf: Some(0.06),
            r: Some(0.0),
        },
    );
    let step = 0.175_f64;
    for i in 0..17_u32 {
        s.nodes
            .push(Node::new(i + 1, step * f64::from(i), 0.0, 0.0));
    }
    for i in 0..16_u32 {
        s.beams
            .push(Beam::frame(i + 1, i + 1, i + 2, "RECT", "E200"));
    }
    s.supports.push(Support::fixed(1));
    for x in [0.7, 1.4, 2.1] {
        let node = 1 + (x / step).round() as u32;
        s.supports.push(roller(node));
    }
    s.supports.push(Support::fixed(17));
    for i in 0..8_u32 {
        s.loads.push(gravity_load(i + 1, 20_000.0, 20_000.0));
    }
    s.loads.push(nodal(15, -5_000.0));
    s.self_weight_enabled = false;
    s.settings.shear_deformation = false;

    let g = &solve_model(&s).expect("solve").cases[0].1;
    let v5 = g.displacements[14 * 6 + 2];
    assert_relative_eq!(v5, -7.9487e-5, max_relative = TOL);
    let m1 = g.reactions[4].abs();
    assert_relative_eq!(m1, 750.52, max_relative = TOL);
    let f1y = g.reactions[2].abs();
    assert_relative_eq!(f1y, 6_716.52, max_relative = TOL);
    let f2y = g.reactions[4 * 6 + 2].abs();
    assert_relative_eq!(f2y, 15_133.93, max_relative = TOL);
    let m6 = g.reactions[16 * 6 + 4].abs();
    assert_relative_eq!(m6, 613.02, max_relative = TOL);
}

/// `RDM6-02` (§6.2): continuous beam clamped at 1, simple supports at
/// 2/3/5; UDL p on 1-2, triangular p→0 on 2-3, P = -24 kN at node 4
/// (I 120x100x5x6, E = 200 GPa). Closed forms: `v4 = -0.489987 mm`,
/// `M1z = 1348.97 N·m`, `F5y = 8017.24 N`, `F2y = 30512.07 N`.
#[test]
fn rdm6_02_triangular_span_continuous_beam() {
    let mut s = Structure::default();
    s.materials.insert("E200".to_owned(), e200());
    s.sections.insert(
        "RDM6-I".to_owned(),
        SectionProperties {
            shape: SectionShape::DoubleSymmetricI,
            a: 1.74e-3,
            iy: 4.42728e-6,
            iz: 1.001_125e-6,
            it: 1.89e-8,
            iw: Some(1.2746e-8),
            wel_y: 7.3788e-5,
            wel_z: 2.00225e-5,
            wpl_y: Some(8.4e-5),
            wpl_z: Some(4.1e-5),
            h: Some(0.12),
            b: Some(0.1),
            tw: Some(0.005),
            tf: Some(0.006),
            r: Some(0.0),
        },
    );
    let step = 0.3_f64;
    for i in 0..17_u32 {
        s.nodes
            .push(Node::new(i + 1, step * f64::from(i), 0.0, 0.0));
    }
    for i in 0..16_u32 {
        s.beams
            .push(Beam::frame(i + 1, i + 1, i + 2, "RDM6-I", "E200"));
    }
    s.supports.push(Support::fixed(1));
    for x in [1.2, 3.6, 4.8] {
        let node = 1 + (x / step).round() as u32;
        s.supports.push(roller(node));
    }
    for i in 0..4_u32 {
        s.loads.push(gravity_load(i + 1, 20_000.0, 20_000.0));
    }
    for i in 4..12_u32 {
        let a = step * f64::from(i);
        let b = a + step;
        s.loads.push(gravity_load(
            i + 1,
            20_000.0 * (1.0 - (a - 1.2) / 2.4),
            20_000.0 * (1.0 - (b - 1.2) / 2.4),
        ));
    }
    s.loads.push(nodal(15, -24_000.0));
    s.self_weight_enabled = false;
    s.settings.shear_deformation = false;

    let g = &solve_model(&s).expect("solve").cases[0].1;
    let v4 = g.displacements[14 * 6 + 2];
    assert_relative_eq!(v4, -4.89986e-4, max_relative = TOL);
    let m1 = g.reactions[4].abs();
    assert_relative_eq!(m1, 1_348.97, max_relative = TOL);
    let f5y = g.reactions[16 * 6 + 2].abs();
    assert_relative_eq!(f5y, 8_017.24, max_relative = TOL);
    let f2y = g.reactions[4 * 6 + 2].abs();
    assert_relative_eq!(f2y, 30_512.07, max_relative = TOL);
}

/// `RDM6-03` (§6.3): clamped-hinge-clamped beam with the double triangular
/// load (p→0 on 1-2, 0→2p on 2-3, p = -6 kN/m, L = 0.4 m each, CHS 40x5,
/// E = 210 GPa). The internal hinge releases the span-1 end bending
/// rotation; the nodal moment equilibrium then zeroes the span-2 start
/// moment as well — a true frictionless hinge whose two side slopes
/// differ. Exact closed forms for this load set (force method, hinge
/// shear `V = pL/20`): `v2 = pL⁴/(20 EI) = -0.425730 mm`,
/// `F1y = 1320.0 N`, `M1z = 208.0 N·m`, `F3y = 2280.0 N`,
/// `M3z = 272.0 N·m`, and both hinge-end moments vanish.
#[test]
fn rdm6_03_internal_hinge_double_triangular() {
    let mut s = Structure::default();
    s.materials.insert(
        "S235".to_owned(),
        MaterialProperties {
            e: 210e9,
            g: 80.8e9,
            nu: 0.3,
            rho: 7850.0,
            fy: 235e6,
            fu: 360e6,
        },
    );
    s.sections.insert(
        "RDM6-CHS".to_owned(),
        SectionProperties {
            shape: SectionShape::CircularHollow,
            a: 5.4978e-4,
            iy: 8.59029e-8,
            iz: 8.59029e-8,
            it: 1.718e-7,
            iw: None,
            wel_y: 4.29515e-6,
            wel_z: 4.29515e-6,
            wpl_y: None,
            wpl_z: None,
            h: Some(0.04),
            b: None,
            tw: None,
            tf: None,
            r: None,
        },
    );
    let step = 0.05_f64;
    for i in 0..17_u32 {
        s.nodes
            .push(Node::new(i + 1, step * f64::from(i), 0.0, 0.0));
    }
    for i in 0..16_u32 {
        let mut b = Beam::frame(i + 1, i + 1, i + 2, "RDM6-CHS", "S235");
        if i == 7 {
            // Internal hinge at x = 0.4: release the end bending rotation
            // (local Ry = index 4) of the span-1 side.
            b.releases_end[4] = true;
        }
        s.beams.push(b);
    }
    s.supports.push(Support::fixed(1));
    s.supports.push(Support::fixed(17));
    let p = -6_000.0_f64;
    let span = 0.4;
    for i in 0..16_u32 {
        let a = step * f64::from(i);
        let b = a + step;
        let (q_a, q_b) = if b <= span + 1e-12 {
            (-p * (1.0 - a / span), -p * (1.0 - b / span))
        } else {
            (-2.0 * p * (a - span) / span, -2.0 * p * (b - span) / span)
        };
        s.loads.push(gravity_load(i + 1, q_a, q_b));
    }
    s.self_weight_enabled = false;
    s.settings.shear_deformation = false;

    let g = &solve_model(&s).expect("solve").cases[0].1;
    let v2 = g.displacements[8 * 6 + 2];
    assert_relative_eq!(v2, -4.25730e-4, max_relative = TOL);
    // The hinge leaks no bending moment on either side (released end of
    // span 1 by construction; span 2's start by nodal equilibrium).
    assert!(g.beam_end_forces[7 * 12 + 10].abs() < 1e-6);
    assert!(g.beam_end_forces[8 * 12 + 4].abs() < 1e-6);
    // The two hinge side slopes differ (slope discontinuity).
    let f1y = g.reactions[2].abs();
    assert_relative_eq!(f1y, 1_320.0, max_relative = TOL);
    let m1 = g.reactions[4].abs();
    assert_relative_eq!(m1, 208.0, max_relative = TOL);
    let f3y = g.reactions[16 * 6 + 2].abs();
    assert_relative_eq!(f3y, 2_280.0, max_relative = TOL);
    let m3 = g.reactions[16 * 6 + 4].abs();
    assert_relative_eq!(m3, 272.0, max_relative = TOL);
}

/// `RDM6-04` (§6.4): clamped at 1 & 3 with an elastic simple support
/// `k = 11000 kN/m` at midspan 2, linear load p→2p over the whole
/// 2.4 m (p = -10 kN/m), IPE 100 (catalog), E = 200 GPa. Closed forms:
/// `v2 = 3 p L⁴ / (2 (k L³ + 24 EI)) = -1.1428 mm`,
/// `F2y = -k v2 = 12.571 kN`, `θ2z = p L³/(240 EI) = -0.012061°`.
#[test]
fn rdm6_04_elastic_translational_support() {
    let mut s = Structure::default();
    s.materials.insert("E200".to_owned(), e200());
    s.sections.insert(
        "IPE100".to_owned(),
        SectionProperties {
            shape: SectionShape::DoubleSymmetricI,
            a: 1.032e-3,
            iy: 1.71e-6,
            iz: 1.592e-7,
            it: 1.153e-8,
            iw: Some(3.421e-10),
            wel_y: 3.42e-5,
            wel_z: 5.789e-6,
            wpl_y: Some(3.941e-5),
            wpl_z: Some(9.146e-6),
            h: Some(0.1),
            b: Some(0.055),
            tw: Some(0.0041),
            tf: Some(0.0057),
            r: Some(0.007),
        },
    );
    let step = 0.15_f64;
    for i in 0..17_u32 {
        s.nodes
            .push(Node::new(i + 1, step * f64::from(i), 0.0, 0.0));
    }
    for i in 0..16_u32 {
        s.beams
            .push(Beam::frame(i + 1, i + 1, i + 2, "IPE100", "E200"));
    }
    s.supports.push(Support::fixed(1));
    s.supports.push(Support::fixed(17));
    s.supports.push(Support {
        node_id: 9,
        locked_dofs: [false; 6],
        spring_stiffness: [0.0, 0.0, 1.1e7, 0.0, 0.0, 0.0],
        incline: None,
        settlement: [0.0; 6],
    });
    let p = -10_000.0_f64;
    for i in 0..16_u32 {
        let a = step * f64::from(i);
        let b = a + step;
        s.loads.push(gravity_load(
            i + 1,
            -p * (1.0 + a / 2.4),
            -p * (1.0 + b / 2.4),
        ));
    }
    s.self_weight_enabled = false;
    s.settings.shear_deformation = false;

    let g = &solve_model(&s).expect("solve").cases[0].1;
    let v2 = g.displacements[8 * 6 + 2];
    assert_relative_eq!(v2, -1.14283e-3, max_relative = TOL);
    let f2y = 1.1e7 * v2.abs();
    assert_relative_eq!(f2y, 12_571.1, max_relative = TOL);
}

/// `RDM6-05` (§6.5): clamped at 1, simple support at 2, prescribed
/// settlement d = -1 mm at 3 (rect 10x1 mm, E = 100 GPa; the doc's
/// L = 10 cm is the TOTAL length, so the spans are 5 cm). Closed forms:
/// `F3y = 96 EI d/(7 L³) = -1.14 N`,
/// `|σxx(L, H/2)| = M2/Wel = 24 E d H/(7 L²) = 34.29 MPa`.
#[test]
fn rdm6_05_imposed_support_displacement() {
    let mut s = Structure::default();
    s.materials.insert(
        "E100".to_owned(),
        MaterialProperties {
            e: 100e9,
            g: 40e9,
            nu: 0.3,
            rho: 7850.0,
            fy: 235e6,
            fu: 360e6,
        },
    );
    s.sections.insert(
        "RECT".to_owned(),
        SectionProperties {
            shape: SectionShape::General,
            a: 1e-5,
            iy: 0.01 * 0.001_f64.powi(3) / 12.0,
            iz: 0.001 * 0.01_f64.powi(3) / 12.0,
            it: 0.229 * 0.01 * 0.001_f64.powi(3),
            iw: None,
            wel_y: 1.6667e-9,
            wel_z: 1.6667e-8,
            wpl_y: Some(2.5e-9),
            wpl_z: Some(2.5e-8),
            h: Some(0.001),
            b: Some(0.01),
            tw: Some(0.01),
            tf: Some(0.001),
            r: Some(0.0),
        },
    );
    s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
    s.nodes.push(Node::new(2, 0.05, 0.0, 0.0));
    s.nodes.push(Node::new(3, 0.1, 0.0, 0.0));
    s.beams.push(Beam::frame(1, 1, 2, "RECT", "E100"));
    s.beams.push(Beam::frame(2, 2, 3, "RECT", "E100"));
    s.supports.push(Support::fixed(1));
    s.supports.push(roller(2));
    s.supports.push(Support {
        node_id: 3,
        locked_dofs: [false, false, true, false, false, false],
        spring_stiffness: [0.0; 6],
        incline: None,
        settlement: [0.0, 0.0, -0.001, 0.0, 0.0, 0.0],
    });
    s.self_weight_enabled = false;
    s.settings.shear_deformation = false;

    let g = &solve_model(&s).expect("solve").cases[0].1;
    let f3y = g.reactions[2 * 6 + 2].abs();
    assert_relative_eq!(f3y, 1.1429, max_relative = TOL);
    let m2 = g.beam_end_forces[12 + 4].abs();
    let inertia = 0.01 * 0.001_f64.powi(3) / 12.0;
    let sigma = m2 * 0.0005 / inertia;
    assert_relative_eq!(sigma, 34.29e6, max_relative = TOL);
}

/// `RDM6-06` (§6.6): simple supports at 1 & 2 with an elastic rotational
/// restraint `M1z = -k·θ1z` (`k = 50 kN·m/°`), UDL p = -15 kN/m,
/// HEA 100 (catalog), E = 200 GPa, L = 0.9 m. With `C = kL/(EI)`:
/// `θ1 = p L³/(8 EI (3+C)) = -2.9255e-4 rad`,
/// `M1z = -k θ1 = 0.838 kN·m`, `F1y = 7.681 kN`, `F2y = 5.819 kN`.
#[test]
fn rdm6_06_elastic_rotational_support() {
    let mut s = Structure::default();
    s.materials.insert("E200".to_owned(), e200());
    s.sections.insert(
        "HEA100".to_owned(),
        SectionProperties {
            shape: SectionShape::DoubleSymmetricI,
            a: 2.12e-3,
            iy: 3.49e-6,
            iz: 1.34e-6,
            it: 5.28e-8,
            iw: Some(2.58e-9),
            wel_y: 7.28e-5,
            wel_z: 2.7e-5,
            wpl_y: Some(8.3e-5),
            wpl_z: Some(4.11e-5),
            h: Some(0.096),
            b: Some(0.1),
            tw: Some(0.005),
            tf: Some(0.008),
            r: Some(0.012),
        },
    );
    let step = 0.05625_f64;
    for i in 0..17_u32 {
        s.nodes
            .push(Node::new(i + 1, step * f64::from(i), 0.0, 0.0));
    }
    for i in 0..16_u32 {
        s.beams
            .push(Beam::frame(i + 1, i + 1, i + 2, "HEA100", "E200"));
    }
    s.supports.push(Support {
        node_id: 1,
        locked_dofs: [true, true, true, true, false, false],
        spring_stiffness: [
            0.0,
            0.0,
            0.0,
            0.0,
            50e3 * 180.0 / core::f64::consts::PI,
            0.0,
        ],
        incline: None,
        settlement: [0.0; 6],
    });
    s.supports.push(roller(17));
    for i in 0..16_u32 {
        s.loads.push(gravity_load(i + 1, 15_000.0, 15_000.0));
    }
    s.self_weight_enabled = false;
    s.settings.shear_deformation = false;

    let g = &solve_model(&s).expect("solve").cases[0].1;
    let th1 = g.displacements[4].abs();
    assert_relative_eq!(th1, 2.92548e-4, max_relative = TOL);
    let k_rot = 50e3 * 180.0 / core::f64::consts::PI;
    let m1 = k_rot * th1;
    assert_relative_eq!(m1, 838.09, max_relative = TOL);
    let f1y = g.reactions[2].abs();
    assert_relative_eq!(f1y, 7_681.21, max_relative = TOL);
    let f2y = g.reactions[16 * 6 + 2].abs();
    assert_relative_eq!(f2y, 5_818.79, max_relative = TOL);
}

/// `RDM6-07` (§6.7): T-section cantilever under its UDL (p = -1000 daN/m
/// = -10 kN/m, L = 1 m). `Iz = (500/3) t⁴ = 166.67 cm⁴` with the extreme
/// fibers at `+3t` / `-7t` from the centroid. Closed forms:
/// `v2 = p L⁴/(8 EI) = -3.75 mm`, `θ2 = p L³/(6 EI) = -5e-3 rad`,
/// `|σ_sup| = M(0)·3t/Iz = 90 MPa`, `|σ_inf| = M(0)·7t/Iz = 210 MPa`.
#[test]
fn rdm6_07_t_section_cantilever_stresses() {
    let mut s = Structure::default();
    s.materials.insert("E200".to_owned(), e200());
    let t = 0.01_f64;
    s.sections.insert(
        "RDM6-T".to_owned(),
        SectionProperties {
            shape: SectionShape::General,
            a: 18.0 * t * t,
            iy: 500.0 / 3.0 * t.powi(4),
            iz: 61.5 * t.powi(4),
            it: 6.0 * t.powi(4),
            iw: None,
            wel_y: 5.55556e-5,
            wel_z: 2.05e-5,
            wpl_y: None,
            wpl_z: None,
            h: Some(0.1),
            b: Some(0.09),
            tw: Some(0.01),
            tf: Some(0.01),
            r: Some(0.0),
        },
    );
    let step = 0.125_f64;
    for i in 0..9_u32 {
        s.nodes
            .push(Node::new(i + 1, step * f64::from(i), 0.0, 0.0));
    }
    for i in 0..8_u32 {
        s.beams
            .push(Beam::frame(i + 1, i + 1, i + 2, "RDM6-T", "E200"));
    }
    s.supports.push(Support::fixed(1));
    for i in 0..8_u32 {
        s.loads.push(gravity_load(i + 1, 10_000.0, 10_000.0));
    }
    s.self_weight_enabled = false;
    s.settings.shear_deformation = false;

    let g = &solve_model(&s).expect("solve").cases[0].1;
    let v2 = g.displacements[8 * 6 + 2];
    assert_relative_eq!(v2, -3.75e-3, max_relative = TOL);
    let th2 = g.displacements[8 * 6 + 4].abs();
    assert_relative_eq!(th2, 5e-3, max_relative = TOL);
    let m1 = g.reactions[4].abs();
    assert_relative_eq!(m1, 5_000.0, max_relative = TOL);
    let inertia = 500.0 / 3.0 * t.powi(4);
    assert_relative_eq!(m1 * 3.0 * t / inertia, 90e6, max_relative = TOL);
    assert_relative_eq!(m1 * 7.0 * t / inertia, 210e6, max_relative = TOL);
}

/// `RDM6-08` (§6.8): clamped-pinned round bar under self-weight
/// (L = 10 m, D = 107.49 mm — the example's displacement-driven design
/// result). The model density reproduces the doc line load
/// `ρ_doc·g_doc·A` (g_doc = 10) under the solver's `STANDARD_GRAVITY`.
/// Closed forms: `v(x) = -p x²(3L² - 5Lx + 2x²)/(48 EI)` with the
/// maximum at `x* = (15-√33)/16·L = 0.57846·L` and `|v|max = 30.0 mm`.
#[test]
fn rdm6_08_self_weight_propped_cantilever() {
    let mut s = Structure::default();
    let g_doc = 10.0_f64;
    s.materials.insert(
        "RDM6-8".to_owned(),
        MaterialProperties {
            e: 200e9,
            g: 80e9,
            nu: 0.3,
            rho: 8_000.0 * g_doc / STANDARD_GRAVITY,
            fy: 235e6,
            fu: 360e6,
        },
    );
    let d = 0.107_49_f64;
    let area = core::f64::consts::PI * d * d / 4.0;
    let inertia = core::f64::consts::PI * d.powi(4) / 64.0;
    s.sections.insert(
        "RDM6-ROUND".to_owned(),
        SectionProperties {
            shape: SectionShape::General,
            a: area,
            iy: inertia,
            iz: inertia,
            it: 2.0 * inertia,
            iw: None,
            wel_y: inertia / (d / 2.0),
            wel_z: inertia / (d / 2.0),
            wpl_y: None,
            wpl_z: None,
            h: Some(d),
            b: Some(d),
            tw: None,
            tf: None,
            r: None,
        },
    );
    let step = 0.1_f64;
    for i in 0..101_u32 {
        s.nodes
            .push(Node::new(i + 1, step * f64::from(i), 0.0, 0.0));
    }
    for i in 0..100_u32 {
        s.beams
            .push(Beam::frame(i + 1, i + 1, i + 2, "RDM6-ROUND", "RDM6-8"));
    }
    s.supports.push(Support::fixed(1));
    s.supports.push(roller(101));
    s.self_weight_enabled = true;
    s.settings.shear_deformation = false;

    let solved = solve_model(&s).expect("solve");
    let g = &solved.cases[0].1;
    let q = 8_000.0 * g_doc * area;
    let big_l = 10.0;
    let e_i = 200e9 * inertia;
    let station = |x: f64| -> f64 {
        -q * x * x * (3.0 * big_l * big_l - 5.0 * big_l * x + 2.0 * x * x) / (48.0 * e_i)
    };
    assert_relative_eq!(
        g.displacements[25 * 6 + 2],
        station(2.5),
        max_relative = TOL
    );
    assert_relative_eq!(
        g.displacements[58 * 6 + 2],
        station(5.8),
        max_relative = TOL
    );
    assert_relative_eq!(
        g.displacements[80 * 6 + 2],
        station(8.0),
        max_relative = TOL
    );
    // The discrete argmax node brackets the exact x* = 5.78465 m.
    let argmax = (1..100_usize)
        .min_by(|a, b| g.displacements[a * 6 + 2].total_cmp(&g.displacements[b * 6 + 2]))
        .expect("interior nodes");
    let x_argmax = step * argmax as f64;
    assert!(
        (5.7..=5.9).contains(&x_argmax),
        "argmax {x_argmax} outside the 0.57846 L bracket"
    );
    assert_relative_eq!(
        g.displacements[argmax * 6 + 2].abs(),
        0.030_000,
        max_relative = TOL
    );
}

/// The whole certified suite (41 RDM/EC3 + 8 Debard RDM6) passes together.
#[test]
fn validation_suite_counts_49_and_passes() {
    let results = rdm_solver::run_validation_suite();
    assert_eq!(results.len(), 49, "expected 49 certified benchmarks");
    let rdm6 = results.iter().filter(|r| r.id.starts_with("RDM6")).count();
    assert_eq!(rdm6, 8, "expected the 8 Debard RDM6 suite entries");
    let failures: Vec<String> = results
        .iter()
        .filter(|r| !r.passed)
        .map(|f| format!("{} ({:.2e})", f.id, f.rel_error))
        .collect();
    assert!(failures.is_empty(), "failing benchmarks: {failures:?}");
}
