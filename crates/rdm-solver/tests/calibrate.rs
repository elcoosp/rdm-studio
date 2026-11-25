//! Global regression tests: clamped-clamped UDL reactions and midspan
//! deflection must match the closed-form Euler-Bernoulli values exactly.

use rdm_model::{Beam, Load, LoadCase, LoadKind, Node, Structure, Support};

#[test]
fn clamped_udl_reactions_and_deflection() {
    let mut s = Structure::default();
    s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
    s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
    s.beams.push(Beam::frame(1, 1, 2, "S", "M"));
    s.sections.insert(
        "S".to_owned(),
        rdm_model::SectionProperties {
            shape: rdm_model::SectionShape::DoubleSymmetricI,
            a: 1.0e-3,
            iy: 1.0e-5,
            iz: 1.0e-6,
            it: 1.0e-8,
            iw: None,
            wel_y: 1.0e-4,
            wel_z: 1.0e-5,
            wpl_y: None,
            wpl_z: None,
            h: Some(0.2),
            b: Some(0.1),
            tw: Some(0.006),
            tf: Some(0.008),
            r: Some(0.012),
        },
    );
    s.materials.insert(
        "M".to_owned(),
        rdm_model::MaterialProperties {
            e: 210e9,
            g: 81e9,
            nu: 0.3,
            rho: 1000.0,
            fy: 235e6,
            fu: 360e6,
        },
    );
    s.self_weight_enabled = false;
    // Uniform downward load 1000 N/m over the span.
    s.loads.push(Load {
        case: LoadCase::Variable,
        kind: LoadKind::Trapezoid {
            beam_id: 1,
            q_start: 1000.0,
            q_end: 1000.0,
            direction: rdm_model::Direction::gravity(),
            a_start: None,
            a_end: None,
            local_axes: None,
        },
    });
    s.supports.push(Support::fixed(1));
    s.supports.push(Support::fixed(2));
    let solved = rdm_solver::solve_model(&s).unwrap();
    let (_, sol) = solved
        .cases
        .iter()
        .find(|(c, _)| *c == LoadCase::Variable)
        .unwrap();
    // Shear reactions: |q| L / 2 upward at each end.
    approx::assert_abs_diff_eq!(sol.reactions[2], 2000.0, epsilon = 1e-9);
    approx::assert_abs_diff_eq!(sol.reactions[8], 2000.0, epsilon = 1e-9);
    // Fixed-end moments: |q| L^2 / 12, antisymmetric about +y.
    approx::assert_abs_diff_eq!(sol.reactions[4], -1_333.333_333_333_333_3, epsilon = 1e-9);
    approx::assert_abs_diff_eq!(sol.reactions[10], 1_333.333_333_333_333_3, epsilon = 1e-9);
    let defl = rdm_solver::midspan_deflection_metric(&s, &solved, 0, &[(LoadCase::Variable, 1.0)])
        .unwrap();
    approx::assert_abs_diff_eq!(
        defl,
        1000.0 * 256.0 / (384.0 * 210e9 * 1.0e-5),
        epsilon = 1e-15
    );
}
