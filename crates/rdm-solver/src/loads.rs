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
    local_stiffness_matrix, point_local_vector, rotation_matrix, trapezoid_local_vector,
};

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
        let k_local = local_stiffness_matrix(
            material.e * section.a,
            material.g * section.it,
            material.e * section.iy,
            material.e * section.iz,
            frame.length,
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
    let ex = DVec3::new(rotation[(0, 0)], rotation[(0, 1)], rotation[(0, 2)]);
    let ey = DVec3::new(rotation[(1, 0)], rotation[(1, 1)], rotation[(1, 2)]);
    let ez = DVec3::new(rotation[(2, 0)], rotation[(2, 1)], rotation[(2, 2)]);
    let mut f =
        trapezoid_local_vector(q_start * ex.dot(direction), q_end * ex.dot(direction), 0, l);
    f += trapezoid_local_vector(q_start * ey.dot(direction), q_end * ey.dot(direction), 1, l);
    f += trapezoid_local_vector(q_start * ez.dot(direction), q_end * ez.dot(direction), 2, l);
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
            LoadKind::Nodal { .. } => {}
            LoadKind::PointOnSpan {
                beam_id,
                position_ratio,
                forces,
            } if beam_id == data.beam_id => {
                let local = global_to_local_forces(&data.rotation, &forces);
                f_local += point_local_vector(&local, position_ratio, data.frame.length);
            }
            LoadKind::PointOnSpan { .. } => {}
            LoadKind::Trapezoid {
                beam_id,
                q_start,
                q_end,
                direction,
            } if beam_id == data.beam_id => {
                f_local += trapezoid_in_local_axes(
                    &data.rotation,
                    q_start,
                    q_end,
                    DVec3::new(direction.x, direction.y, direction.z),
                    l,
                );
            }
            LoadKind::Trapezoid { .. } => {}
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
    for slot in 0..element.n_retained {
        let local_dof = element.retained_local_dof[slot];
        let global = data.local_to_global[local_dof];
        rhs[global] += f_global[(local_dof, 0)];
    }
}
