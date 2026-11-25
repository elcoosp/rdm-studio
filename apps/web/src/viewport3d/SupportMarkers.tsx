import { useMemo } from "react";
import type { SupportData } from "@/state/projectStore";
import type { NodeData } from "@/state/projectStore";

/**
 * RDM support symbols in 3D (ARCHITECTURE.md section 5, `SupportMarkers.tsx`).
 * Symbol derives from the 6-DOF restraint pattern (RDM 7 conventions):
 * fixed = plate + collar, pinned = triangle, roller = triangle on discs,
 * sliding = plate only, fork = two triangles. Neutral colors only — the
 * thermal spectrum stays reserved for FEA fields.
 */
export function SupportMarkers({
  nodes,
  supports,
}: {
  nodes: NodeData[];
  supports: SupportData[];
}) {
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <>
      {supports.map((support) => {
        const node = nodeById.get(support.node_id);
        if (node === undefined) {
          return null;
        }
        return (
          <SupportSymbol
            key={`${support.node_id}`}
            position={[node.x, node.y, node.z]}
            locked={support.locked_dofs}
          />
        );
      })}
    </>
  );
}

function SupportSymbol({
  position,
  locked,
}: {
  position: [number, number, number];
  locked: boolean[];
}) {
  const [ux, uy, uz, rx, ry, rz] = locked;
  const isFixed = ux && uy && uz && rx && ry && rz;
  const isPin = uz && ux && !ry;
  const isRoller = uz && !ux && !uy;
  const kind: "fixed" | "pin" | "roller" | "sliding" = isFixed
    ? "fixed"
    : isPin
      ? "pin"
      : isRoller
        ? "roller"
        : "sliding";
  return (
    <group position={position}>
      {kind === "fixed" ? (
        <>
          <mesh position={[0, 0, -0.08]}>
            <boxGeometry args={[0.18, 0.18, 0.03]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
          <mesh position={[0, 0, -0.04]}>
            <cylinderGeometry args={[0.05, 0.05, 0.06, 12]} />
            <meshStandardMaterial color="#4B5563" />
          </mesh>
        </>
      ) : null}
      {kind === "pin" ? (
        <mesh position={[0, 0, -0.07]} rotation={[0, 0, 0]}>
          <coneGeometry args={[0.09, 0.14, 4]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
      ) : null}
      {kind === "roller" ? (
        <>
          <mesh position={[0, 0, -0.07]}>
            <coneGeometry args={[0.09, 0.12, 4]} />
            <meshStandardMaterial color="#4B5563" />
          </mesh>
          <mesh position={[0, 0, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.16, 10]} />
            <meshStandardMaterial color="#6B7280" />
          </mesh>
        </>
      ) : null}
      {kind === "sliding" ? (
        <mesh position={[0, 0, -0.06]}>
          <boxGeometry args={[0.16, 0.16, 0.02]} />
          <meshStandardMaterial color="#6B7280" />
        </mesh>
      ) : null}
      {/* Node pin head */}
      <mesh>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color={isFixed ? "#111827" : "#4B5563"} />
      </mesh>
    </group>
  );
}
