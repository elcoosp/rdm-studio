//! 2D finite-element continuum & plate solver (M13.2).
//!
//! Pure Rust, strict SI units (`m`, `Pa`, `N`), no web dependencies, zero
//! panics. Three theories over the [`rdm_mesh`] constrained Delaunay
//! triangulation:
//!
//! - **Plane stress / plane strain** (`CST` 3-node and `LST` 6-node
//!   triangles): nodal displacements `(ux, uy)`, element & smoothed nodal
//!   stresses `(σxx, σyy, τxy)`, principal stresses `(σ1, σ2, θp)` and the
//!   Von Mises equivalent stress `σvM` (replaces RDM 7 – Élasticité plane).
//! - **Mindlin–Reissner plate bending** (`MITC3` tying triangle): nodal
//!   deflection `w` and rotations `(θx, θy)` under area pressure `q` and
//!   point loads, with smoothed bending moments `(mx, my, mxy)` and
//!   transverse shears `(vx, vy)` (replaces RDM 7 – Flexion des plaques).
//!
//! Restraints and normal tractions attach to boundary edges through the
//! mesher's source-edge tags; point loads attach to the nearest mesh node.

use std::collections::BTreeMap;

use faer::Side;
use faer::linalg::solvers::Solve;
use faer::sparse::SparseColMat;
use faer::sparse::Triplet;
use faer::sparse::linalg::solvers::{Llt, SymbolicLlt};
use rdm_mesh::{MeshParams, MeshRegion, TriMesh, triangulate};
use serde::{Deserialize, Serialize};

/// Plane elasticity theory selection.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FemTheory {
    /// Plane stress (`σzz = 0`) — thin plates in their own plane.
    #[serde(rename = "plane_stress")]
    PlaneStress,
    /// Plane strain (`εzz = 0`) — long prismatic bodies.
    #[serde(rename = "plane_strain")]
    PlaneStrain,
    /// Mindlin–Reissner plate bending (MITC3 tying triangle).
    #[serde(rename = "plate_bending")]
    PlateBending,
}

/// Plane continuum element technology.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlaneElement {
    /// Constant-strain triangle (3 nodes, linear displacement).
    #[serde(rename = "cst")]
    Cst,
    /// Linear-strain triangle (6 nodes incl. deduplicated mid-sides).
    #[serde(rename = "lst")]
    Lst,
}

/// Boundary restraint applied to one input polygon edge.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EdgeRestraint {
    /// Free edge (no restraint).
    #[serde(rename = "free")]
    Free,
    /// Fully fixed edge (plane: `ux = uy = 0`; plate: clamped `w = θx = θy = 0`).
    #[serde(rename = "fixed")]
    Fixed,
    /// Pinned edge (plane: `ux = uy = 0`; plate: simply supported `w = 0`).
    #[serde(rename = "pinned")]
    Pinned,
    /// Roller sliding along x (plane: `uy = 0`; plate: supported `w = 0`).
    #[serde(rename = "roller_x")]
    RollerX,
    /// Roller sliding along y (plane: `ux = 0`; plate: supported `w = 0`).
    #[serde(rename = "roller_y")]
    RollerY,
    /// Pressure edge: uniform normal traction `edge_pressure` (Pa,
    /// positive = compression pushing on the domain, negative = tension).
    #[serde(rename = "pressure")]
    Pressure,
}

/// Isotropic linear-elastic material (strict SI).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct FemMaterial {
    /// Young's modulus (Pa).
    pub e: f64,
    /// Poisson's ratio (–).
    pub nu: f64,
}

/// Concentrated load applied at the nearest mesh node (strict SI).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct FemPointLoad {
    /// Attachment abscissa (m).
    pub x: f64,
    /// Attachment ordinate (m).
    pub y: f64,
    /// Force along x (N).
    pub fx: f64,
    /// Force along y (N).
    pub fy: f64,
    /// Force along z (N, plate bending only).
    pub fz: f64,
}

/// Full 2D FEM analysis specification (strict SI).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Fem2dSpec {
    /// Plane stress / plane strain / plate bending.
    pub theory: FemTheory,
    /// Plane continuum element technology (ignored for plates).
    pub element: PlaneElement,
    /// Outer contour (m, simple polygon; winding normalized internally).
    pub outer: Vec<[f64; 2]>,
    /// Interior hole contours (m).
    #[serde(default)]
    pub holes: Vec<Vec<[f64; 2]>>,
    /// Target mesh size (m).
    pub h_max: f64,
    /// Optional finer size around hole contours (m) — used for stress
    /// concentrators such as the Kirsch perforated plate.
    #[serde(default)]
    pub h_refine: Option<f64>,
    /// Out-of-plane thickness (m).
    pub thickness: f64,
    /// Isotropic material (Pa, –).
    pub material: FemMaterial,
    /// Restraint per outer contour edge (same length as `outer`).
    pub edge_restraints: Vec<EdgeRestraint>,
    /// Normal traction on edges tagged [`EdgeRestraint::Pressure`] (Pa).
    #[serde(default)]
    pub edge_pressure: f64,
    /// Area pressure for plate bending (Pa, positive acts downward −z).
    #[serde(default)]
    pub area_pressure: f64,
    /// Concentrated loads (N).
    #[serde(default)]
    pub point_loads: Vec<FemPointLoad>,
}

/// Solver telemetry & peak extrema.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Fem2dTelemetry {
    /// Peak resultant displacement (m, plane) or peak |w| (m, plate).
    pub u_max: f64,
    /// Peak Von Mises equivalent stress (Pa, plane theories only, else 0).
    pub sigma_vm_max: f64,
    /// Peak major principal stress (Pa, plane theories only, else 0).
    pub sigma_1_max: f64,
    /// Peak bending-moment magnitude (N·m/m, plate only, else 0).
    pub m_max: f64,
    /// Stress-concentration ratio `σ1_max / |edge_pressure|` when a
    /// pressure traction drives the plane model (else `None`).
    pub kt: Option<f64>,
    /// Mesh node count.
    pub n_nodes: usize,
    /// Mesh element count.
    pub n_elements: usize,
    /// Smallest triangle angle (degrees).
    pub min_angle_deg: f64,
    /// Meshed domain area (m²).
    pub area: f64,
}

/// Full 2D FEM result payload (strict SI).
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Fem2dReport {
    /// Echo of the solved theory.
    pub theory: FemTheory,
    /// Echo of the element technology used (`cst` / `lst` / `mitc3`).
    pub element: String,
    /// Mesh vertex coordinates (m).
    pub vertices: Vec<[f64; 2]>,
    /// Mesh triangles (counter-clockwise vertex indices).
    pub triangles: Vec<[usize; 3]>,
    /// DOFs per node (2 plane, 3 plate).
    pub dofs_per_node: usize,
    /// Nodal DOF values, `dofs_per_node` entries per node
    /// (plane: `ux, uy`; plate: `w, θx, θy`).
    pub dof_values: Vec<f64>,
    /// Smoothed nodal field names (see [`Fem2dReport::nodal_fields`]).
    pub field_names: Vec<String>,
    /// Smoothed nodal fields, `field_names.len()` entries per node
    /// (plane: `sigma_vm, sigma_1, sigma_2, theta_p`;
    /// plate: `w, m_x, m_y, m_xy, v_x, v_y`).
    pub nodal_fields: Vec<Vec<f64>>,
    /// Telemetry & peak extrema.
    pub telemetry: Fem2dTelemetry,
}

/// 2D FEM solving errors.
#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum Fem2dError {
    /// Meshing or spec validation failure.
    #[error("invalid fem2d spec: {message}")]
    InvalidSpec {
        /// Explanation.
        message: String,
    },
    /// The restraint/load pattern leaves a mechanism (singular system).
    #[error("unstable fem2d mechanism: {message}")]
    Unstable {
        /// Explanation.
        message: String,
    },
    /// Sparse factorization failure.
    #[error("fem2d sparse error: {message}")]
    Sparse {
        /// Underlying faer message.
        message: String,
    },
}

/// Solves the 2D FEM spec end-to-end (mesh → assemble → factorize → post).
///
/// # Errors
///
/// Returns [`Fem2dError`] on invalid specs, degenerate geometry or
/// unstable (insufficiently restrained) models.
pub fn solve_fem2d(spec: &Fem2dSpec) -> Result<Fem2dReport, Fem2dError> {
    validate_spec(spec)?;
    let mesh = triangulate(
        &MeshRegion {
            outer: spec.outer.clone(),
            holes: spec.holes.clone(),
        },
        &MeshParams {
            h_max: spec.h_max,
            h_refine: spec.h_refine,
            ..MeshParams::default()
        },
    )
    .map_err(|e| Fem2dError::InvalidSpec {
        message: e.to_string(),
    })?;
    match spec.theory {
        FemTheory::PlaneStress | FemTheory::PlaneStrain => solve_plane(spec, &mesh),
        FemTheory::PlateBending => solve_plate(spec, &mesh),
    }
}

/// Validates the caller-facing parts of the spec.
fn validate_spec(spec: &Fem2dSpec) -> Result<(), Fem2dError> {
    if spec.outer.len() < 3 {
        return Err(Fem2dError::InvalidSpec {
            message: "outer contour needs at least 3 points".to_owned(),
        });
    }
    if spec.edge_restraints.len() != spec.outer.len() {
        return Err(Fem2dError::InvalidSpec {
            message: format!(
                "edge_restraints ({}) must match outer contour edges ({})",
                spec.edge_restraints.len(),
                spec.outer.len()
            ),
        });
    }
    if !(spec.thickness.is_finite() && spec.thickness > 0.0) {
        return Err(Fem2dError::InvalidSpec {
            message: "thickness must be a positive finite length".to_owned(),
        });
    }
    if !(spec.material.e.is_finite() && spec.material.e > 0.0) {
        return Err(Fem2dError::InvalidSpec {
            message: "material.e must be a positive finite modulus".to_owned(),
        });
    }
    if !(-0.49..0.49).contains(&spec.material.nu) {
        return Err(Fem2dError::InvalidSpec {
            message: "material.nu must lie in (-0.49, 0.49)".to_owned(),
        });
    }
    Ok(())
}

/// Solves the plane stress / plane strain problem.
fn solve_plane(spec: &Fem2dSpec, mesh: &TriMesh) -> Result<Fem2dReport, Fem2dError> {
    let use_lst = spec.element == PlaneElement::Lst;
    // Element node table: CST reuses the mesh triangles; LST appends
    // deduplicated mid-side nodes per triangle edge.
    let mut vertices = mesh.vertices.clone();
    let mut elements: Vec<Vec<usize>> = Vec::new();
    if use_lst {
        let mut mid_index: BTreeMap<(usize, usize), usize> = BTreeMap::new();
        for t in &mesh.triangles {
            let mut nodes = vec![t[0], t[1], t[2]];
            for k in 0..3 {
                let (a, b) = (t[k], t[(k + 1) % 3]);
                let key = if a < b { (a, b) } else { (b, a) };
                let mid = *mid_index.entry(key).or_insert_with(|| {
                    vertices.push([
                        (vertices[key.0][0] + vertices[key.1][0]) / 2.0,
                        (vertices[key.0][1] + vertices[key.1][1]) / 2.0,
                    ]);
                    vertices.len() - 1
                });
                nodes.push(mid);
            }
            elements.push(nodes);
        }
    } else {
        for t in &mesh.triangles {
            elements.push(t.to_vec());
        }
    }
    let dofs_per_node = 2usize;
    let ndof = dofs_per_node * vertices.len();
    let (d_matrix, sigma_z_factor) = plane_d_matrix(spec);

    let mut triplets: Vec<Triplet<usize, usize, f64>> = Vec::with_capacity(ndof * 8);
    // Per element: (corner node ids, all DOF ids, B at the centroid).
    let mut element_data: Vec<(Vec<usize>, Vec<usize>, Vec<f64>)> = Vec::new();
    for nodes in &elements {
        let coords: Vec<[f64; 2]> = nodes.iter().map(|&n| vertices[n]).collect();
        let local_dofs: Vec<usize> = nodes
            .iter()
            .flat_map(|&n| [dofs_per_node * n, dofs_per_node * n + 1])
            .collect();
        if use_lst {
            let (ke, b_centroid) = lst_stiffness(&coords, &d_matrix, spec.thickness);
            for (i, gi) in local_dofs.iter().enumerate() {
                for (j, gj) in local_dofs.iter().enumerate() {
                    triplets.push(Triplet::new(*gi, *gj, ke[(i, j)]));
                }
            }
            element_data.push((nodes[..3].to_vec(), local_dofs, b_centroid));
        } else {
            let (ke, b_centroid) = cst_stiffness(&coords, &d_matrix, spec.thickness);
            for (i, gi) in local_dofs.iter().enumerate() {
                for (j, gj) in local_dofs.iter().enumerate() {
                    triplets.push(Triplet::new(*gi, *gj, ke[(i, j)]));
                }
            }
            element_data.push((nodes[..3].to_vec(), local_dofs, b_centroid));
        }
    }

    // Loads: pressure tractions + point loads. Quadratic (LST) edges take
    // the consistent corner L/6 + mid-side 2L/3 split instead of L/2+L/2.
    let mut force = vec![0.0_f64; ndof];
    let mut mid_of_edge: BTreeMap<(usize, usize), usize> = BTreeMap::new();
    if use_lst {
        for nodes in &elements {
            for k in 0..3 {
                let (a, b) = (nodes[k], nodes[(k + 1) % 3]);
                let key = if a < b { (a, b) } else { (b, a) };
                mid_of_edge.insert(key, nodes[3 + k]);
            }
        }
    }
    let mut distribute = |a: usize, b: usize, total: (f64, f64), force: &mut [f64]| {
        let push = |node: usize, share: f64, fx: f64, fy: f64, force: &mut [f64]| {
            force[dofs_per_node * node] += share * fx;
            force[dofs_per_node * node + 1] += share * fy;
        };
        if use_lst {
            let key = if a < b { (a, b) } else { (b, a) };
            push(a, 1.0 / 6.0, total.0, total.1, force);
            push(b, 1.0 / 6.0, total.0, total.1, force);
            if let Some(&mid) = mid_of_edge.get(&key) {
                push(mid, 2.0 / 3.0, total.0, total.1, force);
            }
        } else {
            push(a, 0.5, total.0, total.1, force);
            push(b, 0.5, total.0, total.1, force);
        }
    };
    apply_pressure_edges(spec, mesh, &vertices, &mut distribute, &mut force);
    apply_point_loads_plane(spec, &vertices, &mut force, dofs_per_node);

    let dof_values = solve_system(
        triplets,
        force,
        locked_dofs_plane(spec, mesh, dofs_per_node, ndof),
        ndof,
    )?;

    // Element stresses + area-weighted nodal smoothing.
    let mut nodal_sum = vec![[0.0_f64; 3]; vertices.len()];
    let mut nodal_weight = vec![0.0_f64; vertices.len()];
    for (corner_nodes, local_dofs, b_centroid) in &element_data {
        let u_e: Vec<f64> = local_dofs.iter().map(|&g| dof_values[g]).collect();
        let sigma = mat3_vec3(&d_matrix, &mat_rows_vec(b_centroid, 3, &u_e));
        let weight = element_area(&[
            vertices[corner_nodes[0]],
            vertices[corner_nodes[1]],
            vertices[corner_nodes[2]],
        ]);
        for &node in corner_nodes {
            nodal_weight[node] += weight / 3.0;
            for (slot, value) in nodal_sum[node].iter_mut().zip(sigma.iter()) {
                *slot += value * weight;
            }
        }
    }
    let field_names = vec![
        "sigma_vm".to_owned(),
        "sigma_1".to_owned(),
        "sigma_2".to_owned(),
        "theta_p".to_owned(),
    ];
    let mut nodal_fields = vec![vec![0.0_f64; 4]; vertices.len()];
    let mut u_max = 0.0_f64;
    let mut svm_max = 0.0_f64;
    let mut s1_max = 0.0_f64;
    for node in 0..vertices.len() {
        let w = nodal_weight[node].max(f64::EPSILON);
        let sx = nodal_sum[node][0] / w;
        let sy = nodal_sum[node][1] / w;
        let txy = nodal_sum[node][2] / w;
        let (s1, s2, theta_p) = principal_2d(sx, sy, txy);
        let svm = von_mises_plane(sx, sy, txy, sigma_z_factor);
        nodal_fields[node] = vec![svm, s1, s2, theta_p];
        let ux = dof_values[dofs_per_node * node];
        let uy = dof_values[dofs_per_node * node + 1];
        u_max = u_max.max((ux * ux + uy * uy).sqrt());
        svm_max = svm_max.max(svm.abs());
        s1_max = s1_max.max(s1);
    }
    let kt = (spec.edge_pressure.abs() > f64::EPSILON).then(|| s1_max / spec.edge_pressure.abs());
    Ok(Fem2dReport {
        theory: spec.theory,
        element: if use_lst { "lst" } else { "cst" }.to_owned(),
        vertices,
        triangles: mesh.triangles.clone(),
        dofs_per_node,
        dof_values,
        field_names,
        nodal_fields,
        telemetry: Fem2dTelemetry {
            u_max,
            sigma_vm_max: svm_max,
            sigma_1_max: s1_max,
            m_max: 0.0,
            kt,
            n_nodes: mesh.vertices.len(),
            n_elements: mesh.triangles.len(),
            min_angle_deg: mesh.quality.min_angle_deg,
            area: mesh.quality.area,
        },
    })
}

/// Solves the Mindlin–Reissner plate problem (MITC3 tying triangle).
/// Constitutive matrix + the plane-strain `σzz` coupling factor
/// (`σzz = factor·(σxx + σyy)`; 0 for plane stress).
fn plane_d_matrix(spec: &Fem2dSpec) -> ([[f64; 3]; 3], f64) {
    let e = spec.material.e;
    let nu = spec.material.nu;
    match spec.theory {
        FemTheory::PlaneStress => {
            let f = e / (1.0 - nu * nu);
            (
                [
                    [f, f * nu, 0.0],
                    [f * nu, f, 0.0],
                    [0.0, 0.0, f * (1.0 - nu) / 2.0],
                ],
                0.0,
            )
        }
        _ => {
            let f = e / ((1.0 + nu) * (1.0 - 2.0 * nu));
            (
                [
                    [f * (1.0 - nu), f * nu, 0.0],
                    [f * nu, f * (1.0 - nu), 0.0],
                    [0.0, 0.0, f * (1.0 - 2.0 * nu) / 2.0],
                ],
                nu / (1.0 - nu),
            )
        }
    }
}

/// Unsigned triangle area (m²).
fn element_area(coords: &[[f64; 2]]) -> f64 {
    if coords.len() < 3 {
        return 0.0;
    }
    rdm_mesh::cdt::orient2d(coords[0], coords[1], coords[2]).abs() / 2.0
}

/// CST stiffness (6×6) and the constant flattened B matrix (3×6).
fn cst_stiffness(
    coords: &[[f64; 2]],
    d: &[[f64; 3]; 3],
    thickness: f64,
) -> (nalgebra::SMatrix<f64, 6, 6>, Vec<f64>) {
    let area = element_area(coords);
    let doubled = area * 2.0;
    let b = [
        [
            coords[1][1] - coords[2][1],
            coords[2][1] - coords[0][1],
            coords[0][1] - coords[1][1],
        ],
        [
            coords[2][0] - coords[1][0],
            coords[0][0] - coords[2][0],
            coords[1][0] - coords[0][0],
        ],
    ];
    let mut b_matrix = [[0.0_f64; 6]; 3];
    for i in 0..3 {
        b_matrix[0][2 * i] = b[0][i] / doubled;
        b_matrix[1][2 * i + 1] = b[1][i] / doubled;
        b_matrix[2][2 * i] = b[1][i] / doubled;
        b_matrix[2][2 * i + 1] = b[0][i] / doubled;
    }
    let b_flat: Vec<f64> = b_matrix.iter().flat_map(|r| r.iter().copied()).collect();
    let d_flat: Vec<f64> = d.iter().flat_map(|r| r.iter().copied()).collect();
    let ke = dense_to_smatrix(&mat_t_d_mat(&b_flat, 3, 6, &d_flat, thickness * area));
    (ke, b_flat)
}

/// LST stiffness (12×12) via the 3-point edge-midpoint rule, plus the
/// flattened B matrix (3×12) at the centroid for stress recovery.
fn lst_stiffness(
    coords: &[[f64; 2]],
    d: &[[f64; 3]; 3],
    thickness: f64,
) -> (nalgebra::SMatrix<f64, 12, 12>, Vec<f64>) {
    let gps = [(0.5, 0.0), (0.5, 0.5), (0.0, 0.5)];
    let mut ke = nalgebra::SMatrix::<f64, 12, 12>::zeros();
    let d_flat: Vec<f64> = d.iter().flat_map(|r| r.iter().copied()).collect();
    for (r, s) in gps {
        let (b_flat, det_j) = lst_b_matrix(coords, r, s);
        let contrib = mat_t_d_mat(&b_flat, 3, 12, &d_flat, thickness * det_j / 6.0);
        accumulate(&mut ke, &contrib);
    }
    let (b_centroid, _) = lst_b_matrix(coords, 1.0 / 3.0, 1.0 / 3.0);
    (ke, b_centroid)
}

/// LST shape-function derivative matrix (flattened 3×12) at `(r, s)`
/// plus the Jacobian determinant.
fn lst_b_matrix(coords: &[[f64; 2]], r: f64, s: f64) -> (Vec<f64>, f64) {
    let l1 = 1.0 - r - s;
    let dn_dr = [
        1.0 - 4.0 * l1,
        4.0 * r - 1.0,
        0.0,
        4.0 * (l1 - r),
        4.0 * s,
        -4.0 * s,
    ];
    let dn_ds = [
        1.0 - 4.0 * l1,
        0.0,
        4.0 * s - 1.0,
        -4.0 * r,
        4.0 * r,
        4.0 * (l1 - s),
    ];
    let j00 = coords[1][0] - coords[0][0];
    let j01 = coords[2][0] - coords[0][0];
    let j10 = coords[1][1] - coords[0][1];
    let j11 = coords[2][1] - coords[0][1];
    let det = j00 * j11 - j01 * j10;
    let inv = if det.abs() > f64::EPSILON {
        1.0 / det
    } else {
        0.0
    };
    let mut b_flat = vec![0.0_f64; 36];
    for i in 0..6 {
        let dn_x = inv * (j11 * dn_dr[i] - j10 * dn_ds[i]);
        let dn_y = inv * (j00 * dn_ds[i] - j01 * dn_dr[i]);
        b_flat[12 * 0 + 2 * i] = dn_x;
        b_flat[12 * 1 + 2 * i + 1] = dn_y;
        b_flat[12 * 2 + 2 * i] = dn_y;
        b_flat[12 * 2 + 2 * i + 1] = dn_x;
    }
    (b_flat, det.abs())
}

// --- MITC3 Mindlin–Reissner plate element ----------------------------------

/// Bending constitutive matrix `D_b` (moments in N·m/m).
fn plate_bending_matrix(spec: &Fem2dSpec) -> [[f64; 3]; 3] {
    let factor = spec.material.e * spec.thickness.powi(3)
        / (12.0 * (1.0 - spec.material.nu * spec.material.nu));
    let nu = spec.material.nu;
    [
        [factor, factor * nu, 0.0],
        [factor * nu, factor, 0.0],
        [0.0, 0.0, factor * (1.0 - nu) / 2.0],
    ]
}

/// Plate transverse shear stiffness `Ds = κ·G·t` (N/m), κ = 5/6.
fn plate_shear_modulus(spec: &Fem2dSpec) -> f64 {
    let g = spec.material.e / (2.0 * (1.0 + spec.material.nu));
    (5.0 / 6.0) * g * spec.thickness
}

/// MITC3 Jacobian determinant (`= 2·A` for counter-clockwise triangles).
fn mitc3_jacobian(coords: &[[f64; 2]]) -> f64 {
    (coords[1][0] - coords[0][0]) * (coords[2][1] - coords[0][1])
        - (coords[2][0] - coords[0][0]) * (coords[1][1] - coords[0][1])
}

/// Constant curvature-displacement matrix: κx = ∂θy/∂x, κy = −∂θx/∂y,
/// κxy = ∂θy/∂y − ∂θx/∂x with the DOF order `(w, θx, θy)` per node.
fn mitc3_bending_matrix(coords: &[[f64; 2]]) -> [[f64; 9]; 3] {
    let det_j = mitc3_jacobian(coords);
    let inv = if det_j.abs() > f64::EPSILON {
        1.0 / det_j
    } else {
        0.0
    };
    let dn_dr = [-1.0_f64, 1.0, 0.0];
    let dn_ds = [-1.0_f64, 0.0, 1.0];
    let mut b = [[0.0_f64; 9]; 3];
    for i in 0..3 {
        let dn_x = inv
            * (dn_dr[i] * (coords[2][1] - coords[0][1]) - dn_ds[i] * (coords[1][1] - coords[0][1]));
        let dn_y = inv
            * (dn_ds[i] * (coords[1][0] - coords[0][0]) - dn_dr[i] * (coords[2][0] - coords[0][0]));
        b[0][3 * i + 2] = dn_x;
        b[1][3 * i + 1] = -dn_y;
        b[2][3 * i + 1] = -dn_x;
        b[2][3 * i + 2] = dn_y;
    }
    b
}

/// Tying rows for `γx`/`γy` at the natural tie points `P1 = (1/2, 0)`
/// and `P2 = (0, 1/2)`.
fn mitc3_tying_rows(coords: &[[f64; 2]]) -> ([[f64; 9]; 2], [[f64; 9]; 2]) {
    let det_j = mitc3_jacobian(coords);
    let inv = if det_j.abs() > f64::EPSILON {
        1.0 / det_j
    } else {
        0.0
    };
    let dn_dr = [-1.0_f64, 1.0, 0.0];
    let dn_ds = [-1.0_f64, 0.0, 1.0];
    let mut gx_rows = [[0.0_f64; 9]; 2];
    let mut gy_rows = [[0.0_f64; 9]; 2];
    for (k, p) in [(0.5, 0.0_f64), (0.0, 0.5_f64)].into_iter().enumerate() {
        let n = [1.0 - p.0 - p.1, p.0, p.1];
        for i in 0..3 {
            let dn_x = inv
                * (dn_dr[i] * (coords[2][1] - coords[0][1])
                    - dn_ds[i] * (coords[1][1] - coords[0][1]));
            let dn_y = inv
                * (dn_ds[i] * (coords[1][0] - coords[0][0])
                    - dn_dr[i] * (coords[2][0] - coords[0][0]));
            gx_rows[k][3 * i] = dn_x;
            gx_rows[k][3 * i + 2] = n[i];
            gy_rows[k][3 * i] = dn_y;
            gy_rows[k][3 * i + 1] = -n[i];
        }
    }
    (gx_rows, gy_rows)
}

/// MITC3 element stiffness (9×9): bending at the centroid + tied shear
/// integrated with the exact 3-point rule over the assumed linear field.
fn mitc3_stiffness(
    coords: &[[f64; 2]],
    d_b: &[[f64; 3]; 3],
    d_s: f64,
) -> nalgebra::SMatrix<f64, 9, 9> {
    let mut ke = nalgebra::SMatrix::<f64, 9, 9>::zeros();
    let area = mitc3_jacobian(coords).abs() / 2.0;
    let b_b = mitc3_bending_matrix(coords);
    let d_flat: Vec<f64> = d_b.iter().flat_map(|r| r.iter().copied()).collect();
    let contrib = mat_t_d_mat(&flatten3x9(&b_b), 3, 9, &d_flat, area);
    accumulate(&mut ke, &contrib);
    let (gx_rows, gy_rows) = mitc3_tying_rows(coords);
    for (r, s) in [
        (1.0 / 6.0, 1.0 / 6.0),
        (2.0 / 3.0, 1.0 / 6.0),
        (1.0 / 6.0, 2.0 / 3.0),
    ] {
        let phi1 = 1.0 - 2.0 * s;
        let phi2 = 1.0 - 2.0 * r;
        let mut b_shear = vec![0.0_f64; 18];
        for j in 0..9 {
            b_shear[j] = phi1 * gx_rows[0][j] + phi2 * gx_rows[1][j];
            b_shear[9 + j] = phi1 * gy_rows[0][j] + phi2 * gy_rows[1][j];
        }
        let contrib = mat_t_d_mat(&b_shear, 2, 9, &[d_s, 0.0, 0.0, d_s], area / 3.0);
        accumulate(&mut ke, &contrib);
    }
    ke
}

/// Shear resultants `(vx, vy)` (N/m) at the element centroid from the
/// tied assumed field.
fn mitc3_centroid_shear(coords: &[[f64; 2]], u_e: &[f64], d_s: f64) -> (f64, f64) {
    let (gx_rows, gy_rows) = mitc3_tying_rows(coords);
    let row_dot = |row: &[f64; 9]| row.iter().zip(u_e.iter()).map(|(a, b)| a * b).sum::<f64>();
    let (r, s) = (1.0 / 3.0, 1.0 / 3.0);
    let phi1 = 1.0 - 2.0 * s;
    let phi2 = 1.0 - 2.0 * r;
    let gx = phi1 * row_dot(&gx_rows[0]) + phi2 * row_dot(&gx_rows[1]);
    let gy = phi1 * row_dot(&gy_rows[0]) + phi2 * row_dot(&gy_rows[1]);
    (d_s * gx, d_s * gy)
}

/// Solves the Mindlin–Reissner plate problem with the MITC3 tying triangle
/// (bending at the centroid + tied transverse shear).
fn solve_plate(spec: &Fem2dSpec, mesh: &TriMesh) -> Result<Fem2dReport, Fem2dError> {
    let dofs_per_node = 3usize;
    let ndof = dofs_per_node * mesh.vertices.len();
    let d_b = plate_bending_matrix(spec);
    let d_s = plate_shear_modulus(spec);

    let mut triplets: Vec<Triplet<usize, usize, f64>> = Vec::with_capacity(ndof * 10);
    for t in &mesh.triangles {
        let coords: Vec<[f64; 2]> = t.iter().map(|&n| mesh.vertices[n]).collect();
        let ke = mitc3_stiffness(&coords, &d_b, d_s);
        let local_dofs: Vec<usize> = t
            .iter()
            .flat_map(|&n| [3 * n, 3 * n + 1, 3 * n + 2])
            .collect();
        for (i, gi) in local_dofs.iter().enumerate() {
            for (j, gj) in local_dofs.iter().enumerate() {
                triplets.push(Triplet::new(*gi, *gj, ke[(i, j)]));
            }
        }
    }

    let mut force = vec![0.0_f64; ndof];
    if spec.area_pressure.abs() > f64::EPSILON {
        for t in &mesh.triangles {
            let area = element_area(&[
                mesh.vertices[t[0]],
                mesh.vertices[t[1]],
                mesh.vertices[t[2]],
            ]);
            for &n in t {
                force[3 * n] -= spec.area_pressure * area / 3.0;
            }
        }
    }
    for load in &spec.point_loads {
        if let Some(node) = nearest_node(&mesh.vertices, [load.x, load.y]) {
            force[3 * node] += load.fz;
        }
    }

    let dof_values = solve_system(
        triplets,
        force,
        locked_dofs_plate(spec, mesh, dofs_per_node),
        ndof,
    )?;

    let mut nodal_sum = vec![[0.0_f64; 6]; mesh.vertices.len()];
    let mut nodal_weight = vec![0.0_f64; mesh.vertices.len()];
    for t in &mesh.triangles {
        let coords: Vec<[f64; 2]> = t.iter().map(|&n| mesh.vertices[n]).collect();
        let b_kappa = mitc3_bending_matrix(&coords);
        let local_dofs: Vec<usize> = t
            .iter()
            .flat_map(|&n| [3 * n, 3 * n + 1, 3 * n + 2])
            .collect();
        let u_e: Vec<f64> = local_dofs.iter().map(|&g| dof_values[g]).collect();
        let kappa = mat_rows_vec(&flatten3x9(&b_kappa), 3, &u_e);
        let m = mat3_vec3(&d_b, &kappa);
        let (vx, vy) = mitc3_centroid_shear(&coords, &u_e, d_s);
        let weight = element_area(&coords);
        for &n in t {
            nodal_weight[n] += weight / 3.0;
            let slots = &mut nodal_sum[n];
            slots[0] += dof_values[3 * n] * weight;
            slots[1] += m[0] * weight;
            slots[2] += m[1] * weight;
            slots[3] += m[2] * weight;
            slots[4] += vx * weight;
            slots[5] += vy * weight;
        }
    }
    let field_names = vec![
        "w".to_owned(),
        "m_x".to_owned(),
        "m_y".to_owned(),
        "m_xy".to_owned(),
        "v_x".to_owned(),
        "v_y".to_owned(),
    ];
    let mut nodal_fields = vec![vec![0.0_f64; 6]; mesh.vertices.len()];
    let mut w_max = 0.0_f64;
    let mut m_max = 0.0_f64;
    for node in 0..mesh.vertices.len() {
        let w = nodal_weight[node].max(f64::EPSILON);
        let vals: Vec<f64> = nodal_sum[node].iter().map(|v| v / w).collect();
        w_max = w_max.max(vals[0].abs());
        m_max = m_max
            .max(vals[1].abs())
            .max(vals[2].abs())
            .max(vals[3].abs());
        nodal_fields[node] = vals;
    }
    Ok(Fem2dReport {
        theory: spec.theory,
        element: "mitc3".to_owned(),
        vertices: mesh.vertices.clone(),
        triangles: mesh.triangles.clone(),
        dofs_per_node,
        dof_values,
        field_names,
        nodal_fields,
        telemetry: Fem2dTelemetry {
            u_max: w_max,
            sigma_vm_max: 0.0,
            sigma_1_max: 0.0,
            m_max,
            kt: None,
            n_nodes: mesh.vertices.len(),
            n_elements: mesh.triangles.len(),
            min_angle_deg: mesh.quality.min_angle_deg,
            area: mesh.quality.area,
        },
    })
}

// --- Assembly & solve ------------------------------------------------------

/// Locked global DOFs for the plane problem from the tagged edges.
fn locked_dofs_plane(
    spec: &Fem2dSpec,
    mesh: &TriMesh,
    dofs_per_node: usize,
    ndof: usize,
) -> Vec<bool> {
    let mut locked = vec![false; ndof];
    for edge in &mesh.boundary_edges {
        let Some(restraint) = spec.edge_restraints.get(edge.source) else {
            continue;
        };
        let lock_x = matches!(
            restraint,
            EdgeRestraint::Fixed | EdgeRestraint::Pinned | EdgeRestraint::RollerY
        );
        let lock_y = matches!(
            restraint,
            EdgeRestraint::Fixed | EdgeRestraint::Pinned | EdgeRestraint::RollerX
        );
        if lock_x {
            locked[dofs_per_node * edge.a] = true;
            locked[dofs_per_node * edge.b] = true;
        }
        if lock_y {
            locked[dofs_per_node * edge.a + 1] = true;
            locked[dofs_per_node * edge.b + 1] = true;
        }
    }
    locked
}

/// Locked global DOFs for the plate problem from the tagged edges.
fn locked_dofs_plate(spec: &Fem2dSpec, mesh: &TriMesh, dofs_per_node: usize) -> Vec<bool> {
    let mut locked = vec![false; dofs_per_node * mesh.vertices.len()];
    for edge in &mesh.boundary_edges {
        let Some(restraint) = spec.edge_restraints.get(edge.source) else {
            continue;
        };
        match restraint {
            EdgeRestraint::Fixed => {
                for node in [edge.a, edge.b] {
                    for d in 0..3 {
                        locked[dofs_per_node * node + d] = true;
                    }
                }
            }
            EdgeRestraint::Pinned | EdgeRestraint::RollerX | EdgeRestraint::RollerY => {
                locked[dofs_per_node * edge.a] = true;
                locked[dofs_per_node * edge.b] = true;
            }
            EdgeRestraint::Free | EdgeRestraint::Pressure => {}
        }
    }
    locked
}

/// Computes the pressure-traction totals per tagged boundary edge and
/// hands `(a, b, (fx, fy))` to the caller's distributor (consistent nodal
/// loads along the outward normal; `p > 0` pushes inward).
fn apply_pressure_edges(
    spec: &Fem2dSpec,
    mesh: &TriMesh,
    vertices: &[[f64; 2]],
    distribute: &mut dyn FnMut(usize, usize, (f64, f64), &mut [f64]),
    force: &mut [f64],
) {
    if spec.edge_pressure.abs() <= f64::EPSILON {
        return;
    }
    let mut adjacent: BTreeMap<(usize, usize), usize> = BTreeMap::new();
    for t in &mesh.triangles {
        for k in 0..3 {
            let key = rdm_mesh::cdt::edge_key(t[k], t[(k + 1) % 3]);
            adjacent.entry(key).or_insert(t[(k + 2) % 3]);
        }
    }
    for edge in &mesh.boundary_edges {
        let Some(restraint) = spec.edge_restraints.get(edge.source) else {
            continue;
        };
        if *restraint != EdgeRestraint::Pressure {
            continue;
        }
        let (a, b) = (vertices[edge.a], vertices[edge.b]);
        let length = ((b[0] - a[0]).powi(2) + (b[1] - a[1]).powi(2)).sqrt();
        if length <= f64::EPSILON {
            continue;
        }
        let mut nx = (b[1] - a[1]) / length;
        let mut ny = -(b[0] - a[0]) / length;
        if let Some(c) = adjacent
            .get(&rdm_mesh::cdt::edge_key(edge.a, edge.b))
            .copied()
        {
            let mid_to_c = [
                vertices[c][0] - (a[0] + b[0]) / 2.0,
                vertices[c][1] - (a[1] + b[1]) / 2.0,
            ];
            if nx * mid_to_c[0] + ny * mid_to_c[1] > 0.0 {
                nx = -nx;
                ny = -ny;
            }
        }
        // Outward unit normal (n). p > 0 pushes inward: −p·t·L/2·n total
        // per edge endpoint pair (the distributor splits it).
        let fx = -spec.edge_pressure * spec.thickness * length / 2.0 * nx;
        let fy = -spec.edge_pressure * spec.thickness * length / 2.0 * ny;
        distribute(edge.a, edge.b, (fx, fy), force);
    }
}

/// Point loads attached to the nearest mesh node (plane DOFs).
fn apply_point_loads_plane(
    spec: &Fem2dSpec,
    vertices: &[[f64; 2]],
    force: &mut [f64],
    dofs_per_node: usize,
) {
    for load in &spec.point_loads {
        if let Some(node) = nearest_node(vertices, [load.x, load.y]) {
            force[dofs_per_node * node] += load.fx;
            force[dofs_per_node * node + 1] += load.fy;
        }
    }
}

/// Nearest vertex index to `p`.
fn nearest_node(vertices: &[[f64; 2]], p: [f64; 2]) -> Option<usize> {
    let mut best = None;
    let mut best_d2 = f64::INFINITY;
    for (i, v) in vertices.iter().enumerate() {
        let d2 = (v[0] - p[0]).powi(2) + (v[1] - p[1]).powi(2);
        if d2 < best_d2 {
            best_d2 = d2;
            best = Some(i);
        }
    }
    best
}

/// Reduces, factorizes (sparse `LLᵀ`) and solves the global system.
fn solve_system(
    triplets: Vec<Triplet<usize, usize, f64>>,
    force: Vec<f64>,
    locked: Vec<bool>,
    ndof: usize,
) -> Result<Vec<f64>, Fem2dError> {
    let free: Vec<usize> = (0..ndof).filter(|&d| !locked[d]).collect();
    let mut free_index = vec![usize::MAX; ndof];
    for (slot, &dof) in free.iter().enumerate() {
        free_index[dof] = slot;
    }
    let mut reduced: Vec<Triplet<usize, usize, f64>> = Vec::new();
    for t in &triplets {
        let (i, j, v) = (t.row, t.col, t.val);
        if locked[i] || locked[j] || i > j {
            continue;
        }
        let (fi, fj) = (free_index[i], free_index[j]);
        if fi == usize::MAX || fj == usize::MAX || fi > fj {
            continue;
        }
        reduced.push(Triplet::new(fi, fj, v));
    }
    let n_free = free.len();
    if n_free == 0 {
        return Err(Fem2dError::Unstable {
            message: "every DOF is restrained — no free system to solve".to_owned(),
        });
    }
    let matrix = SparseColMat::<usize, f64>::try_new_from_triplets(n_free, n_free, &reduced)
        .map_err(|e| Fem2dError::Sparse {
            message: e.to_string(),
        })?;
    let symbolic =
        SymbolicLlt::try_new(matrix.symbolic(), Side::Upper).map_err(|e| Fem2dError::Unstable {
            message: format!("symbolic factorization failed: {e}"),
        })?;
    let llt = Llt::try_new_with_symbolic(symbolic, matrix.as_ref(), Side::Upper).map_err(|e| {
        Fem2dError::Unstable {
            message: format!("the restrained model is unstable ({e})"),
        }
    })?;
    let mut rhs = faer::Mat::<f64>::zeros(n_free, 1);
    for (slot, &dof) in free.iter().enumerate() {
        rhs[(slot, 0)] = force[dof];
    }
    llt.solve_in_place(&mut rhs);
    let mut dof_values = vec![0.0_f64; ndof];
    for (slot, &dof) in free.iter().enumerate() {
        dof_values[dof] = rhs[(slot, 0)];
    }
    Ok(dof_values)
}

// --- Small dense helpers ---------------------------------------------------

/// `Bᵀ·D·B` for a flattened row-major `B` (rows×cols) and a flattened
/// row-major square `D` (rows×rows).
fn mat_t_d_mat(b: &[f64], rows: usize, cols: usize, d: &[f64], scale: f64) -> Vec<f64> {
    let mut db = vec![0.0_f64; rows * cols];
    for r in 0..rows {
        for c in 0..cols {
            let mut acc = 0.0;
            for k in 0..rows {
                acc += d[r * rows + k] * b[k * cols + c];
            }
            db[r * cols + c] = acc;
        }
    }
    let mut out = vec![0.0_f64; cols * cols];
    for i in 0..cols {
        for j in 0..cols {
            let mut acc = 0.0;
            for r in 0..rows {
                acc += b[r * cols + i] * db[r * cols + j];
            }
            out[i * cols + j] = acc * scale;
        }
    }
    out
}

/// Copies a row-major dense product into an `SMatrix` (column-major).
fn dense_to_smatrix<const N: usize>(dense: &[f64]) -> nalgebra::SMatrix<f64, N, N> {
    let mut out = nalgebra::SMatrix::<f64, N, N>::zeros();
    for r in 0..N {
        for c in 0..N {
            out[(r, c)] = dense[r * N + c];
        }
    }
    out
}

/// Accumulates a row-major dense product into an `SMatrix` (column-major).
fn accumulate<const N: usize>(ke: &mut nalgebra::SMatrix<f64, N, N>, dense: &[f64]) {
    for r in 0..N {
        for c in 0..N {
            ke[(r, c)] += dense[r * N + c];
        }
    }
}

/// Flattens a 3×9 row-major matrix.
fn flatten3x9(m: &[[f64; 9]; 3]) -> Vec<f64> {
    m.iter().flat_map(|r| r.iter().copied()).collect()
}

/// `D·v` for a 3×3 matrix and a 3-vector.
fn mat3_vec3(d: &[[f64; 3]; 3], v: &[f64]) -> [f64; 3] {
    let mut out = [0.0_f64; 3];
    for (r, o) in out.iter_mut().enumerate() {
        *o = d[r][0] * v[0] + d[r][1] * v[1] + d[r][2] * v[2];
    }
    out
}

/// `B·u` for a flattened row-major `B` (rows×n) and a vector of length n.
fn mat_rows_vec(b: &[f64], rows: usize, u: &[f64]) -> [f64; 3] {
    let mut out = [0.0_f64; 3];
    for (r, o) in out.iter_mut().enumerate().take(rows) {
        *o = b[r * u.len()..(r + 1) * u.len()]
            .iter()
            .zip(u.iter())
            .map(|(a, c)| a * c)
            .sum();
    }
    out
}

/// Principal stresses `(σ1, σ2, θp rad)` in 2D.
fn principal_2d(sx: f64, sy: f64, txy: f64) -> (f64, f64, f64) {
    let mean = (sx + sy) / 2.0;
    let radius = (((sx - sy) / 2.0).powi(2) + txy * txy).sqrt();
    let theta = 0.5 * txy.atan2(sx - sy);
    (mean + radius, mean - radius, theta)
}

/// Von Mises equivalent stress with optional plane-strain `σzz` coupling.
fn von_mises_plane(sx: f64, sy: f64, txy: f64, sigma_z_factor: f64) -> f64 {
    let sz = sigma_z_factor * (sx + sy);
    (((sx - sy).powi(2) + (sy - sz).powi(2) + (sz - sx).powi(2) + 6.0 * txy * txy) / 2.0).sqrt()
}
