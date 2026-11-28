import { describe, expect, it } from "vitest";
import { demoProject } from "@/state/projectStore";
import {
  buildLatticeTower,
  buildPlanTruss,
  buildPolonceau,
  buildPortalFrame,
  buildStructure,
  draftToProject,
  insertDraft,
  type PortalFrameParams,
  type PolonceauParams,
  type TowerParams,
  type TrussParams,
} from "./parametricGenerators";

const PORTAL: PortalFrameParams = {
  kind: "portal",
  span: 12,
  eaveHeight: 5,
  ridgeHeight: 7,
  bays: 2,
  rafterProfile: "broken",
  frames: 1,
  frameSpacing: 6,
  columnSection: "HEA 200",
  rafterSection: "IPE 300",
  baseSupport: "fixed",
};

const TRUSS: TrussParams = {
  kind: "truss",
  type: "pratt",
  span: 24,
  endHeight: 1,
  ridgeHeight: 3,
  panels: 8,
  chordSection: "IPE 200",
  webSection: "IPE 140",
  pinDiagonals: true,
};

const POLONCEAU: PolonceauParams = {
  kind: "polonceau",
  span: 20,
  columnHeight: 6,
  riseHeight: 4,
  panels: 4,
  rafterSection: "IPE 200",
  tieSection: "IPE 240",
  columnSection: "HEA 200",
};

const TOWER: TowerParams = {
  kind: "tower",
  height: 30,
  baseWidthX: 4,
  baseWidthY: 4,
  topWidthX: 1.5,
  topWidthY: 1.5,
  tiers: 5,
  bracing: "X",
  legSection: "HEA 200",
  webSection: "IPE 140",
};

/** Every beam endpoint must resolve to an existing, non-degenerate node. */
function expectConnected(draft: {
  nodes: { id: number; x: number; y: number; z: number }[];
  beams: { id: number; n1: number; n2: number }[];
}): void {
  const ids = new Set(draft.nodes.map((n) => n.id));
  const seenBeamIds = new Set<number>();
  for (const beam of draft.beams) {
    expect(ids.has(beam.n1)).toBe(true);
    expect(ids.has(beam.n2)).toBe(true);
    expect(beam.n1).not.toBe(beam.n2);
    expect(seenBeamIds.has(beam.id)).toBe(false);
    seenBeamIds.add(beam.id);
  }
  const nodeIds = draft.nodes.map((n) => n.id);
  expect(new Set(nodeIds).size).toBe(nodeIds.length);
}

describe("parametricGenerators — portique à traverse brisée", () => {
  it("builds bays+1 columns, 2 rafters per bay, and encastred bases", () => {
    const draft = buildPortalFrame(PORTAL);
    expectConnected(draft);
    // 2 bays → 3 columns × (base + top) = 6 nodes + 2 ridge apexes.
    expect(draft.nodes).toHaveLength(8);
    expect(draft.beams).toHaveLength(3 + 2 + 2); // columns + rafters
    expect(draft.supports).toHaveLength(3);
    expect(draft.supports.every((s) => s.locked_dofs.every(Boolean))).toBe(true);
    const apexes = draft.nodes.filter((n) => Math.abs(n.z - 7) < 1e-9).sort((a, b) => a.x - b.x);
    expect(apexes).toHaveLength(2); // one per bay
    expect(apexes[0]?.x).toBeCloseTo(6, 9); // bay 1 midspan
    expect(apexes[1]?.x).toBeCloseTo(18, 9); // bay 2 midspan
  });

  it("monopente slopes continuously from H1 to H2 across the hall", () => {
    const draft = buildPortalFrame({ ...PORTAL, rafterProfile: "mono", bays: 2 });
    expectConnected(draft);
    // Column tops step along the slope: x=0 → 5 m, x=12 → 6 m, x=24 → 7 m.
    const tops = draft.nodes.filter((n) => n.z > 0).sort((a, b) => a.x - b.x);
    expect(tops).toHaveLength(3);
    expect(tops[0]?.z).toBeCloseTo(5, 9);
    expect(tops[1]?.z).toBeCloseTo(6, 9);
    expect(tops[2]?.z).toBeCloseTo(7, 9);
  });

  it("3D depth adds parallel frames plus longitudinal purlins", () => {
    const draft = buildPortalFrame({ ...PORTAL, frames: 3, frameSpacing: 6, bays: 1 });
    expectConnected(draft);
    // 3 frames × (2 columns × 2 nodes + 1 ridge) = 15 + purlins.
    const ys = new Set(draft.nodes.map((n) => n.y));
    expect(ys.size).toBe(3);
    // Purlins: per bay-line, eave (2 columns) + ridge → 3 per frame pair × 2 pairs.
    expect(draft.beams.length).toBeGreaterThan(3 * 3);
    const yValues = [...ys].sort((a, b) => a - b);
    expect(yValues[1] ?? 0).toBeCloseTo(6, 9);
    expect(yValues[2] ?? 0).toBeCloseTo(12, 9);
  });

  it("rotule preset pins the bases and locks Ry on the first", () => {
    const draft = buildPortalFrame({ ...PORTAL, baseSupport: "pinned" });
    const lockedRy = draft.supports.filter((s) => s.locked_dofs[4] === true);
    expect(lockedRy).toHaveLength(1);
    expect(
      draft.supports.every((s) => s.locked_dofs[0] && s.locked_dofs[1] && s.locked_dofs[2]),
    ).toBe(true);
  });

  it("is deterministic and clamps degenerate parameters", () => {
    const a = buildPortalFrame(PORTAL);
    const b = buildPortalFrame(PORTAL);
    expect(a).toEqual(b);
    const degenerate = buildPortalFrame({
      ...PORTAL,
      span: -5,
      eaveHeight: 0,
      ridgeHeight: -1,
      bays: 0,
    });
    expect(degenerate.beams.length).toBeGreaterThan(0);
    expect(degenerate.nodes.every((n) => Number.isFinite(n.x + n.y + n.z))).toBe(true);
  });
});

describe("parametricGenerators — treillis Pratt / Howe / Warren", () => {
  it("builds 2(N+1) nodes, 2N chords, N diagonals and N−1 verticals (Pratt)", () => {
    const draft = buildPlanTruss(TRUSS);
    expectConnected(draft);
    expect(draft.nodes).toHaveLength(2 * 9);
    expect(draft.beams).toHaveLength(2 * 8 + 2 + 7 + 8); // chords + end posts + verticals + diagonals
    expect(draft.supports).toHaveLength(2);
  });

  it("top chord rises from H0 at the ends to Hc at midspan", () => {
    const draft = buildPlanTruss(TRUSS);
    const top = draft.nodes.filter((n) => n.z > 0).sort((a, b) => a.x - b.x);
    expect(top[0]?.z).toBeCloseTo(1, 9);
    expect(top[0]?.x).toBe(0);
    const mid = top.find((n) => Math.abs(n.x - 12) < 1e-9);
    expect(mid?.z).toBeCloseTo(3, 9);
  });

  it("pinDiagonals releases Uy..Rz on diagonals only", () => {
    const draft = buildPlanTruss(TRUSS);
    const released = draft.beams.filter(
      (b) => b.releases_start.slice(1).every(Boolean) && b.releases_end.slice(1).every(Boolean),
    );
    expect(released).toHaveLength(8); // exactly the diagonals
    const rigid = draft.beams.filter((b) => b.releases_start.every((r) => !r));
    expect(rigid.length).toBe(draft.beams.length - 8);
  });

  it("Howe mirrors the diagonals; Warren drops interior verticals", () => {
    const howe = buildPlanTruss({ ...TRUSS, type: "howe", pinDiagonals: false });
    expectConnected(howe);
    const warren = buildPlanTruss({ ...TRUSS, type: "warren", pinDiagonals: false });
    expectConnected(warren);
    // Warren: 2N chords + 2 end posts + N zigzag diagonals, NO verticals.
    expect(warren.beams).toHaveLength(2 * 8 + 2 + 8);
    expect(warren.beams.length).toBeLessThan(howe.beams.length);
  });

  it("is deterministic across calls", () => {
    expect(buildPlanTruss(TRUSS)).toEqual(buildPlanTruss(TRUSS));
  });
});

describe("parametricGenerators — ferme à entrait retroussé", () => {
  it("rises the tie above the eaves but below the ridge", () => {
    const draft = buildPolonceau(POLONCEAU);
    expectConnected(draft);
    const tieApex = draft.nodes.find(
      (n) => Math.abs(n.x - 10) < 1e-9 && Math.abs(n.z - (6 + 4 * 0.35)) < 1e-9,
    );
    expect(tieApex).toBeDefined();
    const ridge = draft.nodes.find((n) => Math.abs(n.z - 10) < 1e-9);
    expect(ridge?.x).toBe(10);
  });

  it("adds columns, king post and N−1 strut pairs", () => {
    const draft = buildPolonceau(POLONCEAU);
    const cols = draft.beams.filter((b) => b.section_id === "HEA 200");
    expect(cols).toHaveLength(2);
    const baseNodes = draft.nodes.filter((n) => n.z === 0);
    expect(baseNodes).toHaveLength(2);
    expect(draft.supports).toHaveLength(2);
    // (N−1) struts per side + king post = 7 truss verticals (+2 columns).
    const verticals = draft.beams.filter((b) => {
      const a = draft.nodes.find((n) => n.id === b.n1);
      const c = draft.nodes.find((n) => n.id === b.n2);
      return a !== undefined && c !== undefined && Math.abs(a.x - c.x) < 1e-9;
    });
    expect(verticals).toHaveLength(2 * (POLONCEAU.panels - 1) + 3);
  });
});

describe("parametricGenerators — pylône treillis 3D", () => {
  it("tapers the cross-section from base to top", () => {
    const draft = buildLatticeTower(TOWER);
    expectConnected(draft);
    const baseXs = draft.nodes.filter((n) => n.z === 0).map((n) => n.x);
    expect(Math.max(...baseXs)).toBeCloseTo(2, 9);
    const topXs = draft.nodes.filter((n) => n.z === 30).map((n) => n.x);
    expect(Math.max(...topXs)).toBeCloseTo(0.75, 9);
    // 4 encastred feet.
    expect(draft.supports).toHaveLength(4);
    expect(draft.supports.every((s) => s.locked_dofs.every(Boolean))).toBe(true);
  });

  it("X bracing: 8 diagonals per tier; K bracing: mid-height nodes", () => {
    const xDraft = buildLatticeTower(TOWER);
    // 6 levels × 4 corners = 24 nodes; legs 4×5; belts 4×6; diagonals 8×5.
    expect(xDraft.nodes).toHaveLength(24);
    expect(xDraft.beams).toHaveLength(20 + 24 + 40);
    const kDraft = buildLatticeTower({ ...TOWER, bracing: "K" });
    expectConnected(kDraft);
    // K adds one mid node per face per tier: 4 × 5 = 20 extra nodes,
    // beam count identical (each X pair becomes a K pair).
    expect(kDraft.nodes).toHaveLength(44);
    expect(kDraft.beams).toHaveLength(20 + 24 + 40);
  });
});

describe("parametricGenerators — project integration", () => {
  it("draftToProject produces a loadable v2 project", () => {
    const project = draftToProject(buildStructure(TRUSS));
    expect(project.version).toBe(2);
    expect(project.structure.loads).toHaveLength(0);
    expect(project.structure.beams.length).toBeGreaterThan(0);
    expect(project.name).toContain("Pratt");
  });

  it("insertDraft offsets coordinates and remaps ids without collisions", () => {
    const base = demoProject(); // nodes 1..3, beams 1..2
    const draft = buildPlanTruss(TRUSS);
    const merged = insertDraft(base, draft, { x: 10, y: 5, z: 2 });
    const ids = new Set(merged.structure.nodes.map((n) => n.id));
    expect(ids.size).toBe(merged.structure.nodes.length);
    expect(merged.structure.nodes.length).toBe(3 + draft.nodes.length);
    // Draft nodes carry the origin offset (draft sits at y = 0 → 5 m).
    const draftNodes = merged.structure.nodes.filter((n) => n.y === 5);
    expect(draftNodes.length).toBe(draft.nodes.length);
    expect(Math.min(...draftNodes.map((n) => n.x))).toBe(10);
    expect(Math.min(...draftNodes.map((n) => n.z))).toBe(2);
    const nodeIds = new Set(merged.structure.nodes.map((n) => n.id));
    for (const beam of merged.structure.beams) {
      expect(nodeIds.has(beam.n1)).toBe(true);
      expect(nodeIds.has(beam.n2)).toBe(true);
    }
    // Supports follow the remapped nodes.
    for (const support of merged.structure.supports) {
      expect(nodeIds.has(support.node_id)).toBe(true);
    }
    expect(merged.structure.beams.length).toBe(2 + draft.beams.length);
  });
});
