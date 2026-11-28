import { describe, expect, it } from "vitest";
import type { BeamData, NodeData, ProjectData } from "@/state/projectStore";
import {
  SUBDIVIDE_MAX,
  autoSplitOnDraw,
  compactModel,
  deduplicateBeams,
  mergeDuplicateNodes,
  purgeOrphanNodes,
  splitIntersectingBeams,
  subdivideBeam,
} from "./modelCleanup";

/** Minimal member factory matching the canonical `.rdm` beam shape. */
function member(
  id: number,
  n1: number,
  n2: number,
  sectionId = "IPE 200",
  overrides: Partial<BeamData> = {},
): BeamData {
  return {
    id,
    n1,
    n2,
    section_id: sectionId,
    material_id: "S235JR",
    roll_angle_rad: 0.25,
    releases_start: [false, false, false, false, false, false],
    releases_end: [false, false, false, false, false, false],
    k_buckling_y: 1,
    k_buckling_z: 1,
    ...overrides,
  };
}

function point(id: number, x: number, y: number, z: number): NodeData {
  return { id, x, y, z };
}

function project(
  nodes: NodeData[],
  beams: BeamData[],
  extras: Partial<ProjectData["structure"]> = {},
): ProjectData {
  return {
    version: 2,
    name: "M9 test",
    structure: {
      nodes,
      beams,
      supports: [],
      loads: [],
      sections: {},
      materials: {},
      self_weight_enabled: false,
      ...extras,
    },
  };
}

describe("modelCleanup — mergeDuplicateNodes", () => {
  it("welds coincident nodes within the default 1e-4 tolerance and remaps everything", () => {
    const p = project(
      [point(1, 0, 0, 0), point(2, 4, 0, 0), point(3, 4, 0, 0), point(4, 8, 0, 0)],
      [member(1, 1, 2), member(2, 3, 4)],
      {
        supports: [
          {
            node_id: 3,
            locked_dofs: [true, true, true, false, false, false],
            spring_stiffness: [0, 0, 0, 0, 0, 0],
          },
        ],
        loads: [
          {
            case: "Variable",
            kind: "Nodal",
            node_id: 3,
            forces: { fx: 0, fy: 0, fz: -1000, mx: 0, my: 0, mz: 0 },
          },
        ],
      },
    );
    const { project: out, mergedNodes } = mergeDuplicateNodes(p);
    expect(mergedNodes).toBe(1);
    expect(out.structure.nodes).toHaveLength(3);
    expect(out.structure.nodes.map((n) => n.id).sort((a, b) => a - b)).toEqual([1, 2, 4]);
    expect(out.structure.beams[0]?.n2).toBe(2);
    expect(out.structure.beams[1]?.n1).toBe(2);
    expect(out.structure.supports[0]?.node_id).toBe(2);
    const nodal = out.structure.loads[0];
    expect(nodal?.kind === "Nodal" ? nodal.node_id : null).toBe(2);
  });

  it("keeps nodes beyond tolerance untouched (deterministic, first wins)", () => {
    const p = project([point(1, 0, 0, 0), point(2, 0.01, 0, 0)], [member(1, 1, 2)]);
    const { mergedNodes } = mergeDuplicateNodes(p);
    expect(mergedNodes).toBe(0);
  });

  it("removes zero-length beams collapsed by the weld", () => {
    const p = project(
      [point(1, 0, 0, 0), point(2, 4, 0, 0), point(3, 4, 0, 0)],
      [member(1, 1, 2), member(2, 2, 3)],
    );
    const { project: out } = mergeDuplicateNodes(p);
    expect(out.structure.beams).toHaveLength(1);
    expect(out.structure.nodes).toHaveLength(2);
  });
});

describe("modelCleanup — splitIntersectingBeams", () => {
  it("cuts a host beam at a T-junction and welds the existing node", () => {
    // Host A: (0,0,0)→(8,0,0); node 3 sits at (4,0,0) tied to a post.
    const p = project(
      [point(1, 0, 0, 0), point(2, 8, 0, 0), point(3, 4, 0, 0), point(4, 4, 0, 3)],
      [member(1, 1, 2), member(2, 3, 4)],
    );
    const { project: out, splitBeams } = splitIntersectingBeams(p);
    expect(splitBeams).toBe(1);
    // Host replaced by 2 children sharing the EXISTING node 3.
    const hosts = out.structure.beams.filter((b) => b.n1 === 1 || b.n2 === 2);
    expect(hosts).toHaveLength(2);
    expect(out.structure.nodes).toHaveLength(4); // no duplicate of node 3
    expect(hosts.every((b) => b.n1 === 3 || b.n2 === 3)).toBe(true);
    expect(hosts.every((b) => b.section_id === "IPE 200")).toBe(true);
    expect(hosts.every((b) => b.roll_angle_rad === 0.25)).toBe(true);
  });

  it("cuts both beams at an X-crossing and creates one shared junction node", () => {
    const p = project(
      [point(1, 0, 0, 0), point(2, 8, 0, 0), point(3, 4, -4, 0), point(4, 4, 4, 0)],
      [member(1, 1, 2), member(2, 3, 4)],
    );
    const { project: out, splitBeams } = splitIntersectingBeams(p);
    expect(splitBeams).toBe(2);
    expect(out.structure.nodes).toHaveLength(5); // 4 originals + 1 junction
    expect(out.structure.beams).toHaveLength(4);
    // The two new interior junctions are rigid (no releases).
    const children = out.structure.beams.filter((b) => b.id > 2);
    expect(children.every((b) => b.releases_start.every((r) => !r))).toBe(true);
  });

  it("never cuts beams that merely share an endpoint", () => {
    const p = project(
      [point(1, 0, 0, 0), point(2, 4, 0, 0), point(3, 4, 0, 4)],
      [member(1, 1, 2), member(2, 2, 3)],
    );
    const { splitBeams } = splitIntersectingBeams(p);
    expect(splitBeams).toBe(0);
  });

  it("proportionally remaps a trapezoid load onto the child segments", () => {
    const p = project(
      [point(1, 0, 0, 0), point(2, 8, 0, 0), point(3, 4, 0, 0), point(4, 4, 0, 3)],
      [member(1, 1, 2), member(2, 3, 4)],
      {
        loads: [
          {
            case: "Permanent",
            kind: "Trapezoid",
            beam_id: 1,
            q_start: -10000,
            q_end: -20000,
            direction: { x: 0, y: 0, z: -1 },
          },
        ],
      },
    );
    const { project: out } = splitIntersectingBeams(p);
    const children = out.structure.beams.filter((b) => b.n1 === 1 || b.n2 === 2);
    expect(children).toHaveLength(2);
    const childLoads = out.structure.loads.filter(
      (l): l is Extract<ProjectData["structure"]["loads"][number], { beam_id: number }> =>
        "beam_id" in l && children.some((b) => b.id === l.beam_id),
    );
    expect(childLoads).toHaveLength(2);
    const first = childLoads.find((l) => children.find((b) => b.id === l.beam_id)?.n1 === 1);
    const second = childLoads.find((l) => children.find((b) => b.id === l.beam_id)?.n2 === 2);
    if (first?.kind !== "Trapezoid" || second?.kind !== "Trapezoid") {
      expect.unreachable("trapezoid loads missing after split");
    }
    expect(first.q_start).toBeCloseTo(-10000, 6);
    expect(first.q_end).toBeCloseTo(-15000, 6);
    expect(second.q_start).toBeCloseTo(-15000, 6);
    expect(second.q_end).toBeCloseTo(-20000, 6);
  });
});

describe("modelCleanup — purgeOrphanNodes & deduplicateBeams", () => {
  it("removes nodes referenced by nothing", () => {
    const p = project(
      [point(1, 0, 0, 0), point(2, 4, 0, 0), point(3, 9, 9, 9)],
      [member(1, 1, 2)],
      {
        supports: [
          {
            node_id: 1,
            locked_dofs: [true, true, true, true, true, true],
            spring_stiffness: [0, 0, 0, 0, 0, 0],
          },
        ],
      },
    );
    const { project: out, removedOrphans } = purgeOrphanNodes(p);
    expect(removedOrphans).toBe(1);
    expect(out.structure.nodes.map((n) => n.id)).toEqual([1, 2]);
  });

  it("drops duplicated node-pair members keeping the first", () => {
    const p = project([point(1, 0, 0, 0), point(2, 4, 0, 0)], [member(1, 1, 2), member(2, 2, 1)]);
    const { project: out, removedDuplicates } = deduplicateBeams(p);
    expect(removedDuplicates).toBe(1);
    expect(out.structure.beams).toHaveLength(1);
  });
});

describe("modelCleanup — compactModel (atomic pass)", () => {
  it("runs merge → split → deduplicate → purge and reports all stats", () => {
    // 1=2 duplicate at origin; host 10→2 crosses node 5 interior; 9 orphan.
    const p = project(
      [
        point(1, 0, 0, 0),
        point(2, 0, 0, 0),
        point(3, 8, 0, 0),
        point(5, 4, 0, 0),
        point(6, 4, 0, 3),
        point(9, 42, 42, 42),
      ],
      [member(10, 1, 3), member(11, 5, 6)],
      {
        supports: [
          {
            node_id: 1,
            locked_dofs: [true, true, true, true, true, true],
            spring_stiffness: [0, 0, 0, 0, 0, 0],
          },
        ],
      },
    );
    const { stats, project: out } = compactModel(p);
    expect(stats.mergedNodes).toBe(1);
    expect(stats.splitBeams).toBe(1);
    expect(stats.removedOrphans).toBe(1);
    // Merged node pair collapsed to one; host split at node 5.
    expect(out.structure.nodes.every((n) => n.id !== 2)).toBe(true);
    expect(out.structure.beams.some((b) => b.n1 === 5 || b.n2 === 5)).toBe(true);
    // Structural integrity: every endpoint resolves, no zero lengths.
    const ids = new Set(out.structure.nodes.map((n) => n.id));
    for (const beam of out.structure.beams) {
      expect(ids.has(beam.n1)).toBe(true);
      expect(ids.has(beam.n2)).toBe(true);
      expect(beam.n1).not.toBe(beam.n2);
    }
  });

  it("is idempotent on an already-clean model", () => {
    const p = project([point(1, 0, 0, 0), point(2, 4, 0, 0)], [member(1, 1, 2)]);
    const first = compactModel(p);
    const second = compactModel(first.project);
    expect(second.stats).toEqual({
      mergedNodes: 0,
      splitBeams: 0,
      removedDuplicates: 0,
      removedOrphans: 0,
    });
    expect(second.project.structure.nodes).toHaveLength(2);
    expect(second.project.structure.beams).toHaveLength(1);
  });
});

describe("modelCleanup — subdivideBeam (M9.2)", () => {
  it("creates N−1 equidistant nodes and N contiguous children", () => {
    const p = project([point(1, 0, 0, 0), point(2, 8, 0, 0)], [member(1, 1, 2)]);
    const { project: out, segments } = subdivideBeam(p, 1, 4);
    expect(segments).toBe(4);
    expect(out.structure.nodes).toHaveLength(5);
    expect(out.structure.beams).toHaveLength(4);
    const chain = out.structure.beams
      .filter((b) => b.n1 === 1 || b.n2 === 2 || b.id > 1)
      .sort((a, b) => a.id - b.id);
    const xs = chain.map((b) => out.structure.nodes.find((n) => n.id === b.n2)?.x);
    expect(xs).toEqual([2, 4, 6, 8]);
    for (const child of chain) {
      expect(child.section_id).toBe("IPE 200");
      expect(child.material_id).toBe("S235JR");
      expect(child.roll_angle_rad).toBe(0.25);
      expect(child.k_buckling_y).toBe(1);
    }
  });

  it("keeps outer end releases and rigid interior junctions", () => {
    const p = project(
      [point(1, 0, 0, 0), point(2, 6, 0, 0)],
      [
        member(1, 1, 2, "IPE 200", {
          releases_start: [false, true, true, true, true, true],
          releases_end: [true, false, false, false, false, false],
        }),
      ],
    );
    const { project: out } = subdivideBeam(p, 1, 3);
    const children = out.structure.beams.sort((a, b) => a.id - b.id);
    const first = children[0];
    const middle = children[1];
    const last = children.at(-1);
    expect(first?.releases_start).toEqual([false, true, true, true, true, true]);
    expect(first?.releases_end).toEqual([false, false, false, false, false, false]);
    expect(middle?.releases_start).toEqual([false, false, false, false, false, false]);
    expect(last?.releases_end).toEqual([true, false, false, false, false, false]);
  });

  it("remaps a point-on-span load onto the host child (half-open ownership)", () => {
    const p = project([point(1, 0, 0, 0), point(2, 8, 0, 0)], [member(1, 1, 2)], {
      loads: [
        {
          case: "Variable",
          kind: "PointOnSpan",
          beam_id: 1,
          position_ratio: 0.5,
          forces: { fx: 0, fy: 0, fz: -5000, mx: 0, my: 0, mz: 0 },
        },
      ],
    });
    const { project: out } = subdivideBeam(p, 1, 4);
    const pointLoads = out.structure.loads.filter((l) => l.kind === "PointOnSpan");
    expect(pointLoads).toHaveLength(1);
    const load = pointLoads[0];
    // g = 0.5 sits exactly on a junction: owned by the child STARTING there.
    const host =
      load?.kind === "PointOnSpan"
        ? out.structure.beams.find((b) => b.id === load.beam_id)
        : undefined;
    expect(
      host === undefined ? -1 : (out.structure.nodes.find((n) => n.id === host.n1)?.x ?? -1),
    ).toBe(4);
    expect(load?.kind === "PointOnSpan" ? load.position_ratio : null).toBe(0);
  });

  it("splits a uniform load into equal children and rides thermal on every child", () => {
    const p = project([point(1, 0, 0, 0), point(2, 4, 0, 0)], [member(1, 1, 2)], {
      loads: [
        {
          case: "Snow",
          kind: "Uniform",
          beam_id: 1,
          q_start: -3000,
          q_end: -3000,
          direction: { x: 0, y: 0, z: -1 },
        },
        { case: "Variable", kind: "Thermal", beam_id: 1, dt: 30, dt_z: 5 },
      ],
    });
    const { project: out } = subdivideBeam(p, 1, 2);
    const uniforms = out.structure.loads.filter((l) => l.kind === "Uniform");
    expect(uniforms).toHaveLength(2);
    expect(uniforms.every((l) => l.kind === "Uniform" && l.q_start === -3000)).toBe(true);
    const thermals = out.structure.loads.filter((l) => l.kind === "Thermal");
    expect(thermals).toHaveLength(2);
    expect(thermals.every((l) => l.kind === "Thermal" && l.dt === 30)).toBe(true);
  });

  it("clamps N into [2, 50] and refuses unknown beams", () => {
    const p = project([point(1, 0, 0, 0), point(2, 8, 0, 0)], [member(1, 1, 2)]);
    expect(subdivideBeam(p, 1, 1).segments).toBe(2);
    expect(subdivideBeam(p, 1, 500).segments).toBe(SUBDIVIDE_MAX);
    expect(subdivideBeam(p, 1, 500).project.structure.beams).toHaveLength(50);
    expect(subdivideBeam(p, 99, 4).project.structure.beams).toHaveLength(1);
  });
});

describe("modelCleanup — autoSplitOnDraw", () => {
  it("splits a host beam when a drawn member lands in its interior", () => {
    // Model: host (0,0,0)→(8,0,0) and a standalone node N3 at (4,0,0)
    // linked nowhere. The user then DRAWS beam 2: N3 → N4 at (4,0,6).
    const p = project(
      [point(1, 0, 0, 0), point(2, 8, 0, 0), point(3, 4, 0, 0), point(4, 4, 0, 6)],
      [member(1, 1, 2), member(2, 3, 4)],
    );
    const { project: out, splitBeams } = autoSplitOnDraw(p, 2);
    expect(splitBeams).toBe(1);
    expect(out.structure.beams).toHaveLength(3); // 2 host children + drawn
    expect(out.structure.beams.some((b) => b.n1 === 3 || b.n2 === 3)).toBe(true);
  });

  it("leaves the model untouched when the drawn beam connects existing nodes", () => {
    const p = project(
      [point(1, 0, 0, 0), point(2, 4, 0, 0), point(3, 4, 0, 4)],
      [member(1, 1, 2), member(2, 2, 3)],
    );
    const { splitBeams } = autoSplitOnDraw(p, 2);
    expect(splitBeams).toBe(0);
  });
});
