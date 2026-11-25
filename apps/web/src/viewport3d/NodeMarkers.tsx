import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Instanced node pins (Points layer), v1.3.0: shared by Step 1 and
 * Step 2. `highlightNodeId` renders a larger cobalt marker (table-hover
 * highlight), and `onPickNode` enables 3D click-to-restrain in Step 2 —
 * the marker index maps back through `nodeIds`.
 */
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
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);
  const highlight = useMemo(() => {
    if (highlightNodeId === null || positions.length < 3) {
      return null;
    }
    const index = highlightNodeId - 1;
    if (index < 0 || (index + 1) * 3 > positions.length) {
      return null;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(positions.slice(index * 3, index * 3 + 3), 3),
    );
    return g;
  }, [positions, highlightNodeId]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    // r3f points events carry the picked point `index`.
    if (event.index === undefined) {
      onPickNode?.(null);
      return;
    }
    event.stopPropagation();
    const id = nodeIds?.[event.index] ?? event.index + 1;
    onPickNode?.(id);
  };

  return (
    <>
      <points geometry={geometry} onClick={handleClick}>
        <pointsMaterial size={0.08} color="#0F172A" sizeAttenuation />
      </points>
      {highlight !== null ? (
        <points geometry={highlight}>
          <pointsMaterial size={0.18} color="#1D4ED8" sizeAttenuation />
        </points>
      ) : null}
    </>
  );
}
