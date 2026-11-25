import { beforeEach, describe, expect, it } from "vitest";
import { demoProject, useProjectStore } from "./projectStore";

describe("project store (zustand + zundo)", () => {
  beforeEach(() => {
    useProjectStore.getState().resetDemo();
  });

  it("adds and removes nodes", () => {
    const { addNode, removeNode } = useProjectStore.getState();
    const id = addNode(1.5, 2, 0);
    expect(useProjectStore.getState().project.structure.nodes.some((n) => n.id === id)).toBe(true);
    removeNode(id);
    expect(useProjectStore.getState().project.structure.nodes.some((n) => n.id === id)).toBe(false);
  });

  it("toggles the 6-DOF support matrix", () => {
    const { setSupport } = useProjectStore.getState();
    setSupport(1, [true, true, true, false, false, false]);
    const support = useProjectStore
      .getState()
      .project.structure.supports.find((s) => s.node_id === 1);
    expect(support?.locked_dofs[3]).toBe(false);
  });

  it("adds a nodal load in kN -> N (SI in store)", () => {
    const { addNodalLoad } = useProjectStore.getState();
    addNodalLoad(2, -5000, "Wind");
    const loads = useProjectStore.getState().project.structure.loads;
    const last = loads.at(-1);
    expect(last?.kind).toBe("Nodal");
    if (last?.kind === "Nodal") {
      expect(last.forces.fz).toBe(-5000);
    }
  });

  it("undo restores the previous model", () => {
    const { addNode } = useProjectStore.getState();
    const before = useProjectStore.getState().project.structure.nodes.length;
    addNode(9, 9, 9);
    expect(useProjectStore.getState().project.structure.nodes.length).toBe(before + 1);
    useProjectStore.temporal.getState().undo();
    expect(useProjectStore.getState().project.structure.nodes.length).toBe(before);
  });

  it("demo project is stable", () => {
    expect(demoProject().structure.beams).toHaveLength(2);
  });

  // --- v1.6.0 -----------------------------------------------------------

  it("subdivides a beam into N collinear segments preserving properties", () => {
    const { subdivideBeam } = useProjectStore.getState();
    const before = useProjectStore.getState().project.structure;
    const original = before.beams[0];
    expect(original).toBeDefined();
    if (original === undefined) return;
    subdivideBeam(original.id, 4);
    const after = useProjectStore.getState().project.structure;
    // 4 segments replace 1 beam; 3 intermediate nodes appear.
    expect(after.beams.length).toBe(before.beams.length + 3);
    expect(after.nodes.length).toBe(before.nodes.length + 3);
    // Original beam gone, new dense ids above the previous max.
    expect(after.beams.some((b) => b.id === original.id)).toBe(false);
    const newSegments = after.beams.filter((b) => b.id > before.beams.length);
    expect(newSegments.length).toBe(4);
    for (const segment of newSegments) {
      expect(segment.section_id).toBe(original.section_id);
      expect(segment.material_id).toBe(original.material_id);
      expect(segment.roll_angle_rad).toBe(original.roll_angle_rad);
      expect(segment.k_buckling_y).toBe(original.k_buckling_y);
      expect(segment.k_buckling_z).toBe(original.k_buckling_z);
    }
    // The chain starts at n1 and ends at n2.
    const first = newSegments[0];
    const last = newSegments.at(-1);
    expect(first?.n1).toBe(original.n1);
    expect(last?.n2).toBe(original.n2);
    // Outer releases preserved, interior joints rigid.
    expect(first?.releases_start).toEqual(original.releases_start);
    expect(last?.releases_end).toEqual(original.releases_end);
  });

  it("subdivideBeam re-targets span loads and is undoable via zundo", () => {
    const { subdivideBeam } = useProjectStore.getState();
    const beamsBefore = useProjectStore.getState().project.structure.beams.length;
    const beamId = useProjectStore.getState().project.structure.beams[0]?.id;
    if (beamId === undefined) return;
    subdivideBeam(beamId, 2);
    // The demo PointOnSpan load on beam 1 @50% follows the host segment.
    const load = useProjectStore.getState().project.structure.loads[0];
    if (load?.kind === "PointOnSpan") {
      expect(load.beam_id).not.toBe(beamId);
      expect(load.beam_id).toBeGreaterThan(beamsBefore);
    }
    expect(useProjectStore.getState().project.structure.beams.length).toBe(beamsBefore + 1);
    useProjectStore.temporal.getState().undo();
    expect(useProjectStore.getState().project.structure.beams.length).toBe(beamsBefore);
    expect(useProjectStore.getState().project.structure.loads[0]?.kind).toBe("PointOnSpan");
  });

  it("sets elastic spring stiffnesses (kx..krz)", () => {
    const { setSupportSprings } = useProjectStore.getState();
    setSupportSprings(1, [5e6, 0, 0, 0, 0, 2e4]);
    const support = useProjectStore
      .getState()
      .project.structure.supports.find((s) => s.node_id === 1);
    expect(support?.spring_stiffness[0]).toBe(5e6);
    expect(support?.spring_stiffness[5]).toBe(2e4);
    // Locked DOFs are preserved when only springs change.
    expect(support?.locked_dofs[0]).toBe(true);
  });

  it("removes a single support (× button)", () => {
    const { removeSupport } = useProjectStore.getState();
    const before = useProjectStore.getState().project.structure.supports.length;
    removeSupport(1);
    expect(useProjectStore.getState().project.structure.supports.length).toBe(before - 1);
  });

  it("records concentrated moments on nodal loads", () => {
    const { addNodalLoad } = useProjectStore.getState();
    addNodalLoad(2, -1000, "Snow", 0, 0, { mx: 2500, my: 0, mz: -1250 });
    const last = useProjectStore.getState().project.structure.loads.at(-1);
    if (last?.kind === "Nodal") {
      expect(last.forces.mx).toBe(2500);
      expect(last.forces.mz).toBe(-1250);
      expect(last.case).toBe("Snow");
    } else {
      throw new Error("nodal load expected");
    }
  });
});
