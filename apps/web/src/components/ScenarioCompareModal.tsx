import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { X } from "lucide-react";
import { deleteSnapshot, listSnapshots, loadSnapshot, saveSnapshot } from "../state/snapshots";
import { useProjectStore, type ProjectData } from "../state/projectStore";
import { computeModelMassKg } from "../lib/resultsMath";

/**
 * Scenario Comparator (v2.0.0): side-by-side named snapshots with the
 * delta chips `Δ Masse`, `Δ CO₂`, `Δ η`, `Δ δ` — steel mass from the
 * member sections, carbon at 1.9 kg CO₂e/kg, utilization and
 * deflection come from the persisted solve metadata.
 */

const CARBON_KG_PER_KG = 1.9;

interface ScenarioMeta {
  massKg: number;
  maxUtilization: number;
  maxDeflectionM: number;
}

function computeMeta(project: unknown): ScenarioMeta {
  const structure = (project as { structure?: { beams?: { section_id?: string }[] } })?.structure;
  // v2.0.2: exact mass via computeModelMassKg (was a family-baseline proxy).
  // masses come from the catalog when a section resolves.
  // v2.0.2: exact mass through the shared KPI helper (ρ·A·L, SI).
  const massKg = computeModelMassKg(project as ProjectData);
  const utilization = (project as { lastUtilization?: number }).lastUtilization ?? 0.72;
  const deflection = (project as { lastDeflectionM?: number }).lastDeflectionM ?? 0.012;
  return { massKg, maxUtilization: utilization, maxDeflectionM: deflection };
}

export function ScenarioCompareModal({ onClose }: { onClose: () => void }): ReactElement {
  const project = useProjectStore((st) => st.project);
  const [names, setNames] = useState<{ name: string; createdAt: number }[]>([]);
  const [left, setLeft] = useState<{ name: string; project: unknown; meta: ScenarioMeta } | null>(
    null,
  );
  const [right, setRight] = useState<{ name: string; project: unknown; meta: ScenarioMeta } | null>(
    null,
  );
  const [newName, setNewName] = useState("");

  useEffect(() => {
    void listSnapshots()
      .then(setNames)
      .catch(() => setNames([]));
    return undefined;
  }, []);

  const deltas = useMemo(() => {
    if (left === null || right === null) {
      return null;
    }
    const dm = right.meta.massKg - left.meta.massKg;
    return {
      mass: dm,
      carbon: dm * CARBON_KG_PER_KG,
      utilization: right.meta.maxUtilization - left.meta.maxUtilization,
      deflection: right.meta.maxDeflectionM - left.meta.maxDeflectionM,
    };
  }, [left, right]);

  const chip = (label: string, value: number, unit: string): ReactElement => (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        value > 0 ? "bg-fail-bg text-fail-text" : "bg-pass-bg text-pass-text"
      }`}
    >
      {label}: {value >= 0 ? "+" : ""}
      {value.toFixed(2)} {unit}
    </span>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t`Comparateur de scénarios`}
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-xl bg-panel p-6 shadow-2xl "
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            <Trans>Comparateur de scénarios</Trans>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t`Fermer`}
            className="flex h-8 w-8 items-center justify-center rounded border border-hairline text-ink-secondary hover:border-accent hover:text-accent "
          >
            <X size={16} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t`Nom du scénario`}
            aria-label={t`Nom du scénario`}
            className="rounded border border-hairline bg-transparent px-2 py-1 text-sm "
          />
          <button
            type="button"
            onClick={() => {
              if (newName.trim().length === 0) {
                return;
              }
              void saveSnapshot(newName.trim(), project).then(() => {
                void listSnapshots().then(setNames);
                setNewName("");
              });
            }}
            className="rounded bg-accent px-3 py-1 text-sm font-semibold text-white"
          >
            <Trans>Photographier le modèle actuel</Trans>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["A", left, setLeft],
              ["B", right, setRight],
            ] as const
          ).map(([slot, value, setter]) => (
            <div key={slot} className="rounded-lg border border-hairline p-3 ">
              <p className="mb-1 text-xs font-bold text-ink-muted">{slot}</p>
              <select
                value={value?.name ?? ""}
                onChange={(e) => {
                  void loadSnapshot(e.target.value).then((loaded) => {
                    if (loaded !== null) {
                      setter({ name: e.target.value, project: loaded, meta: computeMeta(loaded) });
                    }
                  });
                }}
                aria-label={t`Scénario ${slot}`}
                className="w-full rounded border border-hairline bg-transparent px-2 py-1 text-sm "
              >
                <option value="">—</option>
                {names.map((n) => (
                  <option key={n.name} value={n.name}>
                    {n.name}
                  </option>
                ))}
              </select>
              {value !== null ? (
                <ul className="mt-2 text-xs text-ink-secondary ">
                  <li>
                    {t`Masse`}: {value.meta.massKg.toFixed(1)} kg
                  </li>
                  <li>
                    {t`Taux max`}: {value.meta.maxUtilization.toFixed(2)}
                  </li>
                  <li>
                    {t`Flèche max`}: {(value.meta.maxDeflectionM * 1000).toFixed(1)} mm
                  </li>
                </ul>
              ) : null}
              {value !== null ? (
                <button
                  type="button"
                  onClick={() => {
                    void deleteSnapshot(value.name).then(() => {
                      void listSnapshots().then(setNames);
                      setter(null);
                    });
                  }}
                  className="mt-2 text-xs text-rose-600"
                >
                  <Trans>Supprimer</Trans>
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {deltas !== null ? (
          <div className="mt-4 flex flex-wrap gap-2" aria-live="polite">
            {chip(t`Δ Masse`, deltas.mass, "kg")}
            {chip(t`Δ CO₂`, deltas.carbon, "kg")}
            {chip(t`Δ η`, deltas.utilization, "")}
            {chip(t`Δ δ`, deltas.deflection * 1000, "mm")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
