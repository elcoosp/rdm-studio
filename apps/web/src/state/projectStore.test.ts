import { beforeEach, describe, expect, it } from "vitest";
import { demoProject, quickStartProject, useProjectStore } from "./projectStore";

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

  // --- v2.3.0 quick-start templates -------------------------------------

  it("warren spans 24 m in 4 bays of 6 m", () => {
    const p = quickStartProject("warren");
    expect(p.name).toBe("Treillis Warren 24 m");
    const xs = p.structure.nodes.map((n) => n.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(24);
    expect(p.structure.nodes).toHaveLength(9);
    expect(p.structure.beams).toHaveLength(11);
  });

  it("warren-truss slug resolves to the same 24 m Warren", () => {
    expect(quickStartProject("warren-truss").name).toBe("Treillis Warren 24 m");
  });

  it("portal-frame / continuous-beam / cantilever aliases resolve", () => {
    expect(quickStartProject("portal-frame").name).toBe("Portique 18 m");
    expect(quickStartProject("continuous-beam").name).toBe("Poutre 3 travées");
    expect(quickStartProject("cantilever").name).toBe("Potence HEA 200");
  });

  it("naval-cradle is a 6,0 x 2,4 m skid with a 3D acceleration field", () => {
    const p = quickStartProject("naval-cradle");
    expect(p.structure.beams).toHaveLength(12);
    expect(p.structure.beams.every((b) => b.material_id === "S355J2")).toBe(true);
    // Longitudinaux HEB 200 (beams 1, 3, 5, 7 + posts 9–12), traverses IPE 180.
    expect(p.structure.beams.map((b) => b.section_id)).toEqual([
      "HEB 200",
      "IPE 180",
      "HEB 200",
      "IPE 180",
      "HEB 200",
      "IPE 180",
      "HEB 200",
      "IPE 180",
      "HEB 200",
      "HEB 200",
      "HEB 200",
      "HEB 200",
    ]);
    // Non-coplanar restraints: N1 encastre 6-DOF, N2 rotule, N3/N4 Uy/Uz.
    expect(p.structure.supports).toHaveLength(4);
    const locked = (id: number) => p.structure.supports.find((s) => s.node_id === id)?.locked_dofs;
    expect(locked(1)).toEqual([true, true, true, true, true, true]);
    expect(locked(2)).toEqual([true, true, true, false, false, false]);
    expect(locked(3)).toEqual([false, true, true, false, false, false]);
    expect(locked(4)).toEqual([false, true, true, false, false, false]);
    const field = p.structure.loads.find((l) => l.kind === "AccelerationField");
    expect(field).toBeDefined();
    if (field?.kind === "AccelerationField") {
      expect([field.ax_g, field.ay_g, field.az_g]).toEqual([0.8, 0.6, -1.5]);
    }
    // Équipement : -25 kN par sellette sur les 4 nœuds du cadre haut.
    const equipment = p.structure.loads.filter((l) => l.kind === "Nodal" && l.forces.fz === -25000);
    expect(equipment).toHaveLength(4);
  });

  it("lifting-beam hangs from its centre with two -127 kN sling loads", () => {
    const p = quickStartProject("lifting-beam");
    expect(p.structure.beams).toHaveLength(3);
    expect(p.structure.beams.every((b) => b.section_id === "HEB 240")).toBe(true);
    expect(p.structure.beams.every((b) => b.material_id === "S355J2")).toBe(true);
    const nodal = p.structure.loads.filter((l) => l.kind === "Nodal");
    expect(nodal).toHaveLength(2);
    for (const load of nodal) {
      if (load.kind === "Nodal") expect(load.forces.fz).toBe(-127000);
    }
    // Suspension lug Ux/Uy/Uz/Rx + lateral stabilisation Uy/Rz at both ends.
    expect(p.structure.supports).toHaveLength(3);
    const locked = (id: number) => p.structure.supports.find((s) => s.node_id === id)?.locked_dofs;
    expect(locked(4)).toEqual([true, true, true, true, false, false]);
    expect(locked(1)).toEqual([false, true, false, false, false, true]);
    expect(locked(2)).toEqual([false, true, false, false, false, true]);
  });

  it("workshop-jib is a 4,0 m column + 4,5 m jib with a -50 kN tip load", () => {
    const p = quickStartProject("workshop-jib");
    expect(p.structure.beams.map((b) => b.section_id)).toEqual([
      "HEB 260",
      "IPE 270",
      "HEB 260",
      "CHS 114.3x6",
    ]);
    const tip = p.structure.loads.find((l) => l.kind === "Nodal");
    if (tip?.kind === "Nodal") expect(tip.forces.fz).toBe(-50000);
    else throw new Error("tip load expected");
    // Base encastre 6-DOF + appui hors-plan Uy en tête de colonne.
    expect(p.structure.supports).toHaveLength(2);
    const locked = (id: number) => p.structure.supports.find((s) => s.node_id === id)?.locked_dofs;
    expect(locked(1)).toEqual([true, true, true, true, true, true]);
    expect(locked(2)).toEqual([false, true, false, false, false, false]);
  });

  it("portal-frame carries a -12 kN/m roof load on the IPE 300 rafter", () => {
    const p = quickStartProject("portal-frame");
    const roof = p.structure.loads.find((l) => l.kind === "Trapezoid");
    expect(roof).toBeDefined();
    if (roof?.kind === "Trapezoid") {
      expect(roof.beam_id).toBe(2);
      expect(roof.q_start).toBe(-12000);
      expect(roof.q_end).toBe(-12000);
    }
    expect(p.structure.beams.find((b) => b.id === 2)?.section_id).toBe("IPE 300");
  });

  it("engineering template ids resolve through quickStartProject", () => {
    expect(quickStartProject("treillis-pratt").name).toBe("Treillis Pratt");
    expect(quickStartProject("pratt-truss").name).toBe("Treillis Pratt");
    expect(quickStartProject("poutre-gl24h").name).toBe("Poutre bois lamellé-collé GL24h");
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
