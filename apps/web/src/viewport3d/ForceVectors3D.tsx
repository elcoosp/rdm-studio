import { useCallback, useMemo } from "react";
import * as THREE from "three";
import type { BeamData, LoadData, NodeData } from "@/state/projectStore";

/**
 * Oriented 3D force arrows + moment arcs (ARCHITECTURE.md section 5,
 * `ForceVectors3D.tsx`; v2.4.0 rewrite).
 *
 * - Forces (Fx, Fy, Fz and distributed/point resultants) render as a thin
 *   cylindrical shaft + cone tip oriented EXACTLY along the effort direction
 *   (global or per-beam local), the cone tip touching the application point.
 * - Moments / torsion couples (Mx, My, Mz) render as a 270° torus rim +
 *   tangent cone at the arc end, normal to the moment axis (right-hand rule).
 *
 * Arrow length scales with the resultant magnitude within the case; the
 * thermal spectrum stays reserved for FEA fields.
 */

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Quaternion rotating the local +Y (cylinder axis) onto `dir`. */
function quatFromY(dir: THREE.Vector3): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(Y_AXIS, dir.clone().normalize());
}

/** A single force arrow: shaft + cone tip at the application point. */
function ForceArrow({
  at,
  direction,
  length,
  color,
  radius = 0.02,
}: {
  at: [number, number, number];
  direction: [number, number, number];
  length: number;
  color: string;
  radius?: number;
}) {
  const dir = useMemo(
    () => new THREE.Vector3(direction[0], direction[1], direction[2]).normalize(),
    [direction],
  );
  const quat = useMemo(() => quatFromY(dir), [dir]);
  // The cone tip sits at `at`; the shaft extends backwards along -dir.
  const headLen = Math.min(0.12, length * 0.4);
  const shaftLen = Math.max(length - headLen, 1e-3);
  const shaftCenter: [number, number, number] = [
    at[0] - dir.x * (headLen + shaftLen / 2),
    at[1] - dir.y * (headLen + shaftLen / 2),
    at[2] - dir.z * (headLen + shaftLen / 2),
  ];
  const headCenter: [number, number, number] = [
    at[0] - dir.x * (headLen / 2),
    at[1] - dir.y * (headLen / 2),
    at[2] - dir.z * (headLen / 2),
  ];
  return (
    <group>
      <mesh position={shaftCenter} quaternion={[quat.x, quat.y, quat.z, quat.w]}>
        <cylinderGeometry args={[radius, radius, shaftLen, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={headCenter} quaternion={[quat.x, quat.y, quat.z, quat.w]}>
        <coneGeometry args={[radius * 2.4, headLen, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

/** A moment couple: 270° torus rim normal to `axis` + tangent cone tip. */
function MomentArc({
  at,
  axis,
  radius,
  color,
}: {
  at: [number, number, number];
  axis: [number, number, number];
  radius: number;
  color: string;
}) {
  const quat = useMemo(() => {
    // Torus lies in its local X-Y plane with normal +Z; align +Z to `axis`.
    const n = new THREE.Vector3(axis[0], axis[1], axis[2]).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  }, [axis]);
  const arc = Math.PI * 1.5; // 270°
  // Tangent cone at the arc end (local X-Y plane).
  const endAngle = arc;
  const coneR = radius;
  const conePos: [number, number, number] = [
    Math.cos(endAngle) * coneR,
    Math.sin(endAngle) * coneR,
    0,
  ];
  // Tangent direction at the arc end (derivative of the circle).
  const tangent = new THREE.Vector3(-Math.sin(endAngle), Math.cos(endAngle), 0).normalize();
  const coneQuat = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, tangent);
  return (
    <group position={[at[0], at[1], at[2]]} quaternion={[quat.x, quat.y, quat.z, quat.w]}>
      <mesh>
        <torusGeometry args={[radius, radius * 0.16, 8, 24, arc]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={conePos} quaternion={[coneQuat.x, coneQuat.y, coneQuat.z, coneQuat.w]}>
        <coneGeometry args={[radius * 0.3, radius * 0.5, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

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

  const maxForce = useMemo(
    () =>
      loads.reduce((m, l) => {
        let intensity = 0;
        if (l.kind === "Nodal" || l.kind === "PointOnSpan") {
          intensity = Math.hypot(l.forces.fx, l.forces.fy, l.forces.fz);
        } else if (l.kind === "Trapezoid" || l.kind === "Uniform") {
          intensity = Math.abs((l.q_start ?? 0) + (l.q_end ?? 0)) / 2;
        }
        return Math.max(m, intensity);
      }, 1),
    [loads],
  );
  const maxMoment = useMemo(
    () =>
      loads.reduce((m, l) => {
        if (l.kind === "Nodal" || l.kind === "PointOnSpan") {
          return Math.max(m, Math.hypot(l.forces.mx, l.forces.my, l.forces.mz));
        }
        return m;
      }, 1),
    [loads],
  );

  // Beam geometry lookup for span/distributed arrows (member points).
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

  /** Renders the moment arcs for a load's concentrated moments (if any). */
  const momentArcs = (
    at: [number, number, number],
    mx: number,
    my: number,
    mz: number,
    keyPrefix: string,
  ) => {
    const arcs = [];
    const baseR = 0.18;
    if (mx !== 0) {
      arcs.push(
        <MomentArc
          key={`${keyPrefix}-mx`}
          at={at}
          axis={[1, 0, 0]}
          radius={baseR * (0.6 + 0.4 * Math.min(1, Math.abs(mx) / maxMoment))}
          color="#7C3AED"
        />,
      );
    }
    if (my !== 0) {
      arcs.push(
        <MomentArc
          key={`${keyPrefix}-my`}
          at={at}
          axis={[0, 1, 0]}
          radius={baseR * (0.6 + 0.4 * Math.min(1, Math.abs(my) / maxMoment))}
          color="#0891B2"
        />,
      );
    }
    if (mz !== 0) {
      arcs.push(
        <MomentArc
          key={`${keyPrefix}-mz`}
          at={at}
          axis={[0, 0, 1]}
          radius={baseR * (0.6 + 0.4 * Math.min(1, Math.abs(mz) / maxMoment))}
          color="#059669"
        />,
      );
    }
    return arcs;
  };

  return (
    <>
      {loads.map((load, index) => {
        if (load.kind === "Nodal") {
          const node = nodeById.get(load.node_id);
          if (node === undefined) {
            return null;
          }
          const { fx, fy, fz, mx, my, mz } = load.forces;
          const mag = Math.hypot(fx, fy, fz);
          const at: [number, number, number] = [node.x, node.y, node.z];
          const length = 0.2 + 0.8 * (mag / maxForce);
          return (
            <group key={index}>
              {mag > 0 ? (
                <ForceArrow
                  at={at}
                  direction={[fx, fy, fz]}
                  length={length}
                  color="#111827"
                  radius={0.02}
                />
              ) : null}
              {momentArcs(at, mx, my, mz, `n${index}`)}
            </group>
          );
        }
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
          const { fx, fy, fz, mx, my, mz } = load.forces;
          const mag = Math.hypot(fx, fy, fz);
          const length = 0.2 + 0.8 * (mag / maxForce);
          return (
            <group key={index}>
              {mag > 0 ? (
                <ForceArrow
                  at={at}
                  direction={[fx, fy, fz]}
                  length={length}
                  color="#DC2626"
                  radius={0.018}
                />
              ) : null}
              {momentArcs(at, mx, my, mz, `p${index}`)}
            </group>
          );
        }
        if (load.kind === "Uniform") {
          const span = beamSpan(load.beam_id);
          if (span === null) {
            return null;
          }
          const count = 5;
          const magnitude = Math.abs(((load.q_start ?? 0) + (load.q_end ?? 0)) / 2) / maxForce;
          const shaft = 0.15 + 0.7 * magnitude;
          const dir = load.direction ?? { x: 0, y: 0, z: -1 };
          const arrows = [];
          for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            const at: [number, number, number] = [
              span.a[0] + (span.b[0] - span.a[0]) * t,
              span.a[1] + (span.b[1] - span.a[1]) * t,
              span.a[2] + (span.b[2] - span.a[2]) * t,
            ];
            arrows.push(
              <ForceArrow
                key={`${index}-${i}`}
                at={at}
                direction={[dir.x, dir.y, dir.z]}
                length={shaft}
                color="#DC2626"
                radius={0.012}
              />,
            );
          }
          return <group key={index}>{arrows}</group>;
        }
        if (load.kind === "Trapezoid") {
          const span = beamSpan(load.beam_id);
          if (span === null) {
            return null;
          }
          const count = 5;
          const magnitude = Math.abs(load.q_start) / maxForce;
          const shaft = 0.15 + 0.7 * magnitude;
          const dir = load.direction ?? { x: 0, y: 0, z: -1 };
          const arrows = [];
          for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            const at: [number, number, number] = [
              span.a[0] + (span.b[0] - span.a[0]) * t,
              span.a[1] + (span.b[1] - span.a[1]) * t,
              span.a[2] + (span.b[2] - span.a[2]) * t,
            ];
            arrows.push(
              <ForceArrow
                key={`${index}-${i}`}
                at={at}
                direction={[dir.x, dir.y, dir.z]}
                length={shaft}
                color="#DC2626"
                radius={0.012}
              />,
            );
          }
          return <group key={index}>{arrows}</group>;
        }
        return null;
      })}
    </>
  );
}
