import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { X } from "lucide-react";
import { DialogContent, DialogHeader, DialogRoot, DialogTitle } from "@/components/ui/dialog";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { useProjectStore } from "../state/projectStore";
import { toast } from "sonner";
import { feaClient, type GroupOptimizationDto } from "../wasmBridge/workerClient";
import { CalcTrace } from "./CalcTraceTree";
import type { CalcTraceNodeDto } from "../wasmBridge/workerClient";

/**
 * Optimizer modal (v1.8.0/v1.9.0): iterative EC3 lightest-profile search
 * over the catalog candidates, Pareto mass-vs-utilization scatter,
 * mass/carbon/cost totals and the "Why does this fail?" mitigation card.
 * v2.0.1: the Pareto frontier renders as an interactive recharts
 * `<ScatterChart>` (mass_per_m vs utilization with the η = 1.0 reference
 * line) instead of raw text tuples.
 */

const CARBON_KG_PER_KG = 1.9;
const COST_EUR_PER_KG = 1.85;

interface OptimizerRow extends GroupOptimizationDto {
  beamId: number;
}

const CATALOG_CANDIDATES = [
  {
    designation: "IPE 140",
    a: 1.61e-3,
    iy: 5.41e-6,
    iz: 1.51e-6,
    wel_y: 77.3e-6,
    wpl_y: 90.6e-6,
    mass_per_m: 12.9,
  },
  {
    designation: "IPE 160",
    a: 2.01e-3,
    iy: 8.69e-6,
    iz: 2.29e-6,
    wel_y: 108.6e-6,
    wpl_y: 123.9e-6,
    mass_per_m: 15.8,
  },
  {
    designation: "IPE 180",
    a: 2.39e-3,
    iy: 13.05e-6,
    iz: 3.13e-6,
    wel_y: 144.9e-6,
    wpl_y: 166.0e-6,
    mass_per_m: 18.8,
  },
  {
    designation: "IPE 200",
    a: 2.24e-3,
    iy: 19.43e-6,
    iz: 5.08e-6,
    wel_y: 194.3e-6,
    wpl_y: 220.6e-6,
    mass_per_m: 22.4,
  },
  {
    designation: "IPE 240",
    a: 3.06e-3,
    iy: 38.92e-6,
    iz: 8.4e-6,
    wel_y: 324.3e-6,
    wpl_y: 366.6e-6,
    mass_per_m: 30.7,
  },
  {
    designation: "IPE 300",
    a: 4.56e-3,
    iy: 83.56e-6,
    iz: 16.02e-6,
    wel_y: 557.2e-6,
    wpl_y: 628.4e-6,
    mass_per_m: 42.2,
  },
];

/** Ranks the three cheapest 1-click mitigations of a failing check. */
export function whyDoesThisFail(utilization: number): { label: string; impact: string }[] {
  const over = Math.max(utilization - 1.0, 0.0);
  return [
    {
      label: t`Changer de profil (+2 tailles)`,
      impact: `${Math.round(over * 100)}% → réduit le taux vers ~${Math.max(utilization - 0.45, 0.1).toFixed(2)}`,
    },
    {
      label: t`Réduire la portée ou ajouter un appui`,
      impact: t`Diminue My ~ (L/2)² — le levier le plus fort sur la flexion`,
    },
    {
      label: t`Ajouter un lien antidéversant (kLT → 1)`,
      impact: t`Supprime le déversement si MB,Rd gouverne`,
    },
  ];
}

/** One Pareto candidate point of the mass-vs-utilization frontier. */
interface ParetoPoint {
  designation: string;
  mass_per_m: number;
  utilization: number;
}

export function OptimizerModal({ onClose }: { onClose: () => void }): ReactElement {
  const project = useProjectStore((st) => st.project);
  const loadProject = useProjectStore((st) => st.loadProject);
  const [rows, setRows] = useState<OptimizerRow[] | null>(null);
  const [trace, setTrace] = useState<CalcTraceNodeDto[] | null>(null);
  const [totals, setTotals] = useState<{
    mass_kg: number;
    carbon_kg: number;
    cost_eur: number;
  } | null>(null);

  useEffect(() => {
    void feaClient
      .engineCall("optimize_sections_json", project, CATALOG_CANDIDATES)
      .then((payload) => {
        const [optimizations, totalsValue] = payload as [
          GroupOptimizationDto[],
          { mass_kg: number },
        ];
        setRows(
          optimizations.map((o, i) => ({ ...o, beamId: project.structure.beams[i]?.id ?? i })),
        );
        setTotals({
          mass_kg: totalsValue.mass_kg,
          carbon_kg: totalsValue.mass_kg * CARBON_KG_PER_KG,
          cost_eur: totalsValue.mass_kg * COST_EUR_PER_KG,
        });
      })
      .catch(() => setRows([]));
    return undefined;
  }, [project]);

  useEffect(() => {
    void feaClient
      .engineCall("member_calc_trace", project, 0)
      .then((payload) => setTrace(payload as CalcTraceNodeDto[]))
      .catch(() => setTrace(null));
    return undefined;
  }, [project]);

  /** Flat Pareto frontier across every member group (recharts dataset). */
  const paretoPoints = useMemo<ParetoPoint[]>(() => {
    if (rows === null) {
      return [];
    }
    return rows.flatMap((row) =>
      row.pareto.map(([designation, mass, util]) => ({
        designation,
        mass_per_m: mass,
        utilization: util,
      })),
    );
  }, [rows]);

  const worst = rows?.reduce(
    (acc, row) =>
      Math.max(
        acc,
        row.pareto.reduce((a, p) => Math.max(a, p[2]), 0),
      ),
    0,
  );

  const applyOptimized = (): void => {
    if (rows === null) {
      return;
    }
    const beams = project.structure.beams.map((beam, index) => {
      const chosen = rows[index]?.chosen;
      return chosen === undefined || chosen === null ? beam : { ...beam, section_id: chosen };
    });
    loadProject({ ...project, structure: { ...project.structure, beams } });
  };

  return (
    <DialogRoot open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent
        className="max-h-[85vh] w-[min(92vw,768px)] overflow-auto"
        data-testid="optimizer-modal"
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              <Trans>Optimiseur EC3 — profil le plus léger</Trans>
            </DialogTitle>
            <button
              type="button"
              onClick={onClose}
              aria-label={t`Fermer`}
              className="flex h-8 w-8 items-center justify-center rounded border border-hairline text-ink-secondary hover:border-accent hover:text-accent"
            >
              <X size={16} strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        </DialogHeader>
        {totals !== null ? (
          <p className="mb-3 text-sm" aria-live="polite">
            <Trans>
              Masse {totals.mass_kg.toFixed(1)} kg · Carbone {totals.carbon_kg.toFixed(0)} kg CO₂e ·
              Coût {totals.cost_eur.toFixed(0)} € ({COST_EUR_PER_KG} €/kg)
            </Trans>
          </p>
        ) : null}
        {/* v2.0.1: interactive Pareto frontier (recharts ScatterChart) —
            mass_per_m (kg/m) vs utilization η with the η = 1.0 limit. */}
        {paretoPoints.length > 0 ? (
          <div className="mb-4 rounded-[8px] border border-hairline bg-panel-subtle p-3  ">
            <h3 className="mb-1 text-xs font-semibold">
              <Trans>Frontière de Pareto (masse vs taux de travail)</Trans>
            </h3>
            <div style={{ width: "100%", height: 240 }} data-testid="pareto-scatter">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 16, bottom: 18, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    type="number"
                    dataKey="mass_per_m"
                    name="Masse linéique"
                    unit=" kg/m"
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 11 }}
                    label={{
                      value: "mass_per_m (kg/m)",
                      position: "insideBottom",
                      offset: -8,
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="utilization"
                    name="Taux de travail"
                    domain={[0, (max: number) => Math.max(1.2, Math.round(max * 10) / 10)]}
                    tick={{ fontSize: 11 }}
                    width={44}
                  />
                  <ZAxis range={[60, 60]} />
                  <ReferenceLine
                    y={1}
                    stroke="#DC2626"
                    strokeDasharray="4 4"
                    label={{
                      value: "η = 1.0",
                      position: "insideTopRight",
                      fontSize: 11,
                      fill: "#DC2626",
                    }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    formatter={(value, name) => [
                      name === "Masse linéique" ? `${String(value)} kg/m` : `η = ${value}`,
                      String(name),
                    ]}
                  />
                  <Scatter
                    data={paretoPoints}
                    fill="#1D4ED8"
                    fillOpacity={0.75}
                    name="Candidats EC3"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b ">
                <th className="py-1 pr-2">
                  <Trans>Membre</Trans>
                </th>
                <th className="py-1 pr-2">
                  <Trans>Choisi</Trans>
                </th>
                <th className="py-1 pr-2">
                  <Trans>Passes</Trans>
                </th>
                <th className="py-1">
                  <Trans>Pareto (masse, taux)</Trans>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((row) => (
                <tr key={row.beamId} className="border-b border-hairline">
                  <td className="py-1 pr-2 font-mono">B{row.beamId}</td>
                  <td className="py-1 pr-2 font-semibold">{row.chosen ?? "—"}</td>
                  <td className="py-1 pr-2">{row.passes}</td>
                  <td className="py-1 text-ink-secondary ">
                    {row.pareto
                      .map(([name, mass, util]) => `(${name}: ${mass} kg/m, ${util.toFixed(2)})`)
                      .join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {worst !== undefined && worst > 1.0 ? (
          <div className="mb-4 rounded-[8px] border border-fail-border bg-fail-bg p-3">
            <h3 className="mb-2 text-sm font-bold text-fail-text">
              <Trans>Pourquoi ça échoue ? — 3 remèdes 1-clic</Trans>
            </h3>
            <ul className="list-inside list-disc text-xs text-ink-secondary ">
              {whyDoesThisFail(worst).map((item) => (
                <li key={item.label}>
                  <strong>{item.label}</strong> — {item.impact}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => {
            applyOptimized();
            toast.success("Profilés optimisés appliqués (⌘Z pour annuler)");
            onClose();
          }}
          className="mb-3 w-full rounded bg-accent py-2 text-sm font-bold text-white hover:bg-accent/90"
        >
          Appliquer les profilés optimisés (⌘Z)
        </button>
        <h3 className="mb-2 text-sm font-bold">
          <Trans>Trace de vérification (KaTeX)</Trans>
        </h3>
        <CalcTrace nodes={trace} />
      </DialogContent>
    </DialogRoot>
  );
}
