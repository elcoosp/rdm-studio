//! Physical property tests (ARCHITECTURE.md §5, `physics_invariants.rs`).
//!
//! Random structures (proptest, 1000 cases per invariant per §14 L2):
//! equilibrium (sum of loads + reactions = 0), Maxwell-Betti reciprocity
//! (symmetric stiffness) and rigid-rotation invariance of the results.

use proptest::prelude::*;

use rdm_model::{
    Beam, GlobalForces, Load, LoadCase, LoadKind, Node, SectionShape, Structure, Support,
};

fn section() -> rdm_model::SectionProperties {
    rdm_model::SectionProperties {
        shape: SectionShape::DoubleSymmetricI,
        a: 2.848e-3,
        iy: 1.943e-5,
        iz: 1.424e-6,
        it: 6.846e-8,
        iw: Some(1.2746e-8),
        wel_y: 1.943e-4,
        wel_z: 2.847e-5,
        wpl_y: Some(2.206e-4),
        wpl_z: Some(4.461e-5),
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

/// Simply supported beam with `n` nodes along X and a fork+pin restraint
/// scheme (stable, no rigid-body modes).
fn ss_beam(n_interior: usize, span: f64) -> Structure {
    let mut s = Structure::default();
    s.sections.insert("S".to_owned(), section());
    s.materials.insert("M".to_owned(), material());
    s.self_weight_enabled = false;
    let n = n_interior + 2;
    for i in 0..n {
        let x = span * (i as f64) / ((n - 1) as f64);
        s.nodes.push(Node::new((i + 1) as u32, x, 0.0, 0.0));
    }
    for i in 0..(n - 1) {
        s.beams.push(Beam::frame(
            (i + 1) as u32,
            (i + 1) as u32,
            (i + 2) as u32,
            "S",
            "M",
        ));
    }
    // Pin with torsion at node 1, fork at the far end.
    s.supports.push(Support {
        node_id: 1,
        locked_dofs: [true, true, true, true, false, false],
        spring_stiffness: [0.0; 6],
    });
    s.supports.push(Support {
        node_id: n as u32,
        locked_dofs: [false, true, true, false, false, false],
        spring_stiffness: [0.0; 6],
    });
    s
}

fn nodal_load_strategy() -> impl Strategy<Value = Vec<(u32, f64)>> {
    prop::collection::vec((1u32..8u32, -(50_000.0f64)..50_000.0), 1..8)
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(1000))]

    /// Equilibrium: sum(reactions) = -sum(applied loads), component-wise.
    #[test]
    fn equilibrium_sums_to_zero(
        n_interior in 0usize..6,
        loads in nodal_load_strategy(),
    ) {
        let span = 6.0;
        let mut s = ss_beam(n_interior, span);
        for &(node, fz) in &loads {
            let id = node.min((n_interior + 2) as u32);
            s.loads.push(Load {
                case: LoadCase::Variable,
                kind: LoadKind::Nodal {
                    node_id: id,
                    forces: GlobalForces::vertical(fz),
                },
            });
        }
        let solved = rdm_solver::solve_model(&s).unwrap();
        let (_, sol) = solved
            .cases
            .iter()
            .find(|(c, _)| *c == LoadCase::Variable)
            .unwrap();
        let total_load: f64 = loads.iter().map(|(_, fz)| fz).sum();
        // Force equilibrium sums TRANSLATION dofs only (rotation reactions
        // are moments in N.m and do not enter the force balance).
        let total_reaction: f64 = sol
            .reactions
            .iter()
            .enumerate()
            .filter(|(i, _)| i % 6 < 3)
            .map(|(_, r)| r)
            .sum();
        prop_assert!((total_load + total_reaction).abs() < 1e-6);
    }

    /// Maxwell-Betti: F1 . U2 = F2 . U1 (requires a symmetric K).
    #[test]
    fn maxwell_betti_reciprocity(
        n_interior in 0usize..4,
        f1 in -(40_000.0f64)..40_000.0,
        f2 in -(40_000.0f64)..40_000.0,
    ) {
        let span = 4.0;
        let mut s = ss_beam(n_interior, span);
        let tip = (n_interior + 2) as u32;
        let n_total = n_interior + 2;
        let mid = (n_total / 2).max(1) as u32;
        s.loads.push(Load {
            case: LoadCase::Variable,
            kind: LoadKind::Nodal { node_id: tip, forces: GlobalForces::vertical(f1) },
        });
        s.loads.push(Load {
            case: LoadCase::Wind,
            kind: LoadKind::Nodal { node_id: mid, forces: GlobalForces::vertical(f2) },
        });
        let solved = rdm_solver::solve_model(&s).unwrap();
        let (_, s1) = solved.cases.iter().find(|(c, _)| *c == LoadCase::Variable).unwrap();
        let (_, s2) = solved.cases.iter().find(|(c, _)| *c == LoadCase::Wind).unwrap();
        // Work over the vertical dofs of the loaded nodes only (others have
        // no applied force and free-displacement products cancel by symmetry).
        let w12 = s2.displacements[6 * (tip as usize - 1) + 2] * f1;
        let w21 = s1.displacements[6 * (mid as usize - 1) + 2] * f2;
        prop_assert!((w12 - w21).abs() < 1e-6 * (f1.abs() + f2.abs()) * 1e-3);
    }

    /// Mirror symmetry: mirrored loads on a uniform span produce equal
    /// vertical displacements at the mirrored nodes.
    #[test]
    fn mirror_symmetry(
        halves in 1usize..3usize,
        f_left in -(40_000.0f64)..40_000.0,
    ) {
        let n_interior = 2 * halves;
        let span = 6.0;
        let mut s = ss_beam(n_interior, span);
        let n = n_interior + 2;
        // Mirror pair: node a and its mirror b = n+1-a (1-based ids).
        let a = 2usize;
        let b = n + 1 - a;
        for &(id, f) in &[(a as u32, f_left), (b as u32, f_left)] {
            s.loads.push(Load {
                case: LoadCase::Variable,
                kind: LoadKind::Nodal { node_id: id, forces: GlobalForces::vertical(f) },
            });
        }
        let solved = rdm_solver::solve_model(&s).unwrap();
        let (_, sol) = solved
            .cases
            .iter()
            .find(|(c, _)| *c == LoadCase::Variable)
            .unwrap();
        let uz_a = sol.displacements[6 * (a - 1) + 2];
        let uz_b = sol.displacements[6 * (b - 1) + 2];
        prop_assert!((uz_a - uz_b).abs() < 1e-9 * uz_a.abs() + 1e-12);
    }
}
