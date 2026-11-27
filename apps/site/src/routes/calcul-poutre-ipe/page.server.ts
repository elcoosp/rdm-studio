/**
 * `/calcul-poutre-ipe` — server module (the LIVE meta channel; see
 * `index/page.server.ts`).
 *
 * NOTE (meta-shape probe, 2026-11-27): the `description`, `canonical` and
 * `openGraph` top-level keys below carry TEST values on purpose. The
 * framework's neutral head model is `HeadTags` (`meta[]` / `link[]`), but
 * the site's old `page.tsx` meta used the `{title, description, canonical,
 * openGraph, jsonLd}` shape — this file returns the UNION so the first
 * build reveals which shape the `LoaderOutput.meta → PageRenderInput.head`
 * merge actually consumes (real description/canonical vs `TEST-*`).
 * Remove the three test keys once the probe has answered, and keep only the
 * `HeadTags` fields.
 *
 * The FAQ array is duplicated verbatim from `page.tsx` (the visible FAQ is
 * the source of truth); de-duplicate later by exporting `FAQ` from
 * `page.tsx` (follow-up, Phase 2).
 */
import { defineLoad, defineMeta } from "@oxide-fw/core/shared";
import { SITE_URL } from "../../lib/env";
import { buildHeadTags } from "../../lib/meta";

const FAQ = [
  {
    q: "Quelle différence entre Wel,y et Wpl,y pour une poutre IPE ?",
    a: "Wel,y (module élastique) pilote la contrainte élastique σ = M/Wel, utilisée pour les classes 3 et 4 ou la vérification ELS. Wpl,y (module plastique) pilote Mc,Rd = Wpl,y·fy/γM0 pour les sections de classe 1 ou 2 — c'est le cas des IPE laminés en flexion forte axe : la fibre tendue peut plastifier, le moment résistant est d'environ 13 à 15 % supérieur.",
  },
  {
    q: "Comment vérifier la flèche d'une poutre IPE selon l'Eurocode 3 ?",
    a: "L'EN 1993-1-1 ne fixe pas de limite numérique : le tableau 7.2 de l'EN 1993-1-1 renvoie à l'Annexe nationale. En pratique courante en France, on retient w ≤ L/250 (éléments standard) à L/500 (éléments fragiles, matériaux de couverture sensibles) sous combinaison caractéristique ELS. RDM Studio affiche ces deux limites avec le rapport w/L calculé.",
  },
  {
    q: "Le voilement de l'âme doit-il être vérifié pour un IPE ?",
    a: "Pour un IPE laminé soumis à la flexion simple, les âmes restent dans le domaine non-voilé (limites de classe respectées pour fy ≤ 460 MPa) sauf charges localisées très élevées ou cisaillement dominant : la vérification VEd/Vpl,Rd et la ripage de l'âme (§6.2.7) restent néanmoins calculées par l'atelier.",
  },
  {
    q: "La poutre IPE doit-elle être vérifiée au déversement ?",
    a: "Oui dès que la compression n'est pas bridée latéralement : la vérification §6.3.2 avec χLT s'applique (LTB). Sur la poutre d'exemple, un pontage ou un béton de dallage connecté empêche le déversement ; sans bridage, RDM Studio calcule automatiquement Mcr, λ̄LT et χLT avec la méthode 1 ou 2 au choix.",
  },
];

export const load = defineLoad(() => ({}));

export const meta = defineMeta(() => {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  const appLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "RDM Studio — calcul de poutre IPE Eurocode 3",
    applicationCategory: "EngineeringApplication",
    operatingSystem: "Web (PWA, local-first)",
    url: `${SITE_URL}/calcul-poutre-ipe`,
    softwareVersion: "2.2.0",
    description:
      "Vérification complète d'une poutre IPE selon EN 1993-1-1 : Mc,Rd, Vpl,Rd, flèche ELS, déversement χLT — exemple chiffré et calcul local-first.",
  };
  return buildHeadTags({
    title: "Calcul de poutre IPE Eurocode 3 (Mc,Rd, Vpl,Rd, flèche) — RDM Studio",
    description:
      "Méthode EN 1993-1-1 pour une poutre IPE : résistance plastique Mc,Rd = Wpl,y·fy/γM0, cisaillement Vpl,Rd, flèche L/500, exemple chiffré IPE 300 S235 de 6 m — vérifiez-le gratuitement dans l'atelier local-first.",
    canonicalPath: "/calcul-poutre-ipe",
    ogType: "article",
    ogTitle: "Calcul de poutre IPE Eurocode 3 — méthode et exemple chiffré",
    ogDescription:
      "Flexion Mc,Rd, cisaillement Vpl,Rd, flèche ELS : la vérification complète d'un IPE 300 S235 de 6 m pas à pas selon EN 1993-1-1.",
    locale: "fr",
    pairedFrPath: "/calcul-poutre-ipe",
    pairedEnPath: "/en/ipe-beam-calculator",
    jsonLd: [faqLd, appLd],
  });
});
