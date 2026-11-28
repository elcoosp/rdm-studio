import { useEffect, useMemo, useRef, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { SegmentedControl, SliderDetents } from "@rdm-studio/ui/interior";
import { NumberFieldRoot, NumberFieldInput } from "@/components/ui/number-field";
import {
  feaClient,
  type InfluenceLineResult,
  type TrainEnvelopeResult,
} from "@/wasmBridge/workerClient";
import { useProjectStore } from "@/state/projectStore";
import { recordMovingEnvelope } from "@/export/sessionChecks";

/**
 * M12.2 — Convois & Lignes d'Influence panel: EN 1991-2 Load Model 1
 * (tandem + UDL), overhead bridge crane (*Pont roulant*) wheel groups and
 * fully custom axle trains cross the selected member while the governing
 * envelope (Mmax / Mmin / Vmax) is recomputed in the WASM engine. The
 * influence line η(x) of the chosen response (`uz`, `My`, `Vy`, `N`,
 * `Rz`) is plotted with uPlot and a detented train-position scrubber
 * animates the axle arrows along the member.
 *
 * Display layer only (kN, mm, French comma decimals); every ordinate
 * comes from the engine in strict SI per ARCHITECTURE.md §19.4.
 */

const RESPONSES = [
  { value: "Rz", label: "Rz" },
  { value: "My", label: "My" },
  { value: "Vy", label: "Vy" },
  { value: "N", label: "N" },
  { value: "uz", label: "uz" },
] as const;

const PRESETS = [
  { value: "lm1", label: t`LM1` },
  { value: "pont_roulant", label: t`Pont roulant` },
  { value: "custom", label: t`Perso` },
] as const;

/** French decimal comma formatting. */
function fr(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits).replace(".", ",") : "—";
}

/** Scales an influence ordinate into its display unit (per kN of load). */
function etaDisplay(eta: number, response: string): number {
  return response === "uz" ? eta * 1.0e6 : eta;
}

/** Display unit of the response ordinate. */
function etaUnit(response: string): string {
  return response === "uz" ? "mm / kN" : "kN / kN";
}

export function MovingLoadPanel() {
  const project = useProjectStore((s) => s.project);
  const [preset, setPreset] = useState<string>("lm1");
  const [beamId, setBeamId] = useState<number | null>(null);
  const [response, setResponse] = useState<string>("Rz");
  const [trainX, setTrainX] = useState(0.5);
  const [playing, setPlaying] = useState(false);
  const [wheelKn, setWheelKn] = useState(25);
  const [spacingM, setSpacingM] = useState(3);
  const [influence, setInfluence] = useState<InfluenceLineResult | null>(null);
  const [envelope, setEnvelope] = useState<TrainEnvelopeResult | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);

  // Default member: first beam of the model.
  useEffect(() => {
    if (beamId === null && project.structure.beams.length > 0) {
      setBeamId(project.structure.beams[0]?.id ?? null);
    }
  }, [beamId, project.structure.beams]);

  const trainSpec = useMemo<Record<string, unknown>>(() => {
    if (preset === "lm1") {
      return { preset: "lm1" };
    }
    if (preset === "pont_roulant") {
      return {
        preset: "pont_roulant",
        wheel_load_n: wheelKn * 1000,
        end_carriage_spacing_m: spacingM,
      };
    }
    return {
      wheel_loads_n: [wheelKn * 2000, wheelKn * 2000],
      axle_spacings_m: [spacingM],
      wheel_spacing_m: 1.2,
    };
  }, [preset, wheelKn, spacingM]);

  // Influence line (25 station solves in the engine) + train envelope.
  useEffect(() => {
    if (beamId === null || project.structure.supports.length === 0) {
      setInfluence(null);
      setEnvelope(null);
      return;
    }
    let cancelled = false;
    feaClient
      .influenceLine(project, beamId, trainX, response)
      .then((line) => {
        if (!cancelled) setInfluence(line);
      })
      .catch(() => {
        if (!cancelled) setInfluence(null);
      });
    feaClient
      .movingLoadTrain(project, beamId, trainSpec, 24)
      .then((env) => {
        if (!cancelled) {
          setEnvelope(env);
          // M12.5: feed the Step 5 report chapter (last run wins).
          recordMovingEnvelope({
            beamId,
            trainLabel:
              preset === "lm1"
                ? "EN 1991-2 LM1"
                : preset === "pont_roulant"
                  ? "Pont roulant"
                  : "Convoi personnalisé",
            envelope: env,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setEnvelope(null);
      });
    return () => {
      cancelled = true;
    };
  }, [project, beamId, response, trainSpec]);

  // 60 fps requestAnimationFrame delta-time loop (4.5 s full span traversal).
  useEffect(() => {
    if (!playing) {
      return;
    }
    let rafId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      setTrainX((x) => (x + dt * 0.22) % 1);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing]);

  // Interpolated ordinate at the scrubber (cached engine values).
  const etaAtTrain = useMemo(() => {
    if (influence === null || !Array.isArray(influence.values) || influence.values.length < 2) {
      return 0;
    }
    const n = influence.values.length - 1;
    const scaled = trainX * n;
    const i = Math.min(Math.floor(scaled), n - 1);
    const frac = scaled - i;
    const lo = influence.values[i] ?? 0;
    const hi = influence.values[i + 1] ?? lo;
    return lo + (hi - lo) * frac;
  }, [influence, trainX]);

  // uPlot influence line + train-position cursor.
  useEffect(() => {
    const host = plotRef.current;
    if (
      host === null ||
      influence === null ||
      !Array.isArray(influence.ratios) ||
      !Array.isArray(influence.values) ||
      influence.ratios.length < 2
    ) {
      return;
    }
    const ys = influence.values.map((v) => etaDisplay(v, influence.response));
    const data: uPlot.AlignedData = [influence.ratios.map((r) => r * (influence.span_m || 1)), ys];
    const opts: uPlot.Options = {
      width: host.clientWidth,
      height: 150,
      scales: { x: { time: false } },
      legend: { show: false },
      axes: [
        {
          values: (_u: uPlot, ticks: number[]) => ticks.map((v) => `${v.toFixed(1)} m`),
        },
        { values: (_u: uPlot, ticks: number[]) => ticks.map((v) => v.toFixed(2)) },
      ],
      series: [
        {},
        {
          label: `η ${influence.response}`,
          stroke: "#1d4ed8",
          width: 1.5,
          fill: "rgba(29,78,216,0.08)",
          spanGaps: true,
        },
      ] as uPlot.Series[],
    };
    const plot = new uPlot(opts, data, host);
    uplotRef.current = plot;
    return () => {
      plot.destroy();
      uplotRef.current = null;
    };
  }, [influence]);

  // Train cursor overlay (vertical line at the train position).
  const cursorLeft = useMemo(() => {
    const plot = uplotRef.current;
    if (plot === null || influence === null) {
      return null;
    }
    const xMax = influence.span_m || 1;
    return (plot.valToPos(trainX * xMax, "x") + plot.bbox.left) / (window.devicePixelRatio || 1);
  }, [influence, trainX]);

  return (
    <div data-testid="moving-load-panel" className="border-b border-hairline py-3.5">
      <h3 className="text-[12px] font-semibold text-ink-secondary">
        <Trans>Convois & Lignes d'influence</Trans>
      </h3>
      <div className="mt-2">
        <SegmentedControl
          label={t`Convoi`}
          value={preset}
          onValueChange={setPreset}
          className="w-full"
          options={PRESETS.map((p) => ({
            value: p.value,
            label: p.label,
            testId: `train-preset-${p.value}`,
          }))}
        />
      </div>
      {beamId !== null ? (
        <>
          <p className="font-data mt-2 text-[11px] text-ink-muted">
            {`Membre P${beamId} · ${
              project.structure.beams.find((b) => b.id === beamId)?.section_id ?? ""
            }`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <SegmentedControl
              label={t`Réponse`}
              value={response}
              onValueChange={setResponse}
              options={RESPONSES.map((r) => ({
                value: r.value,
                label: r.label,
                testId: `train-response-${r.value}`,
              }))}
            />
            {preset !== "lm1" ? (
              <>
                <label className="flex items-center gap-1.5 text-[11px] text-ink-secondary">
                  <span>
                    {preset === "pont_roulant" ? (
                      <Trans>Galet (kN)</Trans>
                    ) : (
                      <Trans>Essieu (kN)</Trans>
                    )}
                  </span>
                  <NumberFieldRoot
                    value={wheelKn}
                    min={1}
                    step={5}
                    onValueChange={(v) => {
                      if (v !== null) setWheelKn(v);
                    }}
                  >
                    <NumberFieldInput
                      className="font-data h-7 w-16 text-right text-[12px]"
                      inputMode="decimal"
                      data-testid="train-wheel-kn"
                    />
                  </NumberFieldRoot>
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-ink-secondary">
                  <span>
                    <Trans>Entraxe (m)</Trans>
                  </span>
                  <NumberFieldRoot
                    value={spacingM}
                    min={0.5}
                    step={0.5}
                    onValueChange={(v) => {
                      if (v !== null) setSpacingM(v);
                    }}
                  >
                    <NumberFieldInput
                      className="font-data h-7 w-16 text-right text-[12px]"
                      inputMode="decimal"
                      data-testid="train-spacing-m"
                    />
                  </NumberFieldRoot>
                </label>
              </>
            ) : null}
          </div>
          {/* Swiss Metrology convoy elevation & 60 fps scrubber */}
          <div className="mt-2.5 rounded-[6px] border border-hairline bg-canvas/65 p-2.5">
            <div data-testid="train-scrubber">
              <SliderDetents
                label={t`Position du convoi`}
                value={trainX}
                onValueChange={(v) => {
                  setPlaying(false);
                  setTrainX(v);
                }}
                min={0}
                max={1}
                step={0.002}
                detents={[0, 0.25, 0.5, 0.75, 1]}
                formatValue={(v) => `${fr(v * (influence?.span_m ?? 1), 2)} m`}
              />
            </div>

            {/* Rolling trolley & girder elevation SVG */}
            <svg viewBox="0 0 260 44" className="mt-2 h-11 w-full overflow-visible" aria-hidden>
              {/* Girder beam + quarter ticks + end supports */}
              <line x1={14} y1={33} x2={246} y2={33} stroke="#334155" strokeWidth={2.2} />
              {[0, 0.25, 0.5, 0.75, 1].map((q) => {
                const tx = 14 + q * 232;
                return (
                  <line
                    key={q}
                    x1={tx}
                    y1={33}
                    x2={tx}
                    y2={36.5}
                    stroke="#94A3B8"
                    strokeWidth={1}
                  />
                );
              })}
              <polygon
                points="14,34 9.5,41 18.5,41"
                fill="none"
                stroke="#475569"
                strokeWidth={1.2}
              />
              <polygon
                points="246,34 241.5,40 250.5,40"
                fill="none"
                stroke="#475569"
                strokeWidth={1.2}
              />
              <line x1={241} y1={42.2} x2={251} y2={42.2} stroke="#475569" strokeWidth={1.2} />

              {(() => {
                const span = Math.max(influence?.span_m ?? 6, 0.1);
                const arrows =
                  preset === "lm1"
                    ? [
                        { dx: 0, load: 150 },
                        { dx: 1.2 / span, load: 150 },
                      ]
                    : preset === "pont_roulant"
                      ? [
                          { dx: 0, load: wheelKn },
                          { dx: spacingM / span, load: wheelKn },
                        ]
                      : [
                          { dx: 0, load: wheelKn * 2 },
                          { dx: spacingM / span, load: wheelKn * 2 },
                        ];
                const xs = arrows.map((a) =>
                  Math.min(246, Math.max(14, 14 + (trainX + a.dx) * 232)),
                );
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                return (
                  <g>
                    {/* Trolley chassis bar connecting bogie wheels */}
                    {xs.length > 1 ? (
                      <line
                        x1={minX}
                        y1={24}
                        x2={maxX}
                        y2={24}
                        stroke="#1D4ED8"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                      />
                    ) : null}
                    {arrows.map((a, i) => {
                      const x = xs[i] ?? 14;
                      return (
                        <g key={i}>
                          <line x1={x} y1={10} x2={x} y2={26} stroke="#DC2626" strokeWidth={1.6} />
                          <polygon points={`${x - 3},25 ${x + 3},25 ${x},30`} fill="#DC2626" />
                          <circle cx={x} cy={30.8} r={2} fill="#0F172A" />
                          <text
                            x={x}
                            y={7.5}
                            textAnchor="middle"
                            fontSize={7.5}
                            fontWeight={600}
                            fill="#DC2626"
                            className="font-data"
                          >
                            {a.load} kN
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })()}
            </svg>

            <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-hairline/80 pt-2">
              <button
                type="button"
                className={`inline-flex h-6.5 shrink-0 items-center gap-1.5 rounded-[4px] border px-2.5 text-[11px] font-medium transition-colors ${
                  playing
                    ? "border-accent bg-accent-tint text-accent"
                    : "border-hairline bg-panel text-ink-secondary hover:border-accent hover:text-accent"
                }`}
                data-testid="train-play"
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? "⏸ Pause" : "▶ Play"}
              </button>
              <span className="font-data whitespace-nowrap text-[11px] font-medium text-ink-primary [font-variant-numeric:tabular-nums]">
                {`η(${fr(trainX, 2)} L) = ${fr(etaAtTrain, 4)} ${etaUnit(response)}`}
              </span>
            </div>
          </div>

          <div className="relative mt-3" data-testid="influence-line-plot">
            <div ref={plotRef} className="w-full" />
            {cursorLeft !== null ? (
              <div
                className="pointer-events-none absolute top-0 h-full w-px bg-[#DC2626]"
                style={{ left: `${cursorLeft}px` }}
                aria-hidden
              />
            ) : null}
          </div>

          {/* Governing moving-load envelope. */}
          {envelope !== null ? (
            <dl
              className="font-data mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] [font-variant-numeric:tabular-nums] sm:grid-cols-4"
              data-testid="moving-envelope"
            >
              <div>
                <dt className="text-[10px] text-ink-muted">M max</dt>
                <dd>{fr(envelope.my_max / 1000, 1)} kN·m</dd>
              </div>
              <div>
                <dt className="text-[10px] text-ink-muted">M min</dt>
                <dd>{fr(envelope.my_min / 1000, 1)} kN·m</dd>
              </div>
              <div>
                <dt className="text-[10px] text-ink-muted">V max</dt>
                <dd>{fr(envelope.vz_max / 1000, 1)} kN</dd>
              </div>
              <div>
                <dt className="text-[10px] text-ink-muted">Rz max</dt>
                <dd>{fr(envelope.rz_max / 1000, 1)} kN</dd>
              </div>
              <div className="col-span-2 text-[10px] text-ink-muted sm:col-span-4">
                {`Convoi ${fr(envelope.train_total_n / 1000, 0)} kN · position governante x = ${fr(
                  envelope.governing_ratio,
                  2,
                )} L · uz max = ${fr(envelope.uz_max * 1000, 2)} mm`}
              </div>
            </dl>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-[12px] text-ink-muted">
          <Trans>Créez une barre pour étudier les convois mobiles.</Trans>
        </p>
      )}
    </div>
  );
}
