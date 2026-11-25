import { createFileRoute } from "@tanstack/react-router";
import { BottomSheet } from "@/components/BottomSheet";
import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { IconPlus, IconTrash } from "@/components/icons";
import { formatKn } from "@/lib/units";
import { useProjectStore, type LoadCaseId } from "@/state/projectStore";

export const Route = createFileRoute("/loads")({
  component: LoadsPage,
});

const CASES: LoadCaseId[] = ["Permanent", "Variable", "Wind", "Snow"];

function LoadsPage() {
  const loads = useProjectStore((s) => s.project.structure.loads);
  const nodes = useProjectStore((s) => s.project.structure.nodes);
  const beams = useProjectStore((s) => s.project.structure.beams);
  const addNodalLoad = useProjectStore((s) => s.addNodalLoad);
  const removeLoad = useProjectStore((s) => s.removeLoad);
  const selfWeight = useProjectStore((s) => s.project.structure.self_weight_enabled);
  const toggleSelfWeight = useProjectStore((s) => s.toggleSelfWeight);

  const [nodeId, setNodeId] = useState<number>(nodes[0]?.id ?? 1);
  const [fz, setFz] = useState("−10");
  const [loadCase, setLoadCase] = useState<LoadCaseId>("Variable");

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
      <section className="rounded-panel border border-hairline bg-panel p-4">
        <h2 className="mb-3 text-[15px] font-semibold">
          <Trans>Charges et combinaisons EN 1990</Trans>
        </h2>
        <table className="w-full text-[13px]">
          <thead className="text-left text-[11px] uppercase tracking-wide text-ink-muted">
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
                <td>{l.kind === "Trapezoid" ? formatKn(l.q_start) : formatKn(l.forces.fz)}</td>
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
          <p className="py-4 text-[13px] text-ink-muted">
            <Trans>Aucune charge définie.</Trans>
          </p>
        ) : null}
      </section>
      <BottomSheet testId="inspector-sheet" title={<Trans>Charge ponctuelle</Trans>}>
        <label className="block text-[12px] text-ink-secondary">
          <Trans>Noeud</Trans>
        </label>
        <select
          className="font-data mt-1 w-full rounded border border-hairline px-2 py-1.5 text-[13px]"
          value={nodeId}
          onChange={(e) => setNodeId(Number(e.currentTarget.value))}
        >
          {nodes.map((n) => (
            <option value={n.id}>N{n.id}</option>
          ))}
        </select>
        <label className="mt-3 block text-[12px] text-ink-secondary">
          <Trans>Cas de charge</Trans>
        </label>
        <select
          className="mt-1 w-full rounded border border-hairline px-2 py-1.5 text-[13px]"
          value={loadCase}
          onChange={(e) => setLoadCase(e.currentTarget.value as LoadCaseId)}
        >
          {CASES.map((c) => (
            <option value={c}>{c}</option>
          ))}
        </select>
        <label className="mt-3 block text-[12px] text-ink-secondary">
          <Trans>Fz (kN, négatif vers le bas)</Trans>
        </label>
        <input
          className="font-data mt-1 w-full rounded border border-hairline px-2 py-1.5 text-[13px]"
          value={fz}
          onChange={(e) => setFz(e.currentTarget.value)}
        />
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-1 rounded bg-accent px-2 py-1.5 text-[13px] text-white disabled:opacity-40"
          disabled={nodes.length === 0}
          onClick={() => {
            const value = Number(fz.replace(",", ".")) * 1000;
            if (Number.isFinite(value)) addNodalLoad(nodeId, value, loadCase);
          }}
        >
          <IconPlus size={12} />
          <Trans>Ajouter la charge</Trans>
        </button>
        <label className="mt-5 flex items-center gap-2 text-[12px] text-ink-secondary">
          <input type="checkbox" checked={selfWeight} onChange={toggleSelfWeight} />
          <Trans>Poids propre automatique (cas G)</Trans>
        </label>
        <p className="mt-2 text-[11px] text-ink-muted font-data">
          {beams.length} <Trans>poutres résolues par élément</Trans>
        </p>
      </BottomSheet>
    </div>
  );
}
