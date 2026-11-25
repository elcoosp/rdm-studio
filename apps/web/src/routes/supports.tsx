import { createFileRoute } from "@tanstack/react-router";
import { Trans } from "@lingui/react/macro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SupportFixed,
  SupportPinned,
  SupportRoller,
  SupportSlider,
  SupportSpring,
  SupportReaction,
} from "@/components/icons/EngineeringIcons";
import { ViewportCanvas } from "@/viewport3d/ViewportCanvas";
import { SupportMarkers } from "@/viewport3d/SupportMarkers";
import { useProjectStore } from "@/state/projectStore";

export const Route = createFileRoute("/supports")({
  component: SupportsPage,
});

const DOF_LABELS = ["Ux", "Uy", "Uz", "Rx", "Ry", "Rz"] as const;

/** RDM 7 preset support patterns (locked DOFs per the 6-equation rule). */
const PRESETS: {
  key: string;
  label: string;
  icon: typeof SupportFixed;
  locked: boolean[];
}[] = [
  {
    key: "encastrement",
    label: "Encastrement",
    icon: SupportFixed,
    locked: [true, true, true, true, true, true],
  },
  {
    key: "rotule",
    label: "Rotule",
    icon: SupportPinned,
    locked: [true, true, true, false, false, false],
  },
  {
    key: "appui-simple",
    label: "Appui simple",
    icon: SupportRoller,
    locked: [false, false, true, false, false, false],
  },
  {
    key: "glissiere",
    label: "Glissière",
    icon: SupportSlider,
    locked: [false, true, true, true, false, false],
  },
];

/** Kinematic degree: 6 reactions = isostatic, fewer = hypostatic, more = hyperstatic. */
function kinematicStatus(reactionCount: number): {
  label: string;
  variant: "pass" | "fail" | "warn";
} {
  if (reactionCount < 6) {
    return { label: "Hypostatique (mécanisme)", variant: "fail" };
  }
  if (reactionCount === 6) {
    return { label: "Isostatique", variant: "pass" };
  }
  return { label: `Hyperstatique degré ${reactionCount - 6}`, variant: "warn" };
}

/**
 * Step 2 (DESIGN.md §4, mockups tape_2): 320px left inspector with 1-click
 * RDM 7 presets, the 2×3 DOF matrix, the active supports list and the live
 * kinematic badge beside the interactive 3D viewport.
 */
function SupportsPage() {
  const nodes = useProjectStore((s) => s.project.structure.nodes);
  const beams = useProjectStore((s) => s.project.structure.beams);
  const supports = useProjectStore((s) => s.project.structure.supports);
  const setSupport = useProjectStore((s) => s.setSupport);
  const selectedNodeId = useProjectStore((s) => s.selection.nodeId);

  const lockedFor = (nodeId: number): boolean[] =>
    supports.find((s) => s.node_id === nodeId)?.locked_dofs ?? [
      false,
      false,
      false,
      false,
      false,
      false,
    ];

  const reactionCount = supports.reduce((sum, s) => sum + s.locked_dofs.filter(Boolean).length, 0);
  const status = kinematicStatus(reactionCount);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 lg:flex-row-reverse">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 rounded-panel border border-hairline bg-panel p-3">
        <div className="relative min-h-[320px] flex-1 overflow-hidden rounded border border-hairline">
          <ViewportCanvas
            nodes={nodes}
            beams={beams}
            pickLatency={undefined}
            testId="viewport-canvas"
          >
            <SupportMarkers nodes={nodes} supports={supports} />
          </ViewportCanvas>
        </div>
      </section>
      <aside className="flex w-full shrink-0 flex-col gap-3 overflow-auto rounded-panel border border-hairline bg-panel p-3 lg:w-80">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">
            <Trans>Liaisons (RDM 7)</Trans>
          </h2>
          <Badge variant={status.variant} data-testid="kinematic-status">
            {status.label}
          </Badge>
        </div>
        <div>
          <p className="mb-1 text-[12px] text-ink-secondary">
            <Trans>Presets d'appui</Trans>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset.key}
                variant="outline"
                size="sm"
                data-testid={`preset-${preset.key}`}
                className="justify-start"
                disabled={selectedNodeId === null}
                onClick={() => setSupport(selectedNodeId as number, preset.locked)}
              >
                <preset.icon size={16} />
                {preset.label}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="justify-start"
              disabled={selectedNodeId === null}
              onClick={() =>
                setSupport(selectedNodeId as number, [false, false, false, false, false, false])
              }
            >
              <SupportSpring size={16} />
              <Trans>Libre</Trans>
            </Button>
          </div>
        </div>
        <div>
          <h3 className="mb-1 text-[13px] font-semibold text-ink-secondary">
            <Trans>Matrice 6 DDL des appuis</Trans>
          </h3>
          <p className="mb-2 text-[12px] text-ink-muted">
            <Trans>
              Cochez les DDL bloqués par appui. Les rotations libres laissent la flexion passer
              (rotule).
            </Trans>
          </p>
          <div className="max-h-56 overflow-auto">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11px] text-ink-muted">
                <tr>
                  <th className="py-1">
                    <Trans>Nœud</Trans>
                  </th>
                  {DOF_LABELS.map((d) => (
                    <th key={d} className="font-data">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-data">
                {nodes.map((n) => {
                  const locked = lockedFor(n.id);
                  return (
                    <tr key={n.id} className="border-t border-hairline">
                      <td className="py-1.5">{n.id}</td>
                      {DOF_LABELS.map((d, i) => (
                        <td key={d}>
                          <input
                            type="checkbox"
                            aria-label={`dof ${d} node ${n.id}`}
                            checked={locked[i] ?? false}
                            onChange={(e) => {
                              const next = [...locked];
                              next[i] = e.currentTarget.checked;
                              setSupport(n.id, next);
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-ink-secondary">
            <SupportReaction size={14} />
            <Trans>Appuis actifs</Trans>
          </h3>
          {supports.length === 0 ? (
            <p className="text-[12px] text-ink-muted">
              <Trans>Aucun appui — sélectionnez un nœud puis choisissez un preset.</Trans>
            </p>
          ) : (
            <ul className="font-data space-y-0.5 text-[12px] text-ink-secondary">
              {supports.map((s) => (
                <li key={s.node_id}>
                  N{s.node_id} · {s.locked_dofs.filter(Boolean).length} DDL bloqués
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
