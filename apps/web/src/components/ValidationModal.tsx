import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { t } from "@lingui/core/macro";
import { X } from "lucide-react";
import { feaClient, type BenchResultDto } from "../wasmBridge/workerClient";

/**
 * Validation modal (v1.8.0): renders the 41 closed-form benchmarks
 * executed live by the wasm engine (`run_validation_suite`) with their
 * expected vs computed values — the in-app evidence panel of G5.
 *
 * v2.1.1: the Rust-side English titles are localized in the UI — when the
 * active locale is `fr`, every benchmark ID (R01..R30, E01..E11) maps to
 * its French structural-engineering title; `en` keeps the engine title.
 * Concurrent `fetchValidationSuite()` calls share the in-flight worker
 * Promise (StrictMode-safe coalescing in `workerClient.ts`).
 */

/** French engineering titles of the 41 analytical benchmarks, by ID. */
const BENCH_TITLES_FR: Record<string, string> = {
  R01: "Poutre isostatique P à mi-travée — réaction P/2",
  R02: "Poutre isostatique q uniforme — réaction qL/2",
  R03: "Poutre isostatique q uniforme — réaction totale R",
  R04: "Console P en tête — flèche δ",
  R05: "Console M en tête — rotation θ",
  R06: "Poutre bi-encastrée q — moment d'appui",
  R07: "Barre axiale — allongement",
  R08: "Barre en torsion — θx en tête",
  R09: "Console Timoshenko — flèche δ",
  R10: "Dilatation thermique ΔT — allongement libre",
  R11: "Thermique ΔT — effort axial bloqué",
  R12: "Tassement 10 mm — réaction centrale",
  R13: "Charge partielle mi-travée — réaction R1",
  R14: "Barre tendue-comprimée unilatérale — N",
  R15: "Portique plan 2D — réaction qL/2",
  R16: "Console à inertie variable — δ (I moyen)",
  R17: "Console M en tête — δ = ML²/2EI",
  R18: "P à a/L = 0,25 — réaction A",
  R19: "P à mi-travée — réaction P/2",
  R20: "Poutre 2 travées q — réaction intermédiaire",
  R21: "Linéarité δ(3q) = 3δ(q)",
  R22: "Charge symétrique — R1 = R2",
  R23: "Équilibre global ΣFz",
  R24: "Poutre isostatique q — M mi-travée = qL²/8",
  R25: "6 DDL par nœud",
  R26: "Gradient thermique — moment encastré",
  R27: "Gradient thermique libre — ΣR = 0",
  R28: "Barre tension-seule sous tension — δ",
  R29: "Étai compression-seule — δ",
  R30: "Superposition ELU 1,35G + 1,50Q",
  E01: "Résistance plastique axiale Npl,Rd = A·fy/γM0",
  E02: "Résistance plastique au cisaillement Vpl,Rd",
  E03: "Moment résistant plastique Mc,Rd = Wpl·fy/γM0",
  E04: "Élancement normalisé ε = √(235/fy)",
  E05: "Coefficient γG de la recette ELU 6.10",
  E06: "Nombre de recettes ELU 6.10a/b",
  E07: "Coefficient ψ0(Q) recommandé",
  E08: "Facteur C1(ψ=0) Tableau 6.3",
  E09: "Coefficient γM0 annexe nationale FR",
  E10: "Flambement torsion Ncr,T St-Venant + Wagner",
  E11: "Plafond ρ des sections de classe 4",
};

export function ValidationModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const { i18n } = useLingui();
  const [results, setResults] = useState<BenchResultDto[] | null>(null);
  const [fault, setFault] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // v2.1.1: StrictMode's double effect coalesces onto the in-flight
    // worker Promise — no "validation in flight" rejection anymore.
    feaClient
      .fetchValidationSuite()
      .then((r) => {
        if (!cancelled) setResults(r);
      })
      .catch((e: { message?: string }) => {
        if (!cancelled) setFault(e.message ?? "validation failed");
      });
    return () => {
      cancelled = true;
    };
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
        className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-xl bg-panel p-6 shadow-2xl "
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            <Trans>Validation — 41 benchmarks analytiques</Trans>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t`Fermer`}
            className="flex h-7 w-7 items-center justify-center rounded text-ink-secondary hover:bg-panel-subtle hover:text-ink-primary"
          >
            {/* 22fd9fa audit: the raw `×` glyph is replaced by the standard
                18px Lucide close icon (strokeWidth 1.5). */}
            <X size={18} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
        <p className="mb-4 text-sm text-ink-secondary " aria-live="polite">
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
              <tr className="border-b ">
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
                <tr key={r.id} className="border-b border-hairline">
                  <td className="py-1 pr-2 font-mono">{r.id}</td>
                  <td className="py-1 pr-2">
                    {i18n.locale === "fr" ? (BENCH_TITLES_FR[r.id] ?? r.title) : r.title}
                  </td>
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
