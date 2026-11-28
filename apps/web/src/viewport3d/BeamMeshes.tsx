import * as THREE from "three";
import { useEffect, useMemo, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { BeamData, NodeData } from "@/state/projectStore";
import { beamProfileLookup, profileOutline, type ProfileDims } from "./ProfileShapes";

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

/**
 * v2.4.0: section-family colour palette (DESIGN.md §17) used to tint members
 * by their profile family outside the FEA thermal results view. Mirrors the
 * `familyOfDesignation` grouping in `@/components/FamilyPills`.
 */
export const FAMILY_COLORS: Record<string, string> = {
  IPE: "#1D4ED8",
  HEA: "#0891B2",
  UPN: "#7C3AED",
  CHS: "#059669",
  RHS: "#D97706",
  L: "#DB2777",
  Perso: "#475569",
};

/** Maps a section designation onto its family colour (hex). */
export function familyColorOf(designation: string): string {
  const upper = designation.toUpperCase();
  if (upper.startsWith("IPE")) return FAMILY_COLORS.IPE ?? "#1D4ED8";
  if (upper.startsWith("HEA") || upper.startsWith("HEB") || upper.startsWith("HEM")) {
    return FAMILY_COLORS.HEA ?? "#0891B2";
  }
  if (upper.startsWith("UPN") || upper.startsWith("UPE")) return FAMILY_COLORS.UPN ?? "#7C3AED";
  if (upper.startsWith("CHS") || upper.startsWith("D")) return FAMILY_COLORS.CHS ?? "#059669";
  if (upper.startsWith("RHS") || upper.startsWith("SHS")) return FAMILY_COLORS.RHS ?? "#D97706";
  if (upper.startsWith("L ") || upper.startsWith("INL") || upper.startsWith("ANG")) {
    return FAMILY_COLORS.L ?? "#DB2777";
  }
  return FAMILY_COLORS.Perso ?? "#475569";
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
  /**
   * v2.4.0: per-beam family colour (linear RGB) used outside the FEA
   * thermal view. Ignored for any beam that carries a `colorRatios` entry.
   */
  beamColors?: Map<number, [number, number, number]>;
  /**
   * M10.3: ids of the TensionOnly / CompressionOnly members the solver
   * deactivated (buckled cable / strut) — rendered in dim slate instead
   * of their family colour or thermal tier.
   */
  inactiveBeamIds?: Set<number>;
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
    // v2.4.0: roll θx (rad) about the member's local longitudinal X axis —
    // rotates the section outline (web/flanges) in the local Y-Z plane.
    const roll = Number.isFinite(beam.roll_angle_rad) ? beam.roll_angle_rad : 0;
    const cosR = Math.cos(roll);
    const sinR = Math.sin(roll);

    const ratio = options.colorRatios?.get(beam.id) ?? 0.5;
    const familyRgb = options.beamColors?.get(beam.id);
    const [r, g, b] =
      (options.inactiveBeamIds?.has(beam.id) ?? false)
        ? hexToRgb("#64748B")
        : options.colorRatios?.has(beam.id) || familyRgb === undefined
          ? spectrumColor(ratio)
          : familyRgb;
    // M10.3: tension-only members render as slender rods (the RDM 7
    // tirant is a rod, not a framed profile); the turnbuckle cylinder is
    // overlaid separately by `TurnbuckleMarkers`.
    const hw =
      (beam.behavior === "TensionOnly" || beam.behavior === "CompressionOnly"
        ? Math.max(width * 0.3, 0.02)
        : width) / 2;
    const base = positions.length / 3;

    const dims = options.profiles?.get(beam.id);
    if (dims === undefined) {
      // Square-box path (benchmark + fallback rendering).
      for (let vi = 0; vi < UNIT_BOX.vertices.length; vi += 3) {
        const vx = UNIT_BOX.vertices[vi] ?? 0;
        const vy = (UNIT_BOX.vertices[vi + 1] ?? 0) * hw;
        const vz = (UNIT_BOX.vertices[vi + 2] ?? 0) * hw;
        // Roll about local X: rotate the (y, z) section coordinates.
        const ry = vy * cosR - vz * sinR;
        const rz = vy * sinR + vz * cosR;
        positions.push(
          ax + exx * vx * length + yx * ry + znX * rz,
          ay + exy * vx * length + yy * ry + znY * rz,
          az + exz * vx * length + yz * ry + znZ * rz,
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
      for (const [py0, pz0] of ringCoords) {
        // Roll about local X (section outline in the Y-Z plane).
        const py = py0 * cosR - pz0 * sinR;
        const pz = py0 * sinR + pz0 * cosR;
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
  /** M10.3: dimmed (buckled) tension-only / compression-only members. */
  inactiveBeamIds?: Set<number>;
  displacements?: number[] | Float64Array;
  deformScale?: number;
  wireframe: boolean;
  selectedBeamId: number | null;
  onPick: (beamId: number | null) => void;
  /** Catalog dims by section designation (bug 2 true extrusion). */
  sectionDims?: Map<string, ProfileDims>;
  /** Table-hover highlight (v1.3.0 Step 1, `#93C5FD`). */
  hoveredBeamId?: number | null;
  /**
   * v1.6.0: shared BVH-indexed geometry from the persistent stage — when
   * provided it is rendered as-is (the stage owns its lifecycle), and the
   * duplicate local build is skipped so ONE BufferGeometry serves both
   * rendering and picking.
   */
  geometry?: THREE.BufferGeometry;
  /**
   * v2.4.0: two-step deletion mode — when true, hovering a member tints it
   * critical red and clicking it removes it (chained deletes stay armed).
   */
  deleteMode?: boolean;
  /** v2.4.0: member removal callback fired on click while `deleteMode`. */
  onDelete?: (beamId: number) => void;
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
  hoveredBeamId = null,
  geometry: sharedGeometry,
  deleteMode = false,
  onDelete,
  inactiveBeamIds,
}: BeamMeshesProps) {
  // v2.4.0: family colours apply only outside the FEA thermal view (no
  // colorRatios) — the spectrum stays reserved for Step 4 results.
  const familyColors = useMemo(() => {
    if (colorRatios !== undefined && colorRatios.size > 0) {
      return undefined;
    }
    const out = new Map<number, [number, number, number]>();
    for (const beam of beams) {
      out.set(beam.id, hexToRgb(familyColorOf(beam.section_id)));
    }
    return out;
  }, [beams, colorRatios]);
  // v2.4.0: local hover state drives the critical-red deletion preview.
  const [deleteHoverId, setDeleteHoverId] = useState<number | null>(null);
  const geometry = useMemo(
    () =>
      sharedGeometry ??
      buildBeamGeometry(nodes, beams, {
        colorRatios,
        displacements,
        deformScale,
        profiles: sectionDims === undefined ? undefined : beamProfileLookup(beams, sectionDims),
        beamColors: familyColors,
        inactiveBeamIds,
      }),
    [
      sharedGeometry,
      nodes,
      beams,
      colorRatios,
      displacements,
      deformScale,
      sectionDims,
      familyColors,
      inactiveBeamIds,
    ],
  );
  // v1.6.0 GPU-hygiene: internally-built geometries are disposed when
  // replaced; the shared stage geometry belongs to PersistentStage.
  useEffect(() => {
    if (sharedGeometry !== undefined) {
      return undefined;
    }
    return () => {
      geometry.dispose();
    };
  }, [geometry, sharedGeometry]);
  const selectedGeometry = useMemo(() => {
    if (selectedBeamId === null) {
      return null;
    }
    const beam = beams.find((b) => b.id === selectedBeamId);
    if (beam === undefined) {
      return null;
    }
    // v1.5.0 defect: the selection rim extrudes the member's TRUE catalog
    // profile (IPE 300 highlights its I-section) — the 0.12 m square box
    // remains only the fallback when dims are absent.
    const dims = sectionDims?.get(beam.section_id);
    const profiles =
      dims === undefined ? undefined : new Map<number, ProfileDims>([[beam.id, dims]]);
    return buildBeamGeometry(nodes, [beam], { displacements, deformScale, width: 0.12, profiles });
  }, [nodes, beams, selectedBeamId, displacements, deformScale, sectionDims]);
  // v1.6.0 GPU-hygiene: the rim geometry is disposed when selection moves.
  useEffect(() => {
    if (selectedGeometry === null) {
      return undefined;
    }
    return () => {
      selectedGeometry.dispose();
    };
  }, [selectedGeometry]);

  // Table -> viewport hover highlight (v1.3.0, `#93C5FD` edge tint).
  const hoveredGeometry = useMemo(() => {
    if (hoveredBeamId === null || hoveredBeamId === selectedBeamId) {
      return null;
    }
    const beam = beams.find((b) => b.id === hoveredBeamId);
    if (beam === undefined) {
      return null;
    }
    const dims = sectionDims?.get(beam.section_id);
    const profiles =
      dims === undefined ? undefined : new Map<number, ProfileDims>([[beam.id, dims]]);
    return buildBeamGeometry(nodes, [beam], { displacements, deformScale, profiles });
  }, [nodes, beams, hoveredBeamId, selectedBeamId, displacements, deformScale, sectionDims]);
  // v1.6.0 GPU-hygiene: the hover rim geometry is disposed on unhover.
  useEffect(() => {
    if (hoveredGeometry === null) {
      return undefined;
    }
    return () => {
      hoveredGeometry.dispose();
    };
  }, [hoveredGeometry]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const id = geometry.getAttribute("beamId");
    const face = event.face;
    if (face == null || id === undefined) {
      if (deleteMode) {
        setDeleteHoverId(null);
      } else {
        onPick(null);
      }
      return;
    }
    const beamId = id.getX(face.a);
    if (deleteMode) {
      setDeleteHoverId(null);
      onDelete?.(beamId);
      return;
    }
    onPick(beamId);
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!deleteMode) {
      return;
    }
    const id = geometry.getAttribute("beamId");
    const face = event.face;
    if (face == null || id === undefined) {
      setDeleteHoverId(null);
      return;
    }
    setDeleteHoverId(id.getX(face.a));
  };

  // v2.4.0: critical-red preview of the member under the cursor while the
  // deletion mode is armed (separate from the table-hover blue rim).
  const deletePreview = useMemo(() => {
    if (!deleteMode || deleteHoverId === null) {
      return null;
    }
    const beam = beams.find((b) => b.id === deleteHoverId);
    if (beam === undefined) {
      return null;
    }
    const dims = sectionDims?.get(beam.section_id);
    const profiles =
      dims === undefined ? undefined : new Map<number, ProfileDims>([[beam.id, dims]]);
    return buildBeamGeometry(nodes, [beam], { displacements, deformScale, profiles });
  }, [deleteMode, deleteHoverId, beams, nodes, displacements, deformScale, sectionDims]);
  useEffect(() => {
    if (deletePreview === null) {
      return undefined;
    }
    return () => {
      deletePreview.dispose();
    };
  }, [deletePreview]);

  return (
    <>
      {wireframe ? (
        <lineSegments>
          <edgesGeometry args={[geometry, 25]} />
          <lineBasicMaterial color="#94A3B8" />
        </lineSegments>
      ) : (
        <mesh
          geometry={geometry}
          onClick={handleClick}
          onPointerMove={handlePointerMove}
          onPointerOut={() => {
            if (deleteMode) {
              setDeleteHoverId(null);
            }
          }}
        >
          <meshStandardMaterial vertexColors flatShading side={THREE.DoubleSide} />
        </mesh>
      )}
      {deletePreview !== null ? (
        <mesh geometry={deletePreview}>
          <meshStandardMaterial
            color="#DC2626"
            emissive="#DC2626"
            emissiveIntensity={0.4}
            flatShading
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
      {selectedGeometry !== null ? (
        <>
          {/* v1.4.0: cobalt tint body + cobalt edge wireframe. */}
          <mesh geometry={selectedGeometry}>
            <meshStandardMaterial
              color="#2563EB"
              emissive="#2563EB"
              emissiveIntensity={0.35}
              flatShading
              side={THREE.DoubleSide}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[selectedGeometry, 25]} />
            <lineBasicMaterial color="#1D4ED8" />
          </lineSegments>
        </>
      ) : null}
      {hoveredGeometry !== null ? (
        <lineSegments>
          <edgesGeometry args={[hoveredGeometry, 25]} />
          <lineBasicMaterial color="#93C5FD" />
        </lineSegments>
      ) : null}
    </>
  );
}

/**
 * M10.3 (RDM 7 _tirants_): slender tension-rod turnbuckles — one thin
 * rod along the member axis plus a short wider barrel cylinder at
 * midspan, slate-graphite. Rendered next to `BeamMeshes` for every
 * `TensionOnly` / `CompressionOnly` member.
 */
const TURNBUCKLE_ROD_GEO = new THREE.CylinderGeometry(0.012, 0.012, 1, 8, 1, true);
const TURNBUCKLE_BARREL_GEO = new THREE.CylinderGeometry(0.028, 0.028, 0.09, 10);
const TURNBUCKLE_MATERIAL = new THREE.MeshStandardMaterial({ color: "#334155" });

export function TurnbuckleMarkers({
  nodes,
  beams,
  displacements,
  deformScale = 1,
}: {
  nodes: NodeData[];
  beams: BeamData[];
  displacements?: number[] | Float64Array;
  deformScale?: number;
}): React.ReactElement {
  const markers = useMemo(() => {
    const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]));
    const displaced = (nodeId: number, axis: 0 | 1 | 2): number => {
      const index = nodeIndex.get(nodeId);
      if (index === undefined) {
        return axis === 0 ? 0 : axis === 1 ? 0 : 0;
      }
      const node = nodes[index];
      if (node === undefined) {
        return 0;
      }
      const base = axis === 0 ? node.x : axis === 1 ? node.y : node.z;
      if (displacements === undefined) {
        return base;
      }
      const raw = displacements[index * 6 + axis] ?? 0;
      return base + (Number.isFinite(raw) ? raw * deformScale : 0);
    };
    const out: {
      key: number;
      position: [number, number, number];
      length: number;
      quaternion: [number, number, number, number];
    }[] = [];
    for (const beam of beams) {
      if (beam.behavior !== "TensionOnly" && beam.behavior !== "CompressionOnly") {
        continue;
      }
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
      const dir = new THREE.Vector3(dx / length, dy / length, dz / length);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      out.push({
        key: beam.id,
        position: [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2],
        length,
        quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
      });
    }
    return out;
  }, [nodes, beams, displacements, deformScale]);
  return (
    <>
      {markers.map((marker) => (
        <group
          key={marker.key}
          data-testid={`turnbuckle-${marker.key}`}
          position={marker.position}
          quaternion={marker.quaternion}
        >
          <mesh
            geometry={TURNBUCKLE_ROD_GEO}
            material={TURNBUCKLE_MATERIAL}
            scale={[1, marker.length, 1]}
          />
          <mesh
            geometry={TURNBUCKLE_BARREL_GEO}
            material={TURNBUCKLE_MATERIAL}
            position={[0, 0, 0]}
          />
        </group>
      ))}
    </>
  );
}
