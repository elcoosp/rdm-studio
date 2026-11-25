import * as THREE from "three";
import { useMemo } from "react";
import type { NodeData, SupportData } from "@/state/projectStore";

/**
 * RDM support symbols in 3D (ARCHITECTURE.md section 5, `SupportMarkers.tsx`).
 * Symbol derives from the 6-DOF restraint pattern (RDM 7 conventions):
 * fixed = plate + collar, pinned = triangle, roller = triangle on discs,
 * sliding = plate only, fork = two triangles. Neutral colors only — the
 * thermal spectrum stays reserved for FEA fields.
 *
 * v1.6.0 security/perf audit D: module-level shared geometries + materials
 * serve every symbol instance — the old per-symbol inline geometry JSX
 * allocated fresh GPU buffers for every support on every render.
 */

const PLATE_GEO = new THREE.BoxGeometry(0.18, 0.18, 0.03);
const COLLAR_GEO = new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12);
const CONE_GEO = new THREE.ConeGeometry(0.09, 0.14, 4);
const ROLLER_CONE_GEO = new THREE.ConeGeometry(0.09, 0.12, 4);
const DISC_GEO = new THREE.CylinderGeometry(0.03, 0.03, 0.16, 10);
const SLIDING_PLATE_GEO = new THREE.BoxGeometry(0.16, 0.16, 0.02);
const PIN_GEO = new THREE.SphereGeometry(0.035, 12, 12);

const DARK_MATERIAL = new THREE.MeshStandardMaterial({ color: "#374151" });
const MID_MATERIAL = new THREE.MeshStandardMaterial({ color: "#4B5563" });
const LIGHT_MATERIAL = new THREE.MeshStandardMaterial({ color: "#6B7280" });
const INK_MATERIAL = new THREE.MeshStandardMaterial({ color: "#111827" });

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
          <mesh position={[0, 0, -0.08]} geometry={PLATE_GEO} material={DARK_MATERIAL} />
          <mesh position={[0, 0, -0.04]} geometry={COLLAR_GEO} material={MID_MATERIAL} />
        </>
      ) : null}
      {kind === "pin" ? (
        <mesh position={[0, 0, -0.07]} geometry={CONE_GEO} material={DARK_MATERIAL} />
      ) : null}
      {kind === "roller" ? (
        <>
          <mesh position={[0, 0, -0.07]} geometry={ROLLER_CONE_GEO} material={MID_MATERIAL} />
          <mesh
            position={[0, 0, -0.15]}
            rotation={[Math.PI / 2, 0, 0]}
            geometry={DISC_GEO}
            material={LIGHT_MATERIAL}
          />
        </>
      ) : null}
      {kind === "sliding" ? (
        <mesh position={[0, 0, -0.06]} geometry={SLIDING_PLATE_GEO} material={LIGHT_MATERIAL} />
      ) : null}
      {/* Node pin head */}
      <mesh geometry={PIN_GEO} material={isFixed ? INK_MATERIAL : MID_MATERIAL} />
    </group>
  );
}
