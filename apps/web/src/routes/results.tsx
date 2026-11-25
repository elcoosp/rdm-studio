import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { SearchParamsSchema } from "@/schemas/searchParams.schema";
import { IconPlay } from "@/components/icons";
import { formatKn, formatMm, formatRatio } from "@/lib/units";
import { feaClient, type SolveFault, type SolveReport } from "@/wasmBridge/workerClient";
import { useProjectStore } from "@/state/projectStore";

export const Route = createFileRoute("/results")({
  validateSearch: (search) => v.parse(SearchParamsSchema, search),
  component: ResultsPage,
});

function ResultsPage() {
  const project = useProjectStore((s) => s.project);
  const [report, setReport] = useState<SolveReport | null>(null);
  const [fault, setFault] = useState<SolveFault | null>(null);
  const [busy, setBusy] = useState(false);

  const run = () => {
    setBusy(true);
    setFault(null);
    void feaClient
      .solveModel(project)
      .then((r) => {
        setReport(r);
        setFault(null);
      })
      .catch((f: SolveFault) => {
        setFault(f);
        setReport(null);
      })
      .finally(() => setBusy(false));
  };

  const uls = report?.combinations.find((c) => c.kind === "ULS");
  const sls = report?.combinations.find((c) => c.kind === "SLS");

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
      <section className="rounded-panel border border-hairline bg-panel p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">
            <Trans>Resultats de calcul</Trans>
          </h2>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-[13px] text-white disabled:opacity-40"
            disabled={busy}
            onClick={run}
          >
            <IconPlay size={12} />
            <Trans>Calculer</Trans>
          </button>
        </div>
        {fault !== null ? (
          <p className="mt-4 rounded border border-fea-max/40 bg-fea-max/10 p-3 text-[13px] text-fea-max">
            {fault.kind}: {fault.message}
          </p>
        ) : null}
        {report !== null && uls !== undefined ? (
          <>
            <h3 className="mt-4 mb-2 text-[13px] font-semibold text-ink-secondary">{uls.label}</h3>
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11px] uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="py-1">
                    <Trans>Poutre</Trans>
                  </th>
                  <th>
                    <Trans>Exploitation EC3</Trans>
                  </th>
                </tr>
              </thead>
              <tbody className="font-data">
                {uls.beams.map((b) => (
                  <tr key={b.beam_id} className="border-t border-hairline">
                    <td className="py-1">B{b.beam_id}</td>
                    <td className={b.utilization > 1 ? "text-fea-max" : "text-fea-mid"}>
                      {formatRatio(b.utilization)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="mt-4 mb-2 text-[13px] font-semibold text-ink-secondary">{sls?.label}</h3>
            <table className="w-full text-[13px]">
              <tbody className="font-data">
                {sls?.beams.map((b) => (
                  <tr key={b.beam_id} className="border-t border-hairline">
                    <td className="py-1">B{b.beam_id}</td>
                    <td>{formatMm(b.midspan_deflection)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
      </section>
      <aside className="rounded-panel border border-hairline bg-panel p-4">
        <h2 className="mb-3 text-[15px] font-semibold">
          <Trans>Deplacements nodaux (G)</Trans>
        </h2>
        {report === null ? (
          <p className="text-[13px] text-ink-muted">
            <Trans>Lancer un calcul pour afficher les resultats.</Trans>
          </p>
        ) : (
          <table className="w-full text-[13px]">
            <tbody className="font-data">
              {report.cases
                .find((c) => c.code === "Q")
                ?.displacements.filter((_, i) => i % 6 === 2)
                .slice(0, 12)
                .map((d, i) => (
                  <tr key={i} className="border-t border-hairline">
                    <td className="py-1">N{i + 1}</td>
                    <td>{formatMm(d)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-[11px] text-ink-muted">
          <Trans>
            Un facteur de cas sert d'ordre de grandeur: conversions SI vers affichage exclusives a
            l'UI.
          </Trans>
        </p>
        <p className="font-data mt-1 text-[11px] text-ink-muted">
          {report !== null
            ? `${report.n_nodes} N / ${report.n_beams} B — ${formatKn(0) === "0.0 kN" ? "" : ""}`
            : ""}
        </p>
      </aside>
    </div>
  );
}
