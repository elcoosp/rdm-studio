import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useProjectStore } from "@/state/projectStore";

/**
 * Translucent Cobalt cutting plane (DESIGN.md §8.5): scrubbing `x ∈ [0, L]`
 * in the docked inspector translates this plane along the active member in
 * real time, synchronized with the uPlot cursor line.
 *
 * v1.6.0 security/perf audit D: the plane + edge outline geometries are
 * memoized and `.dispose()`d when the placement (or the beam) changes —
 * the old inline `new THREE.PlaneGeometry(...)` inside JSX args leaked one
 * GPU buffer per scrub frame.
 */
export function CuttingPlane({
  beamId,
  ratio,
}: {
  /** Member id under inspection. */
  beamId: number;
  /** Position along the member, `x / L` in [0, 1]. */
  ratio: number;
}) {
  const nodes = useProjectStore((s) => s.project.structure.nodes);
  const beams = useProjectStore((s) => s.project.structure.beams);
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

  const width = placement === null ? 0 : placement.size * 2;
  const height = placement === null ? 0 : placement.size * 2.5;
  // v1.6.0 audit D: memoized geometries, disposed on replacement.
  const planeGeometry = useMemo(() => new THREE.PlaneGeometry(width, height), [width, height]);
  const edgesGeometry = useMemo(() => new THREE.EdgesGeometry(planeGeometry), [planeGeometry]);
  useEffect(() => {
    return () => {
      planeGeometry.dispose();
      edgesGeometry.dispose();
    };
  }, [planeGeometry, edgesGeometry]);

  if (placement === null) {
    return null;
  }
  return (
    <group position={placement.center} quaternion={placement.quaternion}>
      <mesh data-testid="cutting-plane" geometry={planeGeometry}>
        <meshBasicMaterial
          color="#1D4ED8"
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={edgesGeometry}>
        <lineBasicMaterial color="#1D4ED8" transparent opacity={0.6} />
      </lineSegments>
    </group>
  );
}
