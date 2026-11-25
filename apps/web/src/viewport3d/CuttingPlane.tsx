import { useMemo } from "react";
import * as THREE from "three";
import type { BeamData, NodeData } from "@/state/projectStore";

/**
 * Translucent Cobalt cutting plane (DESIGN.md §8.5): scrubbing `x ∈ [0, L]`
 * in the docked inspector translates this plane along the active member in
 * real time, synchronized with the uPlot cursor line.
 */
export function CuttingPlane({
  nodes,
  beams,
  beamId,
  ratio,
}: {
  nodes: NodeData[];
  beams: BeamData[];
  beamId: number | null;
  /** Position along the member, `x / L` in [0, 1]. */
  ratio: number;
}) {
  const placement = useMemo(() => {
    const beam = beams.find((b) => b.id === beamId);
    if (beam === undefined) {
      return null;
    }
    const n1 = nodes.find((n) => n.id === beam.n1);
    const n2 = nodes.find((n) => n.id === beam.n2);
    if (n1 === undefined || n2 === undefined) {
      return null;
    }
    const a = new THREE.Vector3(n1.x, n1.y, n1.z);
    const b = new THREE.Vector3(n2.x, n2.y, n2.z);
    const axis = b.clone().sub(a);
    const length = axis.length();
    if (length < 1e-9) {
      return null;
    }
    axis.divideScalar(length);
    const center = a.clone().addScaledVector(axis, ratio * length);
    // Orient the plane perpendicular to the member axis (plane geometry
    // lies in XY; rotate so its normal = axis, then keep it vertical).
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    // Section plane: local Y up (Z), local X horizontal — use a billboarded
    // box of the section bounding size so the plane reads as a cut.
    const size = 0.35;
    return { center, quaternion, length, size };
  }, [nodes, beams, beamId, ratio]);

  if (placement === null) {
    return null;
  }
  return (
    <group position={placement.center} quaternion={placement.quaternion}>
      <mesh data-testid="cutting-plane">
        <planeGeometry args={[placement.size * 2, placement.size * 2.5]} />
        <meshBasicMaterial
          color="#1D4ED8"
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(placement.size * 2, placement.size * 2.5)]} />
        <lineBasicMaterial color="#1D4ED8" transparent opacity={0.6} />
      </lineSegments>
    </group>
  );
}
