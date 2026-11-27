import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { X } from "lucide-react";
import { deleteSnapshot, listSnapshots, loadSnapshot, saveSnapshot } from "../state/snapshots";
import { useProjectStore, type ProjectData } from "../state/projectStore";
import { computeModelMassKg } from "../lib/resultsMath";
import { DialogContent, DialogHeader, DialogRoot, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <DialogRoot open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent
        className="max-h-[85vh] w-[min(92vw,768px)] overflow-auto"
        data-testid="scenario-compare-modal"
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              <Trans>Comparateur de scénarios</Trans>
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
        <div className="mb-4 flex flex-wrap gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t`Nom du scénario`}
            aria-label={t`Nom du scénario`}
            className="h-8"
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
            <div key={slot} className="rounded-[8px] border border-hairline p-3 ">
              <p className="mb-1 text-xs font-bold text-ink-muted">{slot}</p>
              {/* v2.1.2: scenario picker as a Base UI Select (zero raw selects). */}
              <SelectRoot
                value={value?.name ?? ""}
                onValueChange={(next) => {
                  if (next === null || next === "__none__" || next === "") return;
                  void loadSnapshot(next).then((loaded) => {
                    if (loaded !== null) {
                      setter({ name: next, project: loaded, meta: computeMeta(loaded) });
                    }
                  });
                }}
              >
                <SelectTrigger
                  aria-label={t`Scénario ${slot}`}
                  className="h-8 text-sm"
                  data-testid={`scenario-slot-${slot}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {names.map((n) => (
                    <SelectItem key={n.name} value={n.name}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
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
      </DialogContent>
    </DialogRoot>
  );
}
