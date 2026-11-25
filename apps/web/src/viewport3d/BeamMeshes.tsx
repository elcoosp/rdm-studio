import * as THREE from "three";
import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { BeamData, NodeData } from "@/state/projectStore";
import {
  beamProfileLookup,
  profileOutline,
  squareOutline,
  type ProfileDims,
} from "./ProfileShapes";

/**
 * Extruded volumetric beam rendering with the FEA thermal vertex-color
 * gradient (ARCHITECTURE.md section 5, `BeamMeshes.tsx`; spectrum tokens
 * from section 17, reserved to the 3D model only).
 *
 * All beams are merged into ONE BufferGeometry carrying a `beamId` vertex
 * attribute, so `three-mesh-bvh` resolves a ray hit to the member in a
 * single accelerated raycast (M4: < 0.2 ms on 10,000 elements). The pure
 * builders below run without a renderer and drive the vitest BVH benchmark.
 */

export const SPECTRUM_STOPS: [number, [number, number, number]][] = [
  [0.0, hexToRgb("#1D4ED8")],
  [0.25, hexToRgb("#06B6D4")],
  [0.5, hexToRgb("#10b981")],
  [0.75, hexToRgb("#F59E0B")],
  [1.0, hexToRgb("#DC2626")],
];

const LAST_STOP = SPECTRUM_STOPS[SPECTRUM_STOPS.length - 1] ?? [1, [1, 0, 0]];

export function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255];
}

/** Maps a ratio in [0, 1] onto the 5-tier FEA thermal spectrum (lerped). */
export function spectrumColor(ratio: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  for (let i = 1; i < SPECTRUM_STOPS.length; i++) {
    const upper = SPECTRUM_STOPS[i];
    const lower = SPECTRUM_STOPS[i - 1];
    if (upper !== undefined && lower !== undefined && t <= upper[0]) {
      const [t1, c1] = upper;
      const [t0, c0] = lower;
      // Exact stop endpoints return the stop color bit-for-bit (a k = 1
      // lerp can drift by one ulp on the round trip).
      if (t === t1) {
        return c1;
      }
      if (t === t0) {
        return c0;
      }
      const k = (t - t0) / (t1 - t0);
      return [
        c0[0] + (c1[0] - c0[0]) * k,
        c0[1] + (c1[1] - c0[1]) * k,
        c0[2] + (c1[2] - c0[2]) * k,
      ];
    }
  }
  return LAST_STOP[1];
}

export interface BeamGeometryOptions {
  /** Per-beam color ratio in [0, 1]; defaults to the neutral mid-tier. */
  colorRatios?: Map<number, number>;
  /** Nodal displacement vector (6 SI DOF per node) for the deformed shape. */
  displacements?: number[] | Float64Array;
  /** Deformation exaggeration factor (1 = true displacements). */
  deformScale?: number;
  /** Square profile width (m) of the extruded volumetric rendering. */
  width?: number;
  /**
   * True catalog dimensions per beam (bug 2): when provided, members
   * extrude their real I/U/CHS/RHS/L outline instead of the square box.
   */
  profiles?: Map<number, ProfileDims>;
  /** Per-beam section designation lookup used with `profileDims`. */
  beams_sections?: undefined;
}

interface UnitBox {
  vertices: number[];
  indices: number[];
}

function buildUnitBox(): UnitBox {
  // 6 faces x 4 vertices + 2 triangles each, outward-facing normals.
  const faceAxes: [THREE.Vector3, THREE.Vector3][] = [
    [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)],
    [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1)],
    [new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)],
    [new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0)],
    [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)],
    [new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0)],
  ];
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const [normal, up] of faceAxes) {
    const base = vertices.length / 3;
    const right = up.clone().cross(normal);
    const corners = [
      up.clone().add(right),
      up.clone().sub(right),
      up.clone().negate().sub(right),
      up.clone().negate().add(right),
    ];
    for (const c of corners) {
      vertices.push(normal.x + c.x, normal.y + c.y, normal.z + c.z);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { vertices, indices };
}

const UNIT_BOX = buildUnitBox();

/**
 * Builds the merged volumetric geometry for all beams: one box per member,
 * extruded along its axis with the RDM local frame (z = global Z). Every
 * vertex carries a `beamId` attribute and a thermal `color` attribute;
 * deformed shapes shift both end nodes by their scaled SI displacement.
 */
export function buildBeamGeometry(
  nodes: NodeData[],
  beams: BeamData[],
  options: BeamGeometryOptions = {},
): THREE.BufferGeometry {
  const width = options.width ?? 0.08;
  const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]));
  const positions: number[] = [];
  const colors: number[] = [];
  const beamIds: number[] = [];
  const indices: number[] = [];

  const displaced = (nodeId: number, axis: 0 | 1 | 2): number => {
    const index = nodeIndex.get(nodeId);
    if (index === undefined) {
      return 0;
    }
    const node = nodes[index];
    if (node === undefined) {
      return 0;
    }
    const base = axis === 0 ? node.x : axis === 1 ? node.y : node.z;
    if (options.displacements === undefined) {
      return base;
    }
    const raw = options.displacements[index * 6 + axis] ?? 0;
    return base + (Number.isFinite(raw) ? raw * (options.deformScale ?? 1) : 0);
  };

  for (const beam of beams) {
    const ax = displaced(beam.n1, 0);
    const ay = displaced(beam.n1, 1);
    const az = displaced(beam.n1, 2);
    const bx = displaced(beam.n2, 0);
    const by = displaced(beam.n2, 1);
    const bz = displaced(beam.n2, 2);
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (length < 1e-9) {
      continue;
    }
    // Local frame: x along the beam, z as close to global Z as possible.
    const exx = dx / length;
    const exy = dy / length;
    const exz = dz / length;
    let zx = 0;
    let zy = 0;
    let zz = 1;
    let dot = exx * zx + exy * zy + exz * zz;
    if (Math.abs(dot) > 0.999) {
      zx = 0;
      zy = 1;
      zz = 0;
      dot = exx * zx + exy * zy + exz * zz;
    }
    zx -= exx * dot;
    zy -= exy * dot;
    zz -= exz * dot;
    const zl = Math.sqrt(zx * zx + zy * zy + zz * zz) || 1;
    const znX = zx / zl;
    const znY = zy / zl;
    const znZ = zz / zl;
    const yx = znY * exz - znZ * exy;
    const yy = znZ * exx - znX * exz;
    const yz = znX * exy - znY * exx;
    const hw = width / 2;

    const ratio = options.colorRatios?.get(beam.id) ?? 0.5;
    const [r, g, b] = spectrumColor(ratio);
    const base = positions.length / 3;

    const dims = options.profiles?.get(beam.id);
    if (dims === undefined) {
      // Square-box path (benchmark + fallback rendering).
      for (let vi = 0; vi < UNIT_BOX.vertices.length; vi += 3) {
        const vx = UNIT_BOX.vertices[vi] ?? 0;
        const vy = UNIT_BOX.vertices[vi + 1] ?? 0;
        const vz = UNIT_BOX.vertices[vi + 2] ?? 0;
        positions.push(
          ax + exx * vx * length + yx * vy * hw + znX * vz * hw,
          ay + exy * vx * length + yy * vy * hw + znY * vz * hw,
          az + exz * vx * length + yz * vy * hw + znZ * vz * hw,
        );
        colors.push(r, g, b);
        beamIds.push(beam.id);
      }
      for (const index of UNIT_BOX.indices) {
        indices.push(base + index);
      }
      continue;
    }

    // True profile extrusion (bug 2): end rings at x = 0 / x = 1 in the
    // member frame, side quads between consecutive outline points, caps
    // triangulated with ShapeUtils (handles holes).
    const outline = profileOutline(dims);
    const contour = outline.contour;
    const nContour = contour.length;
    const holeRings = outline.holes;
    const ringSize = nContour + holeRings.reduce((acc, hole) => acc + hole.length, 0);
    const ringCoords: [number, number][] = [...contour, ...holeRings.flat()];
    const pushRing = (endX: number): number => {
      const ringBase = positions.length / 3;
      for (const [py, pz] of ringCoords) {
        positions.push(
          ax + exx * endX * length + yx * py + znX * pz,
          ay + exy * endX * length + yy * py + znY * pz,
          az + exz * endX * length + yz * py + znZ * pz,
        );
        colors.push(r, g, b);
        beamIds.push(beam.id);
      }
      return ringBase;
    };
    const baseA = pushRing(0);
    const baseB = pushRing(1);

    // Caps: triangulate the 2D outline (contour + holes).
    const flat = new Float32Array(ringSize * 2);
    for (const [i, [py, pz]] of ringCoords.entries()) {
      flat[i * 2] = py;
      flat[i * 2 + 1] = pz;
    }
    const triangles = THREE.ShapeUtils.triangulateShape(
      contour.map(([y, z]) => new THREE.Vector2(y, z)),
      holeRings.map((hole) => hole.map(([y, z]) => new THREE.Vector2(y, z))),
    );
    for (const tri of triangles) {
      for (const k of tri) {
        indices.push(baseA + k);
      }
    }
    const baseBCap = baseA + ringSize;
    for (const tri of triangles) {
      for (const k of tri) {
        indices.push(baseBCap + k);
      }
    }

    // Side walls: one quad per outline edge (contour closes on itself;
    // hole rings are separate closed loops).
    const edges: [number, number][] = [];
    for (let i = 0; i < nContour; i++) {
      edges.push([i, (i + 1) % nContour]);
    }
    let holeStart = nContour;
    for (const hole of holeRings) {
      for (let i = 0; i < hole.length; i++) {
        edges.push([holeStart + i, holeStart + ((i + 1) % hole.length)]);
      }
      holeStart += hole.length;
    }
    for (const [i, j] of edges) {
      indices.push(baseA + i, baseA + j, baseB + j);
      indices.push(baseA + i, baseB + j, baseB + i);
    }
    void ringSize;
    void base;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("beamId", new THREE.Float32BufferAttribute(beamIds, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Node marker positions (xyz per node) used by the node layer. */
export function nodePositions(nodes: NodeData[]): Float32Array {
  const out = new Float32Array(nodes.length * 3);
  for (const [i, n] of nodes.entries()) {
    out[i * 3] = n.x;
    out[i * 3 + 1] = n.y;
    out[i * 3 + 2] = n.z;
  }
  return out;
}

interface BeamMeshesProps {
  nodes: NodeData[];
  beams: BeamData[];
  colorRatios?: Map<number, number>;
  displacements?: number[] | Float64Array;
  deformScale?: number;
  wireframe: boolean;
  selectedBeamId: number | null;
  onPick: (beamId: number | null) => void;
  /** Catalog dims by section designation (bug 2 true extrusion). */
  sectionDims?: Map<string, ProfileDims>;
}

export function BeamMeshes({
  nodes,
  beams,
  colorRatios,
  displacements,
  deformScale,
  wireframe,
  selectedBeamId,
  onPick,
  sectionDims,
}: BeamMeshesProps) {
  const geometry = useMemo(
    () =>
      buildBeamGeometry(nodes, beams, {
        colorRatios,
        displacements,
        deformScale,
        profiles: sectionDims === undefined ? undefined : beamProfileLookup(beams, sectionDims),
      }),
    [nodes, beams, colorRatios, displacements, deformScale, sectionDims],
  );
  const selectedGeometry = useMemo(() => {
    if (selectedBeamId === null) {
      return null;
    }
    const beam = beams.find((b) => b.id === selectedBeamId);
    if (beam === undefined) {
      return null;
    }
    const dims = sectionDims?.get(beam.section_id);
    const profiles =
      dims === undefined ? undefined : new Map<number, ProfileDims>([[beam.id, dims]]);
    return buildBeamGeometry(nodes, [beam], { displacements, deformScale, profiles });
  }, [nodes, beams, selectedBeamId, displacements, deformScale]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const id = geometry.getAttribute("beamId");
    const face = event.face;
    if (face == null || id === undefined) {
      onPick(null);
      return;
    }
    onPick(id.getX(face.a));
  };

  return (
    <>
      {wireframe ? (
        <lineSegments>
          <edgesGeometry args={[geometry, 25]} />
          <lineBasicMaterial color="#94A3B8" />
        </lineSegments>
      ) : (
        <mesh geometry={geometry} onClick={handleClick}>
          <meshStandardMaterial vertexColors flatShading side={THREE.DoubleSide} />
        </mesh>
      )}
      {selectedGeometry !== null ? (
        <lineSegments>
          <edgesGeometry args={[selectedGeometry, 25]} />
          <lineBasicMaterial color="#1D4ED8" />
        </lineSegments>
      ) : null}
    </>
  );
}
