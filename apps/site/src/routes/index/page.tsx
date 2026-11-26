import { Island } from "@oxide-fw/react";
import { Lock } from "lucide-react";
import {
  ConcreteBeamIcon,
  DynamicAcceleration,
  MagneticSnap,
  SectionCut,
  SteelJointIcon,
  VolumetricMesh,
} from "../../components/icons";
import { studioHref, docsHref } from "../../lib/env";
import { buildFaq } from "../../lib/content";

/**
 * Landing page at `/` (v2.2.0) — the v2.1.2 flagship commercial layer
 * ported verbatim to the Oxide static adapter: the interactive Three.js 3D
 * Hero island, the 4-metric technical proof strip, the asymmetric
 * 12-column _Swiss Metrology_ Bento Grid showcasing EVERY real engine
 * capability beside its Stitch illustration, the interactive 3-model
 * showcase island, the 4-tier pricing (Découverte / Pass Projet 48 h / Pro
 * / Équipe) and the engineering FAQ island. Designed to DESIGN.md: #F8FAFC
 * canvas, #FFFFFF panels, 1px #E2E8F0 hairlines, #1D4ED8 Deep Cobalt,
 * Inter + JetBrains Mono tabular-nums, zero dark classes.
 *
 * Cross-app wiring: every studio CTA resolves through `PUBLIC_APP_URL` and
 * every docs link through `PUBLIC_DOCS_URL` (lib/env.ts) — beta testers on
 * the three `.vercel.app` hosts jump seamlessly between Site, Docs and
 * Studio. The pricing "activation" CTAs deep-link into the studio app
 * (`?license=pass|pro`), where the LicenseModal opens from the query param.
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
};

function buildBento(): BentoCard[] {
  return [
    {
      icon: VolumetricMesh,
      metric: "< 20 ms",
      metricLabel: "solveur par pas de temps",
      title: "Solveur Timoshenko 3D + P-Δ + flambement",
      body: "Poutres 3D 6 DDL en Rust/WASM (Cholesky creuse faer) : cisaillement Timoshenko, second ordre géométrique P-Δ et flambement linéaire global λcr — résolus localement dans votre navigateur.",
      formula: "[Ke + Kg(N)]·u = F · λcr",
      spanClass: "md:col-span-7",
      illustration: "/illustrations/bento-solver-pdelta.png",
    },
    {
      icon: SectionCut,
      metric: "6.61 / 6.62 + C1",
      metricLabel: "vérifications EC3",
      title: "EC3 complet + CalcTrace traçable",
      body: "Sections classes 1–4, χy / χz / χLT, Nb,Rd, Mc,Rd : chaque clause s'ouvre en formule KaTeX pas-à-pas, vérifiable par le contresignateur, avec empreinte SHA-256 du modèle.",
      illustration: "/illustrations/bento-ec3-calctrace.png",
      spanClass: "md:col-span-5",
    },
    {
      icon: ConcreteBeamIcon,
      metric: "EC2 · EC5 · EC8 · EC9",
      metricLabel: "multi-matériaux",
      title: "Acier, inox, alu, bois, béton, boulons, feu",
      body: "Un même modèle traverse les matériaux : profils EN 10365 / 10210 / 10056, S235–S460, inox 304L, alu 6061/6082-T6 (EN 1999), lamellé-collé GL24h (EN 1995), béton armé (EN 1992), assemblages boulonnés (EC3-1-8) et feu R30–R120 (EC3-1-2).",
      illustration: "/illustrations/bento-multimaterial.png",
      tags: [
        "Acier S235–S460",
        "Inox 304L",
        "Alu EN 1999",
        "Bois GL24h",
        "Béton EN 1992",
        "Feu R30–R120",
      ],
      spanClass: "md:col-span-4",
    },
    {
      icon: DynamicAcceleration,
      metric: "(ax, ay, az) × g",
      metricLabel: "actions navales & levage",
      title: "Naval, levage & dynamique",
      body: "Champs d'accélération 3D roulis / tangage / levage, analyse modale f₁..f₆, combinaisons CQC / SRSS (EN 1998-1) et charges mobiles EN 1991-2 LM1 — l'atelier couvre les structures qui bougent.",
      illustration: "/illustrations/bento-naval-dynamic.png",
      tags: ["Modal f₁..f₆", "CQC / SRSS", "EN 1991-2 LM1"],
      spanClass: "md:col-span-4",
    },
    {
      icon: MagneticSnap,
      metric: "⌘Z",
      metricLabel: "optimiseur 1-clic",
      title: "CAO 3D interactive + optimiseur EC3",
      body: "Accrochage magnétique 10/50/100 mm, import DXF / STEP / IGES, sections personnalisées PRS / RHS / CHS et optimiseur Pareto EC3 en un clic — annulable instantanément.",
      illustration: "/illustrations/bento-cad-optimizer.png",
      tags: ["DXF / STEP / IGES", "PRS / RHS / CHS", "Pareto EC3"],
      spanClass: "md:col-span-4",
    },
    {
      icon: SteelJointIcon,
      metric: "A4 · .docx · IFC4",
      metricLabel: "exports vectoriels",
      title: "Note de calcul vectorielle & BIM",
      body: "PDF A4 vectoriel Takumi (polices embarquées), .docx structuré, BIM IFC4 / SAF / OpenSees / glTF et maquette 3D HTML autonome — la note de calcul sort prête à signer.",
      illustration: "/illustrations/bento-report-bim.png",
      spanClass: "md:col-span-8",
    },
    {
      icon: Lock,
      metric: "0 octet",
      metricLabel: "zéro cloud",
      title: "Local-first, RGPD par conception",
      body: "Projets chiffrés dans IndexedDB, partage par URL compressée, service worker hors-ligne : aucune donnée d'ingénierie ne quitte votre poste.",
      spanClass: "md:col-span-4",
    },
  ];
}

export default function LandingPage(): React.ReactElement {
  const bento = buildBento();
  const faq = buildFaq();
  return (
    <div className="flex flex-col">
      {/* Hero — editorial left column + the interactive 3D stage island. */}
      <section className="border-b border-hairline bg-panel">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1.05fr_0.95fr] md:items-start md:py-20">
          <div>
            <h1 className="text-balance text-[clamp(1.9rem,4.5vw,3rem)] font-semibold leading-[1.15] tracking-tight text-ink-primary">
              Le calcul de structures 3D aux Eurocodes, entièrement sur votre poste.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-6 text-ink-secondary">
              RDM Studio réunit le solveur poutres 3D Timoshenko, la CAO interactive et les
              vérifications EN 1990 → 1999 dans un atelier local-first : vos projets restent dans
              votre navigateur, le solveur Rust tourne en WASM, aucun serveur ne voit vos données.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href={studioHref("/geometry")}
                data-testid="hero-cta"
                className="flex items-center gap-1.5 rounded bg-accent px-4 py-2 text-[14px] font-semibold text-white hover:bg-accent-strong"
              >
                Ouvrir l'atelier 3D
              </a>
              <a
                href="/#tarifs"
                className="rounded border border-hairline px-4 py-2 text-[14px] font-semibold text-ink-secondary hover:border-accent hover:text-accent"
              >
                Voir les tarifs
              </a>
            </div>
            {/* Live technical badges — JetBrains Mono, hairline pills. */}
            <ul className="font-data mt-6 flex flex-wrap gap-2 text-[11px] text-ink-secondary">
              {[
                "Rust + WASM · < 20 ms",
                "EN 1990 / 1991 / 1992 / 1993 / 1995 / 1998 / 1999",
                "100 % hors-ligne & zéro cloud",
              ].map((badge) => (
                <li key={badge} className="rounded-[2px] border border-hairline bg-canvas px-2 py-1">
                  {badge}
                </li>
              ))}
            </ul>
          </div>
          {/* Client-only hero island: the prerender emits the architectural
              SVG skeleton; WebGL swaps in after hydration. */}
          <Island component="Hero3D" chunk="Hero3D" strategy="visible" />
        </div>
      </section>

      {/* 4-metric technical proof strip. */}
      <section
        className="border-b border-hairline bg-panel-subtle/60"
        data-testid="proof-strip"
        aria-label="Preuves techniques"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden sm:grid-cols-4 lg:grid-cols-4">
          {(
            [
              ["41 / 41", "benchmarks analytiques"],
              ["< 20 ms", "solveur Cholesky WASM"],
              ["EN 1990 → 1999", "multi-matériaux"],
              ["0 octet cloud", "100 % local-first"],
            ] as const
          ).map(([metric, label]) => (
            <div key={metric} className="flex flex-col gap-0.5 bg-panel px-4 py-4">
              <span className="font-data text-[15px] font-medium text-ink-primary">{metric}</span>
              <span className="text-[12px] text-ink-secondary">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive 3-model showcase island. */}
      <section id="modeles" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-balance text-[24px] font-semibold leading-8 tracking-tight text-ink-primary">
          Trois modèles, un atelier — lancez-les en un clic.
        </h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-6 text-ink-secondary">
          Chaque modèle d'ouverture est un vrai projet de bureau d'études : choisissez-le ici, il
          s'ouvre profilé, appuyé et prêt à calculer dans l'atelier.
        </p>
        <div className="mt-6">
          <Island component="ShowcaseTabs" chunk="ShowcaseTabs" strategy="visible" />
        </div>
      </section>

      {/* Asymmetric 12-column Swiss Metrology Bento Grid. */}
      <section id="fonctionnalites" className="border-y border-hairline bg-panel">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-balance text-[24px] font-semibold leading-8 tracking-tight text-ink-primary">
            Un bureau d'études complet, du modèle à la note de calcul.
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-12">
            {bento.map((cap, index) => {
              const Icon = cap.icon;
              return (
                // Static prerender: cards render visible server-side (the
                // scroll-reveal motion remains in the studio app surface).
                <div key={cap.title} className={cap.spanClass}>
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
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing — 4 tiers, activation CTAs deep-link into the studio app. */}
      <section id="tarifs" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-balance text-[24px] font-semibold leading-8 tracking-tight text-ink-primary">
          Tarifs & éditions
        </h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-6 text-ink-secondary">
          L'édition Découverte est complète pour apprendre et calculer. Le Pass Projet 48 h
          débloque tout pour un livrable ponctuel, l'édition Pro ajoute le branding du bureau
          d'études et le multi-matériaux — activation hors-ligne, sans compte.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article
            className="rounded-[8px] border border-hairline bg-panel p-5"
            data-testid="pricing-free"
          >
            <h3 className="text-[15px] font-semibold text-ink-primary">Découverte</h3>
            <p className="font-data mt-1 text-[22px] font-medium text-ink-primary">0 €</p>
            <p className="mt-0.5 text-[12px] text-ink-muted">pour toujours, sans compte</p>
            <ul className="mt-4 space-y-1.5 text-[13px] text-ink-secondary">
              {[
                "Atelier 3D complet en 5 étapes",
                "Solveur + EC3 + note A4",
                "Projets IndexedDB locaux",
              ].map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
            <a
              href={studioHref("/geometry")}
              className="mt-5 flex items-center justify-center rounded border border-accent px-3 py-2 text-[13px] font-semibold text-accent hover:bg-accent-tint"
            >
              Ouvrir l'atelier 3D
            </a>
          </article>
          <article
            className="rounded-[8px] border border-hairline bg-panel p-5"
            data-testid="pricing-pass"
          >
            <h3 className="text-[15px] font-semibold text-ink-primary">Pass Projet 48 h</h3>
            <p className="font-data mt-1 text-[22px] font-medium text-ink-primary">
              19 €<span className="text-[13px] text-ink-muted"> HT</span>
            </p>
            <p className="mt-0.5 text-[12px] text-ink-muted">48 h de plein droit, sans abonnement</p>
            <ul className="mt-4 space-y-1.5 text-[13px] text-ink-secondary">
              {[
                "Toutes les fonctions Pro pendant 48 h",
                "Idéal pour un livrable signé ce week-end",
                "Activation 1 clic, hors-ligne",
              ].map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
            <a
              href={studioHref("/geometry?license=pass")}
              data-testid="pricing-pass-cta"
              className="mt-5 flex items-center justify-center rounded border border-accent px-3 py-2 text-[13px] font-semibold text-accent hover:bg-accent-tint"
            >
              Démarrer le pass 48 h
            </a>
          </article>
          <article
            className="rounded-[8px] border border-accent bg-panel p-5"
            data-testid="pricing-pro"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-ink-primary">Bureau d'Études Pro</h3>
              <span className="font-data rounded-[2px] border border-accent bg-accent-tint px-1.5 py-0.5 text-[10px] text-accent">
                Recommandé
              </span>
            </div>
            <p className="font-data mt-1 text-[22px] font-medium text-ink-primary">
              49 €<span className="text-[13px] text-ink-muted"> HT/mois</span>
            </p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              ou licence perpétuelle — hors-ligne
            </p>
            <ul className="mt-4 space-y-1.5 text-[13px] text-ink-secondary">
              {[
                "Firm branding sur les notes de calcul",
                "Multi-matériaux EC2 / EC5 / EC8 / EC9",
                "BIM IFC4 / SAF + support prioritaire",
              ].map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
            <a
              href={studioHref("/geometry?license=pro")}
              data-testid="pricing-pro-cta"
              className="mt-5 flex items-center justify-center rounded bg-accent px-3 py-2 text-[13px] font-semibold text-white hover:bg-accent-strong"
            >
              Activer une démonstration Pro
            </a>
          </article>
          <article
            className="rounded-[8px] border border-hairline bg-panel p-5"
            data-testid="pricing-team"
          >
            <h3 className="text-[15px] font-semibold text-ink-primary">Équipe / Intranet</h3>
            <p className="font-data mt-1 text-[22px] font-medium text-ink-primary">Sur devis</p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              licences flottantes, déploiement interne
            </p>
            <ul className="mt-4 space-y-1.5 text-[13px] text-ink-secondary">
              {[
                "Volume de postes & gabarits partagés",
                "Charte graphique sur mesure",
                "Contrat de maintenance annuel",
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
              Documentation d'évaluation ↗
            </a>
          </article>
        </div>
      </section>

      {/* Engineering FAQ island — smooth ExpandablePanels. */}
      <section className="border-t border-hairline bg-panel">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 className="text-balance text-[24px] font-semibold leading-8 tracking-tight text-ink-primary">
            Questions d'ingénieurs
          </h2>
          <div className="mt-6">
            <Island component="FaqAccordion" chunk="FaqAccordion" strategy="visible" props={{ faq }} />
          </div>
        </div>
      </section>
    </div>
  );
}
