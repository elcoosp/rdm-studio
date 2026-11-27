import { Island } from "@oxide-fw/react";
import { Lock } from "lucide-react";
import { Trans } from "@lingui/react";
import { i18n } from "@lingui/core";
import { SPONSOR_URL, CONTACT_URL, studioHref } from "../../lib/env";
import { buildFaq } from "../../lib/content";
import { currentSiteLocale } from "../../i18n/i18n";
import { trackSiteEvent, trackBentoCardClicked, trackOpensourceCtaClicked } from "../../lib/productTelemetry";
import {
  ConcreteBeamIcon,
  DynamicAcceleration,
  MagneticSnap,
  SectionCut,
  SteelJointIcon,
  VolumetricMesh,
} from "../../components/icons";
import { MotionReveal } from "../../components/MotionReveal";
import {
  CopyButton,
  LikeBurst,
  StatusBadge,
  Tooltip,
  TooltipGroup,
} from "@rdm-studio/ui/interior";

/**
 * Landing page at `/` (v2.3.0) — the v2.1.2 flagship commercial layer
 * ported verbatim to the Oxide static adapter: the interactive Three.js 3D
 * Hero island, the 4-metric technical proof strip, the asymmetric
 * 12-column _Swiss Metrology_ Bento Grid showcasing EVERY real engine
 * capability beside its Stitch illustration, the interactive 15-model
 * showcase island, the 3 open-source cards (Édition Open Source / Soutenir
 * / Prestations B2B) and the engineering FAQ island. Designed to DESIGN.md:
 * #F8FAFC canvas, #FFFFFF panels, 1px #E2E8F0 hairlines, #1D4ED8 Deep
 * Cobalt, Inter + JetBrains Mono tabular-nums, zero dark classes.
 *
 * Cross-app wiring: every studio CTA resolves through `PUBLIC_APP_URL` and
 * every docs link through `PUBLIC_DOCS_URL` (lib/env.ts) — beta testers on
 * the three `.vercel.app` hosts jump seamlessly between Site, Docs and
 * Studio.
 *
 * i18n (v2.3.0): every string is a Lingui runtime call (`<Trans>` /
 * `i18n._`, explicit IDs) resolved at render time in the active locale.
 * `buildBento()` and the inline string arrays are evaluated inside the
 * component render (never at module scope — the locale is only known once
 * `RootLayout` activated it). The page-level `<meta>` export that used to
 * live here was dead code (the worker only evaluates `page.server.ts`
 * `meta`); the live meta is in `page.server.ts`.
 */

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
  /** Crisp architectural diagram slug for zero-empty-void cards. */
  diagram?: "local-first";
};

function buildBento(): BentoCard[] {
  return [
    {
      icon: VolumetricMesh,
      metric: "< 20 ms",
      metricLabel: i18n._({ id: "site.landing.bento.solver.metricLabel", message: "solveur par pas de temps" }),
      title: i18n._({ id: "site.landing.bento.solver.title", message: "Solveur Timoshenko 3D + P-Δ + flambement" }),
      body: i18n._({
        id: "site.landing.bento.solver.body",
        message:
          "Poutres 3D 6 DDL en Rust/WASM (Cholesky creuse faer) : cisaillement Timoshenko, second ordre géométrique P-Δ et flambement linéaire global λcr — résolus localement dans votre navigateur.",
      }),
      formula: "[Ke + Kg(N)]·u = F · λcr",
      spanClass: "md:col-span-7",
      illustration: "/illustrations/bento-solver-pdelta.png",
    },
    {
      icon: SectionCut,
      metric: "6.61 / 6.62 + C1",
      metricLabel: i18n._({ id: "site.landing.bento.ec3.metricLabel", message: "vérifications EC3" }),
      title: i18n._({ id: "site.landing.bento.ec3.title", message: "EC3 complet + CalcTrace traçable" }),
      body: i18n._({
        id: "site.landing.bento.ec3.body",
        message:
          "Sections classes 1–4, χy / χz / χLT, Nb,Rd, Mc,Rd : chaque clause s'ouvre en formule KaTeX pas-à-pas, vérifiable par le contresignateur, avec empreinte SHA-256 du modèle.",
      }),
      illustration: "/illustrations/bento-ec3-calctrace.png",
      spanClass: "md:col-span-5",
    },
    {
      icon: ConcreteBeamIcon,
      metric: "EC2 · EC5 · EC8 · EC9",
      metricLabel: i18n._({ id: "site.landing.bento.multimaterial.metricLabel", message: "multi-matériaux" }),
      title: i18n._({ id: "site.landing.bento.multimaterial.title", message: "Acier, inox, alu, bois, béton, boulons, feu" }),
      body: i18n._({
        id: "site.landing.bento.multimaterial.body",
        message:
          "Un même modèle traverse les matériaux : profils EN 10365 / 10210 / 10056, S235–S460, inox 304L, alu 6061/6082-T6 (EN 1999), lamellé-collé GL24h (EN 1995), béton armé (EN 1992), assemblages boulonnés (EC3-1-8) et feu R30–R120 (EC3-1-2).",
      }),
      illustration: "/illustrations/bento-multimaterial.png",
      tags: [
        i18n._({ id: "site.landing.bento.multimaterial.tag.steel", message: "Acier S235–S460" }),
        i18n._({ id: "site.landing.bento.multimaterial.tag.stainless", message: "Inox 304L" }),
        i18n._({ id: "site.landing.bento.multimaterial.tag.alu", message: "Alu EN 1999" }),
        i18n._({ id: "site.landing.bento.multimaterial.tag.timber", message: "Bois GL24h" }),
        i18n._({ id: "site.landing.bento.multimaterial.tag.concrete", message: "Béton EN 1992" }),
        i18n._({ id: "site.landing.bento.multimaterial.tag.fire", message: "Feu R30–R120" }),
      ],
      spanClass: "md:col-span-4",
    },
    {
      icon: DynamicAcceleration,
      metric: "(ax, ay, az) × g",
      metricLabel: i18n._({ id: "site.landing.bento.naval.metricLabel", message: "actions navales & levage" }),
      title: i18n._({ id: "site.landing.bento.naval.title", message: "Naval, levage & dynamique" }),
      body: i18n._({
        id: "site.landing.bento.naval.body",
        message:
          "Champs d'accélération 3D roulis / tangage / levage, analyse modale f₁..f₆, combinaisons CQC / SRSS (EN 1998-1) et charges mobiles EN 1991-2 LM1 — l'atelier couvre les structures qui bougent.",
      }),
      illustration: "/illustrations/bento-naval-dynamic.png",
      tags: [
        i18n._({ id: "site.landing.bento.naval.tag.modal", message: "Modal f₁..f₆" }),
        i18n._({ id: "site.landing.bento.naval.tag.cqc", message: "CQC / SRSS" }),
        i18n._({ id: "site.landing.bento.naval.tag.lm1", message: "EN 1991-2 LM1" }),
      ],
      spanClass: "md:col-span-4",
    },
    {
      icon: MagneticSnap,
      metric: "⌘Z",
      metricLabel: i18n._({ id: "site.landing.bento.cad.metricLabel", message: "optimiseur 1-clic" }),
      title: i18n._({ id: "site.landing.bento.cad.title", message: "CAO 3D interactive + optimiseur EC3" }),
      body: i18n._({
        id: "site.landing.bento.cad.body",
        message:
          "Accrochage magnétique 10/50/100 mm, import DXF / STEP / IGES, sections personnalisées PRS / RHS / CHS et optimiseur Pareto EC3 en un clic — annulable instantanément.",
      }),
      illustration: "/illustrations/bento-cad-optimizer.png",
      tags: [
        i18n._({ id: "site.landing.bento.cad.tag.import", message: "DXF / STEP / IGES" }),
        i18n._({ id: "site.landing.bento.cad.tag.sections", message: "PRS / RHS / CHS" }),
        i18n._({ id: "site.landing.bento.cad.tag.pareto", message: "Pareto EC3" }),
      ],
      spanClass: "md:col-span-4",
    },
    {
      icon: SteelJointIcon,
      metric: "A4 · .docx · IFC4",
      metricLabel: i18n._({ id: "site.landing.bento.report.metricLabel", message: "exports vectoriels" }),
      title: i18n._({ id: "site.landing.bento.report.title", message: "Note de calcul vectorielle & BIM" }),
      body: i18n._({
        id: "site.landing.bento.report.body",
        message:
          "PDF A4 vectoriel Takumi (polices embarquées), .docx structuré, BIM IFC4 / SAF / OpenSees / glTF et maquette 3D HTML autonome — la note de calcul sort prête à signer.",
      }),
      illustration: "/illustrations/bento-report-bim.png",
      spanClass: "md:col-span-8",
    },
    {
      icon: Lock,
      metric: i18n._({ id: "site.landing.bento.localFirst.metric", message: "0 octet" }),
      metricLabel: i18n._({ id: "site.landing.bento.localFirst.metricLabel", message: "zéro cloud" }),
      title: i18n._({ id: "site.landing.bento.localFirst.title", message: "Local-first, RGPD par conception" }),
      body: i18n._({
        id: "site.landing.bento.localFirst.body",
        message:
          "Projets chiffrés dans IndexedDB, partage par URL compressée, service worker hors-ligne : aucune donnée d'ingénierie ne quitte votre poste.",
      }),
      spanClass: "md:col-span-4",
      diagram: "local-first",
    },
  ];
}

export default function LandingPage(): React.ReactElement {
  const bento = buildBento();
  const faq = buildFaq();
  const locale = currentSiteLocale();
  const home = locale === "en" ? "/en" : "/";
  const PROOF_METRICS: [string, string][] = [
    ["41 / 41", i18n._({ id: "site.landing.proof.benchmarks", message: "benchmarks analytiques" })],
    ["< 20 ms", i18n._({ id: "site.landing.proof.solver", message: "solveur Cholesky WASM" })],
    ["EN 1990 → 1999", i18n._({ id: "site.landing.proof.standards", message: "multi-matériaux" })],
    [
      i18n._({ id: "site.landing.proof.cloud", message: "0 octet cloud" }),
      i18n._({ id: "site.landing.proof.local", message: "100 % local-first" }),
    ],
  ];
  return (
    <div className="flex flex-col">
      {/* Hero — editorial left column + the interactive 3D stage island. */}
      <section
        className="border-b border-hairline bg-panel bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px]"
      >
        <MotionReveal
          className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1.05fr_0.95fr] md:items-start md:py-20"
        >
          <div>
            <span className="inline-flex items-center rounded-[2px] border border-hairline bg-canvas px-2 py-0.5 text-[10px] font-semibold text-accent">
              <Trans id="site.landing.hero.badge" message="100 % OPEN SOURCE · GRATUIT & HORS-LIGNE" />
            </span>
            <h1 className="text-balance text-[clamp(1.9rem,4.5vw,3rem)] font-semibold leading-[1.15] tracking-tight text-ink-primary">
              <Trans
                id="site.landing.hero.h1"
                message="Le calcul de structures 3D aux Eurocodes, entièrement sur votre poste."
              />
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-6 text-ink-secondary">
              <Trans
                id="site.landing.hero.intro"
                message="RDM Studio réunit le solveur poutres 3D Timoshenko, la CAO interactive et les vérifications EN 1990 → 1999 dans un atelier local-first : vos projets restent dans votre navigateur, le solveur Rust tourne en WASM, aucun serveur ne voit vos données."
              />
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href={studioHref("/geometry")}
                data-testid="hero-cta"
                className="flex items-center gap-1.5 rounded-[4px] bg-accent px-4 py-2 text-[14px] font-semibold text-white hover:bg-accent-strong"
                onClick={() => void trackSiteEvent("seo_page_cta_clicked", { template: "hero" })}
              >
                <Trans id="site.landing.hero.cta" message="Ouvrir l'atelier 3D →" />
              </a>
              <a
                href={`${home}#modeles`}
                className="rounded-[4px] border border-hairline px-4 py-2 text-[14px] font-semibold text-ink-secondary hover:border-accent hover:text-accent"
              >
                <Trans id="site.landing.hero.explore" message="Explorer les 15 modèles" />
              </a>
            </div>
            {/* Live technical badges — JetBrains Mono, hairline pills. */}
            <TooltipGroup openDelay={300} skipDelay={400} className="font-data mt-6 flex flex-wrap gap-2">
              {[
                [
                  i18n._({ id: "site.landing.hero.badge.solver", message: "Rust + WASM · < 20 ms" }),
                  i18n._({
                    id: "site.landing.hero.badge.solver.tip",
                    message:
                      "Solveur Timoshenko 3D compilé en WASM, résolution Cholesky creuse < 20 ms par pas de temps, exécutée localement.",
                  }),
                ],
                [
                  i18n._({
                    id: "site.landing.hero.badge.eurocodes",
                    message: "EN 1990 / 1991 / 1992 / 1993 / 1995 / 1998 / 1999",
                  }),
                  i18n._({
                    id: "site.landing.hero.badge.eurocodes.tip",
                    message:
                      "Tous les Eurocodes structurels : actions, acier, béton, bois, aluminium, seismic et feu.",
                  }),
                ],
                [
                  i18n._({ id: "site.landing.hero.badge.offline", message: "100 % hors-ligne & zéro cloud" }),
                  i18n._({
                    id: "site.landing.hero.badge.offline.tip",
                    message:
                      "Projets chiffrés dans IndexedDB, solveur Rust/WASM dans votre navigateur, aucune donnée ne quitte votre poste.",
                  }),
                ],
              ].map(([badge, tip]) => (
                <li key={badge} className="rounded-[2px] border border-hairline bg-canvas px-2 py-1">
                  <Tooltip label={tip} side="top">
                    <span className="text-[11px] text-ink-secondary">{badge}</span>
                  </Tooltip>
                </li>
              ))}
            </TooltipGroup>
          </div>
          {/* Client-only hero island: the prerender emits the architectural
              SVG skeleton; WebGL swaps in after hydration. */}
          <Island component="Hero3D" chunk="Hero3D" strategy="visible" />
        </MotionReveal>
      </section>

      {/* 4-metric technical proof strip. */}
      <section
        className="border-b border-hairline bg-panel-subtle/60"
        data-testid="proof-strip"
        aria-label={i18n._({ id: "site.landing.proof.aria", message: "Preuves techniques" })}
      >
        <MotionReveal>
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden sm:grid-cols-4 lg:grid-cols-4">
            {PROOF_METRICS.map(([metric, label]) => (
              <div key={metric} className="flex flex-col gap-0.5 bg-panel px-4 py-4">
                <span className="font-data text-[15px] font-medium text-ink-primary">{metric}</span>
                <span className="text-[12px] text-ink-secondary">{label}</span>
              </div>
            ))}
          </div>
        </MotionReveal>
      </section>

      {/* Interactive 14-model showcase island. */}
      <section id="modeles" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <MotionReveal>
          <h2 className="text-balance text-[24px] font-semibold leading-8 tracking-tight text-ink-primary">
            <Trans id="site.landing.showcase.h2" message="Tous les modèles métiers — lancez-les en un clic." />
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-ink-secondary">
            <Trans
              id="site.landing.showcase.intro"
              message="Choisissez un secteur, puis un modèle : il s’ouvre profilé, appuyé et prêt à calculer dans l’atelier via le slug canonique (ex. `?template=naval-cradle`)."
            />
          </p>
          <div className="mt-6">
            <Island component="ShowcaseTabs" chunk="ShowcaseTabs" strategy="visible" />
          </div>
        </MotionReveal>
      </section>

      {/* Asymmetric 12-column Swiss Metrology Bento Grid. */}
      <section id="fonctionnalites" className="scroll-mt-20 border-y border-hairline bg-panel">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <MotionReveal>
            <h2 className="text-balance text-[24px] font-semibold leading-8 tracking-tight text-ink-primary">
              <Trans
                id="site.landing.bento.h2"
                message="Un bureau d’études complet, du modèle à la note de calcul."
              />
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-12">
              {bento.map((cap, index) => {
                const Icon = cap.icon;
                return (
                  <MotionReveal key={cap.title} className={cap.spanClass}>
                    <article
                      className="flex h-full flex-col rounded-[8px] border border-hairline bg-panel p-5"
                      data-testid={`bento-${index}`}
                      onClick={() => void trackBentoCardClicked(cap.title)}
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
                      <div className="mt-2 flex items-center gap-2">
                        <span className="font-data rounded-[4px] border border-hairline bg-canvas px-2 py-1 text-[11px] text-accent">
                          {cap.formula}
                        </span>
                        <CopyButton
                          value={cap.formula}
                          label={i18n._({ id: "site.landing.bento.copyFormula", message: "Copier la formule" })}
                          copiedLabel={i18n._({ id: "site.landing.bento.copied", message: "Copié" })}
                          testId={`copy-formula-${index}`}
                          className="rounded-[4px] shrink-0"
                        />
                      </div>
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
                    {cap.diagram === "local-first" ? (
                      <div className="mt-3 h-44 w-full border border-hairline rounded-[4px] bg-canvas p-2 flex items-center justify-center overflow-hidden">
                        <svg
                          width="100%"
                          height="100%"
                          viewBox="0 0 100 60"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="text-ink-secondary"
                        >
                          {/* Cobalt shield */}
                          <path
                            d="M20 8 L40 4 L60 8 L60 42 Q60 52 40 56 Q20 52 20 42 L20 8 Z"
                            stroke="#1D4ED8"
                            strokeWidth="2.5"
                            fill="#1D4ED8/10"
                            strokeLinejoin="round"
                          />
                          {/* Shield inner accent */}
                          <path
                            d="M30 20 L40 14 L50 20 L40 26 L30 20 Z"
                            stroke="#1D4ED8"
                            strokeWidth="2"
                            fill="none"
                            strokeLinejoin="round"
                          />
                          {/* Browser window (IndexedDB) */}
                          <rect x="6" y="36" width="16" height="12" rx="1.5" stroke="#E2E8F0" strokeWidth="1.5" fill="#FFFFFF" />
                          <rect x="8" y="36" width="12" height="3" rx="0.5" fill="#E2E8F0" />
                          <rect x="10" y="41" width="8" height="2" rx="0.5" fill="#E2E8F0" />
                          <rect x="10" y="44" width="6" height="2" rx="0.5" fill="#1D4ED8" />
                          {/* WASM Worker */}
                          <rect x="74" y="36" width="16" height="12" rx="1.5" stroke="#E2E8F0" strokeWidth="1.5" fill="#FFFFFF" />
                          <rect x="76" y="36" width="12" height="3" rx="0.5" fill="#E2E8F0" />
                          <rect x="78" y="41" width="8" height="2" rx="0.5" fill="#E2E8F0" />
                          <rect x="78" y="44" width="6" height="2" rx="0.5" fill="#1D4ED8" />
                          {/* Data flow arrows */}
                          <path d="M23 42 L29 42" stroke="#1D4ED8" strokeWidth="1.5" strokeLinecap="round" />
                          <path d="M32 42 L35 39 L32 36" stroke="#1D4ED8" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                          <path d="M66 42 L71 42" stroke="#1D4ED8" strokeWidth="1.5" strokeLinecap="round" />
                          <path d="M74 42 L77 39 L74 36" stroke="#1D4ED8" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                          {/* Blocked cloud (0 octet) — prohibition mark above a
                              single readable label; nothing overlaps the
                              WASM worker box below. */}
                          <circle cx="85" cy="15" r="8" stroke="#E2E8F0" strokeWidth="2" fill="none" />
                          <path d="M79 21 L91 9" stroke="#F2303F" strokeWidth="2" strokeLinecap="round" />
                          <text x="85" y="32" textAnchor="middle" fontSize="7" fontFamily="monospace" fill="#475569" fontWeight="600">{i18n._({ id: "site.landing.bento.localFirst.diagram", message: "0 octet" })}</text>
                        </svg>
                      </div>
                    ) : null}
                  </article>
                </MotionReveal>
              );
            })}
          </div>
        </MotionReveal>
      </div>
      </section>

      {/* Open-Source Ecosystem — 100 % gratuit + sponsoring & B2B intranet. */}
      <section id="open-source" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <span id="tarifs" />
        <MotionReveal>
          <h2 className="text-balance text-[24px] font-semibold leading-8 tracking-tight text-ink-primary">
            <Trans id="site.landing.opensource.h2" message="Open Source — 0 €, pour toujours" />
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-ink-secondary">
            <Trans
              id="site.landing.opensource.intro"
              message="L’édition Open Source est complète, gratuite à vie et illimitée : aucun compte, aucun bridage, zéro cloud. Le projet est financé par le sponsoring des bureaux d’études et par les prestations B2B / intranet fermé sur demande."
            />
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-3">
            <article className="flex flex-col justify-between h-full rounded-[8px] border border-hairline bg-panel p-5" data-testid="opensource-edition">
              <h3 className="text-[15px] font-semibold text-ink-primary">
                <Trans id="site.landing.opensource.edition.title" message="Édition Open Source" />
              </h3>
              <p className="font-data mt-1 text-[22px] font-medium text-ink-primary">
                <Trans id="site.landing.opensource.edition.price" message="0 €" />
              </p>
              <p className="mt-0.5 text-[12px] text-ink-muted">
                <Trans id="site.landing.opensource.edition.subtitle" message="Gratuit à vie · Illimité" />
              </p>
              <ul className="mt-4 flex-1 space-y-1.5 text-[13px] text-ink-secondary">
                {[
                  i18n._({ id: "site.landing.opensource.edition.bullet.1", message: "100 % du solveur 3D Timoshenko (EC3, P-Δ, flambement)" }),
                  i18n._({ id: "site.landing.opensource.edition.bullet.2", message: "Tous les Eurocodes (EN 1990 → 1999)" }),
                  i18n._({ id: "site.landing.opensource.edition.bullet.3", message: "Les 15 modèles métiers (naval, levage, charpente, bois, mixte)" }),
                  i18n._({ id: "site.landing.opensource.edition.bullet.4", message: "Tous les exports (PDF A4, .docx, IFC4, SAF, CSV, .rdm)" }),
                  i18n._({ id: "site.landing.opensource.edition.bullet.5", message: "Zéro compte, zéro bridage, zéro cloud" }),
                ].map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
                <a
                  href={studioHref("/geometry")}
                  data-testid="opensource-cta"
                  className="mt-2 flex items-center justify-center gap-1.5 rounded-[4px] bg-accent px-3 py-2 text-[13px] font-semibold text-white hover:bg-accent-strong"
                  onClick={() => void trackOpensourceCtaClicked()}
                >
                <Trans id="site.landing.opensource.edition.cta" message="Ouvrir l'atelier 3D →" />
              </a>
            </article>
            <article className="flex flex-col justify-between h-full rounded-[8px] border border-hairline bg-panel p-5" data-testid="opensource-sponsor">
              <h3 className="text-[15px] font-semibold text-ink-primary">
                <Trans id="site.landing.opensource.sponsor.title" message="Soutenir le Projet" />
              </h3>
              <p className="mt-0.5 text-[12px] text-ink-muted">
                <Trans id="site.landing.opensource.sponsor.subtitle" message="Sponsoring & mécénat BET" />
              </p>
              <ul className="mt-4 flex-1 space-y-1.5 text-[13px] text-ink-secondary">
                {[
                  i18n._({ id: "site.landing.opensource.sponsor.bullet.1", message: "Pour les bureaux d’études et indépendants utilisateurs quotidiens" }),
                  i18n._({ id: "site.landing.opensource.sponsor.bullet.2", message: "Financer le développement ouvert de RDM Studio" }),
                  i18n._({ id: "site.landing.opensource.sponsor.bullet.3", message: "Visibilité mécène sur le dépôt et la documentation" }),
                ].map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-col gap-2">
                <LikeBurst
                  initialLiked={false}
                  initialCount={128}
                  label={i18n._({ id: "site.landing.opensource.sponsor.like", message: "Soutenir" })}
                  activeLabel={i18n._({ id: "site.landing.opensource.sponsor.likeActive", message: "Recommandé" })}
                  testId="opensource-like-burst"
                  className="w-full"
                  buttonClassName="flex-1 justify-center"
                />
                <a
                  href={SPONSOR_URL}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="opensource-sponsor-cta"
                  className="flex w-full items-center justify-center gap-1.5 rounded-[4px] border border-hairline px-3 py-2 text-[13px] font-semibold text-ink-secondary hover:border-accent hover:text-accent"
                >
                  <Trans id="site.landing.opensource.sponsor.cta" message="Soutenir sur GitHub ↗" />
                </a>
              </div>
            </article>
            <article className="flex flex-col justify-between h-full rounded-[8px] border border-hairline bg-panel p-5" data-testid="opensource-b2b">
              <h3 className="text-[15px] font-semibold text-ink-primary">
                <Trans id="site.landing.opensource.b2b.title" message="Prestations B2B & Intranet" />
              </h3>
              <p className="mt-0.5 text-[12px] text-ink-muted">
                <Trans id="site.landing.opensource.b2b.subtitle" message="Sur demande — déploiement fermé" />
              </p>
              <ul className="mt-4 flex-1 space-y-1.5 text-[13px] text-ink-secondary">
                {[
                  i18n._({ id: "site.landing.opensource.b2b.bullet.1", message: "Déploiement sur réseau interne fermé sans internet (DSI / chantiers)" }),
                  i18n._({ id: "site.landing.opensource.b2b.bullet.2", message: "Gabarits et vérifications métiers sur mesure (EN 13155, DNV-ST-N001)" }),
                  i18n._({ id: "site.landing.opensource.b2b.bullet.3", message: "Support ingénieur dédié et contrat de maintenance" }),
                ].map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
              <a
                href={CONTACT_URL}
                target="_blank"
                rel="noreferrer"
                data-testid="opensource-b2b-cta"
                className="mt-auto flex items-center justify-center gap-1.5 rounded-[4px] border border-hairline px-3 py-2 text-[13px] font-semibold text-ink-secondary hover:border-accent hover:text-accent"
              >
                <Trans id="site.landing.opensource.b2b.cta" message="Demander un déploiement ↗" />
              </a>
            </article>
          </div>
        </MotionReveal>
      </section>

      {/* Engineering FAQ island — smooth ExpandablePanels. */}
      <section className="border-t border-hairline bg-panel">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <MotionReveal>
            <h2 className="text-balance text-[24px] font-semibold leading-8 tracking-tight text-ink-primary">
              <Trans id="site.landing.faq.h2" message="Questions d'ingénieurs" />
            </h2>
            <div className="mt-6">
              <Island component="FaqAccordion" chunk="FaqAccordion" strategy="visible" props={{ faq }} />
            </div>
          </MotionReveal>
        </div>
      </section>
    </div>
  );
}
