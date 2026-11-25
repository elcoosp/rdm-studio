import { useMemo } from "react";
import * as THREE from "three";
import { useProjectStore, type BeamData, type LoadData, type NodeData } from "@/state/projectStore";

/**
 * Oriented 3D force arrows (ARCHITECTURE.md section 5, `ForceVectors3D.tsx`):
 * crimson `#DC2626` arrows (§4, mockups tape_3) for nodal loads, an array of
 * distributed arrows joined by a top bar for trapezoid/uniform beam loads
 * (heights follow the q1→q2 variation), and a single arrow at `a/L` for
 * point-on-span loads. Arrow length scales with |F| within the case.
 */

const CRIMSON = "#DC2626";

function Arrow({ length, downward }: { length: number; downward: boolean }) {
  const shaft = Math.max(length - 0.1, 0.02);
  return (
    <group>
      <mesh position={[0, 0, downward ? -shaft / 2 : shaft / 2]}>
        <cylinderGeometry args={[0.02, 0.02, shaft, 8]} />
        <meshStandardMaterial color={CRIMSON} />
      </mesh>
      <mesh
        position={[0, 0, downward ? -length + 0.06 : length - 0.06]}
        rotation={[downward ? Math.PI : 0, 0, 0]}
      >
        <coneGeometry args={[0.05, 0.12, 10]} />
        <meshStandardMaterial color={CRIMSON} />
      </mesh>
    </group>
  );
}

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
        if (load.kind === "Nodal") {
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
              <Arrow length={length} downward={downward} />
            </group>
          );
        }

        const beam = load.kind === "PointOnSpan" || load.kind === "Trapezoid" ? load : null;
        if (beam === null) {
          return null;
        }
        return (
          <SpanLoadArrows
            key={index}
            loadIndex={index}
            beamId={beam.beam_id}
            load={load}
            maxAbs={maxAbs}
          />
        );
      })}
    </>
  );
}

/** Resolves the member endpoints and renders the span-load graphics. */
function SpanLoadArrows({
  beamId,
  load,
  maxAbs,
}: {
  loadIndex: number;
  beamId: number;
  load: LoadData;
  maxAbs: number;
}) {
  const nodes = useProjectStore((s) => s.project.structure.nodes);
  const beams = useProjectStore((s) => s.project.structure.beams);
  const beam: BeamData | undefined = beams.find((b) => b.id === beamId);
  const n1 = beam === undefined ? undefined : nodes.find((n) => n.id === beam.n1);
  const n2 = beam === undefined ? undefined : nodes.find((n) => n.id === beam.n2);
  void nodes;

  if (n1 === undefined || n2 === undefined) {
    return null;
  }
  const ax = n1.x;
  const ay = n1.y;
  const az = n1.z;
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const dz = n2.z - n1.z;
  const length = Math.hypot(dx, dy, dz);
  if (length < 1e-9) {
    return null;
  }
  const ux = dx / length;
  const uy = dy / length;
  const uz = dz / length;

  if (load.kind === "PointOnSpan") {
    const magnitude = Math.abs(load.forces.fz) / maxAbs;
    const arrowLength = 0.2 + 0.8 * magnitude;
    const downward = load.forces.fz < 0;
    const px = ax + ux * load.position_ratio * length;
    const py = ay + uy * load.position_ratio * length;
    const pz = az + uz * load.position_ratio * length;
    return (
      <group position={[px, py, pz + (downward ? arrowLength / 2 : -arrowLength / 2)]}>
        <Arrow length={arrowLength} downward={downward} />
      </group>
    );
  }

  if (load.kind !== "Trapezoid") {
    return null;
  }
  // Distributed load: arrow array with linearly varying heights plus a top
  // bar joining the tails (classic RDM diagram style).
  const spanArrows = 6;
  const q1 = Math.abs(load.q_start) / maxAbs;
  const q2 = Math.abs(load.q_end) / maxAbs;
  const downward = load.q_start + load.q_end < 0;
  const heights = Array.from({ length: spanArrows }, (_, i) => {
    const t = i / (spanArrows - 1);
    return 0.15 + 0.65 * (q1 + (q2 - q1) * t);
  });
  const tails: [number, number, number][] = heights.map((h, i) => {
    const t = i / (spanArrows - 1);
    return [ax + ux * t * length, ay + uy * t * length, az + uz * t * length + (downward ? h : -h)];
  });
  const barGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        tails.flatMap(([x, y, z]) => [x, y, z]),
        3,
      ),
    );
    return geometry;
  }, [tails]);

  return (
    <group>
      {tails.map((tail, i) => {
        const [x, y, z] = tail;
        const h = heights[i] ?? 0.15;
        return (
          <group key={i} position={[x, y, z + (downward ? h / 2 : -h / 2)]}>
            <Arrow length={h} downward={downward} />
          </group>
        );
      })}
      {/* Top bar through the arrow tails. */}
      <line>
        <primitive object={barGeometry} attach="geometry" />
        <lineBasicMaterial color={CRIMSON} />
      </line>
    </group>
  );
}
