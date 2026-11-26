import { Html } from "@react-three/drei";
import { useMemo } from "react";
import { useViewportParams } from "@/hooks/useStudioQuery";
import { useLastReport } from "@/wasmBridge/workerClient";
import { useProjectStore } from "@/state/projectStore";
import type { BeamData, NodeData } from "@/state/projectStore";

/**
 * Interactive 3D metrology annotations (v1.6.0, requirement 3): crisp
 * `JetBrains Mono` screen-space badges projected onto the persistent 3D
 * stage, toggled from `LayerToolbar`:
 *
 * - `Repères N/P` — node ids (`N1..Nn`) at every node and member tags
 *   (`P1 · IPE 200`) at every member midpoint;
 * - `Réactions` — live support reaction callouts (`Rz = +12,4 kN`) on
 *   Steps 2–4 from the last solved report, and peak SLS deflection
 *   callouts (`−3,2 mm`) at member midpoints on Step 4.
 *
 * French decimal comma per DESIGN.md §3 (tabular numerals in the DOM
 * layer via `font-variant-numeric`).
 */

const fr = (value: number, digits = 1): string =>
  value.toFixed(digits).replace("-", "\u2212").replace(".", ",");

/** `+12,4 kN` / `−3,2 mm` signed French formatting. */
function signedFr(value: number, digits = 1): string {
  const sign = value >= 0 ? "+" : "\u2212";
  return `${sign}${Math.abs(value).toFixed(digits).replace(".", ",")}`;
}

function Badge({
  position,
  kind,
  children,
  testId,
}: {
  position: [number, number, number];
  kind: "node" | "beam" | "reaction" | "deflection";
  children: React.ReactNode;
  testId?: string;
}) {
  const tone: Record<typeof kind, string> = {
    node: "bg-panel/90 text-ink-secondary border-hairline",
    beam: "bg-accent-tint/95 text-accent border-accent-ring",
    reaction: "bg-panel/95 text-ink-primary border-accent",
    deflection: "bg-panel/95 text-fea-max border-fea-max/50",
  };
  return (
    <Html
      position={position}
      center
      zIndexRange={[30, 20]}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <span
        className={`font-data inline-block whitespace-nowrap rounded-[2px] border px-1.5 py-0.5 text-[10px] leading-none [font-variant-numeric:tabular-nums] ${tone[kind]}`}
        style={{ boxShadow: "0 1px 4px rgba(15, 23, 42, 0.10)" }}
        data-testid={testId}
      >
        {children}
      </span>
    </Html>
  );
}

export function ViewportLabels({
  nodes,
  beams,
  pathname,
}: {
  nodes: NodeData[];
  beams: BeamData[];
  pathname: string;
}) {
  // v2.1.0: label / reaction layers are URL-backed (`?layers=`).
  const { layers } = useViewportParams();
  const labelsOn = layers.labels;
  const reactionsOn = layers.reactions;
  const report = useLastReport();
  const supports = useProjectStore((s) => s.project.structure.supports);

  const beamTagById = useMemo(() => {
    const map = new Map<number, string>();
    for (const beam of beams) {
      map.set(beam.id, `P${beam.id} · ${beam.section_id}`);
    }
    return map;
  }, [beams]);

  // Live ULS support reactions: superpose the exact EN 1990 multipliers
  // over every elementary case, indexed by the node's 0-based position.
  const reactionsByNode = useMemo(() => {
    const map = new Map<number, number>();
    if (report === null || reactionsOn === false) {
      return map;
    }
    const uls = report.combinations.find((c) => c.kind === "ULS");
    if (uls === undefined) {
      return map;
    }
    const byCode = new Map(report.cases.map((c) => [c.code, c.reactions as number[] | undefined]));
    for (const support of supports) {
      const index = nodes.findIndex((n) => n.id === support.node_id);
      if (index < 0) {
        continue;
      }
      let rz = 0;
      for (const [code, factor] of uls.multipliers) {
        const reactions = byCode.get(code);
        if (reactions === undefined) {
          continue;
        }
        rz += factor * (reactions[index * 6 + 2] ?? 0);
      }
      map.set(support.node_id, rz / 1000);
    }
    return map;
  }, [report, reactionsOn, supports, nodes]);

  // Peak SLS deflection callouts (Step 4 only): per-member midspan value.
  const deflectionByBeam = useMemo(() => {
    const map = new Map<number, number>();
    if (pathname !== "/results" || reactionsOn === false) {
      return map;
    }
    const sls = report?.combinations.find((c) => c.kind === "SLS");
    for (const beam of sls?.beams ?? []) {
      map.set(beam.beam_id, beam.midspan_deflection * 1000);
    }
    return map;
  }, [report, pathname, reactionsOn]);

  if (nodes.length === 0) {
    return null;
  }

  return (
    <group data-testid="viewport-labels">
      {labelsOn
        ? nodes.map((n) => (
            <Badge
              key={`n${n.id}`}
              position={[n.x, n.y, n.z]}
              kind="node"
              testId={`label-node-${n.id}`}
            >
              N{n.id}
            </Badge>
          ))
        : null}
      {labelsOn
        ? beams.map((b) => {
            const n1 = nodes.find((n) => n.id === b.n1);
            const n2 = nodes.find((n) => n.id === b.n2);
            if (n1 === undefined || n2 === undefined) {
              return null;
            }
            const mid: [number, number, number] = [
              (n1.x + n2.x) / 2,
              (n1.y + n2.y) / 2,
              (n1.z + n2.z) / 2,
            ];
            return (
              <Badge key={`p${b.id}`} position={mid} kind="beam" testId={`label-beam-${b.id}`}>
                {beamTagById.get(b.id) ?? `P${b.id}`}
              </Badge>
            );
          })
        : null}
      {reactionsOn && pathname !== "/report"
        ? [...reactionsByNode.entries()].map(([nodeId, rz]) => {
            const node = nodes.find((n) => n.id === nodeId);
            if (node === undefined) {
              return null;
            }
            return (
              <Badge
                key={`r${nodeId}`}
                position={[node.x, node.y, node.z - 0.18]}
                kind="reaction"
                testId={`reaction-${nodeId}`}
              >
                {`Rz = ${signedFr(rz)} kN`}
              </Badge>
            );
          })
        : null}
      {reactionsOn && pathname === "/results"
        ? beams.map((b) => {
            const defl = deflectionByBeam.get(b.id);
            if (defl === undefined) {
              return null;
            }
            const n1 = nodes.find((n) => n.id === b.n1);
            const n2 = nodes.find((n) => n.id === b.n2);
            if (n1 === undefined || n2 === undefined) {
              return null;
            }
            const mid: [number, number, number] = [
              (n1.x + n2.x) / 2,
              (n1.y + n2.y) / 2,
              (n1.z + n2.z) / 2 - 0.34,
            ];
            return (
              <Badge
                key={`d${b.id}`}
                position={mid}
                kind="deflection"
                testId={`deflection-${b.id}`}
              >
                {`δ = ${fr(defl)} mm`}
              </Badge>
            );
          })
        : null}
    </group>
  );
}
