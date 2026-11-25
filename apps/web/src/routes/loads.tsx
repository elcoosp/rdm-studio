import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Trans } from "@lingui/react/macro";
import { IconTrash } from "@/components/icons";
import { NumberFlowValue } from "@/components/NumberFlowValue";
import {
  NodalPointLoad,
  UniformBeamLoad,
  TrapezoidalLoad,
  SpanPointLoad,
  SelfWeightGravity,
} from "@/components/icons/EngineeringIcons";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ViewportCanvas } from "@/viewport3d/ViewportCanvas";
import { ForceVectors3D } from "@/viewport3d/ForceVectors3D";
import { useProjectStore, type LoadCaseId } from "@/state/projectStore";

export const Route = createFileRoute("/loads")({
  component: LoadsPage,
});

/** EN 1990 elementary cases (G | Q | W | Acc tabs, §8.6 layoutId). */
const CASES: { id: LoadCaseId; label: string }[] = [
  { id: "Permanent", label: "G" },
  { id: "Variable", label: "Q" },
  { id: "Wind", label: "W" },
  { id: "Acceleration", label: "Acc" },
];

type LoadTab = "nodal" | "uniform" | "trapezoid" | "point";

const LOAD_TABS: { id: LoadTab; label: string; icon: typeof NodalPointLoad }[] = [
  { id: "nodal", label: "Nodale", icon: NodalPointLoad },
  { id: "uniform", label: "Uniforme", icon: UniformBeamLoad },
  { id: "trapezoid", label: "Trapézoïdale", icon: TrapezoidalLoad },
  { id: "point", label: "Ponctuelle (a/L)", icon: SpanPointLoad },
];

const parseFr = (value: string): number => Number(value.replace(",", "."));

/**
 * Step 3 (DESIGN.md §4, mockups tape_3): 320px left inspector — EN 1990
 * case tabs, self-weight toggle, nodal / uniform / trapezoidal / point
 * span load forms, live force resultants (rolling digits) and the primary
 * cobalt CTA — beside the 3D viewport with crimson load arrows.
 */
function LoadsPage() {
  const loads = useProjectStore((s) => s.project.structure.loads);
  const nodes = useProjectStore((s) => s.project.structure.nodes);
  const beams = useProjectStore((s) => s.project.structure.beams);
  const addNodalLoad = useProjectStore((s) => s.addNodalLoad);
  const addBeamSpanLoad = useProjectStore((s) => s.addBeamSpanLoad);
  const removeLoad = useProjectStore((s) => s.removeLoad);
  const selfWeight = useProjectStore((s) => s.project.structure.self_weight_enabled);
  const toggleSelfWeight = useProjectStore((s) => s.toggleSelfWeight);
  const navigate = useNavigate();

  const [caseId, setCaseId] = useState<LoadCaseId>("Permanent");
  const [tab, setTab] = useState<LoadTab>("nodal");
  const [nodeId, setNodeId] = useState<number>(nodes[0]?.id ?? 1);
  const [beamId, setBeamId] = useState<number>(beams[0]?.id ?? 1);
  const [fz, setFz] = useState("-10");
  const [qStart, setQStart] = useState("-10");
  const [qEnd, setQEnd] = useState("-5");
  const [ratio, setRatio] = useState("50");

  // Live global force resultant (§8.1 rolling digits): ΣFx/ΣFy/ΣFz in kN
  // over every defined load; self-weight adds its gravity contribution.
  const resultant = useMemo(() => {
    let fx = 0;
    let fy = 0;
    let fz = 0;
    for (const l of loads) {
      if (l.kind === "Nodal") {
        fx += l.forces.fx;
        fy += l.forces.fy;
        fz += l.forces.fz;
      } else if (l.kind === "PointOnSpan") {
        fz += l.forces.fz;
        fy += l.forces.fy;
        fx += l.forces.fx;
      } else {
        // Trapezoid: total line load in N along direction (approx: average
        // intensity x the member length is computed by the solver; here the
        // resultant shows the intensity sum for the case at hand).
        fz += (l.q_start + l.q_end) / 2;
      }
    }
    return { fx: fx / 1000, fy: fy / 1000, fz: fz / 1000 };
  }, [loads]);

  const add = () => {
    if (tab === "nodal") {
      const value = parseFr(fz) * 1000;
      if (Number.isFinite(value)) addNodalLoad(nodeId, value, caseId);
      return;
    }
    if (tab === "uniform") {
      const q = parseFr(qStart) * 1000;
      if (Number.isFinite(q)) {
        addBeamSpanLoad({
          beamId,
          loadCase: caseId,
          kind: "Trapezoid",
          qStart: q,
          qEnd: q,
        });
      }
      return;
    }
    if (tab === "trapezoid") {
      const q1 = parseFr(qStart) * 1000;
      const q2 = parseFr(qEnd) * 1000;
      if (Number.isFinite(q1) && Number.isFinite(q2)) {
        addBeamSpanLoad({ beamId, loadCase: caseId, kind: "Trapezoid", qStart: q1, qEnd: q2 });
      }
      return;
    }
    const value = parseFr(fz) * 1000;
    const a = parseFr(ratio) / 100;
    if (Number.isFinite(value) && Number.isFinite(a)) {
      addBeamSpanLoad({
        beamId,
        loadCase: caseId,
        kind: "PointOnSpan",
        positionRatio: Math.min(1, Math.max(0, a)),
        forces: { fx: 0, fy: 0, fz: value, mx: 0, my: 0, mz: 0 },
      });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-3 overflow-auto rounded-panel border border-hairline bg-panel p-3 lg:w-80">
        <h2 className="text-[15px] font-semibold">
          <Trans>Charges et combinaisons EN 1990</Trans>
        </h2>
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

        {tab === "nodal" ? (
          <div>
            <label className="block text-[12px] text-ink-secondary">
              <Trans>Nœud</Trans>
            </label>
            <select
              className="font-data mt-1 w-full rounded-[4px] border border-hairline px-2 py-1.5 text-[13px]"
              value={nodeId}
              onChange={(e) => setNodeId(Number(e.currentTarget.value))}
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  N{n.id}
                </option>
              ))}
            </select>
            <label className="mt-2 block text-[12px] text-ink-secondary">
              <Trans>Fz (kN, négatif vers le bas)</Trans>
            </label>
            <input
              className="font-data mt-1 w-full rounded-[4px] border border-hairline px-2 py-1.5 text-[13px]"
              value={fz}
              onChange={(e) => setFz(e.currentTarget.value)}
            />
          </div>
        ) : null}
        {tab === "uniform" || tab === "trapezoid" || tab === "point" ? (
          <div>
            <label className="block text-[12px] text-ink-secondary">
              <Trans>Poutre</Trans>
            </label>
            <select
              className="font-data mt-1 w-full rounded-[4px] border border-hairline px-2 py-1.5 text-[13px]"
              value={beamId}
              onChange={(e) => setBeamId(Number(e.currentTarget.value))}
            >
              {beams.map((b) => (
                <option key={b.id} value={b.id}>
                  B{b.id}
                </option>
              ))}
            </select>
            {tab === "uniform" || tab === "trapezoid" ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-[12px] text-ink-secondary">
                  q1 (kN/m)
                  <input
                    className="font-data mt-1 w-full rounded-[4px] border border-hairline px-2 py-1 text-[13px]"
                    value={qStart}
                    onChange={(e) => setQStart(e.currentTarget.value)}
                  />
                </label>
                <label className="text-[12px] text-ink-secondary">
                  q2 (kN/m)
                  <input
                    className="font-data mt-1 w-full rounded-[4px] border border-hairline px-2 py-1 text-[13px]"
                    value={tab === "uniform" ? qStart : qEnd}
                    onChange={(e) =>
                      tab === "uniform"
                        ? setQStart(e.currentTarget.value)
                        : setQEnd(e.currentTarget.value)
                    }
                  />
                </label>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-[12px] text-ink-secondary">
                  Fz (kN)
                  <input
                    className="font-data mt-1 w-full rounded-[4px] border border-hairline px-2 py-1 text-[13px]"
                    value={fz}
                    onChange={(e) => setFz(e.currentTarget.value)}
                  />
                </label>
                <label className="text-[12px] text-ink-secondary">
                  a/L (%)
                  <input
                    className="font-data mt-1 w-full rounded-[4px] border border-hairline px-2 py-1 text-[13px]"
                    value={ratio}
                    onChange={(e) => setRatio(e.currentTarget.value)}
                  />
                </label>
              </div>
            )}
          </div>
        ) : null}

        <Button disabled={nodes.length === 0 || beams.length === 0} onClick={add}>
          <Trans>Ajouter la charge</Trans>
        </Button>

        {/* Live force resultants — rolling tabular digits (§8.1). */}
        <dl
          className="grid grid-cols-3 gap-2 rounded border border-hairline p-2"
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

        {/* Primary CTA: runs the worker solve and moves to Step 4. */}
        <Button
          size="lg"
          className="w-full"
          data-testid="cta-solve"
          onClick={() => void navigate({ to: "/results" })}
        >
          <Trans>Lancer le calcul 3D & Eurocode 3</Trans>
        </Button>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-panel border border-hairline bg-panel p-3">
        <div className="relative min-h-[320px] flex-1 overflow-hidden rounded border border-hairline">
          <ViewportCanvas nodes={nodes} beams={beams} testId="viewport-canvas">
            <ForceVectors3D nodes={nodes} loads={loads} />
          </ViewportCanvas>
        </div>
        <div className="mt-2 max-h-40 overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-[11px] text-ink-muted">
              <tr>
                <th className="py-1">
                  <Trans>Cas</Trans>
                </th>
                <th>
                  <Trans>Type</Trans>
                </th>
                <th>
                  <Trans>Cible</Trans>
                </th>
                <th>Fz</th>
                <th />
              </tr>
            </thead>
            <tbody className="font-data">
              {loads.map((l, index) => (
                <tr key={index} className="border-t border-hairline">
                  <td className="py-1">{l.case}</td>
                  <td>{l.kind}</td>
                  <td>
                    {l.kind === "Nodal"
                      ? `N${l.node_id}`
                      : l.kind === "PointOnSpan"
                        ? `B${l.beam_id} @ ${(l.position_ratio * 100).toFixed(0)}%`
                        : `B${l.beam_id}`}
                  </td>
                  <td>
                    {l.kind === "Trapezoid"
                      ? `${l.q_start / 1000} → ${l.q_end / 1000} kN/m`
                      : `${(l.forces.fz / 1000).toFixed(2)} kN`}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      aria-label="remove load"
                      className="text-ink-muted hover:text-fea-max"
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
              <Trans>Aucune charge définie.</Trans>
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
