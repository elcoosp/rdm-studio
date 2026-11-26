import { createFileRoute, redirect, useLocation, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Lock } from "lucide-react";
import {
  ContinuousBeamIcon,
  ConcreteBeamIcon,
  DynamicAcceleration,
  MagneticSnap,
  PortalFrameIcon,
  SectionCut,
  SteelJointIcon,
  VolumetricMesh,
  WarrenTrussIcon,
} from "@/components/icons/EngineeringIcons";
import { NumberFlowValue } from "@/components/NumberFlowValue";
import {
  ExpandablePanel,
  SegmentedControl,
  SliderDetents,
  type SegmentedOption,
} from "@/components/interior";
import { HeroFallbackSvg, type HeroModel } from "@/components/HeroViewport3D";
import { docsHref } from "@/lib/urls";

export const Route = createFileRoute("/_marketing/")({
  staticData: { surface: "marketing" },
  // v2.2.0: the landing page moved to the dedicated Oxide static site
  // (PUBLIC_SITE_URL / rdm-studio-site.vercel.app) — `/` in the studio PWA
  // immediately hands off to the 3D editor so a cold open lands on a
  // calculable model instead of a marketing surface.
  beforeLoad: () => {
    throw redirect({ to: "/geometry", replace: true });
  },
  component: LandingPage,
});

/**
 * Landing page at `/` (v2.1.2 flagship commercial layer): the interactive
 * Three.js 3D Hero (lazy-loaded single-context R3F stage with a live load
 * slider 20 → 120 kN driving the thermal stress colors and the rolling
 * tabular readouts), the 4-metric technical proof strip, the asymmetric
 * 12-column _Swiss Metrology_ Bento Grid showcasing EVERY real engine
 * capability beside its Stitch illustration, the interactive 3-model
 * showcase (1-click launch into `/geometry?template=…`), the 4-tier
 * pricing (Découverte / Pass Projet 48 h / Pro / Équipe) and the
 * engineering FAQ on ExpandablePanels. Designed to DESIGN.md: #F8FAFC
 * canvas, #FFFFFF panels, 1px #E2E8F0 hairlines, #1D4ED8 Deep Cobalt,
 * Inter + JetBrains Mono tabular-nums, zero dark classes.
 */

// Lazy single-context R3F hero (instant SVG skeleton = sub-200 ms LCP).
const HeroViewport3D = lazy(() =>
  import("@/components/HeroViewport3D").then((m) => ({ default: m.HeroViewport3D })),
);

/** Hero telemetry (illustrative, derived from the load slider): η crosses
 * 1.00 at ≈ 96 kN on the governing member and δ grows linearly with q. */
function heroEta(loadKN: number): number {
  return 0.31 + (loadKN - 20) * 0.0093;
}
function heroDeflectionMm(loadKN: number): number {
  return 1.8 + (loadKN - 20) * 0.078;
}

function buildShowcase() {
  return [
    {
      kind: "portique" as const,
      name: t`Portique 18 m`,
      description: t`Portique encastré-articulé en HEA 200, traversé IPE 300 — le cas d'école de la transmission M/N au nœud rigide.`,
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
          <text
            x="110"
            y="127"
            textAnchor="middle"
            fontSize="9"
            fill="#475569"
            className="font-data"
          >
            18,0 m
          </text>
        </svg>
      ),
    },
    {
      kind: "warren" as const,
      name: t`Treillis Warren 24 m`,
      description: t`Diagonales alternées sans montants : certains barreaux sont sans effort selon le chargement — articulez et comparez.`,
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
          <text
            x="110"
            y="124"
            textAnchor="middle"
            fontSize="9"
            fill="#475569"
            className="font-data"
          >
            24,0 m
          </text>
        </svg>
      ),
    },
    {
      kind: "travees" as const,
      name: t`Poutre 3 travées`,
      description: t`Poutre continue 3 × 4 m : moments négatifs sur appuis et redistribution — comparez 6.10 et 6.10a/b ici.`,
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
          <text
            x="110"
            y="128"
            textAnchor="middle"
            fontSize="9"
            fill="#475569"
            className="font-data"
          >
            3 × 4,0 m
          </text>
        </svg>
      ),
    },
  ] as const;
}

type BentoCard = {
  icon: React.ComponentType<{ size?: number }>;
  metric: string;
  metricLabel: string;
  title: string;
  body: string;
  formula?: string;
  /** Asymmetric 12-column span (lg) — static classes for Tailwind JIT. */
  spanClass: "md:col-span-4" | "md:col-span-5" | "md:col-span-7" | "md:col-span-8";
  illustration?: string;
  tags?: readonly string[];
};

function buildBento(): BentoCard[] {
  return [
    {
      icon: VolumetricMesh,
      metric: "< 20 ms",
      metricLabel: t`solveur par pas de temps`,
      title: t`Solveur Timoshenko 3D + P-Δ + flambement`,
      body: t`Poutres 3D 6 DDL en Rust/WASM (Cholesky creuse faer) : cisaillement Timoshenko, second ordre géométrique P-Δ et flambement linéaire global λcr — résolus localement dans votre navigateur.`,
      formula: "[Ke + Kg(N)]·u = F · λcr",
      spanClass: "md:col-span-7",
      illustration: "/illustrations/bento-solver-pdelta.png",
    },
    {
      icon: SectionCut,
      metric: "6.61 / 6.62 + C1",
      metricLabel: t`vérifications EC3`,
      title: t`EC3 complet + CalcTrace traçable`,
      body: t`Sections classes 1–4, χy / χz / χLT, Nb,Rd, Mc,Rd : chaque clause s'ouvre en formule KaTeX pas-à-pas, vérifiable par le contresignateur, avec empreinte SHA-256 du modèle.`,
      illustration: "/illustrations/bento-ec3-calctrace.png",
      spanClass: "md:col-span-5",
    },
    {
      icon: ConcreteBeamIcon,
      metric: "EC2 · EC5 · EC8 · EC9",
      metricLabel: t`multi-matériaux`,
      title: t`Acier, inox, alu, bois, béton, boulons, feu`,
      body: t`Un même modèle traverse les matériaux : profils EN 10365 / 10210 / 10056, S235–S460, inox 304L, alu 6061/6082-T6 (EN 1999), lamellé-collé GL24h (EN 1995), béton armé (EN 1992), assemblages boulonnés (EC3-1-8) et feu R30–R120 (EC3-1-2).`,
      illustration: "/illustrations/bento-multimaterial.png",
      tags: [
        t`Acier S235–S460`,
        t`Inox 304L`,
        t`Alu EN 1999`,
        t`Bois GL24h`,
        t`Béton EN 1992`,
        t`Feu R30–R120`,
      ],
      spanClass: "md:col-span-4",
    },
    {
      icon: DynamicAcceleration,
      metric: "(ax, ay, az) × g",
      metricLabel: t`actions navales & levage`,
      title: t`Naval, levage & dynamique`,
      body: t`Champs d'accélération 3D roulis / tangage / levage, analyse modale f₁..f₆, combinaisons CQC / SRSS (EN 1998-1) et charges mobiles EN 1991-2 LM1 — l'atelier couvre les structures qui bougent.`,
      illustration: "/illustrations/bento-naval-dynamic.png",
      tags: [t`Modal f₁..f₆`, t`CQC / SRSS`, t`EN 1991-2 LM1`],
      spanClass: "md:col-span-4",
    },
    {
      icon: MagneticSnap,
      metric: "⌘Z",
      metricLabel: t`optimiseur 1-clic`,
      title: t`CAO 3D interactive + optimiseur EC3`,
      body: t`Accrochage magnétique 10/50/100 mm, import DXF / STEP / IGES, sections personnalisées PRS / RHS / CHS et optimiseur Pareto EC3 en un clic — annulable instantanément.`,
      illustration: "/illustrations/bento-cad-optimizer.png",
      tags: [t`DXF / STEP / IGES`, t`PRS / RHS / CHS`, t`Pareto EC3`],
      spanClass: "md:col-span-4",
    },
    {
      icon: SteelJointIcon,
      metric: "A4 · .docx · IFC4",
      metricLabel: t`exports vectoriels`,
      title: t`Note de calcul vectorielle & BIM`,
      body: t`PDF A4 vectoriel Takumi (polices embarquées), .docx structuré, BIM IFC4 / SAF / OpenSees / glTF et maquette 3D HTML autonome — la note de calcul sort prête à signer.`,
      illustration: "/illustrations/bento-report-bim.png",
      spanClass: "md:col-span-8",
    },
    {
      icon: Lock,
      metric: "0 octet",
      metricLabel: t`zéro cloud`,
      title: t`Local-first, RGPD par conception`,
      body: t`Projets chiffrés dans IndexedDB, partage par URL compressée, service worker hors-ligne : aucune donnée d'ingénierie ne quitte votre poste.`,
      spanClass: "md:col-span-4",
    },
  ];
}

function buildFaq() {
  return [
    {
      q: t`RDM Studio fonctionne-t-il vraiment hors-ligne ?`,
      a: t`Oui. L'application est une PWA : le solveur Rust compilé en WASM, les catalogues de profilés et les polices d'impression sont mis en cache par le service worker. Une fois chargée, elle démarre et calcule sans aucune connexion — en bureau, en atelier comme sur site.`,
    },
    {
      q: t`Où sont stockés mes projets ?`,
      a: t`Dans IndexedDB, sur votre poste uniquement. Aucune base de données distante, aucun compte obligatoire. Le partage se fait par une URL contenant le modèle compressé (lz-string) revalidé par Valibot à la relecture, ou par fichier .rdm.`,
    },
    {
      q: t`Quelles normes sont couvertes ?`,
      a: t`EN 1990 (combinaisons), EN 1991 (actions), EN 1993-1-1 (acier, vérifications 6.61/6.62 + C1), EN 1992 / 1995 / 1998 / 1999 pour béton, bois, alu et mixte. Les 41 benchmarks analytiques intégrés vérifient le solveur à chaque mise à jour.`,
    },
    {
      q: t`La licence Pro expire-t-elle hors-ligne ?`,
      a: t`Non. La clé RDM-PRO- est vérifiée localement : une licence perpétuelle reste active sans connexion. L'édition Pro ajoute le branding du bureau d'études sur les notes de calcul, le multi-matériaux étendu et le BIM IFC4 / SAF.`,
    },
    {
      q: t`Puis-je importer mes plans DXF ou STEP ?`,
      a: t`Oui — glissez-déposez un .dxf, .step ou .igs dans l'atelier : la géométrie filaire devient nœuds et poutres, prête à être profilée et chargée. L'export .rdm est canonique et réimportable à l'identique.`,
    },
    {
      q: t`À quoi sert le Pass Projet 48 h ?`,
      a: t`C'est une journée de plein droit pour un besoin ponctuel : toutes les fonctions Pro (branding, multi-matériaux, BIM, exports) actives 48 h sur votre poste, sans abonnement ni compte. Idéal pour livrer une note de calcul signée ce week-end.`,
    },
  ] as const;
}

const HERO_MODELS: { value: HeroModel; label: string; template: string }[] = [
  { value: "portique", label: t`Portique 18 m`, template: "portique" },
  { value: "warren", label: t`Treillis Warren 24 m`, template: "warren" },
  { value: "travees", label: t`Poutre 3 travées`, template: "travees" },
];

/** 3D Hero: lazy R3F stage + SegmentedControl model switcher + live load
 * slider + rolling tabular readouts + 1-click studio launch. */
function HeroStage(): React.ReactElement {
  const [model, setModel] = useState<HeroModel>("portique");
  const [loadKN, setLoadKN] = useState(60);
  const reduced = useReducedMotion();
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
      {/* Model switcher (shared-layoutId spring pill, zero layout jump). */}
      <div className="flex items-center justify-between gap-2 border-b border-hairline bg-panel px-3 py-2">
        <SegmentedControl
          size="sm"
          options={options}
          label={t`Modèle du hero`}
          value={model}
          onValueChange={(next) => setModel(next as HeroModel)}
          className="min-w-0 max-w-full"
        />
        <span className="font-data hidden shrink-0 text-[10px] text-ink-muted xl:inline">
          {t`Scène temps réel · WebGL`}
        </span>
      </div>
      {/* The lazy 3D stage — instant SVG skeleton until the chunk lands. */}
      <div className="h-[280px] sm:h-[320px]">
        <Suspense fallback={<HeroFallbackSvg model={model} loadKN={loadKN} />}>
          <HeroViewport3D model={model} loadKN={loadKN} />
        </Suspense>
      </div>
      {/* Live HUD: load slider + rolling tabular readouts + launch CTA. */}
      <div className="space-y-3 border-t border-hairline bg-panel p-3">
        <div className="flex items-center gap-3">
          <span className="font-data shrink-0 text-[11px] text-ink-secondary">
            {t`Charge q`} · {loadKN} kN
          </span>
          <SliderDetents
            label={t`Charge répartie (kN)`}
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
            <dt className="text-ink-muted">{t`Masse`}</dt>
            <dd className="text-[15px] font-medium text-ink-primary">
              <NumberFlowValue value={massKg} format={{ maximumFractionDigits: 0 }} />
              <span className="text-[11px] text-ink-secondary"> kg</span>
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">{t`Taux EC3 η`}</dt>
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
            <dt className="text-ink-muted">{t`Flèche δ`}</dt>
            <dd className="text-[15px] font-medium text-ink-primary">
              <NumberFlowValue
                value={deflection}
                format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
              />
              <span className="text-[11px] text-ink-secondary"> mm</span>
            </dd>
          </div>
        </dl>
        <Link
          to="/geometry"
          search={{ template: template as "portique" }}
          data-testid="hero-launch"
          className={`flex items-center justify-center gap-1.5 rounded bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-colors ${reduced ? "" : "hover:bg-accent-strong"}`}
        >
          <Trans>Ouvrir dans l'atelier →</Trans>
        </Link>
      </div>
    </div>
  );
}

/** Reveal-on-scroll wrapper (transform/opacity only, viewport once). */
function Reveal({
  children,
  className,
  delay = 0,
  testId,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  testId?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) {
    return (
      <div className={className} data-testid={testId}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      data-testid={testId}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function LandingPage() {
  // v2.1.1: hash navigation arriving from /legal (or a cold `/` load with
  // #fonctionnalites / #tarifs) must land on the section — TanStack's
  // hashScrollIntoView covers in-app Link clicks; this effect covers the
  // mount-after-navigation case where the section mounts post-scroll.
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (pathname !== "/" || hash === "") {
      return;
    }
    const id = hash.replace(/^#/, "");
    const scroll = () => {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    };
    scroll();
    const raf = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(raf);
  }, [pathname, hash]);
  // Built at render time so every Lingui literal resolves in the active
  // locale (module-level t`` would freeze the source strings).
  const showcaseItems = buildShowcase();
  const bento = useMemo(() => buildBento(), []);
  const faq = useMemo(() => buildFaq(), []);
  const [activeShowcase, setActiveShowcase] = useState(0);
  const showcase = showcaseItems[activeShowcase] ?? showcaseItems[0];
  return (
    <div className="flex flex-col">
      {/* Hero — editorial left column + the interactive 3D stage. */}
      <section className="border-b border-hairline bg-panel">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1.05fr_0.95fr] md:items-start md:py-20">
          <div>
            <h1 className="text-balance text-[clamp(1.9rem,4.5vw,3rem)] font-semibold leading-[1.15] tracking-tight text-ink-primary">
              <Trans>Le calcul de structures 3D aux Eurocodes, entièrement sur votre poste.</Trans>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-6 text-ink-secondary">
              <Trans>
                RDM Studio réunit le solveur poutres 3D Timoshenko, la CAO interactive et les
                vérifications EN 1990 → 1999 dans un atelier local-first : vos projets restent dans
                votre navigateur, le solveur Rust tourne en WASM, aucun serveur ne voit vos données.
              </Trans>
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/geometry"
                data-testid="hero-cta"
                className="flex items-center gap-1.5 rounded bg-accent px-4 py-2 text-[14px] font-semibold text-white hover:bg-accent-strong"
              >
                <Trans>Ouvrir l'atelier 3D</Trans>
                <ArrowRight size={16} strokeWidth={1.5} aria-hidden />
              </Link>
              <Link
                to="/"
                hash="tarifs"
                hashScrollIntoView={true}
                className="rounded border border-hairline px-4 py-2 text-[14px] font-semibold text-ink-secondary hover:border-accent hover:text-accent"
              >
                <Trans>Voir les tarifs</Trans>
              </Link>
            </div>
            {/* Live technical badges — JetBrains Mono, hairline pills. */}
            <ul className="font-data mt-6 flex flex-wrap gap-2 text-[11px] text-ink-secondary">
              {[
                t`Rust + WASM · < 20 ms`,
                t`EN 1990 / 1991 / 1992 / 1993 / 1995 / 1998 / 1999`,
                t`100 % hors-ligne & zéro cloud`,
              ].map((badge) => (
                <li
                  key={badge}
                  className="rounded-[2px] border border-hairline bg-canvas px-2 py-1"
                >
                  {badge}
                </li>
              ))}
            </ul>
          </div>
          <HeroStage />
        </div>
      </section>

      {/* 4-metric technical proof strip. */}
      <section
        className="border-b border-hairline bg-panel-subtle/60"
        data-testid="proof-strip"
        aria-label={t`Preuves techniques`}
      >
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden sm:grid-cols-4 lg:grid-cols-4">
          {(
            [
              [t`41 / 41`, t`benchmarks analytiques`],
              [t`< 20 ms`, t`solveur Cholesky WASM`],
              [t`EN 1990 → 1999`, t`multi-matériaux`],
              [t`0 octet cloud`, t`100 % local-first`],
            ] as const
          ).map(([metric, label]) => (
            <div key={metric} className="flex flex-col gap-0.5 bg-panel px-4 py-4">
              <span className="font-data text-[15px] font-medium text-ink-primary">{metric}</span>
              <span className="text-[12px] text-ink-secondary">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive 3-model showcase. */}
      <section id="modeles" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-balance text-[24px] font-semibold leading-8 tracking-tight text-ink-primary">
          <Trans>Trois modèles, un atelier — lancez-les en un clic.</Trans>
        </h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-6 text-ink-secondary">
          <Trans>
            Chaque modèle d'ouverture est un vrai projet de bureau d'études : choisissez-le ici, il
            s'ouvre profilé, appuyé et prêt à calculer dans l'atelier.
          </Trans>
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-[260px_1fr]">
          {/* Model selector — flat hairline rows, no nested cards. */}
          <div
            className="flex flex-row gap-2 overflow-x-auto md:flex-col"
            role="tablist"
            aria-label={t`Modèles d'ouverture`}
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
                  <dt className="text-ink-muted">
                    <Trans>Masse</Trans>
                  </dt>
                  <dd className="text-ink-primary tabular-nums">{showcase.massKg} kg</dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-ink-muted">
                    <Trans>Profilés</Trans>
                  </dt>
                  <dd className="text-ink-primary tabular-nums">
                    <Trans>
                      {showcase.members} barreaux · {showcase.sections}
                    </Trans>
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-ink-muted">
                    <Trans>Norme</Trans>
                  </dt>
                  <dd className="text-ink-primary">{showcase.norm}</dd>
                </div>
              </dl>
              <p className="mt-3 text-[12px] leading-5 text-ink-secondary">
                {showcase.description}
              </p>
              <Link
                to="/geometry"
                search={{ template: showcase.kind }}
                data-testid={`launch-${showcase.kind}`}
                className="mt-4 flex items-center justify-center gap-1.5 rounded bg-accent px-3 py-2 text-[13px] font-semibold text-white hover:bg-accent-strong"
              >
                <Trans>Ouvrir dans l'atelier</Trans>
                <ArrowRight size={14} strokeWidth={1.5} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Asymmetric 12-column Swiss Metrology Bento Grid. */}
      <section id="fonctionnalites" className="border-y border-hairline bg-panel">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-balance text-[24px] font-semibold leading-8 tracking-tight text-ink-primary">
            <Trans>Un bureau d'études complet, du modèle à la note de calcul.</Trans>
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-12">
            {bento.map((cap, index) => {
              const Icon = cap.icon;
              return (
                <Reveal key={cap.title} className={cap.spanClass} delay={index * 0.05}>
                  <article
                    className="flex h-full flex-col rounded-[8px] border border-hairline bg-panel p-5"
                    data-testid={`bento-${index}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-accent-tint text-accent">
                        <Icon size={22} />
                      </span>
                      <span className="font-data text-right text-[12px] leading-4 text-ink-secondary">
                        <span className="block text-[13px] font-medium text-ink-primary">
                          {cap.metric}
                        </span>
                        {cap.metricLabel}
                      </span>
                    </div>
                    <h3 className="mt-4 text-[15px] font-semibold text-ink-primary">{cap.title}</h3>
                    <p className="mt-1.5 text-[13px] leading-5 text-ink-secondary">{cap.body}</p>
                    {cap.formula !== undefined ? (
                      <p className="font-data mt-2 rounded-[4px] border border-hairline bg-canvas px-2 py-1 text-[11px] text-accent">
                        {cap.formula}
                      </p>
                    ) : null}
                    {cap.tags !== undefined ? (
                      <ul className="mt-2 flex flex-wrap gap-1">
                        {cap.tags.map((tag) => (
                          <li
                            key={tag}
                            className="font-data rounded-[2px] border border-hairline bg-panel-subtle px-1.5 py-0.5 text-[10px] text-ink-secondary"
                          >
                            {tag}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {cap.illustration !== undefined ? (
                      <img
                        src={cap.illustration}
                        alt=""
                        loading="lazy"
                        className="mt-3 h-44 w-full border border-hairline rounded-[4px] bg-canvas object-contain p-2"
                      />
                    ) : null}
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing — 4 tiers with 1-click offline activation. */}
      <section id="tarifs" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-balance text-[24px] font-semibold leading-8 tracking-tight text-ink-primary">
          <Trans>Tarifs & éditions</Trans>
        </h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-6 text-ink-secondary">
          <Trans>
            L'édition Découverte est complète pour apprendre et calculer. Le Pass Projet 48 h
            débloque tout pour un livrable ponctuel, l'édition Pro ajoute le branding du bureau
            d'études et le multi-matériaux — activation hors-ligne, sans compte.
          </Trans>
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article
            className="rounded-[8px] border border-hairline bg-panel p-5"
            data-testid="pricing-free"
          >
            <h3 className="text-[15px] font-semibold text-ink-primary">
              <Trans>Découverte</Trans>
            </h3>
            <p className="font-data mt-1 text-[22px] font-medium text-ink-primary">0 €</p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              <Trans>pour toujours, sans compte</Trans>
            </p>
            <ul className="mt-4 space-y-1.5 text-[13px] text-ink-secondary">
              {[
                t`Atelier 3D complet en 5 étapes`,
                t`Solveur + EC3 + note A4`,
                t`Projets IndexedDB locaux`,
              ].map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
            <Link
              to="/geometry"
              className="mt-5 flex items-center justify-center rounded border border-accent px-3 py-2 text-[13px] font-semibold text-accent hover:bg-accent-tint"
            >
              <Trans>Ouvrir l'atelier 3D</Trans>
            </Link>
          </article>
          <article
            className="rounded-[8px] border border-hairline bg-panel p-5"
            data-testid="pricing-pass"
          >
            <h3 className="text-[15px] font-semibold text-ink-primary">
              <Trans>Pass Projet 48 h</Trans>
            </h3>
            <p className="font-data mt-1 text-[22px] font-medium text-ink-primary">
              19 €<span className="text-[13px] text-ink-muted"> HT</span>
            </p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              <Trans>48 h de plein droit, sans abonnement</Trans>
            </p>
            <ul className="mt-4 space-y-1.5 text-[13px] text-ink-secondary">
              {[
                t`Toutes les fonctions Pro pendant 48 h`,
                t`Idéal pour un livrable signé ce week-end`,
                t`Activation 1 clic, hors-ligne`,
              ].map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
            <button
              type="button"
              data-testid="pricing-pass-cta"
              onClick={() => window.dispatchEvent(new Event("rdm-open-license"))}
              className="mt-5 flex w-full items-center justify-center rounded border border-accent px-3 py-2 text-[13px] font-semibold text-accent hover:bg-accent-tint"
            >
              <Trans>Démarrer le pass 48 h</Trans>
            </button>
          </article>
          <article
            className="rounded-[8px] border border-accent bg-panel p-5"
            data-testid="pricing-pro"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-ink-primary">
                <Trans>Bureau d'Études Pro</Trans>
              </h3>
              <span className="font-data rounded-[2px] border border-accent bg-accent-tint px-1.5 py-0.5 text-[10px] text-accent">
                <Trans>Recommandé</Trans>
              </span>
            </div>
            <p className="font-data mt-1 text-[22px] font-medium text-ink-primary">
              49 €<span className="text-[13px] text-ink-muted"> HT/mois</span>
            </p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              <Trans>ou licence perpétuelle — hors-ligne</Trans>
            </p>
            <ul className="mt-4 space-y-1.5 text-[13px] text-ink-secondary">
              {[
                t`Firm branding sur les notes de calcul`,
                t`Multi-matériaux EC2 / EC5 / EC8 / EC9`,
                t`BIM IFC4 / SAF + support prioritaire`,
              ].map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
            <button
              type="button"
              data-testid="pricing-pro-cta"
              onClick={() => window.dispatchEvent(new Event("rdm-open-license"))}
              className="mt-5 flex w-full items-center justify-center rounded bg-accent px-3 py-2 text-[13px] font-semibold text-white hover:bg-accent-strong"
            >
              <Trans>Activer une démonstration Pro</Trans>
            </button>
          </article>
          <article
            className="rounded-[8px] border border-hairline bg-panel p-5"
            data-testid="pricing-team"
          >
            <h3 className="text-[15px] font-semibold text-ink-primary">
              <Trans>Équipe / Intranet</Trans>
            </h3>
            <p className="font-data mt-1 text-[22px] font-medium text-ink-primary">
              <Trans>Sur devis</Trans>
            </p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              <Trans>licences flottantes, déploiement interne</Trans>
            </p>
            <ul className="mt-4 space-y-1.5 text-[13px] text-ink-secondary">
              {[
                t`Volume de postes & gabarits partagés`,
                t`Charte graphique sur mesure`,
                t`Contrat de maintenance annuel`,
              ].map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
            <a
              href={docsHref("/")}
              target="_blank"
              rel="noreferrer"
              className="mt-5 flex items-center justify-center rounded border border-hairline px-3 py-2 text-[13px] font-semibold text-ink-secondary hover:border-accent hover:text-accent"
            >
              <Trans>Documentation d'évaluation ↗</Trans>
            </a>
          </article>
        </div>
      </section>

      {/* Engineering FAQ — ExpandablePanels (smooth height + opacity). */}
      <section className="border-t border-hairline bg-panel">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 className="text-balance text-[24px] font-semibold leading-8 tracking-tight text-ink-primary">
            <Trans>Questions d'ingénieurs</Trans>
          </h2>
          <div className="mt-6 divide-y divide-hairline border-t border-hairline">
            {faq.map((item) => (
              <ExpandablePanel
                key={item.q}
                title={<span className="text-[14px] font-medium text-ink-primary">{item.q}</span>}
              >
                <p className="text-[13px] leading-6 text-ink-secondary">{item.a}</p>
              </ExpandablePanel>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
