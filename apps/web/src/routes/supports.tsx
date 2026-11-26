import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/BottomSheet";
import { DesktopSplit } from "@/components/ui/resizable";
import { NumberFieldRoot, NumberFieldInput } from "@/components/ui/number-field";
import {
  SupportFixed,
  SupportPinned,
  SupportRoller,
  SupportSlider,
  SupportSpring,
  SupportReaction,
} from "@/components/icons/EngineeringIcons";
import { StageContent, useStageSlot } from "@/state/stageStore";
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
      { key: "glissiere-x", label: "X", locked: [true, false, false, true, true, false] },
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
 * Step 2 (DESIGN.md §4, mockups tape_2, v1.6.0): locked `md+` workstation —
 * 320px LEFT inspector (presets, the 6-DOF matrix, Appuis actifs with
 * locked-DOF badges + `×` removal, the expandable Appuis élastiques
 * `kx..krz` section wired to `Support.spring_stiffness`, and the selected
 * node coordinate / free-DOF summary card) beside the persistent 3D stage.
 */
function SupportsPage() {
  const nodes = useProjectStore((s) => s.project.structure.nodes);
  const supports = useProjectStore((s) => s.project.structure.supports);
  const setSupport = useProjectStore((s) => s.setSupport);
  const setSupportSprings = useProjectStore((s) => s.setSupportSprings);
  const removeSupport = useProjectStore((s) => s.removeSupport);
  const clearSupports = useProjectStore((s) => s.clearSupports);
  const selectedNodeId = useProjectStore((s) => s.selection.nodeId);
  const selectNode = useProjectStore((s) => s.selectNode);
  const navigate = useNavigate();
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [springsOpen, setSpringsOpen] = useState(false);
  const slotRef = useStageSlot("supports");

  const lockedFor = (nodeId: number): boolean[] =>
    supports.find((s) => s.node_id === nodeId)?.locked_dofs ?? [
      false,
      false,
      false,
      false,
      false,
      false,
    ];

  const springsFor = (nodeId: number): number[] =>
    supports.find((s) => s.node_id === nodeId)?.spring_stiffness ?? [0, 0, 0, 0, 0, 0];

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

  const inspector = (
    <BottomSheet testId="inspector-sheet" title={<Trans>Liaisons (RDM 7)</Trans>}>
      <div className="flex items-center justify-between gap-2">
        <Badge variant={status.variant} data-testid="kinematic-status">
          {status.label}
        </Badge>
        <label className="flex items-center gap-1.5 font-data text-[11px] text-ink-muted">
          <SupportSpring size={14} />
          {supports.length} appui(s) · {reactionCount} réactions
        </label>
      </div>
      {/* v1.6.0: selected node coordinate + free/locked DOF summary card. */}
      {selectedNodeId !== null
        ? (() => {
            const node = nodes.find((n) => n.id === selectedNodeId);
            const locked = lockedFor(selectedNodeId);
            const lockedCount = locked.filter(Boolean).length;
            const freeDofs = DOF_LABELS.filter((_, i) => !locked[i]);
            return (
              <div
                className="mt-2 rounded border border-hairline bg-panel-subtle p-2"
                data-testid="node-summary-card"
              >
                <p className="font-data text-[11px] text-ink-primary" data-testid="node-coords">
                  N{selectedNodeId} · ({node ? node.x.toFixed(2).replace(".", ",") : "0,00"} ;{" "}
                  {node ? node.y.toFixed(2).replace(".", ",") : "0,00"} ;{" "}
                  {node ? node.z.toFixed(2).replace(".", ",") : "0,00"}) m · {lockedCount} DDL
                  bloqués / {6 - lockedCount} libres
                </p>
                <p className="font-data mt-1 text-[10px] text-ink-muted">
                  DDL libres : {freeDofs.length > 0 ? freeDofs.join(" · ") : "aucun"}
                </p>
              </div>
            );
          })()
        : null}
      <section className="border-t border-hairline pt-3">
        <h3 className="text-xs font-medium text-ink-secondary">
          <Trans>Presets d'appui</Trans>
        </h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
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
      </section>
      {/* v1.6.0: expandable Appuis élastiques (kx..krz) section. */}
      <details
        className="border-t border-hairline pt-3"
        data-testid="spring-section"
        open={springsOpen}
        onToggle={(e) => setSpringsOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink-secondary">
          <SupportSpring size={14} />
          <Trans>Appuis élastiques (kx..krz)</Trans>
        </summary>
        <p className="mt-1 text-[11px] text-ink-muted">
          <Trans>
            Raideurs N/m (translations) et N·m/rad (rotations). Un DDL bloqué ignore son ressort ;
            un DDL libre élastique participe à la raideur (EN 1993-1-1).
          </Trans>
        </p>
        {selectedNodeId === null ? (
          <p className="mt-2 text-[12px] text-ink-muted">
            <Trans>Sélectionnez un nœud dans la vue 3D pour éditer ses ressorts.</Trans>
          </p>
        ) : (
          <SpringFields
            key={selectedNodeId}
            nodeId={selectedNodeId}
            springs={springsFor(selectedNodeId)}
            onApply={(next) => setSupportSprings(selectedNodeId, next)}
          />
        )}
      </details>
      {/* Grouped 12-preset RDM 7 library + custom entry. */}
      <details className="border-t border-hairline pt-3" data-testid="rdm7-library">
        <summary className="cursor-pointer text-xs font-medium text-ink-secondary">
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
      <section className="border-t border-hairline pt-3">
        <h3 className="text-xs font-medium text-ink-secondary">
          <Trans>Matrice 6 DDL des appuis</Trans>
        </h3>
        <p className="mb-2 text-[11px] text-ink-muted">
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
      </section>
      <section className="border-t border-hairline pt-3">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
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
          <ul className="space-y-1">
            {supports.map((s) => {
              const active = DOF_LABELS.filter((_, i) => s.locked_dofs[i]);
              const sprung = s.spring_stiffness.some((k) => k > 0);
              return (
                <li
                  key={s.node_id}
                  className="font-data flex flex-wrap items-center gap-1 text-[12px] text-ink-secondary"
                  data-testid={`support-row-${s.node_id}`}
                >
                  <span>N{s.node_id}</span>
                  {active.map((d) => (
                    <span
                      key={d}
                      className="rounded-[2px] border border-hairline bg-panel-subtle px-1 py-0 text-[10px] text-ink-primary"
                    >
                      {d}
                    </span>
                  ))}
                  {sprung ? (
                    <span className="rounded-[2px] border border-accent-ring bg-accent-tint px-1 py-0 text-[10px] text-accent">
                      <Trans>élastique</Trans>
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Supprimer l'appui du nœud ${s.node_id}`}
                    className="ml-auto text-ink-muted hover:text-fea-max"
                    data-testid={`remove-support-${s.node_id}`}
                    onClick={() => removeSupport(s.node_id)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {/* v1.3.0 Step 2: next-step hand-off. */}
      <Button
        className="w-full"
        data-testid="next-loads"
        disabled={reactionCount < 6}
        onClick={() => void navigate({ to: "/loads" })}
      >
        <Trans>Suivant : Définir les charges →</Trans>
      </Button>
    </BottomSheet>
  );

  const main = (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-3">
      <div
        ref={slotRef}
        className="relative min-h-0 flex-1 overflow-hidden rounded-panel border border-hairline bg-panel"
        data-testid="supports-stage-slot"
      />
      <StageContent k="supports" options={{ wireframe: false, selectedBeamId: null }}>
        {null}
      </StageContent>
      <p className="shrink-0 text-[12px] text-ink-muted">
        <Trans>Cliquez un nœud dans la vue 3D pour le sélectionner, puis appliquez un appui.</Trans>
      </p>
    </section>
  );

  return <DesktopSplit inspector={inspector} main={main} />;
}

/** Elastic spring editor (kx..krz) — N/m translations, N·m/rad rotations. */
function SpringFields({
  nodeId,
  springs,
  onApply,
}: {
  nodeId: number;
  springs: number[];
  onApply: (springs: number[]) => void;
}) {
  // v2.0.1: when the mounted support carries no spring at all, seed the
  // vertical translational spring (kz, index 2) with 1000 kN/m so one
  // click on "Appliquer les ressorts" immediately creates a valid elastic
  // support (the élastique badge requires at least one non-zero k).
  const [values, setValues] = useState<number[]>(() => {
    const hasAnySpring = springs.some((k) => k !== 0);
    if (!hasAnySpring) {
      const seeded: number[] = [...springs];
      seeded[2] = 1_000_000;
      return seeded;
    }
    return springs;
  });
  return (
    <div className="mt-2" data-testid={`spring-fields-${nodeId}`}>
      <div className="grid grid-cols-3 gap-1.5">
        {DOF_LABELS.map((label, i) => (
          <label key={label} className="flex flex-col gap-0.5 text-[10px] text-ink-muted">
            <span className="font-data">
              {label} [{i < 3 ? "kN/m" : "kN·m/rad"}]
            </span>
            <NumberFieldRoot
              value={values[i] !== undefined ? values[i] / 1000 : 0}
              step={1}
              min={0}
              onValueChange={(v) => {
                if (v === null) return;
                setValues((prev) => {
                  const next = [...prev];
                  next[i] = v * 1000;
                  return next;
                });
              }}
            >
              <NumberFieldInput className="font-data h-7 w-full px-1 text-[11px]" />
            </NumberFieldRoot>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="mt-2 w-full rounded bg-accent px-2 py-1.5 text-[12px] text-white"
        data-testid={`apply-springs-${nodeId}`}
        onClick={() => onApply(values)}
      >
        <Trans>Appliquer les ressorts à N{nodeId}</Trans>
      </button>
    </div>
  );
}
