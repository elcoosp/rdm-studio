import { Html, Line } from "@react-three/drei";
import { useMemo } from "react";
import { useViewportParams } from "@/hooks/useStudioQuery";
import type { BeamData, NodeData } from "@/state/projectStore";

/**
 * Metric dimension lines (v1.6.0, requirement 3): RDM-style cotation
 * along every member axis — offset extension ticks, a measured line and a
 * `JetBrains Mono` metric label (`4,00 m`) — toggled by the `Cotes`
 * switch in `LayerToolbar`. The line rides below the member in the
 * horizontal projection so truss webs stay readable.
 */

const ACCENT = "#1D4ED8";

const fr = (value: number, digits = 2): string => value.toFixed(digits).replace(".", ",");

function DimensionLine({
  a,
  b,
  length,
}: {
  a: [number, number, number];
  b: [number, number, number];
  length: number;
}) {
  const label: [number, number, number] = [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
    (a[2] + b[2]) / 2 - 0.09,
  ];
  return (
    <group>
      <Line points={[a, b]} color={ACCENT} lineWidth={1.25} dashed={false} />
      {/* Extension ticks perpendicular to the member axis. */}
      <Line
        points={[
          [a[0], a[1], a[2] - 0.035],
          [a[0], a[1], a[2] + 0.035],
        ]}
        color={ACCENT}
        lineWidth={1.25}
      />
      <Line
        points={[
          [b[0], b[1], b[2] - 0.035],
          [b[0], b[1], b[2] + 0.035],
        ]}
        color={ACCENT}
        lineWidth={1.25}
      />
      <Html
        position={label}
        center
        zIndexRange={[30, 20]}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <span
          className="font-data inline-block whitespace-nowrap rounded-[2px] border border-accent-ring bg-accent-tint/95 px-1.5 py-0.5 text-[10px] leading-none text-accent [font-variant-numeric:tabular-nums]"
          data-testid="dimension-label"
        >
          {`${fr(length)} m`}
        </span>
      </Html>
    </group>
  );
}

export function DimensionLines({
  nodes,
  beams,
  pathname,
}: {
  nodes: NodeData[];
  beams: BeamData[];
  pathname: string;
}) {
  // v2.1.0: the dimension-line layer is URL-backed (`?layers=`).
  const { layers } = useViewportParams();
  const dimsOn = layers.dims;
  const lines = useMemo(() => {
    if (dimsOn === false || pathname === "/report") {
      return [];
    }
    const out: {
      key: number;
      a: [number, number, number];
      b: [number, number, number];
      length: number;
    }[] = [];
    for (const beam of beams) {
      const n1 = nodes.find((n) => n.id === beam.n1);
      const n2 = nodes.find((n) => n.id === beam.n2);
      if (n1 === undefined || n2 === undefined) {
        continue;
      }
      const length = Math.hypot(n2.x - n1.x, n2.y - n1.y, n2.z - n1.z);
      if (length < 0.15) {
        continue;
      }
      // Offset the dimension line below the member (horizontal projection
      // of the member axis keeps diagonal truss webs legible).
      const offset = Math.max(0.08, Math.min(0.22, length * 0.06));
      out.push({
        key: beam.id,
        a: [n1.x, n1.y, n1.z - offset],
        b: [n2.x, n2.y, n2.z - offset],
        length,
      });
    }
    return out;
  }, [dimsOn, pathname, nodes, beams]);

  if (lines.length === 0) {
    return null;
  }
  return (
    <group data-testid="dimension-lines">
      {lines.map((line) => (
        <DimensionLine key={line.key} a={line.a} b={line.b} length={line.length} />
      ))}
    </group>
  );
}
