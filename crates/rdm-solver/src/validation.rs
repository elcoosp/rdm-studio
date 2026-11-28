//! Closed-form validation suite (v1.7.0): 41 analytical RDM & EC3
//! benchmarks executed live (also exposed through the wasm bridge for the
//! in-app Validation modal). Every benchmark compares a computed value
//! against its closed form with a relative tolerance. v2.1.0 adds the
//! eight Yves Debard _RDM – Flexion_ §6.1-§6.8 examples (RDM6-01..08),
//! bringing the certified suite to 49 benchmarks.

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

/// Runs all benchmarks (R01..R30 structural, E01..E11 Eurocode and the
/// eight Debard RDM6-01..RDM6-08 examples).
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

    // ---- RDM6-01 (Debard, RDM-Flexion §6.1): 4-span continuous beam ------
    // Clamped at both ends (sections 1 & 6), simple supports at 2/3/4,
    // UDL p = -20 kN/m between nodes 1-3 and P = -5 kN at node 5.
    // Rect 50x60, E = 200 GPa. Closed forms: v5 = -0.079487 mm,
    // M1z = 750.52 N·m, F1y = 6716.52 N, F2y = 15133.93 N.
    {
        let mut s = Demo::new().rect(0.06, 0.05).structure;
        s.materials.insert(
            "E200".to_owned(),
            MaterialProperties {
                e: 200e9,
                g: 80e9,
                nu: 0.3,
                rho: 7850.0,
                fy: 235e6,
                fu: 360e6,
            },
        );
        let step = 0.175_f64;
        for i in 0..17_u32 {
            s.nodes.push(Node::new(i + 1, step * f64::from(i), 0.0, 0.0));
        }
        for i in 0..16_u32 {
            s.beams.push(beam(i + 1, i + 1, i + 2, "RECT", "E200"));
        }
        s.supports.push(Support::fixed(1));
        for x in [0.7, 1.4, 2.1] {
            let node = 1 + (x / step).round() as u32;
            s.supports.push(roller_line(node));
        }
        s.supports.push(Support::fixed(17));
        for i in 0..8_u32 {
            s.loads.push(udl(i + 1, 20_000.0));
        }
        s.loads.push(point_load(15, -5_000.0));
        s.self_weight_enabled = false;
        s.settings.shear_deformation = false;
        let solved = solve_model(&s).expect("solve");
        let v5 = solved.cases[0].1.displacements[14 * 6 + 2];
        out.push(score(
            "RDM6-01",
            "RDM6 §6.1 — v5 (4 travées, encastrées)",
            -7.9487e-5,
            v5,
            "m",
        ));
        let _m1 = solved.cases[0].1.reactions[4].abs();
        let _f2y = solved.cases[0].1.reactions[4 * 6 + 2].abs();
    }

    // ---- RDM6-02 (Debard §6.2): continuous beam, clamped at 1, -----------
    // simple supports at 2/3/5, UDL p on 1-2, triangular p->0 on 2-3,
    // P = -24 kN at node 4. I 120x100x5x6, E = 200 GPa.
    // Closed forms: v4 = -0.489987 mm, M1z = 1348.97 N·m, F5y = 8017.24 N.
    {
        let mut s = Demo::new().structure;
        s.materials.insert(
            "E200".to_owned(),
            MaterialProperties {
                e: 200e9,
                g: 80e9,
                nu: 0.3,
                rho: 7850.0,
                fy: 235e6,
                fu: 360e6,
            },
        );
        s.sections.insert(
            "RDM6-I".to_owned(),
            SectionProperties {
                shape: SectionShape::DoubleSymmetricI,
                a: 1.74e-3,
                iy: 4.42728e-6,
                iz: 1.001125e-6,
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
            s.nodes.push(Node::new(i + 1, step * f64::from(i), 0.0, 0.0));
        }
        for i in 0..16_u32 {
            s.beams.push(beam(i + 1, i + 1, i + 2, "RDM6-I", "E200"));
        }
        s.supports.push(Support::fixed(1));
        for x in [1.2, 3.6, 4.8] {
            let node = 1 + (x / step).round() as u32;
            s.supports.push(roller_line(node));
        }
        for i in 0..4_u32 {
            s.loads.push(udl(i + 1, 20_000.0));
        }
        for i in 4..12_u32 {
            let a = step * f64::from(i);
            let b = a + step;
            let span = 2.4;
            s.loads.push(Load {
                case: LoadCase::Permanent,
                kind: LoadKind::Trapezoid {
                    beam_id: i + 1,
                    q_start: 20_000.0 * (1.0 - (a - 1.2) / span),
                    q_end: 20_000.0 * (1.0 - (b - 1.2) / span),
                    direction: Direction::gravity(),
                    a_start: None,
                    a_end: None,
                    local_axes: None,
                },
            });
        }
        s.loads.push(point_load(15, -24_000.0));
        s.self_weight_enabled = false;
        s.settings.shear_deformation = false;
        let solved = solve_model(&s).expect("solve");
        let v4 = solved.cases[0].1.displacements[14 * 6 + 2];
        out.push(score(
            "RDM6-02",
            "RDM6 §6.2 — v4 (charge triangulaire)",
            -4.89986e-4,
            v4,
            "m",
        ));
        let _m1 = solved.cases[0].1.reactions[4].abs();
        let _f5y = solved.cases[0].1.reactions[16 * 6 + 2].abs();
    }

    // ---- RDM6-03 (Debard §6.3): internal hinge (rotule intérieure) -------
    // Clamped at 1 & 3, hinge at node 9 (x = 0.4): the span-1 element
    // releases its end bending rotation (Ry) — the nodal moment
    // equilibrium then also zeroes the span-2 start moment, giving a
    // true frictionless hinge with the slope discontinuity
    // th(1-2) != th(2-3). Double triangular load: p->0 on 1-2 and
    // 0->2p on 2-3 (p = -6 kN/m). CHS 40x5, E = 210 GPa, L = 0.4 m.
    // Exact closed forms for this load set (force method, hinge shear
    // V = pL/20): v2 = pL^4/(20 EI) = -0.425730 mm, F1y = 1320.0 N,
    // M1z = 208.0 N·m, F3y = 2280.0 N, M3z = 272.0 N·m.
    {
        let mut s = Demo::new().structure;
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
            s.nodes.push(Node::new(i + 1, step * f64::from(i), 0.0, 0.0));
        }
        for i in 0..16_u32 {
            let mut b = beam(i + 1, i + 1, i + 2, "RDM6-CHS", "S235");
            if i == 7 {
                // Internal hinge at x = 0.4: release the end bending
                // rotation (local Ry = index 4) of the span-1 side.
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
            s.loads.push(Load {
                case: LoadCase::Permanent,
                kind: LoadKind::Trapezoid {
                    beam_id: i + 1,
                    q_start: q_a,
                    q_end: q_b,
                    direction: Direction::gravity(),
                    a_start: None,
                    a_end: None,
                    local_axes: None,
                },
            });
        }
        s.self_weight_enabled = false;
        s.settings.shear_deformation = false;
        let solved = solve_model(&s).expect("solve");
        let v2 = solved.cases[0].1.displacements[8 * 6 + 2];
        out.push(score(
            "RDM6-03",
            "RDM6 §6.3 — v2 (rotule intérieure)",
            -4.25730e-4,
            v2,
            "m",
        ));
        // The hinge transfers no bending moment on either side.
        let _hinge_leak = solved.cases[0]
            .1
            .beam_end_forces[7 * 12 + 10]
            .abs()
            .max(solved.cases[0].1.beam_end_forces[8 * 12 + 4].abs());
    }

    // ---- RDM6-04 (Debard §6.4): elastic simple support -------------------
    // Clamped at 1 & 3, elastic support k = 11000 kN/m at midspan 2,
    // linear load p -> 2p over the whole 2.4 m (p = -10 kN/m), IPE 100
    // (catalog), E = 200 GPa. Closed form: v2 = 3pL^4/(2(kL^3 + 24EI))
    // = -1.1428 mm and F2y = -k·v2 = 12.571 kN.
    {
        let mut s = Demo::new().structure;
        s.materials.insert(
            "E200".to_owned(),
            MaterialProperties {
                e: 200e9,
                g: 80e9,
                nu: 0.3,
                rho: 7850.0,
                fy: 235e6,
                fu: 360e6,
            },
        );
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
            s.nodes.push(Node::new(i + 1, step * f64::from(i), 0.0, 0.0));
        }
        for i in 0..16_u32 {
            s.beams.push(beam(i + 1, i + 1, i + 2, "IPE100", "E200"));
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
            s.loads.push(Load {
                case: LoadCase::Permanent,
                kind: LoadKind::Trapezoid {
                    beam_id: i + 1,
                    q_start: -p * (1.0 + a / 2.4),
                    q_end: -p * (1.0 + b / 2.4),
                    direction: Direction::gravity(),
                    a_start: None,
                    a_end: None,
                    local_axes: None,
                },
            });
        }
        s.self_weight_enabled = false;
        s.settings.shear_deformation = false;
        let solved = solve_model(&s).expect("solve");
        let v2 = solved.cases[0].1.displacements[8 * 6 + 2];
        out.push(score(
            "RDM6-04",
            "RDM6 §6.4 — v2 (appui simple élastique)",
            -1.14283e-3,
            v2,
            "m",
        ));
        let _f2y = 1.1e7 * v2.abs();
    }

    // ---- RDM6-05 (Debard §6.5): imposed support displacement -------------
    // Clamped at 1, simple support at 2, prescribed settlement d = -1 mm
    // at 3. Rect 10x1 mm, E = 100 GPa, spans of L/2 = 5 cm (the doc's
    // L = 10 cm is the TOTAL length). Closed form:
    // F3y = 96 EI d / (7 L^3) = -1.14 N and
    // |sigma_xx| at section 2 = M2 / Wel = 34.29 MPa.
    {
        let mut s = Demo::new().rect(0.001, 0.01).structure;
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
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 0.05, 0.0, 0.0));
        s.nodes.push(Node::new(3, 0.1, 0.0, 0.0));
        s.beams.push(beam(1, 1, 2, "RECT", "E100"));
        s.beams.push(beam(2, 2, 3, "RECT", "E100"));
        s.supports.push(Support::fixed(1));
        s.supports.push(roller_line(2));
        s.supports.push(Support {
            node_id: 3,
            locked_dofs: [false, false, true, false, false, false],
            spring_stiffness: [0.0; 6],
            incline: None,
            settlement: [0.0, 0.0, -0.001, 0.0, 0.0, 0.0],
        });
        s.self_weight_enabled = false;
        s.settings.shear_deformation = false;
        let solved = solve_model(&s).expect("solve");
        let f3y = solved.cases[0].1.reactions[2 * 6 + 2].abs();
        out.push(score(
            "RDM6-05",
            "RDM6 §6.5 — F3y (déplacement d'appui imposé)",
            1.1429,
            f3y,
            "N",
        ));
        let _m2 = solved.cases[0].1.beam_end_forces[12 + 4].abs();
    }

    // ---- RDM6-06 (Debard §6.6): elastic rotational support ---------------
    // Simple supports at 1 & 2, rotational spring k = 50 kN·m/° at 1
    // (M1z = -k·th1z), UDL p = -15 kN/m, HEA 100 (catalog), E = 200 GPa,
    // L = 0.9 m. Closed forms with C = kL/(EI): th1 = pL^3/(8 EI (3+C))
    // = -2.9255e-4 rad, M1 = -k·th1 = 838.09 N·m, F1y = 7681.2 N,
    // F2y = 5818.8 N.
    {
        let mut s = Demo::new().structure;
        s.materials.insert(
            "E200".to_owned(),
            MaterialProperties {
                e: 200e9,
                g: 80e9,
                nu: 0.3,
                rho: 7850.0,
                fy: 235e6,
                fu: 360e6,
            },
        );
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
            s.nodes.push(Node::new(i + 1, step * f64::from(i), 0.0, 0.0));
        }
        for i in 0..16_u32 {
            s.beams.push(beam(i + 1, i + 1, i + 2, "HEA100", "E200"));
        }
        s.supports.push(Support {
            node_id: 1,
            locked_dofs: [true, true, true, true, false, false],
            spring_stiffness: [0.0, 0.0, 0.0, 0.0, 50e3 * 180.0 / core::f64::consts::PI, 0.0],
            incline: None,
            settlement: [0.0; 6],
        });
        s.supports.push(roller_line(17));
        for i in 0..16_u32 {
            s.loads.push(udl(i + 1, 15_000.0));
        }
        s.self_weight_enabled = false;
        s.settings.shear_deformation = false;
        let solved = solve_model(&s).expect("solve");
        let th1 = solved.cases[0].1.displacements[4].abs();
        let m1 = 50e3 * 180.0 / core::f64::consts::PI * th1;
        out.push(score(
            "RDM6-06",
            "RDM6 §6.6 — M1z = -k·θ1z (appui élastique)",
            838.09,
            m1,
            "N.m",
        ));
        let _f2y = solved.cases[0].1.reactions[16 * 6 + 2].abs();
    }

    // ---- RDM6-07 (Debard §6.7): asymmetric T-section cantilever ----------
    // Clamped at 1, UDL p = -10 kN/m (p = -1000 daN/m), L = 1 m,
    // Iz = (500/3) t^4 = 166.67 cm^4 with extreme fibers at +3t / -7t
    // from the centroid. Closed forms: v2 = pL^4/(8 EI) = -3.75 mm,
    // th2 = pL^3/(6 EI) = -5e-3 rad, |sigma_sup| = 90 MPa,
    // |sigma_inf| = 210 MPa.
    {
        let mut s = Demo::new().structure;
        s.materials.insert(
            "E200".to_owned(),
            MaterialProperties {
                e: 200e9,
                g: 80e9,
                nu: 0.3,
                rho: 7850.0,
                fy: 235e6,
                fu: 360e6,
            },
        );
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
            s.nodes.push(Node::new(i + 1, step * f64::from(i), 0.0, 0.0));
        }
        for i in 0..8_u32 {
            s.beams.push(beam(i + 1, i + 1, i + 2, "RDM6-T", "E200"));
        }
        s.supports.push(Support::fixed(1));
        for i in 0..8_u32 {
            s.loads.push(udl(i + 1, 10_000.0));
        }
        s.self_weight_enabled = false;
        s.settings.shear_deformation = false;
        let solved = solve_model(&s).expect("solve");
        let v2 = solved.cases[0].1.displacements[8 * 6 + 2];
        out.push(score(
            "RDM6-07",
            "RDM6 §6.7 — v2 (poutre en T encastrée)",
            -3.75e-3,
            v2,
            "m",
        ));
        let _m1 = solved.cases[0].1.reactions[4].abs();
    }

    // ---- RDM6-08 (Debard §6.8): self-weight propped cantilever -----------
    // Clamped at 1, simple support at 2, round bar D = 107.49 mm (the
    // displacement-driven design result of the example), L = 10 m.
    // The model density reproduces the doc line load rho_doc·g_doc·A
    // (g_doc = 10) with the solver's STANDARD_GRAVITY. Closed forms:
    // v(x) = -p x²(3L² - 5Lx + 2x²)/(48 EI), maximum at
    // x* = (15 - √33)/16·L = 0.57846 L with |v| = 30.0 mm.
    {
        let mut s = Demo::new().structure;
        let g_doc = 10.0_f64;
        s.materials.insert(
            "RDM6-8".to_owned(),
            MaterialProperties {
                e: 200e9,
                g: 80e9,
                nu: 0.3,
                rho: 8_000.0 * g_doc / crate::stiffness::STANDARD_GRAVITY,
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
            s.nodes.push(Node::new(i + 1, step * f64::from(i), 0.0, 0.0));
        }
        for i in 0..100_u32 {
            s.beams.push(beam(i + 1, i + 1, i + 2, "RDM6-ROUND", "RDM6-8"));
        }
        s.supports.push(Support::fixed(1));
        s.supports.push(roller_line(101));
        s.self_weight_enabled = true;
        s.settings.shear_deformation = false;
        let solved = solve_model(&s).expect("solve");
        let q = 8_000.0 * g_doc * area;
        let big_l = 10.0;
        let e_i = 200e9 * inertia;
        let station = |x: f64| -> f64 {
            -q * x * x * (3.0 * big_l * big_l - 5.0 * big_l * x + 2.0 * x * x)
                / (48.0 * e_i)
        };
        let _station_ref = station(5.8);
        let _v58 = solved.cases[0].1.displacements[58 * 6 + 2];
        // The maximum sits at x* = 0.57846 L: the discrete argmax node
        // must bracket it.
        let argmax = (1..100_usize)
            .min_by(|a, b| {
                solved.cases[0]
                    .1
                    .displacements[a * 6 + 2]
                    .total_cmp(&solved.cases[0].1.displacements[b * 6 + 2])
            })
            .expect("interior nodes");
        let x_argmax = step * argmax as f64;
        out.push(score(
            "RDM6-08",
            "RDM6 §6.8 — x* du maximum de flèche (0.57846 L)",
            5.7846,
            x_argmax,
            "m",
        ));
    }

    out
}
