import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { feaClient, type BenchResultDto } from "../wasmBridge/workerClient";

/**
 * Validation modal (v1.8.0): renders the 41 closed-form benchmarks
 * executed live by the wasm engine (`run_validation_suite`) with their
 * expected vs computed values — the in-app evidence panel of G5.
 */
export function ValidationModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const [results, setResults] = useState<BenchResultDto[] | null>(null);
  const [fault, setFault] = useState<string | null>(null);

  useEffect(() => {
    feaClient
      .fetchValidationSuite()
      .then((r) => setResults(r))
      .catch((e: { message?: string }) => setFault(e.message ?? "validation failed"));
    return undefined;
  }, []);

  const passed = results?.filter((r) => r.passed).length ?? 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t`Validation suite`}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            <Trans>Validation — 41 benchmarks analytiques</Trans>
          </h2>
          <button type="button" onClick={onClose} aria-label={t`Fermer`} className="text-xl">
            ×
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
          {results === null ? (
            <Trans>Exécution en cours…</Trans>
          ) : fault !== null ? (
            fault
          ) : (
            <Trans>
              {passed}/{results?.length ?? 0} benchmarks passent (tolérance 3 %).
            </Trans>
          )}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b dark:border-slate-700">
                <th className="py-1 pr-2">ID</th>
                <th className="py-1 pr-2">
                  <Trans>Benchmark</Trans>
                </th>
                <th className="py-1 pr-2 text-right">
                  <Trans>Attendu</Trans>
                </th>
                <th className="py-1 pr-2 text-right">
                  <Trans>Calculé</Trans>
                </th>
                <th className="py-1 pr-2 text-right">Δrel</th>
                <th className="py-1">
                  <Trans>Statut</Trans>
                </th>
              </tr>
            </thead>
            <tbody>
              {results?.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-1 pr-2 font-mono">{r.id}</td>
                  <td className="py-1 pr-2">{r.title}</td>
                  <td className="py-1 pr-2 text-right font-mono">{r.expected.toPrecision(4)}</td>
                  <td className="py-1 pr-2 text-right font-mono">{r.computed.toPrecision(4)}</td>
                  <td className="py-1 pr-2 text-right font-mono">{r.rel_error.toExponential(1)}</td>
                  <td
                    className={`py-1 font-semibold ${r.passed ? "text-emerald-600" : "text-rose-600"}`}
                  >
                    {r.passed ? "OK" : "FAIL"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
