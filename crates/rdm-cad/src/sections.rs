//! M11.1 — exact analytical multi-element composite cross-section mechanics.

//! A [`CompositeSectionDef`] composes `1..N` sub-elements (EN catalog
//! profiles, parametric plates, CHS, RHS/SHS), each placed at a centroid
//! offset `(dy, dz)` (m), rotated by `theta` (rad) about its own centroid
//! and optionally mirrored about its own axes. Everything is strict SI
//! (`m`, `m²`, `m³`, `m⁴`, `m⁶`, `kg/m`, `rad`). Modelled simplifications,
//! documented for the note de calcul: catalog RHS/SHS corner radii and UPN
//! tapered flanges are treated as rectangular walls (+2-3 % on `A` versus
//! the tabulated values), angle toe radii are omitted, `It` is the
//! thin-wall superposition of the sub-elements and `Iw` their warping
//! superposition with a flange Steiner term.
//!
//! [`compute_composite_section`] derives, with exact analytic integrals:

//! - area `A`, linear mass, centroid `(yG, zG)`;
//! - centroidal `Iy, Iz, Iyz` (Huygens-Steiner), principal `(Iu, Iv)` and
//!   the principal axis angle `alpha`;
//! - radii of gyration, extreme fibres and the four elastic moduli
//!   `Wel,y,sup / Wel,y,inf / Wel,z,left / Wel,z,right`;
//! - exact plastic moduli `Wpl,y / Wpl,z` by bisection of the equal-area
//!   plastic neutral axis (`integral(A+) fy = integral(A-) fy`, EN 1993-1-1);
//! - shear areas `Av,y / Av,z` (§6.2.6), Saint-Venant `It`, warping `Iw`;
//! - automatic EN 1993-1-1 Table 5.2 classification per steel grade.

use rdm_eurocode::{profile_catalog, ProfileFamily};
use rdm_model::{
    CompositeElement, CompositeElementKind, CompositeSectionDef, SectionProperties, SectionShape,
    SteelGrade,
};

/// Density of structural steel (kg/m³) used for the linear mass.
pub const STEEL_DENSITY: f64 = 7850.0;

/// Arc samples of the plastic-decomposition polygons (relative error < 1e-4).
const ARC_SAMPLES: usize = 192;

/// Drawing tessellation of circular arcs (metres-resolution smoothness).
const DRAW_SAMPLES: usize = 96;

/// Everything wrong that a composite definition can be.
#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum CompositeSectionError {
    /// The definition carries no sub-element.
    #[error("composite section '{name}' must contain at least one element")]
    EmptySection {
        /// Offending section name.
        name: String,
    },
    /// A `profile` element references a designation outside the catalogs.
    #[error("composite section '{name}': unknown profile designation '{designation}'")]
    UnknownProfile {
        /// Offending section name.
        name: String,
        /// Unknown designation.
        designation: String,
    },
    /// A dimensional field is zero or negative.
    #[error("composite section '{name}': element {index} has a non-positive '{field}'")]
    NonPositiveDimension {
        /// Offending section name.
        name: String,
        /// 0-based element index.
        index: usize,
        /// Offending dimension field.
        field: String,
    },
    /// A hollow-section wall is thicker than half the outer dimension, or a
    /// plate stack is degenerate.
    #[error("composite section '{name}': element {index} has an impossible wall thickness")]
    WallTooThick {
        /// Offending section name.
        name: String,
        /// 0-based element index.
        index: usize,
    },
}

/// One EN 1993-1-1 Table 5.2 classified plate of the composite section.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct ClassificationPart {
    /// Human-readable part label (`element 2 web`, `element 1 outstand`...).
    pub label: String,
    /// The checked width-to-thickness ratio `c / t`.
    pub c_over_t: f64,
    /// The Class 1 limit of the relevant Table 5.2 row (in `epsilon` units).
    pub limit_class1: f64,
    /// Governing class 1..=4 of this part.
    pub class: u8,
    /// `true` for internal (bounded) elements, `false` for outstands.
    pub internal: bool,
    /// `true` when the part was classified for pure compression.
    pub pure_compression: bool,
}

/// Vector outline of one sub-element (composite/user frame, metres).
#[derive(Debug, Clone, serde::Serialize)]
pub struct ElementOutline {
    /// Sub-element label (`element 1`, ...).
    pub label: String,
    /// Closed polylines of the element (rectangles, arcs, fillets).
    pub paths: Vec<Vec<[f64; 2]>>,
}

/// Exact analytical results of a composite cross-section (strict SI).
#[derive(Debug, Clone, serde::Serialize)]
pub struct CompositeSectionResult {
    /// Section name (the `section_id` beams reference).
    pub name: String,
    /// Steel grade wire code (`S235`..`S460`).
    pub grade_code: String,
    /// Total cross-sectional area `A` (m²).
    pub a: f64,
    /// Linear mass `m = 7850 · A` (kg/m).
    pub mass_per_m: f64,
    /// Centroid `yG` in the composite frame (m).
    pub y_g: f64,
    /// Centroid `zG` in the composite frame (m).
    pub z_g: f64,
    /// Centroidal second moment about the `y` axis (m⁴).
    pub iy: f64,
    /// Centroidal second moment about the `z` axis (m⁴).
    pub iz: f64,
    /// Centroidal product of inertia (m⁴).
    pub iyz: f64,
    /// Major principal second moment (m⁴).
    pub iu: f64,
    /// Minor principal second moment (m⁴).
    pub iv: f64,
    /// Principal-axis angle `alpha` (rad) from the `y` axis to the major
    /// principal axis `u`.
    pub alpha_rad: f64,
    /// Radius of gyration about `y` (m).
    pub i_radius_y: f64,
    /// Radius of gyration about `z` (m).
    pub i_radius_z: f64,
    /// Extreme fibre distance below the centroid (m, negative).
    pub z_min: f64,
    /// Extreme fibre distance above the centroid (m).
    pub z_max: f64,
    /// Extreme fibre distance on the `-y` side (m, negative).
    pub y_min: f64,
    /// Extreme fibre distance on the `+y` side (m).
    pub y_max: f64,
    /// Elastic modulus on the `+z` fibre `Wel,y,sup` (m³).
    pub wel_y_sup: f64,
    /// Elastic modulus on the `-z` fibre `Wel,y,inf` (m³).
    pub wel_y_inf: f64,
    /// Elastic modulus on the `-y` fibre `Wel,z,left` (m³).
    pub wel_z_left: f64,
    /// Elastic modulus on the `+y` fibre `Wel,z,right` (m³).
    pub wel_z_right: f64,
    /// Conservative strong-axis elastic modulus (m³).
    pub wel_y: f64,
    /// Conservative weak-axis elastic modulus (m³).
    pub wel_z: f64,
    /// Plastic modulus about `y` (m³).
    pub wpl_y: f64,
    /// Plastic modulus about `z` (m³).
    pub wpl_z: f64,
    /// `z` position of the equal-area plastic neutral axis for `My` (m,
    /// composite frame) — the dashed `ANP` of the studio canvas.
    pub pna_for_my: f64,
    /// `y` position of the equal-area plastic neutral axis for `Mz` (m,
    /// composite frame).
    pub pna_for_mz: f64,
    /// Shear area for shear along `y` (m²) per EN 1993-1-1 §6.2.6.
    pub a_vy: f64,
    /// Shear area for shear along `z` (m²) per EN 1993-1-1 §6.2.6.
    pub a_vz: f64,
    /// Saint-Venant torsion constant (m⁴, thin-wall superposition).
    pub it: f64,
    /// Warping constant (m⁶, flange Steiner superposition).
    pub iw: f64,
    /// Governing EN 1993-1-1 class under pure bending (1..=4).
    pub class_bending: u8,
    /// Governing EN 1993-1-1 class under pure compression (1..=4).
    pub class_compression: u8,
    /// Per-plate classification detail (Table 5.2 rows, both load modes).
    pub classification: Vec<ClassificationPart>,
    /// Vector outlines of the sub-elements for the studio canvas.
    pub elements: Vec<ElementOutline>,
    /// Drawing bounds `[y_min, y_max, z_min, z_max]` (composite frame, m).
    pub bounds: [f64; 4],
    /// Canonical section properties used by the solver and the EN 1993-1-1
    /// verification pass (the composite joins `Structure::sections` under
    /// its name through this projection).
    pub section_properties: SectionProperties,
}

// ---------------------------------------------------------------------------
// Exact primitive integrals
// ---------------------------------------------------------------------------

/// Exact integrals of one primitive about a frame origin:
/// `[A, integral(y), integral(z), integral(y²), integral(z²), integral(yz)]`.
type Integrals = [f64; 6];

/// One exact geometric primitive of a sub-element (raw element frame).
#[derive(Debug, Clone, Copy)]
enum Prim {
    /// Axis-aligned rectangle `w` (y) x `h` (z) centred at `(cy, cz)`.
    Rect { cy: f64, cz: f64, w: f64, h: f64 },
    /// Annulus centred at `(cy, cz)` — a solid disc is `r_in = 0`.
    Annulus {
        cy: f64,
        cz: f64,
        r_out: f64,
        r_in: f64,
    },
    /// Web/flange junction fillet: the material occupies the quadrant
    /// pointed at by `(sx, sz)` ∈ {-1, +1} from the tangent-face
    /// intersection `(cy, cz)`, bounded by the arc of radius `r` centred at
    /// `(cy + sx·r, cz + sz·r)` (the quarter disc is void).
    Fillet {
        cy: f64,
        cz: f64,
        r: f64,
        sx: f64,
        sz: f64,
    },
}

/// A primitive with a sign — the inner voids of hollow sections subtract.
struct SignedPrim {
    prim: Prim,
    sign: f64,
}

impl Prim {
    /// Exact integrals of the primitive about the raw frame origin.
    fn integrals(self) -> Integrals {
        const PI: f64 = std::f64::consts::PI;
        match self {
            Self::Rect { cy, cz, w, h } => {
                let a = w * h;
                let i_y = w * h * h * h / 12.0; // integral(z²)
                let i_z = w * w * w * h / 12.0; // integral(y²)
                [
                    a,
                    a * cy,
                    a * cz,
                    a * cy * cy + i_z,
                    a * cz * cz + i_y,
                    a * cy * cz,
                ]
            }
            Self::Annulus {
                cy,
                cz,
                r_out,
                r_in,
            } => {
                let a = PI * (r_out * r_out - r_in * r_in);
                let i = PI * (r_out.powi(4) - r_in.powi(4)) / 4.0;
                [
                    a,
                    a * cy,
                    a * cz,
                    a * cy * cy + i,
                    a * cz * cz + i,
                    a * cy * cz,
                ]
            }
            Self::Fillet { cy, cz, r, sx, sz } => {
                // Patch frame: u, v in [0, r] with (u-r)² + (v-r)² >= r²;
                // y = cy + sx·u, z = cz + sz·v. Closed forms from
                // (square corner region) − (quarter disc centred (r, r)).
                let k0 = (5.0 / 6.0 - PI / 4.0) / (1.0 - PI / 4.0);
                let a_f = r * r * (1.0 - PI / 4.0);
                let u_bar = k0 * r;
                let c_u2 = r.powi(4) * (1.0 - 5.0 * PI / 16.0);
                let c_uv = r.powi(4) * (19.0 / 24.0 - PI / 4.0);
                let a = a_f;
                // First moments (named distinctly so the quadrant signs sx/sz
                // stay unshadowed for the second-moment formulas below).
                let first_y = a * (cy + sx * u_bar);
                let first_z = a * (cz + sz * u_bar);
                let i_y2 = a * cy * cy + 2.0 * sx * u_bar * a * cy + c_u2;
                let i_z2 = a * cz * cz + 2.0 * sz * u_bar * a * cz + c_u2;
                let i_yz = a * cy * cz + sx * u_bar * a * cz + sz * u_bar * a * cy + sx * sz * c_uv;
                [a, first_y, first_z, i_y2, i_z2, i_yz]
            }
        }
    }

    /// Exact axis-aligned bounding box in the raw frame.
    fn raw_bounds(self) -> [f64; 4] {
        match self {
            Self::Rect { cy, cz, w, h } => [cy - w / 2.0, cy + w / 2.0, cz - h / 2.0, cz + h / 2.0],
            Self::Annulus {
                cy, cz, r_out: r, ..
            } => [cy - r, cy + r, cz - r, cz + r],
            Self::Fillet { cy, cz, r, sx, sz } => {
                // The patch spans one quadrant from the corner; the arc ends
                // at (sx·r, 0) and (0, sz·r) so the extremes are exact.
                let (y0, y1) = if sx > 0.0 { (cy, cy + r) } else { (cy - r, cy) };
                let (z0, z1) = if sz > 0.0 { (cz, cz + r) } else { (cz - r, cz) };
                [y0, y1, z0, z1]
            }
        }
    }

    /// Sampling of the primitive boundary for the plastic polygons and the
    /// drawing paths — signed: the inner voids wind clockwise.
    fn outline(self, samples: usize) -> Vec<Vec<[f64; 2]>> {
        const PI: f64 = std::f64::consts::PI;
        match self {
            Self::Rect { cy, cz, w, h } => {
                let (hw, hh) = (w / 2.0, h / 2.0);
                vec![vec![
                    [cy - hw, cz - hh],
                    [cy + hw, cz - hh],
                    [cy + hw, cz + hh],
                    [cy - hw, cz + hh],
                ]]
            }
            Self::Annulus {
                cy,
                cz,
                r_out,
                r_in,
            } => {
                vec![
                    circle_ring(cy, cz, r_out, samples, true),
                    circle_ring(cy, cz, r_in.max(1e-12), samples, false),
                ]
            }
            Self::Fillet { cy, cz, r, sx, sz } => {
                // Arc of the base patch from (r, 0) to (0, r): P(t) =
                // (r - r·cos t, r - r·sin t); material between the corner and
                // the arc. Emit corner -> arc -> corner as a closed polyline.
                let mut path = vec![[cy, cz]];
                for i in 0..=samples {
                    let angle = PI / 2.0 * (i as f64) / (samples as f64);
                    let u = r - r * angle.cos();
                    let v = r - r * angle.sin();
                    path.push([cy + sx * u, cz + sz * v]);
                }
                path.push([cy, cz]);
                vec![path]
            }
        }
    }
}

/// CCW (`ccw = true`) or CW circle ring with `samples` vertices.
fn circle_ring(cy: f64, cz: f64, r: f64, samples: usize, ccw: bool) -> Vec<[f64; 2]> {
    let n = samples.max(8);
    let dir = if ccw { 1.0 } else { -1.0 };
    (0..n)
        .map(|i| {
            let t = 2.0 * std::f64::consts::PI * (i as f64) / (n as f64) * dir;
            [cy + r * t.cos(), cz + r * t.sin()]
        })
        .collect()
}

/// Signed area of a simple polygon (positive = counter-clockwise).
fn signed_area(pts: &[[f64; 2]]) -> f64 {
    pts.windows(2)
        .map(|w| w[0][0] * w[1][1] - w[1][0] * w[0][1])
        .sum::<f64>()
        / 2.0
        + {
            let n = pts.len();
            if n >= 2 {
                (pts[n - 1][0] * pts[0][1] - pts[0][0] * pts[n - 1][1]) / 2.0
            } else {
                0.0
            }
        }
}

/// Forces a polygon to wind counter-clockwise.
fn ensure_ccw(pts: &mut [[f64; 2]]) {
    if signed_area(pts) < 0.0 {
        pts.reverse();
    }
}

/// Forces a polygon to wind clockwise (voids of the plastic decomposition).
fn ensure_cw(pts: &mut [[f64; 2]]) {
    if signed_area(pts) > 0.0 {
        pts.reverse();
    }
}

/// Green-theorem integrals of a simple polygon:
/// `(A, integral(y), integral(z))` — signed (CW polygons count negative).
fn polygon_first_integrals(pts: &[[f64; 2]]) -> [f64; 3] {
    let n = pts.len();
    if n < 3 {
        return [0.0; 3];
    }
    let mut a = 0.0;
    let mut sy = 0.0;
    let mut sz = 0.0;
    for i in 0..n {
        let p = pts[i];
        let q = pts[(i + 1) % n];
        let cross = p[0] * q[1] - q[0] * p[1];
        a += cross;
        sy += (p[0] + q[0]) * cross;
        sz += (p[1] + q[1]) * cross;
    }
    [a / 2.0, sy / 6.0, sz / 6.0]
}

/// Clips a CONVEX polygon against the half-plane `n·x >= c`
/// (Sutherland-Hodgman; `n` must be a unit vector).
fn clip_halfplane(pts: &[[f64; 2]], n: [f64; 2], c: f64) -> Vec<[f64; 2]> {
    let inside = |p: &[f64; 2]| n[0] * p[0] + n[1] * p[1] >= c;
    let mut out: Vec<[f64; 2]> = Vec::with_capacity(pts.len() + 1);
    let count = pts.len();
    for i in 0..count {
        let p = pts[i];
        let q = pts[(i + 1) % count];
        let pin = inside(&p);
        let qin = inside(&q);
        if pin {
            out.push(p);
            if !qin {
                out.push(line_intersection(p, q, n, c));
            }
        } else if qin {
            out.push(line_intersection(p, q, n, c));
        }
    }
    out
}

/// Intersection of segment `start -> end` with the line `normal·x = level`.
fn line_intersection(start: [f64; 2], end: [f64; 2], normal: [f64; 2], level: f64) -> [f64; 2] {
    let d_start = normal[0] * start[0] + normal[1] * start[1] - level;
    let d_end = normal[0] * end[0] + normal[1] * end[1] - level;
    let ratio = d_start / (d_start - d_end);
    [
        start[0] + ratio * (end[0] - start[0]),
        start[1] + ratio * (end[1] - start[1]),
    ]
}

/// Solved plastic neutral axis: position along the cut axis + `Wpl`.
struct PlasticAxis {
    /// Cut position in the composite frame (m): `z0` for a horizontal cut,
    /// `y0` for a vertical cut.
    position: f64,
    /// Plastic modulus about the bending axis (m³).
    wpl: f64,
}

/// Bisection of the equal-area plastic neutral axis over signed convex
/// polygons, then the exact `Wpl = M+ + M-` from the clipped first moments.
/// `axis`: `0` cuts vertically (`{y >= y0}`, `Wpl` about `z`), `1` cuts
/// horizontally (`{z >= z0}`, `Wpl` about `y`). `first_moment` is the exact
/// `integral(n·x) dA` of the whole section (`A·yG` / `A·zG`).
fn solve_plastic_axis(
    polys: &[Vec<[f64; 2]>],
    axis: usize,
    a_total: f64,
    first_moment: f64,
    bounds: [f64; 4],
) -> PlasticAxis {
    let unit: [f64; 2] = if axis == 0 { [1.0, 0.0] } else { [0.0, 1.0] };
    let (lo, hi) = if axis == 0 {
        (bounds[0] - 1e-6, bounds[1] + 1e-6)
    } else {
        (bounds[2] - 1e-6, bounds[3] + 1e-6)
    };
    let above = |c: f64| -> f64 {
        polys
            .iter()
            .map(|poly| {
                let clipped = clip_halfplane(poly, unit, c);
                polygon_first_integrals(&clipped)[0]
            })
            .sum::<f64>()
    };
    // F(c) = A_above(c) − A/2 is decreasing; bracket [lo, hi].
    let mut lo = lo;
    let mut hi = hi;
    for _ in 0..90 {
        let mid = lo.midpoint(hi);
        if above(mid) > a_total / 2.0 {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    let c0 = lo.midpoint(hi);
    // M+ = integral(n·x − c0) over {n·x >= c0}, computed on the clipped
    // polygons; Wpl = M+ + M- = 2·M+ + c0·A − integral(n·x).
    let m_plus = polys
        .iter()
        .map(|poly| {
            let clipped = clip_halfplane(poly, unit, c0);
            let [area, sy, sz] = polygon_first_integrals(&clipped);
            (if axis == 0 { sy } else { sz }) - c0 * area
        })
        .sum::<f64>();
    let wpl = 2.0 * m_plus + c0 * a_total - first_moment;
    PlasticAxis {
        position: c0,
        wpl: wpl.max(0.0),
    }
}

// ---------------------------------------------------------------------------
// Element mechanics
// ---------------------------------------------------------------------------

/// Normative tag of one built sub-element (classification + shape mapping).
enum ElementTag {
    /// Parametric plate (thickness along its local z).
    Plate { thickness: f64 },
    /// Catalog profile (`h, b, tw, tf, r` dims + family).
    Profile {
        dims: [f64; 5],
        family: ProfileFamily,
    },
    /// Parametric CHS.
    Chs { d: f64, t: f64 },
    /// Parametric RHS/SHS (welded: `c = h − 2t` classification widths).
    Rhs { h: f64, b: f64, t: f64 },
}

/// Mechanics of one sub-element expressed in the composite frame.
struct ElementMechanics {
    /// Element index (0-based).
    index: usize,
    /// Area (m²).
    a: f64,
    /// Centroid in the composite frame — exactly `(dy, dz)`.
    centroid: [f64; 2],
    /// Exact `integral(y²)` about the composite origin (m⁴).
    i_y2: f64,
    /// Exact `integral(z²)` about the composite origin (m⁴).
    i_z2: f64,
    /// Exact `integral(yz)` about the composite origin (m⁴).
    i_yz: f64,
    /// Saint-Venant torsion constant (m⁴).
    it: f64,
    /// Own warping constant about the element shear centre (m⁶).
    iw_own: f64,
    /// Own centroidal `integral(y_local²)` (m⁴) — warping Steiner driver.
    i_width_y: f64,
    /// Own centroidal `integral(z_local²)` (m⁴).
    i_width_z: f64,
    /// Shear area along the element-local y (m², §6.2.6).
    a_v_local_y: f64,
    /// Shear area along the element-local z (m²).
    a_v_local_z: f64,
    /// True when the element spreads along the global y (flange-like).
    horizontal: bool,
    /// Rotation angle (rad).
    theta: f64,
    /// Normative tag.
    tag: ElementTag,
    /// Global bounding box `[y_min, y_max, z_min, z_max]` (composite frame).
    bounds: [f64; 4],
    /// Drawing paths (composite frame).
    paths: Vec<Vec<[f64; 2]>>,
    /// Signed convex polygons of the plastic decomposition.
    plastic: Vec<Vec<[f64; 2]>>,
}

/// Roark Table 10.1 interpolated Saint-Venant coefficient of a rectangle.
fn beta_rect(long: f64, short: f64) -> f64 {
    let ratio = (long / short).clamp(1.0, 10.0);
    let table: [(f64, f64); 5] = [
        (1.0, 0.141),
        (1.5, 0.196),
        (2.0, 0.229),
        (4.0, 0.281),
        (10.0, 0.313),
    ];
    for pair in table.windows(2) {
        let (x0, y0) = pair[0];
        let (x1, y1) = pair[1];
        if ratio <= x1 {
            let k = (ratio - x0) / (x1 - x0);
            return y0 + (y1 - y0) * k;
        }
    }
    0.313
}

/// Applies the element placement transform (raw -> composite frame):
/// re-centre, mirror, rotate by `theta`, offset by `(dy, dz)`.
fn transform_point(
    p: [f64; 2],
    centre: [f64; 2],
    mirror: [f64; 2],
    cos: f64,
    sin: f64,
    offset: [f64; 2],
) -> [f64; 2] {
    let x = (p[0] - centre[0]) * mirror[0];
    let y = (p[1] - centre[1]) * mirror[1];
    [offset[0] + x * cos - y * sin, offset[1] + x * sin + y * cos]
}

/// Builds the mechanics of one sub-element.
#[allow(clippy::too_many_lines)]
fn build_element(
    def: &CompositeSectionDef,
    index: usize,
    element: &CompositeElement,
) -> Result<ElementMechanics, CompositeSectionError> {
    let positive = |value: f64, field: &str| -> Result<(), CompositeSectionError> {
        if value > 0.0 {
            Ok(())
        } else {
            Err(CompositeSectionError::NonPositiveDimension {
                name: def.name.clone(),
                index,
                field: field.to_owned(),
            })
        }
    };
    let too_thick = || CompositeSectionError::WallTooThick {
        name: def.name.clone(),
        index,
    };

    // Raw-frame signed primitives + per-kind mechanics.
    let (prims, it, iw_own, tag): (Vec<SignedPrim>, f64, f64, ElementTag) = match &element.kind {
        CompositeElementKind::Plate { length, thickness } => {
            positive(*length, "length")?;
            positive(*thickness, "thickness")?;
            let (long, short) = (length.max(*thickness), length.min(*thickness));
            (
                vec![SignedPrim {
                    prim: Prim::Rect {
                        cy: 0.0,
                        cz: 0.0,
                        w: *length,
                        h: *thickness,
                    },
                    sign: 1.0,
                }],
                beta_rect(long, short) * long * short.powi(3),
                0.0,
                ElementTag::Plate {
                    thickness: *thickness,
                },
            )
        }
        CompositeElementKind::Profile { designation } => {
            let entry = profile_catalog().entry(designation).map_err(|_| {
                CompositeSectionError::UnknownProfile {
                    name: def.name.clone(),
                    designation: designation.clone(),
                }
            })?;
            match entry.family {
                ProfileFamily::Chs => {
                    let d = entry.d.or(entry.h).unwrap_or(0.0);
                    let t = entry.t.unwrap_or(0.0);
                    positive(d, "d")?;
                    positive(t, "t")?;
                    if 2.0 * t >= d {
                        return Err(too_thick());
                    }
                    (
                        vec![SignedPrim {
                            prim: Prim::Annulus {
                                cy: 0.0,
                                cz: 0.0,
                                r_out: d / 2.0,
                                r_in: d / 2.0 - t,
                            },
                            sign: 1.0,
                        }],
                        entry.it,
                        entry.iw.unwrap_or(0.0),
                        ElementTag::Chs { d, t },
                    )
                }
                ProfileFamily::Shs | ProfileFamily::Rhs => {
                    let h = entry.h.unwrap_or(0.0);
                    let b = entry.b.unwrap_or(0.0);
                    let t = entry.t.unwrap_or(0.0);
                    positive(h, "h")?;
                    positive(b, "b")?;
                    positive(t, "t")?;
                    if 2.0 * t >= h.min(b) {
                        return Err(too_thick());
                    }
                    (
                        vec![
                            SignedPrim {
                                prim: Prim::Rect {
                                    cy: 0.0,
                                    cz: 0.0,
                                    w: b,
                                    h,
                                },
                                sign: 1.0,
                            },
                            SignedPrim {
                                prim: Prim::Rect {
                                    cy: 0.0,
                                    cz: 0.0,
                                    w: (b - 2.0 * t).max(1e-9),
                                    h: (h - 2.0 * t).max(1e-9),
                                },
                                sign: -1.0,
                            },
                        ],
                        entry.it,
                        entry.iw.unwrap_or(0.0),
                        ElementTag::Rhs { h, b, t },
                    )
                }
                ProfileFamily::L => {
                    let a_leg = entry.a_leg.unwrap_or(0.0);
                    let b_leg = entry.b.unwrap_or(a_leg);
                    let t = entry.t.or(entry.tw).unwrap_or(0.0);
                    positive(a_leg, "a")?;
                    positive(b_leg, "b")?;
                    positive(t, "t")?;
                    let r1 = entry.r.unwrap_or(t).min((a_leg.min(b_leg) - t).max(0.0));
                    // Swap-symmetric decomposition: corner square + the two
                    // leg strips + the root fillet (toe radii omitted).
                    let mut prims = vec![
                        SignedPrim {
                            prim: Prim::Rect {
                                cy: t / 2.0,
                                cz: t / 2.0,
                                w: t,
                                h: t,
                            },
                            sign: 1.0,
                        },
                        SignedPrim {
                            prim: Prim::Rect {
                                cy: t / 2.0,
                                cz: t + (a_leg - t) / 2.0,
                                w: t,
                                h: a_leg - t,
                            },
                            sign: 1.0,
                        },
                        SignedPrim {
                            prim: Prim::Rect {
                                cy: t + (b_leg - t) / 2.0,
                                cz: t / 2.0,
                                w: b_leg - t,
                                h: t,
                            },
                            sign: 1.0,
                        },
                    ];
                    if r1 > 0.0 {
                        prims.push(SignedPrim {
                            prim: Prim::Fillet {
                                cy: t,
                                cz: t,
                                r: r1,
                                sx: 1.0,
                                sz: 1.0,
                            },
                            sign: 1.0,
                        });
                    }
                    (
                        prims,
                        entry.it,
                        entry.iw.unwrap_or(0.0),
                        ElementTag::Profile {
                            dims: [a_leg, b_leg, t, t, r1],
                            family: ProfileFamily::L,
                        },
                    )
                }
                ProfileFamily::Upn | ProfileFamily::Upe => {
                    // Channel: web on the -y face, parallel-flange model of
                    // the tapered EN 10365 flanges, two root fillets.
                    let h = entry.h.unwrap_or(0.0);
                    let b = entry.b.unwrap_or(0.0);
                    let tw = entry.tw.unwrap_or(0.0);
                    let tf = entry.tf.unwrap_or(0.0);
                    let r = entry.r.unwrap_or(0.0);
                    positive(h, "h")?;
                    positive(b, "b")?;
                    positive(tw, "tw")?;
                    positive(tf, "tf")?;
                    let h1 = h - 2.0 * tf;
                    if h1 <= 0.0 {
                        return Err(too_thick());
                    }
                    let outstand = b - tw;
                    if outstand <= 0.0 {
                        return Err(too_thick());
                    }
                    let mut prims = vec![
                        SignedPrim {
                            prim: Prim::Rect {
                                cy: tw / 2.0,
                                cz: 0.0,
                                w: tw,
                                h,
                            },
                            sign: 1.0,
                        },
                        SignedPrim {
                            prim: Prim::Rect {
                                cy: tw + outstand / 2.0,
                                cz: (h - tf) / 2.0,
                                w: outstand,
                                h: tf,
                            },
                            sign: 1.0,
                        },
                        SignedPrim {
                            prim: Prim::Rect {
                                cy: tw + outstand / 2.0,
                                cz: -(h - tf) / 2.0,
                                w: outstand,
                                h: tf,
                            },
                            sign: 1.0,
                        },
                    ];
                    if r > 0.0 && r < outstand && r < h1 / 2.0 {
                        for s in [-1.0, 1.0] {
                            // Void between the flanges: the material quadrant
                            // points back into it, i.e. (+1, -s) from the
                            // tangent-face intersection at (tw, s·h1/2).
                            prims.push(SignedPrim {
                                prim: Prim::Fillet {
                                    cy: tw,
                                    cz: s * h1 / 2.0,
                                    r,
                                    sx: 1.0,
                                    sz: -s,
                                },
                                sign: 1.0,
                            });
                        }
                    }
                    (
                        prims,
                        entry.it,
                        entry.iw.unwrap_or(0.0),
                        ElementTag::Profile {
                            dims: [h, b, tw, tf, r],
                            family: entry.family,
                        },
                    )
                }
                _ => {
                    // Rolled / welded I, H and U profiles from the EN 10365
                    // dimensions: two flanges, the web, four root fillets.
                    let h = entry.h.unwrap_or(0.0);
                    let b = entry.b.unwrap_or(0.0);
                    let tw = entry.tw.unwrap_or(0.0);
                    let tf = entry.tf.unwrap_or(0.0);
                    let r = entry.r.unwrap_or(0.0);
                    positive(h, "h")?;
                    positive(b, "b")?;
                    positive(tw, "tw")?;
                    positive(tf, "tf")?;
                    let h1 = h - 2.0 * tf;
                    if h1 <= 0.0 {
                        return Err(too_thick());
                    }
                    let mut prims = vec![
                        SignedPrim {
                            prim: Prim::Rect {
                                cy: 0.0,
                                cz: (h - tf) / 2.0,
                                w: b,
                                h: tf,
                            },
                            sign: 1.0,
                        },
                        SignedPrim {
                            prim: Prim::Rect {
                                cy: 0.0,
                                cz: -(h - tf) / 2.0,
                                w: b,
                                h: tf,
                            },
                            sign: 1.0,
                        },
                        SignedPrim {
                            prim: Prim::Rect {
                                cy: 0.0,
                                cz: 0.0,
                                w: tw,
                                h: h1,
                            },
                            sign: 1.0,
                        },
                    ];
                    let fillet_room = (b - tw) / 2.0;
                    if r > 0.0 && r < fillet_room && r < h1 / 2.0 {
                        for s in [-1.0, 1.0] {
                            for sx in [-1.0, 1.0] {
                                // Corner at the web-face / flange-inner-face
                                // intersection; the material quadrant points
                                // back into the void between the flanges.
                                prims.push(SignedPrim {
                                    prim: Prim::Fillet {
                                        cy: sx * tw / 2.0,
                                        cz: s * h1 / 2.0,
                                        r,
                                        sx,
                                        sz: -s,
                                    },
                                    sign: 1.0,
                                });
                            }
                        }
                    }
                    (
                        prims,
                        entry.it,
                        entry.iw.unwrap_or(0.0),
                        ElementTag::Profile {
                            dims: [h, b, tw, tf, r],
                            family: entry.family,
                        },
                    )
                }
            }
        }
        CompositeElementKind::Chs {
            diameter,
            thickness,
        } => {
            positive(*diameter, "diameter")?;
            positive(*thickness, "thickness")?;
            if 2.0 * *thickness >= *diameter {
                return Err(too_thick());
            }
            let i = std::f64::consts::PI
                * ((*diameter / 2.0).powi(4) - (*diameter / 2.0 - *thickness).powi(4));
            (
                vec![SignedPrim {
                    prim: Prim::Annulus {
                        cy: 0.0,
                        cz: 0.0,
                        r_out: diameter / 2.0,
                        r_in: diameter / 2.0 - thickness,
                    },
                    sign: 1.0,
                }],
                i / 2.0,
                0.0,
                ElementTag::Chs {
                    d: *diameter,
                    t: *thickness,
                },
            )
        }
        CompositeElementKind::Rhs {
            height,
            width,
            thickness,
        } => {
            positive(*height, "height")?;
            positive(*width, "width")?;
            positive(*thickness, "thickness")?;
            if 2.0 * thickness >= height.min(*width) {
                return Err(too_thick());
            }
            (
                vec![
                    SignedPrim {
                        prim: Prim::Rect {
                            cy: 0.0,
                            cz: 0.0,
                            w: *width,
                            h: *height,
                        },
                        sign: 1.0,
                    },
                    SignedPrim {
                        prim: Prim::Rect {
                            cy: 0.0,
                            cz: 0.0,
                            w: (width - 2.0 * thickness).max(1e-9),
                            h: (height - 2.0 * thickness).max(1e-9),
                        },
                        sign: -1.0,
                    },
                ],
                2.0 * thickness * (height - thickness).powi(2) * (width - thickness).powi(2)
                    / (height + width - 2.0 * thickness),
                0.0,
                ElementTag::Rhs {
                    h: *height,
                    b: *width,
                    t: *thickness,
                },
            )
        }
    };

    // Raw-frame aggregate of the exact primitive integrals.
    let mut raw: Integrals = [0.0; 6];
    for signed in &prims {
        let int = signed.prim.integrals();
        for (acc, value) in raw.iter_mut().zip(int) {
            *acc += signed.sign * value;
        }
    }
    let area_raw = raw[0];
    if area_raw <= 0.0 {
        return Err(too_thick());
    }
    let raw_centre = [raw[1] / area_raw, raw[2] / area_raw];

    // Own-frame centroidal tensor (mirror-invariant), then the exact affine
    // transform to the composite frame: T_g = R·M·T_loc·Mᵀ·Rᵀ + A·d·dᵀ.
    let t_yy = raw[3] - area_raw * raw_centre[0] * raw_centre[0];
    let t_zz = raw[4] - area_raw * raw_centre[1] * raw_centre[1];
    let t_yz = raw[5] - area_raw * raw_centre[0] * raw_centre[1];
    let my = if element.mirror_y { -1.0 } else { 1.0 };
    let mz = if element.mirror_z { -1.0 } else { 1.0 };
    // M·T·Mᵀ with M = diag(my, mz).
    let m_yy = t_yy;
    let m_zz = t_zz;
    let m_yz = my * mz * t_yz;
    let (sin, cos) = element.theta.sin_cos();
    // R·T·Rᵀ with R = [[cos, -sin], [sin, cos]].
    let r_yy = cos * cos * m_yy + sin * sin * m_zz - 2.0 * cos * sin * m_yz;
    let r_zz = sin * sin * m_yy + cos * cos * m_zz + 2.0 * cos * sin * m_yz;
    let r_yz = cos * sin * (m_yy - m_zz) + (cos * cos - sin * sin) * m_yz;
    let offset = [element.dy, element.dz];
    let i_y2 = r_yy + area_raw * offset[0] * offset[0];
    let i_z2 = r_zz + area_raw * offset[1] * offset[1];
    let i_yz = r_yz + area_raw * offset[0] * offset[1];

    // Global orientation: extents after rotation.
    let raw_w = raw_bounds_width(&prims);
    let raw_h = raw_bounds_height(&prims);
    let abs_cos = cos.abs();
    let abs_sin = sin.abs();
    let width_y = raw_w * abs_cos + raw_h * abs_sin;
    let height_z = raw_w * abs_sin + raw_h * abs_cos;
    let horizontal = width_y >= height_z;

    // Global bounds (exact for rects; the sampled arcs add < 1e-4·r).
    let mut bounds = [
        f64::INFINITY,
        f64::NEG_INFINITY,
        f64::INFINITY,
        f64::NEG_INFINITY,
    ];
    let mut paths: Vec<Vec<[f64; 2]>> = Vec::new();
    let mut plastic: Vec<Vec<[f64; 2]>> = Vec::new();
    for signed in &prims {
        for path in signed.prim.outline(DRAW_SAMPLES) {
            let mut transformed: Vec<[f64; 2]> = path
                .iter()
                .map(|&p| transform_point(p, raw_centre, [my, mz], cos, sin, offset))
                .collect();
            if signed.sign > 0.0 {
                ensure_ccw(&mut transformed);
            } else {
                ensure_cw(&mut transformed);
            }
            for p in &transformed {
                bounds[0] = bounds[0].min(p[0]);
                bounds[1] = bounds[1].max(p[0]);
                bounds[2] = bounds[2].min(p[1]);
                bounds[3] = bounds[3].max(p[1]);
            }
            paths.push(transformed.clone());
            // Fillet patches enter the plastic decomposition exclusively as
            // the corner triangle fan below (their closed outline is
            // non-convex and would break the half-plane clip contract).
            if !matches!(signed.prim, Prim::Fillet { .. }) {
                plastic.push(transformed);
            }
        }
    }
    // Fillet patches enter the plastic decomposition as a corner triangle
    // fan over the sampled arc (chord slivers < 1e-4 relative).
    for signed in &prims {
        if let Prim::Fillet { cy, cz, r, sx, sz } = signed.prim {
            let corner = [cy, cz];
            let mut arc: Vec<[f64; 2]> = Vec::with_capacity(ARC_SAMPLES + 1);
            for i in 0..=ARC_SAMPLES {
                let angle = std::f64::consts::FRAC_PI_2 * (i as f64) / (ARC_SAMPLES as f64);
                let u = r - r * angle.cos();
                let v = r - r * angle.sin();
                arc.push(transform_point(
                    [cy + sx * u, cz + sz * v],
                    raw_centre,
                    [my, mz],
                    cos,
                    sin,
                    offset,
                ));
            }
            let corner_global = transform_point(corner, raw_centre, [my, mz], cos, sin, offset);
            for i in 0..ARC_SAMPLES {
                let mut tri = vec![corner_global, arc[i], arc[i + 1]];
                if signed.sign > 0.0 {
                    ensure_ccw(&mut tri);
                } else {
                    ensure_cw(&mut tri);
                }
                plastic.push(tri);
            }
        }
    }

    // Per-element EN 1993-1-1 §6.2.6 shear areas (element-local frame).
    let (a_v_local_y, a_v_local_z) = match &tag {
        ElementTag::Plate { .. } => (area_raw, area_raw),
        ElementTag::Chs { .. } => {
            let av = 2.0 * area_raw / std::f64::consts::PI;
            (av, av)
        }
        ElementTag::Rhs {
            h: depth, b: width, ..
        } => (
            area_raw * width / (depth + width),
            area_raw * depth / (depth + width),
        ),
        ElementTag::Profile { dims, family } => {
            let [depth, width, web_t, flange_t, root_r] = *dims;
            match family {
                ProfileFamily::Chs => {
                    let av = 2.0 * area_raw / std::f64::consts::PI;
                    (av, av)
                }
                ProfileFamily::Shs | ProfileFamily::Rhs => (
                    area_raw * width / (depth + width),
                    area_raw * depth / (depth + width),
                ),
                ProfileFamily::L => (width * flange_t * 2.0, depth * web_t),
                ProfileFamily::Upn | ProfileFamily::Upe => {
                    // Channel: web-direction shear per the conservative
                    // web-only rule of EN 1993-1-1 §6.2.6, flange-set minor.
                    (
                        (depth - 2.0 * flange_t).max(0.0) * web_t,
                        2.0 * width * flange_t,
                    )
                }
                _ => {
                    // Rolled/welded I, H and U: web-direction shear per
                    // §6.2.6(1)(a)/(c) with the 1.2·hw·tw floor, flange-set
                    // shear 2·b·tf.
                    let web_depth = (depth - 2.0 * flange_t).max(0.0);
                    let av_web = (area_raw - 2.0 * width * flange_t
                        + (web_t + 2.0 * root_r) * flange_t)
                        .max(1.2 * web_depth * web_t);
                    (2.0 * width * flange_t, av_web)
                }
            }
        }
    };

    Ok(ElementMechanics {
        index,
        a: area_raw,
        centroid: offset,
        i_y2,
        i_z2,
        i_yz,
        it,
        iw_own,
        i_width_y: t_yy,
        i_width_z: t_zz,
        a_v_local_y,
        a_v_local_z,
        horizontal,
        theta: element.theta,
        tag,
        bounds,
        paths,
        plastic,
    })
}

/// Raw-frame y-extent of a primitive set.
fn raw_bounds_width(prims: &[SignedPrim]) -> f64 {
    let mut lo = f64::INFINITY;
    let mut hi = f64::NEG_INFINITY;
    for signed in prims {
        let b = signed.prim.raw_bounds();
        lo = lo.min(b[0]);
        hi = hi.max(b[1]);
    }
    (hi - lo).max(0.0)
}

/// Raw-frame z-extent of a primitive set.
fn raw_bounds_height(prims: &[SignedPrim]) -> f64 {
    let mut lo = f64::INFINITY;
    let mut hi = f64::NEG_INFINITY;
    for signed in prims {
        let b = signed.prim.raw_bounds();
        lo = lo.min(b[2]);
        hi = hi.max(b[3]);
    }
    (hi - lo).max(0.0)
}

// ---------------------------------------------------------------------------
// Classification (EN 1993-1-1 Table 5.2)
// ---------------------------------------------------------------------------

/// Classifies one `c/t` ratio against a Table 5.2 row.
fn classify_ratio(ratio: f64, limits: [f64; 3], eps: f64) -> u8 {
    if ratio <= limits[0] * eps {
        1
    } else if ratio <= limits[1] * eps {
        2
    } else if ratio <= limits[2] * eps {
        3
    } else {
        4
    }
}

/// Intervals of one axis, used for neighbour detection.
type Interval = (f64, f64);

fn overlaps(a: Interval, b: Interval) -> bool {
    // 1e-6 m tolerance: plates that merely touch (a flange resting on a
    // web) count as connected for the classification neighbour search.
    a.0 < b.1 + 1e-6 && b.0 < a.1 + 1e-6
}

fn contains(a: Interval, b: Interval) -> bool {
    a.0 <= b.0 + 1e-9 && b.1 <= a.1 + 1e-9
}

/// EN 1993-1-1 Table 5.2 classification of the composite for pure bending
/// and pure compression. Returns `(class_bending, class_compression, parts)`.
fn classify_composite(
    elements: &[ElementMechanics],
    grade: SteelGrade,
) -> (u8, u8, Vec<ClassificationPart>) {
    let eps = (235.0e6 / grade.fy()).sqrt();
    let mut parts: Vec<ClassificationPart> = Vec::new();

    for element in elements {
        let label = format!("element {}", element.index + 1);
        let z_span = (element.bounds[2], element.bounds[3]);
        let y_span = (element.bounds[0], element.bounds[1]);
        match &element.tag {
            ElementTag::Chs { d, t } => {
                // Sheet 3: d/t <= 50 eps² bending, <= 42 eps² compression.
                let ratio = d / (t * eps * eps);
                let bending = if ratio <= 50.0 {
                    1
                } else if ratio <= 70.0 {
                    2
                } else if ratio <= 90.0 {
                    3
                } else {
                    4
                };
                let compression = if ratio <= 42.0 { 1 } else { 4 };
                parts.push(ClassificationPart {
                    label: format!("{label} CHS d/t"),
                    c_over_t: d / t,
                    limit_class1: 50.0,
                    class: bending,
                    internal: true,
                    pure_compression: false,
                });
                parts.push(ClassificationPart {
                    label: format!("{label} CHS d/t"),
                    c_over_t: d / t,
                    limit_class1: 42.0,
                    class: compression,
                    internal: true,
                    pure_compression: true,
                });
            }
            ElementTag::Rhs { h, b, t } => {
                // Welded walls: c = h − 2t / b − 2t (catalog hot-rolled rows
                // use 3t; the parametric walls are butt welded).
                for (row_label, ratio) in [
                    (format!("{label} web"), (h - 2.0 * t) / t),
                    (format!("{label} flange"), (b - 2.0 * t) / t),
                ] {
                    parts.push(ClassificationPart {
                        label: row_label.clone(),
                        c_over_t: ratio,
                        limit_class1: 72.0,
                        class: classify_ratio(ratio, [72.0, 83.0, 124.0], eps),
                        internal: true,
                        pure_compression: false,
                    });
                    parts.push(ClassificationPart {
                        label: row_label,
                        c_over_t: ratio,
                        limit_class1: 33.0,
                        class: classify_ratio(ratio, [33.0, 38.0, 42.0], eps),
                        internal: true,
                        pure_compression: true,
                    });
                }
            }
            ElementTag::Plate { thickness } => {
                let vertical = !element.horizontal;
                if vertical {
                    // Internal web: clear height between the flanking
                    // horizontal plates that cover its y-interval.
                    let mut top = z_span.1;
                    let mut bottom = z_span.0;
                    for other in elements {
                        if other.index == element.index || !other.horizontal {
                            continue;
                        }
                        let oy = (other.bounds[0], other.bounds[1]);
                        if !contains(oy, y_span) {
                            continue;
                        }
                        let oz = (other.bounds[2], other.bounds[3]);
                        if oz.0 >= z_span.1 - 1e-9 {
                            top = top.min(oz.0);
                        }
                        if oz.1 <= z_span.0 + 1e-9 {
                            bottom = bottom.max(oz.1);
                        }
                    }
                    let c = (top - bottom).max(*thickness);
                    let ratio = c / thickness;
                    parts.push(ClassificationPart {
                        label: format!("{label} web"),
                        c_over_t: ratio,
                        limit_class1: 72.0,
                        class: classify_ratio(ratio, [72.0, 83.0, 124.0], eps),
                        internal: true,
                        pure_compression: false,
                    });
                    parts.push(ClassificationPart {
                        label: format!("{label} web"),
                        c_over_t: ratio,
                        limit_class1: 33.0,
                        class: classify_ratio(ratio, [33.0, 38.0, 42.0], eps),
                        internal: true,
                        pure_compression: true,
                    });
                } else {
                    // Horizontal plate: split the y-span by the supporting
                    // webs; interior segments are internal, end segments are
                    // outstands.
                    let mut supports: Vec<Interval> = Vec::new();
                    for other in elements {
                        if other.index == element.index || other.horizontal {
                            continue;
                        }
                        let oy = (other.bounds[0], other.bounds[1]);
                        let oz = (other.bounds[2], other.bounds[3]);
                        if overlaps(oz, z_span) && overlaps(oy, y_span) {
                            supports.push((oy.0.max(y_span.0), oy.1.min(y_span.1)));
                        }
                    }
                    supports.sort_by(|a, b| a.0.total_cmp(&b.0));
                    let mut cursor = y_span.0;
                    let mut segments: Vec<Interval> = Vec::new();
                    for support in &supports {
                        if support.0 > cursor + 1e-9 {
                            segments.push((cursor, support.0));
                        }
                        cursor = cursor.max(support.1);
                    }
                    if cursor < y_span.1 - 1e-9 {
                        segments.push((cursor, y_span.1));
                    }
                    // Two or more supports bound every gap as internal.
                    let internal = supports.len() >= 2;
                    let limits = if internal {
                        [72.0, 83.0, 124.0]
                    } else {
                        [9.0, 10.0, 14.0]
                    };
                    let c_limits = if internal {
                        [33.0, 38.0, 42.0]
                    } else {
                        [9.0, 10.0, 14.0]
                    };
                    for seg in segments {
                        let c = (seg.1 - seg.0).max(*thickness);
                        let ratio = c / thickness;
                        parts.push(ClassificationPart {
                            label: format!(
                                "{label} {}",
                                if internal { "flange" } else { "outstand" }
                            ),
                            c_over_t: ratio,
                            limit_class1: limits[0],
                            class: classify_ratio(ratio, limits, eps),
                            internal,
                            pure_compression: false,
                        });
                        parts.push(ClassificationPart {
                            label: format!(
                                "{label} {}",
                                if internal { "flange" } else { "outstand" }
                            ),
                            c_over_t: ratio,
                            limit_class1: c_limits[0],
                            class: classify_ratio(ratio, c_limits, eps),
                            internal,
                            pure_compression: true,
                        });
                    }
                }
            }
            ElementTag::Profile { dims, family } => {
                let [h, b, tw, tf, r] = *dims;
                match family {
                    ProfileFamily::Chs => {
                        let ratio = h / (tw * eps * eps);
                        let bending = if ratio <= 50.0 {
                            1
                        } else if ratio <= 70.0 {
                            2
                        } else if ratio <= 90.0 {
                            3
                        } else {
                            4
                        };
                        let compression = if ratio <= 42.0 { 1 } else { 4 };
                        parts.push(ClassificationPart {
                            label: format!("{label} CHS d/t"),
                            c_over_t: h / tw,
                            limit_class1: 50.0,
                            class: bending,
                            internal: true,
                            pure_compression: false,
                        });
                        parts.push(ClassificationPart {
                            label: format!("{label} CHS d/t"),
                            c_over_t: h / tw,
                            limit_class1: 42.0,
                            class: compression,
                            internal: true,
                            pure_compression: true,
                        });
                    }
                    ProfileFamily::Shs | ProfileFamily::Rhs => {
                        // Hot-finished hollow walls: c = h − 3t / b − 3t.
                        for (row_label, ratio) in [
                            (format!("{label} web"), (h - 3.0 * tw) / tw),
                            (format!("{label} flange"), (b - 3.0 * tw) / tw),
                        ] {
                            parts.push(ClassificationPart {
                                label: row_label.clone(),
                                c_over_t: ratio,
                                limit_class1: 72.0,
                                class: classify_ratio(ratio, [72.0, 83.0, 124.0], eps),
                                internal: true,
                                pure_compression: false,
                            });
                            parts.push(ClassificationPart {
                                label: row_label,
                                c_over_t: ratio,
                                limit_class1: 33.0,
                                class: classify_ratio(ratio, [33.0, 38.0, 42.0], eps),
                                internal: true,
                                pure_compression: true,
                            });
                        }
                    }
                    ProfileFamily::L => {
                        // EN 1993-1-1 Table 5.2 has no single-angle row: the
                        // legs are checked as outstands (conservative).
                        let ratio = (h - tw) / tw;
                        for compression in [false, true] {
                            parts.push(ClassificationPart {
                                label: format!("{label} leg outstand"),
                                c_over_t: ratio,
                                limit_class1: 9.0,
                                class: classify_ratio(ratio, [9.0, 10.0, 14.0], eps),
                                internal: false,
                                pure_compression: compression,
                            });
                        }
                    }
                    _ => {
                        // Flange outstand c = (b − tw − 2r)/2, web c = h − 2tf − 2r.
                        let c_flange = ((b - tw - 2.0 * r) / 2.0).max(1e-9) / tf;
                        let c_web = ((h - 2.0 * tf - 2.0 * r).max(1e-9)) / tw;
                        for compression in [false, true] {
                            parts.push(ClassificationPart {
                                label: format!("{label} flange"),
                                c_over_t: c_flange,
                                limit_class1: 9.0,
                                class: classify_ratio(c_flange, [9.0, 10.0, 14.0], eps),
                                internal: false,
                                pure_compression: compression,
                            });
                            parts.push(ClassificationPart {
                                label: format!("{label} web"),
                                c_over_t: c_web,
                                limit_class1: if compression { 33.0 } else { 72.0 },
                                class: if compression {
                                    classify_ratio(c_web, [33.0, 38.0, 42.0], eps)
                                } else {
                                    classify_ratio(c_web, [72.0, 83.0, 124.0], eps)
                                },
                                internal: true,
                                pure_compression: compression,
                            });
                        }
                    }
                }
            }
        }
    }

    let worst = |compression: bool| -> u8 {
        parts
            .iter()
            .filter(|p| p.pure_compression == compression)
            .map(|p| p.class)
            .max()
            .unwrap_or(1)
    };
    (worst(false), worst(true), parts)
}

// ---------------------------------------------------------------------------
// Top-level computation
// ---------------------------------------------------------------------------

/// Computes the exact analytical mechanics of a composite section.
///
/// # Errors
///
/// Returns [`CompositeSectionError`] for empty definitions, unknown profile
/// designations and non-positive or impossible dimensions.
pub fn compute_composite_section(
    def: &CompositeSectionDef,
) -> Result<CompositeSectionResult, CompositeSectionError> {
    if def.elements.is_empty() {
        return Err(CompositeSectionError::EmptySection {
            name: def.name.clone(),
        });
    }
    let elements: Vec<ElementMechanics> = def
        .elements
        .iter()
        .enumerate()
        .map(|(index, element)| build_element(def, index, element))
        .collect::<Result<_, _>>()?;

    // Aggregate exact integrals (elements' centroids sit exactly at (dy, dz)).
    let a_total: f64 = elements.iter().map(|e| e.a).sum();
    let sy: f64 = elements.iter().map(|e| e.a * e.centroid[0]).sum();
    let sz: f64 = elements.iter().map(|e| e.a * e.centroid[1]).sum();
    let y_g = sy / a_total;
    let z_g = sz / a_total;
    let i_y2: f64 = elements.iter().map(|e| e.i_y2).sum(); // integral(y²)
    let i_z2: f64 = elements.iter().map(|e| e.i_z2).sum(); // integral(z²)
    let i_yz: f64 = elements.iter().map(|e| e.i_yz).sum();
    let iy = i_z2 - a_total * z_g * z_g;
    let iz = i_y2 - a_total * y_g * y_g;
    let iyz = i_yz - a_total * y_g * z_g;

    // Principal axes: Iu/v closed forms; alpha from the Mohr rotation,
    // verified against the major moment.
    let half = (iy - iz) / 2.0;
    let root = (half * half + iyz * iyz).sqrt();
    let iu = iy.midpoint(iz) + root;
    let iv = iy.midpoint(iz) - root;
    let mut alpha = 0.5 * f64::atan2(2.0 * iyz, iz - iy);
    let i_at_alpha =
        iz * alpha.sin() * alpha.sin() + iy * alpha.cos() * alpha.cos() - iyz * (2.0 * alpha).sin();
    if (i_at_alpha - iv).abs() < (i_at_alpha - iu).abs() {
        alpha += std::f64::consts::FRAC_PI_2;
    }
    if alpha > std::f64::consts::FRAC_PI_2 {
        alpha -= std::f64::consts::PI;
    } else if alpha <= -std::f64::consts::FRAC_PI_2 {
        alpha += std::f64::consts::PI;
    }

    // Extreme fibres (composite frame -> centroid-relative).
    let mut bounds = [
        f64::INFINITY,
        f64::NEG_INFINITY,
        f64::INFINITY,
        f64::NEG_INFINITY,
    ];
    for element in &elements {
        bounds[0] = bounds[0].min(element.bounds[0]);
        bounds[1] = bounds[1].max(element.bounds[1]);
        bounds[2] = bounds[2].min(element.bounds[2]);
        bounds[3] = bounds[3].max(element.bounds[3]);
    }
    let (y_min, y_max, z_min, z_max) = (
        bounds[0] - y_g,
        bounds[1] - y_g,
        bounds[2] - z_g,
        bounds[3] - z_g,
    );
    let wel_y_sup = if z_max.abs() > 0.0 {
        iy / z_max.abs()
    } else {
        0.0
    };
    let wel_y_inf = if z_min.abs() > 0.0 {
        iy / z_min.abs()
    } else {
        0.0
    };
    let wel_z_left = if y_min.abs() > 0.0 {
        iz / y_min.abs()
    } else {
        0.0
    };
    let wel_z_right = if y_max.abs() > 0.0 {
        iz / y_max.abs()
    } else {
        0.0
    };

    // Exact plastic moduli by equal-area bisection on signed polygons.
    let plastic: Vec<Vec<[f64; 2]>> = elements
        .iter()
        .flat_map(|e| e.plastic.iter().cloned())
        .collect();
    let vertical = solve_plastic_axis(&plastic, 0, a_total, sy, bounds);
    let horizontal = solve_plastic_axis(&plastic, 1, a_total, sz, bounds);

    // Shear areas (§6.2.6): profile and web-like elements contribute their
    // own rule; horizontal plates only add when no web carries the shear.
    let has_web = elements
        .iter()
        .any(|e| !e.horizontal || matches!(e.tag, ElementTag::Profile { .. }));
    let has_flange = elements.iter().any(|e| e.horizontal);
    let multi = elements.len() > 1;
    let mut a_vy = 0.0;
    let mut a_vz = 0.0;
    for element in &elements {
        let (av_y, av_z) = if matches!(element.tag, ElementTag::Plate { .. }) {
            if element.horizontal {
                // Flange plates ride the weak-axis shear set; they only
                // continue the web band when no web exists (solid plate).
                if has_web && multi {
                    (element.a_v_local_y, 0.0)
                } else {
                    (element.a_v_local_y, element.a_v_local_z)
                }
            } else {
                // Web plates ride the strong-axis shear; the weak-axis
                // set is carried by the flanges when they exist.
                if has_flange && multi {
                    (0.0, element.a_v_local_z)
                } else {
                    (element.a_v_local_y, element.a_v_local_z)
                }
            }
        } else {
            // Rotate the element-local pair into the global axes.
            let (cos, sin) = (element.theta.cos().abs(), element.theta.sin().abs());
            let (ly, lz) = (element.a_v_local_y, element.a_v_local_z);
            (cos * ly + sin * lz, sin * ly + cos * lz)
        };
        a_vy += av_y;
        a_vz += av_z;
    }
    if a_vy <= 0.0 {
        a_vy = a_total;
    }
    if a_vz <= 0.0 {
        a_vz = a_total;
    }

    // Saint-Venant superposition + warping with the flange Steiner term.
    let it: f64 = elements.iter().map(|e| e.it).sum();
    let mut iw = 0.0;
    for element in &elements {
        iw += element.iw_own;
        let skew = (element.theta.sin().abs() > 1e-9) && (element.theta.cos().abs() > 1e-9);
        if skew {
            continue; // rotated elements: own warping only (documented).
        }
        if element.horizontal {
            iw += element.i_width_y * (element.centroid[1] - z_g).powi(2);
        } else {
            iw += element.i_width_z * (element.centroid[0] - y_g).powi(2);
        }
    }

    // EN 1993-1-1 Table 5.2 classification.
    let (class_bending, class_compression, classification) =
        classify_composite(&elements, def.grade);

    let outlines = elements
        .iter()
        .map(|e| ElementOutline {
            label: format!("element {}", e.index + 1),
            paths: e.paths.clone(),
        })
        .collect();

    let shape = infer_shape(&elements);
    let (tw_hint, tf_hint) = governing_dims(&elements, y_g, bounds);
    let wel_y = wel_y_sup.min(wel_y_inf);
    let wel_z = wel_z_left.min(wel_z_right);
    let section_properties = SectionProperties {
        shape,
        a: a_total,
        iy,
        iz,
        it,
        iw: if iw > 0.0 { Some(iw) } else { None },
        wel_y,
        wel_z,
        wpl_y: Some(horizontal.wpl),
        wpl_z: Some(vertical.wpl),
        h: Some(bounds[3] - bounds[2]),
        b: Some(bounds[1] - bounds[0]),
        tw: Some(tw_hint),
        tf: Some(tf_hint),
        r: Some(0.0),
    };

    Ok(CompositeSectionResult {
        name: def.name.clone(),
        grade_code: def.grade.code().to_owned(),
        a: a_total,
        mass_per_m: STEEL_DENSITY * a_total,
        y_g,
        z_g,
        iy,
        iz,
        iyz,
        iu,
        iv,
        alpha_rad: alpha,
        i_radius_y: (iy / a_total).sqrt(),
        i_radius_z: (iz / a_total).sqrt(),
        z_min,
        z_max,
        y_min,
        y_max,
        wel_y_sup,
        wel_y_inf,
        wel_z_left,
        wel_z_right,
        wel_y,
        wel_z,
        wpl_y: horizontal.wpl,
        wpl_z: vertical.wpl,
        pna_for_my: horizontal.position,
        pna_for_mz: vertical.position,
        a_vy,
        a_vz,
        it,
        iw,
        class_bending,
        class_compression,
        classification,
        elements: outlines,
        bounds,
        section_properties,
    })
}

/// Infers the closest [`SectionShape`] family from the element mix.
fn infer_shape(elements: &[ElementMechanics]) -> SectionShape {
    let profile_family = |e: &ElementMechanics| match &e.tag {
        ElementTag::Profile { family, .. } => Some(*family),
        _ => None,
    };
    let families: Vec<Option<ProfileFamily>> = elements.iter().map(profile_family).collect();
    if elements
        .iter()
        .all(|e| matches!(e.tag, ElementTag::Chs { .. }))
        || families.iter().all(|f| *f == Some(ProfileFamily::Chs))
    {
        return SectionShape::CircularHollow;
    }
    if elements
        .iter()
        .all(|e| matches!(e.tag, ElementTag::Rhs { .. }))
        || families
            .iter()
            .all(|f| matches!(f, Some(ProfileFamily::Shs | ProfileFamily::Rhs)))
    {
        return SectionShape::RectangularHollow;
    }
    if families
        .iter()
        .all(|f| matches!(f, Some(ProfileFamily::Upn | ProfileFamily::Upe)))
    {
        return SectionShape::Channel;
    }
    if families.iter().all(|f| *f == Some(ProfileFamily::L)) {
        return SectionShape::Angle;
    }
    if families.iter().all(|f| {
        matches!(
            f,
            Some(ProfileFamily::Ipe | ProfileFamily::Hea | ProfileFamily::Heb | ProfileFamily::Hem)
        )
    }) {
        return SectionShape::DoubleSymmetricI;
    }
    // Mixed built-ups: welded I-like when a web band + flange plates exist
    // and every element is axis-aligned (no oblique rotation).
    let has_web = elements.iter().any(|e| !e.horizontal);
    let has_flange = elements.iter().any(|e| e.horizontal);
    let axis_aligned = elements
        .iter()
        .all(|e| e.theta.sin().abs() < 1e-9 || e.theta.cos().abs() < 1e-9);
    if has_web && has_flange && axis_aligned {
        return SectionShape::DoubleSymmetricI;
    }
    SectionShape::General
}

/// Central web thickness and top flange thickness of the composite (the
/// `tw` / `tf` the EN 1993-1-1 checks consume through the mapped dims).
fn governing_dims(elements: &[ElementMechanics], y_g: f64, bounds: [f64; 4]) -> (f64, f64) {
    let mut tw = 0.0;
    for element in elements {
        // Only web-like (vertical) members over the centroidal band count.
        if element.horizontal {
            continue;
        }
        let covers_centre = element.bounds[0] - 1e-9 <= y_g && y_g <= element.bounds[1] + 1e-9;
        if covers_centre {
            match &element.tag {
                ElementTag::Plate { thickness } => tw += *thickness,
                ElementTag::Profile { dims, .. } => tw += dims[2],
                ElementTag::Rhs { t, .. } => tw += 2.0 * t,
                ElementTag::Chs { .. } => {}
            }
        }
    }
    // Topmost horizontal plate thickness.
    let mut tf = 0.0;
    let mut best_z = f64::NEG_INFINITY;
    for element in elements {
        if !element.horizontal {
            continue;
        }
        let top = element.bounds[3];
        if top > best_z {
            best_z = top;
            tf = match &element.tag {
                ElementTag::Plate { thickness } => *thickness,
                ElementTag::Profile { dims, .. } => dims[3],
                ElementTag::Rhs { t, .. } => *t,
                ElementTag::Chs { .. } => 0.0,
            };
        }
    }
    let depth = bounds[3] - bounds[2];
    let width = bounds[1] - bounds[0];
    (
        if tw > 0.0 { tw } else { depth.min(width) * 0.1 },
        if tf > 0.0 { tf } else { depth * 0.1 },
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_abs_diff_eq;

    #[test]
    fn fillet_patch_integrals_match_the_closed_forms() {
        let r = 0.015;
        let int = Prim::Fillet {
            cy: 0.0,
            cz: 0.0,
            r,
            sx: 1.0,
            sz: 1.0,
        }
        .integrals();
        assert_abs_diff_eq!(int[0], r * r * (1.0 - std::f64::consts::FRAC_PI_4));
        // Centroid distance from the corner.
        let x_bar = int[1] / int[0];
        assert_abs_diff_eq!(
            x_bar,
            r * (5.0 / 6.0 - std::f64::consts::FRAC_PI_4) / (1.0 - std::f64::consts::FRAC_PI_4)
        );
        assert_abs_diff_eq!(
            int[3],
            r.powi(4) * (1.0 - 5.0 * std::f64::consts::PI / 16.0)
        );
    }

    #[test]
    fn polygon_green_integrals_match_a_rectangle() {
        let pts = vec![[0.0, 0.0], [2.0, 0.0], [2.0, 1.0], [0.0, 1.0]];
        let [a, sy, sz] = polygon_first_integrals(&pts);
        assert_abs_diff_eq!(a, 2.0);
        assert_abs_diff_eq!(sy, 2.0);
        assert_abs_diff_eq!(sz, 1.0);
    }

    #[test]
    fn plastic_bisection_reproduces_the_rectangle_modulus() {
        let b = 0.1_f64;
        let h = 0.3_f64;
        let polys = vec![vec![
            [-b / 2.0, -h / 2.0],
            [b / 2.0, -h / 2.0],
            [b / 2.0, h / 2.0],
            [-b / 2.0, h / 2.0],
        ]];
        let a_total = b * h;
        let axis = solve_plastic_axis(
            &polys,
            1,
            a_total,
            0.0,
            [-b / 2.0, b / 2.0, -h / 2.0, h / 2.0],
        );
        assert_abs_diff_eq!(axis.wpl, b * h * h / 4.0, epsilon = 1e-12);
        assert_abs_diff_eq!(axis.position, 0.0, epsilon = 1e-9);
    }
}
