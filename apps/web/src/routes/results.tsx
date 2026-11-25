import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { SearchParamsSchema } from "@/schemas/searchParams.schema";
import { IconPlay } from "@/components/icons";
import { BottomSheet } from "@/components/BottomSheet";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { computeModelMassKg, nextHeavierProfile } from "@/lib/resultsMath";
import { NumberFlowValue } from "@/components/NumberFlowValue";
import { CuttingPlane } from "@/viewport3d/CuttingPlane";
import { SectionCut, DeflectionLimit, ModalVibration } from "@/components/icons/EngineeringIcons";
import type { SectionDims, SpanForceSample, StressGrid } from "@/wasmBridge/workerClient";
import { formatMm } from "@/lib/units";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { UtilizationProgress } from "@/components/ui/progress";
import {
  feaClient,
  type ModalReport,
  type SolveFault,
  type SolveReport,
} from "@/wasmBridge/workerClient";
import { useProjectStore } from "@/state/projectStore";
import { ViewportCanvas } from "@/viewport3d/ViewportCanvas";
import { BeamMeshes } from "@/viewport3d/BeamMeshes";
import { spectrumColor } from "@/viewport3d/BeamMeshes";
import { SupportMarkers } from "@/viewport3d/SupportMarkers";
import { ForceVectors3D } from "@/viewport3d/ForceVectors3D";

export const Route = createFileRoute("/results")({
  validateSearch: (search) => v.parse(SearchParamsSchema, search),
  component: ResultsPage,
});

/**
 * Step 4 (DESIGN.md §4 metrology layout, mockups tape_4): compact 4-KPI
 * strip → full-bleed deformed viewport (consolidated top-right control
 * bar + bottom-center thermal legend) → h-[220px] precision dock (2D σvM
 * cross-section + fiber stress readouts | uPlot internal forces with
 * dashed crimson ±M_Rd capacity lines and live cursor readouts).
 */
function ResultsPage() {
  const project = useProjectStore((s) => s.project);
  const selection = useProjectStore((s) => s.selection);
  const updateBeam = useProjectStore((s) => s.updateBeam);
  const [report, setReport] = useState<SolveReport | null>(null);
  const [fault, setFault] = useState<SolveFault | null>(null);
  const [busy, setBusy] = useState(false);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const navigate = useNavigate();

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

  // v1.0.0 bug 10: auto-reactive solving — any geometry/support/load/
  // profile mutation re-solves after a 150 ms debounce. The "Calculer"
  // button remains for an explicit fresh run.
  const modelSignature = useMemo(() => JSON.stringify(project.structure), [project.structure]);
  const autoRef = useRef(run);
  autoRef.current = run;
  useEffect(() => {
    const timer = setTimeout(() => autoRef.current(), 150);
    return () => clearTimeout(timer);
  }, [modelSignature]);

  const uls = report?.combinations.find((c) => c.kind === "ULS");
  const sls = report?.combinations.find((c) => c.kind === "SLS");

  // v1.0.0 Step 4: amplification slider (x1..x30 around the calibrated
  // base scale), eigenmode selector, corrective upgrade with undo toast.
  const [amplification, setAmplification] = useState(1);
  const [modal, setModal] = useState<ModalReport | null>(null);
  const [sectionDims, setSectionDims] = useState<Map<string, SectionDims>>(new Map());
  // Combination / eigenmode selector + harmonic modal play (§ mockups tape_4).
  const [viewMode, setViewMode] = useState<"ELU" | "ELS" | "MODE">("ELS");
  // v1.3.0: 3 calibrated thermal scale modes driven by the real fields.
  const [scaleMode, setScaleMode] = useState<"ec3" | "svm" | "auto">("ec3");
  const [eigenIndex, setEigenIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [harmonic, setHarmonic] = useState(1);
  // v1.5.0: the 4-clause EC3 breakdown expands/collapses under the strip.
  const [breakdownOpen, setBreakdownOpen] = useState(true);
  // Cutting plane sync (§8.5): beam + x/L scrubbed from the docked inspector.
  const [cutBeamId, setCutBeamId] = useState<number>(project.structure.beams[0]?.id ?? 0);
  const [station, setStation] = useState(0.5);
  const [massKg, setMassKg] = useState<number | null>(null);
  const ipeSeriesRef = useRef<string[]>([]);
  const areasRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [catalog, modalReport] = await Promise.all([
        feaClient.fetchCatalog().catch(() => null),
        feaClient.modalAnalysis(project, 6).catch(() => null),
      ]);
      if (cancelled) return;
      if (catalog !== null) {
        ipeSeriesRef.current = catalog.sections.map((x) => x.designation);
        // v1.1.0 bug 3: Step 4 extrudes the true catalog profiles too.
        setSectionDims(new Map(catalog.sectionDims.map((d) => [d.designation, d])));
        // Catalog areas for the what-if mass delta preview (§7.4).
        const areas = new Map<string, number>();
        await Promise.all(
          catalog.sectionDims.slice(0, 40).map(async (d) => {
            const props = await feaClient.catalogSectionProperties(d.designation).catch(() => null);
            if (props !== null) areas.set(d.designation, props.a);
          }),
        );
        areasRef.current = areas;
      }
      setModal(modalReport);
    })();
    return () => {
      cancelled = true;
    };
  }, [project]);
  useEffect(() => {
    setMassKg(computeModelMassKg(project));
  }, [project]);
  useEffect(() => {
    if (!playing) {
      setHarmonic(1);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      setHarmonic(Math.sin(t * Math.PI * 2) * 0.9 + 0.1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const maxUls = uls !== undefined ? uls.beams.reduce((m, b) => Math.max(m, b.utilization), 0) : 0;
  const overloaded = (uls?.beams ?? []).filter((b) => b.utilization > 1);
  const maxSlsDeflMm =
    sls !== undefined ? sls.beams.reduce((m, b) => Math.max(m, b.midspan_deflection * 1000), 0) : 0;

  const upgradeOverloaded = () => {
    if (overloaded.length === 0 || ipeSeriesRef.current.length === 0) return;
    const undo: { beamId: number; section: string }[] = [];
    const before = computeModelMassKg(project, areasRef.current);
    for (const b of overloaded) {
      const beam = project.structure.beams.find((x) => x.id === b.beam_id);
      if (beam === undefined) continue;
      const next = nextHeavierProfile(ipeSeriesRef.current, beam.section_id, 2);
      if (next === null) continue;
      undo.push({ beamId: beam.id, section: beam.section_id });
      useProjectStore.getState().updateBeam(beam.id, { section_id: next });
    }
    if (undo.length === 0) return;
    // What-if delta preview (§7.4): mass diff from the catalog areas and the
    // previous governing utilization.
    const after = computeModelMassKg(project, areasRef.current);
    const deltaKg = after - before;
    const etaBefore = maxUls * 100;
    // Auto-solve (bug 10) refreshes the results within 150 ms; the toast
    // shows the captured "before" utilization and offers a 5 s undo.
    toast(
      `Profil renforcé — Masse : ${deltaKg >= 0 ? "+" : ""}${deltaKg.toFixed(1).replace(".", ",")} kg · Taux EC3 : ${etaBefore.toFixed(1).replace(".", ",")} % → recalcul`,
      {
        description: undo.map((u) => `B${u.beamId}: ${u.section} → profil supérieur`).join(", "),
        action: {
          label: "Annuler (⌘Z)",
          onClick: () => {
            for (const u of undo) {
              useProjectStore.getState().updateBeam(u.beamId, { section_id: u.section });
            }
          },
        },
        duration: 5_000,
      },
    );
  };

  // Deformed-shape inputs: characteristic SLS superposition (1.00G + 1.00Q)
  // for displacements, ULS utilizations for the thermal vertex colors.
  const deformed = useMemo(() => {
    if (report === null) {
      return null;
    }
    const g = report.cases.find((c) => c.code === "G");
    const q = report.cases.find((c) => c.code === "Q");
    const ndof = report.n_nodes * 6;
    const displacements = Array.from<number>({ length: ndof }).fill(0);
    for (const c of [g, q]) {
      if (c === undefined) {
        continue;
      }
      for (let i = 0; i < ndof; i++) {
        displacements[i] = (displacements[i] ?? 0) + (c.displacements[i] ?? 0);
      }
    }
    // v1.3.0: 3 calibrated thermal scales — EC3 utilization (0 → 1,00),
    // von Mises vs yield (0 → fy), or auto-normalized (0 → max).
    const colorRatios = new Map<number, number>();
    if (uls !== undefined) {
      const maxSvm = Math.max(...uls.beams.map((b) => b.max_sigma_vm), 1e-9);
      const fy = 235e6;
      for (const b of uls.beams) {
        const ratio =
          scaleMode === "ec3"
            ? Math.min(1, b.utilization / 1.25)
            : scaleMode === "svm"
              ? Math.min(1, b.max_sigma_vm / fy)
              : Math.min(1, b.max_sigma_vm / maxSvm);
        colorRatios.set(b.beam_id, ratio);
      }
    }
    const maxDefl = displacements
      .filter((_, i) => i % 6 === 2)
      .reduce((m, v) => Math.max(m, Math.abs(v)), 1e-12);
    const modelExtent = project.structure.nodes.reduce(
      (m, n) => Math.max(m, Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)),
      1,
    );
    const deformScale = (0.05 * modelExtent) / maxDefl;
    return { displacements, colorRatios, deformScale };
  }, [report, uls, project, scaleMode]);
  const amplificationRef = useRef(amplification);
  amplificationRef.current = amplification;
  const scaledDeformed = useMemo(() => {
    if (deformed === null) {
      return null;
    }
    if (viewMode === "MODE" && modal !== null) {
      const mode = modal.modes[eigenIndex] ?? modal.modes[0];
      if (mode !== undefined) {
        const ndof = project.structure.nodes.length * 6;
        const displacements = Array.from<number>({ length: ndof }).fill(0);
        for (let i = 0; i < ndof; i++) {
          displacements[i] = (mode.displacements[i] ?? 0) * harmonic;
        }
        const colorRatios = new Map<number, number>(
          project.structure.beams.map((b) => [b.id, 0.5]),
        );
        return {
          displacements,
          colorRatios,
          deformScale: deformed.deformScale * amplification,
        };
      }
    }
    return { ...deformed, deformScale: deformed.deformScale * amplification };
  }, [
    deformed,
    amplification,
    viewMode,
    modal,
    eigenIndex,
    harmonic,
    project.structure.beams,
    project.structure.nodes.length,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      {/* Compact solve header (title + Calculer + inline fault). */}
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">
          <Trans>Résultats de calcul</Trans>
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
        <p className="shrink-0 rounded border border-fea-max/40 bg-fea-max/10 p-2 text-[12px] text-fea-max">
          {fault.kind}: {fault.message}
        </p>
      ) : null}
      {/* 4-KPI strip (mockups tape_4) — p-2.5 cards, tabular digits. */}
      {report !== null ? (
        <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4" data-testid="kpi-strip">
          <KpiCard
            label="Masse totale"
            value={massKg ?? 0}
            suffix="kg"
            decimals={0}
            testId="kpi-mass"
          />
          <KpiCard
            label={
              <span className="flex items-center gap-1">
                <DeflectionLimit size={12} />
                Flèche max ELS
              </span>
            }
            value={maxSlsDeflMm}
            suffix="mm"
            testId="kpi-deflection"
          />
          <KpiCard
            label={
              <span className="flex items-center gap-1">
                <SectionCut size={12} />
                Taux max EC3
              </span>
            }
            value={maxUls * 100}
            suffix="%"
            decimals={1}
            pass={maxUls <= 1}
            onCorrective={maxUls > 1 ? upgradeOverloaded : undefined}
            expandable={uls !== undefined}
            expanded={breakdownOpen}
            onToggleExpand={uls !== undefined ? () => setBreakdownOpen((v) => !v) : undefined}
            testId="kpi-utilization"
          />
          <KpiCard
            label={
              <span className="flex items-center gap-1">
                <ModalVibration size={12} />
                1er mode propre
              </span>
            }
            value={modal?.modes[0]?.frequency_hz ?? 0}
            suffix="Hz"
            testId="kpi-modal"
          />
        </div>
      ) : null}
      {/* Expandable 4-clause EC3 breakdown (Kz = 0,5 mitigation CTA). */}
      {uls !== undefined && breakdownOpen ? (
        <>
          {(() => {
            const inspected =
              uls.beams.find((b) => b.beam_id === (selection?.beamId ?? -1)) ??
              uls.beams.reduce((m, b) => (b.utilization > m.utilization ? b : m));
            return (
              <div
                className="shrink-0 rounded-panel border border-hairline bg-panel p-2.5"
                data-testid="ec3-breakdown"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[13px] font-semibold text-ink-secondary">
                    Vérification EN 1993-1-1 — {uls.label} — P{inspected.beam_id} (
                    {inspected.governing_check})
                  </h3>
                  <div className="font-data flex flex-wrap items-center gap-1 text-[11px]">
                    <span className="rounded-[2px] border border-hairline bg-panel-subtle px-1.5 py-0.5 text-ink-secondary">
                      Classe {inspected.class_index ?? "—"}
                    </span>
                    <span className="rounded-[2px] border border-hairline bg-panel-subtle px-1.5 py-0.5 text-ink-secondary">
                      χy = {(inspected.chi_y ?? 1).toFixed(2)}
                    </span>
                    <span className="rounded-[2px] border border-hairline bg-panel-subtle px-1.5 py-0.5 text-ink-secondary">
                      χz = {(inspected.chi_z ?? 1).toFixed(2)}
                    </span>
                    <span className="rounded-[2px] border border-hairline bg-panel-subtle px-1.5 py-0.5 text-ink-secondary">
                      χLT = {inspected.chi_lt == null ? "1,00" : inspected.chi_lt.toFixed(2)}
                    </span>
                  </div>
                </div>
                <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  {inspected.checks.map(([name, ratio]) => (
                    <div key={name} className="flex items-center gap-2">
                      <dt className="font-data w-24 shrink-0 text-[11px] text-ink-secondary">
                        {name}
                      </dt>
                      <UtilizationProgress value={ratio} className="flex-1" />
                      <dd className="font-data w-16 shrink-0 text-right text-[11px] text-ink-primary">
                        {(ratio * 100).toFixed(1).replace(".", ",")} %
                      </dd>
                    </div>
                  ))}
                </dl>
                {inspected.utilization > 1 ? (
                  <button
                    type="button"
                    className="mt-2 rounded border border-hairline px-2 py-1 text-[12px] text-accent hover:bg-accent-tint"
                    data-testid="mitigate-lateral"
                    onClick={() => {
                      const target = inspected.beam_id;
                      updateBeam(target, { k_buckling_z: 0.5 });
                      toast("Maintien latéral mi-travée (kz = 0,5)", {
                        description: "Recalcul automatique en cours…",
                      });
                    }}
                  >
                    Maintien latéral mi-travée (kz = 0,5)
                  </button>
                ) : null}
              </div>
            );
          })()}
          <div
            className={`shrink-0 rounded border border-fail-border bg-fail-bg p-2 text-[12px] text-fail-text ${maxUls > 1 ? "" : "hidden"}`}
            data-testid="governing-diagnostic"
          >
            <Trans>
              Vérification EC3 dépassée — élément déterminant : P
              {uls.beams.reduce((m, b) => (b.utilization > m.utilization ? b : m)).beam_id} (η =
              {(maxUls * 100).toFixed(1).replace(".", ",")} %). Un renforcement en 1 clic est
              proposé.
            </Trans>
          </div>
        </>
      ) : null}
      {/* Center: full-bleed deformed viewport with the consolidated control
          bar docked below the camera presets (top-right) and the thermal
          legend bar bottom-center. */}
      {report !== null && scaledDeformed !== null ? (
        <section className="relative min-h-[260px] flex-1 overflow-hidden rounded-panel border border-hairline bg-panel">
          <ViewportCanvas
            testId="results-viewport"
            nodes={project.structure.nodes}
            beams={project.structure.beams}
          >
            <BeamMeshes
              nodes={project.structure.nodes}
              beams={project.structure.beams}
              colorRatios={scaledDeformed.colorRatios}
              displacements={scaledDeformed.displacements}
              deformScale={scaledDeformed.deformScale}
              wireframe={false}
              selectedBeamId={null}
              onPick={() => {}}
              sectionDims={sectionDims}
            />
            <SupportMarkers nodes={project.structure.nodes} supports={project.structure.supports} />
            <ForceVectors3D
              nodes={project.structure.nodes}
              beams={project.structure.beams}
              loads={project.structure.loads}
            />
            <CuttingPlane
              nodes={project.structure.nodes}
              beams={project.structure.beams}
              beamId={cutBeamId}
              ratio={station}
            />
          </ViewportCanvas>
          {/* Single consolidated control bar (combination / eigenmode 1..6,
              harmonic play, thermal scale, amplification, mobile PDF). */}
          <div
            className="absolute right-2 top-12 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-1.5 rounded-panel border border-hairline bg-panel/90 p-1.5 backdrop-blur"
            data-testid="results-controls"
          >
            <div
              className="flex items-center gap-0.5 rounded border border-hairline p-0.5"
              data-testid="view-selector"
            >
              {(["ELU", "ELS"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`rounded px-1.5 py-0.5 text-[11px] ${viewMode === mode ? "bg-accent-tint text-accent" : "text-ink-secondary"}`}
                  onClick={() => setViewMode(mode)}
                >
                  {mode === "ELU" ? "ELU 1.35G + 1.50Q" : "ELS 1.00G + 1.00Q"}
                </button>
              ))}
              {modal !== null
                ? modal.modes.slice(0, 6).map((m) => (
                    <button
                      key={m.mode_index}
                      type="button"
                      className={`rounded px-1.5 py-0.5 text-[11px] ${viewMode === "MODE" && eigenIndex === m.mode_index - 1 ? "bg-accent-tint text-accent" : "text-ink-secondary"}`}
                      onClick={() => {
                        setEigenIndex(m.mode_index - 1);
                        setViewMode("MODE");
                      }}
                    >
                      Mode {m.mode_index} ({m.frequency_hz.toFixed(2)} Hz)
                    </button>
                  ))
                : null}
            </div>
            {viewMode === "MODE" ? (
              <button
                type="button"
                className="relative rounded border border-hairline px-2 py-0.5 text-[11px] text-ink-secondary"
                onClick={() => setPlaying(!playing)}
                data-testid="modal-play"
              >
                {playing ? "⏸ Pause" : "▶ Play harmonique"}
              </button>
            ) : null}
            <div
              className="flex items-center gap-0.5 rounded border border-hairline p-0.5"
              data-testid="scale-modes"
            >
              {(
                [
                  ["ec3", "Taux EC3"],
                  ["svm", "σvM / fy"],
                  ["auto", "Auto"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  data-testid={`scale-${mode}`}
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    scaleMode === mode ? "bg-accent-tint text-accent" : "text-ink-secondary"
                  }`}
                  onClick={() => setScaleMode(mode)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-ink-secondary">
              <Trans>Amplification</Trans>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={amplification}
                className="w-24"
                onChange={(e) => setAmplification(Number(e.currentTarget.value))}
              />
              <span className="font-data">×{amplification}</span>
            </label>
            {/* v1.5.0 mobile: 1-tap hand-off to the A4/PDF note. */}
            <button
              type="button"
              className="rounded bg-accent px-2 py-1 text-[11px] text-white md:hidden"
              data-testid="mobile-report-pdf"
              onClick={() => void navigate({ to: "/report" })}
            >
              <Trans>Rapport PDF</Trans>
            </button>
          </div>
          {/* Bottom-center horizontal thermal legend bar (η = 0 → 1.25). */}
          <div
            className="absolute bottom-2 left-1/2 z-10 flex w-64 max-w-[70%] -translate-x-1/2 items-center gap-2 rounded-panel border border-hairline bg-panel/90 p-1.5 backdrop-blur"
            data-testid="fea-legend"
          >
            <span className="font-data text-[11px] text-ink-muted">η = 0</span>
            <div
              className="h-2 flex-1 rounded"
              style={{
                background: `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1]
                  .map((t) => {
                    const [r, g, b] = spectrumColor(t);
                    return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)}) ${t * 100}%`;
                  })
                  .join(", ")})`,
              }}
            />
            <span className="font-data text-[11px] text-ink-muted">η = 1.25</span>
          </div>
        </section>
      ) : null}
      {/* Bottom precision dock (h-[220px]): σvM cut + fiber stresses |
          uPlot forces with ±M_Rd capacity lines. */}
      {report !== null && project.structure.beams.length > 0 ? (
        <DockedInspector
          project={project}
          beams={project.structure.beams}
          beamId={cutBeamId}
          station={station}
          onBeamChange={setCutBeamId}
          onStationChange={setStation}
          slsLabel={sls?.label}
          maxSlsDeflMm={maxSlsDeflMm}
          mRd={uls?.beams.find((b) => b.beam_id === cutBeamId)?.m_rd ?? null}
        />
      ) : null}
      {/* Phone drawer: nodal displacements + SI/UI conversion note. */}
      {isMobile ? (
        <BottomSheet testId="inspector-sheet" title={<Trans>Déplacements nodaux (Q)</Trans>}>
          {report === null ? (
            <p className="text-[13px] text-ink-muted">
              <Trans>Lancer un calcul pour afficher les résultats.</Trans>
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
              Un facteur de cas sert d'ordre de grandeur : conversions SI vers affichage exclusives
              à l'UI.
            </Trans>
          </p>
          <p className="font-data mt-1 text-[11px] text-ink-muted">
            {report !== null ? `${report.n_nodes} nœuds / ${report.n_beams} poutres` : ""}
          </p>
        </BottomSheet>
      ) : null}
    </div>
  );
}

/** One KPI card (DESIGN.md §6: 2px badges, tabular figures, p-2.5). */
function KpiCard({
  label,
  value,
  suffix = "",
  decimals = 2,
  pass,
  onCorrective,
  expandable,
  expanded,
  onToggleExpand,
  testId,
}: {
  label: React.ReactNode;
  value: number;
  suffix?: string;
  decimals?: number;
  pass?: boolean;
  onCorrective?: () => void;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  testId?: string;
}) {
  return (
    <div className="rounded border border-hairline bg-panel p-2.5" data-testid={testId}>
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p className="mt-1 text-[17px] font-semibold text-ink-primary">
        <NumberFlowValue
          value={value}
          format={{ minimumFractionDigits: decimals, maximumFractionDigits: decimals }}
        />
        <span className="font-data text-[12px] text-ink-secondary"> {suffix}</span>
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {pass !== undefined ? (
          <span
            className={`font-data inline-block rounded border px-1.5 py-0.5 text-[11px] ${
              pass
                ? "border-pass-border bg-pass-bg text-pass-text"
                : "border-fail-border bg-fail-bg text-fail-text"
            }`}
          >
            {pass ? "Conforme EC3" : "Dépassement EC3"}
          </span>
        ) : null}
        {onCorrective !== undefined ? (
          <button
            type="button"
            className="rounded bg-accent px-2 py-1 text-[11px] text-white"
            data-testid="upgrade-1click"
            onClick={onCorrective}
          >
            Renforcer (1 clic)
          </button>
        ) : null}
        {expandable === true && onToggleExpand !== undefined ? (
          <button
            type="button"
            aria-expanded={expanded === true}
            data-testid="ec3-toggle"
            className="ml-auto rounded border border-hairline px-1.5 py-0.5 text-[10px] text-ink-secondary"
            onClick={onToggleExpand}
          >
            {expanded === true ? "Replier" : "Détails EC3"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Bottom precision dock (v1.5.0, h-[220px], grid-cols-[280px_1fr]): the 2D
 * σvM cross-section heatmap with TOP / neutral-axis / BOTTOM fiber stress
 * readouts beside the uPlot internal-force diagrams (My, Vz, N) with the
 * dashed crimson ±M_Rd capacity lines and live cursor force readouts.
 */
function DockedInspector({
  project,
  beams,
  beamId,
  station,
  onBeamChange,
  onStationChange,
  slsLabel,
  maxSlsDeflMm,
  mRd,
}: {
  project: ReturnType<typeof useProjectStore.getState>["project"];
  beams: { id: number; section_id: string }[];
  beamId: number;
  station: number;
  onBeamChange: (id: number) => void;
  onStationChange: (ratio: number) => void;
  slsLabel?: string;
  maxSlsDeflMm: number;
  mRd: number | null;
}) {
  const [stress, setStress] = useState<StressGrid | null>(null);
  const [forces, setForces] = useState<SpanForceSample[] | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);
  // v1.4.0: cursor anchored to the uPlot canvas (plot-area coordinates).
  const [cursorLeftPx, setCursorLeftPx] = useState(0);
  const syncCursor = useCallback(() => {
    const plot = uplotRef.current;
    if (plot === null) {
      return;
    }
    const x = plot.valToPos(station * (plot.data[0]?.[plot.data[0].length - 1] ?? 1), "x");
    const px = x + plot.bbox.left / (window.devicePixelRatio || 1);
    setCursorLeftPx(Math.min(Math.max(0, px), plot.bbox.width / (window.devicePixelRatio || 1)));
  }, [station]);
  useEffect(() => {
    syncCursor();
  }, [syncCursor]);
  const scrubTo = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const plot = uplotRef.current;
      if (plot === null || plot.data[0] === undefined || plot.data[0].length < 2) {
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const stationMax = plot.data[0][plot.data[0].length - 1] ?? 1;
      const value = plot.posToVal(px, "x");
      const ratio = Math.min(1, Math.max(0, value / stationMax));
      onStationChange(ratio);
    },
    [onStationChange],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [grid, samples] = await Promise.all([
        feaClient.sectionStress(project, beamId, station, 24).catch(() => null),
        feaClient.beamSpanForces(project, beamId, 24).catch(() => null),
      ]);
      if (!cancelled) {
        setStress(grid);
        setForces(samples);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project, beamId, station]);

  const fibers = useMemo(() => (stress !== null ? fiberStresses(stress) : null), [stress]);
  // Live cursor force readouts: linear interpolation across the samples.
  const cursorForces = useMemo(() => {
    if (forces === null || forces.length === 0) {
      return null;
    }
    const xMax = forces[forces.length - 1]?.ratio ?? 1;
    const target = Math.min(1, Math.max(0, station)) * xMax;
    let lo = 0;
    for (const [i, f] of forces.entries()) {
      if (f.ratio <= target) {
        lo = i;
      } else {
        break;
      }
    }
    const a = forces[lo];
    const b = forces[Math.min(lo + 1, forces.length - 1)];
    if (a === undefined || b === undefined) {
      return null;
    }
    const span = b.ratio - a.ratio || 1;
    const t = Math.min(1, Math.max(0, (target - a.ratio) / span));
    const lerp = (x: number, y: number) => x + (y - x) * t;
    return {
      my: lerp(a.my, b.my) / 1000,
      vz: lerp(a.vz, b.vz) / 1000,
      n: lerp(a.n, b.n) / 1000,
    };
  }, [forces, station]);

  useEffect(() => {
    if (forces === null || plotRef.current === null) {
      return;
    }
    const data: uPlot.AlignedData = [
      forces.map((f) => f.ratio),
      forces.map((f) => f.my / 1e3),
      forces.map((f) => f.vz / 1e3),
      forces.map((f) => f.n / 1e3),
      ...(mRd !== null ? [forces.map(() => mRd / 1000), forces.map(() => -mRd / 1000)] : []),
    ] as unknown as uPlot.AlignedData;
    const opts: uPlot.Options = {
      width: plotRef.current.clientWidth,
      height: 150,
      legend: { show: true },
      axes: [{}, { values: (u: uPlot, ticks: number[]) => ticks.map((v) => `${v.toFixed(0)}`) }],
      series: [
        {},
        { label: "My (kN·m)", stroke: "#1d4ed8", width: 1.5 },
        { label: "Vz (kN)", stroke: "#dc2626", width: 1.5 },
        { label: "N (kN)", stroke: "#10b981", width: 1.5 },
        ...(mRd !== null
          ? [
              { label: "+M_Rd", stroke: "#dc2626", width: 1.5, dash: [6, 4] },
              { label: "−M_Rd", stroke: "#dc2626", width: 1.5, dash: [6, 4] },
            ]
          : []),
      ] as uPlot.Series[],
    };
    const plot = new uPlot(opts, data, plotRef.current);
    uplotRef.current = plot;
    return () => {
      plot.destroy();
      uplotRef.current = null;
    };
  }, [forces, mRd]);

  return (
    <section
      className="grid h-[220px] shrink-0 grid-cols-1 gap-3 rounded-panel border border-hairline bg-panel p-2.5 lg:grid-cols-[280px_1fr]"
      data-testid="docked-inspector"
    >
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-ink-secondary">Coupe 2D σvM</h3>
          <select
            className="font-data h-7 rounded border border-hairline px-1 text-[11px]"
            value={beamId}
            onChange={(e) => onBeamChange(Number(e.currentTarget.value))}
          >
            {beams.map((b) => (
              <option key={b.id} value={b.id}>
                B{b.id}
              </option>
            ))}
          </select>
        </div>
        {stress !== null ? <HeatmapSvg grid={stress} /> : null}
        {/* v1.5.0: top fiber / neutral axis / bottom fiber σvM readouts. */}
        {fibers !== null ? (
          <div
            className="font-data mt-1 grid grid-cols-3 gap-1 text-[10px] text-ink-secondary"
            data-testid="fiber-stresses"
          >
            <span>σsup {fibers.top.toFixed(1)} MPa</span>
            <span>σNA {fibers.na.toFixed(1)} MPa</span>
            <span>σinf {fibers.bottom.toFixed(1)} MPa</span>
          </div>
        ) : null}
        <label className="mt-1 flex items-center gap-2 text-[10px] text-ink-muted">
          x ∈ [0, L]
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={station}
            className="flex-1"
            onChange={(e) => onStationChange(Number(e.currentTarget.value))}
          />
          <span className="font-data">{station.toFixed(2)} L</span>
        </label>
        <h3 className="mt-1 border-t border-hairline pt-1 text-[11px] font-medium text-ink-secondary">
          {slsLabel !== undefined ? `${slsLabel} · Déplacements ELS` : "Déplacements ELS"}
        </h3>
        <p className="font-data text-[11px] text-ink-primary">
          Flèche max = {formatMm(maxSlsDeflMm / 1000)}
        </p>
      </div>
      <div className="flex min-h-0 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-ink-secondary">Efforts internes</h3>
          {/* Live cursor readouts at the scrubbed station. */}
          <div
            className="font-data flex gap-2 text-[10px] text-ink-secondary"
            data-testid="cursor-readouts"
          >
            {cursorForces !== null ? (
              <span>
                My = {cursorForces.my.toFixed(1)} kN·m · Vz = {cursorForces.vz.toFixed(1)} kN · N ={" "}
                {cursorForces.n.toFixed(1)} kN
              </span>
            ) : null}
          </div>
        </div>
        <div className="relative mt-1 min-h-0 flex-1" data-testid="forces-plot">
          {/* v1.4.0: click/drag to scrub the station across the diagrams. */}
          <div
            ref={plotRef}
            className="cursor-crosshair"
            data-testid="forces-plot-surface"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              scrubTo(e);
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                scrubTo(e);
              }
            }}
          />
          {/* Vertical cursor anchored to the uPlot plot area (§8.5). */}
          <div
            className="pointer-events-none absolute top-0 h-full w-px bg-accent"
            style={{ left: `${cursorLeftPx}px` }}
            data-testid="uplot-cursor"
          />
        </div>
      </div>
    </section>
  );
}

/**
 * σvM fiber extraction (v1.5.0): top fiber = extreme +z point, bottom
 * fiber = extreme −z point, neutral axis = σvM mean over the points within
 * 5% of mid-height. All converted Pa → MPa for the readout.
 */
function fiberStresses(grid: StressGrid): { top: number; na: number; bottom: number } | null {
  const first = grid.points[0];
  if (first === undefined) {
    return null;
  }
  const [y0, y1, z0, z1] = grid.bounds;
  void y0;
  void y1;
  const zMid = (z0 + z1) / 2;
  let top = first;
  let bottom = first;
  let naSum = 0;
  let naCount = 0;
  const tol = ((z1 - z0) / 2) * 0.05 + 1e-9;
  for (const p of grid.points) {
    if (p.z > top.z) {
      top = p;
    }
    if (p.z < bottom.z) {
      bottom = p;
    }
    if (Math.abs(p.z - zMid) <= tol) {
      naSum += p.sigma_vm;
      naCount += 1;
    }
  }
  const na = naCount > 0 ? naSum / naCount : (top.sigma_vm + bottom.sigma_vm) / 2;
  return { top: top.sigma_vm / 1e6, na: na / 1e6, bottom: bottom.sigma_vm / 1e6 };
}

/** sigma_vM heatmap: points -> colored squares scaled into a fixed viewBox. */
function HeatmapSvg({ grid }: { grid: StressGrid }) {
  const [y0, y1, z0, z1] = grid.bounds;
  const max = grid.points.reduce((m: number, p) => Math.max(m, p.sigma_vm), 1e-9);
  const tier = (ratio: number): string => {
    if (ratio < 0.2) return "#1d4ed8";
    if (ratio < 0.5) return "#06b6d4";
    if (ratio < 0.8) return "#10b981";
    if (ratio <= 1.0) return "#f59e0b";
    return "#dc2626";
  };
  const w = 120;
  const h = 80;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-1 h-20 w-full"
      role="img"
      aria-label="sigma heatmap"
    >
      <rect x="0" y="0" width={w} height={h} fill="#f8fafc" />
      {grid.points.map((p, i) => {
        const x = ((p.y - y0) / (y1 - y0 || 1)) * (w - 12) + 6;
        const y = ((z1 - p.z) / (z1 - z0 || 1)) * (h - 12) + 6;
        const ratio = p.sigma_vm / max;
        return (
          <rect
            key={i}
            x={x - 1.5}
            y={y - 1.5}
            width="3"
            height="3"
            fill={tier(ratio)}
            opacity={0.25 + 0.75 * ratio}
          />
        );
      })}
    </svg>
  );
}
