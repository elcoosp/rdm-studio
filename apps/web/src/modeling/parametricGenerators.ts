import type { BeamData, NodeData, ProjectData, SupportData } from "@/state/projectStore";

/**
 * M9.3 — RDM6/7 Parametric Structure Generators (_Bibliothèque d'ossatures
 * paramétrées_, _Ossatures_ §3.10): four deterministic families producing
 * canonical `.rdm` structures in strict SI metres —
 *
 * 1. `portal`    — portique à traverse brisée / monopente (2D/3D),
 * 2. `truss`     — treillis plan Pratt / Howe / Warren (RDM6 #50–#58),
 * 3. `polonceau` — ferme à entrait retroussé / Polonceau (RDM6 #200–#206),
 * 4. `tower`     — pylône treillis 3D / tour tronconique (RDM6 #100–#105).
 *
 * Every generator is a pure function of its parameters: same input, same
 * node/beam ids, byte-identical output — the live SVG preview and the E2E
 * suite rely on that determinism.
 */

export interface Origin {
  x: number;
  y: number;
  z: number;
}

export interface PortalFrameParams {
  kind: "portal";
  /** Span per bay L (m). */
  span: number;
  /** Eave height H1 (m). */
  eaveHeight: number;
  /** Ridge height H2 (m). */
  ridgeHeight: number;
  /** Number of bays N (≥ 1). */
  bays: number;
  /** Traverse brisée (2 pans per bay) or monopente (single slope). */
  rafterProfile: "broken" | "mono";
  /** Number of parallel frames (3D depth, ≥ 1). */
  frames: number;
  /** Frame spacing L_y (m). */
  frameSpacing: number;
  /** Column section (HEA family). */
  columnSection: string;
  /** Rafter / purlin section (IPE family). */
  rafterSection: string;
  /** Base support preset: Encastrement or Rotule. */
  baseSupport: "fixed" | "pinned";
}

export interface TrussParams {
  kind: "truss";
  /** Diagonal pattern (RDM6 #50–#58). */
  type: "pratt" | "howe" | "warren";
  /** Span L (m). */
  span: number;
  /** Chord height at the ends H0 (m). */
  endHeight: number;
  /** Chord height at midspan Hc (m). */
  ridgeHeight: number;
  /** Panel count N (≥ 2). */
  panels: number;
  /** Chord section. */
  chordSection: string;
  /** Web diagonal section. */
  webSection: string;
  /** Articulate every diagonal (barre de treillis releases). */
  pinDiagonals: boolean;
}

export interface PolonceauParams {
  kind: "polonceau";
  /** Span between column axes L (m). */
  span: number;
  /** Column height H1 (m). */
  columnHeight: number;
  /** Truss rise above the eaves H2 (m). */
  riseHeight: number;
  /** Panel subdivisions per rafter half (≥ 2). */
  panels: number;
  /** Rafter section. */
  rafterSection: string;
  /** Raised tie (entrait retroussé) section. */
  tieSection: string;
  /** Column section. */
  columnSection: string;
}

export interface TowerParams {
  kind: "tower";
  /** Total height H (m). */
  height: number;
  /** Base width along X (m). */
  baseWidthX: number;
  /** Base width along Y (m). */
  baseWidthY: number;
  /** Top width along X (m). */
  topWidthX: number;
  /** Top width along Y (m). */
  topWidthY: number;
  /** Tier count N (≥ 2). */
  tiers: number;
  /** Bracing pattern per face per tier. */
  bracing: "X" | "K";
  /** Leg section. */
  legSection: string;
  /** Belt & bracing section. */
  webSection: string;
}

export type GeneratorParams = PortalFrameParams | TrussParams | PolonceauParams | TowerParams;

export type GeneratorKind = GeneratorParams["kind"];

export const GENERATOR_LABELS: Record<GeneratorKind, string> = {
  portal: "Portique à traverse brisée",
  truss: "Treillis plan (Pratt / Howe / Warren)",
  polonceau: "Ferme à entrait retroussé",
  tower: "Pylône treillis 3D tronconique",
};

export interface StructureDraft {
  name: string;
  nodes: NodeData[];
  beams: BeamData[];
  supports: SupportData[];
}

const RIGID: [boolean, boolean, boolean, boolean, boolean, boolean] = [
  false,
  false,
  false,
  false,
  false,
  false,
];
/** Barre de treillis releases (Uy/Uz/Rx/Ry/Rz free, axial only). */
const TRUSS_RELEASES: [boolean, boolean, boolean, boolean, boolean, boolean] = [
  false,
  true,
  true,
  true,
  true,
  true,
];

function beam(
  id: number,
  n1: number,
  n2: number,
  sectionId: string,
  releases?: { start?: boolean[]; end?: boolean[] },
): BeamData {
  return {
    id,
    n1,
    n2,
    section_id: sectionId,
    material_id: "S235JR",
    roll_angle_rad: 0,
    releases_start: releases?.start ?? [...RIGID],
    releases_end: releases?.end ?? [...RIGID],
    k_buckling_y: 1,
    k_buckling_z: 1,
  };
}

function support(nodeId: number, lockedDofs: boolean[]): SupportData {
  return { node_id: nodeId, locked_dofs: [...lockedDofs], spring_stiffness: [0, 0, 0, 0, 0, 0] };
}

const clampInt = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Math.round(v)));
const clampPos = (v: number, fallback: number): number =>
  Number.isFinite(v) && v > 0 ? v : fallback;

// --- 1. Portique à traverse brisée / monopente -----------------------------

/**
 * Portal frame generator: N_bays pitched (or mono-slope) spans, optional
 * 3D depth as `frames` parallel frames spaced `frameSpacing` apart with
 * longitudinal purlins at every eave and ridge line, so multi-frame
 * models solve as real 3D halls.
 */
export function buildPortalFrame(params: PortalFrameParams): StructureDraft {
  const L = clampPos(params.span, 18);
  const H1 = clampPos(params.eaveHeight, 5);
  const H2 = Math.max(clampPos(params.ridgeHeight, 7), H1);
  const bays = clampInt(params.bays, 1, 12);
  const frames = clampInt(params.frames, 1, 12);
  const spacing = clampPos(params.frameSpacing, 6);
  const mono = params.rafterProfile === "mono";
  const col = params.columnSection.trim() === "" ? "HEA 200" : params.columnSection;
  const raf = params.rafterSection.trim() === "" ? "IPE 300" : params.rafterSection;
  const fixed = params.baseSupport === "fixed";

  const nodes: NodeData[] = [];
  const beams: BeamData[] = [];
  const supports: SupportData[] = [];
  let nid = 1;
  let bid = 1;
  const columnTop: number[][] = []; // [frame][columnIndex] → node id
  const ridge: number[][] = []; // [frame][bayIndex] → node id

  for (let f = 0; f < frames; f++) {
    const y = (frames - 1 - f) * spacing; // frame 0 at y=0 keeps 2D parity
    const tops: number[] = [];
    const ridges: number[] = [];
    for (let b = 0; b <= bays; b++) {
      const x = b * L;
      const baseId = nid++;
      const topId = nid++;
      // Monopente halls step the column heights along the single slope;
      // traverse brisée keeps every eave at H1 with an apex at H2.
      const topZ = mono ? H1 + (H2 - H1) * (x / (bays * L)) : H1;
      nodes.push({ id: baseId, x, y, z: 0 });
      nodes.push({ id: topId, x, y, z: topZ });
      beams.push(beam(bid++, baseId, topId, col));
      tops.push(topId);
    }
    for (let b = 0; b < bays; b++) {
      if (mono) {
        // Single continuous slope: one rafter per bay between the stepped
        // column tops (z interpolates H1 → H2 across the whole hall).
        beams.push(beam(bid++, tops[b] ?? 1, tops[b + 1] ?? 1, raf));
        ridges.push(-1);
      } else {
        const x0 = b * L;
        const apexId = nid++;
        nodes.push({ id: apexId, x: x0 + L / 2, y, z: H2 });
        beams.push(beam(bid++, tops[b] ?? 1, apexId, raf));
        beams.push(beam(bid++, apexId, tops[b + 1] ?? 1, raf));
        ridges.push(apexId);
      }
    }
    columnTop.push(tops);
    ridge.push(ridges);
  }

  // Longitudinal purlins: eave tops + every ridge line (3D depth only).
  for (let f = 0; f < frames - 1; f++) {
    for (let b = 0; b <= bays; b++) {
      const a = columnTop[f]?.[b];
      const c = columnTop[f + 1]?.[b];
      if (a !== undefined && c !== undefined) {
        beams.push(beam(bid++, a, c, raf));
      }
    }
    for (let b = 0; b < bays; b++) {
      const a = ridge[f]?.[b];
      const c = ridge[f + 1]?.[b];
      if (a !== undefined && c !== undefined && a !== -1 && c !== -1) {
        beams.push(beam(bid++, a, c, raf));
      }
    }
  }

  // Base supports: Encastrement = full clamp; Rotule = pin with ONE Ry
  // lock (first base) so the 6 rigid modes stay eliminated in 3D.
  const firstBase = 1;
  for (const node of nodes.filter((n) => n.z === 0)) {
    if (fixed) {
      supports.push(support(node.id, [true, true, true, true, true, true]));
    } else {
      supports.push(
        support(
          node.id,
          node.id === firstBase
            ? [true, true, true, false, true, false]
            : [true, true, true, false, false, false],
        ),
      );
    }
  }

  const profile = mono ? "monopente" : "2 versants";
  return {
    name: `Portique ${profile} ${bays * L} m`,
    nodes,
    beams,
    supports,
  };
}

// --- 2. Treillis plan Pratt / Howe / Warren --------------------------------

/**
 * Plan truss generator (RDM6 #50–#58): bottom chord at z = 0, top chord
 * rising from H0 at the ends to Hc at midspan, Pratt / Howe diagonals
 * oriented toward (or away from) midspan, Warren pure zigzag, optional
 * auto-pinned diagonal releases.
 */
export function buildPlanTruss(params: TrussParams): StructureDraft {
  const L = clampPos(params.span, 24);
  const H0 = clampPos(params.endHeight, 0.5);
  const Hc = Math.max(clampPos(params.ridgeHeight, 3), H0);
  const N = clampInt(params.panels, 2, 50);
  const chord = params.chordSection.trim() === "" ? "IPE 200" : params.chordSection;
  const web = params.webSection.trim() === "" ? "IPE 140" : params.webSection;
  const dx = L / N;
  const half = N / 2;
  const topZ = (i: number): number => H0 + (Hc - H0) * Math.max(0, 1 - Math.abs(i - half) / half);

  const nodes: NodeData[] = [];
  const bottom: number[] = [];
  const top: number[] = [];
  let nid = 1;
  let bid = 1;
  for (let i = 0; i <= N; i++) {
    const id = nid++;
    bottom.push(id);
    nodes.push({ id, x: i * dx, y: 0, z: 0 });
  }
  for (let i = 0; i <= N; i++) {
    const id = nid++;
    top.push(id);
    nodes.push({ id, x: i * dx, y: 0, z: topZ(i) });
  }

  const beams: BeamData[] = [];
  const diagonalReleases = (): { start: boolean[]; end: boolean[] } | undefined =>
    params.pinDiagonals ? { start: [...TRUSS_RELEASES], end: [...TRUSS_RELEASES] } : undefined;

  // Chords.
  for (let i = 0; i < N; i++) {
    beams.push(beam(bid++, bottom[i] ?? 1, bottom[i + 1] ?? 1, chord));
    beams.push(beam(bid++, top[i] ?? 1, top[i + 1] ?? 1, chord));
  }
  // Web: end posts + verticals + diagonals per family.
  beams.push(beam(bid++, bottom[0] ?? 1, top[0] ?? 1, web));
  beams.push(beam(bid++, bottom[N] ?? 1, top[N] ?? 1, web));
  if (params.type === "warren") {
    for (let i = 0; i < N; i++) {
      if (i % 2 === 0) {
        beams.push(beam(bid++, bottom[i] ?? 1, top[i + 1] ?? 1, web, diagonalReleases()));
      } else {
        beams.push(beam(bid++, top[i] ?? 1, bottom[i + 1] ?? 1, web, diagonalReleases()));
      }
    }
  } else {
    for (let i = 1; i < N; i++) {
      beams.push(beam(bid++, bottom[i] ?? 1, top[i] ?? 1, web));
    }
    for (let i = 0; i < N; i++) {
      const towardCenter = i < half;
      const diagonalGoesForward = params.type === "pratt" ? towardCenter : !towardCenter;
      if (diagonalGoesForward) {
        beams.push(beam(bid++, top[i] ?? 1, bottom[i + 1] ?? 1, web, diagonalReleases()));
      } else {
        beams.push(beam(bid++, top[i + 1] ?? 1, bottom[i] ?? 1, web, diagonalReleases()));
      }
    }
  }

  return {
    name: `Treillis ${params.type === "pratt" ? "Pratt" : params.type === "howe" ? "Howe" : "Warren"} ${L} m`,
    nodes,
    beams,
    supports: [
      // Encastre at the left foot (Rx lock — 3D torsion guardrail), Tz
      // roller at the right foot (thermal expansion release).
      support(bottom[0] ?? 1, [true, true, true, true, true, true]),
      support(bottom[N] ?? 1, [false, true, true, false, false, false]),
    ],
  };
}

// --- 3. Ferme à entrait retroussé / Polonceau ------------------------------

/**
 * Raised-tie truss (RDM6 #200–#206): two columns, rafters rising to the
 * ridge, the tie beam retroussé (rising above the eave line toward
 * midspan), a king post and vertical struts tying every tie panel point
 * back onto the rafter chord.
 */
export function buildPolonceau(params: PolonceauParams): StructureDraft {
  const L = clampPos(params.span, 20);
  const H1 = clampPos(params.columnHeight, 6);
  const H2 = clampPos(params.riseHeight, 4);
  const N = clampInt(params.panels, 2, 50);
  const raf = params.rafterSection.trim() === "" ? "IPE 200" : params.rafterSection;
  const tie = params.tieSection.trim() === "" ? "IPE 240" : params.tieSection;
  const col = params.columnSection.trim() === "" ? "HEA 200" : params.columnSection;

  const nodes: NodeData[] = [];
  const beams: BeamData[] = [];
  let nid = 1;
  let bid = 1;

  const eaveL = nid++;
  nodes.push({ id: eaveL, x: 0, y: 0, z: H1 });
  const eaveR = nid++;
  nodes.push({ id: eaveR, x: L, y: 0, z: H1 });
  const ridge = nid++;
  nodes.push({ id: ridge, x: L / 2, y: 0, z: H1 + H2 });
  const tieMid = nid++;
  nodes.push({ id: tieMid, x: L / 2, y: 0, z: H1 + H2 * 0.35 });

  // Rafter panel points (straight chords, N panels each side).
  const rafterL: number[] = [];
  const rafterR: number[] = [];
  for (let i = 1; i < N; i++) {
    const t = i / N;
    const idL = nid++;
    nodes.push({ id: idL, x: (L / 2) * t, y: 0, z: H1 + H2 * t });
    rafterL.push(idL);
    const idR = nid++;
    nodes.push({ id: idR, x: L / 2 + (L / 2) * t, y: 0, z: H1 + H2 * (1 - t) });
    rafterR.push(idR);
  }
  // Raised tie panel points (straight rise to the tie apex).
  const tieL: number[] = [];
  const tieR: number[] = [];
  for (let i = 1; i < N; i++) {
    const t = i / N;
    const idL = nid++;
    nodes.push({ id: idL, x: (L / 2) * t, y: 0, z: H1 + H2 * 0.35 * t });
    tieL.push(idL);
    const idR = nid++;
    nodes.push({ id: idR, x: L / 2 + (L / 2) * t, y: 0, z: H1 + H2 * 0.35 * (1 - t) });
    tieR.push(idR);
  }

  const chain = (ids: number[], a: number, b: number, section: string): void => {
    let from = a;
    for (const to of ids) {
      beams.push(beam(bid++, from, to, section));
      from = to;
    }
    beams.push(beam(bid++, from, b, section));
  };
  chain(rafterL, eaveL, ridge, raf);
  chain(rafterR, ridge, eaveR, raf);
  chain(tieL, eaveL, tieMid, tie);
  chain(tieR, tieMid, eaveR, tie);

  // King post + vertical struts from every tie panel point to the rafter.
  beams.push(beam(bid++, ridge, tieMid, raf));
  for (let i = 0; i < N - 1; i++) {
    const tieNode = tieL[i];
    const rafterNode = rafterL[i];
    if (tieNode !== undefined && rafterNode !== undefined) {
      beams.push(beam(bid++, tieNode, rafterNode, raf));
    }
    const tieNodeR = tieR[i];
    const rafterNodeR = rafterR[i];
    if (tieNodeR !== undefined && rafterNodeR !== undefined) {
      beams.push(beam(bid++, tieNodeR, rafterNodeR, raf));
    }
  }

  // Columns under both eaves.
  const baseL = nid++;
  nodes.push({ id: baseL, x: 0, y: 0, z: 0 });
  const baseR = nid++;
  nodes.push({ id: baseR, x: L, y: 0, z: 0 });
  beams.push(beam(bid++, baseL, eaveL, col));
  beams.push(beam(bid++, baseR, eaveR, col));

  return {
    name: `Ferme à entrait retroussé ${L} m`,
    nodes,
    beams,
    supports: [
      support(baseL, [true, true, true, true, true, true]),
      support(baseR, [false, true, true, false, false, false]),
    ],
  };
}

// --- 4. Pylône treillis 3D / tour tronconique -------------------------------

/**
 * Tapered 3D lattice tower (RDM6 #100–#105): four legs interpolated
 * between the base and top rectangles, belt beams at every tier, and X or
 * K bracing on each of the four faces per tier.
 */
export function buildLatticeTower(params: TowerParams): StructureDraft {
  const H = clampPos(params.height, 30);
  const WX0 = clampPos(params.baseWidthX, 4);
  const WY0 = clampPos(params.baseWidthY, 4);
  const WX1 = clampPos(params.topWidthX, 1.5);
  const WY1 = clampPos(params.topWidthY, 1.5);
  const N = clampInt(params.tiers, 2, 30);
  const leg = params.legSection.trim() === "" ? "HEA 200" : params.legSection;
  const web = params.webSection.trim() === "" ? "IPE 140" : params.webSection;

  const nodes: NodeData[] = [];
  const beams: BeamData[] = [];
  const supports: SupportData[] = [];
  let nid = 1;
  let bid = 1;

  const half = (w0: number, w1: number, f: number): number => (w0 + (w1 - w0) * (f / N)) / 2;
  const cornersAt = (f: number): number[] => {
    const hx = half(WX0, WX1, f);
    const hy = half(WY0, WY1, f);
    return [
      { x: -hx, y: -hy, z: (f * H) / N },
      { x: hx, y: -hy, z: (f * H) / N },
      { x: hx, y: hy, z: (f * H) / N },
      { x: -hx, y: hy, z: (f * H) / N },
    ].map((p) => {
      const id = nid++;
      nodes.push({ id, x: p.x, y: p.y, z: p.z });
      return id;
    });
  };

  const levels: number[][] = [];
  for (let f = 0; f <= N; f++) {
    levels.push(cornersAt(f));
  }

  // Legs + belts.
  for (let c = 0; c < 4; c++) {
    for (let f = 0; f < N; f++) {
      beams.push(beam(bid++, levels[f]?.[c] ?? 1, levels[f + 1]?.[c] ?? 1, leg));
    }
  }
  for (let f = 0; f <= N; f++) {
    const ring = levels[f] ?? [];
    for (let c = 0; c < 4; c++) {
      beams.push(beam(bid++, ring[c] ?? 1, ring[(c + 1) % 4] ?? 1, web));
    }
  }

  // Faces: (0,1), (1,2), (2,3), (3,0).
  if (params.bracing === "X") {
    for (let f = 0; f < N; f++) {
      for (let c = 0; c < 4; c++) {
        const a0 = levels[f]?.[c] ?? 1;
        const b0 = levels[f]?.[(c + 1) % 4] ?? 1;
        const a1 = levels[f + 1]?.[c] ?? 1;
        const b1 = levels[f + 1]?.[(c + 1) % 4] ?? 1;
        beams.push(beam(bid++, a0, b1, web));
        beams.push(beam(bid++, b0, a1, web));
      }
    }
  } else {
    // K bracing: the mid-height node of one leg connects up and down to
    // the opposite face corners at both tier levels.
    for (let f = 0; f < N; f++) {
      for (let c = 0; c < 4; c++) {
        const a0Idx = levels[f]?.[c];
        const b0Idx = levels[f]?.[(c + 1) % 4];
        const b1Idx = levels[f + 1]?.[(c + 1) % 4];
        if (a0Idx === undefined || b0Idx === undefined || b1Idx === undefined) {
          continue;
        }
        const pA = nodes.find((n) => n.id === a0Idx);
        const pB = nodes.find((n) => n.id === b0Idx);
        if (pA === undefined || pB === undefined) {
          continue;
        }
        const midId = nid++;
        nodes.push({
          id: midId,
          x: (pA.x + pB.x) / 2,
          y: (pA.y + pB.y) / 2,
          z: pA.z + H / N / 2,
        });
        beams.push(beam(bid++, b0Idx, midId, web));
        beams.push(beam(bid++, midId, b1Idx, web));
      }
    }
  }

  // Four encastred feet (tower base).
  for (const id of levels[0] ?? []) {
    supports.push(support(id, [true, true, true, true, true, true]));
  }

  return {
    name: `Pylône treillis ${H} m`,
    nodes,
    beams,
    supports,
  };
}

/** Dispatches one generator by its discriminated `kind`. */
export function buildStructure(params: GeneratorParams): StructureDraft {
  switch (params.kind) {
    case "portal":
      return buildPortalFrame(params);
    case "truss":
      return buildPlanTruss(params);
    case "polonceau":
      return buildPolonceau(params);
    case "tower":
      return buildLatticeTower(params);
  }
}

// --- Project integration -----------------------------------------------------

/** Builds a complete standalone project from a draft (Replace mode). */
export function draftToProject(draft: StructureDraft): ProjectData {
  return {
    version: 2,
    name: draft.name,
    structure: {
      nodes: draft.nodes,
      beams: draft.beams,
      supports: draft.supports,
      loads: [],
      sections: {},
      materials: {},
      self_weight_enabled: false,
    },
  };
}

/**
 * Insertion mode: offsets the draft by `origin` and merges it into the
 * current project — node and beam ids are remapped past the existing
 * maxima, supports follow the remapped nodes, existing loads untouched.
 */
export function insertDraft(
  project: ProjectData,
  draft: StructureDraft,
  origin: Origin,
): ProjectData {
  const nodeRemap = new Map<number, number>();
  let nid = project.structure.nodes.reduce((m, n) => Math.max(m, n.id), 0) + 1;
  const nodes = draft.nodes.map((n) => {
    const id = nid++;
    nodeRemap.set(n.id, id);
    return { id, x: n.x + origin.x, y: n.y + origin.y, z: n.z + origin.z };
  });
  let bid = project.structure.beams.reduce((m, b) => Math.max(m, b.id), 0) + 1;
  const beams = draft.beams.map((b) => ({
    ...b,
    id: bid++,
    n1: nodeRemap.get(b.n1) ?? b.n1,
    n2: nodeRemap.get(b.n2) ?? b.n2,
  }));
  const supports = draft.supports.map((s) => ({
    ...s,
    node_id: nodeRemap.get(s.node_id) ?? s.node_id,
  }));
  return {
    ...project,
    structure: {
      ...project.structure,
      nodes: [...project.structure.nodes, ...nodes],
      beams: [...project.structure.beams, ...beams],
      supports: [...project.structure.supports, ...supports],
    },
  };
}
