import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { I18nProvider, Trans } from "@lingui/react";
import { i18n } from "../i18n/i18n";
import { studioHref } from "../lib/env";
import { HeroFallbackSvg, type HeroModel } from "../components/HeroViewport3D";
import { trackSiteEvent, trackHero3dModelSwitched, trackHero3dLoadChanged, trackHeroCopyLinkClicked, trackHeroLaunchStudio } from "../lib/productTelemetry";
import {
  CopyButton,
  NumberFlowValue,
  SegmentedControl,
  SliderDetents,
  Tooltip,
  TooltipGroup,
  type SegmentedOption,
} from "@rdm-studio/ui/interior";

/**
 * Hero3D island (v2.2.0): the interactive v2.1.2 hero panel — SegmentedControl
 * model switcher, the lazy single-context R3F stage and the live load slider
 * (20 → 120 kN) driving the thermal spectrum and the rolling tabular
 * readouts. Client-only by construction: the static prerender emits the
 * crisp architectural SVG skeleton (sub-200 ms LCP, zero WebGL at build
 * time), then the island mounts on the client and swaps in the real stage.
 *
 * i18n: the island renders in its own React root (outside the layout's
 * `<I18nProvider>`), so it wraps itself in the provider over the shared
 * singleton. Model labels resolve at render time via `i18n._` (never at
 * module scope — the locale is only known once the layout activated it).
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

const HERO_MODELS: {
  value: HeroModel;
  labelId: string;
  label: string;
  template: string;
}[] = [
  { value: "portal-frame", labelId: "site.hero.model.portalFrame", label: "Portique 18 m", template: "portal-frame" },
  { value: "warren-truss", labelId: "site.hero.model.warrenTruss", label: "Treillis Warren 24 m", template: "warren-truss" },
  { value: "continuous-beam", labelId: "site.hero.model.continuousBeam", label: "Poutre 3 travées", template: "continuous-beam" },
  { value: "naval-cradle", labelId: "site.hero.model.navalCradle", label: "Berceau naval (DNV)", template: "naval-cradle" },
];

export default function Hero3DIsland(): React.ReactElement {
  const [model, setModel] = useState<HeroModel>("portal-frame");
  const [loadKN, setLoadKN] = useState(60);
  // Client-only mount: the prerender (and the first client render, matching
  // it exactly) shows the static SVG skeleton; the WebGL stage swaps in
  // after hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const options = useMemo<SegmentedOption[]>(
    () => HERO_MODELS.map((m) => ({ value: m.value, label: i18n._({ id: m.labelId, message: m.label }) })),
    // The singleton's locale is set by the layout before mount; re-resolve
    // if it ever changes (the provider re-renders this tree on change).
    [i18n.locale],
  );
  const massKg =
    model === "portal-frame"
      ? 1183
      : model === "warren-truss"
        ? 877
        : model === "continuous-beam"
          ? 268
          : 15600;
  const eta = heroEta(loadKN);
  const deflection = heroDeflectionMm(loadKN);
  const template = HERO_MODELS.find((m) => m.value === model)?.template ?? "portique";
  return (
    <I18nProvider i18n={i18n}>
      <div
        className="overflow-hidden rounded-[8px] border border-hairline bg-canvas"
        data-testid="hero-3d-panel"
      >
        {/* Model switcher (shared spring pill, zero layout jump). */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-panel px-3 py-2">
          <SegmentedControl
            size="sm"
            options={options}
            label={i18n._({ id: "site.hero.model.label", message: "Modèle" })}
            value={model}
            onValueChange={(next) => {
              const m = next as HeroModel;
              setModel(m);
              void trackHero3dModelSwitched(m);
            }}
            className="min-w-0"
          />
          <span className="font-data hidden shrink-0 text-[10px] text-ink-muted xl:inline">
            <Trans id="site.hero.realtime" message="Scène temps réel · WebGL" />
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
              <Trans id="site.hero.load.label" message="Charge q · {load} kN" values={{ load: loadKN }} />
            </span>
            <SliderDetents
              label={i18n._({ id: "site.hero.slider.label", message: "Charge répartie (kN)" })}
              min={20}
              max={120}
              step={1}
              detents={[20, 60, 120]}
              value={loadKN}
              onValueChange={(v) => {
                const rounded = Math.round(v);
                setLoadKN(rounded);
                void trackHero3dLoadChanged(rounded);
              }}
              formatValue={(v) => `${Math.round(v)} kN`}
              className="min-w-0 flex-1"
            />
          </div>
          <dl className="font-data grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <dt className="text-ink-muted">
                <Trans id="site.hero.readout.mass" message="Masse" />
              </dt>
              <dd className="text-[15px] font-medium text-ink-primary">
                <NumberFlowValue value={massKg} format={{ maximumFractionDigits: 0 }} />
                <span className="text-[11px] text-ink-secondary"> kg</span>
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">
                <Trans id="site.hero.readout.eta" message="Taux EC3 η" />
              </dt>
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
              <dt className="text-ink-muted">
                <Trans id="site.hero.readout.deflection" message="Flèche δ" />
              </dt>
              <dd className="text-[15px] font-medium text-ink-primary">
                <NumberFlowValue
                  value={deflection}
                  format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
                />
                <span className="text-[11px] text-ink-secondary"> mm</span>
              </dd>
            </div>
          </dl>
          {model === "naval-cradle" && (
            <p className="font-data mt-2 text-[11px] leading-5 text-ink-secondary">
              <Trans
                id="site.hero.naval.note"
                message="Champ d’accélération (ax, ay, az) = (0,8 g ; 0,6 g ; −1,5 g)"
              />
            </p>
          )}
          <div className="flex items-center gap-2">
              <CopyButton
                value={studioHref(`/geometry?template=${template}`)}
                label={i18n._({ id: "site.hero.copy.label", message: "Copier le lien" })}
                copiedLabel={i18n._({ id: "site.hero.copy.copied", message: "Copié" })}
                testId="hero-copy-link"
                onCopy={() => void trackHeroCopyLinkClicked()}
              />
            <a
              href={studioHref(`/geometry?template=${template}`)}
              data-testid="hero-launch"
              className="flex items-center justify-center gap-1.5 rounded-[4px] bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-strong"
              onClick={() => void trackHeroLaunchStudio(template)}
            >
              <Trans id="site.hero.open" message="Ouvrir dans l'atelier →" />
            </a>
          </div>
        </div>
      </div>
    </I18nProvider>
  );
}
