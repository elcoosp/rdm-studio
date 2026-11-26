import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  ArrowRight,
  Cpu,
  FileCheck2,
  HardDriveDownload,
  Lock,
  Ruler,
  Workflow,
} from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/_marketing/")({
  staticData: { surface: "marketing" },
  component: LandingPage,
});

/**
 * Landing page at `/` (v2.1.0 commercial layer, _Swiss Metrology_ world):
 * editorial engineering hero with live technical badges, the interactive
 * 3-model showcase (1-click launch into `/geometry?template=…`), the
 * 6-card capabilities grid, the 3-tier pricing with 1-click offline
 * activation and the engineering FAQ. Designed with the impeccable skill
 * + DESIGN.md: #F8FAFC canvas, #FFFFFF panels, 1px #E2E8F0 hairlines,
 * #1D4ED8 Deep Cobalt accent, Inter + JetBrains Mono tabular-nums, zero
 * drop shadows on docked cards, zero dark-mode classes.
 *
 * Telemetry (Masse kg / Profilés) is precomputed from the exact
 * `quickStartProject` seeds and the EN 10365 catalog areas of this
 * repository (A × 7 850 kg/m³) — no invented figures.
 */

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

function buildCapabilities() {
  return [
    {
      icon: Cpu,
      metric: "< 20 ms",
      metricLabel: t`solveur par pas de temps`,
      title: t`Solveur Timoshenko 3D`,
      body: t`Poutres 3D 6 DDL en Rust/WASM : cisaillement Timoshenko, P-Δ second ordre, analyse modale et flambement linéaire — résolu localement dans votre navigateur.`,
    },
    {
      icon: FileCheck2,
      metric: "6.61 / 6.62 + C1",
      metricLabel: t`vérifications EC3`,
      title: t`EC3 complet + CalcTrace`,
      body: t`Sections classes 1–4, χy/χz/χLT, Nb,Rd, Mc,Rd et formules KaTeX traçables : chaque étape de calcul est documentée pour le vérificateur.`,
    },
    {
      icon: Ruler,
      metric: "EC2 · EC5 · EC8 · EC9",
      metricLabel: t`multi-matériaux`,
      title: t`Béton, bois, alu, mixte`,
      body: t`Profilés EN 10365 / 10210 / 10056 et matériaux EN 1992 / 1995 / 1998 / 1999 : kmod, kdef et catégories de service intégrés au même modèle.`,
    },
    {
      icon: Workflow,
      metric: "5 étapes",
      metricLabel: t`flux CAD verrouillé`,
      title: t`CAO 3D interactive + optimiseur`,
      body: t`Accrochage magnétique 10/50/100 mm, subdivisions, extrusion, optimiseur EC3 1-clic avec retour arrière ⌘Z — la géométrie reste la source de vérité.`,
    },
    {
      icon: HardDriveDownload,
      metric: "A4 · .docx · IFC4",
      metricLabel: t`exports vectoriels`,
      body: t`Note de calcul A4 PDF vectorielle (polices embarquées), .docx structuré et BIM IFC4 / SAF — plus l'export HTML 3D autonome.`,
      title: t`PDF vectoriel, .docx & BIM`,
    },
    {
      icon: Lock,
      metric: "0 serveur",
      metricLabel: t`zéro télémétrie`,
      title: t`Local-first, RGPD par conception`,
      body: t`Projets chiffrés dans IndexedDB, partage par URL compressée, service worker hors-ligne : aucune donnée d'ingénierie ne quitte votre poste.`,
    },
  ] as const;
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
  ] as const;
}

function HeroArt() {
  // Geometry SVG only (crisp vector linework — never an illustration):
  // a front-elevation portal frame whose girder carries a distributed
  // load line with red point arrows landing cleanly ON the top flange,
  // a subtle My bending-moment envelope under the girder and clean
  // fixed (encastrement) / pinned (articulation) support symbols.
  const loadXs = [110, 148, 186, 224, 262, 300];
  return (
    <svg
      viewBox="0 0 420 260"
      className="h-full w-full"
      role="img"
      aria-label={t`Schéma structurel d'un portique chargé`}
    >
      <g stroke="#E2E8F0" strokeWidth="1">
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={`v${i}`} x1={40 + i * 85} y1="30" x2={40 + i * 85} y2="230" />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <line key={`h${i}`} x1="30" y1={50 + i * 60} x2="390" y2={50 + i * 60} />
        ))}
      </g>
      {/* Subtle My bending-moment envelope under the girder (analytical
          overlay — cobalt linework, light fill, no interface palette). */}
      <path
        d="M110 86 C 152 126, 258 126, 300 86 L300 88 C 256 134, 154 134, 110 88 Z"
        fill="#1D4ED8"
        opacity="0.08"
      />
      <path
        d="M110 86 C 152 126, 258 126, 300 86"
        fill="none"
        stroke="#1D4ED8"
        strokeWidth="1.2"
        strokeDasharray="4 3"
        opacity="0.55"
      />
      <text x="152" y="146" fontSize="10" fill="#1D4ED8" className="font-data" opacity="0.8">
        My
      </text>
      {/* Portal frame: two columns + the girder (top flange line). */}
      <g stroke="#1D4ED8" strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M110 210 V80 H300 V210" />
      </g>
      {/* Distributed load line with the 6 red arrows landing on the
          top flange (arrowheads touch y = 78, flange crown at 80). */}
      <g stroke="#DC2626" strokeWidth="1.5" fill="none">
        <line x1="106" y1="54" x2="304" y2="54" />
        {loadXs.map((x) => (
          <g key={x}>
            <line x1={x} y1="54" x2={x} y2="76" />
            <path d={`M${x - 4} 70 L${x} 78 L${x + 4} 70`} strokeLinejoin="round" />
          </g>
        ))}
        <text x="316" y="50" fontSize="10" fill="#DC2626" stroke="none" className="font-data">
          q
        </text>
      </g>
      {/* Point load Fz at midspan, landing on the top flange too. */}
      <g stroke="#DC2626" strokeWidth="1.5" fill="none">
        <path d="M205 30 V44 M201 38 L205 44 L209 38" strokeLinejoin="round" />
      </g>
      <text x="219" y="40" fontSize="10" fill="#DC2626" className="font-data">
        Fz
      </text>
      {/* Joint nodes (haunches + bases). */}
      <g fill="#0F172A">
        <circle cx="110" cy="80" r="4" />
        <circle cx="300" cy="80" r="4" />
        <circle cx="110" cy="210" r="3.5" />
        <circle cx="300" cy="210" r="3.5" />
      </g>
      {/* Left support: encastrément (base plate + ground hatching). */}
      <g>
        <rect x="94" y="212" width="32" height="4" rx="1" fill="#1D4ED8" />
        <g stroke="#94A3B8" strokeWidth="1">
          <line x1="86" y1="222" x2="134" y2="222" />
          {[88, 96, 104, 112, 120, 128].map((x) => (
            <line key={x} x1={x} y1="222" x2={x - 5} y2="228" />
          ))}
        </g>
      </g>
      {/* Right support: articulation (pin triangle + ground hatching). */}
      <g>
        <path d="M292 220 L308 220 L300 212 Z" fill="#1D4ED8" />
        <circle cx="300" cy="212" r="1.8" fill="#F8FAFC" />
        <g stroke="#94A3B8" strokeWidth="1">
          <line x1="286" y1="222" x2="314" y2="222" />
          {[288, 296, 304, 312].map((x) => (
            <line key={x} x1={x} y1="222" x2={x - 5} y2="228" />
          ))}
        </g>
      </g>
      <text x="110" y="244" textAnchor="middle" fontSize="10" fill="#94A3B8" className="font-data">
        18,0 m
      </text>
    </svg>
  );
}

function LandingPage() {
  const [activeShowcase, setActiveShowcase] = useState(0);
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
  const capabilities = buildCapabilities();
  const faq = buildFaq();
  const showcase = showcaseItems[activeShowcase] ?? showcaseItems[0];
  return (
    <div className="flex flex-col">
      {/* Hero — editorial left column + geometric linework. */}
      <section className="border-b border-hairline bg-panel">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-20">
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
                className="flex items-center gap-1.5 rounded bg-accent px-4 py-2 text-[14px] font-semibold text-white hover:bg-accent-hover"
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
          <div className="min-h-[240px] rounded-[8px] border border-hairline bg-canvas p-4">
            <HeroArt />
          </div>
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
            {showcaseItems.map((model, index) => (
              <button
                key={model.kind}
                role="tab"
                aria-selected={index === activeShowcase}
                data-testid={`showcase-${model.kind}`}
                onClick={() => setActiveShowcase(index)}
                className={`min-w-[190px] rounded-[4px] border px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
                  index === activeShowcase
                    ? "border-accent bg-accent-tint text-accent"
                    : "border-hairline bg-panel text-ink-secondary hover:border-border-strong hover:text-ink-primary"
                }`}
              >
                {model.name}
              </button>
            ))}
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
                className="mt-4 flex items-center justify-center gap-1.5 rounded bg-accent px-3 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover"
              >
                <Trans>Ouvrir dans l'atelier</Trans>
                <ArrowRight size={14} strokeWidth={1.5} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities grid — 6 hairline cells, JetBrains Mono metrics. */}
      <section id="fonctionnalites" className="border-y border-hairline bg-panel">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-balance text-[24px] font-semibold leading-8 tracking-tight text-ink-primary">
            <Trans>Un bureau d'études complet, du modèle à la note de calcul.</Trans>
          </h2>
          <div className="mt-8 grid gap-px overflow-hidden rounded-[8px] border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((cap) => (
              <article key={cap.title} className="bg-panel p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-accent-tint text-accent">
                    <cap.icon size={18} strokeWidth={1.5} aria-hidden />
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
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing — 3 tiers with 1-click offline activation. */}
      <section id="tarifs" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-balance text-[24px] font-semibold leading-8 tracking-tight text-ink-primary">
          <Trans>Tarifs & éditions</Trans>
        </h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-6 text-ink-secondary">
          <Trans>
            L'édition Découverte est complète pour apprendre et calculer. L'édition Pro ajoute le
            branding du bureau d'études et le multi-matériaux — activation hors-ligne, sans compte.
          </Trans>
        </p>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
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
              49 €<span className="text-[13px] text-ink-muted"> /mois</span>
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
              className="mt-5 flex w-full items-center justify-center rounded bg-accent px-3 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover"
            >
              <Trans>Activer une démonstration Pro</Trans>
            </button>
          </article>
          <article
            className="rounded-[8px] border border-hairline bg-panel p-5"
            data-testid="pricing-team"
          >
            <h3 className="text-[15px] font-semibold text-ink-primary">
              <Trans>Équipe / Entreprise</Trans>
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
              href="/docs/"
              target="_blank"
              rel="noreferrer"
              className="mt-5 flex items-center justify-center rounded border border-hairline px-3 py-2 text-[13px] font-semibold text-ink-secondary hover:border-accent hover:text-accent"
            >
              <Trans>Documentation d'évaluation ↗</Trans>
            </a>
          </article>
        </div>
      </section>

      {/* Engineering FAQ. */}
      <section className="border-t border-hairline bg-panel">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 className="text-balance text-[24px] font-semibold leading-8 tracking-tight text-ink-primary">
            <Trans>Questions d'ingénieurs</Trans>
          </h2>
          <Accordion className="mt-6">
            {faq.map((item, index) => (
              <AccordionItem
                key={item.q}
                value={`faq-${index}`}
                className="border-b border-hairline"
              >
                <AccordionTrigger className="py-3 text-left text-[14px] font-medium text-ink-primary">
                  {item.q}
                </AccordionTrigger>
                <AccordionPanel className="pb-4 text-[13px] leading-6 text-ink-secondary">
                  {item.a}
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </div>
  );
}
