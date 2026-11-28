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
  { value: "lm1", label: t`EN 1991-2 LM1` },
  { value: "pont_roulant", label: t`Pont roulant (2 galets)` },
  { value: "custom", label: t`Convoi personnalisé` },
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
    if (beamId === null) {
      return;
    }
    let cancelled = false;
    feaClient
      .influenceLine(project, beamId, trainX, response)
      .then((line) => {
        if (cancelled) return;
        if (
          line !== null &&
          typeof line === "object" &&
          Array.isArray(line.values) &&
          Array.isArray(line.ratios)
        ) {
          setInfluence(line);
        } else {
          setInfluence(null);
        }
      })
      .catch(() => {
        if (!cancelled) setInfluence(null);
      });
    feaClient
      .movingLoadTrain(project, beamId, trainSpec, 24)
      .then((env) => {
        if (cancelled) return;
        if (
          env !== null &&
          typeof env === "object" &&
          typeof env.my_min === "number" &&
          typeof env.vz_max === "number" &&
          typeof env.rz_max === "number" &&
          typeof env.uz_max === "number"
        ) {
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
        } else {
          setEnvelope(null);
        }
      })
      .catch(() => {
        if (!cancelled) setEnvelope(null);
      });
    return () => {
      cancelled = true;
    };
  }, [project, beamId, response, trainSpec]);

  // Play/Pause animation: the train walks the member at ~8 %/tick.
  useEffect(() => {
    if (!playing) {
      return;
    }
    const timer = setInterval(() => {
      setTrainX((x) => (x + 0.04) % 1);
    }, 160);
    return () => clearInterval(timer);
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
    <div
      data-testid="moving-load-panel"
      className="rounded-panel border border-hairline bg-panel p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-ink-secondary">
          <Trans>Convois & Lignes d'influence</Trans>
        </h3>
        <SegmentedControl
          label={t`Convoi`}
          value={preset}
          onValueChange={setPreset}
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
          {/* Train position scrubber + play/pause + axle arrows. */}
          <div className="mt-3" data-testid="train-scrubber">
            <SliderDetents
              label={t`Position du convoi`}
              value={trainX}
              onValueChange={setTrainX}
              min={0}
              max={1}
              step={0.01}
              detents={[0, 0.25, 0.5, 0.75, 1]}
              formatValue={(v) => `x = ${fr(v * (influence?.span_m ?? 1), 2)} m`}
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-hairline px-2 py-0.5 text-[11px] text-ink-secondary"
              data-testid="train-play"
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? "⏸ Pause" : "▶ Play convoi"}
            </button>
            {/* Mini axle-arrow strip: the train advances with the scrubber. */}
            <svg viewBox="0 0 220 26" className="h-6 flex-1" aria-hidden>
              {(() => {
                const arrows =
                  preset === "lm1"
                    ? [{ dx: 0, load: 150 }]
                    : preset === "pont_roulant"
                      ? [
                          { dx: 0, load: wheelKn },
                          { dx: 0.06, load: wheelKn },
                          { dx: spacingM / Math.max(influence?.span_m ?? 6, 0.1), load: wheelKn },
                          {
                            dx: spacingM / Math.max(influence?.span_m ?? 6, 0.1) + 0.06,
                            load: wheelKn,
                          },
                        ]
                      : [
                          { dx: 0, load: wheelKn * 2 },
                          {
                            dx: spacingM / Math.max(influence?.span_m ?? 6, 0.1),
                            load: wheelKn * 2,
                          },
                        ];
                return arrows.map((a, i) => {
                  const px =
                    10 +
                    (trainX * (influence?.span_m ?? 1) + a.dx * (influence?.span_m ?? 1)) *
                      (200 / Math.max(influence?.span_m ?? 1, 0.1));
                  const x = Math.min(214, Math.max(4, px));
                  return (
                    <g key={i}>
                      <line x1={x} y1={4} x2={x} y2={18} stroke="#DC2626" strokeWidth={1.6} />
                      <polygon points={`${x - 3},18 ${x + 3},18 ${x},24`} fill="#DC2626" />
                      <text x={x - 8} y={9} fontSize={7} fill="#DC2626" className="font-data">
                        {a.load} kN
                      </text>
                    </g>
                  );
                });
              })()}
              <line x1={4} y1={21} x2={216} y2={21} stroke="#94A3B8" strokeWidth={1} />
            </svg>
          </div>
          {/* uPlot influence line + cursor. */}
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
          <p className="font-data mt-1 text-[11px] text-ink-secondary">
            {`η(${fr(trainX, 2)} L) = ${fr(etaAtTrain, 4)} ${etaUnit(response)}`}
          </p>
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
