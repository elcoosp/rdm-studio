import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildBeamGeometry, spectrumColor, nodePositions } from "./BeamMeshes";
import { prepareBeamBoundsTree, pickBeamAtRay } from "./useBvhPicking";
import { snapPoint, orthogonalLock } from "./SnapGrid";
import type { BeamData, NodeData } from "@/state/projectStore";

/** 10,000 beams on a 100x100 grid of 1 m members (M4 benchmark model). */
function makeGridBeams(count: number): { nodes: NodeData[]; beams: BeamData[] } {
  const nodes: NodeData[] = [];
  const beams: BeamData[] = [];
  const side = Math.ceil(Math.sqrt(count));
  let nextId = 1;
  for (let row = 0; row < side; row++) {
    for (let col = 0; col < side; col++) {
      nodes.push({ id: nextId, x: col, y: row, z: 0 });
      nextId++;
    }
  }
  const at = (row: number, col: number) => row * side + col + 1;
  let beamId = 1;
  for (let row = 0; row < side; row++) {
    for (let col = 0; col < side - 1; col++) {
      if (beams.length >= count) break;
      beams.push({
        id: beamId++,
        n1: at(row, col),
        n2: at(row, col + 1),
        section_id: "IPE 200",
        material_id: "S235JR",
        roll_angle_rad: 0,
        releases_start: [false, false, false, false, false, false],
        releases_end: [false, false, false, false, false, false],
        k_buckling_y: 1,
        k_buckling_z: 1,
      });
    }
  }
  return { nodes, beams };
}

describe("FEA thermal spectrum (section 17, 3D-only)", () => {
  it("maps the stops exactly", () => {
    expect(spectrumColor(0)).toEqual([0x25 / 0xff, 0x63 / 0xff, 0xeb / 0xff]);
    expect(spectrumColor(0.5)[0]).toBeCloseTo(0x10 / 0xff, 5);
    expect(spectrumColor(1)).toEqual([0xef / 0xff, 0x44 / 0xff, 0x44 / 0xff]);
  });
  it("clamps out-of-range ratios", () => {
    expect(spectrumColor(-5)).toEqual(spectrumColor(0));
    expect(spectrumColor(42)).toEqual(spectrumColor(1));
    expect(spectrumColor(Number.NaN)).toEqual(spectrumColor(0));
  });
  it("lerps between stops", () => {
    const [r0, g0, b0] = spectrumColor(0);
    const [, g1, b1] = spectrumColor(1);
    const [rm, gm, bm] = spectrumColor(0.5);
    // Green tier: green peaks, red dips below the cold stop, blue decays
    // monotonically from cold blue to hot red.
    expect(gm).toBeGreaterThan(g0);
    expect(gm).toBeGreaterThan(g1);
    expect(rm).toBeLessThan(r0);
    expect(bm).toBeGreaterThan(b1);
    expect(bm).toBeLessThan(b0);
  });
});

describe("BVH picking (M4: < 0.2 ms on 10,000 elements)", () => {
  it("selects a beam through the accelerated raycast under 0.2 ms median", () => {
    const { nodes, beams } = makeGridBeams(10_000);
    const geometry = buildBeamGeometry(nodes, beams, { width: 0.02 });
    prepareBeamBoundsTree(geometry);
    expect(geometry.boundsTree).toBeDefined();

    // Correctness: a ray straight down the middle of a beam hits it.
    const center = new THREE.Raycaster();
    center.ray.origin.set(50.5, 50, 10);
    center.ray.direction.set(0, 0, -1);
    const hit = pickBeamAtRay(center, geometry);
    expect(hit.beamId).not.toBeNull();
    expect(hit.beamId).toBeGreaterThan(0);

    // Speed: sweep the whole model with 200 rays; median must be < 0.2 ms.
    const times: number[] = [];
    for (let i = 0; i < 200; i++) {
      const x = (i % 100) + 0.5;
      const y = Math.floor(i / 2) % 100;
      const raycaster = new THREE.Raycaster();
      raycaster.ray.origin.set(x, y, 10);
      raycaster.ray.direction.set(0, 0, -1);
      const result = pickBeamAtRay(raycaster, geometry);
      times.push(result.lastSelectionMs);
      if (i % 25 === 0) {
        expect(result.beamId).not.toBeNull();
      }
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)] ?? Number.POSITIVE_INFINITY;
    expect(median).toBeLessThan(0.2);
    geometry.disposeBoundsTree();
    geometry.dispose();
  }, 60_000);

  it("misses report a null beam id without throwing", () => {
    const { nodes, beams } = makeGridBeams(9);
    const geometry = buildBeamGeometry(nodes, beams, { width: 0.02 });
    prepareBeamBoundsTree(geometry);
    const raycaster = new THREE.Raycaster();
    raycaster.ray.origin.set(100, 100, 10);
    raycaster.ray.direction.set(0, 0, -1);
    const result = pickBeamAtRay(raycaster, geometry);
    expect(result.beamId).toBeNull();
    geometry.dispose();
  });
});

describe("beam geometry builders", () => {
  it("emits one box per beam with beamId attributes", () => {
    const { nodes, beams } = makeGridBeams(4);
    const geometry = buildBeamGeometry(nodes, beams, { width: 0.1 });
    const beamIds = geometry.getAttribute("beamId");
    // makeGridBeams(4) on a 2x2 grid yields 2 members (one per row).
    expect(beamIds.count).toBe(2 * 24);
    const ids = new Set<number>();
    for (let i = 0; i < beamIds.count; i++) {
      ids.add(beamIds.getX(i));
    }
    expect([...ids].sort((a, b) => a - b)).toEqual([1, 2]);
    geometry.dispose();
  });
  it("node positions are xyz triplets", () => {
    const { nodes } = makeGridBeams(2);
    const positions = nodePositions(nodes);
    expect(positions).toHaveLength(4 * 3);
    expect(positions[3]).toBeCloseTo(1, 9);
  });
});

describe("SnapGrid magnetic snapping (section 8.8)", () => {
  const nodes: NodeData[] = [{ id: 1, x: 2, y: 0, z: 0 }];
  const beams: BeamData[] = [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  it("prefers nodes over grid points", () => {
    const snapped = snapPoint({ x: 2.05, y: 0.02, z: 0 }, nodes, beams, nodeById, 0.05);
    expect(snapped.kind).toBe("node");
    expect(snapped.id).toBe(1);
  });
  it("snaps free points to the metric grid", () => {
    const snapped = snapPoint({ x: 3.034, y: 0.71, z: 0 }, nodes, beams, nodeById, 0.05);
    expect(snapped.kind).toBe("grid");
    expect(snapped.x).toBeCloseTo(3.05, 9);
    expect(snapped.y).toBeCloseTo(0.7, 9);
  });
  it("shift lock keeps the dominant axis only", () => {
    const locked = orthogonalLock({ x: 0, y: 0, z: 0 }, { x: 0.3, y: 0.8, z: 0.1 });
    expect(locked.y).toBeCloseTo(0.8, 9);
    expect(locked.x).toBeCloseTo(0, 9);
    expect(locked.z).toBeCloseTo(0, 9);
  });
});
