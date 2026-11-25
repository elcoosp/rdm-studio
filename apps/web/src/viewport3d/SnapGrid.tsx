import type { NodeData } from "@/state/projectStore";

/**
 * Magnetic snapping (ARCHITECTURE.md section 5, `SnapGrid.tsx`; section 8.8):
 * 10/50/100 mm metric grid steps, node snaps win over midpoints, midpoints
 * win over free grid points. Pure functions so vitest validates the ordering.
 */
export type SnapStep = 0.01 | 0.05 | 0.1;

export interface SnapCandidate {
  x: number;
  y: number;
  z: number;
  /** Glyph kind drives the 3D snap reticle (DESIGN.md micro-typography). */
  kind: "node" | "midpoint" | "grid" | "free";
  id?: number;
}

/** Nearest existing node within `tolerance`, else the closest beam midpoint. */
export function snapPoint(
  world: { x: number; y: number; z: number },
  nodes: NodeData[],
  beams: { id: number; n1: number; n2: number }[],
  nodeById: Map<number, NodeData>,
  step: SnapStep,
  tolerance = 0.12,
): SnapCandidate {
  let best: SnapCandidate | null = null;
  let bestDist = tolerance;
  for (const node of nodes) {
    const d = Math.hypot(node.x - world.x, node.y - world.y, node.z - world.z);
    if (d < bestDist) {
      bestDist = d;
      best = { x: node.x, y: node.y, z: node.z, kind: "node", id: node.id };
    }
  }
  if (best !== null) {
    return best;
  }
  bestDist = tolerance;
  for (const beam of beams) {
    const a = nodeById.get(beam.n1);
    const b = nodeById.get(beam.n2);
    if (a === undefined || b === undefined) {
      continue;
    }
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const mz = (a.z + b.z) / 2;
    const d = Math.hypot(mx - world.x, my - world.y, mz - world.z);
    if (d < bestDist) {
      bestDist = d;
      best = { x: mx, y: my, z: mz, kind: "midpoint", id: beam.id };
    }
  }
  if (best !== null) {
    return best;
  }
  const snap = (v: number) => Math.round(v / step) * step;
  return { x: snap(world.x), y: snap(world.y), z: snap(world.z), kind: "grid" };
}

/** Shift orthogonal lock: keep the dominant axis, zero the others. */
export function orthogonalLock(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const dz = Math.abs(to.z - from.z);
  const max = Math.max(dx, dy, dz);
  return {
    x: dx === max ? to.x : from.x,
    y: dy === max ? to.y : from.y,
    z: dz === max ? to.z : from.z,
  };
}
