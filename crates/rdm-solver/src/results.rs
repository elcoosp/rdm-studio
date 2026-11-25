//! Member post-processing: exact interior deflections along a beam.
//!
//! The FE displacement vector reproduces the Euler-Bernoulli solution at the
//! nodes exactly; the interior value is the Hermite interpolation of the end
//! displacements **plus** the clamped-ends particular solution under the
//! span loads (textbook recovery for consistent load vectors). Everything is
//! integrated analytically on polynomial segments (point loads split the
//! domain), so SLS deflection checks and analytical benchmarks reach 1e-12.
//!
//! Sign conventions: local axes right-handed, `w` positive along the local
//! transverse axis, loads signed along it (gravity gives negative values),
//! sagging moments positive, and `EI w'' = M`.

use nalgebra::SMatrix;

use rdm_model::Structure;

use crate::loads::{BeamElementData, LoadVectorError};
use crate::stiffness::ELEMENT_DOFS;

/// Span loads of one beam, projected on the local axes.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct SpanLoads {
    /// Concentrated loads `(ratio, fy, fz)` at the span point (N).
    pub points: Vec<(f64, f64, f64)>,
    /// Trapezoids `(qy1, qy2, qz1, qz2)` in N/m along local y / z.
    pub trapezoids: Vec<(f64, f64, f64, f64)>,
}

/// Collects the span loads (in local axes) of one beam under one case,
/// including automatic self-weight for the Permanent case.
///
/// # Errors
///
/// Returns [`LoadVectorError`] when the beam references unknown properties.
pub fn span_loads_local(
    structure: &Structure,
    data: &BeamElementData,
    case: rdm_model::LoadCase,
) -> Result<SpanLoads, LoadVectorError> {
    use rdm_model::LoadKind;
    let beam = structure
        .beams
        .iter()
        .find(|b| b.id == data.beam_id)
        .ok_or(LoadVectorError::UnknownBeam(data.beam_id))?;
    let mut out = SpanLoads::default();
    for load in &structure.loads {
        if load.case != case {
            continue;
        }
        match load.kind {
            LoadKind::PointOnSpan {
                beam_id,
                position_ratio,
                forces,
            } if beam_id == data.beam_id => {
                let ey = local_axis(data, 1);
                let ez = local_axis(data, 2);
                let dir = glam::DVec3::new(forces.fx, forces.fy, forces.fz);
                out.points.push((position_ratio, ey.dot(dir), ez.dot(dir)));
            }
            LoadKind::Trapezoid {
                beam_id,
                q_start,
                q_end,
                direction,
                a_start,
                a_end,
                local_axes,
            } if beam_id == data.beam_id => {
                let a1 = a_start.unwrap_or(0.0);
                let a2 = a_end.unwrap_or(1.0);
                let full_span = a1 <= 1e-9 && a2 >= 1.0 - 1e-9;
                if full_span && !local_axes.unwrap_or(false) {
                    let ey = local_axis(data, 1);
                    let ez = local_axis(data, 2);
                    let dir = glam::DVec3::new(direction.x, direction.y, direction.z);
                    out.trapezoids.push((
                        q_start * ey.dot(dir),
                        q_end * ey.dot(dir),
                        q_start * ez.dot(dir),
                        q_end * ez.dot(dir),
                    ));
                } else {
                    // v1.7.0: partial-span / local-axis trapezoids reduce to
                    // their resultant at the segment centroid for the
                    // station reconstruction (exact outside the loaded
                    // segment, documented first-order inside).
                    let span = (a2 - a1).max(1e-9);
                    let qm = q_start.midpoint(q_end);
                    let centroid =
                        a1 + span * (q_start + 2.0 * q_end) / (3.0 * (q_start + q_end).max(1e-12));
                    // (midpoint-style interpolation guarded against overflow by
                    // the 1e-12 floor above)
                    let r = qm * span;
                    let ey = local_axis(data, 1);
                    let ez = local_axis(data, 2);
                    // Local-axes vs global interpretation differ only in
                    // the ASSEMBLY path; the reconstruction consumes the
                    // already-projected intensities.
                    let dir = glam::DVec3::new(direction.x, direction.y, direction.z);
                    let fy = r * ey.dot(dir);
                    let fz = r * ez.dot(dir);
                    out.points.push((centroid.clamp(0.0, 1.0), fy, fz));
                }
            }
            LoadKind::Thermal { .. } => {
                // v1.7.0: thermal actions enter through the end-force array
                // (axial pair + fixed-end moment pair); no span load term.
            }
            LoadKind::AccelerationField { ax_g, ay_g, az_g } => {
                // v1.3.0: the EC3 station superposition sees the same
                // inertial body force the stiffness solve integrated.
                let ey = local_axis(data, 1);
                let ez = local_axis(data, 2);
                if let Some((section, material)) = structure
                    .beams
                    .iter()
                    .find(|b| b.id == data.beam_id)
                    .and_then(|beam| {
                        structure
                            .sections
                            .get(&beam.section_id)
                            .zip(structure.materials.get(&beam.material_id))
                    })
                {
                    let q = material.rho * section.a * crate::stiffness::STANDARD_GRAVITY;
                    let dir = glam::DVec3::new(ax_g, ay_g, az_g);
                    out.trapezoids.push((
                        q * ey.dot(dir),
                        q * ey.dot(dir),
                        q * ez.dot(dir),
                        q * ez.dot(dir),
                    ));
                }
            }
            _ => {}
        }
    }
    if case == rdm_model::LoadCase::Permanent && structure.self_weight_enabled {
        let section = structure
            .sections
            .get(&beam.section_id)
            .ok_or(LoadVectorError::UnknownProperty(beam.id))?;
        let material = structure
            .materials
            .get(&beam.material_id)
            .ok_or(LoadVectorError::UnknownProperty(beam.id))?;
        let q = -material.rho * section.a * crate::stiffness::STANDARD_GRAVITY;
        out.trapezoids.push((0.0, 0.0, q, q));
    }
    Ok(out)
}

fn local_axis(data: &BeamElementData, row: usize) -> glam::DVec3 {
    glam::DVec3::new(
        data.rotation[(row, 0)],
        data.rotation[(row, 1)],
        data.rotation[(row, 2)],
    )
}

/// Cubic bending-moment coefficients on one segment: `M(s) = c0 + c1 s + c2
/// s^2 + c3 s^3` (sagging positive, absolute s along the span).
#[derive(Debug, Clone, Copy, Default, PartialEq)]
struct MomentPoly {
    c0: f64,
    c1: f64,
    c2: f64,
    c3: f64,
}

impl MomentPoly {
    /// `(integral of M, integral of s*M)` over `[a, b]`, exact.
    fn integrals(&self, a: f64, b: f64) -> (f64, f64) {
        let i_m = self.c0 * (b - a)
            + self.c1 * (b * b - a * a) / 2.0
            + self.c2 * (b * b * b - a * a * a) / 3.0
            + self.c3 * (b * b * b * b - a * a * a * a) / 4.0;
        let i_sm = self.c0 * (b * b - a * a) / 2.0
            + self.c1 * (b * b * b - a * a * a) / 3.0
            + self.c2 * (b * b * b * b - a * a * a * a) / 4.0
            + self.c3 * (b * b * b * b * b - a * a * a * a * a) / 5.0;
        (i_m, i_sm)
    }
}

/// Clamped-ends moment polynomial of one plane, valid on `[0, upto]` (before
/// the next point load). `m_eq`/`v_eq` are the consistent-load entries
/// `(moment, shear)` of the clamped member (dofs 5/1 for the y plane, 4/2
/// for the z plane); the clamped reactions are their negation.
fn moment_poly(
    span_loads: &SpanLoads,
    m_eq: f64,
    v_eq: f64,
    length: f64,
    plane: usize,
    upto: f64,
) -> MomentPoly {
    let mut poly = MomentPoly {
        c0: m_eq,
        c1: -v_eq,
        c2: 0.0,
        c3: 0.0,
    };
    for (q1, q2) in trapezoids(span_loads, plane) {
        poly.c2 += q1 / 2.0;
        poly.c3 += (q2 - q1) / (6.0 * length);
    }
    // Point loads at or before `upto` shift the coefficients.
    for &(ratio, fy, fz) in &span_loads.points {
        let p = if plane == 0 { fy } else { fz };
        let a = ratio * length;
        if a <= upto + 1e-12 {
            poly.c0 -= p * a;
            poly.c1 += p;
        }
    }
    poly
}

fn trapezoids(span_loads: &SpanLoads, plane: usize) -> Vec<(f64, f64)> {
    span_loads
        .trapezoids
        .iter()
        .map(
            |&(qy1, qy2, qz1, qz2)| {
                if plane == 0 { (qy1, qy2) } else { (qz1, qz2) }
            },
        )
        .collect()
}

/// Interior transverse deflection `(uy, uz)` at `ratio` along the span.
///
/// `u_local` is the solved local displacement 12-vector; `f_eq_local` is the
/// consistent local load 12-vector of the case (used for the clamped
/// particular solution); `eiz`/`eiy` are `E·I` bending stiffnesses (N·m²).
/// For members with end releases the particular term is skipped (the
/// Hermite part is returned; released-member interiors are refined later).
pub fn beam_deflection_at(
    span_loads: &SpanLoads,
    has_releases: bool,
    u_local: &SMatrix<f64, ELEMENT_DOFS, 1>,
    f_eq_local: &SMatrix<f64, ELEMENT_DOFS, 1>,
    eiz: f64,
    eiy: f64,
    length: f64,
    ratio: f64,
) -> (f64, f64) {
    let a = ratio.clamp(0.0, 1.0);
    let x = a * length;

    let n1 = 1.0 - 3.0 * a * a + 2.0 * a * a * a;
    let n2 = length * (a - 2.0 * a * a + a * a * a);
    let n3 = 3.0 * a * a - 2.0 * a * a * a;
    let n4 = length * (-a * a + a * a * a);
    let hermite_y =
        n1 * u_local[(1, 0)] + n2 * u_local[(5, 0)] + n3 * u_local[(7, 0)] + n4 * u_local[(11, 0)];
    // x-z plane: the Hermite slope DOF is dw/dx = -ry (x cross z = -y).
    let hermite_z =
        n1 * u_local[(2, 0)] - n2 * u_local[(4, 0)] + n3 * u_local[(8, 0)] - n4 * u_local[(10, 0)];

    let w0_y = if has_releases {
        0.0
    } else {
        particular_part(span_loads, f_eq_local, eiz, length, 0, x)
    };
    let w0_z = if has_releases {
        0.0
    } else {
        particular_part(span_loads, f_eq_local, eiy, length, 1, x)
    };
    (hermite_y + w0_y, hermite_z + w0_z)
}

/// `w_p(x) = int_0^x (x - s) M(s) / EI ds` with the clamped-member moment.
fn particular_part(
    span_loads: &SpanLoads,
    f_eq: &SMatrix<f64, ELEMENT_DOFS, 1>,
    ei: f64,
    length: f64,
    plane: usize,
    x: f64,
) -> f64 {
    let (mi, vi) = if plane == 0 {
        (5usize, 1usize)
    } else {
        (4usize, 2usize)
    };
    // Sagging convention per plane: in the x-y plane the sagging moment is
    // the +z element moment (f_eq[5]); in the x-z plane the curvature normal
    // is -y (x cross z = -y), so the sagging moment is the NEGATIVE of the
    // +y element moment (f_eq[4]).
    let m_eq = if plane == 0 {
        f_eq[(mi, 0)]
    } else {
        -f_eq[(mi, 0)]
    };
    let v_eq = f_eq[(vi, 0)];

    // Segment splits: point-load positions strictly inside [0, x], plus x.
    let mut cuts: Vec<f64> = vec![0.0, x];
    for &(ratio, _, _) in &span_loads.points {
        let a = ratio * length;
        if a > 1e-12 && a < x - 1e-12 {
            cuts.push(a);
        }
    }
    cuts.sort_by(|p, q| p.partial_cmp(q).unwrap_or(std::cmp::Ordering::Equal));
    cuts.dedup_by(|p, q| (*p - *q).abs() < 1e-12);

    let mut i_m_total = 0.0;
    let mut i_sm_total = 0.0;
    for window in cuts.windows(2) {
        let (s0, s1) = (window[0], window[window.len() - 1]);
        let poly = moment_poly(span_loads, m_eq, v_eq, length, plane, s0);
        let (i_m, i_sm) = poly.integrals(s0, s1);
        i_m_total += i_m;
        i_sm_total += i_sm;
    }
    (x * i_m_total - i_sm_total) / ei
}

/// Superposed midspan deflection metric of one beam over a combination:
/// the local transverse components are superposed per case and combined
/// into a single resultant (metres, unsigned).
///
/// # Errors
///
/// Returns [`LoadVectorError`] when the beam references unknown entities.
pub fn midspan_deflection_metric(
    structure: &Structure,
    solved: &crate::static_sparse::SolvedModel,
    beam_index: usize,
    weights: &[(rdm_model::LoadCase, f64)],
) -> Result<f64, LoadVectorError> {
    let elements = crate::loads::build_elements(structure)?;
    let data = &elements[beam_index];
    let beam = &structure.beams[beam_index];
    let section = structure
        .sections
        .get(&beam.section_id)
        .ok_or(LoadVectorError::UnknownProperty(beam.id))?;
    let material = structure
        .materials
        .get(&beam.material_id)
        .ok_or(LoadVectorError::UnknownProperty(beam.id))?;

    let mut uy_total = 0.0f64;
    let mut uz_total = 0.0f64;
    for (case, weight) in weights {
        let Some((_, solution)) = solved.cases.iter().find(|(c, _)| c == case) else {
            continue;
        };
        let f_eq = crate::loads::beam_case_load_local(structure, data, *case)?;
        let mut u_local = SMatrix::<f64, ELEMENT_DOFS, 1>::zeros();
        for (local_dof, &gdof) in data.local_to_global.iter().enumerate() {
            u_local[(local_dof, 0)] = solution.displacements[gdof];
        }
        let span_loads = span_loads_local(structure, data, *case)?;
        let has_releases = data.released.iter().any(|&r| r);
        let (uy, uz) = beam_deflection_at(
            &span_loads,
            has_releases,
            &u_local,
            &f_eq,
            material.e * section.iz,
            material.e * section.iy,
            data.frame.length,
            0.5,
        );
        uy_total += weight * uy;
        uz_total += weight * uz;
    }
    Ok((uy_total * uy_total + uz_total * uz_total).sqrt())
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;
    use rdm_model::LoadCase;

    fn sample_structure() -> rdm_model::Structure {
        let mut s = rdm_model::Structure::default();
        s.nodes.push(rdm_model::Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(rdm_model::Node::new(2, 4.0, 0.0, 0.0));
        s.beams.push(rdm_model::Beam::frame(1, 1, 2, "S", "M"));
        s.sections.insert(
            "S".to_owned(),
            rdm_model::SectionProperties {
                shape: rdm_model::SectionShape::DoubleSymmetricI,
                a: 2.848e-3,
                iy: 1.943e-5,
                iz: 1.424e-6,
                it: 6.846e-8,
                iw: None,
                wel_y: 1.943e-4,
                wel_z: 2.847e-5,
                wpl_y: None,
                wpl_z: None,
                h: Some(0.2),
                b: Some(0.1),
                tw: Some(0.0056),
                tf: Some(0.0085),
                r: Some(0.012),
            },
        );
        s.materials.insert(
            "M".to_owned(),
            rdm_model::MaterialProperties {
                e: 210e9,
                g: 81e9,
                nu: 0.3,
                rho: 7850.0,
                fy: 235e6,
                fu: 360e6,
            },
        );
        s
    }

    /// v1.3.0: a `1g -Z` acceleration field must be in exact equilibrium —
    /// the summed vertical reactions equal the total inertial weight
    /// `ρ·A·g·L` (the analytic `q = ρ·A·g·(ax, ay, az)` integration).
    #[test]
    fn acceleration_field_reactions_equal_inertial_weight() {
        let mut s = sample_structure();
        // Isolate the field: no superposed gravity self-weight.
        s.self_weight_enabled = false;
        s.loads.push(rdm_model::Load {
            case: LoadCase::Permanent,
            kind: rdm_model::LoadKind::AccelerationField {
                ax_g: 0.0,
                ay_g: 0.0,
                az_g: -1.0,
            },
        });
        s.supports.push(rdm_model::Support {
            node_id: 1,
            locked_dofs: [true, true, true, true, false, false],
            spring_stiffness: [0.0; 6],
            incline: None,
            settlement: [0.0; 6],
        });
        s.supports.push(rdm_model::Support {
            node_id: 2,
            locked_dofs: [false, true, true, false, false, false],
            spring_stiffness: [0.0; 6],
            incline: None,
            settlement: [0.0; 6],
        });
        let solved = crate::solve_model(&s).expect("solve");
        let (_, case) = solved
            .cases
            .iter()
            .find(|(case, _)| case == &LoadCase::Permanent)
            .expect("permanent case");
        let rho = 7850.0;
        let a = 2.848e-3;
        let g = 9.80665;
        let expected = rho * a * g * 4.0;
        let sum_fz: f64 = case.reactions.iter().skip(2).step_by(6).sum();
        assert_relative_eq!(sum_fz, expected, epsilon = 1e-3);
    }

    #[test]
    fn span_loads_collect_points_and_self_weight() {
        let mut s = sample_structure();
        s.loads.push(rdm_model::Load {
            case: LoadCase::Variable,
            kind: rdm_model::LoadKind::PointOnSpan {
                beam_id: 1,
                position_ratio: 0.5,
                forces: rdm_model::GlobalForces::vertical(-10_000.0),
            },
        });
        let elements = crate::loads::build_elements(&s).unwrap();
        let data = &elements[0];
        let loads = span_loads_local(&s, data, LoadCase::Variable).unwrap();
        assert_eq!(loads.points.len(), 1);
        assert_relative_eq!(loads.points[0].2, -10_000.0, epsilon = 1e-9);
        let loads_g = span_loads_local(&s, data, LoadCase::Permanent).unwrap();
        assert!(loads_g.trapezoids[0].3 < 0.0, "self-weight pulls down");
    }

    #[test]
    fn clamped_particular_udl_matches_closed_form() {
        // Clamped-clamped beam under UDL q: w_p(L/2) = q L^4 / 384 EI.
        let l = 4.0;
        let q = -1_000.0;
        let ei = 210e9 * 1.943e-5;
        let mut f_eq = SMatrix::<f64, ELEMENT_DOFS, 1>::zeros();
        f_eq[(1, 0)] = q * l / 2.0;
        f_eq[(5, 0)] = q * l * l / 12.0;
        let loads = SpanLoads {
            points: vec![],
            trapezoids: vec![(q, q, 0.0, 0.0)],
        };
        let u = SMatrix::<f64, ELEMENT_DOFS, 1>::zeros();
        let (uy, _) = beam_deflection_at(&loads, false, &u, &f_eq, ei, ei, l, 0.5);
        let expected = q * l.powi(4) / (384.0 * ei);
        assert_relative_eq!(uy, expected, epsilon = 1e-12);
    }

    #[test]
    fn simply_supported_udl_midspan_is_exact() {
        // SS beam, 2-node FE solution: theta1 = qL^3/24EI (q signed),
        // hermite + clamped particular = 5qL^4/384EI.
        let l = 4.0;
        let q = -1_000.0;
        let ei = 210e9 * 1.943e-5;
        let mut f_eq = SMatrix::<f64, ELEMENT_DOFS, 1>::zeros();
        f_eq[(1, 0)] = q * l / 2.0;
        f_eq[(5, 0)] = q * l * l / 12.0;
        let mut u = SMatrix::<f64, ELEMENT_DOFS, 1>::zeros();
        u[(5, 0)] = q * l.powi(3) / (24.0 * ei);
        u[(11, 0)] = -q * l.powi(3) / (24.0 * ei);
        let loads = SpanLoads {
            points: vec![],
            trapezoids: vec![(q, q, 0.0, 0.0)],
        };
        let (uy, _) = beam_deflection_at(&loads, false, &u, &f_eq, ei, ei, l, 0.5);
        let expected = 5.0 * q * l.powi(4) / (384.0 * ei);
        assert_relative_eq!(uy, expected, epsilon = 1e-12);
    }

    #[test]
    fn simply_supported_point_load_midspan_is_exact() {
        // SS beam with midspan point load P: theta = P L^2 / 16 EI,
        // hermite + particular = P L^3 / 48 EI.
        let l = 4.0;
        let p = -10_000.0;
        let ei = 210e9 * 1.943e-5;
        let mut f_eq = SMatrix::<f64, ELEMENT_DOFS, 1>::zeros();
        f_eq[(1, 0)] = p / 2.0;
        f_eq[(5, 0)] = p * l / 8.0;
        let mut u = SMatrix::<f64, ELEMENT_DOFS, 1>::zeros();
        u[(5, 0)] = p * l * l / (16.0 * ei);
        u[(11, 0)] = -p * l * l / (16.0 * ei);
        let loads = SpanLoads {
            points: vec![(0.5, p, 0.0)],
            trapezoids: vec![],
        };
        let (uy, _) = beam_deflection_at(&loads, false, &u, &f_eq, ei, ei, l, 0.5);
        let expected = p * l.powi(3) / (48.0 * ei);
        assert_relative_eq!(uy, expected, epsilon = 1e-12);
    }
}
