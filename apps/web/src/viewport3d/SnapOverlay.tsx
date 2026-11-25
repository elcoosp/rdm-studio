import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import type { BeamData, NodeData } from "@/state/projectStore";

/**
 * 3D snap reticle & hover cursor pill (DESIGN.md §8.3/§8.4): a DOM overlay
 * sibling of the Canvas that projects node / beam-midpoint positions to
 * screen space on pointer move and renders the nearest snap glyph — Cobalt
 * ring on nodes, Cyan triangle on midpoints, dashed orthogonal axis guides
 * on Shift — plus a floating `B-14 · IPE 200 · L = 4,00 m` cursor pill and
 * an 8 ms haptic tick on touch devices. The camera/canvas runtime arrives
 * through `runtimeRef` (populated by `<RuntimeBridge/>` inside the Canvas).
 */
export interface ViewportRuntime {
  camera: THREE.Camera;
  dom: HTMLCanvasElement;
  width: number;
  height: number;
}

type Snap =
  | { kind: "node"; x: number; y: number; label: string }
  | { kind: "midpoint"; x: number; y: number; label: string };

interface HoverInfo {
  snap: Snap | null;
  beamHover: { x: number; y: number; label: string } | null;
  shift: boolean;
}

const SNAP_RADIUS_PX = 22;
const PILL_RADIUS_PX = 14;

export function SnapOverlay({
  nodes,
  beams,
  runtimeRef,
  runtimeReady,
}: {
  nodes: NodeData[];
  beams: BeamData[];
  runtimeRef: RefObject<ViewportRuntime | null>;
  /** Increments on every WebGL init/resize (listener re-attachment). */
  runtimeReady: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverInfo>({ snap: null, beamHover: null, shift: false });
  const [ready, setReady] = useState(0);
  const hapticRef = useRef<string>("");

  // Re-attach when the runtime (camera/canvas) becomes available — the
  // parent bumps `runtimeReady` on every WebGL (re)init and on resize,
  // so pointer listeners always bind to a live canvas (v1.4.0 fix).
  useEffect(() => {
    if (runtimeRef.current !== null) {
      setReady((n) => n + 1);
    }
  }, [runtimeReady, runtimeRef]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime === null || nodes.length === 0) {
      return;
    }
    const dom = runtime.dom;
    const camera = runtime.camera;
    const world = new THREE.Vector3();
    const project = (x: number, y: number, z: number): [number, number] => {
      world.set(x, y, z).project(camera);
      return [((world.x + 1) / 2) * runtime.width, ((1 - world.y) / 2) * runtime.height];
    };
    const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]));

    const onPointerMove = (event: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;

      let best: Snap | null = null;
      let bestDist = SNAP_RADIUS_PX;
      for (const n of nodes) {
        const [sx, sy] = project(n.x, n.y, n.z);
        const d = Math.hypot(sx - px, sy - py);
        if (d < bestDist) {
          bestDist = d;
          best = { kind: "node", x: sx, y: sy, label: `N${n.id}` };
        }
      }
      for (const b of beams) {
        const n1 = nodes[nodeIndex.get(b.n1) ?? -1];
        const n2 = nodes[nodeIndex.get(b.n2) ?? -1];
        if (n1 === undefined || n2 === undefined) {
          continue;
        }
        const [sx, sy] = project((n1.x + n2.x) / 2, (n1.y + n2.y) / 2, (n1.z + n2.z) / 2);
        const d = Math.hypot(sx - px, sy - py);
        if (d < bestDist) {
          bestDist = d;
          const length = Math.hypot(n2.x - n1.x, n2.y - n1.y, n2.z - n1.z);
          best = {
            kind: "midpoint",
            x: sx,
            y: sy,
            label: `B-${b.id} · ${b.section_id} · L = ${length.toFixed(2).replace(".", ",")} m`,
          };
        }
      }

      let beamHover: HoverInfo["beamHover"] = null;
      let beamDist = PILL_RADIUS_PX;
      for (const b of beams) {
        const n1 = nodes[nodeIndex.get(b.n1) ?? -1];
        const n2 = nodes[nodeIndex.get(b.n2) ?? -1];
        if (n1 === undefined || n2 === undefined) {
          continue;
        }
        const [ax, ay] = project(n1.x, n1.y, n1.z);
        const [bx, by] = project(n2.x, n2.y, n2.z);
        const vx = bx - ax;
        const vy = by - ay;
        const len2 = vx * vx + vy * vy;
        const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2)) : 0;
        const d = Math.hypot(ax + t * vx - px, ay + t * vy - py);
        if (d < beamDist) {
          beamDist = d;
          const length = Math.hypot(n2.x - n1.x, n2.y - n1.y, n2.z - n1.z);
          beamHover = {
            x: ax + t * vx,
            y: ay + t * vy,
            label: `B-${b.id} · ${b.section_id} · L = ${length.toFixed(2).replace(".", ",")} m`,
          };
        }
      }

      const key = best === null ? "" : snapKey(best);
      if (key !== "" && hapticRef.current !== key) {
        navigator.vibrate?.(8);
        hapticRef.current = key;
      } else if (key === "") {
        hapticRef.current = "";
      }

      setHover({ snap: best, beamHover, shift: event.shiftKey });
    };
    const onPointerLeave = () => setHover({ snap: null, beamHover: null, shift: false });
    const onKey = (e: KeyboardEvent) => setHover((h) => ({ ...h, shift: e.shiftKey }));

    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [runtimeRef, nodes, beams, ready]);

  if (nodes.length === 0) {
    return null;
  }
  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {hover.shift && hover.snap !== null ? (
        <>
          <div
            className="absolute h-px w-full"
            style={{
              left: 0,
              top: hover.snap.y,
              backgroundImage:
                "repeating-linear-gradient(to right, #64748B 0 6px, transparent 6px 10px)",
            }}
          />
          <div
            className="absolute h-full w-px"
            style={{
              top: 0,
              left: hover.snap.x,
              backgroundImage:
                "repeating-linear-gradient(to bottom, #64748B 0 6px, transparent 6px 10px)",
            }}
          />
        </>
      ) : null}
      {hover.snap?.kind === "node" ? (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: hover.snap.x, top: hover.snap.y }}
          data-testid="snap-reticle"
        >
          <div className="h-5 w-5 rounded-full border-2 border-accent" />
          <span className="absolute top-6 left-1/2 -translate-x-1/2 font-mono text-[10px] text-accent">
            {hover.snap.label}
          </span>
        </div>
      ) : null}
      {hover.snap?.kind === "midpoint" ? (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: hover.snap.x, top: hover.snap.y }}
          data-testid="snap-reticle"
        >
          <svg viewBox="0 0 20 18" className="h-4 w-4" aria-hidden>
            <polygon points="10,1 19,17 1,17" fill="none" stroke="#06B6D4" strokeWidth="2" />
          </svg>
          <span className="absolute top-6 left-1/2 -translate-x-1/2 font-mono text-[10px] text-fea-low">
            {hover.snap.label}
          </span>
        </div>
      ) : null}
      {hover.beamHover !== null && hover.snap === null ? (
        <div
          className="absolute -translate-x-1/2 rounded-[4px] border border-accent-ring bg-panel px-2 py-1 font-mono text-[10px] text-ink-primary"
          style={{ left: hover.beamHover.x, top: hover.beamHover.y - 34 }}
          data-testid="cursor-pill"
        >
          {hover.beamHover.label}
        </div>
      ) : null}
    </div>
  );
}

function snapKey(snap: Snap): string {
  return `${snap.kind}:${Math.round(snap.x)}:${Math.round(snap.y)}`;
}
