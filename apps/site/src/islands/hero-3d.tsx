import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { HeroFallbackSvg, type HeroModel } from "../components/HeroViewport3D";
import { NumberFlowValue } from "../components/NumberFlowValue";
import { SegmentedControl, SliderDetents, type SegmentedOption } from "../components/interior";
import { studioHref } from "../lib/env";

/**
 * Hero3D island (v2.2.0): the interactive v2.1.2 hero panel — SegmentedControl
 * model switcher, the lazy single-context R3F stage and the live load slider
 * (20 → 120 kN) driving the thermal spectrum and the rolling tabular
 * readouts. Client-only by construction: the static prerender emits the
 * crisp architectural SVG skeleton (sub-200 ms LCP, zero WebGL at build
 * time), then the island mounts on the client and swaps in the real stage.
 */

// Lazy single-context R3F hero (instant SVG skeleton = sub-200 ms LCP).
const HeroViewport3D = lazy(() =>
  import("../components/HeroViewport3D").then((m) => ({ default: m.HeroViewport3D })),
);

/** Hero telemetry (illustrative, derived from the load slider): η crosses
 * 1.00 at ≈ 96 kN on the governing member and δ grows linearly with q. */
function heroEta(loadKN: number): number {
  return 0.31 + (loadKN - 20) * 0.0093;
}
function heroDeflectionMm(loadKN: number): number {
  return 1.8 + (loadKN - 20) * 0.078;
}

const HERO_MODELS: { value: HeroModel; label: string; template: string }[] = [
  { value: "portique", label: "Portique 18 m", template: "portique" },
  { value: "warren", label: "Treillis Warren 24 m", template: "warren" },
  { value: "travees", label: "Poutre 3 travées", template: "travees" },
];

export default function Hero3DIsland(): React.ReactElement {
  const [model, setModel] = useState<HeroModel>("portique");
  const [loadKN, setLoadKN] = useState(60);
  // Client-only mount: the prerender (and the first client render, matching
  // it exactly) shows the static SVG skeleton; the WebGL stage swaps in
  // after hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const options = useMemo<SegmentedOption[]>(
    () => HERO_MODELS.map((m) => ({ value: m.value, label: m.label })),
    [],
  );
  const massKg = model === "portique" ? 1183 : model === "warren" ? 877 : 268;
  const eta = heroEta(loadKN);
  const deflection = heroDeflectionMm(loadKN);
  const template = HERO_MODELS.find((m) => m.value === model)?.template ?? "portique";
  return (
    <div
      className="overflow-hidden rounded-[8px] border border-hairline bg-canvas"
      data-testid="hero-3d-panel"
    >
      {/* Model switcher (shared spring pill, zero layout jump). */}
      <div className="flex items-center justify-between gap-2 border-b border-hairline bg-panel px-3 py-2">
        <SegmentedControl
          size="sm"
          options={options}
          label="Modèle du hero"
          value={model}
          onValueChange={(next) => setModel(next as HeroModel)}
          className="min-w-0 max-w-full"
        />
        <span className="font-data hidden shrink-0 text-[10px] text-ink-muted xl:inline">
          Scène temps réel · WebGL
        </span>
      </div>
      {/* The lazy 3D stage — instant SVG skeleton until the chunk lands. */}
      <div className="h-[280px] sm:h-[320px]">
        {mounted ? (
          <Suspense fallback={<HeroFallbackSvg model={model} loadKN={loadKN} />}>
            <HeroViewport3D model={model} loadKN={loadKN} />
          </Suspense>
        ) : (
          <HeroFallbackSvg model={model} loadKN={loadKN} />
        )}
      </div>
      {/* Live HUD: load slider + rolling tabular readouts + launch CTA. */}
      <div className="space-y-3 border-t border-hairline bg-panel p-3">
        <div className="flex items-center gap-3">
          <span className="font-data shrink-0 text-[11px] text-ink-secondary">
            Charge q · {loadKN} kN
          </span>
          <SliderDetents
            label="Charge répartie (kN)"
            min={20}
            max={120}
            step={1}
            detents={[20, 60, 120]}
            value={loadKN}
            onValueChange={(v) => setLoadKN(Math.round(v))}
            formatValue={(v) => `${Math.round(v)} kN`}
            className="min-w-0 flex-1"
          />
        </div>
        <dl className="font-data grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <dt className="text-ink-muted">Masse</dt>
            <dd className="text-[15px] font-medium text-ink-primary">
              <NumberFlowValue value={massKg} format={{ maximumFractionDigits: 0 }} />
              <span className="text-[11px] text-ink-secondary"> kg</span>
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Taux EC3 η</dt>
            <dd
              className={`text-[15px] font-medium ${eta > 1 ? "text-fail-text" : "text-pass-text"}`}
              data-testid="hero-eta"
            >
              <NumberFlowValue
                value={eta}
                format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
              />
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Flèche δ</dt>
            <dd className="text-[15px] font-medium text-ink-primary">
              <NumberFlowValue
                value={deflection}
                format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
              />
              <span className="text-[11px] text-ink-secondary"> mm</span>
            </dd>
          </div>
        </dl>
        <a
          href={studioHref(`/geometry?template=${template}`)}
          data-testid="hero-launch"
          className="flex items-center justify-center gap-1.5 rounded bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-strong"
        >
          Ouvrir dans l'atelier →
        </a>
      </div>
    </div>
  );
}
