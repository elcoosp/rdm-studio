//! Per-case load vector assembly (consistent nodal loads, SI units).
//!
//! Each elementary [`LoadCase`] gets its own global RHS vector of length
//! `6n`. Self-weight `rho * A * g` is added to the `Permanent` case when the
//! structure enables it (ARCHITECTURE.md §6.1). Span loads are transformed
//! to local axes, condensed through the element end releases and projected
//! back to global DOFs.

use glam::DVec3;
use nalgebra::SMatrix;

use rdm_model::{LoadCase, LoadKind, Structure};

use crate::stiffness::{
    ELEMENT_DOFS, Element, ElementError, LocalFrame, STANDARD_GRAVITY, beam_local_frame,
    local_stiffness_matrix_shear, partial_trapezoid_local_vector, point_local_vector,
    rotation_matrix,
};

/// Linear thermal expansion coefficient of structural steel (1/K,
/// EN 1991-1-5 §Table C.1 recommended value).
pub const THERMAL_ALPHA_STEEL: f64 = 1.2e-5;

/// Timoshenko shear areas `(Av,y, Av,z)` of a cross-section (m², v1.7.0).
///
/// First-order shapes: I/channel → flange pair / web; solid rectangle →
/// `5A/6`; solid round → `0.9A`; hollow sections → `0.6A`; angle/general →
/// `2A/3`. Clamped to `[0.1A, A]` so the factors stay physical.
#[must_use]
pub fn shear_areas(section: &rdm_model::SectionProperties) -> (f64, f64) {
    use rdm_model::SectionShape;
    let a = section.a;
    let (av_y, av_z) = match section.shape {
        SectionShape::DoubleSymmetricI | SectionShape::Channel => {
            let h = section.h.unwrap_or(0.0);
            let tw = section.tw.unwrap_or(0.0);
            let b = section.b.unwrap_or(0.0);
            let tf = section.tf.unwrap_or(0.0);
            let web = h * tw;
            let flanges = 2.0 * b * tf;
            (flanges, web)
        }
        SectionShape::RectangularHollow => (0.6 * a, 0.6 * a),
        SectionShape::CircularHollow => (0.53 * a, 0.53 * a),
        // Angle and General share the 2/3 default shear factor.
        SectionShape::Angle | SectionShape::General => (2.0 * a / 3.0, 2.0 * a / 3.0),
    };
    // Solid rectangles fall under `General` in the catalog; approximate the
    // 5/6 shape factor from the aspect ratio when no web geometry exists.
    let clamp = |v: f64| v.clamp(0.1 * a, a);
    (clamp(av_y), clamp(av_z))
}

/// Load assembly errors.
#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum LoadVectorError {
    /// Invalid beam geometry or release pattern during assembly.
    #[error("load assembly failed: {0}")]
    Element(#[from] ElementError),
    /// A load references a beam that does not exist.
    #[error("load references unknown beam {0}")]
    UnknownBeam(u32),
    /// A beam references properties missing from the model tables.
    #[error("beam {0} references unknown section or material")]
    UnknownProperty(u32),
}

/// Static beam data precomputed once per solve.
#[derive(Debug, Clone)]
pub struct BeamElementData {
    /// Beam id.
    pub beam_id: u32,
    /// Local frame (ex along the axis, ey/ez after roll angle).
    pub frame: LocalFrame,
    /// Direction-cosine matrix `T` (local -> global vector mapping).
    pub rotation: SMatrix<f64, ELEMENT_DOFS, ELEMENT_DOFS>,
    /// Local stiffness before release condensation.
    pub k_local: SMatrix<f64, ELEMENT_DOFS, ELEMENT_DOFS>,
    /// Release flags in element order (`[start 6 | end 6]`).
    pub released: [bool; ELEMENT_DOFS],
    /// Local DOF -> global DOF map.
    pub local_to_global: [usize; ELEMENT_DOFS],
    /// v1.7.0: Timoshenko shear flexibility `Φ` for the x-z bending plane
    /// (stiffness `EIy`); `0.0` = Euler-Bernoulli.
    pub phi_y: f64,
    /// v1.7.0: Timoshenko shear flexibility `Φ` for the x-y bending plane
    /// (stiffness `EIz`); `0.0` = Euler-Bernoulli.
    pub phi_z: f64,
}

/// Precomputes beam frames, rotations, stiffnesses and release maps.
///
/// # Errors
///
/// Returns [`LoadVectorError`] when geometry or property lookups fail.
pub fn build_elements(structure: &Structure) -> Result<Vec<BeamElementData>, LoadVectorError> {
    let mut out = Vec::with_capacity(structure.beams.len());
    for beam in &structure.beams {
        let section = structure
            .sections
            .get(&beam.section_id)
            .ok_or(LoadVectorError::UnknownProperty(beam.id))?;
        let material = structure
            .materials
            .get(&beam.material_id)
            .ok_or(LoadVectorError::UnknownProperty(beam.id))?;
        let p1 = structure
            .node(beam.n1)
            .map(|n| DVec3::new(n.x, n.y, n.z))
            .map_err(|_| LoadVectorError::UnknownProperty(beam.id))?;
        let p2 = structure
            .node(beam.n2)
            .map(|n| DVec3::new(n.x, n.y, n.z))
            .map_err(|_| LoadVectorError::UnknownProperty(beam.id))?;
        let frame = beam_local_frame(p1, p2, beam.roll_angle_rad)
            .map_err(|_| LoadVectorError::UnknownProperty(beam.id))?;
        let rotation = rotation_matrix(&frame);
        // v1.7.0: linear depth taper — the member stiffness uses the exact
        // mean of the cubic depth law (`Iy ∝ h³`, `Wel ∝ h²`).
        let taper_scale = beam.taper_end_scale.unwrap_or(1.0).max(0.05);
        let mean_cubic = if (taper_scale - 1.0).abs() < 1e-9 {
            1.0
        } else {
            (taper_scale.powi(4) - 1.0) / (4.0 * (taper_scale - 1.0))
        };
        let iy_eff = section.iy * mean_cubic;
        let iz_eff = section.iz * mean_cubic;
        // v1.7.0: Timoshenko shear flexibility
        // `Φ = 12 E I / (G Av L²)` per bending plane (0 = Euler-Bernoulli).
        let (av_y, av_z) = shear_areas(section);
        let (phi_y, phi_z) = if structure.settings.shear_deformation {
            (
                12.0 * material.e * iy_eff / (material.g * av_z * frame.length.powi(2)),
                12.0 * material.e * iz_eff / (material.g * av_y * frame.length.powi(2)),
            )
        } else {
            (0.0, 0.0)
        };
        let k_local = local_stiffness_matrix_shear(
            material.e * section.a,
            material.g * section.it,
            material.e * iy_eff,
            material.e * iz_eff,
            frame.length,
            phi_y,
            phi_z,
        );
        let mut released = [false; ELEMENT_DOFS];
        released[..6].copy_from_slice(&beam.releases_start);
        released[6..].copy_from_slice(&beam.releases_end);
        let n1_base = structure
            .dof_offset(beam.n1)
            .map_err(|_| LoadVectorError::UnknownProperty(beam.id))?;
        let n2_base = structure
            .dof_offset(beam.n2)
            .map_err(|_| LoadVectorError::UnknownProperty(beam.id))?;
        let local_to_global: [usize; ELEMENT_DOFS] = core::array::from_fn(|i| {
            let base = if i < 6 { n1_base } else { n2_base };
            base + i % 6
        });
        out.push(BeamElementData {
            beam_id: beam.id,
            frame,
            rotation,
            k_local,
            released,
            local_to_global,
            phi_y,
            phi_z,
        });
    }
    Ok(out)
}

/// Assembles the global RHS vector of one elementary case (length `6n`).
///
/// Every span load goes through [`Element::build`] so end releases receive
/// the same condensation as the stiffness; the Permanent case also carries
/// automatic self-weight when enabled.
///
/// # Errors
///
/// Returns [`LoadVectorError`] when loads reference unknown entities.
pub fn assemble_case_vector(
    structure: &Structure,
    elements: &[BeamElementData],
    case: LoadCase,
) -> Result<Vec<f64>, LoadVectorError> {
    let ndof = 6 * structure.nodes.len();
    let mut rhs = vec![0.0f64; ndof];

    for load in &structure.loads {
        if load.case != case {
            continue;
        }
        if let LoadKind::Nodal { node_id, forces } = load.kind {
            let base = structure
                .dof_offset(node_id)
                .map_err(|_| LoadVectorError::UnknownBeam(node_id))?;
            rhs[base] += forces.fx;
            rhs[base + 1] += forces.fy;
            rhs[base + 2] += forces.fz;
            rhs[base + 3] += forces.mx;
            rhs[base + 4] += forces.my;
            rhs[base + 5] += forces.mz;
        }
    }

    for data in elements {
        let f_local = beam_case_load_local(structure, data, case)?;
        let element = build_case_element(data, &f_local)?;
        scatter_element_load(data, &element, &mut rhs);
    }

    Ok(rhs)
}

fn global_to_local_forces(
    rotation: &SMatrix<f64, ELEMENT_DOFS, ELEMENT_DOFS>,
    forces: &rdm_model::GlobalForces,
) -> [f64; 6] {
    // f_local = T f_global on the 6-component application-point vector.
    let f = [
        forces.fx, forces.fy, forces.fz, forces.mx, forces.my, forces.mz,
    ];
    let mut out = [0.0f64; 6];
    for (i, value) in out.iter_mut().enumerate() {
        let mut acc = 0.0;
        for (j, &component) in f.iter().enumerate() {
            acc += rotation[(i, j)] * component;
        }
        *value = acc;
    }
    out
}

/// Projects a global trapezoid onto the local axes and builds its
/// consistent 12-vector (axial + local-y + local-z contributions).
fn trapezoid_in_local_axes(
    rotation: &SMatrix<f64, ELEMENT_DOFS, ELEMENT_DOFS>,
    q_start: f64,
    q_end: f64,
    direction: glam::DVec3,
    l: f64,
) -> SMatrix<f64, ELEMENT_DOFS, 1> {
    trapezoid_in_local_axes_partial(rotation, q_start, q_end, 0.0, 1.0, direction, l)
}

/// v1.7.0: partial-span variant of [`trapezoid_in_local_axes`].
fn trapezoid_in_local_axes_partial(
    rotation: &SMatrix<f64, ELEMENT_DOFS, ELEMENT_DOFS>,
    q_start: f64,
    q_end: f64,
    a1: f64,
    a2: f64,
    direction: glam::DVec3,
    l: f64,
) -> SMatrix<f64, ELEMENT_DOFS, 1> {
    let ex = DVec3::new(rotation[(0, 0)], rotation[(0, 1)], rotation[(0, 2)]);
    let ey = DVec3::new(rotation[(1, 0)], rotation[(1, 1)], rotation[(1, 2)]);
    let ez = DVec3::new(rotation[(2, 0)], rotation[(2, 1)], rotation[(2, 2)]);
    let mut f = partial_trapezoid_local_vector(
        q_start * ex.dot(direction),
        q_end * ex.dot(direction),
        a1,
        a2,
        0,
        l,
    );
    f += partial_trapezoid_local_vector(
        q_start * ey.dot(direction),
        q_end * ey.dot(direction),
        a1,
        a2,
        1,
        l,
    );
    f += partial_trapezoid_local_vector(
        q_start * ez.dot(direction),
        q_end * ez.dot(direction),
        a1,
        a2,
        2,
        l,
    );
    f
}

/// Total local load vector of one beam under one elementary case (includes
/// self-weight when `case == Permanent` and the structure enables it).
///
/// # Errors
///
/// Returns [`LoadVectorError`] when the beam references unknown entities.
pub fn beam_case_load_local(
    structure: &Structure,
    data: &BeamElementData,
    case: LoadCase,
) -> Result<SMatrix<f64, ELEMENT_DOFS, 1>, LoadVectorError> {
    let l = data.frame.length;
    let beam = structure
        .beams
        .iter()
        .find(|b| b.id == data.beam_id)
        .ok_or(LoadVectorError::UnknownBeam(data.beam_id))?;
    let mut f_local = SMatrix::<f64, ELEMENT_DOFS, 1>::zeros();

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
                let local = global_to_local_forces(&data.rotation, &forces);
                f_local += point_local_vector(&local, position_ratio, data.frame.length);
            }
            LoadKind::Trapezoid {
                a_start,
                a_end,
                local_axes,
                beam_id,
                q_start,
                q_end,
                direction,
            } if beam_id == data.beam_id => {
                let a1 = a_start.unwrap_or(0.0);
                let a2 = a_end.unwrap_or(1.0);
                if local_axes.unwrap_or(false) {
                    // v1.7.0: the direction components ARE local axes.
                    f_local += partial_trapezoid_local_vector(q_start, q_end, a1, a2, 0, l);
                    f_local += partial_trapezoid_local_vector(q_start, q_end, a1, a2, 1, l);
                    f_local += partial_trapezoid_local_vector(q_start, q_end, a1, a2, 2, l);
                } else {
                    f_local += trapezoid_in_local_axes_partial(
                        &data.rotation,
                        q_start,
                        q_end,
                        a1,
                        a2,
                        DVec3::new(direction.x, direction.y, direction.z),
                        l,
                    );
                }
            }
            LoadKind::Thermal {
                beam_id,
                delta_t,
                delta_ty,
                delta_tz,
            } if beam_id == data.beam_id => {
                // v1.7.0: consistent thermal load vector. Uniform ΔT gives
                // the axial pair `EA·α·ΔT·[-1, +1]` (free expansion under
                // zero force; fixed ends develop `N = -EA·α·ΔT`). Gradients
                // give the fixed-end moment pair `EI·κ` with
                // `κ = α·ΔT / depth`.
                let section = structure.sections.get(&beam.section_id);
                let material = structure.materials.get(&beam.material_id);
                if let (Some(section), Some(material)) = (section, material) {
                    let ea = material.e * section.a;
                    if delta_t.abs() > 0.0 {
                        f_local[(0, 0)] += -ea * THERMAL_ALPHA_STEEL * delta_t;
                        f_local[(6, 0)] += ea * THERMAL_ALPHA_STEEL * delta_t;
                    }
                    let depth = section.h.unwrap_or_else(|| section.a.sqrt());
                    let width = section.b.unwrap_or(depth);
                    let taper_scale = beam.taper_end_scale.unwrap_or(1.0).max(0.05);
                    let depth_eff = depth * (1.0 + taper_scale) / 2.0;
                    let width_eff = width * (1.0 + taper_scale) / 2.0;
                    if delta_tz.abs() > 0.0 && depth_eff > 0.0 {
                        let ei_kappa =
                            material.e * section.iy * THERMAL_ALPHA_STEEL * delta_tz / depth_eff;
                        // x-z plane (uz=2, ry=4, uz2=8, ry2=10): free
                        // curvature load = [0, EIκ, 0, -EIκ].
                        f_local[(4, 0)] += ei_kappa;
                        f_local[(10, 0)] += -ei_kappa;
                    }
                    if delta_ty.abs() > 0.0 && width_eff > 0.0 {
                        let ei_kappa =
                            material.e * section.iz * THERMAL_ALPHA_STEEL * delta_ty / width_eff;
                        // x-y plane (uy=1, rz=5, uy2=7, rz2=11): free
                        // curvature load = [0, -EIκ, 0, +EIκ].
                        f_local[(5, 0)] += -ei_kappa;
                        f_local[(11, 0)] += ei_kappa;
                    }
                }
            }
            LoadKind::AccelerationField { ax_g, ay_g, az_g } => {
                // v1.3.0: exact distributed inertial body force
                // `q = ρ·A·g·(ax, ay, az)` (N/m) on every member, projected
                // through the same consistent trapezoid vector as gravity.
                let section = structure.sections.get(&beam.section_id);
                let material = structure.materials.get(&beam.material_id);
                if let (Some(section), Some(material)) = (section, material) {
                    let q = material.rho * section.a * STANDARD_GRAVITY;
                    if q.abs() > 0.0 {
                        f_local += trapezoid_in_local_axes(
                            &data.rotation,
                            q,
                            q,
                            DVec3::new(ax_g, ay_g, az_g),
                            l,
                        );
                    }
                }
            }
            _ => {}
        }
    }

    if case == LoadCase::Permanent && structure.self_weight_enabled {
        let section = structure
            .sections
            .get(&beam.section_id)
            .ok_or(LoadVectorError::UnknownProperty(beam.id))?;
        let material = structure
            .materials
            .get(&beam.material_id)
            .ok_or(LoadVectorError::UnknownProperty(beam.id))?;
        let q = -material.rho * section.a * STANDARD_GRAVITY;
        f_local += trapezoid_in_local_axes(&data.rotation, q, q, DVec3::Z, l);
    }
    Ok(f_local)
}

/// Condenses one beam's case load through its releases.
///
/// # Errors
///
/// Returns [`ElementError`] on degenerate release patterns.
pub fn build_case_element(
    data: &BeamElementData,
    f_local: &SMatrix<f64, ELEMENT_DOFS, 1>,
) -> Result<Element, ElementError> {
    Element::build(
        data.k_local,
        *f_local,
        &data.released,
        &data.local_to_global,
    )
}

/// Scatters a condensed element load into the global RHS.
pub fn scatter_element_load(data: &BeamElementData, element: &Element, rhs: &mut [f64]) {
    let mut f_full_local = SMatrix::<f64, ELEMENT_DOFS, 1>::zeros();
    for slot in 0..element.n_retained {
        f_full_local[(element.retained_local_dof[slot], 0)] = element.f_retained[(slot, 0)];
    }
    let f_global = data.rotation.transpose() * f_full_local;
    for &local_dof in &element.retained_local_dof[..element.n_retained] {
        let global = data.local_to_global[local_dof];
        rhs[global] += f_global[(local_dof, 0)];
    }
}
