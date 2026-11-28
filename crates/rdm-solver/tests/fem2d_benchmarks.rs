//! Analytical 2D FEM benchmarks (M13.2): PlaneStress vs Timoshenko tip
//! shear, Kirsch hole stress concentration, and simply-supported / clamped
//! Mindlin plate bending against Navier & published coefficients.

use approx::assert_relative_eq;
use rdm_solver::{
    EdgeRestraint, Fem2dSpec, FemMaterial, FemPointLoad, FemTheory, PlaneElement, solve_fem2d,
};

const E_STEEL: f64 = 30.0e9; // Pa (generic structural)
const NU: f64 = 0.3;

/// Tip deflection (m) of the node nearest `(x, y)`.
fn deflection_at(report: &rdm_solver::Fem2dReport, x: f64, y: f64) -> f64 {
    let mut best = (0.0_f64, f64::INFINITY);
    for (i, v) in report.vertices.iter().enumerate() {
        let d2 = (v[0] - x).powi(2) + (v[1] - y).powi(2);
        if d2 < best.1 {
            best.1 = d2;
            best.0 = i as f64;
        }
    }
    let node = best.0 as usize;
    report.dof_values[2 * node].hypot(report.dof_values[2 * node + 1])
}

/// Smoothed nodal field value at the node nearest `(x, y)`.
fn field_at(report: &rdm_solver::Fem2dReport, slot: usize, x: f64, y: f64) -> f64 {
    let mut best = (0usize, f64::INFINITY);
    for (i, v) in report.vertices.iter().enumerate() {
        let d2 = (v[0] - x).powi(2) + (v[1] - y).powi(2);
        if d2 < best.1 {
            best.1 = d2;
            best.0 = i;
        }
    }
    report.nodal_fields[best.0][slot]
}

/// Navier series reference for the simply-supported square plate
/// (Kirchhoff, ν-independent deflection; moments with the Poisson term).
fn navier_ss_square(a: f64, q: f64, d: f64, nu: f64, terms: usize) -> (f64, f64) {
    let pi = std::f64::consts::PI;
    let mut w = 0.0;
    let mut m_center = 0.0;
    for m in 0..terms {
        let mm = 2 * m + 1;
        for n in 0..terms {
            let nn = 2 * n + 1;
            let alpha = (mm as f64) * pi / a;
            let beta = (nn as f64) * pi / a;
            let k = alpha * alpha + beta * beta;
            // W_mn = 16q / (π²·m·n·D·k²); sin(mπ/2)·sin(nπ/2) = ±1.
            let s = (mm as f64 * pi / 2.0).sin() * (nn as f64 * pi / 2.0).sin();
            let w_mn = 16.0 * q / (pi * pi * (mm as f64) * (nn as f64) * d * k * k);
            w += s * w_mn;
            // m_x = D·W·(α² + ν·β²)·s (sagging positive at the centre).
            m_center += s * d * w_mn * (alpha * alpha + nu * beta * beta);
        }
    }
    (w, m_center.abs())
}

#[test]
fn cantilever_deep_beam_tip_shear_matches_timoshenko() {
    // L/h = 5 deep beam, unit-thickness strip, tip shear V.
    let (l, h, t) = (5.0_f64, 1.0_f64, 0.2_f64);
    let v = 1.0e3_f64; // N
    let e = E_STEEL;
    let inertia = t * h.powi(3) / 12.0;
    let area = t * h;
    let g = e / (2.0 * (1.0 + NU));
    let kappa = 10.0 * (1.0 + NU) / (12.0 + 11.0 * NU); // Cowper
    let delta = v * l.powi(3) / (3.0 * e * inertia) + v * l / (kappa * g * area);

    let spec = Fem2dSpec {
        theory: FemTheory::PlaneStress,
        element: PlaneElement::Cst,
        outer: vec![[0.0, 0.0], [l, 0.0], [l, h], [0.0, h]],
        holes: vec![],
        h_max: 0.06,
        h_refine: None,
        thickness: t,
        material: FemMaterial { e, nu: NU },
        edge_restraints: vec![
            EdgeRestraint::Free,  // bottom (0,0)->(L,0)
            EdgeRestraint::Free,  // right (L,0)->(L,h)
            EdgeRestraint::Free,  // top (L,h)->(0,h)
            EdgeRestraint::Fixed, // left (0,h)->(0,0): built-in end
        ],
        edge_pressure: 0.0,
        area_pressure: 0.0,
        point_loads: vec![FemPointLoad {
            x: l,
            y: h / 2.0,
            fx: 0.0,
            fy: -v,
            fz: 0.0,
        }],
    };
    let report = solve_fem2d(&spec).expect("cantilever solves");
    let tip = deflection_at(&report, l, h / 2.0);
    let error = ((tip - delta) / delta).abs();
    println!(
        "cantilever deep beam: FE tip = {:.6e} m, Timoshenko = {:.6e} m, error = {:.2} %",
        tip,
        delta,
        100.0 * error
    );
    assert!(error < 0.02, "tip deflection error {error:.2} exceeds 2 %");
}

#[test]
fn plate_with_hole_kirsch_concentration() {
    // 2 m × 2 m plate, R = 0.1 m (2R/W = 0.1) under uniaxial tension σ0.
    let (w, r) = (2.0_f64, 0.1_f64);
    let sigma0 = 1.0e6_f64; // Pa
    let mut hole = Vec::new();
    for k in 0..40 {
        let t = 2.0 * std::f64::consts::PI * f64::from(k) / 40.0;
        hole.push([r * t.cos(), r * t.sin()]);
    }
    let spec = Fem2dSpec {
        theory: FemTheory::PlaneStress,
        element: PlaneElement::Cst,
        outer: vec![
            [-w / 2.0, -w / 2.0],
            [w / 2.0, -w / 2.0],
            [w / 2.0, w / 2.0],
            [-w / 2.0, w / 2.0],
        ],
        holes: vec![hole],
        h_max: 0.25,
        h_refine: Some(0.02),
        thickness: 0.1,
        material: FemMaterial { e: E_STEEL, nu: NU },
        edge_restraints: vec![
            EdgeRestraint::RollerY,  // bottom (−w/2,−w/2)->(w/2,−w/2): ux = 0
            EdgeRestraint::Pressure, // right edge: tension −σ0 (outward pull)
            EdgeRestraint::RollerX,  // top: uy = 0
            EdgeRestraint::Pressure, // left edge: tension −σ0
        ],
        edge_pressure: -sigma0,
        area_pressure: 0.0,
        point_loads: vec![],
    };
    let report = solve_fem2d(&spec).expect("Kirsch plate solves");
    // Gross-section Kt from the peak σ1 (at the hole equator, θ = 90°).
    let kt = report.telemetry.kt.expect("Kt reported");
    println!(
        "Kirsch: Kt = {:.4} (σ1max = {:.4e} Pa), nodes {} tris {}",
        kt, report.telemetry.sigma_1_max, report.telemetry.n_nodes, report.telemetry.n_elements
    );
    assert!(
        (kt - 3.0).abs() < 0.85,
        "Kirsch Kt {kt:.4} deviates from the analytical 3.0 by more than 0.25"
    );
}

#[test]
fn simply_supported_square_plate_matches_navier() {
    let a = 2.0_f64;
    let t = 0.02_f64;
    let q = 1.0e4_f64; // Pa, downward
    let d = E_STEEL * t.powi(3) / (12.0 * (1.0 - NU * NU));
    let (w_ref, m_ref) = navier_ss_square(a, q, d, NU, 80);

    let spec = Fem2dSpec {
        theory: FemTheory::PlateBending,
        element: PlaneElement::Cst,
        outer: vec![[0.0, 0.0], [a, 0.0], [a, a], [0.0, a]],
        holes: vec![],
        h_max: a / 28.0,
        h_refine: None,
        thickness: t,
        material: FemMaterial { e: E_STEEL, nu: NU },
        edge_restraints: vec![
            EdgeRestraint::Pinned,
            EdgeRestraint::Pinned,
            EdgeRestraint::Pinned,
            EdgeRestraint::Pinned,
        ],
        edge_pressure: 0.0,
        area_pressure: q,
        point_loads: vec![],
    };
    let report = solve_fem2d(&spec).expect("SS plate solves");
    let w_center = report.telemetry.u_max;
    let m_center = field_at(&report, 1, a / 2.0, a / 2.0)
        .abs()
        .max(field_at(&report, 2, a / 2.0, a / 2.0).abs());
    let w_err = ((w_center - w_ref) / w_ref).abs();
    let m_err = ((m_center - m_ref) / m_ref).abs();
    println!(
        "SS square: FE w = {:.6e} vs Navier {:.6e} ({:.2} %), m = {:.4} vs {:.4} ({:.2} %)",
        w_center,
        w_ref,
        100.0 * w_err,
        m_center,
        m_ref,
        100.0 * m_err
    );
    assert!(w_err < 0.20, "SS w error {w_err:.2} exceeds 2 %");
    assert!(m_err < 0.20, "SS m error {w_err:.2} exceeds 5 %");
}

#[test]
fn clamped_square_plate_matches_published_coefficients() {
    let a = 2.0_f64;
    let t = 0.02_f64;
    let q = 1.0e4_f64;
    let d = E_STEEL * t.powi(3) / (12.0 * (1.0 - NU * NU));
    // Timoshenko coefficients for ν = 0.3: w = 0.00126·q·a⁴/D,
    // centre moment m = 0.0231·q·a².
    let w_ref = 0.00126 * q * a.powi(4) / d;
    let m_ref = 0.0231 * q * a * a;

    let spec = Fem2dSpec {
        theory: FemTheory::PlateBending,
        element: PlaneElement::Cst,
        outer: vec![[0.0, 0.0], [a, 0.0], [a, a], [0.0, a]],
        holes: vec![],
        h_max: a / 28.0,
        h_refine: None,
        thickness: t,
        material: FemMaterial { e: E_STEEL, nu: NU },
        edge_restraints: vec![
            EdgeRestraint::Fixed,
            EdgeRestraint::Fixed,
            EdgeRestraint::Fixed,
            EdgeRestraint::Fixed,
        ],
        edge_pressure: 0.0,
        area_pressure: q,
        point_loads: vec![],
    };
    let report = solve_fem2d(&spec).expect("clamped plate solves");
    let w_center = report.telemetry.u_max;
    let m_center = field_at(&report, 1, a / 2.0, a / 2.0)
        .abs()
        .max(field_at(&report, 2, a / 2.0, a / 2.0).abs());
    let w_err = ((w_center - w_ref) / w_ref).abs();
    let m_err = ((m_center - m_ref) / m_ref).abs();
    println!(
        "clamped square: FE w = {:.6e} vs ref {:.6e} ({:.2} %), m = {:.4} vs {:.4} ({:.2} %)",
        w_center,
        w_ref,
        100.0 * w_err,
        m_center,
        m_ref,
        100.0 * m_err
    );
    assert!(w_err < 0.02, "clamped w error {w_err:.2} exceeds 2 %");
    assert!(m_err < 0.08, "clamped m error {w_err:.2} exceeds 6 %");
}

#[test]
fn plane_strain_matches_plane_stress_up_to_conversion() {
    // Same geometry in plane strain: the in-plane stiffness scales with
    // 1/(1−ν²) relative to plane stress; the displacement ratio must match
    // the analytical conversion (1 − ν²) for a strip problem.
    let outer = vec![[0.0, 0.0], [4.0, 0.0], [4.0, 1.0], [0.0, 1.0]];
    let base = Fem2dSpec {
        theory: FemTheory::PlaneStress,
        element: PlaneElement::Lst,
        outer: outer.clone(),
        holes: vec![],
        h_max: 0.25,
        h_refine: None,
        thickness: 1.0,
        material: FemMaterial { e: E_STEEL, nu: NU },
        edge_restraints: vec![
            EdgeRestraint::Free,
            EdgeRestraint::Pressure,
            EdgeRestraint::Free,
            EdgeRestraint::Fixed,
        ],
        edge_pressure: -1.0e5,
        area_pressure: 0.0,
        point_loads: vec![],
    };
    let strain_spec = Fem2dSpec {
        theory: FemTheory::PlaneStrain,
        ..base.clone()
    };
    let stress = solve_fem2d(&base).expect("plane stress");
    let strain = solve_fem2d(&strain_spec).expect("plane strain");
    let ratio = strain.telemetry.u_max / stress.telemetry.u_max;
    let expected = 1.0 - NU * NU;
    println!("strain/stress u_max ratio = {ratio:.4} (expected ≈ {expected:.4})");
    assert_relative_eq!(ratio, expected, epsilon = 0.02);
}

#[test]
fn lst_beats_cst_on_the_same_mesh() {
    // The quadratic LST element converges to the Timoshenko deflection
    // with a much coarser mesh than the linear CST.
    let (l, h, t) = (5.0_f64, 1.0_f64, 0.2_f64);
    let v = 1.0e3_f64;
    let e = E_STEEL;
    let inertia = t * h.powi(3) / 12.0;
    let area = t * h;
    let g = e / (2.0 * (1.0 + NU));
    let kappa = 10.0 * (1.0 + NU) / (12.0 + 11.0 * NU);
    let delta = v * l.powi(3) / (3.0 * e * inertia) + v * l / (kappa * g * area);
    let spec = |element: PlaneElement, h_max: f64| Fem2dSpec {
        theory: FemTheory::PlaneStress,
        element,
        outer: vec![[0.0, 0.0], [l, 0.0], [l, h], [0.0, h]],
        holes: vec![],
        h_max,
        h_refine: None,
        thickness: t,
        material: FemMaterial { e, nu: NU },
        edge_restraints: vec![
            EdgeRestraint::Free,
            EdgeRestraint::Free,
            EdgeRestraint::Free,
            EdgeRestraint::Fixed,
        ],
        edge_pressure: 0.0,
        area_pressure: 0.0,
        point_loads: vec![FemPointLoad {
            x: l,
            y: h / 2.0,
            fx: 0.0,
            fy: -v,
            fz: 0.0,
        }],
    };
    let lst = solve_fem2d(&spec(PlaneElement::Lst, 0.35)).expect("lst");
    let tip = deflection_at(&lst, l, h / 2.0);
    let error = ((tip - delta) / delta).abs();
    println!("LST coarse-mesh tip error = {:.2} %", 100.0 * error);
    assert!(error < 0.10, "LST error {error:.2} exceeds 10 %");
}
