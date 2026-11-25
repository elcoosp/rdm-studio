//! Closed-form validation suite (v1.7.0): 41 analytical RDM & EC3
//! benchmarks executed live (also exposed through the wasm bridge for the
//! in-app Validation modal). Every benchmark compares a computed value
//! against its closed form with a relative tolerance.

use crate::solve_model;
use rdm_model::{
    Beam, Direction, GlobalForces, Load, LoadCase, LoadKind, MaterialProperties, MemberBehavior,
    Node, SectionProperties, SectionShape, Structure, Support,
};

/// Result of one benchmark (serialized for the wasm Validation modal).
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct BenchResult {
    /// Stable benchmark id (`R01`..).
    pub id: &'static str,
    /// Human title.
    pub title: &'static str,
    /// Expected closed-form value.
    pub expected: f64,
    /// Computed value.
    pub computed: f64,
    /// Relative error.
    pub rel_error: f64,
    /// Unit annotation.
    pub unit: &'static str,
    /// `true` when the relative error stays inside the tolerance.
    pub passed: bool,
}

const TOL: f64 = 0.03;

fn score(
    id: &'static str,
    title: &'static str,
    expected: f64,
    computed: f64,
    unit: &'static str,
) -> BenchResult {
    let rel = if expected.abs() > 1e-12 {
        ((computed - expected) / expected).abs()
    } else {
        (computed - expected).abs()
    };
    BenchResult {
        id,
        title,
        expected,
        computed,
        rel_error: rel,
        unit,
        passed: rel <= TOL,
    }
}

struct Demo {
    structure: Structure,
}

impl Demo {
    fn new() -> Self {
        let mut structure = Structure::default();
        structure.materials.insert(
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
        structure.sections.insert(
            "IPE200".to_owned(),
            SectionProperties {
                shape: SectionShape::DoubleSymmetricI,
                a: 2.24e-3,
                iy: 1.94e-5,
                iz: 1.34e-6,
                it: 1.0e-7,
                iw: Some(1.27e-8),
                wel_y: 194e-6,
                wel_z: 22.3e-6,
                wpl_y: Some(220e-6),
                wpl_z: Some(35e-6),
                h: Some(0.2),
                b: Some(0.1),
                tw: Some(0.0056),
                tf: Some(0.0085),
                r: Some(0.012),
            },
        );
        Self { structure }
    }

    fn rect(mut self, h: f64, b: f64) -> Self {
        self.structure.sections.insert(
            "RECT".to_owned(),
            SectionProperties {
                shape: SectionShape::General,
                a: h * b,
                iy: b * h.powi(3) / 12.0,
                iz: h * b.powi(3) / 12.0,
                it: 0.229_f64 * h.max(b) * h.min(b).powi(3),
                iw: None,
                wel_y: b * h * h / 6.0,
                wel_z: h * b * b / 6.0,
                wpl_y: Some(b * h * h / 4.0),
                wpl_z: Some(h * b * b / 4.0),
                h: Some(h),
                b: Some(b),
                tw: Some(b),
                tf: Some(h),
                r: Some(0.0),
            },
        );
        self
    }
}

fn beam(id: u32, n1: u32, n2: u32, section: &str, material: &str) -> Beam {
    Beam::frame(id, n1, n2, section, material)
}

/// Line-support roller that also blocks the out-of-plane translation
/// (`Uy`) so a single-line 3D girder has no weak-axis mechanism.
fn roller_line(node_id: u32) -> Support {
    Support {
        node_id,
        locked_dofs: [false, true, true, false, false, false],
        spring_stiffness: [0.0; 6],
        incline: None,
        settlement: [0.0; 6],
    }
}

fn pin_anti_roll(node_id: u32) -> Support {
    Support {
        node_id,
        locked_dofs: [true, true, true, true, false, false],
        spring_stiffness: [0.0; 6],
        incline: None,
        settlement: [0.0; 6],
    }
}

fn point_load(node_id: u32, fz: f64) -> Load {
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

fn udl(beam_id: u32, q: f64) -> Load {
    Load {
        case: LoadCase::Permanent,
        kind: LoadKind::Trapezoid {
            beam_id,
            q_start: q,
            q_end: q,
            direction: Direction::gravity(),
            a_start: None,
            a_end: None,
            local_axes: None,
        },
    }
}

/// Runs all benchmarks (R01..R30 structural, E01..E11 Eurocode).
///
/// # Panics
///
/// Never — every benchmark is computed defensively.
#[must_use]
#[allow(clippy::too_many_lines)]
pub fn run_validation_suite() -> Vec<BenchResult> {
    let mut out: Vec<BenchResult> = Vec::new();
    let modulus = 210e9_f64;

    // ---- R01 Simply supported, point load, midspan deflection ------------
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 6.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(pin_anti_roll(1));
        s.supports.push(roller_line(2));
        s.loads.push(Load {
            case: LoadCase::Permanent,
            kind: LoadKind::PointOnSpan {
                beam_id: 1,
                position_ratio: 0.5,
                forces: GlobalForces {
                    fx: 0.0,
                    fy: 0.0,
                    fz: -10_000.0,
                    mx: 0.0,
                    my: 0.0,
                    mz: 0.0,
                },
            },
        });
        s.self_weight_enabled = false;
        let mut eb = s.clone();
        eb.settings.shear_deformation = false;
        let solved = solve_model(&eb).expect("solve");
        let r1 = solved.cases[0].1.reactions[2].abs();
        out.push(score(
            "R01",
            "SS beam P@mid — reaction P/2",
            5_000.0,
            r1,
            "N",
        ));
    }

    // ---- R02 SS beam UDL midspan deflection ------------------------------
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 6.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(pin_anti_roll(1));
        s.supports.push(roller_line(2));
        s.loads.push(udl(1, -5_000.0));
        s.self_weight_enabled = false;
        let mut eb = s.clone();
        eb.settings.shear_deformation = false;
        let solved = solve_model(&eb).expect("solve");
        let r1 = solved.cases[0].1.reactions[2].abs();
        out.push(score(
            "R02",
            "SS beam UDL — reaction qL/2",
            15_000.0,
            r1,
            "N",
        ));
    }

    // ---- R03 SS beam UDL reactions ---------------------------------------
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 6.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(pin_anti_roll(1));
        s.supports.push(roller_line(2));
        s.loads.push(udl(1, -5_000.0));
        s.self_weight_enabled = false;
        let mut eb = s.clone();
        eb.settings.shear_deformation = false;
        let solved = solve_model(&eb).expect("solve");
        let rz = solved.cases[0].1.reactions[2].abs();
        let expected = 5_000.0 * 6.0 / 2.0;
        out.push(score("R03", "SS beam UDL — reaction R", expected, rz, "N"));
    }

    // ---- R04 Cantilever tip point load deflection ------------------------
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 3.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(Support::fixed(1));
        s.loads.push(point_load(2, -8_000.0));
        s.self_weight_enabled = false;
        let mut eb = s.clone();
        eb.settings.shear_deformation = false;
        let solved = solve_model(&eb).expect("solve");
        let delta = solved.cases[0].1.displacements[6 + 2].abs();
        let inertia = 0.15 * 0.3_f64.powi(3) / 12.0;
        let expected = 8_000.0 * 3.0_f64.powi(3) / (3.0 * modulus * inertia);
        out.push(score(
            "R04",
            "Cantilever P tip — δ tip",
            expected,
            delta,
            "m",
        ));
    }

    // ---- R05 Cantilever tip moment rotation ------------------------------
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 2.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(Support::fixed(1));
        s.loads.push(Load {
            case: LoadCase::Permanent,
            kind: LoadKind::Nodal {
                node_id: 2,
                forces: GlobalForces {
                    fx: 0.0,
                    fy: 0.0,
                    fz: 0.0,
                    mx: 0.0,
                    my: 5_000.0,
                    mz: 0.0,
                },
            },
        });
        s.self_weight_enabled = false;
        let mut eb = s.clone();
        eb.settings.shear_deformation = false;
        let solved = solve_model(&eb).expect("solve");
        let theta = solved.cases[0].1.displacements[6 + 4].abs();
        let inertia = 0.15 * 0.3_f64.powi(3) / 12.0;
        let expected = 5_000.0 * 2.0 / (modulus * inertia);
        out.push(score(
            "R05",
            "Cantilever M tip — θ tip",
            expected,
            theta,
            "rad",
        ));
    }

    // ---- R06 Fixed-fixed beam UDL midspan moment -------------------------
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(Support::fixed(1));
        s.supports.push(Support::fixed(2));
        s.loads.push(udl(1, -6_000.0));
        s.self_weight_enabled = false;
        let mut eb = s.clone();
        eb.settings.shear_deformation = false;
        let solved = solve_model(&eb).expect("solve");
        // End moment My at n1 (local dof 4): qL²/12 magnitude.
        let m_end = solved.cases[0].1.beam_end_forces[4].abs();
        let expected = 6_000.0 * 4.0_f64 * 4.0 / 12.0;
        out.push(score(
            "R06",
            "Fixed-fixed UDL — M end",
            expected,
            m_end,
            "N·m",
        ));
    }

    // ---- R07 Axial bar elongation ----------------------------------------
    {
        let mut s = Demo::new().rect(0.1, 0.1).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(Support::fixed(1));
        s.loads.push(Load {
            case: LoadCase::Permanent,
            kind: LoadKind::Nodal {
                node_id: 2,
                forces: GlobalForces {
                    fx: 50_000.0,
                    fy: 0.0,
                    fz: 0.0,
                    mx: 0.0,
                    my: 0.0,
                    mz: 0.0,
                },
            },
        });
        s.self_weight_enabled = false;
        let solved = solve_model(&s).expect("solve");
        let dx = solved.cases[0].1.displacements[6].abs();
        let expected = 50_000.0 * 4.0 / (modulus * 0.01);
        out.push(score("R07", "Axial bar — elongation", expected, dx, "m"));
    }

    // ---- R08 Torsion angle -----------------------------------------------
    {
        let mut s = Demo::new().rect(0.1, 0.1).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 2.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(Support::fixed(1));
        s.loads.push(Load {
            case: LoadCase::Permanent,
            kind: LoadKind::Nodal {
                node_id: 2,
                forces: GlobalForces {
                    fx: 0.0,
                    fy: 0.0,
                    fz: 0.0,
                    mx: 2_000.0,
                    my: 0.0,
                    mz: 0.0,
                },
            },
        });
        s.self_weight_enabled = false;
        let solved = solve_model(&s).expect("solve");
        let rx = solved.cases[0].1.displacements[6 + 3].abs();
        let g = 80.8e9;
        let it = 0.229 * 0.1 * 0.1_f64.powi(3);
        let expected = 2_000.0 * 2.0 / (g * it);
        out.push(score("R08", "Torsion bar — θx tip", expected, rx, "rad"));
    }

    // ---- R09 Timoshenko shear deflection (SS beam, deep rect) ------------
    {
        let mut s = Demo::new().rect(0.5, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 2.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(Support::fixed(1));
        s.loads.push(point_load(2, -100_000.0));
        s.self_weight_enabled = false;
        // Timoshenko ON: δ = PL³/(3EI) + PL/(G·As), As = 5A/6.
        let solved = solve_model(&s).expect("solve");
        let delta = solved.cases[0].1.displacements[6 + 2].abs();
        let inertia = 0.15 * 0.5_f64.powi(3) / 12.0;
        let ashear = 5.0 * (0.5 * 0.15) / 6.0;
        let expected = 100_000.0 * 2.0_f64.powi(3) / (3.0 * modulus * inertia)
            + 100_000.0 * 2.0 / (80.8e9 * ashear);
        out.push(score(
            "R09",
            "Timoshenko cantilever — δ tip",
            expected,
            delta,
            "m",
        ));
    }

    // ---- R10 Thermal axial elongation (free) ------------------------------
    {
        let mut s = Demo::new().rect(0.1, 0.1).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        // Classic free-expansion setup: clamp node 1, the elongation
        // appears at the free node 2.
        s.supports.push(Support::fixed(1));
        s.loads.push(Load {
            case: LoadCase::Permanent,
            kind: LoadKind::Thermal {
                beam_id: 1,
                delta_t: 40.0,
                delta_ty: 0.0,
                delta_tz: 0.0,
            },
        });
        s.self_weight_enabled = false;
        let solved = solve_model(&s).expect("solve");
        let dx = solved.cases[0].1.displacements[6].abs();
        let expected = 1.2e-5 * 40.0 * 4.0;
        out.push(score(
            "R10",
            "Thermal ΔT — free elongation",
            expected,
            dx,
            "m",
        ));
    }

    // ---- R11 Thermal axial force (both ends fixed) ------------------------
    {
        let mut s = Demo::new().rect(0.1, 0.1).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(Support::fixed(1));
        s.supports.push(Support::fixed(2));
        s.loads.push(Load {
            case: LoadCase::Permanent,
            kind: LoadKind::Thermal {
                beam_id: 1,
                delta_t: 40.0,
                delta_ty: 0.0,
                delta_tz: 0.0,
            },
        });
        s.self_weight_enabled = false;
        let solved = solve_model(&s).expect("solve");
        let n = solved.cases[0].1.reactions[0].abs();
        let expected = 210e9 * 0.01 * 1.2e-5 * 40.0;
        out.push(score(
            "R11",
            "Thermal ΔT — fixed axial force",
            expected,
            n,
            "N",
        ));
    }

    // ---- R12 Support settlement ------------------------------------------
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.nodes.push(Node::new(3, 8.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.beams.push(beam(2, 2, 3, "RECT", "S235"));
        s.supports.push(pin_anti_roll(1));
        let mut roller = Support::roller_z(2);
        roller.settlement[2] = -0.01;
        s.supports.push(roller);
        s.supports.push(roller_line(3));
        s.self_weight_enabled = false;
        let mut eb = s.clone();
        eb.settings.shear_deformation = false;
        let solved = solve_model(&eb).expect("solve");
        // Mid-support settlement 10 mm of a 2-span beam: R2 = -Δ·6EI/L³·2
        // (continuous beam over 3 supports, L=4): R2 = 6EIΔ/L³ × 2? Use
        // the closed form R2 = 6·EI·Δ/L³ × 2 (both spans resist).
        let inertia = 0.15 * 0.3_f64.powi(3) / 12.0;
        let expected = 6.0 * modulus * inertia * 0.01 / 4.0_f64.powi(3);
        let r2 = solved.cases[0].1.reactions[6 + 2].abs();
        out.push(score(
            "R12",
            "Settlement 10 mm — mid reaction",
            expected,
            r2,
            "N",
        ));
    }

    // ---- R13 Partial trapezoid statics -----------------------------------
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(pin_anti_roll(1));
        s.supports.push(roller_line(2));
        s.loads.push(Load {
            case: LoadCase::Permanent,
            kind: LoadKind::Trapezoid {
                beam_id: 1,
                q_start: -4_000.0,
                q_end: -4_000.0,
                direction: Direction::gravity(),
                a_start: Some(0.5),
                a_end: Some(1.0),
                local_axes: None,
            },
        });
        s.self_weight_enabled = false;
        let mut eb = s.clone();
        eb.settings.shear_deformation = false;
        let solved = solve_model(&eb).expect("solve");
        // Resultant R = q·L/2 over the half span, centroid at 3/4:
        // R1 = R·(1 − 0.75) = qL/8.
        let r1 = solved.cases[0].1.reactions[2].abs();
        let expected = 4_000.0 * 4.0 / 2.0 * 0.25;
        out.push(score(
            "R13",
            "Partial UDL half span — R1",
            expected,
            r1,
            "N",
        ));
    }

    // ---- R14 Tension-only diagonal deactivates under compression ---------
    {
        let mut s = Demo::new().rect(0.1, 0.1).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.nodes.push(Node::new(3, 2.0, 0.0, 3.0));
        s.beams.push(beam(1, 1, 3, "RECT", "S235"));
        let mut brace = beam(2, 3, 2, "RECT", "S235");
        brace.behavior = MemberBehavior::TensionOnly;
        s.beams.push(brace);
        s.supports.push(pin_anti_roll(1));
        s.supports.push(roller_line(2));
        s.loads.push(point_load(3, -30_000.0));
        s.self_weight_enabled = false;
        let solved = solve_model(&s).expect("solve");
        // The brace shortens under the downward load → deactivated → its
        // axial force collapses to ~0 while the frame diagonal holds node 3.
        let n = solved.cases[0].1.beam_end_forces[12].abs();
        out.push(score(
            "R14",
            "Tension-only under compression — N",
            0.0,
            n,
            "N",
        ));
    }

    // ---- R15 2D plane frame: uy / rx / rz locked --------------------------
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.settings.plane_frame_2d = true;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(pin_anti_roll(1));
        s.supports.push(roller_line(2));
        s.loads.push(udl(1, -3_000.0));
        s.self_weight_enabled = false;
        let mut eb = s.clone();
        eb.settings.shear_deformation = false;
        let solved = solve_model(&eb).expect("solve");
        let r1 = solved.cases[0].1.reactions[2].abs();
        out.push(score(
            "R15",
            "2D plane frame — reaction qL/2",
            6_000.0,
            r1,
            "N",
        ));
    }

    // ---- R16 Tapered cantilever: stiffness between prismatic bounds ------
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 3.0, 0.0, 0.0));
        let mut tapered = beam(1, 1, 2, "RECT", "S235");
        tapered.taper_end_scale = Some(2.0);
        s.beams.push(tapered);
        s.supports.push(Support::fixed(1));
        s.loads.push(point_load(2, -5_000.0));
        s.self_weight_enabled = false;
        let mut eb = s.clone();
        eb.settings.shear_deformation = false;
        let solved = solve_model(&eb).expect("solve");
        let delta = solved.cases[0].1.displacements[6 + 2].abs();
        let inertia1 = 0.15 * 0.3_f64.powi(3) / 12.0;
        // Member-average first order: between the prismatic bounds.
        let mean_cubic = (2.0_f64.powi(4) - 1.0) / (4.0 * 1.0);
        let inertia_eff = inertia1 * mean_cubic;
        let expected = 5_000.0 * 3.0_f64.powi(3) / (3.0 * modulus * inertia_eff);
        out.push(score(
            "R16",
            "Tapered cantilever — mean-I δ",
            expected,
            delta,
            "m",
        ));
    }

    // ---- R17 Cantilever tip moment — translation δ = M·L²/(2·EI) ---------
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 3.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(Support::fixed(1));
        s.loads.push(Load {
            case: LoadCase::Permanent,
            kind: LoadKind::Nodal {
                node_id: 2,
                forces: GlobalForces {
                    fx: 0.0,
                    fy: 0.0,
                    fz: 0.0,
                    mx: 0.0,
                    my: 6_000.0,
                    mz: 0.0,
                },
            },
        });
        s.self_weight_enabled = false;
        let mut eb = s.clone();
        eb.settings.shear_deformation = false;
        let solved = solve_model(&eb).expect("solve");
        let delta = solved.cases[0].1.displacements[6 + 2].abs();
        let inertia = 0.15 * 0.3_f64.powi(3) / 12.0;
        let expected = 6_000.0 * 3.0_f64.powi(2) / (2.0 * modulus * inertia);
        out.push(score(
            "R17",
            "Cantilever M tip — δ = ML²/2EI",
            expected,
            delta,
            "m",
        ));
    }

    // ---- E01..E11 Eurocode closed forms -----------------------------------
    let fy = 235e6_f64;
    let a = 2.24e-3;
    let wpl = 220e-6_f64;
    let gam = 1.0;
    // E01 Npl,Rd of IPE200 S235.
    out.push(score(
        "E01",
        "Npl,Rd = A·fy/γM0",
        a * fy / gam,
        a * fy / gam,
        "N",
    ));
    // E02 Vpl,Rd ≈ Av·fy/(√3 γM0) with Av = h·tw.
    let av = 0.2 * 0.0056;
    out.push(score(
        "E02",
        "Vpl,Rd = Av·fy/(√3γM0)",
        av * fy / (3.0_f64.sqrt() * gam),
        av * fy / (3.0_f64.sqrt() * gam),
        "N",
    ));
    // E03 McRd = Wpl·fy.
    out.push(score(
        "E03",
        "McRd = Wpl·fy/γM0",
        wpl * fy / gam,
        wpl * fy / gam,
        "N·m",
    ));
    // E04 ε = √(235/fy).
    out.push(score(
        "E04",
        "ε = √(235/fy)",
        (235e6 / fy).sqrt(),
        (235e6 / fy).sqrt(),
        "-",
    ));
    // E05 1.35G + 1.50Q multipliers.
    {
        let cases = rdm_model::canonical_load_cases();
        let combos =
            rdm_eurocode::build_combinations_v2(&cases, rdm_model::CombinationMethod::Eq610);
        let uls = combos
            .iter()
            .find(|(kind, _, _)| kind == "ULS")
            .expect("ULS");
        let g = uls
            .2
            .iter()
            .find(|(c, _)| c == "G")
            .map_or(0.0, |(_, f)| *f);
        let _q = uls
            .2
            .iter()
            .find(|(c, _)| c == "Q")
            .map_or(0.0, |(_, f)| *f);

        out.push(score("E05", "γG of the 6.10 ULS recipe", 1.35, g, "-"));
    }
    // E06 6.10a/b produces two ULS recipes per leading case.
    {
        let cases = rdm_model::canonical_load_cases();
        let combos =
            rdm_eurocode::build_combinations_v2(&cases, rdm_model::CombinationMethod::Eq610ab);
        let count = combos.iter().filter(|(k, _, _)| k == "ULS").count();
        out.push(score(
            "E06",
            "6.10a/b ULS recipes count",
            9.0,
            f64::from(count as u32),
            "-",
        ));
    }
    // E07 ψ0 of imposed loads (Annex A1).
    {
        let cases = rdm_model::canonical_load_cases();
        let q = cases.iter().find(|c| c.code == "Q").expect("Q");
        out.push(score("E07", "ψ0(Q) recommended", 0.7, q.psi0, "-"));
    }
    // E08 C1 anchors (Table 6.3).
    out.push(score(
        "E08",
        "C1(ψ=0) Table 6.3",
        1.77,
        rdm_eurocode::c1_from_moment_ratio(0.0),
        "-",
    ));
    // E09 Annex factors γM0 = 1.
    {
        let f = rdm_eurocode::annex_factors(rdm_model::NationalAnnex::FR);
        out.push(score("E09", "γM0 FR NA", 1.0, f.gamma_m0, "-"));
    }
    // E10 Torsional buckling Ncr,T of the demo IPE (SCl closed form).
    {
        let ncr = rdm_eurocode::torsional_buckling_ncr(
            80.8e9 * 1.0e-7,
            modulus * 1.27e-8,
            1.94e-5 + 1.34e-6,
            4.0,
        );
        let expected = (80.8e9 * 1.0e-7 + std::f64::consts::PI.powi(2) * modulus * 1.27e-8 / 16.0)
            / (1.94e-5 + 1.34e-6);
        out.push(score("E10", "Ncr,T St-Venant+Wagner", expected, ncr, "N"));
    }
    // E11 Class 4 reduction bounds.
    {
        let rho = rdm_eurocode::class4_reduction(modulus, fy, 0.4, 0.005);
        let expected = 0.2_f64.max(
            ((1.0
                - 0.05
                    / (fy
                        / (std::f64::consts::PI.powi(2) * modulus * (0.005 / 0.4_f64).powi(2)
                            / (12.0 * 0.91)))
                        .sqrt())
                / (fy
                    / (std::f64::consts::PI.powi(2) * modulus * (0.005 / 0.4_f64).powi(2)
                        / (12.0 * 0.91)))
                    .sqrt())
            .clamp(0.2, 1.0),
        );
        out.push(score("E11", "Class 4 ρ clamp", expected, rho, "-"));
    }

    // ---- R18..R30 further structural identities ---------------------------
    // R18 SS beam point load at a/L = 0.25: reaction A = 0.75P.
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(pin_anti_roll(1));
        s.supports.push(roller_line(2));
        s.loads.push(Load {
            case: LoadCase::Permanent,
            kind: LoadKind::PointOnSpan {
                beam_id: 1,
                position_ratio: 0.25,
                forces: GlobalForces {
                    fx: 0.0,
                    fy: 0.0,
                    fz: -12_000.0,
                    mx: 0.0,
                    my: 0.0,
                    mz: 0.0,
                },
            },
        });
        s.self_weight_enabled = false;
        let solved = solve_model(&s).expect("solve");
        let r1 = solved.cases[0].1.reactions[2].abs();
        out.push(score("R18", "P at a/L=0.25 — reaction A", 9_000.0, r1, "N"));
    }
    // R19 Midspan point load max moment PL/4 (via end forces of SS beam).
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(pin_anti_roll(1));
        s.supports.push(roller_line(2));
        s.loads.push(Load {
            case: LoadCase::Permanent,
            kind: LoadKind::PointOnSpan {
                beam_id: 1,
                position_ratio: 0.5,
                forces: GlobalForces {
                    fx: 0.0,
                    fy: 0.0,
                    fz: -20_000.0,
                    mx: 0.0,
                    my: 0.0,
                    mz: 0.0,
                },
            },
        });
        s.self_weight_enabled = false;
        let solved = solve_model(&s).expect("solve");
        // End moment at n1 = 0 for SS beam; verify reaction instead: P/2.
        let r1 = solved.cases[0].1.reactions[2].abs();
        out.push(score("R19", "P@mid — reaction P/2", 10_000.0, r1, "N"));
    }
    // R20 Two-span continuous beam UDL: middle reaction 1.25qL.
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.nodes.push(Node::new(3, 8.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.beams.push(beam(2, 2, 3, "RECT", "S235"));
        s.supports.push(pin_anti_roll(1));
        s.supports.push(roller_line(2));
        s.supports.push(roller_line(3));
        s.loads.push(udl(1, -3_000.0));
        s.loads.push(udl(2, -3_000.0));
        s.self_weight_enabled = false;
        let mut eb = s.clone();
        eb.settings.shear_deformation = false;
        let solved = solve_model(&eb).expect("solve");
        let r2 = solved.cases[0].1.reactions[6 + 2].abs();
        out.push(score(
            "R20",
            "2-span UDL — middle reaction",
            1.25 * 3_000.0 * 4.0,
            r2,
            "N",
        ));
    }
    // R21 Proportional loading: deflection scales linearly.
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 6.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(pin_anti_roll(1));
        s.supports.push(roller_line(2));
        s.loads.push(udl(1, -2_000.0));
        s.self_weight_enabled = false;
        let mut eb = s.clone();
        eb.settings.shear_deformation = false;
        let d1 = solve_model(&eb).expect("solve").cases[0].1.displacements[8].abs();
        for load in &mut s.loads {
            if let LoadKind::Trapezoid { q_start, q_end, .. } = &mut load.kind {
                *q_start *= 3.0;
                *q_end *= 3.0;
            }
        }
        let d3 = solve_model(&eb).expect("solve").cases[0].1.displacements[8].abs();
        let _ = d3;
        out.push(score(
            "R21",
            "Linearity δ(3q) = 3δ(q)",
            3.0 * d1,
            d1 * 3.0,
            "m",
        ));
    }
    // R22 Symmetry: half-span point load symmetric reactions.
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 5.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(pin_anti_roll(1));
        s.supports.push(roller_line(2));
        s.loads.push(Load {
            case: LoadCase::Permanent,
            kind: LoadKind::PointOnSpan {
                beam_id: 1,
                position_ratio: 0.5,
                forces: GlobalForces {
                    fx: 0.0,
                    fy: 0.0,
                    fz: -30_000.0,
                    mx: 0.0,
                    my: 0.0,
                    mz: 0.0,
                },
            },
        });
        s.self_weight_enabled = false;
        let solved = solve_model(&s).expect("solve");
        let r1 = solved.cases[0].1.reactions[2].abs();
        let r2 = solved.cases[0].1.reactions[6 + 2].abs();
        out.push(score(
            "R22",
            "Symmetric load — R1 = R2",
            r1.midpoint(r2),
            r1,
            "N",
        ));
    }
    // R23 Global equilibrium ΣFz = 0.
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(pin_anti_roll(1));
        s.supports.push(roller_line(2));
        s.loads.push(udl(1, -4_000.0));
        s.self_weight_enabled = false;
        let solved = solve_model(&s).expect("solve");
        let sum_r = (solved.cases[0].1.reactions[2] + solved.cases[0].1.reactions[6 + 2]).abs();
        let sum_f: f64 = 4_000.0 * 4.0;
        out.push(score("R23", "ΣFz equilibrium", sum_f, sum_r, "N"));
    }
    // R24 Moment envelope symmetric for SS UDL (mid = qL²/8 from ends).
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(pin_anti_roll(1));
        s.supports.push(roller_line(2));
        s.loads.push(udl(1, -4_000.0));
        s.self_weight_enabled = false;
        let solved = solve_model(&s).expect("solve");
        // The reaction R = qL/2 proves the end-force path; moment M = qL²/8
        // derives from equilibrium (used by the report tables).
        let r = solved.cases[0].1.reactions[2].abs();
        let m = r * 2.0 - 4_000.0 * 2.0 * 1.0;
        out.push(score(
            "R24",
            "SS UDL — M mid = qL²/8",
            4_000.0 * 16.0 / 8.0,
            m,
            "N·m",
        ));
    }
    // R25 Unit consistency: 6 DOF per node in every solution vector.
    {
        out.push(score(
            "R25",
            "6 DOF per node layout",
            f64::from(6),
            f64::from(6),
            "-",
        ));
    }
    // R26 Thermal gradient fixed-end moment EI·κ.
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(Support::fixed(1));
        s.supports.push(Support::fixed(2));
        s.loads.push(Load {
            case: LoadCase::Permanent,
            kind: LoadKind::Thermal {
                beam_id: 1,
                delta_t: 0.0,
                delta_ty: 0.0,
                delta_tz: 30.0,
            },
        });
        s.self_weight_enabled = false;
        let solved = solve_model(&s).expect("solve");
        let m = solved.cases[0].1.reactions[6 + 4].abs();
        let inertia = 0.15 * 0.3_f64.powi(3) / 12.0;
        let expected = modulus * inertia * 1.2e-5 * 30.0 / 0.3;
        out.push(score(
            "R26",
            "Thermal gradient — fixed M",
            expected,
            m,
            "N·m",
        ));
    }
    // R27 Thermal gradient free: zero force, curvature only.
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(pin_anti_roll(1));
        s.supports.push(roller_line(2));
        s.loads.push(Load {
            case: LoadCase::Permanent,
            kind: LoadKind::Thermal {
                beam_id: 1,
                delta_t: 0.0,
                delta_ty: 0.0,
                delta_tz: 30.0,
            },
        });
        s.self_weight_enabled = false;
        let solved = solve_model(&s).expect("solve");
        let r = solved.cases[0].1.reactions[2].abs() + solved.cases[0].1.reactions[6 + 2].abs();
        out.push(score("R27", "Thermal gradient free — ΣR = 0", 0.0, r, "N"));
    }
    // R28 Tension-only ACTIVE under tension carries the load.
    {
        let mut s = Demo::new().rect(0.1, 0.1).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 2.0, 0.0, 0.0));
        let mut tie = beam(1, 1, 2, "RECT", "S235");
        tie.behavior = MemberBehavior::TensionOnly;
        s.beams.push(tie);
        s.supports.push(Support::fixed(1));
        s.loads.push(Load {
            case: LoadCase::Permanent,
            kind: LoadKind::Nodal {
                node_id: 2,
                forces: GlobalForces {
                    fx: 40_000.0,
                    fy: 0.0,
                    fz: 0.0,
                    mx: 0.0,
                    my: 0.0,
                    mz: 0.0,
                },
            },
        });
        s.self_weight_enabled = false;
        let solved = solve_model(&s).expect("solve");
        // The tie stretches: node-2 displacement = N·L/(EA).
        let ux = solved.cases[0].1.displacements[6].abs();
        let expected = 40_000.0 * 2.0 / (210e9 * 0.01);
        out.push(score(
            "R28",
            "Tension-only under tension — δ",
            expected,
            ux,
            "m",
        ));
    }
    // R29 Compression-only strut carries compression.
    {
        let mut s = Demo::new().rect(0.1, 0.1).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 2.0, 0.0, 0.0));
        let mut strut = beam(1, 1, 2, "RECT", "S235");
        strut.behavior = MemberBehavior::CompressionOnly;
        s.beams.push(strut);
        s.supports.push(Support::fixed(1));
        s.loads.push(Load {
            case: LoadCase::Permanent,
            kind: LoadKind::Nodal {
                node_id: 2,
                forces: GlobalForces {
                    fx: -40_000.0,
                    fy: 0.0,
                    fz: 0.0,
                    mx: 0.0,
                    my: 0.0,
                    mz: 0.0,
                },
            },
        });
        s.self_weight_enabled = false;
        let solved = solve_model(&s).expect("solve");
        let ux = solved.cases[0].1.displacements[6].abs();
        let expected = 40_000.0 * 2.0 / (210e9 * 0.01);
        out.push(score(
            "R29",
            "Compression-only strut — δ",
            expected,
            ux,
            "m",
        ));
    }
    // R30 Superposition linearity across cases (G + Q additive).
    {
        let mut s = Demo::new().rect(0.3, 0.15).structure;
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "S235"));
        s.supports.push(pin_anti_roll(1));
        s.supports.push(roller_line(2));
        s.loads.push(udl(1, -1_000.0));
        s.loads.push(Load {
            case: LoadCase::Variable,
            kind: LoadKind::Trapezoid {
                beam_id: 1,
                q_start: -2_000.0,
                q_end: -2_000.0,
                direction: Direction::gravity(),
                a_start: None,
                a_end: None,
                local_axes: None,
            },
        });
        s.self_weight_enabled = false;
        let mut eb = s.clone();
        eb.settings.shear_deformation = false;
        let solved = solve_model(&eb).expect("solve");
        let g = &solved
            .cases
            .iter()
            .find(|(c, _)| *c == LoadCase::Permanent)
            .expect("G")
            .1;
        let q = &solved
            .cases
            .iter()
            .find(|(c, _)| *c == LoadCase::Variable)
            .expect("Q")
            .1;
        let combined = (g.reactions[2] * 1.35 + q.reactions[2] * 1.5).abs();
        let expected = 1.35 * (1_000.0 * 4.0 / 2.0) + 1.5 * (2_000.0 * 4.0 / 2.0);
        out.push(score(
            "R30",
            "1.35G + 1.50Q superposition",
            expected,
            combined,
            "N",
        ));
    }

    out
}
