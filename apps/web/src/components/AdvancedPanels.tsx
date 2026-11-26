import { useEffect, useState, type ReactElement } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useProjectStore } from "../state/projectStore";
import { feaClient, type BucklingReportDto } from "../wasmBridge/workerClient";

/**
 * Step 4 advanced-analysis tabs (v2.0.0): Global Buckling (λcr modes
 * 1..4), EN 1998-1 seismic spectrum (ag, ground A..E, CQC/SRSS) and the
 * multi-material / joint / fire checks (EC2 / EC5 / EC3-1-8 / EC3-1-2 /
 * EC9) — all fed by the wasm bridge.
 */

type Tab = "buckling" | "seismic" | "materials";

const GROUNDS = ["A", "B", "C", "D", "E"] as const;
const GROUND_TYPES = GROUNDS as readonly string[];

export function AdvancedPanels(): ReactElement {
  const project = useProjectStore((st) => st.project);
  const [tab, setTab] = useState<Tab>("buckling");
  const [buckling, setBuckling] = useState<BucklingReportDto | null>(null);
  const [agG, setAgG] = useState(0.35);
  const [ground, setGround] = useState<(typeof GROUNDS)[number]>("B");
  const [spectrumType, setSpectrumType] = useState<"Type1" | "Type2">("Type1");
  const [seValues, setSeValues] = useState<number[] | null>(null);
  const [materialKind, setMaterialKind] = useState("ec2_beam");
  const [materialTrace, setMaterialTrace] = useState<
    | {
        clause: string;
        title: string;
        value: number;
        limit: number;
        unit: string;
        passed: boolean;
      }[]
    | null
  >(null);

  useEffect(() => {
    void feaClient
      .engineCall("buckling_analysis_json", project, 4)
      .then((payload) => setBuckling(payload as BucklingReportDto))
      .catch(() => setBuckling(null));
    return undefined;
  }, [project]);

  useEffect(() => {
    const periods = Array.from({ length: 21 }, (_, i) => (i * 0.1).toFixed(2));
    void feaClient
      .engineCall("seismic_spectrum_json", agG, ground, spectrumType, periods.map(Number))
      .then((payload) => setSeValues(payload as number[]))
      .catch(() => setSeValues(null));
    return undefined;
  }, [agG, ground, spectrumType]);

  useEffect(() => {
    const params: Record<string, unknown> =
      materialKind === "ec2_beam"
        ? { class: "C30", m_ed: 120e3, v_ed: 90e3 }
        : materialKind === "ec5_timber"
          ? { product: "GL24h", m_ed: 20e3, service_class: 1 }
          : materialKind === "ec3_joint"
            ? { n_bolts: 4, v_ed: 100e3 }
            : materialKind === "ec3_fire"
              ? { utilization_mu0: 0.55, rating_minutes: 60 }
              : { alloy: "6082-T6", n_ed: 50e3 };
    void feaClient
      .engineCall("multi_material_check_json", materialKind, params)
      .then((payload) => setMaterialTrace(payload as typeof materialTrace))
      .catch(() => setMaterialTrace(null));
    return undefined;
  }, [materialKind]);

  return (
    <section
      aria-label={t`Analyses avancées`}
      className="rounded-xl border border-slate-200 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/90"
    >
      <div className="mb-3 flex gap-1" role="tablist" aria-label={t`Analyses avancées`}>
        {(
          [
            ["buckling", t`Flambement global λcr`],
            ["seismic", t`Sismique EN 1998-1`],
            ["materials", t`Multimatière / joints / feu`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded px-3 py-1 text-xs font-semibold ${
              tab === key ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "buckling" ? (
        <div className="text-sm" aria-live="polite">
          {buckling === null ? (
            <p className="text-xs text-slate-500">
              <Trans>Résoudre le modèle pour obtenir les modes de flambement.</Trans>
            </p>
          ) : (
            <ul className="space-y-1">
              {(Array.isArray(buckling.modes) ? buckling.modes : []).map((mode) => (
                <li key={mode.mode_index} className="flex justify-between font-mono text-xs">
                  <span>{t`Mode ${mode.mode_index}`}</span>
                  <span className={mode.lambda_cr < 1 ? "text-rose-600" : "text-emerald-600"}>
                    λcr = {mode.lambda_cr.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "seismic" ? (
        <div className="text-sm">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <label>
              ag/g:{" "}
              <input
                type="number"
                min={0.02}
                max={0.8}
                step={0.05}
                value={agG}
                onChange={(e) => setAgG(Number(e.target.value))}
                className="w-16 rounded border border-slate-300 bg-transparent px-1 dark:border-slate-600"
              />
            </label>
            <label>
              Sol:{" "}
              <select
                value={ground}
                onChange={(e) => setGround(e.target.value as (typeof GROUNDS)[number])}
                className="rounded border border-slate-300 bg-transparent dark:border-slate-600"
              >
                {GROUND_TYPES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setSpectrumType(spectrumType === "Type1" ? "Type2" : "Type1")}
              className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800"
            >
              {spectrumType}
            </button>
            <span>
              CQC / SRSS:{" "}
              {seValues !== null && seValues.length > 0
                ? `Se(0.3s) = ${(seValues[3] ?? 0).toFixed(2)} g`
                : "…"}
            </span>
          </div>
          {seValues !== null ? (
            <svg
              viewBox="0 0 320 80"
              className="h-20 w-full"
              role="img"
              aria-label={t`Spectre élastique`}
            >
              {seValues.map((se, i) => (
                <rect
                  key={i}
                  x={i * 16}
                  y={80 - Math.min(se / 3, 1) * 76}
                  width={12}
                  height={Math.max(Math.min(se / 3, 1) * 76, 1)}
                  fill="#31688e"
                />
              ))}
            </svg>
          ) : null}
        </div>
      ) : null}

      {tab === "materials" ? (
        <div className="text-sm">
          <select
            value={materialKind}
            onChange={(e) => setMaterialKind(e.target.value)}
            aria-label={t`Type de vérification`}
            className="mb-2 rounded border border-slate-300 bg-transparent px-2 py-1 text-xs dark:border-slate-600"
          >
            <option value="ec2_beam">EC2 béton — flexure + effort tranchant</option>
            <option value="ec5_timber">EC5 bois GL24h — flexion kmod</option>
            <option value="ec3_joint">EC3-1-8 assemblage — boulons + soudure</option>
            <option value="ec3_fire">EC3-1-2 feu — θa,cr / R60</option>
            <option value="ec9_aluminium">EC9 aluminium 6082-T6</option>
          </select>
          <ul className="space-y-1">
            {materialTrace?.map((node, i) => (
              <li key={i} className="flex justify-between text-xs">
                <span>{node.title}</span>
                <span className={node.passed ? "text-emerald-600" : "text-rose-600"}>
                  {node.value.toFixed(2)} / {node.limit.toFixed(2)} {node.unit}
                </span>
              </li>
            )) ?? <li className="text-xs text-slate-500">…</li>}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
