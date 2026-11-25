import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { SearchParamsSchema } from "@/schemas/searchParams.schema";
import { IconPlay } from "@/components/icons";
import { BottomSheet } from "@/components/BottomSheet";
import { Toaster, toast } from "sonner";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { computeModelMassKg, nextHeavierProfile } from "@/lib/resultsMath";
import type { SpanForceSample, StressGrid } from "@/wasmBridge/workerClient";
import { formatMm, formatRatio } from "@/lib/units";
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
  const [eigenMode, setEigenMode] = useState(0);
  const [modal, setModal] = useState<ModalReport | null>(null);
  const [massKg, setMassKg] = useState<number | null>(null);
  const ipeSeriesRef = useRef<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [catalog, modalReport] = await Promise.all([
        feaClient.fetchCatalog().catch(() => null),
        feaClient.modalAnalysis(project, 3).catch(() => null),
      ]);
      if (cancelled) return;
      if (catalog !== null) ipeSeriesRef.current = catalog.sections.map((x) => x.designation);
      setModal(modalReport);
    })();
    return () => {
      cancelled = true;
    };
  }, [project]);
  useEffect(() => {
    setMassKg(computeModelMassKg(project));
  }, [project]);
  const maxUls = uls !== undefined ? uls.beams.reduce((m, b) => Math.max(m, b.utilization), 0) : 0;
  const overloaded = (uls?.beams ?? []).filter((b) => b.utilization > 1);
  const maxSlsDeflMm =
    sls !== undefined ? sls.beams.reduce((m, b) => Math.max(m, b.midspan_deflection * 1000), 0) : 0;

  const upgradeOverloaded = () => {
    if (overloaded.length === 0 || ipeSeriesRef.current.length === 0) return;
    const undo: { beamId: number; section: string }[] = [];
    for (const b of overloaded) {
      const beam = project.structure.beams.find((x) => x.id === b.beam_id);
      if (beam === undefined) continue;
      const next = nextHeavierProfile(ipeSeriesRef.current, beam.section_id, 2);
      if (next === null) continue;
      undo.push({ beamId: beam.id, section: beam.section_id });
      useProjectStore.getState().updateBeam(beam.id, { section_id: next });
    }
    if (undo.length === 0) return;
    // Auto-solve (bug 10) refreshes the results within 150 ms.
    toast("Profil renforcé — recalcul en cours", {
      description: undo.map((u) => `B${u.beamId}: ${u.section} → profil supérieur`).join(", "),
      action: {
        label: "Annuler",
        onClick: () => {
          for (const u of undo) {
            useProjectStore.getState().updateBeam(u.beamId, { section_id: u.section });
          }
        },
      },
      duration: 5_000,
    });
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
    const colorRatios = new Map<number, number>();
    if (uls !== undefined) {
      for (const b of uls.beams) {
        colorRatios.set(b.beam_id, Math.min(1, b.utilization / 1.25));
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
  }, [report, uls, project]);
  const amplificationRef = useRef(amplification);
  amplificationRef.current = amplification;
  const scaledDeformed = useMemo(
    () =>
      deformed === null ? null : { ...deformed, deformScale: deformed.deformScale * amplification },
    [deformed, amplification],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3">
      <Toaster position="bottom-right" />
      {/* 4-KPI strip (mockups tape_4) */}
      {report !== null ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="kpi-strip">
          <KpiCard label="Masse totale" value={massKg === null ? "—" : `${massKg.toFixed(0)} kg`} />
          <KpiCard label="Flèche max ELS" value={`${maxSlsDeflMm.toFixed(2)} mm`} />
          <KpiCard
            label="Taux max EC3"
            value={formatRatio(maxUls)}
            pass={maxUls <= 1}
            onCorrective={maxUls > 1 ? upgradeOverloaded : undefined}
          />
          <KpiCard
            label="1er mode propre"
            value={modal === null ? "—" : `${modal.modes[0]?.frequency_hz.toFixed(2) ?? "—"} Hz`}
          />
        </div>
      ) : null}
      {report !== null && scaledDeformed !== null ? (
        <section className="flex min-h-[380px] flex-col rounded-panel border border-hairline bg-panel p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold">
              <Trans>Déformée & exploitation (ELU)</Trans>
            </h2>
            <label className="flex items-center gap-2 text-[12px] text-ink-secondary">
              <Trans>Amplification</Trans>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={amplification}
                className="w-32"
                onChange={(e) => setAmplification(Number(e.currentTarget.value))}
              />
              <span className="font-data">×{amplification}</span>
            </label>
          </div>
          <div className="relative min-h-[280px] flex-1 overflow-hidden rounded border border-hairline">
            <ViewportCanvas testId="results-viewport">
              <BeamMeshes
                nodes={project.structure.nodes}
                beams={project.structure.beams}
                colorRatios={scaledDeformed.colorRatios}
                displacements={scaledDeformed.displacements}
                deformScale={scaledDeformed.deformScale}
                wireframe={false}
                selectedBeamId={null}
                onPick={() => {}}
              />
              <SupportMarkers
                nodes={project.structure.nodes}
                supports={project.structure.supports}
              />
              <ForceVectors3D nodes={project.structure.nodes} loads={project.structure.loads} />
            </ViewportCanvas>
          </div>
          <div className="mt-2 flex items-center gap-2" data-testid="fea-legend">
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
              <thead className="text-left text-[11px] text-ink-muted">
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
      {report !== null && project.structure.beams.length > 0 ? (
        <DockedInspector project={project} beams={project.structure.beams} />
      ) : null}
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
            Un facteur de cas sert d'ordre de grandeur: conversions SI vers affichage exclusives a
            l'UI.
          </Trans>
        </p>
        <p className="font-data mt-1 text-[11px] text-ink-muted">
          {report !== null ? `${report.n_nodes} nœuds / ${report.n_beams} poutres` : ""}
        </p>
      </BottomSheet>
    </div>
  );
}

/** One KPI card (DESIGN.md §6: 2px badges, tabular figures). */
function KpiCard({
  label,
  value,
  pass,
  onCorrective,
}: {
  label: string;
  value: string;
  pass?: boolean;
  onCorrective?: () => void;
}) {
  return (
    <div className="rounded border border-hairline bg-panel p-3">
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p className="font-data mt-1 text-[17px] font-semibold text-ink-primary">{value}</p>
      {pass !== undefined ? (
        <span
          className={`font-data mt-1 inline-block rounded border px-1.5 py-0.5 text-[11px] ${
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
          className="mt-1 block w-full rounded bg-accent px-2 py-1 text-[11px] text-white"
          onClick={onCorrective}
        >
          Renforcer (1 clic)
        </button>
      ) : null}
    </div>
  );
}

/**
 * Docked bottom inspector (240px): 2D sigma_vM cross-section heatmap +
 * synchronized uPlot internal-force diagrams (My, Vz, N) with the
 * curvilinear slider x within [0, L].
 */
function DockedInspector({
  project,
  beams,
}: {
  project: ReturnType<typeof useProjectStore.getState>["project"];
  beams: { id: number; section_id: string }[];
}) {
  const [beamId, setBeamId] = useState(beams[0]?.id ?? 0);
  const [station, setStation] = useState(0.5);
  const [stress, setStress] = useState<StressGrid | null>(null);
  const [forces, setForces] = useState<SpanForceSample[] | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);

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

  useEffect(() => {
    if (forces === null || plotRef.current === null) {
      return;
    }
    const data: uPlot.AlignedData = [
      forces.map((f) => f.ratio),
      forces.map((f) => f.my / 1e3),
      forces.map((f) => f.vz / 1e3),
      forces.map((f) => f.n / 1e3),
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
      ],
    };
    const plot = new uPlot(opts, data, plotRef.current);
    uplotRef.current = plot;
    return () => {
      plot.destroy();
      uplotRef.current = null;
    };
  }, [forces]);

  return (
    <section
      className="grid shrink-0 grid-cols-1 gap-3 rounded-panel border border-hairline bg-panel p-3 lg:grid-cols-[32%_1fr]"
      data-testid="docked-inspector"
    >
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-ink-secondary">Coupe 2D σvM</h3>
          <select
            className="font-data rounded border border-hairline px-1 py-0.5 text-[11px]"
            value={beamId}
            onChange={(e) => setBeamId(Number(e.currentTarget.value))}
          >
            {beams.map((b) => (
              <option key={b.id} value={b.id}>
                B{b.id}
              </option>
            ))}
          </select>
        </div>
        {stress !== null ? <HeatmapSvg grid={stress} /> : null}
        <label className="mt-1 flex items-center gap-2 text-[11px] text-ink-muted">
          x ∈ [0, L]
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={station}
            className="flex-1"
            onChange={(e) => setStation(Number(e.currentTarget.value))}
          />
          <span className="font-data">{station.toFixed(2)} L</span>
        </label>
      </div>
      <div>
        <h3 className="text-[13px] font-semibold text-ink-secondary">Efforts internes</h3>
        <div ref={plotRef} className="mt-1" />
      </div>
    </section>
  );
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
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 w-full" role="img" aria-label="sigma heatmap">
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
