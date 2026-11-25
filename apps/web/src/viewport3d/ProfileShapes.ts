import type { BeamData, NodeData } from "@/state/projectStore";

/**
 * True SI cross-section outlines (v1.0.0 bug 2): members extrude their real
 * catalog profile (`h, b, tw, tf` from `rdm-eurocode`) instead of an 80 mm
 * square box. Contours are 2D `[y, z]` polygons in metres, local section
 * axes; holes (CHS/RHS walls) triangulate as inner rings.
 */

export interface ProfileDims {
  /** Shape family name from the catalog (`DoubleSymmetricI`, ...). */
  shape: string;
  /** Overall depth (m). */
  h?: number;
  /** Flange width (m). */
  b?: number;
  /** Web thickness (m). */
  tw?: number;
  /** Flange thickness (m). */
  tf?: number;
}

export interface ProfileContour {
  /** Outer outline, counter-clockwise `[y, z]` pairs. */
  contour: [number, number][];
  /** Inner rings (hollow sections). */
  holes: [number, number][][];
}

/** Fallback square section (the pre-v1.0.0 rendering) for unknown profiles. */
export function squareOutline(width: number): ProfileContour {
  const hw = width / 2;
  return {
    contour: [
      [-hw, -hw],
      [hw, -hw],
      [hw, hw],
      [-hw, hw],
    ],
    holes: [],
  };
}

/** Builds the true outline for a catalog profile (metres). */
export function profileOutline(dims: ProfileDims): ProfileContour {
  const h = dims.h ?? 0.2;
  const b = dims.b ?? 0.1;
  const tw = dims.tw ?? 0.01;
  const tf = dims.tf ?? 0.01;
  switch (dims.shape) {
    case "DoubleSymmetricI": {
      const yF = b / 2;
      const zF = h / 2;
      const zWeb = h / 2 - tf;
      const yWeb = tw / 2;
      return {
        contour: [
          [-yF, -zF],
          [yF, -zF],
          [yF, -zWeb],
          [yWeb, -zWeb],
          [yWeb, zWeb],
          [yF, zWeb],
          [yF, zF],
          [-yF, zF],
          [-yF, zWeb],
          [-yWeb, zWeb],
          [-yWeb, -zWeb],
          [-yF, -zWeb],
        ],
        holes: [],
      };
    }
    case "Channel": {
      const yF = b / 2;
      const zF = h / 2;
      const zWeb = h / 2 - tf;
      return {
        contour: [
          [-yF, -zF],
          [yF, -zF],
          [yF, -zF + tf],
          [yF - tw, -zF + tf],
          [yF - tw, zF - tf],
          [yF, zF - tf],
          [yF, zF],
          [-yF, zF],
        ],
        holes: [],
      };
    }
    case "RectangularHollow": {
      const yF = b / 2;
      const zF = h / 2;
      return {
        contour: [
          [-yF, -zF],
          [yF, -zF],
          [yF, zF],
          [-yF, zF],
        ],
        holes: [
          [
            [-yF + tw, -zF + tf],
            [yF - tw, -zF + tf],
            [yF - tw, zF - tf],
            [-yF + tw, zF - tf],
          ],
        ],
      };
    }
    case "CircularHollow": {
      const r = h / 2;
      const ri = Math.max(r - tf, r * 0.3);
      const ring = (radius: number): [number, number][] =>
        Array.from({ length: 24 }, (_, i) => {
          const angle = (i / 24) * Math.PI * 2;
          return [radius * Math.cos(angle), radius * Math.sin(angle)];
        });
      return { contour: ring(r), holes: [ring(ri).reverse()] };
    }
    case "Angle": {
      const yF = b;
      const zF = h;
      return {
        contour: [
          [0, 0],
          [yF, 0],
          [yF, tf],
          [tw, tf],
          [tw, zF],
          [0, zF],
        ],
        holes: [],
      };
    }
    default: {
      // General / unknown: solid h × b rectangle.
      return {
        contour: [
          [-b / 2, -h / 2],
          [b / 2, -h / 2],
          [b / 2, h / 2],
          [-b / 2, h / 2],
        ],
        holes: [],
      };
    }
  }
}

/**
 * Per-beam profile lookup: the routes pass the catalog dims keyed by the
 * section designation used by each member.
 */
export function beamProfileLookup(
  beams: BeamData[],
  dimsByDesignation: Map<string, ProfileDims>,
): Map<number, ProfileDims> {
  const out = new Map<number, ProfileDims>();
  for (const beam of beams) {
    const dims = dimsByDesignation.get(beam.section_id);
    if (dims !== undefined) {
      out.set(beam.id, dims);
    }
  }
  return out;
}

/** Model bounding box (metres) for the auto-framed camera (bug 2). */
export function modelBounds(nodes: NodeData[]): {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  radius: number;
} {
  if (nodes.length === 0) {
    return { min: [0, 0, 0], max: [1, 1, 1], center: [0.5, 0.5, 0.5], radius: 1 };
  }
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const n of nodes) {
    min[0] = Math.min(min[0], n.x);
    min[1] = Math.min(min[1], n.y);
    min[2] = Math.min(min[2], n.z);
    max[0] = Math.max(max[0], n.x);
    max[1] = Math.max(max[1], n.y);
    max[2] = Math.max(max[2], n.z);
  }
  const center: [number, number, number] = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
  const radius =
    Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 1e-3) * 0.5 * Math.SQRT2;
  return { min, max, center, radius };
}
