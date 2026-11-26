import { useCallback, useMemo } from "react";
import * as THREE from "three";
import type { BeamData, LoadData, NodeData } from "@/state/projectStore";

/**
 * Oriented 3D force arrows (ARCHITECTURE.md section 5, `ForceVectors3D.tsx`).
 * Arrow length scales with |Fz| within the case; color is the neutral ink
 * tone — the thermal spectrum stays reserved for FEA fields.
 */
export function ForceVectors3D({
  nodes,
  beams,
  loads,
}: {
  nodes: NodeData[];
  beams: BeamData[];
  loads: LoadData[];
}) {
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const maxAbs = useMemo(
    () =>
      loads.reduce((m, l) => {
        const intensity =
          l.kind === "Nodal" || l.kind === "PointOnSpan"
            ? Math.abs(l.forces.fz)
            : l.kind === "Trapezoid" || l.kind === "Uniform"
              ? Math.abs((l.q_start ?? 0) + (l.q_end ?? 0)) / 2
              : 0;
        return Math.max(m, intensity);
      }, 1),
    [loads],
  );

  // Beam geometry lookup for span/distributed arrows (member midpoints).
  const beamSpan = useCallback(
    (
      beamId: number,
    ): { a: [number, number, number]; b: [number, number, number]; length: number } | null => {
      const beam = beams.find((b) => b.id === beamId);
      if (beam === undefined) {
        return null;
      }
      const n1 = nodeById.get(beam.n1);
      const n2 = nodeById.get(beam.n2);
      if (n1 === undefined || n2 === undefined) {
        return null;
      }
      const length = Math.hypot(n2.x - n1.x, n2.y - n1.y, n2.z - n1.z);
      return { a: [n1.x, n1.y, n1.z], b: [n2.x, n2.y, n2.z], length };
    },
    [beams, nodeById],
  );

  const spanArrow = (
    at: [number, number, number],
    length: number,
    downward: boolean,
    index: number,
  ) => (
    <group key={index} position={[at[0], at[1], at[2] + (downward ? length / 2 : -length / 2)]}>
      <mesh>
        <cylinderGeometry args={[0.015, 0.015, length, 8]} />
        <meshStandardMaterial color="#DC2626" />
      </mesh>
      <mesh
        position={[0, 0, downward ? -length / 2 : length / 2]}
        rotation={[downward ? Math.PI : 0, 0, 0]}
      >
        <coneGeometry args={[0.045, 0.11, 10]} />
        <meshStandardMaterial color="#DC2626" />
      </mesh>
    </group>
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
        }
        // v1.4.0: PointOnSpan + Trapezoid render in the viewport (crimson
        // arrow array along the member + a top tie bar for distributed).
        if (load.kind === "PointOnSpan") {
          const span = beamSpan(load.beam_id);
          if (span === null) {
            return null;
          }
          const t = Math.min(1, Math.max(0, load.position_ratio));
          const at: [number, number, number] = [
            span.a[0] + (span.b[0] - span.a[0]) * t,
            span.a[1] + (span.b[1] - span.a[1]) * t,
            span.a[2] + (span.b[2] - span.a[2]) * t,
          ];
          const magnitude = Math.abs(load.forces.fz) / maxAbs;
          return spanArrow(at, 0.2 + 0.8 * magnitude, load.forces.fz < 0, index);
        }
        // v2.1.2 (audit 519229b): Uniform loads (EN 1991 Snow / Wind /
        // imposed generators) render as the SAME crimson arrow array as
        // the Trapezoid case — they used to be invisible in 3D.
        if (load.kind === "Uniform") {
          const span = beamSpan(load.beam_id);
          if (span === null) {
            return null;
          }
          const arrows = [];
          const count = 5;
          const magnitude = Math.abs(((load.q_start ?? 0) + (load.q_end ?? 0)) / 2) / maxAbs;
          const shaft = 0.15 + 0.7 * magnitude;
          const meanDirection = load.direction ?? { x: 0, y: 0, z: -1 };
          const downward = meanDirection.z < 0 || (meanDirection.z === 0 && meanDirection.y < 0);
          for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            const at: [number, number, number] = [
              span.a[0] + (span.b[0] - span.a[0]) * t,
              span.a[1] + (span.b[1] - span.a[1]) * t,
              span.a[2] + (span.b[2] - span.a[2]) * t,
            ];
            arrows.push(
              <group
                key={`${index}-${i}`}
                position={[at[0], at[1], at[2] + (downward ? shaft / 2 : -shaft / 2)]}
              >
                <mesh>
                  <cylinderGeometry args={[0.012, 0.012, shaft, 8]} />
                  <meshStandardMaterial color="#DC2626" />
                </mesh>
                <mesh
                  position={[0, 0, downward ? -shaft / 2 : shaft / 2]}
                  rotation={[downward ? Math.PI : 0, 0, 0]}
                >
                  <coneGeometry args={[0.035, 0.09, 10]} />
                  <meshStandardMaterial color="#DC2626" />
                </mesh>
              </group>,
            );
          }
          // Top tie bar linking the arrow tails, oriented ALONG the member.
          const tieY = (downward ? shaft : -shaft) + (downward ? 0.05 : -0.05);
          const dir = new THREE.Vector3(
            span.b[0] - span.a[0],
            span.b[1] - span.a[1],
            span.b[2] - span.a[2],
          ).normalize();
          const tieQuaternion = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(1, 0, 0),
            dir,
          );
          arrows.push(
            <mesh
              key={`${index}-tie`}
              position={[
                (span.a[0] + span.b[0]) / 2,
                (span.a[1] + span.b[1]) / 2,
                (span.a[2] + span.b[2]) / 2 + tieY / 2,
              ]}
              quaternion={[tieQuaternion.x, tieQuaternion.y, tieQuaternion.z, tieQuaternion.w]}
            >
              <boxGeometry args={[span.length, 0.012, 0.012]} />
              <meshStandardMaterial color="#DC2626" />
            </mesh>,
          );
          return <group key={index}>{arrows}</group>;
        }
        if (load.kind === "Trapezoid") {
          const span = beamSpan(load.beam_id);
          if (span === null) {
            return null;
          }
          const arrows = [];
          const count = 5;
          const magnitude = Math.abs(load.q_start) / maxAbs;
          const shaft = 0.15 + 0.7 * magnitude;
          const downward = (load.q_start + load.q_end) / 2 < 0;
          for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            const at: [number, number, number] = [
              span.a[0] + (span.b[0] - span.a[0]) * t,
              span.a[1] + (span.b[1] - span.a[1]) * t,
              span.a[2] + (span.b[2] - span.a[2]) * t,
            ];
            arrows.push(
              <group
                key={`${index}-${i}`}
                position={[at[0], at[1], at[2] + (downward ? shaft / 2 : -shaft / 2)]}
              >
                <mesh>
                  <cylinderGeometry args={[0.012, 0.012, shaft, 8]} />
                  <meshStandardMaterial color="#DC2626" />
                </mesh>
                <mesh
                  position={[0, 0, downward ? -shaft / 2 : shaft / 2]}
                  rotation={[downward ? Math.PI : 0, 0, 0]}
                >
                  <coneGeometry args={[0.035, 0.09, 10]} />
                  <meshStandardMaterial color="#DC2626" />
                </mesh>
              </group>,
            );
          }
          // Top tie bar linking the arrow tails: oriented ALONG the member
          // vector (v1.5.0 defect — diagonal and vertical members used to
          // stick out along global X because the box ran on the local X axis
          // with no orientation quaternion).
          const tieY = (downward ? shaft : -shaft) + (downward ? 0.05 : -0.05);
          const dir = new THREE.Vector3(
            span.b[0] - span.a[0],
            span.b[1] - span.a[1],
            span.b[2] - span.a[2],
          ).normalize();
          const tieQuaternion = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(1, 0, 0),
            dir,
          );
          arrows.push(
            <mesh
              key={`${index}-tie`}
              position={[
                (span.a[0] + span.b[0]) / 2,
                (span.a[1] + span.b[1]) / 2,
                (span.a[2] + span.b[2]) / 2 + tieY / 2,
              ]}
              quaternion={[tieQuaternion.x, tieQuaternion.y, tieQuaternion.z, tieQuaternion.w]}
            >
              <boxGeometry args={[span.length, 0.012, 0.012]} />
              <meshStandardMaterial color="#DC2626" />
            </mesh>,
          );
          return <group key={index}>{arrows}</group>;
        }
        return null;
      })}
    </>
  );
}
