import { useMemo, useState } from "react";
import { I18nProvider, Trans } from "@lingui/react";
import { i18n } from "../i18n/i18n";
import { SegmentedControl } from "@rdm-studio/ui/interior";
import { Button } from "@rdm-studio/ui/primitives";
import { studioHref } from "../lib/env";
import {
  ENGINEERING_CATALOG,
  type EngineeringModel,
  type Sector,
} from "@rdm-studio/ui/templates";
import { StatusBadge, Tooltip, TooltipGroup } from "@rdm-studio/ui/interior";
import { trackSiteEvent, trackShowcaseFilterChanged, trackShowcaseModelViewed, trackShowcaseLaunchStudio } from "../lib/productTelemetry";

/**
 * ShowcaseTabs island (v2.3.0): the 15-model sector-filtered interactive
 * gallery. Replaces the 3-model static list with every canonical model from
 * `@rdm-studio/ui/templates` (`ENGINEERING_CATALOG`), including the naval &
 * lifting flagships. Renders rich architectural SVG previews, section /
 * mass / Eurocode telemetry and 1-click launch buttons to canonical English
 * `?template=<slug>` studio deep links.
 *
 * i18n: the island renders in its own React root (outside the layout's
 * `<I18nProvider>`), so it wraps itself in the provider over the shared
 * singleton. The catalog (`ENGINEERING_CATALOG`) is the SSOT for the French
 * descriptions and English titles; the island holds the French display
 * titles (`FR_TITLE`) and the English descriptions (`EN_DESCRIPTION`) keyed
 * by slug, and picks the pair for the active locale at render time.
 */

type Filter = "all" | Sector;

const FILTERS: { value: Filter; labelId: string; label: string }[] = [
  { value: "all", labelId: "site.showcase.filter.all", label: "Tous (15)" },
  { value: "Naval & Lifting", labelId: "site.showcase.filter.naval", label: "Naval & Levage" },
  { value: "Building & Framing", labelId: "site.showcase.filter.building", label: "Bâtiment & Charpente" },
  { value: "Bridges & Frames", labelId: "site.showcase.filter.bridges", label: "Passerelles & Ossatures" },
  { value: "Timber & Multi-Material", labelId: "site.showcase.filter.timber", label: "Bois & Multi-matériaux" },
];

/** French display names for the gallery (canonical English slugs stay in URLs). */
const FR_TITLE: Record<string, string> = {
  "portal-frame": "Portique acier 18 m",
  "warren-truss": "Treillis Warren 24 m",
  "continuous-beam": "Poutre continue 3 travées 18 m",
  "cantilever": "Potence acier HEA 200",
  "pitched-portal": "Portique toit en pente 15 m",
  "pratt-truss": "Pont treillis Pratt 30 m",
  "howe-truss": "Treillis Howe industriel 28 m",
  "braced-frame": "Cadre contreventé 3 étages",
  "cantilever-canopy": "Potence d'atelier 5 t",
  "pedestrian-bridge": "Passerelle piétonne 40 m",
  "naval-cradle": "Berceau de transport naval DNV",
  "lifting-beam": "Palonnier de levage 20 t EN 13155",
  "offshore-skid": "Châssis offshore",
  "glulam-beam": "Poutre lamellé-collé GL24h 12 m",
  "composite-beam": "Poutre mixte acier-béton",
};

/** English descriptions (the catalog holds the French ones). */
const EN_DESCRIPTION: Record<string, string> = {
  "portal-frame":
    "Single-bay portal with HEA 200 columns and IPE 300 rafter, fixed-pinned bases. Flexural buckling χy, interaction 6.61 and second-order P-Δ effects to EN 1993-1-1.",
  "warren-truss":
    "Simply supported Warren truss, 24 m span, 3 m deep, CHS 139.7×5 diagonals. Chord buckling χz, lateral-torsional buckling χLT and nodal load distribution to EN 1993-1-1.",
  "continuous-beam":
    "Three equal 6 m spans, continuous IPE 300 on columns. Moment redistribution, support reactions and SLS deflection L/250 to EN 1993-1-1.",
  "cantilever":
    "6 m HEA 200 cantilever fixed at the base. Lateral-torsional buckling χLT, tip deflection and moment/shear check at the fixity to EN 1993-1-1.",
  "pitched-portal":
    "Pitched-roof portal, 15 m span, 15° pitch, tapered IPE sections. Snow to EN 1991-1-3, wind to EN 1991-1-4 and plastic class-1 design to EC3.",
  "pratt-truss":
    "Simply supported 30 m Pratt truss for a pedestrian and cycle bridge. Bridge rules to EN 1993-2, fatigue check and LM1 traffic load to EN 1991-2.",
  "howe-truss":
    "28 m Howe truss supporting a crane runway. Crane-supporting structures to EN 1993-6, dynamic amplification φ and lateral buckling of compressed chords.",
  "braced-frame":
    "Three-storey office steel frame with concentric bracing. Seismic to EN 1998-1 (CQC/SRSS), wind to EN 1991-1-4, member checks to EN 1993-1-1 and one-click Pareto optimizer.",
  "cantilever-canopy":
    "8 m architectural cantilever canopy, tapered CHS 219.1×8 section. Wind suction to EN 1991-1-4, snow drift and SLS vibration f₁ > 3 Hz.",
  "pedestrian-bridge":
    "40 m tied-arch footbridge, S355 J2. Fatigue to EN 1993-2, crowd load to EN 1991-2 and vertical acceleration comfort limit 0.5 m/s².",
  "naval-cradle":
    "120 t launching cradle on 3-axle rail bogies. Member checks to EN 1993-1-1, rail loads to EN 1991-2 and (ax, ay, az) × g acceleration field for transport.",
  "lifting-beam":
    "20 t lifting beam, 6 m span, IPE 500 with stiffeners. Lateral-torsional buckling χLT to EN 1993-1-1, modal natural frequencies f₁..f₆ and dynamic amplification for crane hooks.",
  "offshore-skid":
    "12×6 m offshore module skid, multi-material (steel + grating). Stainless 304L to EN 1993-1-4, wind to EN 1991-1-4, seismic to EN 1998-1 and modal analysis.",
  "glulam-beam":
    "Simply supported 12 m GL24h glulam beam. Bending fm,k, shear fv,k, SLS vibration and creep kdef to EN 1995-1-1.",
  "composite-beam":
    "Composite beam IPE 300 + 150 mm concrete slab, headed studs. Partial connection, effective width and construction stages to EN 1994-1-1.",
};

export default function ShowcaseTabsIsland(): React.ReactElement {
  const [sector, setSector] = useState<Filter>("all");
  const locale = i18n.locale === "en" ? "en" : "fr";
  const models = useMemo<EngineeringModel[]>(() => {
    if (sector === "all") return ENGINEERING_CATALOG;
    return ENGINEERING_CATALOG.filter((m) => m.sector === sector);
  }, [sector]);
  const count = models.length;
  const filterOptions = useMemo(
    () => FILTERS.map((f) => ({ value: f.value, label: i18n._({ id: f.labelId, message: f.label }) })),
    // Re-resolve when the locale changes (the provider re-renders on change).
    [i18n.locale],
  );
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR"),
    [locale],
  );

  return (
    <I18nProvider i18n={i18n}>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 border-b border-hairline pb-2">
          <SegmentedControl
            data-testid="showcase-filter"
            options={filterOptions}
            value={sector}
            onValueChange={(next) => {
              const f = next as Filter;
              setSector(f);
              void trackShowcaseFilterChanged(f);
            }}
          />
          <span className="font-data shrink-0 text-[11px] text-ink-muted">
            {i18n._({
              id: "site.showcase.count",
              message: "{count, plural, one {# modèle} other {# modèles}}",
              values: { count },
            })}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {models.map((model) => {
            const preview = model.previewSvg.replace(
              '<svg ',
              '<svg width="100%" height="100%" ',
            );
            const title = locale === "en" ? model.title : (FR_TITLE[model.slug] ?? model.title);
            const sectorLabel =
              locale === "en"
                ? model.sector
                : (FILTERS.find((f) => f.value === model.sector)?.label ?? model.sector);
            const description =
              locale === "en" ? (EN_DESCRIPTION[model.slug] ?? model.description) : model.description;
            return (
                <article
                  key={model.slug}
                  className="rounded-[8px] border border-hairline bg-panel p-4 flex flex-col h-full"
                  data-testid={`showcase-${model.slug}`}
                  onClick={() => void trackShowcaseModelViewed(model.slug)}
                >
                <div
                  className="h-32 w-full flex items-center justify-center bg-canvas border border-hairline rounded-[6px] p-2 text-accent"
                  dangerouslySetInnerHTML={{ __html: preview }}
                />
                <h3 className="mt-2 text-[14px] font-semibold text-ink-primary">{title}</h3>
                <StatusBadge tone="accent" mono className="mt-1.5 shrink-0">
                  {sectorLabel}
                </StatusBadge>
                <p className="mt-1.5 text-[12px] leading-5 text-ink-secondary">{description}</p>
                <dl className="mt-3 font-data grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                  <div>
                    <dt className="text-ink-muted">
                      <Trans id="site.showcase.mass" message="Masse" />
                    </dt>
                    <dd className="mt-0.5 text-ink-primary tabular-nums">
                      {numberFormat.format(model.massKg)} kg
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">
                      <Trans id="site.showcase.section" message="Profil" />
                    </dt>
                    <dd className="mt-0.5 text-ink-primary">{model.primarySection}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-ink-muted">
                      <Trans id="site.showcase.eurocodes" message="Eurocodes" />
                    </dt>
                    <dd className="mt-1 text-ink-secondary">
                      <TooltipGroup openDelay={300} skipDelay={400} className="flex flex-wrap items-center gap-1">
                        {model.eurocodes.map((ec) => (
                          <Tooltip
                            key={ec}
                            label={i18n._({
                              id: "site.showcase.eurocode.tooltip",
                              message: "Vérifications {ec} intégrées (classes 1-4, χ, Nb,Rd, Mc,Rd)",
                              values: { ec },
                            })}
                            side="top"
                          >
                            <span className="whitespace-nowrap rounded-[2px] border border-hairline bg-panel px-1 py-0.5 text-[10px]">{ec}</span>
                          </Tooltip>
                        ))}
                      </TooltipGroup>
                    </dd>
                  </div>
                </dl>
                <Button
                  asChild
                  variant="primary"
                  size="sm"
                  className="mt-auto"
                >
                  <a
                    href={studioHref(`/geometry?template=${model.slug}`)}
                    data-testid={`launch-${model.slug}`}
                    className="flex items-center justify-center gap-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      void trackShowcaseLaunchStudio(model.slug);
                    }}
                  >
                    <Trans id="site.showcase.open" message="Ouvrir dans l'atelier →" />
                  </a>
                </Button>
              </article>
            );
          })}
        </div>
      </div>
    </I18nProvider>
  );
}
