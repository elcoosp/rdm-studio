//! Analytical benchmarks (ARCHITECTURE.md §5, `analytical_benchmarks.rs`).
//!
//! Every benchmark compares the solver against a closed-form Euler-Bernoulli
//! or axial result with `approx` at 1e-12 relative tolerance.

use approx::assert_relative_eq;

use rdm_model::{
    Beam, Direction, GlobalForces, Load, LoadCase, LoadKind, Node, SectionShape, Structure, Support,
};
use rdm_solver::midspan_deflection_metric;

fn section(a: f64, iy: f64, iz: f64, it: f64) -> rdm_model::SectionProperties {
    rdm_model::SectionProperties {
        shape: SectionShape::DoubleSymmetricI,
        a,
        iy,
        iz,
        it,
        iw: Some(1.2746e-8),
        wel_y: iy / 0.1,
        wel_z: iz / 0.05,
        wpl_y: Some(1.15 * iy / 0.1),
        wpl_z: Some(1.15 * iz / 0.05),
        h: Some(0.2),
        b: Some(0.1),
        tw: Some(0.0056),
        tf: Some(0.0085),
        r: Some(0.012),
    }
}

fn material() -> rdm_model::MaterialProperties {
    rdm_model::MaterialProperties {
        e: 210e9,
        g: 81e9,
        nu: 0.3,
        rho: 7850.0,
        fy: 235e6,
        fu: 360e6,
    }
}

fn base_model(length: f64) -> Structure {
    let mut s = Structure::default();
    s.sections.insert(
        "S".to_owned(),
        section(2.848e-3, 1.943e-5, 1.424e-6, 6.846e-8),
    );
    s.materials.insert("M".to_owned(), material());
    s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
    s.nodes.push(Node::new(2, length, 0.0, 0.0));
    s.beams.push(Beam::frame(1, 1, 2, "S", "M"));
    s
}

/// Simply supported beam, point load P at midspan: delta = P L^3 / 48 E I.
#[test]
fn simply_supported_point_load_midspan() {
    let l = 4.0;
    let p = -10_000.0;
    let mut s = base_model(l);
    s.supports.push(Support {
        node_id: 1,
        locked_dofs: [true, true, true, true, false, false],
        spring_stiffness: [0.0; 6],
    });
    s.supports.push(Support {
        node_id: 2,
        locked_dofs: [false, true, true, false, false, false],
        spring_stiffness: [0.0; 6],
    });
    s.loads.push(Load {
        case: LoadCase::Variable,
        kind: LoadKind::PointOnSpan {
            beam_id: 1,
            position_ratio: 0.5,
            forces: GlobalForces::vertical(p),
        },
    });
    let solved = rdm_solver::solve_model(&s).unwrap();
    let delta = midspan_deflection_metric(&s, &solved, 0, &[(LoadCase::Variable, 1.0)]).unwrap();
    let expected = p.abs() * l.powi(3) / (48.0 * 210e9 * 1.943e-5);
    assert_relative_eq!(delta, expected, epsilon = 1e-12);
}

/// Simply supported beam, uniform load q: delta = 5 q L^4 / 384 E I.
#[test]
fn simply_supported_uniform_load_midspan() {
    let l = 6.0;
    let q = -5_000.0;
    let mut s = base_model(l);
    s.self_weight_enabled = false;
    s.supports.push(Support {
        node_id: 1,
        locked_dofs: [true, true, true, true, false, false],
        spring_stiffness: [0.0; 6],
    });
    s.supports.push(Support {
        node_id: 2,
        locked_dofs: [false, true, true, false, false, false],
        spring_stiffness: [0.0; 6],
    });
    s.loads.push(Load {
        case: LoadCase::Variable,
        kind: LoadKind::Trapezoid {
            beam_id: 1,
            q_start: q,
            q_end: q,
            direction: Direction::gravity(),
        },
    });
    let solved = rdm_solver::solve_model(&s).unwrap();
    let delta = midspan_deflection_metric(&s, &solved, 0, &[(LoadCase::Variable, 1.0)]).unwrap();
    let expected = q.abs() * l.powi(4) / (384.0 * 210e9 * 1.943e-5) * 5.0;
    assert_relative_eq!(delta, expected, epsilon = 1e-12);
}

/// Cantilever with tip load: tip deflection = P L^3 / 3 E I (nodal DOF).
#[test]
fn cantilever_tip_point_load() {
    let l = 2.5;
    let p = -8_000.0;
    let mut s = base_model(l);
    s.self_weight_enabled = false;
    s.supports.push(Support::fixed(1));
    s.loads.push(Load {
        case: LoadCase::Variable,
        kind: LoadKind::Nodal {
            node_id: 2,
            forces: GlobalForces::vertical(p),
        },
    });
    let solved = rdm_solver::solve_model(&s).unwrap();
    let (_, sol) = solved
        .cases
        .iter()
        .find(|(c, _)| *c == LoadCase::Variable)
        .unwrap();
    let uz_tip = sol.displacements[8]; // node2 uz (dof 6 + 2)
    let expected = p.abs() * l.powi(3) / (3.0 * 210e9 * 1.943e-5);
    assert_relative_eq!(uz_tip.abs(), expected, epsilon = 1e-12);
    assert!(uz_tip < 0.0, "tip must deflect downward");
}

/// Cantilever with uniform load: tip deflection = q L^4 / 8 E I.
#[test]
fn cantilever_uniform_load() {
    let l = 2.0;
    let q = -3_000.0;
    let mut s = base_model(l);
    s.self_weight_enabled = false;
    s.supports.push(Support::fixed(1));
    s.loads.push(Load {
        case: LoadCase::Variable,
        kind: LoadKind::Trapezoid {
            beam_id: 1,
            q_start: q,
            q_end: q,
            direction: Direction::gravity(),
        },
    });
    let solved = rdm_solver::solve_model(&s).unwrap();
    let (_, sol) = solved
        .cases
        .iter()
        .find(|(c, _)| *c == LoadCase::Variable)
        .unwrap();
    let uz_tip = sol.displacements[8];
    let expected = q.abs() * l.powi(4) / (8.0 * 210e9 * 1.943e-5);
    assert_relative_eq!(uz_tip.abs(), expected, epsilon = 1e-12);
}

/// Axial member: u = P L / (E A).
#[test]
fn axial_bar_elongation() {
    let l = 3.0;
    let p = 50_000.0; // tension
    let mut s = base_model(l);
    s.self_weight_enabled = false;
    s.supports.push(Support::fixed(1));
    s.supports.push(Support {
        node_id: 2,
        locked_dofs: [false, true, true, true, true, true],
        spring_stiffness: [0.0; 6],
    });
    s.loads.push(Load {
        case: LoadCase::Variable,
        kind: LoadKind::Nodal {
            node_id: 2,
            forces: GlobalForces {
                fx: p,
                ..GlobalForces::zero()
            },
        },
    });
    let solved = rdm_solver::solve_model(&s).unwrap();
    let (_, sol) = solved
        .cases
        .iter()
        .find(|(c, _)| *c == LoadCase::Variable)
        .unwrap();
    let ux_tip = sol.displacements[6];
    let expected = p * l / (210e9 * 2.848e-3);
    assert_relative_eq!(ux_tip, expected, epsilon = 1e-12);
}

/// Euler critical force of an IPE 200 column, L = 3 m, strong axis.
#[test]
fn euler_buckling_critical_force() {
    let props = section(2.848e-3, 1.943e-5, 1.424e-6, 6.846e-8);
    let n_cr = rdm_eurocode::euler_critical_force(210e9, props.iy, 3.0);
    let expected = std::f64::consts::PI.powi(2) * 210e9 * props.iy / 9.0;
    assert_relative_eq!(n_cr, expected, epsilon = 1e-12);
    // chi for curve a at lambda = 1 (hand-computed from EN 6.3.1.2).
    let chi = rdm_eurocode::flexural_buckling_chi(rdm_eurocode::BucklingCurve::A, 1.0);
    let phi: f64 = 0.5 * (1.0 + 0.21 * 0.8 + 1.0);
    let expected_chi = 1.0 / (phi + (phi * phi - 1.0).sqrt());
    assert_relative_eq!(chi, expected_chi.min(1.0), epsilon = 1e-12);
}
