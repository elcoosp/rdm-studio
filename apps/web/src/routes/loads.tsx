import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Trans } from "@lingui/react/macro";
import { toast } from "sonner";
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
import { DesktopSplit } from "@/components/ui/resizable";
import { ViewportCanvas } from "@/viewport3d/ViewportCanvas";
import { ForceVectors3D } from "@/viewport3d/ForceVectors3D";
import {
  useProjectStore,
  type LoadCaseId,
  type LoadData,
  type NodeData,
} from "@/state/projectStore";

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
 * Step 3 (DESIGN.md §4, mockups tape_3, v1.3.0 RDM 7 parity): 320px left
 * inspector — EN 1990 case tabs, g-acceleration quick scenarios plus the
 * `(ax, ay, az)` form, 3-axis nodal and beam load forms, live force
 * resultants (rolling digits), undoable clear — beside the 3D viewport
 * with crimson load arrows.
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
  const [fx, setFx] = useState("0");
  const [fy, setFy] = useState("0");
  const [fz, setFz] = useState("-10");
  const [qx, setQx] = useState("0");
  const [qy, setQy] = useState("0");
  const [qz, setQz] = useState("-10");
  const [q2z, setQ2z] = useState("-5");
  const [ratio, setRatio] = useState("50");
  const [axG, setAxG] = useState("0");
  const [ayG, setAyG] = useState("0");
  const [azG, setAzG] = useState("0");

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
    if (tab === "nodal") {
      const px = parseFr(fx) * 1000;
      const py = parseFr(fy) * 1000;
      const pz = parseFr(fz) * 1000;
      if (px !== 0 || py !== 0 || pz !== 0) {
        addNodalLoad(nodeId, pz, caseId, px, py);
      }
      return;
    }
    if (tab === "uniform") {
      // 3-axis uniform: magnitude + unit direction from (qx, qy, qz).
      const gx = parseFr(qx);
      const gy = parseFr(qy);
      const gz = parseFr(qz);
      const magnitude = Math.hypot(gx, gy, gz);
      if (magnitude > 0) {
        addBeamSpanLoad({
          beamId,
          loadCase: caseId,
          kind: "Trapezoid",
          qStart: magnitude * 1000,
          qEnd: magnitude * 1000,
          direction: { x: gx / magnitude, y: gy / magnitude, z: gz / magnitude },
        });
      }
      return;
    }
    if (tab === "trapezoid") {
      const q1 = parseFr(qz) * 1000;
      const q2 = parseFr(q2z) * 1000;
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
    const value = parseFr(fz) * 1000;
    const a = parseFr(ratio) / 100;
    if (value !== 0 && Number.isFinite(a)) {
      addBeamSpanLoad({
        beamId,
        loadCase: caseId,
        kind: "PointOnSpan",
        positionRatio: Math.min(1, Math.max(0, a)),
        forces: { fx: 0, fy: 0, fz: value, mx: 0, my: 0, mz: 0 },
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 lg:flex-row">
      {/* v1.4.0: drag-resizable inspector/viewport split on desktop. */}
      <DesktopSplit
        inspector={
          <aside className="flex h-full w-full shrink-0 flex-col gap-3 overflow-auto rounded-panel border border-hairline bg-panel p-3 lg:w-80">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold">
                <Trans>Charges et combinaisons EN 1990</Trans>
              </h2>
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
            <div
              className="flex items-center gap-1 border-b border-hairline"
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

            {/* g-acceleration quick scenarios (RDM 7 parity). */}
            <section className="rounded-[4px] border border-hairline p-2" data-testid="accel-field">
              <h3 className="text-[13px] font-semibold text-ink-secondary">
                Champs d'accélération (g)
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
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {(
                  [
                    ["ax (×g)", axG, setAxG],
                    ["ay (×g)", ayG, setAyG],
                    ["az (×g)", azG, setAzG],
                  ] as const
                ).map(([label, value, setter]) => (
                  <label key={label} className="text-[11px] text-ink-muted">
                    {label}
                    <input
                      className="font-data mt-0.5 w-full rounded-[4px] border border-hairline px-1.5 py-1 text-[12px]"
                      value={value}
                      onChange={(e) => setter(e.currentTarget.value)}
                    />
                  </label>
                ))}
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="font-data text-[11px] text-ink-muted">
                  {field === undefined
                    ? "aucun champ actif"
                    : `actif : (${field.ax_g} ; ${field.ay_g} ; ${field.az_g}) ×g`}
                </span>
                <Button
                  size="sm"
                  onClick={() => applyField(parseFr(axG), parseFr(ayG), parseFr(azG))}
                >
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

            {tab === "nodal" ? (
              <div className="space-y-2">
                <label className="block text-[12px] text-ink-secondary">
                  <Trans>Nœud</Trans>
                  <select
                    className="font-data mt-1 block w-full rounded-[4px] border border-hairline px-2 py-1.5 text-[13px]"
                    value={nodeId}
                    onChange={(e) => setNodeId(Number(e.currentTarget.value))}
                  >
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        N{n.id}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ["Fx (kN)", fx, setFx],
                      ["Fy (kN)", fy, setFy],
                      ["Fz (kN)", fz, setFz],
                    ] as const
                  ).map(([label, value, setter]) => (
                    <label key={label} className="text-[11px] text-ink-muted">
                      {label}
                      <input
                        className="font-data mt-0.5 w-full rounded-[4px] border border-hairline px-1.5 py-1 text-[12px]"
                        value={value}
                        onChange={(e) => setter(e.currentTarget.value)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            {tab === "uniform" || tab === "trapezoid" || tab === "point" ? (
              <div className="space-y-2">
                <label className="block text-[12px] text-ink-secondary">
                  <Trans>Poutre</Trans>
                  <select
                    className="font-data mt-1 block w-full rounded-[4px] border border-hairline px-2 py-1.5 text-[13px]"
                    value={beamId}
                    onChange={(e) => setBeamId(Number(e.currentTarget.value))}
                  >
                    {beams.map((b) => (
                      <option key={b.id} value={b.id}>
                        B{b.id}
                      </option>
                    ))}
                  </select>
                </label>
                {tab === "uniform" ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        ["qx (kN/m)", qx, setQx],
                        ["qy (kN/m)", qy, setQy],
                        ["qz (kN/m)", qz, setQz],
                      ] as const
                    ).map(([label, value, setter]) => (
                      <label key={label} className="text-[11px] text-ink-muted">
                        {label}
                        <input
                          className="font-data mt-0.5 w-full rounded-[4px] border border-hairline px-1.5 py-1 text-[12px]"
                          value={value}
                          onChange={(e) => setter(e.currentTarget.value)}
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
                {tab === "trapezoid" ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="text-[11px] text-ink-muted">
                      q1 (kN/m)
                      <input
                        className="font-data mt-0.5 w-full rounded-[4px] border border-hairline px-1.5 py-1 text-[12px]"
                        value={qz}
                        onChange={(e) => setQz(e.currentTarget.value)}
                      />
                    </label>
                    <label className="text-[11px] text-ink-muted">
                      q2 (kN/m)
                      <input
                        className="font-data mt-0.5 w-full rounded-[4px] border border-hairline px-1.5 py-1 text-[12px]"
                        value={q2z}
                        onChange={(e) => setQ2z(e.currentTarget.value)}
                      />
                    </label>
                  </div>
                ) : null}
                {tab === "point" ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="text-[11px] text-ink-muted">
                      Fz (kN)
                      <input
                        className="font-data mt-0.5 w-full rounded-[4px] border border-hairline px-1.5 py-1 text-[12px]"
                        value={fz}
                        onChange={(e) => setFz(e.currentTarget.value)}
                      />
                    </label>
                    <label className="text-[11px] text-ink-muted">
                      a/L (%)
                      <input
                        className="font-data mt-0.5 w-full rounded-[4px] border border-hairline px-1.5 py-1 text-[12px]"
                        value={ratio}
                        onChange={(e) => setRatio(e.currentTarget.value)}
                      />
                    </label>
                  </div>
                ) : null}
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
            {/* v1.4.0: estimated self-weight mass beside the 1g toggle. */}
            <p className="font-data text-[11px] text-ink-muted" data-testid="self-weight-mass">
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
              className={`font-data self-start rounded-full border px-2 py-0.5 text-[11px] ${
                reactionCountValid
                  ? "border-pass-border bg-pass-bg text-pass-text"
                  : "border-fail-border bg-fail-bg text-fail-text"
              }`}
              data-testid="equilibrium-pill"
            >
              {reactionCountValid ? "Système équilibré" : "Appuis incomplets"}
            </p>

            {/* Primary CTA: runs the worker solve and moves to Step 4. */}
            <Button
              size="lg"
              className="w-full"
              data-testid="cta-solve"
              onClick={() => void navigate({ to: "/results" })}
            >
              <Trans>Lancer le calcul 3D & Eurocode 3 →</Trans>
            </Button>
          </aside>
        }
        main={
          <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-panel border border-hairline bg-panel p-3">
            <div className="relative min-h-[320px] flex-1 overflow-hidden rounded border border-hairline">
              <ViewportCanvas nodes={nodes} beams={beams} testId="viewport-canvas">
                <ForceVectors3D nodes={nodes} beams={beams} loads={loads} />
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
                    <th>Intensité</th>
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
                            : l.kind === "Trapezoid"
                              ? `B${l.beam_id}`
                              : "3D"}
                      </td>
                      <td>
                        {l.kind === "Trapezoid"
                          ? `${(l.q_start / 1000).toFixed(2)} → ${(l.q_end / 1000).toFixed(2)} kN/m`
                          : l.kind === "AccelerationField"
                            ? `(${l.ax_g} ; ${l.ay_g} ; ${l.az_g}) ×g`
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
                  <Trans>
                    Aucune charge définie — choisissez un scénario d'accélération ou ajoutez une
                    charge.
                  </Trans>
                </p>
              ) : null}
            </div>
          </section>
        }
      />
    </div>
  );
}
