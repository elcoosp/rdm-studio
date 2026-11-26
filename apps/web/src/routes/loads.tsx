import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Trans } from "@lingui/react/macro";
import { toast } from "sonner";
import { IconTrash } from "@/components/icons";
import { NumberFlowValue } from "@/components/NumberFlowValue";
import { BottomSheet } from "@/components/BottomSheet";
import { DesktopSplit } from "@/components/ui/resizable";
import {
  NodalPointLoad,
  UniformBeamLoad,
  TrapezoidalLoad,
  SpanPointLoad,
  SelfWeightGravity,
} from "@/components/icons/EngineeringIcons";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { NumberFieldRoot, NumberFieldInput } from "@/components/ui/number-field";
import { StageContent, useStageSlot } from "@/state/stageStore";
import { feaClient } from "@/wasmBridge/workerClient";
import type { LoadData as LoadDataRow } from "@/state/projectStore";
import {
  useProjectStore,
  type LoadCaseId,
  type LoadData,
  type NodeData,
} from "@/state/projectStore";

export const Route = createFileRoute("/loads")({
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

/**
 * Step 3 (DESIGN.md §4, mockups tape_3, v1.3.0 RDM 7 parity): locked `md+`
 * workstation — 320px LEFT inspector (EN 1990 case tabs, g-acceleration
 * quick scenarios plus the `(ax, ay, az)` form, 3-axis nodal and beam load
 * forms in the 2-column key-value grid, live force resultants, undoable
 * clear) beside the 3D viewport with crimson load arrows. Phone: the
 * inspector becomes the Vaul drawer.
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

  const [caseId, setCaseId] = useState<LoadCaseId>("Permanent");
  const [tab, setTab] = useState<LoadTab>("nodal");
  const [nodeId, setNodeId] = useState<number>(nodes[0]?.id ?? 1);
  const [beamId, setBeamId] = useState<number>(beams[0]?.id ?? 1);
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
      } else if (l.kind === "Trapezoid") {
        const length = memberLength(
          nodes,
          beams.find((b) => b.id === l.beam_id) ?? { n1: 0, n2: 0 },
        );
        const norm = Math.hypot(l.direction.x, l.direction.y, l.direction.z) || 1;
        const total = ((l.q_start + l.q_end) / 2) * length;
        fxSum += (total * l.direction.x) / norm;
        fySum += (total * l.direction.y) / norm;
        fzSum += (total * l.direction.z) / norm;
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
        // Pure moment load: zero forces, non-zero Mx/My/Mz.
        addNodalLoad(nodeId, 0, caseId, 0, 0, moments);
      }
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
      <div className="flex items-center justify-between gap-2">
        <span className="font-data text-[11px] text-ink-muted">
          {loads.length} charge(s) définie(s)
        </span>
        <button
          type="button"
          className="shrink-0 rounded border border-hairline px-2 py-0.5 text-[11px] text-ink-secondary hover:border-fea-max hover:text-fea-max disabled:opacity-40"
          data-testid="clear-loads"
          disabled={loads.length === 0}
          onClick={clearLoads}
        >
          <Trans>Vider les charges</Trans>
        </button>
      </div>
      {/* G | Q | W | Acc tabs with the shared layoutId glider (§8.6). */}
      <div className="flex items-center gap-1 border-b border-hairline" data-testid="case-tabs">
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

      {/* v2.0.1: EN 1991 generators + thermal action, wired to
          generate_env_loads_json — docked below the EN 1990 case tabs. */}
      <EnvLoadGenerators />

      {/* g-acceleration quick scenarios (RDM 7 parity). */}
      <section className="border-t border-hairline pt-3" data-testid="accel-field">
        <h3 className="text-xs font-medium text-ink-secondary">Champs d'accélération (g)</h3>
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
      </section>

      <div className="flex flex-wrap gap-1">
        {LOAD_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`flex items-center gap-1 rounded px-1.5 py-1 text-[12px] ${tab === t.id ? "bg-accent-tint text-accent" : "text-ink-secondary"}`}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <section className="border-t border-hairline pt-3">
        {tab === "nodal" ? (
          <div className="grid grid-cols-[112px_1fr] items-center gap-x-2 gap-y-2">
            <label className="text-xs font-medium text-ink-secondary" htmlFor="load-node">
              <Trans>Nœud</Trans>
            </label>
            <select
              id="load-node"
              className="font-data h-8 w-full rounded-[4px] border border-hairline bg-panel px-2 text-[13px]"
              value={nodeId}
              onChange={(e) => setNodeId(Number(e.currentTarget.value))}
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  N{n.id}
                </option>
              ))}
            </select>
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
          </div>
        ) : (
          <div className="grid grid-cols-[112px_1fr] items-center gap-x-2 gap-y-2">
            <label className="text-xs font-medium text-ink-secondary" htmlFor="load-beam">
              <Trans>Poutre</Trans>
            </label>
            <select
              id="load-beam"
              className="font-data h-8 w-full rounded-[4px] border border-hairline bg-panel px-2 text-[13px]"
              value={beamId}
              onChange={(e) => setBeamId(Number(e.currentTarget.value))}
            >
              {beams.map((b) => (
                <option key={b.id} value={b.id}>
                  B{b.id}
                </option>
              ))}
            </select>
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
          </div>
        )}
        <Button
          className="mt-2 w-full"
          disabled={tab === "nodal" ? nodes.length === 0 : beams.length === 0}
          onClick={add}
        >
          <Trans>Ajouter la charge</Trans>
        </Button>
      </section>

      {/* v1.6.0: collapsible Moments concentrés (Mx, My, Mz) section. */}
      <details
        className="border-t border-hairline pt-3"
        data-testid="moments-section"
        open={momentsOpen}
        onToggle={(e) => setMomentsOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-xs font-medium text-ink-secondary">
          <Trans>Moments concentrés (Mx, My, Mz en kN·m)</Trans>
        </summary>
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
      </details>

      {/* Live force resultants — rolling tabular digits (§8.1). */}
      <dl
        className="grid grid-cols-3 gap-2 border-t border-hairline pt-3"
        data-testid="resultant-summary"
      >
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

      <div className="border-t border-hairline pt-3">
        <label className="flex items-center gap-2 text-[12px] text-ink-secondary">
          <Switch
            checked={selfWeight}
            onCheckedChange={(checked) => {
              if (checked !== selfWeight) toggleSelfWeight();
            }}
          />
          <SelfWeightGravity size={14} />
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
        {/* v1.4.0: viewport equilibrium status pill (mockups tape_3). */}
        <p
          className={`font-data mt-2 self-start rounded-full border px-2 py-0.5 text-[11px] ${
            reactionCountValid
              ? "border-pass-border bg-pass-bg text-pass-text"
              : "border-fail-border bg-fail-bg text-fail-text"
          }`}
          data-testid="equilibrium-pill"
        >
          {reactionCountValid ? "Système équilibré" : "Appuis incomplets"}
        </p>
      </div>

      {/* Primary CTA: runs the worker solve and moves to Step 4. */}
      <Button
        size="lg"
        className="w-full"
        data-testid="cta-solve"
        onClick={() => void navigate({ to: "/results" })}
      >
        <Trans>Lancer le calcul 3D & Eurocode 3 →</Trans>
      </Button>
    </BottomSheet>
  );

  const main = (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-3">
      <div
        ref={slotRef}
        className="relative min-h-0 flex-1 overflow-hidden rounded-panel border border-hairline bg-panel"
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
                  <td>
                    {l.kind === "Trapezoid"
                      ? `${(l.q_start / 1000).toFixed(2)} → ${(l.q_end / 1000).toFixed(2)} kN/m`
                      : l.kind === "AccelerationField"
                        ? `(${l.ax_g} ; ${l.ay_g} ; ${l.az_g}) ×g`
                        : l.kind === "Thermal"
                          ? `ΔT = ${l.dt.toFixed(1)} K`
                          : `${(l.forces.fz / 1000).toFixed(2)} kN`}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      aria-label="remove load"
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
 */
function EnvLoadGenerators(): React.ReactElement {
  const project = useProjectStore((st) => st.project);
  const loadProject = useProjectStore((st) => st.loadProject);
  const beams = project.structure.beams;
  const [beamId, setBeamId] = useState(beams[0]?.id ?? 0);
  const [value] = useState(3);
  const [dt, setDt] = useState(30);

  const append = (kind: string, numeric: number, thermal: boolean): void => {
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
      return;
    }
    void feaClient
      .engineCall("generate_env_loads_json", kind, beamId, numeric, 3.0)
      .then((payload: unknown) => {
        const loads = payload as LoadDataRow[];
        loadProject({
          ...project,
          structure: { ...project.structure, loads: [...project.structure.loads, ...loads] },
        });
      })
      .catch(() => undefined);
  };

  return (
    <div
      className="mb-3 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700"
      aria-label="Générateurs EN 1991"
    >
      <p className="mb-2 font-semibold">Générateurs EN 1991 & thermique</p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={beamId}
          onChange={(e) => setBeamId(Number(e.target.value))}
          aria-label="Membre cible"
          className="rounded border border-slate-300 bg-transparent px-1 dark:border-slate-600"
        >
          {beams.map((b) => (
            <option key={b.id} value={b.id}>
              B{b.id}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => append("imposed", value, false)}
          className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800"
        >
          Imposée cat. {Math.max(1, Math.min(5, Math.round(value)))}
        </button>
        <button
          type="button"
          onClick={() => append("snow", value, false)}
          className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800"
        >
          Neige sk = {value.toFixed(1)} kN/m²
        </button>
        <button
          type="button"
          onClick={() => append("wind", value, false)}
          className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800"
        >
          Vent vb = {value.toFixed(0)} m/s
        </button>
        <input
          type="number"
          value={dt}
          onChange={(e) => setDt(Number(e.target.value))}
          aria-label="ΔT"
          className="w-16 rounded border border-slate-300 bg-transparent px-1 dark:border-slate-600"
        />
        <button
          type="button"
          onClick={() => append("thermal", dt, true)}
          className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800"
        >
          ΔT {dt} K
        </button>
      </div>
    </div>
  );
}
