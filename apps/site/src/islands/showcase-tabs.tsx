import { useState } from "react";
import {
  ContinuousBeamIcon,
  PortalFrameIcon,
  WarrenTrussIcon,
} from "../components/icons";
import { studioHref } from "../lib/env";

/**
 * ShowcaseTabs island (v2.2.0): the interactive 3-model showcase ported
 * verbatim from the v2.1.2 landing (`buildShowcase()` — Portique 18 m,
 * Treillis Warren 24 m, Poutre 3 travées) with the architectural linework,
 * the telemetry column and the 1-click studio launch CTAs wired to
 * PUBLIC_APP_URL. Static prerender renders the first model; hydration
 * enables the tab switcher.
 */

type ShowcaseModel = {
  kind: "portique" | "warren" | "travees";
  name: string;
  description: string;
  sections: string;
  norm: string;
  massKg: number;
  members: number;
  art: React.ReactElement;
};

function buildShowcase(): ShowcaseModel[] {
  return [
    {
      kind: "portique",
      name: "Portique 18 m",
      description:
        "Portique encastré-articulé en HEA 200, traversé IPE 300 — le cas d'école de la transmission M/N au nœud rigide.",
      sections: "HEA 200 + IPE 300",
      norm: "EN 1993-1-1",
      massKg: 1183,
      members: 3,
      art: (
        <svg viewBox="0 0 220 130" className="h-full w-full" role="img" aria-hidden>
          <g stroke="#1D4ED8" strokeWidth="2" fill="none" strokeLinecap="round">
            <path d="M40 118 V38 H180 V118" />
          </g>
          <g stroke="#94A3B8" strokeWidth="1">
            <line x1="30" y1="118" x2="190" y2="118" />
            <line x1="40" y1="38" x2="180" y2="38" strokeDasharray="3 3" />
          </g>
          <g fill="#0F172A">
            <circle cx="40" cy="38" r="3.5" />
            <circle cx="180" cy="38" r="3.5" />
          </g>
          <g fill="#1D4ED8">
            <rect x="31" y="116" width="18" height="4" />
            <rect x="146" y="116" width="18" height="4" />
          </g>
          <g stroke="#DC2626" strokeWidth="1.5" fill="none">
            <path d="M110 30 V38 M106 34 L110 38 L114 34" />
          </g>
          <text x="110" y="127" textAnchor="middle" fontSize="9" fill="#475569" className="font-data">
            18,0 m
          </text>
        </svg>
      ),
    },
    {
      kind: "warren",
      name: "Treillis Warren 24 m",
      description:
        "Diagonales alternées sans montants : certains barreaux sont sans effort selon le chargement — articulez et comparez.",
      sections: "IPE 200",
      norm: "EN 1993-1-1",
      massKg: 877,
      members: 11,
      art: (
        <svg viewBox="0 0 220 130" className="h-full w-full" role="img" aria-hidden>
          <g stroke="#1D4ED8" strokeWidth="2" fill="none" strokeLinejoin="round">
            <path d="M20 40 H200" />
            <path d="M40 100 H180" />
            <path d="M20 40 L40 100 L60 40 L80 100 L100 40 L120 100 L140 40 L160 100 L180 40 L200 100" />
          </g>
          <g fill="#0F172A">
            {[
              [20, 40],
              [60, 40],
              [100, 40],
              [140, 40],
              [180, 40],
              [200, 40],
              [40, 100],
              [80, 100],
              [120, 100],
              [160, 100],
            ].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="3" />
            ))}
          </g>
          <g stroke="#94A3B8" strokeWidth="1">
            <line x1="12" y1="100" x2="208" y2="100" />
          </g>
          <text x="110" y="124" textAnchor="middle" fontSize="9" fill="#475569" className="font-data">
            24,0 m
          </text>
        </svg>
      ),
    },
    {
      kind: "travees",
      name: "Poutre 3 travées",
      description:
        "Poutre continue 3 × 4 m : moments négatifs sur appuis et redistribution — comparez 6.10 et 6.10a/b ici.",
      sections: "IPE 300",
      norm: "EN 1993-1-1",
      massKg: 268,
      members: 3,
      art: (
        <svg viewBox="0 0 220 130" className="h-full w-full" role="img" aria-hidden>
          <g stroke="#1D4ED8" strokeWidth="2" fill="none">
            <line x1="20" y1="56" x2="200" y2="56" />
          </g>
          <g stroke="#94A3B8" strokeWidth="1">
            <line x1="20" y1="62" x2="200" y2="62" strokeDasharray="3 3" />
          </g>
          <g fill="#1D4ED8">
            {[20, 80, 140, 200].map((x) => (
              <path key={x} d={`M${x - 8} 118 L${x + 8} 118 L${x} 104 Z`} />
            ))}
          </g>
          <g fill="#0F172A">
            {[20, 80, 140, 200].map((x) => (
              <circle key={x} cx={x} cy="56" r="3.5" />
            ))}
          </g>
          <g stroke="#DC2626" strokeWidth="1.5" fill="none">
            <path d="M64 44 V56 M60 48 L64 44 L68 48" />
            <path d="M112 44 V56 M108 48 L112 44 L116 48" />
            <path d="M166 44 V56 M162 48 L166 44 L170 48" />
          </g>
          <text x="110" y="128" textAnchor="middle" fontSize="9" fill="#475569" className="font-data">
            3 × 4,0 m
          </text>
        </svg>
      ),
    },
  ];
}

export default function ShowcaseTabsIsland(): React.ReactElement {
  const showcaseItems = buildShowcase();
  const [activeShowcase, setActiveShowcase] = useState(0);
  const showcase = showcaseItems[activeShowcase] ?? showcaseItems[0];
  if (showcase === undefined) {
    return <div />;
  }
  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      {/* Model selector — flat hairline rows, no nested cards. */}
      <div
        className="flex flex-row gap-2 overflow-x-auto md:flex-col"
        role="tablist"
        aria-label="Modèles d'ouverture"
      >
        {showcaseItems.map((model, index) => {
          const Icon =
            model.kind === "portique"
              ? PortalFrameIcon
              : model.kind === "warren"
                ? WarrenTrussIcon
                : ContinuousBeamIcon;
          return (
            <button
              key={model.kind}
              role="tab"
              aria-selected={index === activeShowcase}
              data-testid={`showcase-${model.kind}`}
              onClick={() => setActiveShowcase(index)}
              className={`flex min-w-[190px] items-center gap-2 rounded-[4px] border px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
                index === activeShowcase
                  ? "border-accent bg-accent-tint text-accent"
                  : "border-hairline bg-panel text-ink-secondary hover:border-border-subtle hover:text-ink-primary"
              }`}
            >
              <Icon size={22} />
              {model.name}
            </button>
          );
        })}
      </div>
      {/* Active model: architectural linework + telemetry. */}
      <div className="grid gap-0 overflow-hidden rounded-[8px] border border-hairline bg-panel md:grid-cols-[1fr_220px]">
        <div className="min-h-[220px] bg-canvas p-6">{showcase.art}</div>
        <div className="border-t border-hairline p-4 md:border-t-0 md:border-l">
          <dl className="font-data space-y-2.5 text-[12px]">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-ink-muted">Masse</dt>
              <dd className="text-ink-primary tabular-nums">{showcase.massKg} kg</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-ink-muted">Profilés</dt>
              <dd className="text-ink-primary tabular-nums">
                {showcase.members} barreaux · {showcase.sections}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-ink-muted">Norme</dt>
              <dd className="text-ink-primary">{showcase.norm}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[12px] leading-5 text-ink-secondary">{showcase.description}</p>
          <a
            href={studioHref(`/geometry?template=${showcase.kind}`)}
            data-testid={`launch-${showcase.kind}`}
            className="mt-4 flex items-center justify-center gap-1.5 rounded bg-accent px-3 py-2 text-[13px] font-semibold text-white hover:bg-accent-strong"
          >
            Ouvrir dans l'atelier
          </a>
        </div>
      </div>
    </div>
  );
}
