import type { BeamData, LoadData, NodeData, ProjectData, SupportData } from "@/state/projectStore";

/**
 * M9.1 — 1-Click Topological Cleanup ("Compacter / Nettoyer le modèle",
 * RDM6/7 _Ossatures_ §3.7) + M9.2 beam subdivision (§3.8.13).
 *
 * Every function here is a DETERMINISTIC PURE transform over the canonical
 * `.rdm` project shape (`state/projectStore.ts`): no store access, no
 * hidden state, SI metres everywhere. Each returns a brand-new project
 * object so the zundo temporal history stays undo-friendly.
 */

export const SUBDIVIDE_MIN = 2;
export const SUBDIVIDE_MAX = 50;

export interface CompactStats {
  mergedNodes: number;
  splitBeams: number;
  removedDuplicates: number;
  removedOrphans: number;
}

interface SplitCandidate {
  /** Parametric position along the host beam, in (0, 1). */
  t: number;
  /** Existing node to weld onto the junction (T-junction case), if any. */
  nodeId?: number;
  /** Intersection point (m). */
  x: number;
  y: number;
  z: number;
}

export interface CleanupResult {
  project: ProjectData;
  /** Number of nodes welded away by the merge step. */
  mergedNodes: number;
}

export interface SplitResult {
  project: ProjectData;
  /** Number of host beams actually cut. */
  splitBeams: number;
}

export interface SubdivideResult {
  project: ProjectData;
  /** The clamped number of tronçons the beam was cut into (2–50). */
  segments: number;
}

export interface PurgeResult {
  project: ProjectData;
  removedOrphans: number;
}

export interface DeduplicateResult {
  project: ProjectData;
  removedDuplicates: number;
}

export interface CompactResult {
  project: ProjectData;
  stats: CompactStats;
}

// --- small geometry helpers (pure) ---------------------------------------

interface Pt {
  x: number;
  y: number;
  z: number;
}

function nodePoint(nodes: NodeData[], id: number): NodeData | undefined {
  return nodes.find((n) => n.id === id);
}

function beamEndpoints(nodes: NodeData[], beam: BeamData): [Pt, Pt] | undefined {
  const a = nodePoint(nodes, beam.n1);
  const b = nodePoint(nodes, beam.n2);
  return a !== undefined && b !== undefined ? [a, b] : undefined;
}

export function distance3(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Closest-approach parameters of segments AB and CD: returns the
 * parameters (t on AB, s on CD) of the closest pair of points and the
 * distance between the two lines at that pair (0 for a true crossing).
 */
function closestSegmentParams(a: Pt, b: Pt, c: Pt, d: Pt): { t: number; s: number; dist: number } {
  const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const v = { x: d.x - c.x, y: d.y - c.y, z: d.z - c.z };
  const w = { x: a.x - c.x, y: a.y - c.y, z: a.z - c.z };
  const uu = u.x * u.x + u.y * u.y + u.z * u.z;
  const uv = u.x * v.x + u.y * v.y + u.z * v.z;
  const vv = v.x * v.x + v.y * v.y + v.z * v.z;
  const wu = w.x * u.x + w.y * u.y + w.z * u.z;
  const wv = w.x * v.x + w.y * v.y + w.z * v.z;
  const denom = uu * vv - uv * uv;
  if (denom === 0 || uu === 0 || vv === 0) {
    // Parallel (or degenerate) segments: project C onto AB as a fallback.
    const t = uu === 0 ? 0 : Math.max(0, Math.min(1, -(wu / uu)));
    const p = { x: a.x + u.x * t, y: a.y + u.y * t, z: a.z + u.z * t };
    return { t, s: 0, dist: distance3(p, c) };
  }
  const t = Math.max(0, Math.min(1, (uv * wv - vv * wu) / denom));
  const s = Math.max(0, Math.min(1, (uu * wv - uv * wu) / denom));
  const p1 = {
    x: a.x + u.x * t,
    y: a.y + u.y * t,
    z: a.z + u.z * t,
  };
  const p2 = {
    x: c.x + v.x * s,
    y: c.y + v.y * s,
    z: c.z + v.z * s,
  };
  return { t, s, dist: distance3(p1, p2) };
}

/** Distance of point P from segment AB plus the parametric foot t. */
function pointSegment(p: Pt, a: Pt, b: Pt): { t: number; dist: number } {
  const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const uu = u.x * u.x + u.y * u.y + u.z * u.z;
  if (uu === 0) {
    return { t: 0, dist: distance3(p, a) };
  }
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * u.x + (p.y - a.y) * u.y + (p.z - a.z) * u.z) / uu),
  );
  const foot = { x: a.x + u.x * t, y: a.y + u.y * t, z: a.z + u.z * t };
  return { t, dist: distance3(p, foot) };
}

// --- id allocation --------------------------------------------------------

function nextNodeId(nodes: NodeData[]): number {
  return nodes.reduce((m, n) => Math.max(m, n.id), 0) + 1;
}

function nextBeamId(beams: BeamData[]): number {
  return beams.reduce((m, b) => Math.max(m, b.id), 0) + 1;
}

const RIGID: [boolean, boolean, boolean, boolean, boolean, boolean] = [
  false,
  false,
  false,
  false,
  false,
  false,
];

/**
 * Slices one host beam at the given parametric positions (sorted,
 * deduped): N cut points produce N+1 contiguous children inheriting
 * section / material / roll / buckling / behaviour, with the OUTER ends
 * keeping the original end releases and interior junctions rigid.
 * Beam loads are proportionally remapped onto the children.
 */
function sliceBeam(
  project: ProjectData,
  beam: BeamData,
  cuts: SplitCandidate[],
): { nodes: NodeData[]; beams: BeamData[]; loads: LoadData[] } | undefined {
  const nodes = project.structure.nodes;
  const ends = beamEndpoints(nodes, beam);
  if (ends === undefined) {
    return undefined;
  }
  const [a, b] = ends;
  const length = distance3(a, b);
  if (length === 0) {
    return undefined;
  }
  const loads = project.structure.loads.filter((l) => "beam_id" in l && l.beam_id === beam.id);

  // Cumulative parametric chain: 0 … t1 … tn … 1
  const chain: { t: number; nodeId?: number; x: number; y: number; z: number }[] = [
    { t: 0, nodeId: beam.n1, x: a.x, y: a.y, z: a.z },
    ...[...cuts].sort((p, q) => p.t - q.t),
    { t: 1, nodeId: beam.n2, x: b.x, y: b.y, z: b.z },
  ];
  const deduped: typeof chain = [];
  for (const c of chain) {
    const last = deduped.at(-1);
    if (last !== undefined && (c.t - last.t) * length <= 1e-9) {
      // Same physical point: prefer the candidate carrying an existing node.
      if (c.nodeId !== undefined && last.nodeId === undefined) {
        deduped[deduped.length - 1] = c;
      }
      continue;
    }
    deduped.push(c);
  }
  if (deduped.length === 2) {
    return undefined;
  }

  // Allocate ONE id per chain element up-front (existing node ids reused,
  // new junction nodes created exactly once) before slicing the children.
  let nid = nextNodeId(nodes);
  const chainIds = deduped.map((c) => {
    if (c.nodeId !== undefined) {
      return c.nodeId;
    }
    const id = nid;
    nid += 1;
    return id;
  });
  const newNodes: NodeData[] = deduped
    .map((c, i) => ({ c, id: chainIds[i] ?? 0 }))
    .filter(({ c }) => c.nodeId === undefined)
    .map(({ c, id }) => ({ id, x: c.x, y: c.y, z: c.z }));
  let bid = nextBeamId(project.structure.beams);
  const outer = project.structure.beams.filter((b) => b.id !== beam.id);
  const newBeams: BeamData[] = [];
  const newLoads: LoadData[] = [];

  // Child i spans [t_i, t_{i+1}] of the ORIGINAL beam.
  for (let i = 0; i < deduped.length - 1; i++) {
    const start = deduped[i];
    const end = deduped[i + 1];
    const startId = chainIds[i];
    const endId = chainIds[i + 1];
    if (start === undefined || end === undefined || startId === undefined || endId === undefined) {
      continue;
    }
    const spanT = end.t - start.t;
    const taper =
      beam.taper_end_scale === undefined ? undefined : 1 + (beam.taper_end_scale - 1) * end.t;
    const child: BeamData = {
      ...beam,
      id: bid++,
      n1: startId,
      n2: endId,
      releases_start: i === 0 ? [...beam.releases_start] : [...RIGID],
      releases_end: i === deduped.length - 2 ? [...beam.releases_end] : [...RIGID],
      ...(beam.end_offsets === undefined
        ? {}
        : {
            end_offsets:
              i === 0
                ? [beam.end_offsets[0], 0]
                : i === deduped.length - 2
                  ? [0, beam.end_offsets[1]]
                  : [0, 0],
          }),
      ...(taper === undefined ? {} : { taper_end_scale: taper }),
    };
    newBeams.push(child);
    newLoads.push(
      ...remapBeamLoads(loads, beam.id, child, spanT, start.t, length, i === deduped.length - 2),
    );
  }

  return {
    nodes: newNodes,
    beams: [...outer, ...newBeams],
    // Loads riding OTHER beams pass through untouched.
    loads: [
      ...project.structure.loads.filter((l) => !("beam_id" in l) || l.beam_id !== beam.id),
      ...newLoads,
    ],
  };
}

/**
 * Proportional load remap for one child span [t0, t1] of the original
 * beam (length `L`): trapezoid / uniform loads are re-sampled per child
 * (exact for the linear variation), point-on-span loads land on the host
 * child by cumulative length, thermal actions ride every child verbatim.
 * Absolute `a_start` / `a_end` metre windows are clamped and shifted onto
 * the child coordinate.
 */
function remapBeamLoads(
  loads: LoadData[],
  hostId: number,
  child: BeamData,
  spanT: number,
  t0: number,
  length: number,
  isLast: boolean,
): LoadData[] {
  const out: LoadData[] = [];
  for (const load of loads) {
    if (!("beam_id" in load) || load.beam_id !== hostId) {
      continue;
    }
    if (load.kind === "Thermal") {
      out.push({ ...load, beam_id: child.id });
      continue;
    }
    if (load.kind === "Trapezoid" || load.kind === "Uniform") {
      const q1 = load.q_start + (load.q_end - load.q_start) * t0;
      const q2 = load.q_start + (load.q_end - load.q_start) * (t0 + spanT);
      if (load.kind === "Uniform") {
        out.push({
          case: load.case,
          kind: "Uniform",
          beam_id: child.id,
          q_start: q1,
          q_end: q2,
          direction: { ...load.direction },
        });
        continue;
      }
      const childL = spanT * length;
      const aStart = load.a_start ?? null;
      const aEnd = load.a_end ?? null;
      const w0 = aStart === null ? 0 : Math.max(0, Math.min(childL, aStart - t0 * length));
      const w1 = aEnd === null ? childL : Math.max(0, Math.min(childL, aEnd - t0 * length));
      if (w1 - w0 <= 0 && (aStart !== null || aEnd !== null)) {
        continue;
      }
      out.push({
        case: load.case,
        kind: "Trapezoid",
        beam_id: child.id,
        q_start: q1,
        q_end: q2,
        direction: { ...load.direction },
        ...(load.local_axes == null ? {} : { local_axes: load.local_axes }),
        ...(aStart === null && aEnd === null
          ? {}
          : { a_start: w0 === 0 ? null : w0, a_end: w1 === childL ? null : w1 }),
      });
      continue;
    }
    if (load.kind === "PointOnSpan") {
      // Global parametric position of the point on the ORIGINAL beam —
      // half-open [t0, t0+spanT) ownership (last child takes the closed
      // end) so a point sitting exactly on a junction lands once.
      const g = load.position_ratio;
      const included = g >= t0 - 1e-12 && (g < t0 + spanT - 1e-12 || isLast);
      if (!included) {
        continue;
      }
      const local = spanT === 0 ? 0.5 : (g - t0) / spanT;
      out.push({
        case: load.case,
        kind: "PointOnSpan",
        beam_id: child.id,
        position_ratio: Math.max(0, Math.min(1, local)),
        forces: { ...load.forces },
      });
    }
  }
  return out;
}

// --- M9.1.1 mergeDuplicateNodes -------------------------------------------

/**
 * Welds coincident nodes within `tolM` (first occurrence wins), remaps
 * beams / supports / nodal loads onto the surviving representative and
 * drops the zero-length beams the weld creates.
 */
export function mergeDuplicateNodes(project: ProjectData, tolM = 1e-4): CleanupResult {
  const kept: NodeData[] = [];
  const remap = new Map<number, number>();
  let merged = 0;
  for (const node of project.structure.nodes) {
    const rep = kept.find((k) => distance3(k, node) <= tolM);
    if (rep !== undefined) {
      remap.set(node.id, rep.id);
      merged += 1;
    } else {
      kept.push({ ...node });
    }
  }
  if (merged === 0) {
    return { project, mergedNodes: 0 };
  }
  const beams: BeamData[] = [];
  for (const beam of project.structure.beams) {
    const n1 = remap.get(beam.n1) ?? beam.n1;
    const n2 = remap.get(beam.n2) ?? beam.n2;
    if (n1 === n2) {
      continue; // zero-length beam collapsed by the weld
    }
    beams.push({ ...beam, n1, n2 });
  }
  const supports: SupportData[] = [];
  const seenSupport = new Set<number>();
  for (const support of project.structure.supports) {
    const nodeId = remap.get(support.node_id) ?? support.node_id;
    if (seenSupport.has(nodeId)) {
      continue;
    }
    seenSupport.add(nodeId);
    supports.push({ ...support, node_id: nodeId });
  }
  const loads = project.structure.loads.map((load) =>
    load.kind === "Nodal" ? { ...load, node_id: remap.get(load.node_id) ?? load.node_id } : load,
  );
  return {
    project: {
      ...project,
      structure: { ...project.structure, nodes: kept, beams, supports, loads },
    },
    mergedNodes: merged,
  };
}

// --- M9.1.2 splitIntersectingBeams ----------------------------------------

/**
 * Detects T-junctions (an existing node lying strictly inside a beam) and
 * X-crossings (two non-coincident 3D segments intersecting within
 * `tolM`), cuts the host beam(s) at the intersection points, welds the
 * junction onto the existing node for T-junctions and proportionally
 * remaps the beam loads onto the children.
 */
export function splitIntersectingBeams(project: ProjectData, tolM = 1e-4): SplitResult {
  const nodes = project.structure.nodes;
  const beams = project.structure.beams;
  const cuts = new Map<number, SplitCandidate[]>();
  // X-crossing junctions are SHARED between the two cut hosts: each unique
  // crossing point registers one id up-front (deterministic discovery
  // order) and both candidates weld onto it.
  const junctions = new Map<string, { id: number; x: number; y: number; z: number }>();
  let nextJunctionId = nextNodeId(nodes);
  const junctionIdAt = (x: number, y: number, z: number): number => {
    const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
    const existing = junctions.get(key);
    if (existing !== undefined) {
      return existing.id;
    }
    const id = nextJunctionId;
    nextJunctionId += 1;
    junctions.set(key, { id, x, y, z });
    return id;
  };

  const addCut = (beamId: number, candidate: SplitCandidate): void => {
    const list = cuts.get(beamId) ?? [];
    list.push(candidate);
    cuts.set(beamId, list);
  };

  // T-junctions: existing node strictly inside a beam it does not bound.
  for (const beam of beams) {
    const ends = beamEndpoints(nodes, beam);
    if (ends === undefined) {
      continue;
    }
    const [a, b] = ends;
    const length = distance3(a, b);
    if (length === 0) {
      continue;
    }
    const eps = tolM / length;
    for (const node of nodes) {
      if (node.id === beam.n1 || node.id === beam.n2) {
        continue;
      }
      const { t, dist } = pointSegment(node, a, b);
      if (dist <= tolM && t > eps && t < 1 - eps) {
        addCut(beam.id, { t, nodeId: node.id, x: node.x, y: node.y, z: node.z });
      }
    }
  }

  // X-crossings: two segments intersecting at interior points.
  for (let i = 0; i < beams.length; i++) {
    const bi = beams[i];
    if (bi === undefined) {
      continue;
    }
    const ei = beamEndpoints(nodes, bi);
    if (ei === undefined) {
      continue;
    }
    for (let j = i + 1; j < beams.length; j++) {
      const bj = beams[j];
      if (bj === undefined) {
        continue;
      }
      // Non-coincident: distinct element pairs (a shared node is still a
      // valid crossing candidate — the strict-interior test filters it).
      const ej = beamEndpoints(nodes, bj);
      if (ej === undefined) {
        continue;
      }
      const { t, s, dist } = closestSegmentParams(ei[0], ei[1], ej[0], ej[1]);
      if (dist > tolM) {
        continue;
      }
      const li = distance3(ei[0], ei[1]);
      const lj = distance3(ej[0], ej[1]);
      const epsI = tolM / Math.max(li, 1e-12);
      const epsJ = tolM / Math.max(lj, 1e-12);
      if (t <= epsI || t >= 1 - epsI || s <= epsJ || s >= 1 - epsJ) {
        continue;
      }
      const p1 = {
        x: ei[0].x + (ei[1].x - ei[0].x) * t,
        y: ei[0].y + (ei[1].y - ei[0].y) * t,
        z: ei[0].z + (ei[1].z - ei[0].z) * t,
      };
      const p2 = {
        x: ej[0].x + (ej[1].x - ej[0].x) * s,
        y: ej[0].y + (ej[1].y - ej[0].y) * s,
        z: ej[0].z + (ej[1].z - ej[0].z) * s,
      };
      const mid = {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
        z: (p1.z + p2.z) / 2,
      };
      const junctionId = junctionIdAt(mid.x, mid.y, mid.z);
      addCut(bi.id, { t, nodeId: junctionId, ...mid });
      addCut(bj.id, { t: s, nodeId: junctionId, ...mid });
    }
  }

  if (cuts.size === 0) {
    return { project, splitBeams: 0 };
  }

  // Materialise the shared X-crossing junction nodes once, before the
  // slicing pass (T-junction candidates reuse nodes already in the model).
  let working: ProjectData = {
    ...project,
    structure: {
      ...project.structure,
      nodes: [
        ...nodes,
        ...[...junctions.values()].map((j) => ({ id: j.id, x: j.x, y: j.y, z: j.z })),
      ],
    },
  };
  let splitCount = 0;
  // Deterministic order: ascending beam id.
  for (const beamId of [...cuts.keys()].sort((a, b) => a - b)) {
    const beam = working.structure.beams.find((b) => b.id === beamId);
    const candidates = cuts.get(beamId);
    if (beam === undefined || candidates === undefined) {
      continue;
    }
    const sliced = sliceBeam(working, beam, candidates);
    if (sliced === undefined) {
      continue;
    }
    splitCount += 1;
    working = {
      ...working,
      structure: {
        ...working.structure,
        nodes: [...working.structure.nodes, ...sliced.nodes],
        beams: sliced.beams,
        loads: sliced.loads,
      },
    };
  }
  return { project: working, splitBeams: splitCount };
}

// --- M9.1.3 purgeOrphanNodes ----------------------------------------------

/** Removes nodes not referenced by any beam, support or nodal load. */
export function purgeOrphanNodes(project: ProjectData): PurgeResult {
  const referenced = new Set<number>();
  for (const beam of project.structure.beams) {
    referenced.add(beam.n1);
    referenced.add(beam.n2);
  }
  for (const support of project.structure.supports) {
    referenced.add(support.node_id);
  }
  for (const load of project.structure.loads) {
    if (load.kind === "Nodal") {
      referenced.add(load.node_id);
    }
  }
  const nodes = project.structure.nodes.filter((n) => referenced.has(n.id));
  return {
    project: { ...project, structure: { ...project.structure, nodes } },
    removedOrphans: project.structure.nodes.length - nodes.length,
  };
}

// --- deduplicateBeams ------------------------------------------------------

/**
 * Drops beams sharing the same unordered node pair AND section AND
 * material (keeps the first occurrence, deterministic in input order).
 */
export function deduplicateBeams(project: ProjectData): DeduplicateResult {
  const seen = new Set<string>();
  const beams: BeamData[] = [];
  for (const beam of project.structure.beams) {
    if (beam.n1 === beam.n2) {
      continue; // degenerate zero-length member
    }
    const key = `${Math.min(beam.n1, beam.n2)}-${Math.max(beam.n1, beam.n2)}|${beam.section_id}|${beam.material_id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    beams.push(beam);
  }
  return {
    project: { ...project, structure: { ...project.structure, beams } },
    removedDuplicates: project.structure.beams.length - beams.length,
  };
}

// --- M9.1.4 compactModel ---------------------------------------------------

/**
 * One atomic "Compacter / Nettoyer le modèle" pass (RDM6/7 _Ossatures_
 * §3.7): mergeDuplicateNodes → splitIntersectingBeams → deduplicateBeams
 * → purgeOrphanNodes, returning the per-step statistics for the toast.
 */
export function compactModel(project: ProjectData, tolM = 1e-4): CompactResult {
  const merged = mergeDuplicateNodes(project, tolM);
  const split = splitIntersectingBeams(merged.project, tolM);
  const deduped = deduplicateBeams(split.project);
  const purged = purgeOrphanNodes(deduped.project);
  return {
    project: purged.project,
    stats: {
      mergedNodes: merged.mergedNodes,
      splitBeams: split.splitBeams,
      removedDuplicates: deduped.removedDuplicates,
      removedOrphans: purged.removedOrphans,
    },
  };
}

// --- M9.2 subdivideBeam ----------------------------------------------------

/**
 * Cuts one member into `N` equal collinear tronçons (2 ≤ N ≤ 50,
 * _Ossatures_ §3.8.13): N−1 equidistant interior nodes, contiguous
 * children inheriting section / material / roll angle / buckling lengths,
 * outer ends keeping the original releases, interior junctions rigid and
 * beam loads proportionally remapped onto the sub-segments.
 */
export function subdivideBeam(
  project: ProjectData,
  beamId: number,
  segments: number,
): SubdivideResult {
  const n = Math.max(SUBDIVIDE_MIN, Math.min(SUBDIVIDE_MAX, Math.round(segments)));
  const beam = project.structure.beams.find((b) => b.id === beamId);
  if (beam === undefined) {
    return { project, segments: n };
  }
  const ends = beamEndpoints(project.structure.nodes, beam);
  if (ends === undefined) {
    return { project, segments: n };
  }
  const [a, b] = ends;
  const cuts: SplitCandidate[] = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    cuts.push({
      t,
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    });
  }
  const sliced = sliceBeam(project, beam, cuts);
  if (sliced === undefined) {
    return { project, segments: n };
  }
  return {
    project: {
      ...project,
      structure: {
        ...project.structure,
        nodes: [...project.structure.nodes, ...sliced.nodes],
        beams: sliced.beams,
        loads: sliced.loads,
      },
    },
    segments: n,
  };
}

// --- Auto-Split on Draw -----------------------------------------------------

/**
 * Auto-Split on Draw (M9.1): called right after a new beam `beamId` was
 * drawn — cuts any host beam the drawn beam lands strictly inside
 * (midpoint / interior landing) so the fresh member connects cleanly.
 */
export function autoSplitOnDraw(project: ProjectData, beamId: number, tolM = 1e-4): SplitResult {
  const beam = project.structure.beams.find((b) => b.id === beamId);
  if (beam === undefined) {
    return { project, splitBeams: 0 };
  }
  const nodes = project.structure.nodes;
  const ends = beamEndpoints(nodes, beam);
  if (ends === undefined) {
    return { project, splitBeams: 0 };
  }
  const cuts = new Map<number, SplitCandidate[]>();
  const drawn = [nodePoint(nodes, beam.n1), nodePoint(nodes, beam.n2)];
  for (const host of project.structure.beams) {
    if (host.id === beamId) {
      continue;
    }
    const hostEnds = beamEndpoints(nodes, host);
    if (hostEnds === undefined) {
      continue;
    }
    const [a, b] = hostEnds;
    const length = distance3(a, b);
    if (length === 0) {
      continue;
    }
    const eps = tolM / length;
    for (const p of drawn) {
      if (p === undefined || p.id === host.n1 || p.id === host.n2) {
        continue;
      }
      const { t, dist } = pointSegment(p, a, b);
      if (dist <= tolM && t > eps && t < 1 - eps) {
        const list = cuts.get(host.id) ?? [];
        list.push({ t, nodeId: p.id, x: p.x, y: p.y, z: p.z });
        cuts.set(host.id, list);
      }
    }
  }
  if (cuts.size === 0) {
    return { project, splitBeams: 0 };
  }
  let working = project;
  let splitCount = 0;
  for (const hostId of [...cuts.keys()].sort((x, y) => x - y)) {
    const host = working.structure.beams.find((b) => b.id === hostId);
    const candidates = cuts.get(hostId);
    if (host === undefined || candidates === undefined) {
      continue;
    }
    const sliced = sliceBeam(working, host, candidates);
    if (sliced === undefined) {
      continue;
    }
    splitCount += 1;
    working = {
      ...working,
      structure: {
        ...working.structure,
        nodes: [...working.structure.nodes, ...sliced.nodes],
        beams: sliced.beams,
        loads: sliced.loads,
      },
    };
  }
  return { project: working, splitBeams: splitCount };
}
