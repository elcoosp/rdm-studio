import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ResultsFullSearchSchema } from "@/schemas/searchParams.schema";
import { useSelectedIds, useUpdateSearch, useViewportParams } from "@/hooks/useStudioQuery";
import { IconResults } from "@rdm-studio/ui/icons";
import { BottomSheet } from "@/components/BottomSheet";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { computeModelMassKg, nextHeavierProfile } from "@/lib/resultsMath";
import { NumberFlowValue } from "@rdm-studio/ui/interior";
import { LoadCombination, ModalVibration, SectionCut, DeflectionLimit } from "@rdm-studio/ui/icons";
import type { SectionDims, SpanForceSample, StressGrid } from "@/wasmBridge/workerClient";
import { formatMm } from "@/lib/units";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { UtilizationProgress } from "@/components/ui/progress";
import { ArrowLeftRight, SlidersHorizontal, AlertTriangle, Wrench } from "lucide-react";
import {
  feaClient,
  type BeamEnvelopeDto,
  type ModalReport,
  type SolveFault,
  type SolveReport,
} from "@/wasmBridge/workerClient";
import { useProjectStore } from "@/state/projectStore";
import { ForceDiagrams3DPanel } from "@/viewport3d/ForceDiagrams3D";
import { OptimizerModal } from "@/components/OptimizerModal";
import { AdvancedPanels } from "@/components/AdvancedPanels";
import { ScenarioCompareModal } from "@/components/ScenarioCompareModal";
import { ConnectionStudioModal } from "@/components/ConnectionStudioModal";
import { MovingLoadPanel } from "@/components/MovingLoadPanel";
import type { StoreyDriftResult } from "@/wasmBridge/workerClient";
import { StageContent, useStageSlot } from "@/state/stageStore";
import { spectrumColor } from "@rdm-studio/ui/viewport";
import {
  LoadingButton,
  SegmentedControl,
  SliderDetents,
  StatusBadge,
  Tooltip,
} from "@rdm-studio/ui/interior";
import { SelectContent, SelectItem, SelectRoot, SelectTrigger } from "@/components/ui/select";
import { trackProductEvent } from "@/lib/productTelemetry";

export const Route = createFileRoute("/_studio/results")({
  staticData: {
    surface: "studio",
    stepOrder: 4,
    label: "Calcul 3D & Eurocode 3",
    mobileLabel: "Résultats",
    icon: IconResults,
    stageVisible: true,
    shortcut: "4",
  },
  validateSearch: (search) => v.parse(ResultsFullSearchSchema, search),
  component: ResultsPage,
});

/** EN 1990 SLS deflection allowances (requirement: L/200 | L/250 | L/300). */
const SLS_LIMITS = [
  [200, "L/200"],
  [250, "L/250"],
  [300, "L/300"],
] as const;

/**
 * Step 4 (DESIGN.md §4 metrology layout, mockups tape_4, v1.6.0): 3-zone
 * zero-scroll metrology cockpit — compact 4-KPI strip → full-bleed
 * deformed persistent viewport with the combination selector (every
 * computed EN 1990 ULS/SLS combination + Modes propres 1..6), the
 * `L/200 | L/250 | L/300` SLS selector and the right 340px EC3
 * diagnostic rail (`Classe · χy · χz · χLT`, `Npl,Rd · Vpl,Rd · Mcr ·
 * λLT`, both mitigation buttons) → h-[220px] precision dock (2D σvM
 * cross-section + fiber stresses | uPlot My/Mz/Vz/N/T with dashed
 * crimson ±M_Rd capacity lines, ResizeObserver-backed).
 */
/**
 * v2.2.0: pedagogical solver fault card (Swiss Metrology diagnostic alert).
 * Replaces the raw mechanism dump banner: a crisp French summary of the
 * unconstrained DOFs, a collapsible raw-details section for the audit trail,
 * and a 1-click `Activer Plan 2D & recalculer` fix when the out-of-plane
 * Uy / Rx / Rz DOFs are the cause (sets `plane_frame_2d: true` and re-runs
 * the solver through the debounced auto-solve path).
 */
function SolverFaultCard({ fault, onRerun }: { fault: SolveFault; onRerun: () => void }) {
  const updateSettings = useProjectStore((s) => s.updateSettings);
  const outOfPlane = /\b(?:Uy|Rx|Rz)\b|out-of-plane|plane frame|hors plan/i.test(fault.message);
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <div
      className="flex shrink-0 items-start gap-2.5 rounded-[8px] border border-fail-border bg-fail-bg p-3"
      data-testid="solve-fault"
    >
      <AlertTriangle
        size={20}
        strokeWidth={1.5}
        className="mt-0.5 shrink-0 text-fail-text"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-fail-text">
          <Trans>Le solveur a détecté un mécanisme</Trans>
        </p>
        <p className="mt-1 text-[12px] leading-5 text-fail-text/85">
          {outOfPlane ? (
            <Trans>
              Certains degrés de liberté hors plan (Uy, Rx, Rz) ne sont pas contraints : le modèle
              est hypostatique. Pour un portique ou une poutre plane, le mode plan 2D ajoute
              automatiquement ces liaisons et relance le calcul.
            </Trans>
          ) : (
            <Trans>
              Certains degrés de liberté restent libres : le modèle n'est pas suffisamment soutenu.
              Vérifiez les appuis de l'étape Liaisons ou les relâchements d'extrémité avant de
              recalculer.
            </Trans>
          )}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {outOfPlane ? (
            <button
              type="button"
              data-testid="fix-plane-2d"
              className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-accent-strong"
              onClick={() => {
                updateSettings({ plane_frame_2d: true });
                toast.success(t`Plan 2D activé — recalcul en cours`, { duration: 3200 });
                onRerun();
              }}
            >
              <Trans>Activer Plan 2D & recalculer</Trans>
            </button>
          ) : (
            <a
              href="/supports"
              data-testid="fix-go-supports"
              className="inline-flex items-center gap-1.5 rounded bg-accent px-3 py-1 text-[12px] font-semibold text-white hover:bg-accent-strong"
            >
              <Trans>Aller aux Liaisons →</Trans>
            </a>
          )}
          <button
            type="button"
            aria-expanded={detailsOpen}
            data-testid="fault-details-toggle"
            className="rounded border border-hairline bg-panel px-2.5 py-1.5 text-[12px] font-medium text-ink-secondary hover:border-accent hover:text-accent"
            onClick={() => setDetailsOpen((v) => !v)}
          >
            {detailsOpen ? t`Masquer les détails` : t`Détails techniques`}
          </button>
        </div>
        {detailsOpen ? (
          <pre
            className="font-data mt-2.5 max-h-44 overflow-auto rounded-[4px] border border-hairline bg-panel p-2 text-[11px] leading-4 text-ink-secondary"
            data-testid="fault-details"
          >
            {`${fault.kind}\n${fault.message}`}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

function ResultsPage() {
  const project = useProjectStore((s) => s.project);
  const updateBeam = useProjectStore((s) => s.updateBeam);
  const [report, setReport] = useState<SolveReport | null>(null);
  const [fault, setFault] = useState<SolveFault | null>(null);
  const [busy, setBusy] = useState(false);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const navigate = useNavigate();
  const slotRef = useStageSlot("results");
  // v2.1.0: EVERY Step 4 selection lives in the URL (`combo`, `sls`,
  // `scale`, `cutBeam`, `cut`, `diagrams`, `modal`) — no Zustand or
  // useState mirror anywhere.
  const search = Route.useSearch();
  const updateSearch = useUpdateSearch();
  const { beamId: selectedBeamId } = useSelectedIds();
  const { cutting, setCutting } = useViewportParams();

  const run = () => {
    setBusy(true);
    setFault(null);
    void trackProductEvent("solve_attempted", {
      n_nodes: project.structure.nodes.length,
      n_beams: project.structure.beams.length,
      n_load_cases: project.structure.loads.length,
    });
    void feaClient
      .solveModel(project)
      .then((r) => {
        setReport(r);
        setFault(null);
      })
      .catch((f: SolveFault) => {
        setFault(f);
        setReport(null);
        void trackProductEvent("solver_fault", { fault: f.kind });
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

  const combinations = report?.combinations ?? [];
  const viewKey = search.combo ?? "SLS:0";
  const setViewKey = (next: string) => {
    updateSearch((prev) => ({ ...prev, combo: next === "SLS:0" ? undefined : next }));
  };
  // M10.5 (EN 1990 envelopes): the Min/Max envelope engine runs in the
  // worker lane on demand — only when an `ENV:ULS` / `ENV:SLS` view is
  // selected. The per-member (min, max) tuples feed the docked uPlot
  // shaded bands and the 3D extremum callouts.
  const isEnvelopeView = viewKey.startsWith("ENV");
  const [envelopes, setEnvelopes] = useState<BeamEnvelopeDto[] | null>(null);
  useEffect(() => {
    if (!isEnvelopeView) {
      setEnvelopes(null);
      return;
    }
    let cancelled = false;
    void feaClient
      .engineCall("compute_envelopes_json", project)
      .then((result) => {
        if (!cancelled) {
          setEnvelopes(result as BeamEnvelopeDto[]);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isEnvelopeView, project, report]);

  const slsDenominator = search.sls ?? 250;
  const setSlsDenominator = (next: 200 | 250 | 300) => {
    updateSearch((prev) => ({ ...prev, sls: next === 250 ? undefined : next }));
  };
  const [modal, setModal] = useState<ModalReport | null>(null);
  const [sectionDims, setSectionDims] = useState<Map<string, SectionDims>>(new Map());
  const scaleMode = search.scale ?? "ec3";
  const setScaleMode = (next: "ec3" | "svm" | "auto") => {
    updateSearch((prev) => ({ ...prev, scale: next === "ec3" ? undefined : next }));
  };
  const [eigenIndex, _setEigenIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [harmonic, setHarmonic] = useState(1);
  const [breakdownOpen, setBreakdownOpen] = useState(true);
  // v2.1.1: the 340px rail splits into 2 tabs (EC3 verification |
  // advanced analyses) so λcr / sismique / multimatière never clip.
  const [railTab, setRailTab] = useState<"ec3" | "advanced">("ec3");
  // The docked inspector drives `?cutBeam=` + `?cut=` (0..1) directly —
  // the persistent stage renders the plane from the URL, no store hop.
  const cutBeamId = cutting?.beamId ?? project.structure.beams[0]?.id ?? 0;
  const station = cutting?.ratio ?? 0.5;
  const setCutBeamId = (id: number) => setCutting({ beamId: id, ratio: station });
  const setStation = (ratio: number) => {
    setCutting({ beamId: cutBeamId, ratio });
    void trackProductEvent("section_cut_used", { axis: "z" });
  };
  // v2.1.0: optimizer / scenario modals ride `?modal=optim|compare`.
  const optimizerOpen = search.modal === "optim";
  const setOptimizerOpen = (open: boolean) => {
    updateSearch((prev) => ({ ...prev, modal: open ? "optim" : undefined }));
  };
  const scenarioOpen = search.modal === "compare";
  const setScenarioOpen = (open: boolean) => {
    updateSearch((prev) => ({ ...prev, modal: open ? "compare" : undefined }));
  };
  // M12.1: Studio Assemblages EC3-1-8 rides `?modal=connection` so the
  // ⌘K palette entry deep-links straight into the dialog.
  const connectionOpen = search.modal === "connection";
  const setConnectionOpen = (open: boolean) => {
    updateSearch((prev) => ({ ...prev, modal: open ? "connection" : undefined }));
  };
  // M12.3: SLS inter-storey drift of the storey levels (1/300 or 1/500).
  const [drift, setDrift] = useState<StoreyDriftResult | null>(null);
  const [driftLimit, setDriftLimit] = useState<300 | 500>(300);
  useEffect(() => {
    if ((project.structure.levels?.length ?? 0) < 2) {
      setDrift(null);
      return;
    }
    let cancelled = false;
    feaClient
      .storeyDrift(project, driftLimit)
      .then((report) => {
        if (!cancelled) setDrift(report);
      })
      .catch(() => {
        if (!cancelled) setDrift(null);
      });
    return () => {
      cancelled = true;
    };
  }, [project, driftLimit]);
  // v2.1.0: the true 3D on-member ForceDiagrams3D layer mounts in the
  // persistent stage when `diagrams=1` (the docked panel stays below).
  const diagramsOpen = search.diagrams === 1;
  const setDiagramsOpen = (open: boolean) => {
    updateSearch((prev) => ({ ...prev, diagrams: open ? 1 : undefined }));
    void trackProductEvent("force_diagram_toggled", { visible: open });
  };
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
        // v1.6.0 audit C: exact catalog areas ride the shapes catalog —
        // ZERO extra `catalogSectionProperties` worker roundtrips.
        areasRef.current = new Map(
          catalog.sectionDims.filter((d) => d.a > 0).map((d) => [d.designation, d.a]),
        );
      }
      // v2.1.1: only accept a usable modal report — a payload without a
      // `modes` array (small/ill-conditioned models) used to crash the
      // whole Step 4 cockpit (`modes[0]` of undefined).
      setModal(modalReport !== null && Array.isArray(modalReport.modes) ? modalReport : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [project]);
  useEffect(() => {
    setMassKg(computeModelMassKg(project, areasRef.current));
  }, [project, sectionDims]);
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

  // Keep the cutting-plane target valid as members come and go — an
  // invalid `?cutBeam=` is stripped from the URL instead of crashing.
  useEffect(() => {
    if (project.structure.beams.length === 0) {
      return;
    }
    if (cutting !== null && !project.structure.beams.some((b) => b.id === cutting.beamId)) {
      setCutting(null);
    }
  }, [project.structure.beams, cutting, setCutting]);

  // v2.1.2: registered items (value → label) so the closed Select trigger
  // shows the human combination label instead of the raw `SLS:0` key.
  const comboItems = useMemo(() => {
    const items = combinations.map((c, i) => ({
      value: `${c.kind}:${i}`,
      label: c.label,
    }));
    // M10.5: multi-case Min/Max envelope views (EN 1990 ELU / ELS).
    items.push({ value: "ENV:ULS", label: t`Enveloppe ELU (Min/Max)` });
    items.push({ value: "ENV:SLS", label: t`Enveloppe ELS (Min/Max)` });
    for (const m of (modal?.modes ?? []).slice(0, 6)) {
      items.push({
        value: `MODE:${m.mode_index - 1}`,
        label: `Mode propre ${m.mode_index} · ${m.frequency_hz.toFixed(2).replace(".", ",")} Hz`,
      });
    }
    return items;
  }, [combinations, modal]);

  const uls = combinations.find((c) => c.kind === "ULS");
  const sls = combinations.find((c) => c.kind === "SLS");
  const maxUls = uls !== undefined ? uls.beams.reduce((m, b) => Math.max(m, b.utilization), 0) : 0;
  const overloaded = (uls?.beams ?? []).filter((b) => b.utilization > 1);
  const maxSlsDeflMm =
    sls !== undefined ? sls.beams.reduce((m, b) => Math.max(m, b.midspan_deflection * 1000), 0) : 0;
  // v1.6.0: longest member drives the SLS allowance (L/200 | L/250 | L/300).
  const maxBeamLength = project.structure.beams.reduce((m, b) => {
    const n1 = project.structure.nodes.find((n) => n.id === b.n1);
    const n2 = project.structure.nodes.find((n) => n.id === b.n2);
    if (n1 === undefined || n2 === undefined) return m;
    return Math.max(m, Math.hypot(n2.x - n1.x, n2.y - n1.y, n2.z - n1.z));
  }, 0);
  const slsAllowanceMm = (maxBeamLength / slsDenominator) * 1000;
  const slsPass = maxSlsDeflMm > 0 ? maxSlsDeflMm <= slsAllowanceMm : true;

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

  // Deformed-shape inputs: the SELECTED combination's exact multipliers
  // superpose every elementary case (v1.6.0: no more hardcoded 1.35/1.50).
  const selectedCombo = useMemo(() => {
    const [kindPart, indexPart] = viewKey.split(":");
    const index = Number(indexPart ?? 0);
    const matches = combinations.filter((c) => c.kind === kindPart);
    return matches[index] ?? sls ?? combinations[0];
  }, [viewKey, combinations, sls]);
  const isModeView = viewKey.startsWith("MODE");

  const deformed = useMemo(() => {
    if (report === null || selectedCombo === undefined) {
      return null;
    }
    const ndof = report.n_nodes * 6;
    const displacements = Array.from<number>({ length: ndof }).fill(0);
    for (const [code, factor] of selectedCombo.multipliers) {
      const c = report.cases.find((k) => k.code === code);
      if (c === undefined) {
        continue;
      }
      for (let i = 0; i < ndof; i++) {
        displacements[i] = (displacements[i] ?? 0) + factor * (c.displacements[i] ?? 0);
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
  }, [report, uls, project, scaleMode, selectedCombo]);
  const amplification = 1;
  const scaledDeformed = useMemo(() => {
    if (deformed === null) {
      return null;
    }
    if (isModeView && modal !== null) {
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
        return { displacements, colorRatios, deformScale: deformed.deformScale };
      }
    }
    return { ...deformed, deformScale: deformed.deformScale * amplification };
  }, [
    deformed,
    isModeView,
    modal,
    eigenIndex,
    harmonic,
    project.structure.beams,
    project.structure.nodes.length,
  ]);

  const inspected =
    uls !== undefined
      ? (uls.beams.find((b) => b.beam_id === (selectedBeamId ?? -1)) ??
        uls.beams.reduce((m, b) => (b.utilization > m.utilization ? b : m)))
      : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      {/* Zone 1 — compact solve header + KPI strip. */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">
          <Trans>Résultats de calcul</Trans>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div data-testid="sls-limit-selector" className="shrink-0">
            <SegmentedControl
              size="sm"
              label={t`Limite de flèche ELS`}
              value={String(slsDenominator)}
              onValueChange={(next) => setSlsDenominator(Number(next) as 200 | 250 | 300)}
              options={SLS_LIMITS.map(([denominator, label]) => ({
                value: String(denominator),
                label,
                testId: `sls-limit-${denominator}`,
              }))}
            />
          </div>

          <SelectRoot
            items={comboItems}
            value={viewKey}
            onValueChange={(next) => {
              if (next !== null) setViewKey(next);
            }}
          >
            <SelectTrigger
              className="h-7 w-44 gap-1 font-data text-[11px]"
              data-testid="combination-selector"
              aria-label={t`Combinaison affichée`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {viewKey.startsWith("MODE") ? (
                  <ModalVibration size={14} />
                ) : (
                  <LoadCombination size={14} />
                )}
                {/* Deterministic label (Base UI SelectValue falls back to
                    the raw value when the popup is unopened). */}
                <span className="min-w-0 truncate font-data">
                  {comboItems.find((item) => item.value === viewKey)?.label ?? viewKey}
                </span>
              </span>
            </SelectTrigger>
            <SelectContent>
              {combinations.map((c, i) => (
                <SelectItem key={`${c.kind}:${i}`} value={`${c.kind}:${i}`}>
                  <span className="flex items-center gap-1.5">
                    <LoadCombination size={14} />
                    {c.label}
                  </span>
                </SelectItem>
              ))}
              {/* M10.5: multi-case Min/Max envelopes. */}
              <SelectItem value="ENV:ULS">
                <span className="flex items-center gap-1.5">
                  <LoadCombination size={14} />
                  <Trans>Enveloppe ELU (Min/Max)</Trans>
                </span>
              </SelectItem>
              <SelectItem value="ENV:SLS">
                <span className="flex items-center gap-1.5">
                  <LoadCombination size={14} />
                  <Trans>Enveloppe ELS (Min/Max)</Trans>
                </span>
              </SelectItem>
              {modal !== null
                ? (modal.modes ?? []).slice(0, 6).map((m) => (
                    <SelectItem key={`MODE:${m.mode_index}`} value={`MODE:${m.mode_index - 1}`}>
                      <span className="flex items-center gap-1.5">
                        <ModalVibration size={14} />
                        {`Mode propre ${m.mode_index} · ${m.frequency_hz.toFixed(2).replace(".", ",")} Hz`}
                      </span>
                    </SelectItem>
                  ))
                : null}
            </SelectContent>
          </SelectRoot>
          {isModeView ? (
            <button
              type="button"
              className="relative rounded border border-hairline px-2 py-0.5 text-[11px] text-ink-secondary"
              onClick={() => setPlaying(!playing)}
              data-testid="modal-play"
            >
              {playing ? "⏸ Pause" : "▶ Play harmonique"}
            </button>
          ) : null}
          {/* v2.1.2: thermal scale as a SegmentedControl — Taux EC3 |
              σvM / fy | Auto (contract test ids scale-ec3/svm/auto). */}
          <div data-testid="scale-modes" className="shrink-0">
            <SegmentedControl
              size="sm"
              label={t`Échelle thermique`}
              value={scaleMode}
              onValueChange={(next) => setScaleMode(next as "ec3" | "svm" | "auto")}
              options={[
                { value: "ec3", label: "Taux EC3", testId: "scale-ec3" },
                { value: "svm", label: "σvM / fy", testId: "scale-svm" },
                { value: "auto", label: "Auto", testId: "scale-auto" },
              ]}
            />
          </div>
          {/* v1.5.0 mobile: 1-tap hand-off to the A4/PDF note. */}
          <button
            type="button"
            className="rounded bg-accent px-2 py-1 text-[11px] text-white md:hidden"
            data-testid="mobile-report-pdf"
            onClick={() => void navigate({ to: "/report" })}
          >
            <Trans>Rapport PDF</Trans>
          </button>
          {/* v2.1.2: Calculer as a LoadingButton (locked width, idle →
              pending → success label swap). */}
          <LoadingButton
            testId="calculate-button"
            className="h-8"
            disabled={busy}
            onAction={run}
            pendingLabel={t`Calcul en cours…`}
            successLabel={t`Calculé`}
            resetAfter={900}
          >
            Calculer
          </LoadingButton>
        </div>
      </div>
      {fault !== null ? <SolverFaultCard fault={fault} onRerun={run} /> : null}
      {/* M10.3: buckled tension-only / compression-only members — the
          solver deactivated them (residual axial force < 1e-3 N). */}
      {(report?.inactive_beam_ids?.length ?? 0) > 0 ? (
        <div
          className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-panel border border-hairline bg-panel-subtle/50 px-2 py-1.5"
          data-testid="inactive-beams-banner"
        >
          <span className="text-[11px] text-ink-muted">
            <Trans>Membres inactifs (flambage / décompression) :</Trans>
          </span>
          {(report?.inactive_beam_ids ?? []).map((id) => (
            <span
              key={id}
              className="font-data rounded-[2px] border border-hairline bg-panel px-1.5 py-0.5 text-[10px] text-ink-secondary"
              data-testid={`inactive-badge-${id}`}
            >
              P{id} · <Trans>Inactif (comprimé)</Trans>
            </span>
          ))}
        </div>
      ) : null}
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
                <DeflectionLimit size={18} />
                Flèche max ELS
              </span>
            }
            value={maxSlsDeflMm}
            suffix="mm"
            pass={slsPass}
            passLabels={{
              pass: `≤ ${slsAllowanceMm.toFixed(1).replace(".", ",")} mm (${SLS_LIMITS.find(([d]) => d === slsDenominator)?.[1]})`,
              fail: `> ${slsAllowanceMm.toFixed(1).replace(".", ",")} mm`,
            }}
            testId="kpi-deflection"
          />
          <KpiCard
            label={
              <span className="flex items-center gap-1">
                <SectionCut size={18} />
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
                <ModalVibration size={18} />
                1er mode propre
              </span>
            }
            value={modal?.modes[0]?.frequency_hz ?? 0}
            suffix="Hz"
            testId="kpi-modal"
          />
        </div>
      ) : null}
      {/* M12.3 — SLS inter-storey drift of the storey levels. */}
      {drift !== null && drift.levels.length > 0 ? (
        <div
          className="shrink-0 rounded-panel border border-hairline bg-panel p-2.5"
          data-testid="storey-drift-panel"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-ink-secondary">
              <Trans>Déplacement inter-étages (ELS)</Trans>
            </h3>
            <SegmentedControl
              size="sm"
              label={t`Limite de drift`}
              value={String(driftLimit)}
              onValueChange={(next) => setDriftLimit(Number(next) as 300 | 500)}
              options={[
                { value: "300", label: "d_r / h ≤ 1/300", testId: "drift-limit-300" },
                { value: "500", label: "d_r / h ≤ 1/500", testId: "drift-limit-500" },
              ]}
            />
          </div>
          <table className="font-data mt-1.5 w-full text-[11px] [font-variant-numeric:tabular-nums]">
            <thead>
              <tr className="text-left text-[10px] text-ink-muted">
                <th className="py-0.5 font-medium">
                  <Trans>Niveau</Trans>
                </th>
                <th className="py-0.5 font-medium">h (m)</th>
                <th className="py-0.5 font-medium">d_r (mm)</th>
                <th className="py-0.5 font-medium">d_r / h</th>
                <th className="py-0.5 font-medium">
                  <Trans>Statut</Trans>
                </th>
              </tr>
            </thead>
            <tbody>
              {drift.levels.map((level) => (
                <tr key={level.elevation} className="border-t border-hairline">
                  <td className="py-0.5 text-ink-primary">{level.name}</td>
                  <td className="py-0.5">{level.storey_height_m.toFixed(2).replace(".", ",")}</td>
                  <td className="py-0.5">{(level.drift_m * 1000).toFixed(2).replace(".", ",")}</td>
                  <td className="py-0.5">{`1/${Math.max(1, Math.round(1 / Math.max(level.ratio / driftLimit, 1e-9)))}`}</td>
                  <td className="py-0.5">
                    <StatusBadge
                      tone={level.passed ? "pass" : "fail"}
                      mono
                      testId={`drift-badge-${level.elevation}`}
                    >
                      {level.passed ? "Conforme" : "Dépassement"}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {/* Zone 2 — viewport row: persistent stage slot + 340px EC3 rail. */}
      <div className="flex min-h-0 flex-1 gap-2">
        <section className="relative min-w-0 flex-1 overflow-hidden rounded-panel border border-hairline bg-panel">
          <div ref={slotRef} className="h-full w-full" data-testid="results-stage-slot" />
          <StageContent
            k="results"
            options={{
              colorRatios: scaledDeformed?.colorRatios,
              displacements: scaledDeformed?.displacements,
              deformScale: scaledDeformed?.deformScale,
              wireframe: false,
              selectedBeamId,
            }}
          >
            {null}
          </StageContent>
          {/* v2.1.1: thermal legend at bottom-LEFT (clear of the XYZ
              gizmo at bottom-right), labels synced to the active scale. */}
          {report !== null ? (
            <div
              className="absolute bottom-8 left-3 z-30 flex w-56 max-w-[60%] items-center gap-2 rounded-panel border border-hairline bg-panel/90 p-1.5 backdrop-blur"
              data-testid="fea-legend"
            >
              <span className="font-data text-[11px] text-ink-muted">
                {scaleMode === "ec3" ? "η = 0" : scaleMode === "svm" ? "0" : "Min"}
              </span>
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
              <span className="font-data text-[11px] text-ink-muted">
                {scaleMode === "ec3" ? "η = 1,25" : scaleMode === "svm" ? "235 MPa (fy)" : "Max"}
              </span>
            </div>
          ) : null}
        </section>
        {/* v2.1.1: right 340px diagnostic rail — 2 clean tabs so the EC3
            verification AND the advanced analyses (λcr, sismique,
            multimatière) fit with zero clipping inside 100dvh. */}
        {report !== null && inspected !== null ? (
          <aside
            className="hidden w-[340px] shrink-0 flex-col overflow-hidden rounded-panel border border-hairline bg-panel md:flex"
            data-testid="ec3-rail"
          >
            <div
              className="flex shrink-0 items-center border-b border-hairline p-1.5"
              role="tablist"
              aria-label="Diagnostic"
            >
              {/* v2.1.2: right-rail tabs as a SegmentedControl (spring pill). */}
              <SegmentedControl
                className="w-full"
                label={t`Diagnostic`}
                value={railTab}
                onValueChange={(next) => setRailTab(next as "ec3" | "advanced")}
                options={[
                  { value: "ec3", label: t`Vérification EC3`, testId: "rail-tab-ec3" },
                  { value: "advanced", label: t`Analyses avancées`, testId: "rail-tab-advanced" },
                ]}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
              {railTab === "ec3" ? (
                <>
                  <h3 className="text-[13px] font-semibold text-ink-secondary">
                    <Trans>
                      Diagnostic EN 1993-1-1 — P{inspected.beam_id} ({inspected.governing_check})
                    </Trans>
                  </h3>
                  <div className="font-data flex flex-wrap items-center gap-1 text-[11px]">
                    <span className="rounded-[2px] border border-hairline bg-panel-subtle px-1.5 py-0.5 text-ink-secondary">
                      Classe {inspected.class_index ?? "—"}
                    </span>
                    <span className="rounded-[2px] border border-hairline bg-panel-subtle px-1.5 py-0.5 text-ink-secondary">
                      χy = {(inspected.chi_y ?? 1).toFixed(2).replace(".", ",")}
                    </span>
                    <span className="rounded-[2px] border border-hairline bg-panel-subtle px-1.5 py-0.5 text-ink-secondary">
                      χz = {(inspected.chi_z ?? 1).toFixed(2).replace(".", ",")}
                    </span>
                    <span className="rounded-[2px] border border-hairline bg-panel-subtle px-1.5 py-0.5 text-ink-secondary">
                      χLT ={" "}
                      {inspected.chi_lt == null
                        ? "1,00"
                        : inspected.chi_lt.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  <dl className="font-data grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-ink-secondary">
                    <dt>Npl,Rd</dt>
                    <dd className="text-right">
                      {(inspected.n_pl_rd / 1000).toFixed(1).replace(".", ",")} kN
                    </dd>
                    <dt>Vpl,Rd</dt>
                    <dd className="text-right">
                      {(inspected.v_pl_rd / 1000).toFixed(1).replace(".", ",")} kN
                    </dd>
                    <dt>Mcr</dt>
                    <dd className="text-right">
                      {inspected.m_cr == null
                        ? "—"
                        : `${(inspected.m_cr / 1000).toFixed(1).replace(".", ",")} kN·m`}
                    </dd>
                    <dt>λLT</dt>
                    <dd className="text-right">
                      {inspected.lambda_lt == null
                        ? "—"
                        : inspected.lambda_lt.toFixed(2).replace(".", ",")}
                    </dd>
                    <dt>Mb,Rd</dt>
                    <dd className="text-right">
                      {(inspected.m_rd / 1000).toFixed(1).replace(".", ",")} kN·m
                    </dd>
                    <dt>L</dt>
                    <dd className="text-right">
                      {inspected.length.toFixed(2).replace(".", ",")} m
                    </dd>
                  </dl>
                  <dl className="grid gap-x-4 gap-y-1">
                    {(inspected.checks ?? []).map(([name, ratio]) => (
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
                  {/* v1.6.0: BOTH mitigation buttons. */}
                  {inspected.utilization > 1 ? (
                    <div className="mt-auto flex flex-col gap-1.5">
                      <button
                        type="button"
                        className="rounded border border-hairline px-2 py-1 text-[12px] text-accent hover:bg-accent-tint"
                        data-testid="mitigate-lateral"
                        onClick={() => {
                          const target = inspected.beam_id;
                          updateBeam(target, { k_buckling_z: 0.5 });
                          toast("Maintien latéral mi-travée (kz = 0,5)", {
                            description: "Recalcul automatique en cours…",
                          });
                        }}
                      >
                        <Trans>Maintien latéral mi-travée (kz = 0,5)</Trans>
                      </button>
                      <button
                        type="button"
                        className="rounded bg-accent px-2 py-1 text-[12px] text-white"
                        data-testid="rail-upgrade"
                        onClick={upgradeOverloaded}
                      >
                        <Trans>Renforcer le profil (1 clic)</Trans>
                      </button>
                    </div>
                  ) : (
                    <p className="font-data mt-auto text-[11px] text-pass-text">
                      <Trans>Toutes les vérifications EC3 sont vérifiées (η ≤ 1,00).</Trans>
                    </p>
                  )}
                  {/* v2.0.1: optimizer / scenario entries live in the EC3 tab. */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
                    <Tooltip
                      label={t`Optimiser automatiquement les profilés surchargés`}
                      side="top"
                    >
                      <button
                        type="button"
                        onClick={() => setOptimizerOpen(true)}
                        className="flex items-center gap-1.5 rounded-[4px] bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90"
                      >
                        <SlidersHorizontal size={14} strokeWidth={1.5} aria-hidden />
                        Optimiseur EC3
                      </button>
                    </Tooltip>
                    <Tooltip label={t`Comparer des scénarios de calcul côte à côte`} side="top">
                      <button
                        type="button"
                        onClick={() => setScenarioOpen(true)}
                        className="flex items-center gap-1.5 rounded-[4px] border border-hairline px-3 py-1.5 text-xs font-semibold "
                      >
                        <ArrowLeftRight size={14} strokeWidth={1.5} aria-hidden />
                        Scénarios
                      </button>
                    </Tooltip>
                    {/* M12.1: EN 1993-1-8 connection studio entry. */}
                    <Tooltip
                      label={t`Vérifier les assemblages boulonnés / soudés (EN 1993-1-8)`}
                      side="top"
                    >
                      <button
                        type="button"
                        onClick={() => setConnectionOpen(true)}
                        className="flex items-center gap-1.5 rounded-[4px] border border-hairline px-3 py-1.5 text-xs font-semibold"
                        data-testid="open-connection-studio"
                      >
                        <Wrench size={14} strokeWidth={1.5} aria-hidden />
                        Studio Assemblages EC3-1-8
                      </button>
                    </Tooltip>
                  </div>
                </>
              ) : (
                <>
                  <AdvancedPanels />
                  {/* M12.2: moving loads & influence lines stay reachable
                      in the advanced tab of the diagnostic rail. */}
                  <div className="mt-2.5">
                    <MovingLoadPanel />
                  </div>
                </>
              )}
            </div>
          </aside>
        ) : (
          <aside
            className="hidden w-[340px] shrink-0 flex-col justify-between overflow-hidden rounded-panel border border-hairline bg-panel p-3.5 md:flex"
            data-testid="ec3-rail-empty"
          >
            <div>
              <h3 className="text-[13px] font-semibold text-ink-primary">
                <Trans>Diagnostic Eurocode 3</Trans>
              </h3>
              <p className="mt-1.5 text-[12px] leading-5 text-ink-muted">
                <Trans>
                  Aucune solution active — vérifiez vos appuis à l'étape Liaisons puis cliquez sur
                  Calculer pour afficher les taux de travail EN 1993-1-1, le flambement et la trace
                  KaTeX.
                </Trans>
              </p>
            </div>
            <div className="border-t border-hairline pt-3">
              <button
                type="button"
                className="w-full rounded-[4px] border border-hairline bg-canvas px-3 py-1.5 text-[12px] font-medium text-ink-secondary hover:border-accent hover:text-accent"
                onClick={() => void navigate({ to: "/supports" })}
              >
                <Trans>← Configurer les liaisons</Trans>
              </button>
            </div>
          </aside>
        )}
      </div>
      {/* Zone 3 — bottom precision dock (h-[220px]). v2.1.1: the
          "Enveloppes 3D" view renders ForceDiagrams3DPanel INSIDE the
          dock — the overflowing bar below it is gone. */}
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
          view3d={diagramsOpen}
          onView3dChange={setDiagramsOpen}
          inspected={inspected}
          sectionDims={sectionDims}
          scaleMode={scaleMode}
          onScaleModeChange={(next) => setScaleMode(next)}
          envelope={
            isEnvelopeView ? (envelopes?.find((e) => e.beam_id === cutBeamId) ?? null) : null
          }
        />
      ) : null}
      {/* Phone drawer: nodal displacements + SI/UI conversion note. */}
      {isMobile ? (
        <BottomSheet testId="inspector-sheet" title={<Trans>Déplacements nodaux</Trans>}>
          {report === null ? (
            <p className="text-[13px] text-ink-muted">
              <Trans>Lancer un calcul pour afficher les résultats.</Trans>
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <tbody className="font-data">
                {(report.cases.find((c) => c.code === "G")?.displacements ?? [])
                  .filter((_, i) => i % 6 === 2)
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
          {/* v2.0.1: advanced analyses stay reachable on phones. */}
          {report !== null ? (
            <>
              <AdvancedPanels />
              <div className="mt-2.5">
                <MovingLoadPanel />
              </div>
            </>
          ) : null}
        </BottomSheet>
      ) : null}
      {optimizerOpen ? <OptimizerModal onClose={() => setOptimizerOpen(false)} /> : null}
      {scenarioOpen ? <ScenarioCompareModal onClose={() => setScenarioOpen(false)} /> : null}
      {connectionOpen ? (
        <ConnectionStudioModal open onClose={() => setConnectionOpen(false)} />
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
  passLabels,
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
  passLabels?: { pass: string; fail: string };
  onCorrective?: () => void;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  testId?: string;
}) {
  return (
    <div
      className="border-b border-hairline py-3.5 first:pt-0 last:border-b-0 last:pb-0"
      data-testid={testId}
    >
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p
        className="mt-1 text-[17px] font-semibold text-ink-primary"
        data-testid={testId === undefined ? undefined : `${testId}-value`}
        data-value={value}
      >
        <NumberFlowValue
          value={value}
          format={{ minimumFractionDigits: decimals, maximumFractionDigits: decimals }}
        />
        <span className="font-data text-[12px] text-ink-secondary"> {suffix}</span>
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {pass !== undefined ? (
          <StatusBadge tone={pass ? "pass" : "fail"} mono testId={`${testId}-badge`}>
            {pass ? (passLabels?.pass ?? "Conforme EC3") : (passLabels?.fail ?? "Dépassement EC3")}
          </StatusBadge>
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
 * Bottom precision dock (v2.1.1, h-[220px], grid-cols-[280px_1fr]): the 2D
 * σvM cross-section heatmap beside the uPlot internal-force diagrams
 * (My, Mz, Vz, N, T — all 5 curves + dashed ±M_Rd capacity lines).
 * v2.1.1 fixes: `scales.x.time = false` kills the uPlot Unix-timestamp
 * axis bug (`:00.000` / `1/1/70 1:00am`), the built-in legend is OFF and
 * replaced by a 1-line color-key pill strip + the `5 courbes |
 * Enveloppes 3D` switcher in the dock header (height 145 fits 100%
 * inside the 220px dock), and the Enveloppes 3D view renders the
 * ForceDiagrams3DPanel INSIDE the dock — no overflowing bar below it.
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
  view3d,
  onView3dChange,
  inspected,
  sectionDims,
  scaleMode,
  onScaleModeChange,
  envelope = null,
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
  view3d: boolean;
  onView3dChange: (open: boolean) => void;
  /** M10.5: the selected member's Min/Max envelope (ENV views only). */
  envelope?: BeamEnvelopeDto | null;
  inspected: {
    beam_id: number;
    class_index?: number | null;
    chi_y?: number | null;
    chi_z?: number | null;
    chi_lt?: number | null;
    section_id?: string | null;
  } | null;
  sectionDims: Map<string, SectionDims>;
  scaleMode: "ec3" | "svm" | "auto";
  /** v2.3.0: the SectionCutCard toggle writes back to `?scale=`. */
  onScaleModeChange: (next: "svm" | "auto") => void;
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
  // v2.4.0: elastic section properties of the cut member for the σvM(x)
  // curve + cursor readout (Pa, m, m³ derived from the catalog outline).
  const sectionProps = useMemo(() => {
    const beam = beams.find((b) => b.id === beamId);
    const dims = beam !== undefined ? sectionDims.get(beam.section_id) : undefined;
    if (dims === undefined) {
      return null;
    }
    const h = dims.h ?? 0.2;
    const b = dims.b ?? 0.1;
    const tw = dims.tw ?? 0.01;
    const tf = dims.tf ?? 0.01;
    const a = dims.a > 0 ? dims.a : b * h;
    const iy = (b * h ** 3 - (b - tw) * (h - 2 * tf) ** 3) / 12;
    const iz = (2 * tf * b ** 3 + (h - 2 * tf) * tw ** 3) / 12;
    const welY = iy / (h / 2);
    const welZ = iz / (b / 2);
    return { a, welY, welZ };
  }, [beams, beamId, sectionDims]);
  /** Approximate von Mises (Pa) at a station from the internal forces. */
  const sigmaVmAt = useCallback(
    (f: { n: number; my: number; mz: number; vz: number; t: number }): number => {
      if (sectionProps === null) {
        return 0;
      }
      const sn = f.n / sectionProps.a;
      const smy = f.my / sectionProps.welY;
      const smz = f.mz / sectionProps.welZ;
      // Torsion + shear contribute a τ term; the von Mises equivalent for
      // a beam section is sqrt(σn² + σmy² + σmz² + 3τ²) with τ ≈ Vz/A.
      const tau = f.vz / sectionProps.a;
      return Math.sqrt(sn * sn + smy * smy + smz * smz + 3 * tau * tau);
    },
    [sectionProps],
  );
  const fyPa = 235e6;
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
    const svm = lerp(sigmaVmAt(a), sigmaVmAt(b)) / 1e6;
    return {
      my: lerp(a.my, b.my) / 1000,
      mz: lerp(a.mz, b.mz) / 1000,
      vz: lerp(a.vz, b.vz) / 1000,
      n: lerp(a.n, b.n) / 1000,
      t: lerp(a.t, b.t) / 1000,
      svm,
      svmRatio: (svm * 1e6) / fyPa,
    };
  }, [forces, station, sigmaVmAt]);

  useEffect(() => {
    if (forces === null || view3d || plotRef.current === null) {
      return;
    }
    // M10.5: resample the 5-station envelope onto the 24 span samples so
    // the Min/Max bands share uPlot's aligned data grid.
    const envelopeAt = (pick: (e: BeamEnvelopeDto) => [number, number]) => {
      if (envelope === null) {
        return null;
      }
      const stations = [0, 0.25, 0.5, 0.75, 1];
      const [lo, hi] = pick(envelope);
      const span = hi - lo;
      return stations.map((s) => (lo + span * s) / 1e3);
    };
    const envMy = envelopeAt((e) => e.my);
    const envVz = envelopeAt((e) => e.vz);
    const envN = envelopeAt((e) => e.n);
    // First envelope series index: x, My, Mz, Vz, N, T, σvM (+ ±M_Rd).
    const envStart = 7 + (mRd !== null ? 2 : 0);
    const data: uPlot.AlignedData = [
      forces.map((f) => f.ratio),
      forces.map((f) => f.my / 1e3),
      forces.map((f) => f.mz / 1e3),
      forces.map((f) => f.vz / 1e3),
      forces.map((f) => f.n / 1e3),
      forces.map((f) => f.t / 1e3),
      // v2.4.0: σvM(x) curve (MPa) from the internal forces + section props.
      forces.map((f) => sigmaVmAt(f) / 1e6),
      ...(mRd !== null ? [forces.map(() => mRd / 1000), forces.map(() => -mRd / 1000)] : []),
      // M10.5: EN 1990 multi-case Min/Max envelope bands.
      ...(envMy !== null && envVz !== null && envN !== null
        ? [envMy, envMy, envVz, envVz, envN, envN]
        : []),
    ] as unknown as uPlot.AlignedData;
    const opts: uPlot.Options = {
      width: plotRef.current.clientWidth,
      height: 145,
      // v2.1.1: the x axis carries station ratios (0..1 L), NOT Unix
      // timestamps — `time: false` removes the `:00.000` / `1/1/70`
      // overlap, and the explicit formatters print `0,05 L`-style ticks.
      scales: { x: { time: false } },
      legend: { show: false },
      axes: [
        { values: (_u: uPlot, ticks: number[]) => ticks.map((v) => `${v.toFixed(2)}L`) },
        { values: (_u: uPlot, ticks: number[]) => ticks.map((v) => `${v.toFixed(0)}`) },
      ],
      series: [
        {},
        { label: "My (kN·m)", stroke: "#1d4ed8", width: 1.5 },
        { label: "Mz (kN·m)", stroke: "#06b6d4", width: 1.5 },
        { label: "Vz (kN)", stroke: "#dc2626", width: 1.5 },
        { label: "N (kN)", stroke: "#10b981", width: 1.5 },
        { label: "T (kN·m)", stroke: "#f59e0b", width: 1.5 },
        { label: "σvM (MPa)", stroke: "#7c3aed", width: 1.5 },
        ...(mRd !== null
          ? [
              { label: "+M_Rd", stroke: "#dc2626", width: 1.5, dash: [6, 4] },
              { label: "−M_Rd", stroke: "#dc2626", width: 1.5, dash: [6, 4] },
            ]
          : []),
        // M10.5: shaded Min/Max envelope bands (Deep Cobalt 12% fill) —
        // the band partner is the preceding min series (indices shift
        // with the optional ±M_Rd capacity lines).
        ...(envMy !== null && envVz !== null && envN !== null
          ? [
              { label: "My min", stroke: "rgba(29,78,216,0.55)", width: 1, dash: [4, 3] },
              {
                label: "My max",
                stroke: "#1d4ed8",
                width: 1,
                dash: [4, 3],
                fill: "rgba(29,78,216,0.12)",
                band: envStart,
              },
              { label: "Vz min", stroke: "rgba(29,78,216,0.55)", width: 1, dash: [4, 3] },
              {
                label: "Vz max",
                stroke: "#1d4ed8",
                width: 1,
                dash: [4, 3],
                fill: "rgba(29,78,216,0.12)",
                band: envStart + 2,
              },
              { label: "N min", stroke: "rgba(29,78,216,0.55)", width: 1, dash: [4, 3] },
              {
                label: "N max",
                stroke: "#1d4ed8",
                width: 1,
                dash: [4, 3],
                fill: "rgba(29,78,216,0.12)",
                band: envStart + 4,
              },
            ]
          : []),
      ] as uPlot.Series[],
    };
    const plot = new uPlot(opts, data, plotRef.current);
    uplotRef.current = plot;
    syncCursor();
    return () => {
      plot.destroy();
      uplotRef.current = null;
    };
  }, [forces, mRd, syncCursor, view3d, sigmaVmAt]);

  // v1.6.0 bug 5: ResizeObserver keeps uPlot glued to its pane (the old
  // fixed-width build overflowed / clipped on pane resizes).
  useEffect(() => {
    const el = plotRef.current;
    if (el === null) {
      return;
    }
    const observer = new ResizeObserver(() => {
      const plot = uplotRef.current;
      if (plot !== null) {
        plot.setSize({ width: el.clientWidth, height: 145 });
        syncCursor();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncCursor]);

  return (
    <section
      className="grid h-[220px] shrink-0 grid-cols-1 gap-3 overflow-hidden rounded-panel border border-hairline bg-panel p-2.5 lg:grid-cols-[280px_1fr]"
      data-testid="docked-inspector"
    >
      <SectionCutCard
        beamId={beamId}
        station={station}
        stress={stress}
        fibers={fibers}
        inspected={inspected}
        sectionDims={sectionDims}
        _onBeamChange={onBeamChange}
        onStationChange={onStationChange}
        beams={beams}
        scaleMode={scaleMode}
        onScaleModeChange={onScaleModeChange}
        slsLabel={slsLabel}
        maxSlsDeflMm={maxSlsDeflMm}
      />
      <div className="flex min-h-0 flex-col">
        {/* Dock header: title + 1-line color-key pill strip + the view
            switcher (5 courbes | Enveloppes 3D). */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <h3 className="text-xs font-medium text-ink-secondary">
            <Trans>Efforts internes (6 courbes)</Trans>
          </h3>
          <div
            className="font-data flex flex-wrap items-center gap-1 text-[10px]"
            data-testid="force-color-key"
          >
            {(
              [
                ["My", "#1d4ed8", false],
                ["Mz", "#06b6d4", false],
                ["Vz", "#dc2626", false],
                ["N", "#10b981", false],
                ["T", "#f59e0b", false],
                ["σvM", "#7c3aed", false],
              ] as const
            ).map(([label, stroke]) => (
              <span key={label} className="flex items-center gap-0.5 text-ink-secondary">
                <span
                  aria-hidden
                  className="inline-block h-[2px] w-3 rounded"
                  style={{ backgroundColor: stroke }}
                />
                {label}
              </span>
            ))}
            {mRd !== null ? (
              <span className="flex items-center gap-0.5 text-ink-secondary">
                <span
                  aria-hidden
                  className="inline-block h-[2px] w-3 rounded"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, #dc2626 0 3px, transparent 3px 6px)",
                  }}
                />
                ±M_Rd
              </span>
            ) : null}
          </div>
          <div className="shrink-0" data-testid="forces-view-switcher">
            {/* v2.1.2: dock view switcher as a SegmentedControl. */}
            <SegmentedControl
              size="sm"
              label={t`Vue des efforts`}
              value={view3d ? "3d" : "curves"}
              onValueChange={(next) => onView3dChange(next === "3d")}
              options={[
                { value: "curves", label: "6 courbes", testId: "forces-curves" },
                { value: "3d", label: "Enveloppes 3D", testId: "force-diagrams-toggle" },
              ]}
            />
          </div>
        </div>
        {view3d ? (
          /* Enveloppes 3D: the ForceDiagrams3DPanel lives INSIDE the dock
              (overflowing bottom bar removed in v2.1.1). */
          <div className="mt-1 min-h-0 flex-1 overflow-hidden" data-testid="force-diagrams-dock">
            <ForceDiagrams3DPanel />
          </div>
        ) : (
          <>
            {/* Live cursor readouts at the scrubbed station. */}
            <div
              className="font-data mt-0.5 flex shrink-0 gap-2 text-[10px] text-ink-secondary"
              data-testid="cursor-readouts"
            >
              {cursorForces !== null ? (
                <span>
                  My = {cursorForces.my.toFixed(1)} · Mz = {cursorForces.mz.toFixed(1)} kN·m · Vz ={" "}
                  {cursorForces.vz.toFixed(1)} kN · N = {cursorForces.n.toFixed(1)} kN · T ={" "}
                  {cursorForces.t.toFixed(1)} kN·m · σvM = {cursorForces.svm.toFixed(1)} MPa (
                  {(cursorForces.svmRatio * 100).toFixed(0)} % fy)
                </span>
              ) : null}
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
          </>
        )}
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

/**
 * v2.3.0 SectionCutCard — precision engineering cross-section card (DESIGN.md §7):
 * Header: SectionCut icon + "Coupe transversale — {section_id}" + segmented toggle "0 → fy (235) | 0 → Max"
 * 2-Column Body: Left true profile outline (IPE/HEA/UPN/CHS/RHS) filled with smooth 5-tier thermal stress gradient
 *   (#1D4ED8 → #06B6D4 → #10B981 → #F59E0B → #DC2626) + dashed horizontal elastic neutral axis line G
 * Right 3 color-badged fiber stress readouts (tabular-nums): Top fiber, Neutral axis, Bottom fiber
 * Metrological Footer: "Classe {class_index} · χy = {chi_y} · χz = {chi_z} · χLT = {chi_lt}" + emerald "EN 1993-1-1" badge
 */
function SectionCutCard({
  beamId,
  station,
  stress,
  fibers,
  inspected,
  sectionDims,
  _onBeamChange,
  onStationChange,
  beams,
  scaleMode,
  onScaleModeChange,
  slsLabel,
  maxSlsDeflMm,
}: {
  beamId: number;
  station: number;
  stress: StressGrid | null;
  fibers: { top: number; na: number; bottom: number } | null;
  inspected: {
    beam_id: number;
    class_index?: number | null;
    chi_y?: number | null;
    chi_z?: number | null;
    chi_lt?: number | null;
    section_id?: string | null;
  } | null;
  sectionDims: Map<string, SectionDims>;
  _onBeamChange: (id: number) => void;
  onStationChange: (ratio: number) => void;
  beams: { id: number; section_id: string }[];
  scaleMode: "ec3" | "svm" | "auto";
  /** v2.3.0: the thermal-scale toggle writes back to the parent's
      `?scale=` search param, so the section readout and the 3D thermal
      scale update together. */
  onScaleModeChange: (next: "svm" | "auto") => void;
  slsLabel?: string;
  maxSlsDeflMm: number;
}) {
  const beam = beams.find((b) => b.id === beamId);
  const designation = beam?.section_id ?? "";
  const dims = designation ? (sectionDims.get(designation) ?? null) : null;

  // 5-tier thermal gradient stops (DESIGN.md §2)
  const gradientStops = [
    { offset: "0%", color: "#1D4ED8" }, // Tier 1: 0.0-0.2
    { offset: "20%", color: "#06B6D4" }, // Tier 2: 0.2-0.5
    { offset: "50%", color: "#10B981" }, // Tier 3: 0.5-0.8
    { offset: "80%", color: "#F59E0B" }, // Tier 4: 0.8-1.0
    { offset: "100%", color: "#DC2626" }, // Tier 5: >1.0
  ];

  // Profile shape SVG path generator (from SectionDiagram logic)
  const getProfilePath = (dims: SectionDims, scale: number, cx: number, cy: number): string => {
    const mm = (v: number | null): number => (v ?? 0) * 1000;
    const h = mm(dims.h);
    const b = mm(dims.b);
    const tw = mm(dims.tw);
    const tf = mm(dims.tf);
    const bw = (b * scale) / 2;
    const isChs = dims.shape === "CircularHollow";

    if (isChs) {
      const r = (h / 2) * scale;
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    }
    if (dims.shape === "RectangularHollow") {
      const hw = (h * scale) / 2;
      const tws = tw * scale;
      const tfs = tf * scale;
      return `M ${cx - bw} ${cy - hw} h ${b * scale} v ${h * scale} h ${-b * scale} Z M ${cx - bw + tws} ${cy - hw + tfs} h ${b * scale - 2 * tws} v ${h * scale - 2 * tfs} h ${-b * scale + 2 * tws} Z`;
    }
    if (dims.shape === "Channel") {
      const hw = (h * scale) / 2;
      const tfs = tf * scale;
      return `M ${cx - bw} ${cy - hw} h ${b * scale} v ${tfs} h ${-(b - tw) * scale} v ${(h - 2 * tf) * scale} h ${(b - tw) * scale} v ${tfs} h ${-b * scale} Z`;
    }
    // Doubly-symmetric I (IPE, HEA, HEB, etc.)
    const hw = (h * scale) / 2;
    const tfs = tf * scale;
    return `M ${cx - bw} ${cy - hw} h ${b * scale} v ${tfs} h ${-((b - tw) / 2) * scale} v ${(h - 2 * tf) * scale} h ${((b - tw) / 2) * scale} v ${tfs} h ${-b * scale} Z`;
  };

  // Inner profile path (for gradient fill clipping)
  const getInnerProfilePath = (
    dims: SectionDims,
    scale: number,
    cx: number,
    cy: number,
  ): string => {
    const mm = (v: number | null): number => (v ?? 0) * 1000;
    const h = mm(dims.h);
    const b = mm(dims.b);
    const tw = mm(dims.tw);
    const tf = mm(dims.tf);
    const isChs = dims.shape === "CircularHollow";

    if (isChs) {
      const r = Math.max((h / 2) * scale - tf * scale, 2);
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    }
    if (dims.shape === "RectangularHollow") {
      const hw = (h * scale) / 2;
      const bw = (b * scale) / 2;
      const tws = tw * scale;
      const tfs = tf * scale;
      return `M ${cx - bw + tws} ${cy - hw + tfs} h ${b * scale - 2 * tws} v ${h * scale - 2 * tfs} h ${-b * scale + 2 * tws} Z`;
    }
    if (dims.shape === "Channel") {
      const hw = (h * scale) / 2;
      const bw = (b * scale) / 2;
      const tws = tw * scale;
      const tfs = tf * scale;
      return `M ${cx - bw + tws} ${cy - hw + tfs} h ${(b - tw) * scale - tws} v ${(h - 2 * tf) * scale} h ${-(b - tw) * scale + tws} Z`;
    }
    // Doubly-symmetric I - web only
    const hw = (h * scale) / 2;
    const tws = tw * scale;
    const tfs = tf * scale;
    const webHeight = h * scale - 2 * tfs;
    const webX = cx - tws / 2;
    return `M ${webX} ${cy - hw + tfs} h ${tws} v ${webHeight} h ${-tws} Z`;
  };

  // Neutral axis Y position in SVG coordinates (center of profile)
  const getNeutralAxisY = (dims: SectionDims, scale: number, cy: number): number => {
    return cy;
  };

  return (
    <div className="flex min-h-0 flex-col rounded-panel border border-hairline bg-panel overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-hairline px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <SectionCut size={16} strokeWidth={1.5} className="text-accent" />
          <span className="font-data text-[11px] font-medium text-ink-secondary">
            <Trans>Coupe transversale</Trans>
            {designation ? ` — ${designation}` : ""}
          </span>
        </div>
        {/* Thermal scale toggle: 0 → fy (235) | 0 → Max */}
        <SegmentedControl
          size="sm"
          value={scaleMode === "svm" ? "fy" : "max"}
          onValueChange={(next) => onScaleModeChange(next === "fy" ? "svm" : "auto")}
          options={[
            { value: "fy", label: "0 → fy (235)", testId: "scale-fy" },
            { value: "max", label: "Max", testId: "scale-max" },
          ]}
          className="ml-auto"
        />
      </div>

      {/* 2-Column Body */}
      <div className="flex-1 overflow-hidden grid grid-cols-[140px_1fr] gap-0">
        {/* Left: True profile outline with thermal gradient */}
        <div className="relative flex items-center justify-center p-2 bg-panel-subtle/35 min-w-0">
          {stress !== null && dims !== null ? (
            <>
              <svg
                viewBox="0 0 140 100"
                className="w-full h-full max-w-[140px]"
                role="img"
                aria-label={`Coupe 2D ${designation} - gradient thermique σvM`}
              >
                {/* v2.3.0: <defs> MUST live inside <svg> — outside it the
                    gradient reference resolves to nothing and the section
                    silhouette renders black. */}
                <defs>
                  <linearGradient
                    id={`thermal-gradient-${beamId}`}
                    x1="0%"
                    y1="100%"
                    x2="0%"
                    y2="0%"
                  >
                    {gradientStops.map((stop, i) => (
                      <stop key={i} offset={stop.offset} stopColor={stop.color} />
                    ))}
                  </linearGradient>
                </defs>
                <g>
                  {/* Outer profile outline */}
                  <path
                    d={getProfilePath(dims, 0.35, 70, 50)}
                    fill={`url(#thermal-gradient-${beamId})`}
                    stroke="#E2E8F0"
                    strokeWidth="1"
                  />
                  {/* Inner profile (web) for hollow sections */}
                  {dims.shape !== "DoublySymmetricI" && dims.shape !== "Channel" && (
                    <path
                      d={getInnerProfilePath(dims, 0.35, 70, 50)}
                      fill="#F8FAFC"
                      stroke="#E2E8F0"
                      strokeWidth="0.5"
                    />
                  )}
                  {/* Neutral axis dashed line G */}
                  <line
                    x1="20"
                    y1={getNeutralAxisY(dims, 0.35, 50)}
                    x2="120"
                    y2={getNeutralAxisY(dims, 0.35, 50)}
                    stroke="#64748B"
                    strokeWidth="1"
                    strokeDasharray="4 3"
                    strokeLinecap="round"
                  />
                  {/* G label */}
                  <text
                    x="122"
                    y={getNeutralAxisY(dims, 0.35, 50) - 3}
                    fontSize="8"
                    fill="#64748B"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="500"
                  >
                    G
                  </text>
                </g>
              </svg>
            </>
          ) : (
            <p className="text-[11px] text-ink-muted text-center">
              <Trans>Sélectionnez une poutre et lancez le calcul</Trans>
            </p>
          )}
        </div>

        {/* Right: 3 fiber stress readouts */}
        <div className="flex flex-col justify-center gap-2 p-3 min-w-0">
          {fibers !== null ? (
            <>
              {/* Top fiber */}
              <div className="flex items-center gap-2 rounded-[4px] bg-fail-bg border border-fail-border p-2">
                <span className="w-2 h-2 rounded bg-fail-text shrink-0" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="font-data text-[11px] text-ink-primary">
                    <span className="text-fail-text">■ +{fibers.top.toFixed(1)} MPa</span>
                  </p>
                  <p className="text-[10px] text-ink-muted">Semelle sup. compression (Ed)</p>
                </div>
              </div>
              {/* Neutral axis */}
              <div className="flex items-center gap-2 rounded-[4px] bg-pass-bg border border-pass-border p-2">
                <span className="w-2 h-2 rounded bg-pass-text shrink-0" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="font-data text-[11px] text-ink-primary">
                    <span className="text-pass-text">■ {fibers.na.toFixed(1)} MPa</span>
                  </p>
                  <p className="text-[10px] text-ink-muted">Axe neutre élastique G</p>
                </div>
              </div>
              {/* Bottom fiber */}
              <div className="flex items-center gap-2 rounded-[4px] bg-accent-tint border border-accent-ring p-2">
                <span className="w-2 h-2 rounded bg-accent shrink-0" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="font-data text-[11px] text-ink-primary">
                    <span className="text-accent">■ -{Math.abs(fibers.bottom).toFixed(1)} MPa</span>
                  </p>
                  <p className="text-[10px] text-ink-muted">Semelle inf. traction (Ed)</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-[11px] text-ink-muted text-center py-4">
              <Trans>Résultats σvM indisponibles</Trans>
            </p>
          )}
        </div>
      </div>

      {/* Metrological Footer */}
      {inspected !== null && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-hairline px-2.5 py-2 bg-panel-subtle/35">
          <div className="flex items-center gap-2 font-data text-[10px] text-ink-secondary">
            <span>Classe {inspected.class_index ?? "—"}</span>
            <span>χy = {(inspected.chi_y ?? 1).toFixed(2).replace(".", ",")}</span>
            <span>χz = {(inspected.chi_z ?? 1).toFixed(2).replace(".", ",")}</span>
            <span>
              χLT ={" "}
              {inspected.chi_lt == null ? "1,00" : inspected.chi_lt.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <StatusBadge tone="pass" mono className="text-[10px]">
            EN 1993-1-1
          </StatusBadge>
        </div>
      )}

      {/* Station slider + SLS displacement */}
      <div className="shrink-0 border-t border-hairline px-2.5 py-2 bg-panel-subtle/35">
        <div className="mb-2 flex items-center gap-2 text-[10px] text-ink-muted">
          <span className="shrink-0">x ∈ [0, L]</span>
          <SliderDetents
            label={t`Position de la coupe`}
            min={0}
            max={1}
            step={0.01}
            detents={[0, 0.25, 0.5, 0.75, 1]}
            magnetRadius={0.02}
            value={station}
            onValueChange={onStationChange}
            formatValue={(v) => `${v.toFixed(2)} L`}
            className="min-w-0 flex-1"
          />
        </div>
        <h3 className="text-[11px] font-medium text-ink-secondary">
          {slsLabel !== undefined ? `${slsLabel} · Déplacements ELS` : "Déplacements ELS"}
        </h3>
        <p className="font-data text-[11px] text-ink-primary">
          Flèche max = {formatMm(maxSlsDeflMm / 1000)}
        </p>
      </div>
    </div>
  );
}
