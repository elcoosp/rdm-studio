import { useEffect, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { NodeData } from "@/state/projectStore";
import type { ViewportRuntime } from "./SnapOverlay";
import { modelBounds } from "./ProfileShapes";

export interface TriadControlsLike {
  setLookAt(
    posX: number,
    posY: number,
    posZ: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    transition: boolean,
  ): Promise<boolean>;
}

interface AxisSpec {
  id: string;
  label: string;
  vec: THREE.Vector3;
  color: string;
  positive: boolean;
}

const AXES: readonly AxisSpec[] = [
  { id: "px", label: "X", vec: new THREE.Vector3(1, 0, 0), color: "#DC2626", positive: true },
  { id: "py", label: "Y", vec: new THREE.Vector3(0, 1, 0), color: "#10B981", positive: true },
  { id: "pz", label: "Z", vec: new THREE.Vector3(0, 0, 1), color: "#1D4ED8", positive: true },
  { id: "nx", label: "−X", vec: new THREE.Vector3(-1, 0, 0), color: "#DC2626", positive: false },
  { id: "ny", label: "−Y", vec: new THREE.Vector3(0, -1, 0), color: "#10B981", positive: false },
  { id: "nz", label: "−Z", vec: new THREE.Vector3(0, 0, -1), color: "#1D4ED8", positive: false },
];

const DIAL_SIZE = 84;
const CENTER = DIAL_SIZE / 2;
const RADIUS = 27;

export interface TriadDomHandles {
  groups: Record<string, SVGGElement | null>;
  lines: Record<string, SVGLineElement | null>;
  circles: Record<string, SVGCircleElement | null>;
  texts: Record<string, SVGTextElement | null>;
}

/**
 * R3F inner bridge that projects the 6 world axes into screen-space at 60 fps
 * without triggering React re-renders, updating the SVG triad directly via refs.
 */
export function TriadCameraSync({
  triadRef,
}: {
  triadRef: RefObject<TriadDomHandles | null>;
}): null {
  const camera = useThree((s) => s.camera);
  const invQuat = useRef(new THREE.Quaternion());
  const tmp = useRef(new THREE.Vector3());

  useFrame(() => {
    const handles = triadRef.current;
    if (handles === null) return;
    invQuat.current.copy(camera.quaternion).invert();

    const projected = AXES.map((axis) => {
      tmp.current.copy(axis.vec).applyQuaternion(invQuat.current);
      return {
        axis,
        sx: CENTER + tmp.current.x * RADIUS,
        sy: CENTER - tmp.current.y * RADIUS,
        depth: tmp.current.z,
      };
    });

    projected.sort((a, b) => a.depth - b.depth);

    for (const item of projected) {
      const g = handles.groups[item.axis.id];
      const line = handles.lines[item.axis.id];
      const circle = handles.circles[item.axis.id];
      const text = handles.texts[item.axis.id];
      if (!g || !circle) continue;

      if (g.parentNode !== null) {
        g.parentNode.appendChild(g);
      }

      if (line) {
        line.setAttribute("x2", item.sx.toFixed(2));
        line.setAttribute("y2", item.sy.toFixed(2));
        line.setAttribute("opacity", item.depth < -0.15 ? "0.35" : "0.95");
      }

      circle.setAttribute("cx", item.sx.toFixed(2));
      circle.setAttribute("cy", item.sy.toFixed(2));
      const baseR = item.axis.positive ? 8.5 : 5;
      const scale = 1 + item.depth * 0.14;
      circle.setAttribute("r", (baseR * scale).toFixed(2));
      circle.setAttribute("opacity", item.depth < -0.2 ? "0.45" : "1");

      if (text) {
        text.setAttribute("x", item.sx.toFixed(2));
        text.setAttribute("y", (item.sy + 3.1).toFixed(2));
        text.setAttribute("opacity", item.depth < -0.25 ? "0.45" : "1");
      }
    }
  });

  return null;
}

/**
 * Interactive Swiss Metrology 3D XYZ orientation dial (bottom-right of the
 * 3D viewport). Click any of the 6 poles (+X, -X, +Y, -Y, +Z, -Z) to glide
 * smoothly to that elevation, or click the center hub for 3D Isometric.
 */
export function OrientationTriad3D({
  nodes,
  controlsRef,
  runtimeRef,
  triadRef,
}: {
  nodes: NodeData[];
  controlsRef: RefObject<TriadControlsLike | null>;
  runtimeRef: RefObject<ViewportRuntime | null>;
  triadRef: RefObject<TriadDomHandles | null>;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const handlesRef = useRef<TriadDomHandles>({
    groups: {},
    lines: {},
    circles: {},
    texts: {},
  });

  useEffect(() => {
    triadRef.current = handlesRef.current;
    return () => {
      triadRef.current = null;
    };
  }, [triadRef]);

  const snapToAxis = (dir: THREE.Vector3): void => {
    const controls = controlsRef.current;
    if (controls === null) return;
    const { center, radius } = modelBounds(nodes);
    const [cx, cy, cz] = center;
    const centerVec = new THREE.Vector3(cx, cy, cz);
    const cam = runtimeRef.current?.camera;
    const dist =
      cam !== undefined
        ? Math.max(cam.position.distanceTo(centerVec), radius * 2.2, 4)
        : Math.max(radius * 2.4, 8);

    const eps = dir.x === 0 && dir.y === 0 ? 1e-3 : 0;
    const px = cx + dir.x * dist;
    const py = cy + dir.y * dist - eps * dist;
    const pz = cz + dir.z * dist;
    void controls.setLookAt(px, py, pz, cx, cy, cz, true);
  };

  const snapToIso = (): void => {
    const controls = controlsRef.current;
    if (controls === null) return;
    const { center, radius } = modelBounds(nodes);
    const [cx, cy, cz] = center;
    const dist = Math.max(radius * 1.65, 6);
    void controls.setLookAt(cx + dist, cy - dist, cz + dist * 0.85, cx, cy, cz, true);
  };

  const ticks = Array.from({ length: 12 }, (_, idx) => {
    const angle = (idx * Math.PI) / 6;
    const major = idx % 3 === 0;
    const r1 = major ? 35.5 : 37;
    const r2 = 39.5;
    return {
      idx,
      x1: CENTER + Math.cos(angle) * r1,
      y1: CENTER + Math.sin(angle) * r1,
      x2: CENTER + Math.cos(angle) * r2,
      y2: CENTER + Math.sin(angle) * r2,
      major,
    };
  });

  const hoveredAxis = AXES.find((a) => a.id === hoveredId);

  return (
    <div
      className="pointer-events-auto absolute right-3.5 bottom-12 z-20 flex flex-col items-center select-none"
      data-testid="orientation-triad-3d"
    >
      <div className="relative rounded-full border border-hairline bg-panel/92 shadow-md backdrop-blur transition-shadow hover:shadow-lg">
        <svg
          width={DIAL_SIZE}
          height={DIAL_SIZE}
          viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
          className="block overflow-visible"
          role="group"
          aria-label="Cadran d'orientation 3D XYZ"
        >
          <circle
            cx={CENTER}
            cy={CENTER}
            r={39.5}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={0.75}
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={27}
            fill="none"
            stroke="#CBD5E1"
            strokeWidth={0.65}
            strokeDasharray="2 2.5"
          />
          {ticks.map((t) => (
            <line
              key={t.idx}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.major ? "#94A3B8" : "#CBD5E1"}
              strokeWidth={t.major ? 1.1 : 0.75}
              strokeLinecap="round"
            />
          ))}

          {AXES.map((axis) => {
            const isHovered = hoveredId === axis.id;
            return (
              <g
                key={axis.id}
                ref={(el) => {
                  handlesRef.current.groups[axis.id] = el;
                }}
                className="cursor-pointer"
                onPointerEnter={() => setHoveredId(axis.id)}
                onPointerLeave={() => setHoveredId(null)}
                onClick={() => snapToAxis(axis.vec)}
              >
                {axis.positive ? (
                  <line
                    ref={(el) => {
                      handlesRef.current.lines[axis.id] = el;
                    }}
                    x1={CENTER}
                    y1={CENTER}
                    x2={CENTER}
                    y2={CENTER}
                    stroke={axis.color}
                    strokeWidth={isHovered ? 2.6 : 2}
                    strokeLinecap="round"
                  />
                ) : null}
                <circle
                  ref={(el) => {
                    handlesRef.current.circles[axis.id] = el;
                  }}
                  cx={CENTER}
                  cy={CENTER}
                  r={axis.positive ? 8.5 : 5}
                  fill={axis.positive ? axis.color : "#FFFFFF"}
                  stroke={axis.positive ? "#FFFFFF" : axis.color}
                  strokeWidth={isHovered ? 2 : 1.35}
                />
                {axis.positive || isHovered ? (
                  <text
                    ref={(el) => {
                      handlesRef.current.texts[axis.id] = el;
                    }}
                    x={CENTER}
                    y={CENTER}
                    textAnchor="middle"
                    fill={axis.positive ? "#FFFFFF" : axis.color}
                    fontSize={axis.positive ? 8.5 : 7}
                    fontWeight={700}
                    className="font-data pointer-events-none"
                  >
                    {axis.label}
                  </text>
                ) : null}
              </g>
            );
          })}

          <g
            className="cursor-pointer"
            onPointerEnter={() => setHoveredId("iso")}
            onPointerLeave={() => setHoveredId(null)}
            onClick={snapToIso}
          >
            <circle
              cx={CENTER}
              cy={CENTER}
              r={hoveredId === "iso" ? 4.5 : 3.2}
              fill={hoveredId === "iso" ? "#1D4ED8" : "#0F172A"}
              stroke="#FFFFFF"
              strokeWidth={1.2}
            />
          </g>
        </svg>
      </div>
      {hoveredId !== null ? (
        <p className="font-data mt-1 rounded border border-hairline bg-panel/95 px-1.5 py-0.5 text-[10px] font-medium text-ink-primary shadow-xs">
          {hoveredId === "iso" ? "Vue 3D Iso" : `Axe ${hoveredAxis?.label ?? ""}`}
        </p>
      ) : null}
    </div>
  );
}
