//! Constrained Delaunay triangulation core (M13.2).
//!
//! Deterministic Bowyer–Watson insertion over a super-triangle, followed by
//! segment recovery through cavity retriangulation (walk + ear clipping) and
//! a bounded Delaunay flip sweep that respects constrained edges. Zero
//! panics: every degenerate input surfaces as a typed [`MeshError`].

use std::collections::BTreeMap;

use crate::MeshError;

/// One triangle as three vertex indices (normalized counter-clockwise).
pub type Tri = [usize; 3];

/// Relative geometric tolerance for orientation/on-segment predicates.
const GEOM_TOL: f64 = 1.0e-9;

/// Robust-ish 2D orientation predicate (`> 0` when `c` is left of `ab`).
pub fn orient2d(a: [f64; 2], b: [f64; 2], c: [f64; 2]) -> f64 {
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

/// Squared distance between two points.
fn dist2(a: [f64; 2], b: [f64; 2]) -> f64 {
    let dx = a[0] - b[0];
    let dy = a[1] - b[1];
    dx * dx + dy * dy
}

/// Circumcircle test: `true` when `p` lies strictly inside the circle
/// through `a, b, c` (relative epsilon treats near-cocircular ties as out).
pub(crate) fn in_circumcircle(a: [f64; 2], b: [f64; 2], c: [f64; 2], p: [f64; 2]) -> bool {
    let ax = a[0] - p[0];
    let ay = a[1] - p[1];
    let bx = b[0] - p[0];
    let by = b[1] - p[1];
    let cx = c[0] - p[0];
    let cy = c[1] - p[1];
    let det = ax * (by * (cx * cx + cy * cy) - cy * (bx * bx + by * by))
        - ay * (bx * (cx * cx + cy * cy) - cx * (bx * bx + by * by))
        + (ax * ax + ay * ay) * (bx * cy - by * cx);
    let scale = (ax.abs() + ay.abs() + bx.abs() + by.abs() + cx.abs() + cy.abs()).powi(4);
    let area = orient2d(a, b, c);
    if area > 0.0 {
        det > scale * 1.0e-14
    } else {
        det < -scale * 1.0e-14
    }
}

/// True when the point sits on segment `ab` within a relative tolerance.
pub(crate) fn point_on_segment(p: [f64; 2], a: [f64; 2], b: [f64; 2]) -> bool {
    let abx = b[0] - a[0];
    let aby = b[1] - a[1];
    let len2 = abx * abx + aby * aby;
    if len2 <= f64::EPSILON {
        return false;
    }
    let t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / len2;
    if !(-GEOM_TOL..=1.0 + GEOM_TOL).contains(&t) {
        return false;
    }
    let px = a[0] + t * abx;
    let py = a[1] + t * aby;
    dist2(p, [px, py]) <= GEOM_TOL * GEOM_TOL * len2
}

/// Proper crossing test of the OPEN segment `pq` against segment `ab`:
/// interiors overlap, or `pq` passes strictly through `a` or `b`.
pub(crate) fn segments_cross(p: [f64; 2], q: [f64; 2], a: [f64; 2], b: [f64; 2]) -> bool {
    if dist2(p, q) <= f64::EPSILON {
        return false;
    }
    let ends_eps = GEOM_TOL * GEOM_TOL * dist2(p, q);
    let a_touches = point_on_segment(a, p, q) && dist2(a, p) > ends_eps && dist2(a, q) > ends_eps;
    let b_touches = point_on_segment(b, p, q) && dist2(b, p) > ends_eps && dist2(b, q) > ends_eps;
    if a_touches || b_touches {
        return true;
    }
    let d1 = orient2d(p, q, a);
    let d2 = orient2d(p, q, b);
    if !((d1 > 0.0 && d2 < 0.0) || (d1 < 0.0 && d2 > 0.0)) {
        return false;
    }
    let d3 = orient2d(a, b, p);
    let d4 = orient2d(a, b, q);
    (d3 > 0.0 && d4 < 0.0) || (d3 < 0.0 && d4 > 0.0)
}

/// Open key of an undirected edge.
pub fn edge_key(a: usize, b: usize) -> (usize, usize) {
    if a <= b { (a, b) } else { (b, a) }
}

/// Strict-inside triangle test with a relative epsilon.
pub(crate) fn point_in_triangle(p: [f64; 2], a: [f64; 2], b: [f64; 2], c: [f64; 2]) -> bool {
    let d1 = orient2d(a, b, p);
    let d2 = orient2d(b, c, p);
    let d3 = orient2d(c, a, p);
    let scale = (a[0].abs() + a[1].abs() + b[0].abs() + b[1].abs() + c[0].abs() + c[1].abs())
        .powi(2)
        * 1.0e-14;
    d1 > scale && d2 > scale && d3 > scale
}

/// A live triangulation of the working point set (super-triangle included).
pub(crate) struct Triangulation {
    pub points: Vec<[f64; 2]>,
    pub tris: Vec<Tri>,
    /// Constrained edges that retriangulation must never delete.
    pub constrained: BTreeMap<(usize, usize), ()>,
}

impl Triangulation {
    /// Builds the super-triangle sized well beyond the working bounds.
    pub(crate) fn new(points: Vec<[f64; 2]>) -> Option<Self> {
        if points.len() < 3 {
            return None;
        }
        let mut min = [f64::INFINITY; 2];
        let mut max = [f64::NEG_INFINITY; 2];
        for p in &points {
            for d in 0..2 {
                min[d] = min[d].min(p[d]);
                max[d] = max[d].max(p[d]);
            }
        }
        if (max[0] - min[0]).max(max[1] - min[1]) <= f64::EPSILON {
            return None;
        }
        let cx = (min[0] + max[0]) / 2.0;
        let cy = (min[1] + max[1]) / 2.0;
        let d = (max[0] - min[0]).max(max[1] - min[1]) * 40.0 + 10.0;
        let mut points = points;
        let s0 = points.len();
        points.push([cx - d, cy - d]);
        let s1 = points.len();
        points.push([cx + d, cy - d]);
        let s2 = points.len();
        points.push([cx, cy + d]);
        let tris = vec![normalize([s0, s1, s2], &points)];
        Some(Self {
            points,
            tris,
            constrained: BTreeMap::new(),
        })
    }

    /// Indices of triangles whose circumcircle contains `p` (brute force —
    /// meshes stay in the low thousands of triangles by design).
    fn bad_triangles(&self, p: usize) -> Vec<usize> {
        let pt = self.points[p];
        self.tris
            .iter()
            .enumerate()
            .filter(|(_, t)| {
                in_circumcircle(self.points[t[0]], self.points[t[1]], self.points[t[2]], pt)
            })
            .map(|(i, _)| i)
            .collect()
    }

    /// Cavity boundary of the bad set: undirected edges owned by exactly
    /// one bad triangle, plus the vertex adjacency used to order the loop.
    fn cavity_boundary(&self, bad: &[usize]) -> CavityBoundary {
        let mut owners: BTreeMap<(usize, usize), usize> = BTreeMap::new();
        for &t in bad {
            for k in 0..3 {
                let a = self.tris[t][k];
                let b = self.tris[t][(k + 1) % 3];
                *owners.entry(edge_key(a, b)).or_insert(0) += 1;
            }
        }
        let mut out = CavityBoundary::default();
        for ((a, b), n) in &owners {
            if *n == 1 {
                out.edges.push((*a, *b));
                out.adjacency.entry(*a).or_default().push(*b);
                out.adjacency.entry(*b).or_default().push(*a);
            }
        }
        out
    }

    /// Removes the given triangles from the live list.
    fn remove_triangles(&mut self, bad: &[usize]) {
        let bad_set: BTreeMap<usize, ()> = bad.iter().map(|t| (*t, ())).collect();
        let old = std::mem::take(&mut self.tris);
        self.tris = old
            .into_iter()
            .enumerate()
            .filter(|(i, _)| !bad_set.contains_key(i))
            .map(|(_, t)| t)
            .collect();
    }

    /// Bowyer–Watson point insertion (callers needing constraint safety
    /// check [`Self::cavity_breaks_constraints`] first).
    ///
    /// # Errors
    ///
    /// Returns [`MeshError::Degenerate`] when no circumcircle contains the
    /// point (i.e. it lies outside the triangulated hull).
    pub fn insert_point(&mut self, p: usize) -> Result<(), MeshError> {
        let bad = self.bad_triangles(p);
        if bad.is_empty() {
            return Err(MeshError::Degenerate {
                message: format!("point {p} lies outside the triangulated hull"),
            });
        }
        let boundary = self.cavity_boundary(&bad);
        self.remove_triangles(&bad);
        for (a, b) in &boundary.edges {
            if *a == p || *b == p {
                continue;
            }
            self.tris.push(normalize([p, *a, *b], &self.points));
        }
        Ok(())
    }

    /// True when inserting `p` would delete a constrained edge (the cavity
    /// owns both of its triangles).
    pub fn cavity_breaks_constraints(&self, p: usize) -> bool {
        let bad = self.bad_triangles(p);
        let mut owners: BTreeMap<(usize, usize), usize> = BTreeMap::new();
        for &t in &bad {
            for k in 0..3 {
                let a = self.tris[t][k];
                let b = self.tris[t][(k + 1) % 3];
                *owners.entry(edge_key(a, b)).or_insert(0) += 1;
            }
        }
        self.constrained
            .keys()
            .any(|e| owners.get(e).copied().unwrap_or(0) == 2)
    }

    /// Whether the undirected edge exists in the current triangulation.
    pub fn has_edge(&self, a: usize, b: usize) -> bool {
        let key = edge_key(a, b);
        self.tris.iter().any(|t| {
            edge_key(t[0], t[1]) == key
                || edge_key(t[1], t[2]) == key
                || edge_key(t[2], t[0]) == key
        })
    }

    /// Recovers the segment `(p, q)` as a triangulation edge, splitting it
    /// at any vertex that lies on it. Deterministic and recursion-bounded.
    ///
    /// # Errors
    ///
    /// Returns [`MeshError::Degenerate`] when the segment cannot be walked.
    pub fn recover_segment(&mut self, p: usize, q: usize, depth: usize) -> Result<(), MeshError> {
        if p == q || depth > 24 {
            return Ok(());
        }
        if self.has_edge(p, q) {
            self.constrained.insert(edge_key(p, q), ());
            return Ok(());
        }
        // Split at any mesh vertex strictly inside the open segment first:
        // collinear walks are the classic failure mode of cavity recovery.
        let (pp, qq) = (self.points[p], self.points[q]);
        let ends_eps = GEOM_TOL * GEOM_TOL * dist2(pp, qq);
        let split = (0..self.points.len()).find(|&i| {
            i != p
                && i != q
                && point_on_segment(self.points[i], pp, qq)
                && dist2(self.points[i], pp) > ends_eps
                && dist2(self.points[i], qq) > ends_eps
        });
        if let Some(v) = split {
            self.recover_segment(p, v, depth + 1)?;
            self.recover_segment(v, q, depth + 1)?;
            return Ok(());
        }
        let killed = self.walk_cavity(p, q)?;
        let killed_list: Vec<usize> = killed.keys().copied().collect();
        if killed_list.is_empty() {
            return Err(MeshError::Degenerate {
                message: format!("segment {p}-{q} crosses no triangle"),
            });
        }
        let boundary = self.cavity_boundary(&killed_list);
        let loop_vertices =
            order_loop(&boundary.adjacency, boundary.edges.len()).ok_or(MeshError::Degenerate {
                message: format!("cavity boundary for {p}-{q} is not a simple loop"),
            })?;
        self.remove_triangles(&killed_list);
        self.retriangulate_cavity(&loop_vertices, p, q)?;
        self.constrained.insert(edge_key(p, q), ());
        Ok(())
    }

    /// Strip of triangles the open segment `(p, q)` passes through.
    fn walk_cavity(&self, p: usize, q: usize) -> Result<BTreeMap<usize, ()>, MeshError> {
        let mut killed: BTreeMap<usize, ()> = BTreeMap::new();
        // Seed: triangles incident to p or q that the segment enters.
        let mut stack: Vec<usize> = Vec::new();
        for (i, t) in self.tris.iter().enumerate() {
            if (t.contains(&p) || t.contains(&q)) && self.segment_enters_wedge(p, q, t) {
                stack.push(i);
            }
        }
        while let Some(t) = stack.pop() {
            if killed.contains_key(&t) {
                continue;
            }
            killed.insert(t, ());
            for k in 0..3 {
                let a = self.tris[t][k];
                let b = self.tris[t][(k + 1) % 3];
                if self.crosses_shared_edge(p, q, a, b) {
                    for n in self.edge_triangles(a, b) {
                        if n != t && !killed.contains_key(&n) {
                            stack.push(n);
                        }
                    }
                }
            }
        }
        Ok(killed)
    }

    /// Wedge test for a triangle sharing `p` or `q`: the segment direction
    /// points strictly into the triangle's angle at the shared vertex.
    fn segment_enters_wedge(&self, p: usize, q: usize, t: &Tri) -> bool {
        let shared = if t.contains(&p) && t.contains(&q) {
            return false;
        } else if t.contains(&p) {
            p
        } else {
            q
        };
        let apex = if shared == p { p } else { q };
        let other_end = if shared == p { q } else { p };
        let (sp, ep) = (self.points[apex], self.points[other_end]);
        let dir = [ep[0] - sp[0], ep[1] - sp[1]];
        let mut others: Vec<usize> = t.iter().copied().filter(|v| *v != apex).collect();
        if others.len() != 2 {
            return false;
        }
        let o1 = others.pop().unwrap_or_default();
        let o2 = others.pop().unwrap_or_default();
        let d1 = orient2d(
            self.points[apex],
            self.points[o1],
            [sp[0] + dir[0], sp[1] + dir[1]],
        );
        let d2 = orient2d(
            self.points[apex],
            self.points[o2],
            [sp[0] + dir[0], sp[1] + dir[1]],
        );
        let e1 = orient2d(self.points[apex], self.points[o1], self.points[o2]);
        if e1 > 0.0 {
            d1 < 0.0 && d2 > 0.0
        } else {
            d1 > 0.0 && d2 < 0.0
        }
    }

    /// Does the open segment properly cross the edge `(a, b)`?
    fn crosses_shared_edge(&self, p: usize, q: usize, a: usize, b: usize) -> bool {
        segments_cross(
            self.points[p],
            self.points[q],
            self.points[a],
            self.points[b],
        )
    }

    /// Triangles incident to an undirected edge.
    fn edge_triangles(&self, a: usize, b: usize) -> Vec<usize> {
        let key = edge_key(a, b);
        self.tris
            .iter()
            .enumerate()
            .filter(|(_, t)| {
                edge_key(t[0], t[1]) == key
                    || edge_key(t[1], t[2]) == key
                    || edge_key(t[2], t[0]) == key
            })
            .map(|(i, _)| i)
            .collect()
    }

    /// Retriangulates the cavity loop with `pq` as an internal edge: the
    /// two side polygons are ear-clipped (robust for any simple polygon).
    fn retriangulate_cavity(
        &mut self,
        loop_vertices: &[usize],
        p: usize,
        q: usize,
    ) -> Result<(), MeshError> {
        let Some(p_pos) = loop_vertices.iter().position(|v| *v == p) else {
            return Err(MeshError::Degenerate {
                message: "cavity loop misses endpoint p".to_owned(),
            });
        };
        let Some(q_pos) = loop_vertices.iter().position(|v| *v == q) else {
            return Err(MeshError::Degenerate {
                message: "cavity loop misses endpoint q".to_owned(),
            });
        };
        let take = |from: usize, to: usize| -> Vec<usize> {
            if from <= to {
                loop_vertices[from..=to].to_vec()
            } else {
                loop_vertices[from..]
                    .iter()
                    .chain(loop_vertices[..=to].iter())
                    .copied()
                    .collect()
            }
        };
        self.triangulate_chain(&take(p_pos, q_pos))?;
        self.triangulate_chain(&take(q_pos, p_pos))?;
        Ok(())
    }

    /// Ear-clips a simple polygon given as a closed vertex chain.
    fn triangulate_chain(&mut self, chain: &[usize]) -> Result<(), MeshError> {
        if chain.len() < 3 {
            return Ok(()); // degenerate side (p and q adjacent on the loop)
        }
        let mut poly: Vec<usize> = chain.to_vec();
        let area: f64 = poly
            .iter()
            .enumerate()
            .map(|(i, v)| {
                let b = self.points[poly[(i + 1) % poly.len()]];
                let a = self.points[*v];
                a[0] * b[1] - b[0] * a[1]
            })
            .sum();
        if area < 0.0 {
            poly.reverse();
        }
        let mut guard = 0usize;
        while poly.len() > 3 {
            guard += 1;
            if guard > poly.len() * poly.len() + 16 {
                return Err(MeshError::Degenerate {
                    message: "ear clipping failed to converge".to_owned(),
                });
            }
            let mut clipped = false;
            for i in 0..poly.len() {
                let a = poly[(i + poly.len() - 1) % poly.len()];
                let b = poly[i];
                let c = poly[(i + 1) % poly.len()];
                if orient2d(self.points[a], self.points[b], self.points[c]) <= 1.0e-15 {
                    continue;
                }
                let reflex_free = poly.iter().all(|v| {
                    let in_ear = *v != a
                        && *v != b
                        && *v != c
                        && point_in_triangle(
                            self.points[*v],
                            self.points[a],
                            self.points[b],
                            self.points[c],
                        );
                    !in_ear
                });
                if !reflex_free {
                    continue;
                }
                self.tris.push(normalize([a, b, c], &self.points));
                poly.remove(i);
                clipped = true;
                break;
            }
            if !clipped {
                return Err(MeshError::Degenerate {
                    message: "cavity side polygon is not simple".to_owned(),
                });
            }
        }
        self.tris
            .push(normalize([poly[0], poly[1], poly[2]], &self.points));
        Ok(())
    }

    /// Bounded deterministic Delaunay flip sweep (constrained edges kept).
    pub fn delaunay_flip_sweep(&mut self, max_passes: usize) {
        for _ in 0..max_passes {
            let mut flipped = false;
            let keys: Vec<(usize, usize)> = self
                .tris
                .iter()
                .flat_map(|t| {
                    [
                        edge_key(t[0], t[1]),
                        edge_key(t[1], t[2]),
                        edge_key(t[2], t[0]),
                    ]
                })
                .collect();
            for (a, b) in keys {
                if self.constrained.contains_key(&(a, b)) {
                    continue;
                }
                let owners = self.edge_triangles(a, b);
                if owners.len() != 2 {
                    continue;
                }
                let t1 = self.tris[owners[0]];
                let t2 = self.tris[owners[1]];
                let (Some(c), Some(d)) = (opposite(t1, a, b), opposite(t2, a, b)) else {
                    continue;
                };
                if c == d {
                    continue;
                }
                // Strictly convex quad (all four successive turns positive).
                let pts = [a, c, b, d];
                let convex = (0..4).all(|i| {
                    orient2d(
                        self.points[pts[i]],
                        self.points[pts[(i + 1) % 4]],
                        self.points[pts[(i + 2) % 4]],
                    ) > 0.0
                });
                if !convex {
                    continue;
                }
                if in_circumcircle(
                    self.points[a],
                    self.points[b],
                    self.points[c],
                    self.points[d],
                ) {
                    self.tris[owners[0]] = normalize([a, c, d], &self.points);
                    self.tris[owners[1]] = normalize([b, c, d], &self.points);
                    flipped = true;
                }
            }
            if !flipped {
                break;
            }
        }
    }

    /// Drops every triangle touching a super-vertex.
    pub fn remove_super_triangles(&mut self, super_start: usize) {
        let old = std::mem::take(&mut self.tris);
        self.tris = old
            .into_iter()
            .filter(|t| !t.iter().any(|v| *v >= super_start))
            .collect();
    }
}

/// Rewinds a triangle to counter-clockwise orientation.
fn normalize(t: Tri, points: &[[f64; 2]]) -> Tri {
    if orient2d(points[t[0]], points[t[1]], points[t[2]]) < 0.0 {
        [t[0], t[2], t[1]]
    } else {
        t
    }
}

/// Chains cavity boundary adjacency into one closed cycle from `start`.
/// The adjacency is 2-regular for a proper cavity strip.
fn order_loop(boundary: &BTreeMap<usize, Vec<usize>>, edge_count: usize) -> Option<Vec<usize>> {
    let start = *boundary.keys().next()?;
    let mut loop_vertices = vec![start];
    let mut prev: Option<usize> = None;
    let mut current = start;
    loop {
        let neighbors = boundary.get(&current)?;
        let next = neighbors.iter().copied().find(|n| Some(*n) != prev)?;
        if next == start {
            break;
        }
        if loop_vertices.contains(&next) {
            return None;
        }
        loop_vertices.push(next);
        prev = Some(current);
        current = next;
    }
    if loop_vertices.len() == edge_count {
        Some(loop_vertices)
    } else {
        None
    }
}

fn opposite(t: Tri, a: usize, b: usize) -> Option<usize> {
    let key = edge_key(a, b);
    for k in 0..3 {
        let e = edge_key(t[k], t[(k + 1) % 3]);
        if e == key {
            return Some(t[(k + 2) % 3]);
        }
    }
    None
}

/// Cavity boundary handed back by [`Triangulation::cavity_boundary`].
#[derive(Default)]
struct CavityBoundary {
    edges: Vec<(usize, usize)>,
    adjacency: BTreeMap<usize, Vec<usize>>,
}
