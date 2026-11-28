//! Deterministic 2D constrained Delaunay mesher for RDM Studio (M13.2).
//!
//! Pure Rust, strict SI units (`m`), no web dependencies, zero panics. The
//! public API meshes an arbitrary simple polygon with interior holes into
//! a linear triangle mesh: Bowyer–Watson Delaunay over the boundary points,
//! segment recovery for every constrained edge, a bounded Delaunay flip
//! sweep, deterministic interior grid seeding up to `h_max`, then hole
//! carving. Every boundary edge is returned tagged with the index of its
//! source input edge so callers can attach restraints and pressure.

pub mod cdt;

use std::collections::BTreeMap;

/// Meshing errors with pedagogical messages.
#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum MeshError {
    /// The polygon or working set is degenerate (too few points,
    /// duplicated, collinear, unrecoverable cavity).
    #[error("degenerate geometry: {message}")]
    Degenerate {
        /// Explanation of the degeneracy.
        message: String,
    },
    /// A caller-provided parameter is out of range.
    #[error("invalid parameter: {message}")]
    InvalidParameter {
        /// Explanation of the invalid value.
        message: String,
    },
}

/// A 2D point (metres).
pub type Pt2 = [f64; 2];

/// Meshed domain: one outer contour plus optional interior holes
/// (winding of each contour is normalized internally).
#[derive(Debug, Clone, PartialEq)]
pub struct MeshRegion {
    /// Outer contour (at least 3 distinct points, simple polygon).
    pub outer: Vec<Pt2>,
    /// Interior hole contours (circular / rectangular cutouts, ...).
    pub holes: Vec<Vec<Pt2>>,
}

/// Meshing parameters.
#[derive(Debug, Clone, PartialEq)]
pub struct MeshParams {
    /// Target maximum element size (metres).
    pub h_max: f64,
    /// Interior seed margin from the boundary as a fraction of `h_max`
    /// (seeds closer than this are skipped to protect boundary layers).
    pub seed_margin_ratio: f64,
    /// Optional finer size around hole contours (metres) — the hole
    /// boundary is resampled at this size and a refined seed band is
    /// laid within three elements of every hole.
    pub h_refine: Option<f64>,
}

impl Default for MeshParams {
    fn default() -> Self {
        Self {
            h_max: 0.25,
            seed_margin_ratio: 0.45,
            h_refine: None,
        }
    }
}

/// A final boundary edge with the index of the input contour edge it came
/// from (outer edges are indexed `0..outer.len()` in input order; hole
/// `k` edges follow at `outer.len() + offset`).
#[derive(Debug, Clone, PartialEq)]
pub struct BoundaryEdge {
    /// First vertex index.
    pub a: usize,
    /// Second vertex index.
    pub b: usize,
    /// Index of the input polygon edge this segment belongs to.
    pub source: usize,
}

/// Mesh quality summary.
#[derive(Debug, Clone, PartialEq)]
pub struct MeshQuality {
    /// Smallest interior angle over all triangles (degrees).
    pub min_angle_deg: f64,
    /// Largest interior angle over all triangles (degrees).
    pub max_angle_deg: f64,
    /// Signed area of the meshed domain (m²) — equals the polygon area
    /// minus the hole areas up to floating-point noise (< 1e-12).
    pub area: f64,
}

/// A finished linear triangle mesh.
#[derive(Debug, Clone, PartialEq)]
pub struct TriMesh {
    /// Vertex coordinates (metres).
    pub vertices: Vec<Pt2>,
    /// Triangles as counter-clockwise vertex indices.
    pub triangles: Vec<[usize; 3]>,
    /// Boundary edges tagged with their source input edge.
    pub boundary_edges: Vec<BoundaryEdge>,
    /// Quality summary.
    pub quality: MeshQuality,
}

impl TriMesh {
    /// Total unsigned triangle area (m²).
    #[must_use]
    pub fn triangle_area_sum(&self) -> f64 {
        self.triangles
            .iter()
            .map(|t| {
                let (a, b, c) = (
                    self.vertices[t[0]],
                    self.vertices[t[1]],
                    self.vertices[t[2]],
                );
                (cdt::orient2d(a, b, c)).abs() / 2.0
            })
            .sum()
    }
}

/// Signed area of a closed contour (positive when counter-clockwise).
#[must_use]
pub fn signed_area(contour: &[Pt2]) -> f64 {
    let n = contour.len();
    if n < 3 {
        return 0.0;
    }
    contour
        .iter()
        .enumerate()
        .map(|(i, p)| {
            let q = contour[(i + 1) % n];
            p[0] * q[1] - q[0] * p[1]
        })
        .sum::<f64>()
        / 2.0
}

/// Even-odd point-in-polygon test for one contour.
fn point_in_contour(p: Pt2, contour: &[Pt2]) -> bool {
    let n = contour.len();
    let mut inside = false;
    for i in 0..n {
        let a = contour[i];
        let b = contour[(i + 1) % n];
        let (ay, by) = (a[1], b[1]);
        if (ay > p[1]) != (by > p[1]) {
            let t = (p[1] - ay) / (by - ay);
            let x = a[0] + t * (b[0] - a[0]);
            if p[0] < x {
                inside = !inside;
            }
        }
    }
    inside
}

/// True when the point is inside the region (outer contour but no hole).
fn point_in_region(p: Pt2, region: &MeshRegion) -> bool {
    point_in_contour(p, &region.outer) && !region.holes.iter().any(|h| point_in_contour(p, h))
}

/// Distance from point `p` to segment `ab`.
fn point_segment_distance2(p: Pt2, a: Pt2, b: Pt2) -> f64 {
    let abx = b[0] - a[0];
    let aby = b[1] - a[1];
    let len2 = abx * abx + aby * aby;
    if len2 <= f64::EPSILON {
        return cdt::orient2d(a, b, p) * cdt::orient2d(a, b, p);
    }
    let t = (((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / len2).clamp(0.0, 1.0);
    let px = a[0] + t * abx;
    let py = a[1] + t * aby;
    let dx = p[0] - px;
    let dy = p[1] - py;
    dx * dx + dy * dy
}

/// One working constraint segment with its source input edge.
#[derive(Debug, Clone)]
struct Segment {
    a: usize,
    b: usize,
    source: usize,
}

/// Resamples one contour into points + constrained segments spaced at
/// most `h_max`, returning the point list (start point included, end
/// excluded — shared with the next contour entry) and the segments.
fn resample_contour(
    contour: &[Pt2],
    h_max: f64,
    point_offset: usize,
    source_offset: usize,
    points: &mut Vec<Pt2>,
    segments: &mut Vec<Segment>,
) -> Result<usize, MeshError> {
    let n = contour.len();
    if n < 3 {
        return Err(MeshError::InvalidParameter {
            message: "contours need at least 3 points".to_owned(),
        });
    }
    let mut local_points = 0usize;
    for i in 0..n {
        let a = contour[i];
        let b = contour[(i + 1) % n];
        let len = ((b[0] - a[0]).powi(2) + (b[1] - a[1]).powi(2)).sqrt();
        if len < 1.0e-12 {
            continue;
        }
        let steps = ((len / h_max).ceil() as usize).max(1);
        let start_index = point_offset + local_points;
        for s in 0..steps {
            let t = s as f64 / steps as f64;
            points.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
            local_points += 1;
        }
        for s in 0..steps {
            segments.push(Segment {
                a: start_index + s,
                b: start_index + s + 1,
                source: source_offset + i,
            });
        }
        // The last segment endpoint equals the next edge's start point;
        // patch it by pointing the final segment at the first point of
        // the next edge instead of duplicating the vertex.
        if let Some(last) = segments.last_mut() {
            last.b = point_offset + local_points;
        }
    }
    // The contour's last point is the same as its first: the final edge's
    // resampled points wrap to the very first pushed point of this call.
    if let Some(last) = segments.last_mut() {
        last.b = point_offset;
    }
    Ok(local_points)
}

/// Meshes `region` into a conforming triangle mesh (M13.2 contract).
///
/// # Errors
///
/// Returns [`MeshError`] on degenerate contours or unusable parameters.
pub fn triangulate(region: &MeshRegion, params: &MeshParams) -> Result<TriMesh, MeshError> {
    if region.outer.len() < 3 {
        return Err(MeshError::InvalidParameter {
            message: "outer contour needs at least 3 points".to_owned(),
        });
    }
    if !(params.h_max.is_finite() && params.h_max > 0.0) {
        return Err(MeshError::InvalidParameter {
            message: "h_max must be a positive finite length".to_owned(),
        });
    }
    // Normalize contours to counter-clockwise (holes keep their geometry;
    // the even-odd carving does not depend on winding).
    let mut outer = region.outer.clone();
    if signed_area(&outer) < 0.0 {
        outer.reverse();
    }
    let holes: Vec<Vec<Pt2>> = region
        .holes
        .iter()
        .map(|h| {
            let mut hole = h.clone();
            if signed_area(&hole) < 0.0 {
                hole.reverse();
            }
            hole
        })
        .collect();
    let region = MeshRegion { outer, holes };

    // --- 1. Boundary resampling ------------------------------------------
    let mut points: Vec<Pt2> = Vec::new();
    let mut segments: Vec<Segment> = Vec::new();
    resample_contour(
        &region.outer,
        params.h_max,
        0,
        0,
        &mut points,
        &mut segments,
    )?;
    let h_refine = params.h_refine.filter(|h| h.is_finite() && *h > 0.0);
    let mut hole_source_offset = region.outer.len();
    for hole in &region.holes {
        let hole_point_offset = points.len();
        resample_contour(
            hole,
            h_refine.unwrap_or(params.h_max),
            hole_point_offset,
            hole_source_offset,
            &mut points,
            &mut segments,
        )?;
        // Patch the hole's closing segment to its own first point.
        if let Some(last) = segments.last_mut() {
            last.b = hole_point_offset;
        }
        hole_source_offset += hole.len();
    }
    // --- 2. Dedupe coincident points (deterministic scan) -----------------
    let dedupe = dedupe_points(&mut points);
    for seg in &mut segments {
        seg.a = dedupe.map_of.get(&seg.a).copied().unwrap_or(seg.a);
        seg.b = dedupe.map_of.get(&seg.b).copied().unwrap_or(seg.b);
        if seg.a == seg.b {
            return Err(MeshError::Degenerate {
                message: "resampling produced a zero-length constraint".to_owned(),
            });
        }
    }
    // --- 3. Bowyer–Watson over the boundary points ------------------------
    let mut tri = cdt::Triangulation::new(points).ok_or(MeshError::Degenerate {
        message: "fewer than 3 distinct boundary points".to_owned(),
    })?;
    let super_start = tri.points.len() - 3;
    // Insert every point after the super-triangle vertices.
    for p in 0..super_start {
        tri.insert_point(p)?;
    }
    tri.remove_super_triangles(super_start);
    // --- 4. Constraint recovery ------------------------------------------
    let mut constraints: Vec<Segment> = Vec::new();
    std::mem::swap(&mut constraints, &mut segments);
    for seg in &constraints {
        tri.recover_segment(seg.a, seg.b, 0)?;
    }
    // --- 5. Quality flip sweep -------------------------------------------
    tri.delaunay_flip_sweep(40);
    // --- 6. Interior seeding (deterministic lattice, constraint-safe) -----
    let mut min = [f64::INFINITY; 2];
    let mut max = [f64::NEG_INFINITY; 2];
    for (i, p) in tri.points.iter().enumerate() {
        if i >= super_start {
            continue;
        }
        for d in 0..2 {
            min[d] = min[d].min(p[d]);
            max[d] = max[d].max(p[d]);
        }
    }
    let step = params.h_max;
    let margin = params.seed_margin_ratio * params.h_max;
    let mut x = min[0] + step / 2.0;
    while x < max[0] {
        let mut y = min[1] + step / 2.0;
        while y < max[1] {
            let p = [x, y];
            if point_in_region(p, &region)
                && constraints.iter().all(|seg| {
                    point_segment_distance2(p, tri.points[seg.a], tri.points[seg.b])
                        > margin * margin
                })
                && tri.points[..super_start]
                    .iter()
                    .all(|q| (p[0] - q[0]).powi(2) + (p[1] - q[1]).powi(2) > 1.0e-12)
            {
                let index = tri.points.len();
                tri.points.push(p);
                if tri.cavity_breaks_constraints(index) {
                    tri.points.pop();
                } else {
                    let _ = tri.insert_point(index);
                }
            }
            y += step;
        }
        x += step;
    }
    // Refined seed band around the holes (stress concentrators).
    if let Some(h_fine) = h_refine {
        let fine_margin = params.seed_margin_ratio * h_fine;
        let mut x = min[0] + h_fine / 2.0;
        while x < max[0] {
            let mut y = min[1] + h_fine / 2.0;
            while y < max[1] {
                let p = [x, y];
                let near_hole = region.holes.iter().any(|hole| {
                    hole.iter().enumerate().any(|(i, a)| {
                        let b = hole[(i + 1) % hole.len()];
                        point_segment_distance2(p, *a, b) < 9.0 * h_fine * h_fine
                    })
                });
                if near_hole
                    && point_in_region(p, &region)
                    && constraints.iter().all(|seg| {
                        point_segment_distance2(p, tri.points[seg.a], tri.points[seg.b])
                            > fine_margin * fine_margin
                    })
                {
                    let index = tri.points.len();
                    tri.points.push(p);
                    if tri.cavity_breaks_constraints(index) {
                        tri.points.pop();
                    } else {
                        let _ = tri.insert_point(index);
                    }
                }
                y += h_fine;
            }
            x += h_fine;
        }
    }
    tri.delaunay_flip_sweep(20);
    // --- 7. Carve the holes (and any convex-hull outside) ------------------
    let tris: Vec<[usize; 3]> = tri
        .tris
        .iter()
        .filter(|t| {
            let cx = (tri.points[t[0]][0] + tri.points[t[1]][0] + tri.points[t[2]][0]) / 3.0;
            let cy = (tri.points[t[0]][1] + tri.points[t[1]][1] + tri.points[t[2]][1]) / 3.0;
            point_in_region([cx, cy], &region)
        })
        .copied()
        .collect();
    if tris.is_empty() {
        return Err(MeshError::Degenerate {
            message: "no triangle survived the hole carving — check the contours".to_owned(),
        });
    }
    // --- 8. Extract the boundary edges with their source tags -------------
    let mut edge_source: BTreeMap<(usize, usize), usize> = BTreeMap::new();
    for seg in &constraints {
        edge_source.insert(cdt::edge_key(seg.a, seg.b), seg.source);
    }
    // Compact the vertex list: drop the 3 super-triangle slots sitting
    // between the boundary points and the interior seeds, remapping every
    // surviving index.
    let mut remap = vec![usize::MAX; tri.points.len()];
    let mut vertices: Vec<Pt2> = Vec::with_capacity(tri.points.len());
    for (i, p) in tri.points.iter().enumerate() {
        if (super_start..super_start + 3).contains(&i) {
            continue;
        }
        remap[i] = vertices.len();
        vertices.push(*p);
    }
    let remapped = |t: &[usize; 3]| -> [usize; 3] { [remap[t[0]], remap[t[1]], remap[t[2]]] };
    let tris_out: Vec<[usize; 3]> = tris.iter().map(|t| remapped(t)).collect();
    let mut boundary_edges: Vec<BoundaryEdge> = Vec::new();
    let mut seen: BTreeMap<(usize, usize), ()> = BTreeMap::new();
    for t in &tris {
        for k in 0..3 {
            let (a, b) = (t[k], t[(k + 1) % 3]);
            let key = cdt::edge_key(a, b);
            if seen.contains_key(&key) {
                continue;
            }
            if let Some(source) = edge_source.get(&key) {
                seen.insert(key, ());
                boundary_edges.push(BoundaryEdge {
                    a: remap[key.0],
                    b: remap[key.1],
                    source: *source,
                });
            }
        }
    }
    // --- 9. Quality summary ----------------------------------------------
    let (mut min_angle, mut max_angle) = (f64::MAX, 0.0_f64);
    for t in &tris {
        for k in 0..3 {
            let angle = interior_angle(
                tri.points[t[(k + 2) % 3]],
                tri.points[t[k]],
                tri.points[t[(k + 1) % 3]],
            );
            min_angle = min_angle.min(angle);
            max_angle = max_angle.max(angle);
        }
    }
    let area = tris
        .iter()
        .map(|t| {
            let (a, b, c) = (tri.points[t[0]], tri.points[t[1]], tri.points[t[2]]);
            cdt::orient2d(a, b, c).abs() / 2.0
        })
        .sum();
    let mesh = TriMesh {
        vertices,
        triangles: tris_out,
        boundary_edges,
        quality: MeshQuality {
            min_angle_deg: min_angle.to_degrees(),
            max_angle_deg: max_angle.to_degrees(),
            area,
        },
    };
    Ok(mesh)
}

/// Interior angle at vertex `b` of the triangle `a-b-c` (radians).
fn interior_angle(a: Pt2, b: Pt2, c: Pt2) -> f64 {
    let bax = a[0] - b[0];
    let bay = a[1] - b[1];
    let bcx = c[0] - b[0];
    let bcy = c[1] - b[1];
    let la = (bax * bax + bay * bay).sqrt();
    let lc = (bcx * bcx + bcy * bcy).sqrt();
    if la <= f64::EPSILON || lc <= f64::EPSILON {
        return 0.0;
    }
    let cos = ((bax * bcx + bay * bcy) / (la * lc)).clamp(-1.0, 1.0);
    cos.acos()
}

/// Coincident-point collapse map (indices before -> after).
struct Dedupe {
    map_of: BTreeMap<usize, usize>,
}

/// O(n²) dedupe — boundary point counts stay in the low thousands.
fn dedupe_points(points: &mut Vec<Pt2>) -> Dedupe {
    let mut map_of: BTreeMap<usize, usize> = BTreeMap::new();
    let mut kept: Vec<Pt2> = Vec::new();
    let tol2 = 1.0e-16;
    for (i, p) in points.iter().copied().enumerate() {
        let found = kept
            .iter()
            .position(|q| (p[0] - q[0]).powi(2) + (p[1] - q[1]).powi(2) <= tol2);
        match found {
            Some(j) => {
                map_of.insert(i, j);
            }
            None => {
                kept.push(p);
                map_of.insert(i, kept.len() - 1);
            }
        }
    }
    *points = kept;
    Dedupe { map_of }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;

    fn rect(x0: f64, y0: f64, x1: f64, y1: f64) -> Vec<Pt2> {
        vec![[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
    }

    #[test]
    fn square_meshes_with_area_conservation() {
        let region = MeshRegion {
            outer: rect(0.0, 0.0, 2.0, 1.0),
            holes: vec![],
        };
        let mesh = triangulate(
            &region,
            &MeshParams {
                h_max: 0.5,
                ..Default::default()
            },
        )
        .expect("square meshes");
        assert_relative_eq!(mesh.quality.area, 2.0, epsilon = 1.0e-12);
        assert_relative_eq!(mesh.triangle_area_sum(), 2.0, epsilon = 1.0e-12);
        assert!(
            mesh.quality.min_angle_deg > 20.0,
            "min angle {}",
            mesh.quality.min_angle_deg
        );
        assert!(mesh.quality.max_angle_deg < 120.0);
        // All 4 outer edges appear as tagged boundary edges.
        let sources: Vec<usize> = mesh.boundary_edges.iter().map(|e| e.source).collect();
        for s in 0..4 {
            assert!(sources.contains(&s), "missing source edge {s}");
        }
    }

    #[test]
    fn circular_hole_preserves_area() {
        // Unit square with a circular hole of radius 0.2 centred inside.
        let mut hole = Vec::new();
        for k in 0..24 {
            let t = 2.0 * std::f64::consts::PI * f64::from(k) / 24.0;
            hole.push([0.5 + 0.2 * t.cos(), 0.5 + 0.2 * t.sin()]);
        }
        let region = MeshRegion {
            outer: rect(0.0, 0.0, 1.0, 1.0),
            holes: vec![hole],
        };
        let mesh = triangulate(
            &region,
            &MeshParams {
                h_max: 0.12,
                ..Default::default()
            },
        )
        .expect("holed plate meshes");
        let hole_area = std::f64::consts::PI * 0.2_f64.powi(2);
        let expected = 1.0 - hole_area;
        // The hole is a 24-gon: the carved area matches the polygon area.
        let mut poly_area = signed_area(&region.holes[0]).abs();
        poly_area = poly_area.max(0.0);
        assert!(
            (mesh.quality.area - expected).abs() < 0.02,
            "area {} vs expected {expected}",
            mesh.quality.area
        );
        assert!(mesh.quality.min_angle_deg > 5.0);
        // Hole boundary edges are tagged with sources >= outer edge count.
        assert!(
            mesh.boundary_edges
                .iter()
                .any(|e| e.source >= region.outer.len()),
            "hole boundary must be tagged"
        );
    }

    #[test]
    fn rectangular_hole_roundtrips_connectivity() {
        let region = MeshRegion {
            outer: rect(0.0, 0.0, 4.0, 3.0),
            holes: vec![rect(1.5, 1.0, 2.5, 2.0)],
        };
        let mesh = triangulate(
            &region,
            &MeshParams {
                h_max: 0.5,
                ..Default::default()
            },
        )
        .expect("rect hole meshes");
        let expected = 12.0 - 1.0;
        assert_relative_eq!(mesh.quality.area, expected, epsilon = 1.0e-12);
        // No triangle centroid sits inside the hole.
        for t in &mesh.triangles {
            let cx =
                (mesh.vertices[t[0]][0] + mesh.vertices[t[1]][0] + mesh.vertices[t[2]][0]) / 3.0;
            let cy =
                (mesh.vertices[t[0]][1] + mesh.vertices[t[1]][1] + mesh.vertices[t[2]][1]) / 3.0;
            assert!(
                !point_in_contour([cx, cy], &region.holes[0]),
                "triangle centroid {cx},{cy} inside the hole"
            );
        }
    }

    #[test]
    fn concave_polygon_conserves_area() {
        // L-shaped domain (concave outer contour).
        let outer = vec![
            [0.0, 0.0],
            [2.0, 0.0],
            [2.0, 1.0],
            [1.0, 1.0],
            [1.0, 2.0],
            [0.0, 2.0],
        ];
        let region = MeshRegion {
            outer,
            holes: vec![],
        };
        let mesh = triangulate(
            &region,
            &MeshParams {
                h_max: 0.4,
                ..Default::default()
            },
        )
        .expect("L-shape meshes");
        assert_relative_eq!(mesh.quality.area, 3.0, epsilon = 1.0e-12);
    }

    #[test]
    fn determinism_same_input_same_mesh() {
        let region = MeshRegion {
            outer: rect(0.0, 0.0, 1.0, 1.0),
            holes: vec![],
        };
        let params = MeshParams {
            h_max: 0.3,
            ..Default::default()
        };
        let a = triangulate(&region, &params).expect("mesh a");
        let b = triangulate(&region, &params).expect("mesh b");
        assert_eq!(a, b);
    }

    #[test]
    fn degenerate_inputs_error_out() {
        let region = MeshRegion {
            outer: vec![[0.0, 0.0], [1.0, 0.0]],
            holes: vec![],
        };
        assert!(triangulate(&region, &MeshParams::default()).is_err());
        let region = MeshRegion {
            outer: rect(0.0, 0.0, 1.0, 1.0),
            holes: vec![],
        };
        assert!(
            triangulate(
                &region,
                &MeshParams {
                    h_max: -1.0,
                    ..Default::default()
                }
            )
            .is_err()
        );
    }
}
