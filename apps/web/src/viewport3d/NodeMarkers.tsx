import * as THREE from "three";

/**
 * Instanced node pins (v1.3.0), shared by every step through the
 * persistent stage. `highlightNodeId` renders a larger cobalt marker
 * (table-hover highlight), and `onPickNode` enables 3D click-to-restrain
 * in Step 2 — the marker index maps back through `nodeIds`.
 *
 * v1.6.0 security/perf audit D: ONE module-level `SphereGeometry` and ONE
 * shared `MeshStandardMaterial` serve every marker — the old per-marker
 * inline `<sphereGeometry>`/`<meshStandardMaterial>` allocated (and
 * leaked) two GPU objects per node per render.
 */

const NODE_SPHERE = new THREE.SphereGeometry(0.055, 16, 12);
const NODE_SPHERE_SELECTED = new THREE.SphereGeometry(0.085, 16, 12);
const NODE_MATERIAL = new THREE.MeshStandardMaterial({ color: "#0F172A" });
const NODE_MATERIAL_SELECTED = new THREE.MeshStandardMaterial({ color: "#1D4ED8" });

export function NodeMarkers({
  positions,
  highlightNodeId = null,
  nodeIds,
  onPickNode,
}: {
  positions: Float32Array;
  highlightNodeId?: number | null;
  /** Dense id per position index (defaults to index + 1). */
  nodeIds?: number[];
  onPickNode?: (nodeId: number | null) => void;
}) {
  // Explicit id list wins; otherwise fall back to dense 1-based ids.
  const ids: number[] =
    nodeIds !== undefined && nodeIds.length > 0
      ? nodeIds
      : Array.from({ length: Math.floor(positions.length / 3) }, (_, i) => i + 1);
  return (
    <>
      {ids.length > 0
        ? ids.map((id, i) => {
            const x = positions[i * 3];
            const y = positions[i * 3 + 1];
            const z = positions[i * 3 + 2];
            if (x === undefined || y === undefined || z === undefined) {
              return null;
            }
            const selected = id === highlightNodeId;
            return (
              <mesh
                key={id}
                position={[x, y, z]}
                geometry={selected ? NODE_SPHERE_SELECTED : NODE_SPHERE}
                material={selected ? NODE_MATERIAL_SELECTED : NODE_MATERIAL}
                onClick={(event) => {
                  event.stopPropagation();
                  onPickNode?.(id);
                }}
              />
            );
          })
        : null}
    </>
  );
}
