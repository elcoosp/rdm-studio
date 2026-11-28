import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { toast } from "sonner";
import { Button } from "@rdm-studio/ui/primitives";
import { BottomSheet } from "@/components/BottomSheet";
import { DesktopSplit } from "@/components/ui/resizable";
import { NumberFieldRoot, NumberFieldInput } from "@/components/ui/number-field";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ExpandablePanel,
  HoldToConfirm,
  StatusBadge,
  Tooltip,
  TooltipGroup,
} from "@rdm-studio/ui/interior";
import {
  SupportFixed,
  SupportPinned,
  SupportRoller,
  SupportSlider,
  SupportSpring,
  SupportReaction,
} from "@rdm-studio/ui/icons";
import { NodePin } from "@rdm-studio/ui/icons";
import { StageContent, useStageSlot } from "@/state/stageStore";
import { useProjectStore } from "@/state/projectStore";
import { StudioBaseSearchSchema } from "@/schemas/searchParams.schema";
import { useSelectedIds } from "@/hooks/useStudioQuery";
import { IconSupport } from "@rdm-studio/ui/icons";
import { trackProductEvent } from "@/lib/productTelemetry";

export const Route = createFileRoute("/_studio/supports")({
  staticData: {
    surface: "studio",
    stepOrder: 2,
    label: "Liaisons (RDM 7)",
    mobileLabel: "Liaisons",
    icon: IconSupport,
    stageVisible: true,
    shortcut: "2",
  },
  validateSearch: StudioBaseSearchSchema,
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
    label: "Simple Z",
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
  tone: "pass" | "fail" | "warn";
} {
  if (reactionCount < 6) {
    return { label: "Hypostatique (mécanisme)", tone: "fail" };
  }
  if (reactionCount === 6) {
    return { label: "Isostatique", tone: "pass" };
  }
  return { label: `Hyperstatique degré ${reactionCount - 6}`, tone: "warn" };
}

/**
 * Step 2 (DESIGN.md §4, mockups tape_2, v2.1.2): locked `md+` workstation —
 * 320px LEFT inspector (presets, the 6-DOF matrix, Appuis actifs with
 * locked-DOF badges + `×` removal, the expandable Appuis élastiques
 * `kx..krz` section wired to `Support.spring_stiffness`, and the selected
 * node coordinate / free-DOF summary card) beside the persistent 3D stage.
 * v2.1.2: the disclosures are `ExpandablePanel`s (smooth height +
 * opacity), the DOF matrix rides Base UI `Checkbox`es, the kinematic
 * status is an animated `StatusBadge` and `Tout supprimer` is an 800 ms
 * `HoldToConfirm` (instant keyboard / E2E click fallback).
 */
function SupportsPage() {
  const nodes = useProjectStore((s) => s.project.structure.nodes);
  const supports = useProjectStore((s) => s.project.structure.supports);
  const setSupport = useProjectStore((s) => s.setSupport);
  const setSupportSprings = useProjectStore((s) => s.setSupportSprings);
  const setSupportSettlement = useProjectStore((s) => s.setSupportSettlement);
  const removeSupport = useProjectStore((s) => s.removeSupport);
  const clearSupports = useProjectStore((s) => s.clearSupports);
  // v2.1.0: the node selection is URL-backed (`?node=`).
  const { nodeId: selectedNodeId, selectNode } = useSelectedIds();
  const navigate = useNavigate();
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

  // v2.1.1: the active preset highlight is DERIVED from the selected
  // node's actual locked DOFs — clicking any node in 3D (or the DOF
  // matrix) illuminates its matching restraint card automatically; the
  // primary cards win over the grouped RDM 7 library on ties.
  const deriveActivePreset = (nodeId: number | null): string | null => {
    if (nodeId === null) {
      return null;
    }
    const locked = lockedFor(nodeId);
    const matches = (preset: { locked: boolean[] }): boolean =>
      preset.locked.every((v, i) => v === (locked[i] ?? false));
    const primary = PRIMARY_PRESETS.find((p) => matches(p));
    if (primary !== undefined) {
      return primary.key;
    }
    for (const group of GROUPED_PRESETS) {
      const found = group.presets.find((p) => matches(p));
      if (found !== undefined) {
        return found.key;
      }
    }
    return null;
  };
  const activePreset = deriveActivePreset(selectedNodeId);

  const springsFor = (nodeId: number): number[] =>
    supports.find((s) => s.node_id === nodeId)?.spring_stiffness ?? [0, 0, 0, 0, 0, 0];

  const settlementFor = (nodeId: number): number[] =>
    supports.find((s) => s.node_id === nodeId)?.settlement ?? [0, 0, 0, 0, 0, 0];

  const reactionCount = supports.reduce((sum, s) => sum + s.locked_dofs.filter(Boolean).length, 0);
  const status = kinematicStatus(reactionCount);

  const applyPreset = (preset: Preset) => {
    const targetId = selectedNodeId ?? nodes.at(0)?.id ?? null;
    if (targetId === null) {
      toast("Placez d'abord au moins un nœud à l'étape 1.");
      return;
    }
    if (selectedNodeId === null) {
      selectNode(targetId);
    }
    setSupport(targetId, [...preset.locked]);
    void trackProductEvent("support_preset_applied", { preset: preset.key });
    toast(`Liaison « ${preset.label} » appliquée à N${targetId}`);
  };

  const clearAll = () => {
    if (supports.length === 0) {
      return;
    }
    const before = structuredClone(supports);
    clearSupports();
    void trackProductEvent("support_cleared");
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
      {/* v2.3.0: Inspector sections grouped into hairline sub-cards with 16px engineering icons. */}

      {/* Status & Kinematic sub-card */}
      <div className="rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge tone={status.tone} testId="kinematic-status">
            {status.label}
          </StatusBadge>
          <span className="flex shrink-0 items-center gap-1 font-data text-[11px] whitespace-nowrap text-ink-muted">
            <SupportSpring size={16} />
            {supports.length} appuis · {reactionCount} DDL
          </span>
        </div>
      </div>

      {/* Selected Node Summary sub-card */}
      {selectedNodeId !== null
        ? (() => {
            const node = nodes.find((n) => n.id === selectedNodeId);
            const locked = lockedFor(selectedNodeId);
            const lockedCount = locked.filter(Boolean).length;
            const freeDofs = DOF_LABELS.filter((_, i) => !locked[i]);
            return (
              <div
                className="mt-2 rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5"
                data-testid="node-summary-card"
              >
                <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary mb-2">
                  <NodePin size={16} />
                  <Trans>Nœud sélectionné</Trans>
                </h3>
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

      {/* Presets d'appui sub-card */}
      <div className="mt-2 rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary mb-2">
          <SupportFixed size={16} />
          <Trans>Presets d'appui</Trans>
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <TooltipGroup className="contents">
            {PRIMARY_PRESETS.map((preset) => (
              <Tooltip
                key={preset.key}
                label={t`Appliquer « ${preset.label} » au nœud sélectionné`}
                side="top"
              >
                <Button
                  variant="outline"
                  size="sm"
                  data-testid={`preset-${preset.key}`}
                  className={`h-8 justify-start gap-1.5 whitespace-nowrap px-2.5 text-[12px] ${activePreset === preset.key ? "border-accent bg-accent-tint font-semibold text-accent" : ""}`}
                  disabled={nodes.length === 0}
                  onClick={() => applyPreset(preset)}
                >
                  <preset.icon size={18} />
                  {preset.label}
                </Button>
              </Tooltip>
            ))}
          </TooltipGroup>
        </div>
      </div>

      {/* Appuis élastiques sub-card — M10.2 (RDM 7 §appui élastique). */}
      <div
        className="mt-2 rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5"
        data-testid="spring-section"
      >
        <ExpandablePanel
          testId="elastic-springs-panel"
          title={
            <Trans>
              <span className="inline-flex items-center gap-1.5">
                <SupportSpring size={16} />
                Appui élastique (k)
              </span>
            </Trans>
          }
        >
          <p className="mt-1 text-[11px] text-ink-muted">
            <Trans>
              Raideurs N/m (translations) et N·m/rad (rotations). Un DDL bloqué ignore son ressort ;
              un DDL libre élastique participe à la raideur (EN 1993-1-1).
            </Trans>
          </p>
          {/* M10.2: 1-click elastic-support preset — seeds kz = 1000 kN/m. */}
          <Button
            variant="outline"
            size="sm"
            className="mt-2 h-8 w-full justify-start gap-1.5 px-2.5 text-[12px]"
            data-testid="preset-elastic"
            disabled={nodes.length === 0}
            onClick={() => {
              const targetId = selectedNodeId ?? nodes.at(0)?.id ?? null;
              if (targetId === null) {
                toast("Placez d'abord au moins un nœud à l'étape 1.");
                return;
              }
              if (selectedNodeId === null) {
                selectNode(targetId);
              }
              const existing = supports.find((s) => s.node_id === targetId);
              setSupportSprings(targetId, [
                existing?.spring_stiffness[0] ?? 0,
                existing?.spring_stiffness[1] ?? 0,
                1_000_000,
                existing?.spring_stiffness[3] ?? 0,
                existing?.spring_stiffness[4] ?? 0,
                existing?.spring_stiffness[5] ?? 0,
              ]);
              void trackProductEvent("support_preset_applied", { preset: "elastic" });
              toast(`Appui élastique k·z = 1000 kN/m appliqué à N${targetId}`);
            }}
          >
            <SupportSpring size={18} />
            <Trans>Appui élastique (k)</Trans>
          </Button>
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
        </ExpandablePanel>
      </div>

      {/* Déplacement imposé sub-card — M10.2 (RDM 7 Δux..Δrz). */}
      <div
        className="mt-2 rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5"
        data-testid="settlement-section"
      >
        <ExpandablePanel
          testId="support-settlement-panel"
          title={
            <Trans>
              <span className="inline-flex items-center gap-1.5">
                <SupportReaction size={16} />
                Déplacement imposé (Δ)
              </span>
            </Trans>
          }
        >
          <p className="mt-1 text-[11px] text-ink-muted">
            <Trans>
              Déplacements imposés sur les DDL bloqués (Δu en mm, Δθ en degrés). Le tassement
              d'appui mobilise les liaisons hyperstatiques (RDM 7).
            </Trans>
          </p>
          {selectedNodeId === null ? (
            <p className="mt-2 text-[12px] text-ink-muted">
              <Trans>Sélectionnez un nœud pour prescrire son déplacement.</Trans>
            </p>
          ) : (
            <SettlementFields
              key={selectedNodeId}
              nodeId={selectedNodeId}
              locked={lockedFor(selectedNodeId)}
              settlement={settlementFor(selectedNodeId)}
              onApply={(next) => setSupportSettlement(selectedNodeId, next)}
            />
          )}
        </ExpandablePanel>
      </div>

      {/* Bibliothèque RDM 7 sub-card */}
      <div
        className="mt-2 rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5"
        data-testid="rdm7-library"
      >
        <ExpandablePanel title={<Trans>Bibliothèque RDM 7 (12 appuis groupés)</Trans>}>
          <div className="mt-2 space-y-2">
            {GROUPED_PRESETS.map((group) => (
              <div key={group.group}>
                <p className="mb-1 text-[11px] text-ink-muted">{group.group}</p>
                <div className="flex flex-wrap gap-1">
                  {group.presets.map((preset) => (
                    <Tooltip
                      key={preset.key}
                      label={t`${group.group} ${preset.label} — appliquer au nœud sélectionné`}
                      side="top"
                    >
                      <button
                        type="button"
                        data-testid={`preset-${preset.key}`}
                        className={`rounded border border-hairline px-2 py-0.5 font-data text-[11px] ${
                          activePreset === preset.key
                            ? "border-accent bg-accent-tint text-accent"
                            : "text-ink-secondary hover:text-ink-primary"
                        }`}
                        disabled={nodes.length === 0}
                        onClick={() => applyPreset(preset)}
                      >
                        {group.group === "Appuis simples"
                          ? `Appui ${preset.label}`
                          : `${group.group} ${preset.label}`}
                      </button>
                    </Tooltip>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[11px] text-ink-muted">
              <Trans>Personnalisée : composez la matrice 2×3 ci-dessous.</Trans>
            </p>
          </div>
        </ExpandablePanel>
      </div>

      {/* Matrice 6 DDL sub-card */}
      <div className="mt-2 rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary mb-2">
          <SupportReaction size={16} />
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
                        <Checkbox
                          aria-label={`dof ${d} node ${n.id}`}
                          checked={locked[i] ?? false}
                          onCheckedChange={(checked) => {
                            const next = [...locked];
                            next[i] = checked === true;
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

      {/* Appuis actifs sub-card */}
      <div className="mt-2 rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
            <SupportReaction size={16} />
            <Trans>Appuis actifs</Trans>
          </h3>
          {/* v2.1.2: HoldToConfirm (800 ms) guards the destructive wipe;
              keyboard Enter / E2E click commits instantly (webdriver). */}
          <HoldToConfirm
            onConfirm={clearAll}
            testId="clear-supports"
            disabled={supports.length === 0}
            confirmLabel={t`Supprimés`}
            title="Maintenir 800 ms pour tout supprimer"
          >
            <Trans>Tout supprimer</Trans>
          </HoldToConfirm>
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
              const settled = (s.settlement ?? []).some((d) => d !== 0);
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
                  {settled ? (
                    <span
                      className="rounded-[2px] border border-hairline bg-panel-subtle px-1 py-0 text-[10px] text-fea-mid"
                      data-testid={`settlement-badge-${s.node_id}`}
                    >
                      Δ imposé
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
      </div>

      {/* v1.3.0 Step 2: next-step hand-off. */}
      <Button
        className="mt-2 w-full"
        data-testid="next-loads"
        disabled={reactionCount < 6}
        onClick={() => void navigate({ to: "/loads" })}
      >
        <Trans>Suivant : Définir les charges →</Trans>
      </Button>
    </BottomSheet>
  );

  const main = (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={slotRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-canvas"
        data-testid="supports-stage-slot"
      />
      <StageContent k="supports" options={{ wireframe: false, selectedBeamId: null }}>
        {null}
      </StageContent>
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
        onClick={() => {
          onApply(values);
          void trackProductEvent("support_spring_set", {
            dof: "kz",
            stiffness: (values[2] ?? 0) / 1000,
          });
        }}
      >
        <Trans>Appliquer les ressorts à N{nodeId}</Trans>
      </button>
    </div>
  );
}

/**
 * Imposed-support-displacement editor (M10.2, RDM 7): `[Δux..Δrz]` —
 * translations in mm (stored m) and rotations in degrees (stored rad).
 * A field is enabled only when its DOF is locked by the support (a free
 * DOF cannot carry a prescribed displacement).
 */
function SettlementFields({
  nodeId,
  locked,
  settlement,
  onApply,
}: {
  nodeId: number;
  locked: boolean[];
  settlement: number[];
  onApply: (settlement: number[]) => void;
}) {
  // Display units: mm for translations (1e3), degrees for rotations
  // (180/π). The store holds strict SI values (m, rad).
  const toDisplay = (i: number): number => (settlement[i] ?? 0) * (i < 3 ? 1e3 : 180 / Math.PI);
  const fromDisplay = (i: number, v: number): number => v * (i < 3 ? 1e-3 : Math.PI / 180);
  const [values, setValues] = useState<number[]>(() => [0, 1, 2, 3, 4, 5].map(toDisplay));
  const anyLocked = locked.some(Boolean);
  return (
    <div className="mt-2" data-testid={`settlement-fields-${nodeId}`}>
      <div className="grid grid-cols-3 gap-1.5">
        {DOF_LABELS.map((label, i) => (
          <label key={label} className="flex flex-col gap-0.5 text-[10px] text-ink-muted">
            <span className="font-data">
              Δ{label.toLowerCase()} [{i < 3 ? "mm" : "°"}]
            </span>
            <NumberFieldRoot
              value={values[i] ?? 0}
              step={i < 3 ? 0.5 : 0.01}
              onValueChange={(v) => {
                if (v === null) return;
                setValues((prev) => {
                  const next = [...prev];
                  next[i] = v;
                  return next;
                });
              }}
            >
              <NumberFieldInput
                className="font-data h-7 w-full px-1 text-[11px]"
                disabled={!locked[i]}
              />
            </NumberFieldRoot>
          </label>
        ))}
      </div>
      {!anyLocked ? (
        <p className="mt-1 text-[10px] text-ink-muted">
          <Trans>
            Bloquez d'abord un DDL : le déplacement imposé s'applique aux DDL verrouillés.
          </Trans>
        </p>
      ) : null}
      <button
        type="button"
        className="mt-2 w-full rounded bg-accent px-2 py-1.5 text-[12px] text-white disabled:opacity-50"
        data-testid={`apply-settlement-${nodeId}`}
        disabled={!anyLocked}
        onClick={() => {
          onApply([0, 1, 2, 3, 4, 5].map((i) => fromDisplay(i, values[i] ?? 0)));
          void trackProductEvent("support_settlement_set", {
            dof: "uz",
            value_mm: values[2] ?? 0,
          });
        }}
      >
        <Trans>Appliquer le déplacement imposé à N{nodeId}</Trans>
      </button>
    </div>
  );
}
