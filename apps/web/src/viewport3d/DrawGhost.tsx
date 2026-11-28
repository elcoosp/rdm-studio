import { useMemo } from "react";
import { Html, Line } from "@react-three/drei";
import { useProjectStore } from "@/state/projectStore";
import { useViewportStore } from "@/state/viewportStore";

/**
 * M9.4 — CAD Ghost Preview (Swiss Metrology Step 1): while the beam tool
 * draws after the start node is armed, renders the dashed Deep Cobalt
 * (`#1D4ED8`) preview segment to the snapped cursor, the axis-alignment
 * guide line (X / Y / Z lock indicator) and a floating JetBrains Mono HUD
 * pill with the live length ΔL (m) and plan angle α (°).
 *
 * State comes from `useViewportStore.drawGhost` — written by the beam
 * tool (`PersistentStage.ModelTools`) on every snapped pointer move.
 */

const ACCENT = "#1D4ED8";
const GUIDE = "#64748B";
/** Axis-lock tolerance (m): the cursor counts as aligned below this. */
const AXIS_TOL = 0.01;

export function DrawGhost(): React.ReactElement | null {
  const toolMode = useViewportStore((s) => s.toolMode);
  const ghost = useViewportStore((s) => s.drawGhost);
  const nodes = useProjectStore((s) => s.project.structure.nodes);

  const start = useMemo(
    () => (ghost === null ? null : (nodes.find((n) => n.id === ghost.startNodeId) ?? null)),
    [ghost, nodes],
  );

  if (toolMode !== "beam" || ghost === null || start === null) {
    return null;
  }
  const { cursor } = ghost;
  const dx = cursor.x - start.x;
  const dy = cursor.y - start.y;
  const dz = cursor.z - start.z;
  const length = Math.hypot(dx, dy, dz);
  const angleDeg = ((Math.atan2(dz, dx) * 180) / Math.PI + 360) % 360;
  const mid = {
    x: (start.x + cursor.x) / 2,
    y: (start.y + cursor.y) / 2,
    z: (start.z + cursor.z) / 2,
  };

  // Axis lock: the cursor is (nearly) on the start node's axis line — the
  // ghost stretches a full-length guide along that global axis direction.
  const lockX = Math.abs(dy) < AXIS_TOL && Math.abs(dz) < AXIS_TOL && length > AXIS_TOL;
  const lockY = Math.abs(dx) < AXIS_TOL && Math.abs(dz) < AXIS_TOL && length > AXIS_TOL;
  const lockZ = Math.abs(dx) < AXIS_TOL && Math.abs(dy) < AXIS_TOL && length > AXIS_TOL;
  const guideSpan = 50;
  const guide: [number, number, number][] | null = lockX
    ? [
        [start.x - guideSpan / 2, start.y, start.z],
        [start.x + guideSpan / 2, start.y, start.z],
      ]
    : lockY
      ? [
          [start.x, start.y - guideSpan / 2, start.z],
          [start.x, start.y + guideSpan / 2, start.z],
        ]
      : lockZ
        ? [
            [start.x, start.y, Math.max(0, start.z - guideSpan / 2)],
            [start.x, start.y, start.z + guideSpan / 2],
          ]
        : null;

  return (
    <group data-testid="draw-ghost">
      <Line
        points={[
          [start.x, start.y, start.z],
          [cursor.x, cursor.y, cursor.z],
        ]}
        color={ACCENT}
        lineWidth={2}
        dashed
        dashSize={0.25}
        gapSize={0.15}
      />
      {guide !== null ? (
        <Line points={guide} color={GUIDE} lineWidth={1} dashed dashSize={0.4} gapSize={0.3} />
      ) : null}
      {/* Floating monospace metrology HUD pill (JetBrains Mono, fr-FR). */}
      <Html position={[mid.x, mid.y, mid.z]} center zIndexRange={[20, 0]}>
        <div
          data-testid="draw-ghost-hud"
          className="font-data pointer-events-none flex items-center gap-2 whitespace-nowrap rounded-[4px] border border-accent-ring bg-panel/95 px-2 py-1 text-[11px] text-ink-primary shadow-[0_4px_12px_rgba(15,23,42,0.10)] [font-variant-numeric:tabular-nums]"
        >
          {ghost.axisLock !== null ? (
            <span
              data-testid="draw-ghost-axis"
              className="rounded-[2px] bg-accent-tint px-1 font-semibold text-accent"
            >
              {ghost.axisLock}
            </span>
          ) : null}
          <span>
            ΔL{" "}
            {length.toLocaleString("fr-FR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            m
          </span>
          <span className="text-ink-muted">
            α {angleDeg.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}°
          </span>
        </div>
      </Html>
    </group>
  );
}
