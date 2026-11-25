import { useEffect, useState, type ReactElement } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useProjectStore } from "../state/projectStore";
import { feaClient, type GroupOptimizationDto } from "../wasmBridge/workerClient";
import { CalcTrace } from "./CalcTraceTree";
import type { CalcTraceNodeDto } from "../wasmBridge/workerClient";

/**
 * Optimizer modal (v1.8.0/v1.9.0): iterative EC3 lightest-profile search
 * over the catalog candidates, Pareto mass-vs-utilization scatter,
 * mass/carbon/cost totals and the "Why does this fail?" mitigation card.
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

export function OptimizerModal({ onClose }: { onClose: () => void }): ReactElement {
  const project = useProjectStore((st) => st.project);
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

  const worst = rows?.reduce(
    (acc, row) =>
      Math.max(
        acc,
        row.pareto.reduce((a, p) => Math.max(a, p[2]), 0),
      ),
    0,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t`Optimiseur de sections`}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            <Trans>Optimiseur EC3 — profil le plus léger</Trans>
          </h2>
          <button type="button" onClick={onClose} aria-label={t`Fermer`} className="text-xl">
            ×
          </button>
        </div>
        {totals !== null ? (
          <p className="mb-3 text-sm" aria-live="polite">
            <Trans>
              Masse {totals.mass_kg.toFixed(1)} kg · Carbone {totals.carbon_kg.toFixed(0)} kg CO₂e ·
              Coût {totals.cost_eur.toFixed(0)} € ({COST_EUR_PER_KG} €/kg)
            </Trans>
          </p>
        ) : null}
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b dark:border-slate-700">
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
                <tr key={row.beamId} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-1 pr-2 font-mono">B{row.beamId}</td>
                  <td className="py-1 pr-2 font-semibold">{row.chosen ?? "—"}</td>
                  <td className="py-1 pr-2">{row.passes}</td>
                  <td className="py-1 text-slate-600 dark:text-slate-300">
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
          <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-950">
            <h3 className="mb-2 text-sm font-bold text-rose-700 dark:text-rose-300">
              <Trans>Pourquoi ça échoue ? — 3 remèdes 1-clic</Trans>
            </h3>
            <ul className="list-inside list-disc text-xs text-slate-700 dark:text-slate-200">
              {whyDoesThisFail(worst).map((item) => (
                <li key={item.label}>
                  <strong>{item.label}</strong> — {item.impact}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <h3 className="mb-2 text-sm font-bold">
          <Trans>Trace de vérification (KaTeX)</Trans>
        </h3>
        <CalcTrace nodes={trace} />
      </div>
    </div>
  );
}
