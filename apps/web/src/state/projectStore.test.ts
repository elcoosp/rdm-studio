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
});
