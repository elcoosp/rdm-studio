import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { toast } from "sonner";
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
import { NodeMarkers } from "@/viewport3d/NodeMarkers";
import { nodePositions } from "@/viewport3d/BeamMeshes";
import { useProjectStore } from "@/state/projectStore";

export const Route = createFileRoute("/supports")({
  component: SupportsPage,
});

const DOF_LABELS = ["Ux", "Uy", "Uz", "Rx", "Ry", "Rz"] as const;

type Preset = {
  key: string;
  label: string;
  locked: boolean[];
};

/**
 * RDM 7 library (v1.3.0 Step 2): the 4 primary quick cards plus the
 * grouped 12-preset selector (Appuis simples XY/XZ/YZ, Glissants X/Y/Z,
 * Glissières X/Y/Z, Pivots X/Y/Z) and a `Personnalisée` entry that hands
 * over to the 2×3 DOF matrix.
 */
const PRIMARY_PRESETS: (Preset & { icon: typeof SupportFixed })[] = [
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
    key: "appui-simple-z",
    label: "Appui simple Z",
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

const GROUPED_PRESETS: { group: string; presets: Preset[] }[] = [
  {
    group: "Appuis simples",
    presets: [
      { key: "simple-xy", label: "XY", locked: [true, true, false, false, false, false] },
      { key: "simple-xz", label: "XZ", locked: [true, false, true, false, false, false] },
      { key: "simple-yz", label: "YZ", locked: [false, true, true, false, false, false] },
    ],
  },
  {
    group: "Glissants",
    presets: [
      { key: "glissant-x", label: "X", locked: [true, false, false, false, false, false] },
      { key: "glissant-y", label: "Y", locked: [false, true, false, false, false, false] },
      { key: "glissant-z", label: "Z", locked: [false, false, true, false, false, false] },
    ],
  },
  {
    group: "Glissières",
    presets: [
      { key: "glissiere-x", label: "X", locked: [true, false, false, false, true, true] },
      { key: "glissiere-y", label: "Y", locked: [false, true, false, true, false, true] },
      { key: "glissiere-z", label: "Z", locked: [false, false, true, true, true, false] },
    ],
  },
  {
    group: "Pivots",
    presets: [
      { key: "pivot-x", label: "X", locked: [false, false, false, true, false, false] },
      { key: "pivot-y", label: "Y", locked: [false, false, false, false, true, false] },
      { key: "pivot-z", label: "Z", locked: [false, false, false, false, false, true] },
    ],
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
 * Step 2 (DESIGN.md §4, mockups tape_2, v1.3.0 RDM 7 parity): 320px left
 * inspector — 4 primary quick cards, the grouped RDM 7 library synced with
 * the 2×3 DOF matrix, active supports list, live kinematic badge and the
 * undoable clear — beside the 3D viewport with click-to-restrain nodes.
 */
function SupportsPage() {
  const nodes = useProjectStore((s) => s.project.structure.nodes);
  const beams = useProjectStore((s) => s.project.structure.beams);
  const supports = useProjectStore((s) => s.project.structure.supports);
  const setSupport = useProjectStore((s) => s.setSupport);
  const clearSupports = useProjectStore((s) => s.clearSupports);
  const selectedNodeId = useProjectStore((s) => s.selection.nodeId);
  const selectNode = useProjectStore((s) => s.selectNode);
  const navigate = useNavigate();
  const [activePreset, setActivePreset] = useState<string | null>(null);

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

  const applyPreset = (preset: Preset) => {
    if (selectedNodeId === null) {
      return;
    }
    setSupport(selectedNodeId, [...preset.locked]);
    setActivePreset(preset.key);
  };

  const clearAll = () => {
    if (supports.length === 0) {
      return;
    }
    const before = structuredClone(supports);
    clearSupports();
    toast("Appuis supprimés", {
      description: `${before.length} appui(s) retiré(s).`,
      action: {
        label: "Annuler",
        onClick: () => {
          for (const support of before) {
            setSupport(support.node_id, [...support.locked_dofs]);
          }
        },
      },
      duration: 5_000,
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 lg:flex-row-reverse">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 rounded-panel border border-hairline bg-panel p-3">
        <div className="relative min-h-[320px] flex-1 overflow-hidden rounded border border-hairline">
          <ViewportCanvas nodes={nodes} beams={beams} testId="viewport-canvas">
            <SupportMarkers nodes={nodes} supports={supports} />
            <NodeMarkers
              positions={nodePositions(nodes)}
              highlightNodeId={selectedNodeId}
              nodeIds={nodes.map((n) => n.id)}
              onPickNode={(id) => selectNode(id)}
            />
          </ViewportCanvas>
        </div>
        <p className="text-[12px] text-ink-muted">
          <Trans>
            Cliquez un nœud dans la vue 3D pour le sélectionner, puis appliquez un appui.
          </Trans>
        </p>
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
            {PRIMARY_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                variant="outline"
                size="sm"
                data-testid={`preset-${preset.key}`}
                className={`justify-start ${activePreset === preset.key ? "border-accent text-accent" : ""}`}
                disabled={selectedNodeId === null}
                onClick={() => applyPreset(preset)}
              >
                <preset.icon size={16} />
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
        {/* Grouped 12-preset RDM 7 library + custom entry. */}
        <details className="rounded border border-hairline p-2" data-testid="rdm7-library">
          <summary className="cursor-pointer text-[12px] font-medium text-ink-secondary">
            Bibliothèque RDM 7 (12 appuis groupés)
          </summary>
          <div className="mt-2 space-y-2">
            {GROUPED_PRESETS.map((group) => (
              <div key={group.group}>
                <p className="mb-1 text-[11px] text-ink-muted">{group.group}</p>
                <div className="flex flex-wrap gap-1">
                  {group.presets.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      data-testid={`preset-${preset.key}`}
                      className={`rounded border border-hairline px-2 py-0.5 font-data text-[11px] ${
                        activePreset === preset.key
                          ? "border-accent bg-accent-tint text-accent"
                          : "text-ink-secondary hover:text-ink-primary"
                      }`}
                      disabled={selectedNodeId === null}
                      onClick={() => applyPreset(preset)}
                    >
                      {group.group === "Appuis simples"
                        ? `Appui ${preset.label}`
                        : `${group.group} ${preset.label}`}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[11px] text-ink-muted">
              <Trans>Personnalisée : composez la matrice 2×3 ci-dessous.</Trans>
            </p>
          </div>
        </details>
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
                    <tr
                      key={n.id}
                      className={`border-t border-hairline ${selectedNodeId === n.id ? "bg-accent-tint" : ""}`}
                      onClick={() => selectNode(n.id)}
                    >
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
                              setActivePreset(null);
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
          <div className="mb-1 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-secondary">
              <SupportReaction size={14} />
              <Trans>Appuis actifs</Trans>
            </h3>
            <button
              type="button"
              className="rounded border border-hairline px-2 py-0.5 text-[11px] text-ink-secondary hover:border-fea-max hover:text-fea-max disabled:opacity-40"
              data-testid="clear-supports"
              disabled={supports.length === 0}
              onClick={clearAll}
            >
              <Trans>Tout supprimer</Trans>
            </button>
          </div>
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
        <label className="flex items-center gap-2 text-[12px] text-ink-secondary">
          <SupportSpring size={14} />
          <span className="font-data">
            {supports.length} appui(s) · {reactionCount} réactions
          </span>
        </label>
        {/* v1.3.0 Step 2: next-step hand-off. */}
        <Button
          className="w-full"
          data-testid="next-loads"
          disabled={reactionCount < 6}
          onClick={() => void navigate({ to: "/loads" })}
        >
          <Trans>Suivant : Définir les charges →</Trans>
        </Button>
      </aside>
    </div>
  );
}
