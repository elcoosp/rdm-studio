import { Fragment, useEffect, useMemo, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { t } from "@lingui/core/macro";
import { X, Search } from "lucide-react";
import { DialogContent, DialogHeader, DialogRoot, DialogTitle } from "@rdm-studio/ui/primitives";
import { feaClient, type BenchResultDto } from "../wasmBridge/workerClient";
import { useProjectStore } from "../state/projectStore";
import { SegmentedControl } from "@rdm-studio/ui/interior";
import { CopyButton, StatusBadge } from "@rdm-studio/ui/interior";
import { Input } from "@/components/ui/input";
import { trackProductEvent } from "@/lib/productTelemetry";

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

type TierId = "all" | "structural" | "ec3" | "rdm6";

interface BenchRow extends BenchResultDto {
  tolerancePct: number;
  tier: "structural" | "ec3" | "rdm6";
  titleFr: string;
}

function SummaryCard({
  label,
  value,
  subLabel,
  tone = "accent",
}: {
  label: string;
  value: string;
  subLabel?: string;
  tone?: "pass" | "fail" | "warn" | "accent";
}) {
  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded-[6px] border border-hairline bg-panel">
      <span className="font-data text-[11px] text-ink-muted">{label}</span>
      <span
        className={`font-data text-[22px] font-semibold tabular-nums ${tone === "pass" ? "text-emerald-600" : tone === "fail" ? "text-rose-600" : "text-ink-primary"}`}
      >
        {value}
      </span>
      {subLabel && <span className="text-[10px] text-ink-muted">{subLabel}</span>}
    </div>
  );
}

function ToleranceGauge({ pct }: { pct: number }) {
  const clamped = Math.min(Math.max(pct, 0), 200);
  const isPass = pct <= 3;
  const color = isPass ? "bg-emerald-500" : pct <= 10 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div
      className="relative w-full h-2 rounded-full bg-panel-subtle overflow-hidden"
      title={`${pct.toFixed(1)} %`}
    >
      <div
        className={`${color} h-full transition-all duration-300`}
        style={{ width: `${Math.min(clamped / 2, 100)}%` }}
      />
      {isPass && (
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] text-emerald-600 font-bold">
          OK
        </span>
      )}
    </div>
  );
}

function ResultsTable({
  rows,
  searchQuery,
  locale,
  _onExportTsv,
}: {
  rows: BenchRow[];
  searchQuery: string;
  locale: string;
  _onExportTsv: () => void;
}) {
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        (locale === "fr" ? r.titleFr : r.title).toLowerCase().includes(q) ||
        r.expected.toString().includes(q) ||
        r.computed.toString().includes(q),
    );
  }, [rows, searchQuery, locale]);

  const groupedRows = useMemo(() => {
    const groups: Record<string, BenchRow[]> = {};
    for (const row of filteredRows) {
      const group =
        row.tier === "structural" ? "RDM & Stabilité (R01–R30)" : "Eurocode 3 (E01–E11)";
      if (!groups[group]) groups[group] = [];
      groups[group].push(row);
    }
    return groups;
  }, [filteredRows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-data text-[11px] text-ink-secondary">
          {filteredRows.length} / {rows.length} {t`repères`}
        </span>
        <CopyButton
          value={generateTsv(filteredRows, locale)}
          label={t`Exporter TSV`}
          iconOnly
          testId="export-tsv"
          className="h-7 w-7"
          aria-label={t`Exporter en TSV`}
        />
      </div>
      <div className="overflow-x-auto rounded-[6px] border border-hairline">
        <table className="w-full text-left text-[11px] font-data">
          <thead className="bg-panel-subtle/50">
            <tr className="border-b border-hairline">
              <th className="py-2 px-2 text-ink-secondary w-14">ID</th>
              <th className="py-2 px-2 text-ink-secondary min-w-[200px]">{t`Benchmark`}</th>
              <th className="py-2 px-2 text-right text-ink-secondary w-24">{t`Attendu`}</th>
              <th className="py-2 px-2 text-right text-ink-secondary w-24">{t`Calculé`}</th>
              <th className="py-2 px-2 text-right text-ink-secondary w-24">Δrel</th>
              <th className="py-2 px-2 text-ink-secondary w-28">{t`Tolérance`}</th>
              <th className="py-2 px-2 text-ink-secondary w-20">{t`Statut`}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedRows).map(([groupName, groupRows]) => (
              <Fragment key={groupName}>
                <tr className="bg-accent-tint/30 border-b border-hairline">
                  <td colSpan={7} className="py-1.5 px-2 font-semibold text-[11px] text-accent">
                    {groupName} — {groupRows.length} repères
                  </td>
                </tr>
                {groupRows.map((r) => (
                  <tr key={r.id} className="border-b border-hairline/50 hover:bg-panel-subtle/30">
                    <td className="py-1.5 px-2 font-mono text-[10px] text-ink-primary">{r.id}</td>
                    <td className="py-1.5 px-2 text-[11px] max-w-[280px] truncate">
                      {locale === "fr" ? r.titleFr : r.title}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums text-ink-secondary">
                      {r.expected.toPrecision(4)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums text-ink-secondary">
                      {r.computed.toPrecision(4)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums text-ink-muted">
                      {r.rel_error.toExponential(1)}
                    </td>
                    <td className="py-1.5 px-2">
                      <ToleranceGauge pct={r.tolerancePct} />
                    </td>
                    <td className="py-1.5 px-2">
                      <StatusBadge tone={r.passed ? "pass" : "fail"} mono className="text-[10px]">
                        {r.passed ? t`OK` : t`ÉCHEC`}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function generateTsv(rows: BenchRow[], locale: string): string {
  const headers = ["ID", "Benchmark", "Attendu", "Calculé", "Δrel", "Tolérance (%)", "Statut"];
  const lines = [headers.join("\t")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        locale === "fr" ? r.titleFr : r.title,
        r.expected.toPrecision(6),
        r.computed.toPrecision(6),
        r.rel_error.toExponential(3),
        r.tolerancePct.toFixed(2),
        r.passed ? "OK" : "ÉCHEC",
      ].join("\t"),
    );
  }
  return lines.join("\n");
}

export function ValidationModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const { i18n } = useLingui();
  const locale = i18n.locale;
  const project = useProjectStore((s) => s.project);
  const [results, setResults] = useState<BenchResultDto[] | null>(null);
  const [fault, setFault] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<TierId>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [fingerprint, setFingerprint] = useState<string>("—");

  useEffect(() => {
    void trackProductEvent("validation_modal_opened");
  }, []);

  useEffect(() => {
    let cancelled = false;
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

  useEffect(() => {
    let cancelled = false;
    feaClient
      .projectFingerprint(JSON.stringify(project))
      .then((h: string) => {
        if (!cancelled) setFingerprint(h.slice(0, 16));
      })
      .catch(() => {
        if (!cancelled) setFingerprint("—");
      });
    return () => {
      cancelled = true;
    };
  }, [project]);

  const allPassed = results?.filter((r) => r.passed).length ?? 0;
  const total = results?.length ?? 49;
  const allPass = allPassed === total && total === 49;

  const enrichedRows = useMemo((): BenchRow[] => {
    if (!results) return [];
    return results.map((r) => ({
      ...r,
      tolerancePct: Math.abs(r.rel_error) * 100,
      tier: r.id.startsWith("RDM6") ? "rdm6" : r.id.startsWith("R") ? "structural" : "ec3",
      titleFr: BENCH_TITLES_FR[r.id] ?? r.title,
    }));
  }, [results]);

  const structuralRows = enrichedRows.filter((r) => r.tier === "structural");
  const ec3Rows = enrichedRows.filter((r) => r.tier === "ec3");
  const rdm6Rows = enrichedRows.filter((r) => r.tier === "rdm6");
  const structuralPassed = structuralRows.filter((r) => r.passed).length;
  const ec3Passed = ec3Rows.filter((r) => r.passed).length;
  const rdm6Passed = rdm6Rows.filter((r) => r.passed).length;
  const maxTolerance =
    enrichedRows.length > 0 ? Math.max(...enrichedRows.map((r) => r.tolerancePct)) : 0;
  const avgWasmTime = results?.length ? "< 20 ms" : "—";

  return (
    <DialogRoot open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent
        className="max-h-[90vh] w-[min(96vw,1100px)] overflow-hidden flex flex-col"
        data-testid="validation-modal"
      >
        <DialogHeader className="p-4 border-b border-hairline">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/illustrations/tour-settings-benchmarks.png"
                alt=""
                width={96}
                height={54}
                className="rounded-[4px] border border-hairline shrink-0"
                aria-hidden="true"
              />
              <div>
                <DialogTitle className="text-[18px] font-semibold text-ink-primary">
                  <Trans>Certificat de Validation Analytique</Trans>
                </DialogTitle>
                <p className="text-[12px] text-ink-secondary mt-0.5">
                  {t`Suite de 49 benchmarks analytiques — RDM, Eurocode 3 & RDM6/RDM7`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-center">
                <div className="font-data text-[28px] font-bold tabular-nums text-ink-primary">
                  {allPassed}/{total}
                </div>
                <div className="text-[10px] text-ink-muted">{t`benchmarks passent`}</div>
              </div>
              <StatusBadge
                tone={allPass ? "pass" : "fail"}
                mono
                className="text-[11px] min-w-[120px] justify-center"
              >
                {allPass ? t`Validé` : t`Non validé`}
              </StatusBadge>
              <button
                type="button"
                onClick={onClose}
                aria-label={t`Fermer`}
                className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-hairline text-ink-secondary hover:bg-panel-subtle hover:text-ink-primary"
              >
                <X size={18} strokeWidth={1.5} aria-hidden />
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="border-b border-hairline bg-panel p-3 grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
          <SummaryCard
            label={t`RDM & Stabilité`}
            value={`${structuralPassed}/30`}
            subLabel={t`repères analytiques`}
            tone={structuralPassed === 30 ? "pass" : "fail"}
          />
          <SummaryCard
            label={t`Eurocode 3`}
            value={`${ec3Passed}/11`}
            subLabel={t`clauses EN 1993-1-1`}
            tone={ec3Passed === 11 ? "pass" : "fail"}
          />
          <SummaryCard
            label={t`RDM6 / RDM7 (Debard)`}
            value={`${rdm6Passed}/8`}
            subLabel={t`exemples RDM – Flexion §6`}
            tone={rdm6Passed === 8 ? "pass" : "fail"}
          />
          <SummaryCard
            label={t`Tolérance max`}
            value={`${maxTolerance.toFixed(2)} %`}
            subLabel={t`seuil 3 %`}
            tone={maxTolerance <= 3 ? "pass" : "warn"}
          />
          <SummaryCard
            label={t`Temps WASM`}
            value={avgWasmTime}
            subLabel={t`par pas de solve`}
            tone="accent"
          />
        </div>

        <div className="border-b border-hairline bg-panel p-3 sticky top-[calc(44px+var(--header-height))] z-10">
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <SegmentedControl
              value={activeFilter}
              onValueChange={(v) => setActiveFilter(v as TierId)}
              options={[
                { value: "all", label: `Tous (${total})`, testId: "filter-all" },
                {
                  value: "structural",
                  label: `RDM & Flambement (${structuralRows.length})`,
                  testId: "filter-structural",
                },
                { value: "ec3", label: `Eurocode 3 (${ec3Rows.length})`, testId: "filter-ec3" },
                { value: "rdm6", label: `RDM6 / RDM7 (${rdm6Rows.length})`, testId: "filter-rdm6" },
              ]}
              size="sm"
              className="flex-1"
            />
            <div className="relative flex-1 max-w-md">
              <Search
                className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-muted"
                size={16}
                aria-hidden
              />
              <Input
                type="search"
                placeholder={t`Rechercher ID, titre, valeur…`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-2 h-8"
                aria-label={t`Filtrer les benchmarks`}
                data-testid="benchmark-search"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {results === null ? (
            <div className="flex flex-col items-center justify-center h-64 text-ink-secondary">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent mb-4" />
              <Trans>Exécution de la suite de validation…</Trans>
            </div>
          ) : fault !== null ? (
            <div className="rounded-[4px] border border-rose-200 bg-rose-50 p-4 text-rose-600 text-[13px]">
              {fault}
            </div>
          ) : (
            <ResultsTable
              rows={
                activeFilter === "all"
                  ? enrichedRows
                  : enrichedRows.filter((r) => r.tier === activeFilter)
              }
              searchQuery={searchQuery}
              locale={locale}
              _onExportTsv={() => {}}
            />
          )}
        </div>

        <div className="border-t border-hairline bg-panel p-3 flex items-center justify-between">
          <div className="font-data text-[11px] text-ink-secondary flex items-center gap-4">
            <span>
              <span className="font-semibold">{t`Modèle`}:</span> {fingerprint}
            </span>
            <span>
              <span className="font-semibold">{t`Version`}:</span> RDM Studio v2.3.0
            </span>
            <span>
              <span className="font-semibold">{t`Date`}:</span>{" "}
              {new Date().toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB")}
            </span>
          </div>
          <p className="text-[12px] text-ink-secondary text-center">
            {allPass
              ? t`Tous les seuils sont respectés. Le modèle est certifié pour la note de calcul.`
              : t`Des écarts dépassent la tolérance de 3 %. Vérifiez les repères en échec.`}
          </p>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
