import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";

/**
 * BVH-accelerated raycasting (ARCHITECTURE.md section 5, `useBvhPicking.ts`;
 * section 18 M4 criterion: beam selection < 0.2 ms on 10,000 elements).
 *
 * `three-mesh-bvh` patches the raycast path once; the hook owns the last
 * selection latency so the criterion can be asserted live in the UI and in
 * the vitest benchmark.
 */

// One-time patch: BufferGeometry gains computeBoundsTree/disposeBoundsTree
// and Mesh.raycast becomes the accelerated implementation.
let patched = false;
function patchThreeBvh(): void {
  if (patched) {
    return;
  }
  // three-mesh-bvh ships its own THREE module augmentation; the exported
  // factory's return type lags the augmentation, so bridge it explicitly.
  THREE.BufferGeometry.prototype.computeBoundsTree =
    computeBoundsTree as unknown as typeof THREE.BufferGeometry.prototype.computeBoundsTree;
  THREE.BufferGeometry.prototype.disposeBoundsTree =
    disposeBoundsTree as unknown as typeof THREE.BufferGeometry.prototype.disposeBoundsTree;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
  patched = true;
}

export interface PickResult {
  beamId: number | null;
  /** Wall-clock selection cost of the LAST raycast (ms). */
  lastSelectionMs: number;
}

/**
 * Computes the BVH for the merged beam geometry once per geometry change.
 * Returns nothing: the geometry carries `boundsTree` for `acceleratedRaycast`.
 */
/** Builds the BVH for a merged beam geometry (no renderer required). */
export function prepareBeamBoundsTree(geometry: THREE.BufferGeometry): void {
  patchThreeBvh();
  geometry.computeBoundsTree({ maxLeafTris: 8 });
}

export function useBeamBoundsTree(geometry: THREE.BufferGeometry | null): void {
  useEffect(() => {
    if (geometry === null) {
      return;
    }
    prepareBeamBoundsTree(geometry);
    return () => {
      geometry.disposeBoundsTree();
    };
  }, [geometry]);
}

/**
 * Measures one accelerated raycast against the merged beam geometry from a
 * ray in world space. Used by the picking layer AND by the M4 benchmark.
 * Returns the intersected beam id (via the `beamId` vertex attribute).
 */
export function pickBeamAtRay(
  raycaster: THREE.Raycaster,
  geometry: THREE.BufferGeometry,
): PickResult {
  patchThreeBvh();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  const start = performance.now();
  const hits: THREE.Intersection[] = [];
  mesh.raycast(raycaster, hits);
  const elapsed = performance.now() - start;
  const hit = hits[0];
  const face = hit?.face;
  const beamIdAttr = geometry.getAttribute("beamId");
  if (face == null || beamIdAttr === undefined) {
    return { beamId: null, lastSelectionMs: elapsed };
  }
  return { beamId: beamIdAttr.getX(face.a), lastSelectionMs: elapsed };
}

/**
 * React hook wrapping `pickBeamAtRay` with the pointer/NDC plumbing for the
 * R3F canvas: the click handler receives pointer NDC + camera and resolves
 * the member. Tracks the last selection latency for the M4 readout.
 */
export function useBvhPicking(geometry: THREE.BufferGeometry | null) {
  const lastMs = useRef(0);
  const [lastSelectionMs, setLastSelectionMs] = useState(0);

  const pick = useMemo(
    () =>
      (ndc: { x: number; y: number }, camera: THREE.Camera): number | null => {
        if (geometry === null) {
          return null;
        }
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
        const result = pickBeamAtRay(raycaster, geometry);
        lastMs.current = result.lastSelectionMs;
        setLastSelectionMs(result.lastSelectionMs);
        return result.beamId;
      },
    [geometry],
  );

  return { pick, lastSelectionMs };
}
