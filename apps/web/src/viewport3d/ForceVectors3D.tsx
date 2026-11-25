import { useMemo } from "react";
import type { LoadData, NodeData } from "@/state/projectStore";

/**
 * Oriented 3D force arrows (ARCHITECTURE.md section 5, `ForceVectors3D.tsx`).
 * Arrow length scales with |Fz| within the case; color is the neutral ink
 * tone — the thermal spectrum stays reserved for FEA fields.
 */
export function ForceVectors3D({ nodes, loads }: { nodes: NodeData[]; loads: LoadData[] }) {
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const maxAbs = useMemo(
    () =>
      loads.reduce(
        (m, l) => Math.max(m, l.kind === "Trapezoid" ? Math.abs(l.q_start) : Math.abs(l.forces.fz)),
        1,
      ),
    [loads],
  );

  return (
    <>
      {loads.map((load, index) => {
        if (load.kind !== "Nodal") {
          return null; // span/distributed loads render on the beams in a later slice
        }
        const node = nodeById.get(load.node_id);
        if (node === undefined) {
          return null;
        }
        const magnitude = Math.abs(load.forces.fz) / maxAbs;
        const length = 0.2 + 0.8 * magnitude;
        const downward = load.forces.fz < 0;
        return (
          <group
            key={index}
            position={[node.x, node.y, node.z + (downward ? length / 2 : -length / 2)]}
          >
            <mesh>
              <cylinderGeometry args={[0.02, 0.02, length, 8]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
            <mesh
              position={[0, 0, downward ? -length / 2 : length / 2]}
              rotation={[downward ? Math.PI : 0, 0, 0]}
            >
              <coneGeometry args={[0.05, 0.12, 10]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
