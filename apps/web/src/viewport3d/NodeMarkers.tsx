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
  // v1.4.0: crisp 3D spheres (r = 0.055 m) instead of 2D point sprites —
  // visible outside IPE flanges and pickable per node id.
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
                onClick={(event) => {
                  event.stopPropagation();
                  onPickNode?.(id);
                }}
              >
                <sphereGeometry args={[selected ? 0.085 : 0.055, 16, 12]} />
                <meshStandardMaterial color={selected ? "#1D4ED8" : "#0F172A"} />
              </mesh>
            );
          })
        : null}
    </>
  );
}
