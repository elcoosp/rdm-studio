import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { motion } from "motion/react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { toast } from "sonner";
import { IconTrash } from "@rdm-studio/ui/icons";
import { NumberFlowValue } from "@rdm-studio/ui/interior";
import { BottomSheet } from "@/components/BottomSheet";
import { DesktopSplit } from "@/components/ui/resizable";
import {
  NodalPointLoad,
  UniformBeamLoad,
  TrapezoidalLoad,
  SpanPointLoad,
  SelfWeightGravity,
  ThermalLoadIcon,
  TorqueMoment,
} from "@rdm-studio/ui/icons";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@rdm-studio/ui/primitives";
import { NumberFieldRoot, NumberFieldInput } from "@/components/ui/number-field";
import {
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot,
} from "@/components/ui/combobox";
import { ExpandablePanel, HoldToConfirm, StatusBadge } from "@rdm-studio/ui/interior";
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StageContent, useStageSlot } from "@/state/stageStore";
import { LoadsFullSearchSchema } from "@/schemas/searchParams.schema";
import { useUpdateSearch } from "@/hooks/useStudioQuery";
import { IconLoad } from "@rdm-studio/ui/icons";
import { feaClient } from "@/wasmBridge/workerClient";
import type { LoadData as LoadDataRow } from "@/state/projectStore";
import {
  useProjectStore,
  type LoadCaseId,
  type LoadData,
  type NodeData,
} from "@/state/projectStore";
import { trackProductEvent } from "@/lib/productTelemetry";

export const Route = createFileRoute("/_studio/loads")({
  staticData: {
    surface: "studio",
    stepOrder: 3,
    label: "Charges & Combinaisons",
    mobileLabel: "Charges",
    icon: IconLoad,
    stageVisible: true,
    shortcut: "3",
  },
  validateSearch: LoadsFullSearchSchema,
  component: LoadsPage,
});

/** EN 1990 elementary cases (G | Q | W | S | Acc tabs, §8.6 layoutId). */
const CASES: { id: LoadCaseId; label: string }[] = [
  { id: "Permanent", label: "G" },
  { id: "Variable", label: "Q" },
  { id: "Wind", label: "W" },
  { id: "Snow", label: "S" },
  { id: "Acceleration", label: "Acc" },
];

type LoadTab = "nodal" | "uniform" | "trapezoid" | "point";

const LOAD_TABS: { id: LoadTab; label: string; icon: typeof NodalPointLoad }[] = [
  { id: "nodal", label: "Nodale", icon: NodalPointLoad },
  { id: "uniform", label: "Uniforme", icon: UniformBeamLoad },
  { id: "trapezoid", label: "Trapézoïdale", icon: TrapezoidalLoad },
  { id: "point", label: "Ponctuelle (a/L)", icon: SpanPointLoad },
];

/** Member length in metres from its endpoint nodes. */
function memberLength(nodes: NodeData[], beam: { n1: number; n2: number }): number {
  const n1 = nodes.find((n) => n.id === beam.n1);
  const n2 = nodes.find((n) => n.id === beam.n2);
  if (n1 === undefined || n2 === undefined) {
    return 0;
  }
  return Math.hypot(n2.x - n1.x, n2.y - n1.y, n2.z - n1.z);
}

/** Explicit load direction label (v2.4.0 Direction column). */
function directionLabel(load: LoadData): string {
  const sign = (v: number): string => (v >= 0 ? "+" : "−");
  if (load.kind === "Nodal") {
    const { fx, fy, fz, mx, my, mz } = load.forces;
    const parts: string[] = [];
    if (fx !== 0) parts.push(`Fx (${sign(fx)}X)`);
    if (fy !== 0) parts.push(`Fy (${sign(fy)}Y)`);
    if (fz !== 0) parts.push(`Fz (${sign(fz)}Z)`);
    if (mx !== 0) parts.push(`Mx (${sign(mx)}X)`);
    if (my !== 0) parts.push(`My (${sign(my)}Y)`);
    if (mz !== 0) parts.push(`Mz (${sign(mz)}Z)`);
    return parts.length > 0 ? parts.join(", ") : "—";
  }
  if (load.kind === "PointOnSpan") {
    const { fx, fy, fz } = load.forces;
    const parts: string[] = [];
    if (fx !== 0) parts.push(`Fx (${sign(fx)}X)`);
    if (fy !== 0) parts.push(`Fy (${sign(fy)}Y)`);
    if (fz !== 0) parts.push(`Fz (${sign(fz)}Z)`);
    return parts.length > 0 ? `Global ${parts.join(", ")}` : "Global —";
  }
  if (load.kind === "Trapezoid" || load.kind === "Uniform") {
    const d = load.direction ?? { x: 0, y: 0, z: -1 };
    return `Global (${d.x.toFixed(0)} ; ${d.y.toFixed(0)} ; ${d.z.toFixed(0)})`;
  }
  if (load.kind === "AccelerationField") {
    return `Champ 3D (${load.ax_g}, ${load.ay_g}, ${load.az_g})`;
  }
  return "—";
}

/**
 * Step 3 (DESIGN.md §4, mockups tape_3, v2.1.2): locked `md+` workstation —
 * 320px LEFT inspector (EN 1990 case tabs, g-acceleration quick scenarios
 * plus the `(ax, ay, az)` form, 3-axis nodal and beam load forms in the
 * 2-column key-value grid, live force resultants, undoable clear) beside
 * the 3D viewport with crimson load arrows. v2.1.2: the node / member
 * targets are searchable Comboboxes (NodePin / BeamSegment icons), the
 * concentrated moments ride an `ExpandablePanel`, `Vider les charges` is
 * an 800 ms `HoldToConfirm` and the equilibrium pill is a `StatusBadge`.
 */
function LoadsPage() {
  const loads = useProjectStore((s) => s.project.structure.loads);
  const nodes = useProjectStore((s) => s.project.structure.nodes);
  const beams = useProjectStore((s) => s.project.structure.beams);
  const sections = useProjectStore((s) => s.project.structure.sections);
  const materials = useProjectStore((s) => s.project.structure.materials);
  const addNodalLoad = useProjectStore((s) => s.addNodalLoad);
  const addBeamSpanLoad = useProjectStore((s) => s.addBeamSpanLoad);
  const addAccelerationField = useProjectStore((s) => s.addAccelerationField);
  const removeLoad = useProjectStore((s) => s.removeLoad);
  const replaceLoads = useProjectStore((s) => s.replaceLoads);
  const selfWeight = useProjectStore((s) => s.project.structure.self_weight_enabled);
  const toggleSelfWeight = useProjectStore((s) => s.toggleSelfWeight);
  const navigate = useNavigate();

  // v2.1.0: EN 1990 case (`?case=`) and load-form tab (`?loadTab=`) are
  // URL-backed — a shared `/loads?case=Wind&loadTab=uniform` link restores
  // the exact form state on any device.
  const search = Route.useSearch();
  const updateSearch = useUpdateSearch();
  const caseId = (search.case ?? "Permanent") as LoadCaseId;
  const setCaseId = (next: LoadCaseId) => {
    updateSearch((prev) => ({ ...prev, case: next }));
  };
  const tab = (search.loadTab ?? "nodal") as LoadTab;
  const setTab = (next: LoadTab) => {
    updateSearch((prev) => ({ ...prev, loadTab: next }));
  };
  const [nodeId, setNodeId] = useState<number>(nodes[0]?.id ?? 1);
  const [beamId, setBeamId] = useState<number>(beams[0]?.id ?? 1);

  // v2.3.0: sync beamId when beams updates from empty to populated
  useEffect(() => {
    const firstBeam = beams[0];
    if (firstBeam && !beams.some((b) => b.id === beamId)) {
      setBeamId(firstBeam.id);
    }
  }, [beams, beamId]);
  // v1.5.0: numeric fields ride the Base UI NumberField (locale parsing).
  const [fx, setFx] = useState(0);
  const [fy, setFy] = useState(0);
  const [fz, setFz] = useState(-10);
  const [qx, setQx] = useState(0);
  const [qy, setQy] = useState(0);
  const [qz, setQz] = useState(-10);
  const [q2z, setQ2z] = useState(-5);
  const [ratio, setRatio] = useState(50);
  const [axG, setAxG] = useState(0);
  const [ayG, setAyG] = useState(0);
  const [azG, setAzG] = useState(0);
  // v1.6.0: concentrated moments (kN·m) on nodal & point-on-span loads.
  const [momentsOpen, setMomentsOpen] = useState(false);
  const [mx, setMx] = useState(0);
  const [my, setMy] = useState(0);
  const [mz, setMz] = useState(0);
  // v1.6.0: the persistent stage slot pane.
  const slotRef = useStageSlot("loads");

  const field = loads.find((l) => l.kind === "AccelerationField");
  // v1.4.0: 6 locked DOFs make the system equilibrated (iso- or hyperstatic).
  const supports = useProjectStore((s) => s.project.structure.supports);
  const reactionCount = supports.reduce(
    (sum, sp) => sum + sp.locked_dofs.filter(Boolean).length,
    0,
  );
  const reactionCountValid = reactionCount >= 6;

  // Live global force resultant (§8.1 rolling digits): nodal + span
  // forces, distributed totals (mean q × L along the declared direction)
  // and the inertial field (ρ·A·g·a summed over every member).
  const resultant = useMemo(() => {
    let fxSum = 0;
    let fySum = 0;
    let fzSum = 0;
    for (const l of loads) {
      if (l.kind === "Nodal" || l.kind === "PointOnSpan") {
        fxSum += l.forces.fx;
        fySum += l.forces.fy;
        fzSum += l.forces.fz;
      } else if (l.kind === "Trapezoid" || l.kind === "Uniform") {
        // v2.0.2: the EN 1991 generators append Uniform beam loads (snow /
        // wind / imposed) - mean q x member length along the declared
        // direction, and no `forces` block.
        const length = memberLength(
          nodes,
          beams.find((b) => b.id === l.beam_id) ?? { n1: 0, n2: 0 },
        );
        const norm = Math.hypot(l.direction?.x ?? 0, l.direction?.y ?? 0, l.direction?.z ?? 0) || 1;
        const total = (((l.q_start ?? 0) + (l.q_end ?? 0)) / 2) * length;
        fxSum += (total * (l.direction?.x ?? 0)) / norm;
        fySum += (total * (l.direction?.y ?? 0)) / norm;
        fzSum += (total * (l.direction?.z ?? 0)) / norm;
      } else {
        let total = 0;
        for (const b of beams) {
          // Catalog records are schema-typed ; only the inertial
          // mass terms matter here.
          const section = sections[b.section_id] as { a?: number } | undefined;
          const material = materials[b.material_id] as { rho?: number } | undefined;
          const length = memberLength(nodes, b);
          if (section == null || material == null || length <= 0) {
            continue;
          }
          total += (material.rho ?? 0) * (section.a ?? 0) * 9.80665 * length;
        }
        if (l.kind !== "AccelerationField") {
          continue;
        }
        fxSum += total * l.ax_g;
        fySum += total * l.ay_g;
        fzSum += total * l.az_g;
      }
    }
    return { fx: fxSum / 1000, fy: fySum / 1000, fz: fzSum / 1000 };
  }, [loads, beams, nodes, sections, materials]);

  const applyField = (ax: number, ay: number, az: number) => {
    addAccelerationField({ loadCase: "Acceleration", axG: ax, ayG: ay, azG: az });
    void trackProductEvent("load_accel_set", { ax, ay, az });
  };

  // v2.1.1: an EN 1991 generator flips the active case tab (Q / S / W)
  // and confirms with a concise toast.
  const switchCaseForGenerator = (next: LoadCaseId, label: string) => {
    setCaseId(next);
    toast(`Cas ${label} activé`, { duration: 2_500 });
  };

  const add = () => {
    const moments = { mx: mx * 1000, my: my * 1000, mz: mz * 1000 };
    if (tab === "nodal") {
      const px = fx * 1000;
      const py = fy * 1000;
      const pz = fz * 1000;
      if (px !== 0 || py !== 0 || pz !== 0) {
        addNodalLoad(nodeId, pz, caseId, px, py, moments);
      } else if (moments.mx !== 0 || moments.my !== 0 || moments.mz !== 0) {
        addNodalLoad(nodeId, 0, caseId, 0, 0, moments);
      }
      void trackProductEvent("load_case_added", { case: caseId });
      return;
    }
    if (tab === "uniform") {
      // 3-axis uniform: magnitude + unit direction from (qx, qy, qz).
      const magnitude = Math.hypot(qx, qy, qz);
      if (magnitude > 0) {
        addBeamSpanLoad({
          beamId,
          loadCase: caseId,
          kind: "Trapezoid",
          qStart: magnitude * 1000,
          qEnd: magnitude * 1000,
          direction: { x: qx / magnitude, y: qy / magnitude, z: qz / magnitude },
        });
      }
      return;
    }
    if (tab === "trapezoid") {
      const q1 = qz * 1000;
      const q2 = q2z * 1000;
      if (q1 !== 0 || q2 !== 0) {
        addBeamSpanLoad({
          beamId,
          loadCase: caseId,
          kind: "Trapezoid",
          qStart: q1,
          qEnd: q2,
          direction: { x: 0, y: 0, z: -1 },
        });
      }
      return;
    }
    const value = fz * 1000;
    const a = ratio / 100;
    if (value !== 0 && Number.isFinite(a)) {
      addBeamSpanLoad({
        beamId,
        loadCase: caseId,
        kind: "PointOnSpan",
        positionRatio: Math.min(1, Math.max(0, a)),
        forces: {
          fx: 0,
          fy: 0,
          fz: value,
          mx: mx * 1000,
          my: my * 1000,
          mz: mz * 1000,
        },
      });
    }
  };

  const clearLoads = () => {
    if (loads.length === 0) {
      return;
    }
    const before: LoadData[] = structuredClone(loads);
    replaceLoads([]);
    toast("Charges vidées", {
      description: `${before.length} charge(s) supprimée(s).`,
      action: {
        label: "Annuler",
        onClick: () => replaceLoads(before),
      },
      duration: 5_000,
    });
  };

  const inspector = (
    <BottomSheet testId="inspector-sheet" title={<Trans>Charges et combinaisons EN 1990</Trans>}>
      {/* v2.3.0: Inspector sections grouped into hairline sub-cards with 16px engineering icons. */}

      {/* Load Count & Clear sub-card */}
      <div className="rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-data text-[11px] text-ink-muted">
            {loads.length} charge(s) définie(s)
          </span>
          {/* v2.1.2: HoldToConfirm (800 ms) guards the destructive wipe;
              keyboard Enter / E2E click commits instantly (webdriver). */}
          <HoldToConfirm
            onConfirm={clearLoads}
            testId="clear-loads"
            disabled={loads.length === 0}
            confirmLabel={t`Vidées`}
            title="Maintenir 800 ms pour vider les charges"
          >
            <Trans>Vider les charges</Trans>
          </HoldToConfirm>
        </div>
      </div>

      {/* M10.5: Cas de charges & Combinaisons EN 1990 manager. */}
      <LoadCaseManager />

      {/* EN 1990 Case Tabs sub-card */}
      <div className="mt-2 rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5">
        {/* G | Q | W | Acc tabs with the shared layoutId glider (§8.6). */}
        <div
          className="flex items-center gap-1 border-b border-hairline pb-2"
          data-testid="case-tabs"
        >
          {CASES.map((c) => (
            <button
              key={c.id}
              type="button"
              className="relative flex min-h-8 items-center rounded px-2.5 text-[13px] data-[active=true]:text-accent"
              data-active={caseId === c.id}
              onClick={() => setCaseId(c.id)}
            >
              {c.label}
              {caseId === c.id ? (
                <motion.span
                  layoutId="case-tab-underline"
                  className="absolute inset-x-1 -bottom-px h-[2px] bg-accent"
                  transition={{ type: "spring", stiffness: 520, damping: 40 }}
                />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* EN 1991 Generators sub-card */}
      <div className="mt-2 rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary mb-2">
          <ThermalLoadIcon size={16} />
          <Trans>Générateurs EN 1991</Trans>
        </h3>
        {/* v2.0.1: EN 1991 generators + thermal action, wired to
            generate_env_loads_json — docked below the EN 1990 case tabs.
            v2.1.1: clicking Imposée / Neige sk / Vent vb auto-switches the
            active case tab (Q / S / W) with a concise confirmation toast. */}
        <EnvLoadGenerators
          onCaseSwitch={switchCaseForGenerator}
          beams={beams}
          beamId={beamId}
          onBeamChange={setBeamId}
        />
      </div>

      {/* g-Acceleration sub-card */}
      <div
        className="mt-2 rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5"
        data-testid="accel-field"
      >
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary mb-2">
          <SelfWeightGravity size={16} />
          <Trans>Champs d'accélération (g)</Trans>
        </h3>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Button
            variant="outline"
            size="sm"
            data-testid="scenario-selfweight"
            onClick={() => applyField(0, 0, -1)}
          >
            Poids propre seul 1g −Z
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-testid="scenario-transport"
            onClick={() => applyField(0.8, 0, -1.5)}
          >
            Transport 0,8g X / 1,5g −Z
          </Button>
        </div>
        <div className="mt-2 grid grid-cols-[112px_1fr] items-center gap-x-2 gap-y-2">
          <label className="text-xs font-medium text-ink-secondary" htmlFor="accel-ax">
            ax (×g)
          </label>
          <NumberFieldRoot
            id="accel-ax"
            value={axG}
            step={0.1}
            onValueChange={(v) => {
              if (v !== null) setAxG(v);
            }}
          >
            <NumberFieldInput className="h-8" />
          </NumberFieldRoot>
          <label className="text-xs font-medium text-ink-secondary" htmlFor="accel-ay">
            ay (×g)
          </label>
          <NumberFieldRoot
            id="accel-ay"
            value={ayG}
            step={0.1}
            onValueChange={(v) => {
              if (v !== null) setAyG(v);
            }}
          >
            <NumberFieldInput className="h-8" />
          </NumberFieldRoot>
          <label className="text-xs font-medium text-ink-secondary" htmlFor="accel-az">
            az (×g)
          </label>
          <NumberFieldRoot
            id="accel-az"
            value={azG}
            step={0.1}
            onValueChange={(v) => {
              if (v !== null) setAzG(v);
            }}
          >
            <NumberFieldInput className="h-8" />
          </NumberFieldRoot>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-data text-[11px] text-ink-muted">
            {field === undefined
              ? "aucun champ actif"
              : `actif : (${field.ax_g} ; ${field.ay_g} ; ${field.az_g}) ×g`}
          </span>
          <Button size="sm" onClick={() => applyField(axG, ayG, azG)}>
            Appliquer
          </Button>
        </div>
      </div>

      {/* Load Form sub-card */}
      <div className="mt-2 rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary mb-2">
          <TorqueMoment size={16} />
          <Trans>Formulaire de charge</Trans>
        </h3>
        {/* Load-form tabs: 18px engineering icons per action family. */}
        <div className="flex flex-wrap gap-1 mb-2">
          {LOAD_TABS.map((tl) => (
            <button
              key={tl.id}
              type="button"
              className={`flex items-center gap-1 rounded px-1.5 py-1 text-[12px] ${tab === tl.id ? "bg-accent-tint text-accent" : "text-ink-secondary"}`}
              onClick={() => setTab(tl.id)}
            >
              <tl.icon size={18} />
              {tl.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[112px_1fr] items-center gap-x-2 gap-y-2">
          {tab === "nodal" ? (
            <>
              <label className="text-xs font-medium text-ink-secondary" htmlFor="load-node">
                <Trans>Nœud</Trans>
              </label>
              {/* v2.1.2: searchable node Combobox (NodePin + coordinates). */}
              <ComboboxRoot
                items={nodes.map((n) => n.id)}
                value={nodeId}
                onValueChange={(next: number | null) => {
                  if (next !== null) setNodeId(next);
                }}
                itemToStringValue={(id: number) => `N${id}`}
              >
                <ComboboxInput id="load-node" aria-label={t`Nœud`} className="h-8 font-data" />
                <ComboboxContent
                  renderItem={(id: number) => {
                    const node = nodes.find((n) => n.id === id);
                    return (
                      <ComboboxItem key={id} value={id}>
                        <span className="font-data flex-1">
                          N{id}
                          {node !== undefined
                            ? ` · (${node.x.toFixed(2)} ; ${node.y.toFixed(2)} ; ${node.z.toFixed(2)})`
                            : ""}
                        </span>
                      </ComboboxItem>
                    );
                  }}
                >
                  <ComboboxEmpty>Aucun nœud</ComboboxEmpty>
                </ComboboxContent>
              </ComboboxRoot>
              <label className="text-xs font-medium text-ink-secondary" htmlFor="load-fx">
                Fx (kN)
              </label>
              <NumberFieldRoot
                id="load-fx"
                value={fx}
                step={0.5}
                onValueChange={(v) => {
                  if (v !== null) setFx(v);
                }}
              >
                <NumberFieldInput className="h-8" />
              </NumberFieldRoot>
              <label className="text-xs font-medium text-ink-secondary" htmlFor="load-fy">
                Fy (kN)
              </label>
              <NumberFieldRoot
                id="load-fy"
                value={fy}
                step={0.5}
                onValueChange={(v) => {
                  if (v !== null) setFy(v);
                }}
              >
                <NumberFieldInput className="h-8" />
              </NumberFieldRoot>
              <label className="text-xs font-medium text-ink-secondary" htmlFor="load-fz">
                Fz (kN)
              </label>
              <NumberFieldRoot
                id="load-fz"
                value={fz}
                step={0.5}
                onValueChange={(v) => {
                  if (v !== null) setFz(v);
                }}
              >
                <NumberFieldInput className="h-8" />
              </NumberFieldRoot>
            </>
          ) : (
            <>
              <label className="text-xs font-medium text-ink-secondary" htmlFor="load-beam">
                <Trans>Poutre</Trans>
              </label>
              {/* v2.1.2: searchable member Combobox (BeamSegment + length). */}
              <ComboboxRoot
                items={beams.map((b) => b.id)}
                value={beamId}
                onValueChange={(next: number | null) => {
                  if (next !== null) setBeamId(next);
                }}
                itemToStringValue={(id: number) => `B${id}`}
              >
                <ComboboxInput id="load-beam" aria-label={t`Poutre`} className="h-8 font-data" />
                <ComboboxContent
                  renderItem={(id: number) => {
                    const beam = beams.find((b) => b.id === id);
                    const length =
                      beam !== undefined
                        ? memberLength(nodes, beam).toFixed(2).replace(".", ",")
                        : null;
                    return (
                      <ComboboxItem key={id} value={id}>
                        <span className="font-data flex-1">B{id}</span>
                        {length !== null ? (
                          <span className="font-data text-right text-[10px] text-ink-muted">
                            L = {length} m
                          </span>
                        ) : null}
                      </ComboboxItem>
                    );
                  }}
                >
                  <ComboboxEmpty>Aucune poutre</ComboboxEmpty>
                </ComboboxContent>
              </ComboboxRoot>
              {tab === "uniform" ? (
                <>
                  <label className="text-xs font-medium text-ink-secondary" htmlFor="load-qx">
                    qx (kN/m)
                  </label>
                  <NumberFieldRoot
                    id="load-qx"
                    value={qx}
                    step={0.5}
                    onValueChange={(v) => {
                      if (v !== null) setQx(v);
                    }}
                  >
                    <NumberFieldInput className="h-8" />
                  </NumberFieldRoot>
                  <label className="text-xs font-medium text-ink-secondary" htmlFor="load-qy">
                    qy (kN/m)
                  </label>
                  <NumberFieldRoot
                    id="load-qy"
                    value={qy}
                    step={0.5}
                    onValueChange={(v) => {
                      if (v !== null) setQy(v);
                    }}
                  >
                    <NumberFieldInput className="h-8" />
                  </NumberFieldRoot>
                  <label className="text-xs font-medium text-ink-secondary" htmlFor="load-qz">
                    qz (kN/m)
                  </label>
                  <NumberFieldRoot
                    id="load-qz"
                    value={qz}
                    step={0.5}
                    onValueChange={(v) => {
                      if (v !== null) setQz(v);
                    }}
                  >
                    <NumberFieldInput className="h-8" />
                  </NumberFieldRoot>
                </>
              ) : null}
              {tab === "trapezoid" ? (
                <>
                  <label className="text-xs font-medium text-ink-secondary" htmlFor="load-q1">
                    q1 (kN/m)
                  </label>
                  <NumberFieldRoot
                    id="load-q1"
                    value={qz}
                    step={0.5}
                    onValueChange={(v) => {
                      if (v !== null) setQz(v);
                    }}
                  >
                    <NumberFieldInput className="h-8" />
                  </NumberFieldRoot>
                  <label className="text-xs font-medium text-ink-secondary" htmlFor="load-q2">
                    q2 (kN/m)
                  </label>
                  <NumberFieldRoot
                    id="load-q2"
                    value={q2z}
                    step={0.5}
                    onValueChange={(v) => {
                      if (v !== null) setQ2z(v);
                    }}
                  >
                    <NumberFieldInput className="h-8" />
                  </NumberFieldRoot>
                </>
              ) : null}
              {tab === "point" ? (
                <>
                  <label className="text-xs font-medium text-ink-secondary" htmlFor="load-span-fz">
                    Fz (kN)
                  </label>
                  <NumberFieldRoot
                    id="load-span-fz"
                    value={fz}
                    step={0.5}
                    onValueChange={(v) => {
                      if (v !== null) setFz(v);
                    }}
                  >
                    <NumberFieldInput className="h-8" />
                  </NumberFieldRoot>
                  <label className="text-xs font-medium text-ink-secondary" htmlFor="load-ratio">
                    a/L (%)
                  </label>
                  <NumberFieldRoot
                    id="load-ratio"
                    value={ratio}
                    step={5}
                    min={0}
                    max={100}
                    onValueChange={(v) => {
                      if (v !== null) setRatio(v);
                    }}
                  >
                    <NumberFieldInput className="h-8" />
                  </NumberFieldRoot>
                </>
              ) : null}
            </>
          )}
        </div>
        <Button
          className="mt-2 w-full"
          disabled={tab === "nodal" ? nodes.length === 0 : beams.length === 0}
          onClick={add}
        >
          <Trans>Ajouter la charge</Trans>
        </Button>
      </div>

      {/* Concentrated Moments sub-card */}
      <div
        className="mt-2 rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5"
        data-testid="moments-section"
      >
        <ExpandablePanel
          open={momentsOpen}
          onOpenChange={setMomentsOpen}
          title={<Trans>Moments concentrés (Mx, My, Mz en kN·m)</Trans>}
        >
          <p className="mt-1 text-[11px] text-ink-muted">
            <Trans>
              Appliqués aux charges nodales et ponctuelles de travée du cas{" "}
              <span className="font-data">{CASES.find((c) => c.id === caseId)?.label}</span>.
            </Trans>
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {(
              [
                ["Mx", mx, setMx],
                ["My", my, setMy],
                ["Mz", mz, setMz],
              ] as const
            ).map(([label, value, setter]) => (
              <label key={label} className="flex flex-col gap-0.5 text-[10px] text-ink-muted">
                <span className="font-data">{label} (kN·m)</span>
                <NumberFieldRoot value={value} step={1} onValueChange={(v) => setter(v ?? 0)}>
                  <NumberFieldInput className="font-data h-8 w-full px-1 text-[11px]" />
                </NumberFieldRoot>
              </label>
            ))}
          </div>
        </ExpandablePanel>
      </div>

      {/* Live Force Resultants sub-card */}
      <div className="mt-2 rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary mb-2">
          <SelfWeightGravity size={16} />
          <Trans>Résultantes globales</Trans>
        </h3>
        <dl className="grid grid-cols-3 gap-2" data-testid="resultant-summary">
          {(
            [
              ["ΣFx", resultant.fx],
              ["ΣFy", resultant.fy],
              ["ΣFz", resultant.fz],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="font-data text-[10px] text-ink-muted">{label} (kN)</dt>
              <dd className="text-[15px] text-ink-primary">
                <NumberFlowValue value={value} format={{ maximumFractionDigits: 2 }} />
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Self-Weight & Equilibrium sub-card */}
      <div className="mt-2 rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5">
        <label className="flex items-center gap-2 text-[12px] text-ink-secondary">
          <Switch
            checked={selfWeight}
            onCheckedChange={(checked) => {
              if (checked !== selfWeight) toggleSelfWeight();
              void trackProductEvent("self_weight_toggled", { enabled: checked });
            }}
          />
          <SelfWeightGravity size={18} />
          <Trans>Poids propre automatique (1g −Z)</Trans>
        </label>
        {/* v1.4.0: estimated self-weight mass beside the 1g toggle. */}
        <p className="font-data mt-1 text-[11px] text-ink-muted" data-testid="self-weight-mass">
          {(() => {
            let total = 0;
            for (const b of beams) {
              const section = sections[b.section_id] as { a?: number } | undefined;
              const material = materials[b.material_id] as { rho?: number } | undefined;
              const length = memberLength(nodes, b);
              if (section == null || material == null || length <= 0) continue;
              total += (material.rho ?? 0) * (section.a ?? 0) * length;
            }
            const label =
              total >= 1000 ? `${(total / 1000).toFixed(2)} t` : `${total.toFixed(1)} kg`;
            return `Masse à vide estimée : ${label}`;
          })()}
        </p>
        {/* v2.1.2: equilibrium pill as an animated StatusBadge. */}
        <div className="mt-2 flex">
          <StatusBadge tone={reactionCountValid ? "pass" : "fail"} mono testId="equilibrium-pill">
            {reactionCountValid ? "Système équilibré" : "Appuis incomplets"}
          </StatusBadge>
        </div>
      </div>

      {/* Primary CTA: runs the worker solve and moves to Step 4. */}
      <Button
        size="lg"
        className="mt-2 w-full"
        data-testid="cta-solve"
        onClick={() => void navigate({ to: "/results" })}
      >
        <Trans>Lancer le calcul 3D & Eurocode 3 →</Trans>
      </Button>
    </BottomSheet>
  );

  const main = (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={slotRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-canvas"
        data-testid="loads-stage-slot"
      />
      <StageContent k="loads" options={{ wireframe: false }}>
        {null}
      </StageContent>
      <div className="shrink-0 overflow-hidden rounded border border-hairline bg-panel">
        <div className="max-h-40 overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-[11px] text-ink-muted">
              <tr>
                <th className="py-1 pl-2">
                  <Trans>Cas</Trans>
                </th>
                <th>
                  <Trans>Type</Trans>
                </th>
                <th>
                  <Trans>Cible</Trans>
                </th>
                <th>
                  <Trans>Direction</Trans>
                </th>
                <th>Intensité</th>
                <th />
              </tr>
            </thead>
            <tbody className="font-data">
              {loads.map((l, index) => (
                <tr key={index} className="border-t border-hairline">
                  <td className="py-1 pl-2">{l.case}</td>
                  <td>{l.kind}</td>
                  <td>
                    {l.kind === "Nodal"
                      ? `N${l.node_id}`
                      : l.kind === "PointOnSpan"
                        ? `B${l.beam_id} @ ${(l.position_ratio * 100).toFixed(0)}%`
                        : l.kind === "Trapezoid"
                          ? `B${l.beam_id}`
                          : "3D"}
                  </td>
                  <td className="font-data text-[11px] text-ink-secondary">{directionLabel(l)}</td>
                  <td>
                    {l.kind === "Trapezoid" || l.kind === "Uniform"
                      ? `${((l.q_start ?? 0) / 1000).toFixed(2)} → ${((l.q_end ?? 0) / 1000).toFixed(2)} kN/m`
                      : l.kind === "AccelerationField"
                        ? `(${l.ax_g} ; ${l.ay_g} ; ${l.az_g}) ×g`
                        : l.kind === "Thermal"
                          ? `ΔT = ${l.dt.toFixed(1)} K`
                          : `${((l.forces?.fz ?? 0) / 1000).toFixed(2)} kN`}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      aria-label={t`Supprimer la charge`}
                      className="mr-2 text-ink-muted hover:text-fea-max"
                      onClick={() => removeLoad(index)}
                    >
                      <IconTrash size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loads.length === 0 ? (
            <p className="py-2 text-[13px] text-ink-muted">
              <Trans>
                Aucune charge définie — choisissez un scénario d'accélération ou ajoutez une charge.
              </Trans>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );

  return <DesktopSplit inspector={inspector} main={main} />;
}

/**
 * EN 1991 action generators (v2.0.0): imposed (categories A-E),
 * snow (sk, altitude 15 m proxy), wind (vb) and a Thermal ΔT action —
 * all appended through the wasm `generate_env_loads_json` lane.
 * v2.1.2: the member target is a searchable Combobox (BeamSegment icon)
 * and the ΔT field a NumberField — zero raw inputs.
 * v2.3.0: beamId now synced with parent inspector state.
 */
function EnvLoadGenerators({
  onCaseSwitch,
  beams,
  beamId,
  onBeamChange,
}: {
  onCaseSwitch: (caseId: LoadCaseId, label: string) => void;
  beams: { id: number }[];
  beamId: number;
  onBeamChange: (id: number) => void;
}): React.ReactElement {
  const project = useProjectStore((st) => st.project);
  const loadProject = useProjectStore((st) => st.loadProject);
  // v2.0.2: realistic Eurocode defaults — imposed cat. B 3.0 kN/m²,
  // snow sk 0.45 kN/m² (guide values) and wind vb 26 m/s.
  const [imposedCat] = useState(2);
  const [snowSk] = useState(0.45);
  const [windVb] = useState(26);
  const [dt, setDt] = useState(30);

  const append = (
    kind: string,
    numeric: number,
    thermal: boolean,
    caseTarget?: LoadCaseId,
    caseLabel?: string,
  ): void => {
    if (thermal) {
      loadProject({
        ...project,
        structure: {
          ...project.structure,
          loads: [
            ...project.structure.loads,
            {
              case: "Permanent" as const,
              kind: "Thermal" as const,
              beam_id: beamId,
              dt,
              dt_y: 0,
              dt_z: 0,
            },
          ],
        },
      });
      void trackProductEvent("env_load_set", { type: "thermal" });
      return;
    }
    void feaClient
      .engineCall("generate_env_loads_json", kind, beamId, numeric, 3.0)
      .then((payload: unknown) => {
        const loads = typeof payload === "string" ? (JSON.parse(payload) as LoadDataRow[]) : [];
        loadProject({
          ...project,
          structure: { ...project.structure, loads: [...project.structure.loads, ...loads] },
        });
        if (caseTarget !== undefined && caseLabel !== undefined) {
          onCaseSwitch(caseTarget, caseLabel);
        }
        void trackProductEvent("env_load_set", { type: kind });
      })
      .catch(() => undefined);
  };

  return (
    <div
      className="mb-3 rounded-[8px] border border-hairline p-3 text-xs"
      aria-label="Générateurs EN 1991"
    >
      <p className="mb-2 font-semibold">Générateurs EN 1991 & thermique</p>
      <div className="flex flex-wrap items-center gap-2">
        {/* v2.1.2: member target = searchable Combobox (was a raw select).
            v2.3.0: beamId now controlled from parent inspector. */}
        <ComboboxRoot
          items={beams.map((b) => b.id)}
          value={beamId}
          onValueChange={(next: number | null) => {
            if (next !== null) onBeamChange(next);
          }}
          itemToStringValue={(id: number) => `B${id}`}
        >
          <ComboboxInput
            aria-label="Membre cible"
            className="h-7 w-24 font-data"
            placeholder="B…"
          />
          <ComboboxContent
            renderItem={(id: number) => (
              <ComboboxItem key={id} value={id}>
                <span className="font-data flex-1">B{id}</span>
              </ComboboxItem>
            )}
          >
            <ComboboxEmpty>Aucune poutre</ComboboxEmpty>
          </ComboboxContent>
        </ComboboxRoot>
        <button
          type="button"
          onClick={() => append("imposed", imposedCat, false, "Variable", "Q")}
          className="rounded bg-panel-subtle px-2 py-1 hover:bg-accent-tint hover:text-accent"
          data-testid="env-imposed"
        >
          Imposée cat. {String.fromCharCode(64 + imposedCat)} (
          {imposedCat === 2 ? "3,0" : imposedCat} kN/m²)
        </button>
        <button
          type="button"
          onClick={() => append("snow", snowSk, false, "Snow", "S")}
          className="rounded bg-panel-subtle px-2 py-1 hover:bg-accent-tint hover:text-accent"
          data-testid="env-snow"
        >
          Neige sk = {snowSk.toFixed(2).replace(".", ",")} kN/m²
        </button>
        <button
          type="button"
          onClick={() => append("wind", windVb, false, "Wind", "W")}
          className="rounded bg-panel-subtle px-2 py-1 hover:bg-accent-tint hover:text-accent"
          data-testid="env-wind"
        >
          Vent vb = {windVb.toFixed(0)} m/s
        </button>
        <NumberFieldRoot
          value={dt}
          step={5}
          min={-100}
          max={200}
          onValueChange={(v) => setDt(v ?? 0)}
        >
          <NumberFieldInput aria-label="ΔT" className="font-data h-7 w-16 px-1 text-[11px]" />
        </NumberFieldRoot>
        <button
          type="button"
          onClick={() => append("thermal", dt, true)}
          className="flex items-center gap-1 rounded bg-panel-subtle px-2 py-1"
        >
          <ThermalLoadIcon size={16} />
          ΔT {dt} K
        </button>
      </div>
    </div>
  );
}

/**
 * M10.5 — Step 3 "Cas de charges & Combinaisons EN 1990" manager
 * (`data-testid="load-case-manager"`): add / rename elementary cases
 * (`G1`, `Q1`, `Q2`, `W+`, `S`, …) with their EN 1990 Annex A1
 * ψ0/ψ1/ψ2 factors, and 1-click "Générer combinaisons ELU/ELS"
 * (expressions 6.10 / 6.10a+6.10b via `build_combinations_v2`).
 */
const CATEGORY_LABELS: Record<string, string> = {
  Permanent: "Permanente (G)",
  Variable: "Exploitation (Q)",
  Wind: "Vent (W)",
  Snow: "Neige (S)",
  Accidental: "Accidentelle (Acc)",
  Seismic: "Sismique",
  Temperature: "Thermique",
};

const CATEGORY_PSI: Record<string, [number, number, number]> = {
  Permanent: [1.0, 1.0, 1.0],
  Variable: [0.7, 0.5, 0.3],
  Wind: [0.6, 0.2, 0.0],
  Snow: [0.5, 0.2, 0.0],
  Accidental: [1.0, 1.0, 1.0],
  Seismic: [1.0, 1.0, 1.0],
  Temperature: [1.0, 1.0, 1.0],
};

interface LoadCaseRow {
  id: number;
  code: string;
  category: string;
  psi0: number;
  psi1: number;
  psi2: number;
  include_self_weight: boolean;
}

/** Canonical schema-v2 seed (mirrors `rdm_model::canonical_load_cases`). */
const CANONICAL_CASES: LoadCaseRow[] = [
  {
    id: 1,
    code: "G",
    category: "Permanent",
    psi0: 1.0,
    psi1: 1.0,
    psi2: 1.0,
    include_self_weight: true,
  },
  {
    id: 2,
    code: "Q",
    category: "Variable",
    psi0: 0.7,
    psi1: 0.5,
    psi2: 0.3,
    include_self_weight: false,
  },
  {
    id: 3,
    code: "W",
    category: "Wind",
    psi0: 0.6,
    psi1: 0.2,
    psi2: 0.0,
    include_self_weight: false,
  },
  {
    id: 4,
    code: "S",
    category: "Snow",
    psi0: 0.5,
    psi1: 0.2,
    psi2: 0.0,
    include_self_weight: false,
  },
  {
    id: 5,
    code: "Acc",
    category: "Accidental",
    psi0: 1.0,
    psi1: 1.0,
    psi2: 1.0,
    include_self_weight: false,
  },
];

function LoadCaseManager(): React.ReactElement {
  const loadCases = useProjectStore((s) => s.project.structure.load_cases);
  const setLoadCases = useProjectStore((s) => s.setLoadCases);
  const project = useProjectStore((s) => s.project);
  const [combos, setCombos] = useState<{ kind: string; label: string }[] | null>(null);
  const [newCode, setNewCode] = useState("Q2");
  const [newCategory, setNewCategory] = useState("Variable");

  const rows: LoadCaseRow[] =
    loadCases && loadCases.length > 0 ? (loadCases as LoadCaseRow[]) : CANONICAL_CASES;

  const commit = (next: LoadCaseRow[]) => {
    setLoadCases(next);
    setCombos(null);
  };

  const addCase = () => {
    const code = newCode.trim();
    if (code === "") {
      return;
    }
    const nextId = Math.max(...rows.map((r) => r.id), 0) + 1;
    const [psi0, psi1, psi2] = CATEGORY_PSI[newCategory] ?? [1.0, 1.0, 1.0];
    commit([
      ...rows,
      { id: nextId, code, category: newCategory, psi0, psi1, psi2, include_self_weight: false },
    ]);
    void trackProductEvent("load_case_added", { case: code });
  };

  const generate = () => {
    void feaClient
      .engineCall("build_combinations_v2_json", project)
      .then((payload) => {
        const raw = payload as [string, string, [string, number][]][];
        setCombos(raw.map((entry) => ({ kind: entry[0], label: entry[1] })));
        void trackProductEvent("combinations_generated", { count: raw.length });
      })
      .catch(() => setCombos(null));
  };

  return (
    <div
      className="rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5"
      data-testid="load-case-manager"
    >
      <ExpandablePanel
        testId="load-case-manager-panel"
        title={
          <Trans>
            <span className="inline-flex items-center gap-1.5">
              <IconLoad size={16} />
              Cas de charges & combinaisons EN 1990
            </span>
          </Trans>
        }
      >
        <p className="mt-1 text-[11px] text-ink-muted">
          <Trans>
            Cas élémentaires et facteurs ψ (Annexe A1). Un cas ajouté ici alimente les combinaisons
            6.10 / 6.10a+6.10b et les enveloppes Min/Max.
          </Trans>
        </p>
        <div className="mt-2 max-h-44 overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="text-left text-[10px] text-ink-muted">
              <tr>
                <th className="py-1">
                  <Trans>Code</Trans>
                </th>
                <th className="py-1">{t`Catégorie`}</th>
                <th className="py-1 font-data">ψ0</th>
                <th className="py-1 font-data">ψ1</th>
                <th className="py-1 font-data">ψ2</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody className="font-data">
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-hairline">
                  <td className="py-1 pr-1">
                    <Input
                      value={row.code}
                      onChange={(e) => {
                        const code = e.target.value;
                        commit(rows.map((r) => (r.id === row.id ? { ...r, code } : r)));
                      }}
                      aria-label={`code-${row.id}`}
                      className="h-7 w-16 px-1 text-[12px]"
                    />
                  </td>
                  <td className="py-1 pr-1 text-[11px] text-ink-secondary">
                    {CATEGORY_LABELS[row.category] ?? row.category}
                  </td>
                  {[row.psi0, row.psi1, row.psi2].map((psi, i) => (
                    <td key={i} className="py-1 pr-1 text-[11px] text-ink-primary">
                      {psi.toFixed(1).replace(".", ",")}
                    </td>
                  ))}
                  <td className="py-1">
                    <button
                      type="button"
                      aria-label={`Supprimer le cas ${row.code}`}
                      data-testid={`remove-case-${row.id}`}
                      className="text-ink-muted hover:text-fea-max disabled:opacity-40"
                      disabled={rows.length <= 1}
                      onClick={() => commit(rows.filter((r) => r.id !== row.id))}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <Input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            aria-label="new-case-code"
            data-testid="new-case-code"
            className="h-7 w-16 px-1 text-[12px]"
          />
          <SelectRoot
            value={newCategory}
            onValueChange={(next) => {
              if (next !== null) setNewCategory(next);
            }}
          >
            <SelectTrigger
              aria-label={t`Catégorie du nouveau cas`}
              className="h-7 gap-1 text-[12px]"
              data-testid="new-case-category"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRoot>
          <Button
            variant="outline"
            size="sm"
            className="h-7 shrink-0 px-2 text-[11px]"
            data-testid="add-load-case"
            onClick={addCase}
          >
            <Trans>Ajouter le cas</Trans>
          </Button>
        </div>
        <Button
          className="mt-2 w-full"
          size="sm"
          data-testid="generate-combinations"
          onClick={generate}
        >
          <Trans>Générer combinaisons ELU/ELS</Trans>
        </Button>
        {combos !== null ? (
          <ul
            className="mt-2 max-h-32 space-y-0.5 overflow-auto"
            data-testid="generated-combinations"
          >
            {combos.map((combo, i) => (
              <li
                key={`${combo.kind}:${i}`}
                className="font-data flex items-center gap-1.5 text-[11px] text-ink-secondary"
              >
                <span
                  className={`rounded-[2px] px-1 py-0 text-[10px] ${
                    combo.kind === "ULS"
                      ? "bg-accent-tint text-accent"
                      : "bg-panel-subtle text-ink-primary"
                  }`}
                >
                  {combo.kind}
                </span>
                <span className="truncate">{combo.label}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </ExpandablePanel>
    </div>
  );
}
