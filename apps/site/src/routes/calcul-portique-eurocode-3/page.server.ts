/**
 * `/calcul-portique-eurocode-3` — server module (the LIVE meta channel; see
 * `index/page.server.ts`). FAQ array duplicated verbatim from `page.tsx`
 * (visible FAQ is the source of truth); de-duplicate later by exporting
 * `FAQ` from `page.tsx` (follow-up, Phase 2).
 */
import { defineLoad, defineMeta } from "@oxide-fw/core/shared";
import { SITE_URL } from "../../lib/env";
import { buildHeadTags } from "../../lib/meta";

const FAQ = [
  {
    q: "Quand l'interaction 6.61 ou 6.62 s'applique-t-elle ?",
    a: "L'équation 6.61 (NEd/MEd, profilés laminés, torsion négligeable) couvre le déversement pour sections bi-symétriques en flexion simple axe, la 6.62 la flexion bi-axiale. On choisit la plus défavorable des deux ; RDM Studio calcule les deux taux et retient le maximum, avec le détail kyy/kyz et les facteurs d'équivalence Cmy,C0 traçables dans le CalcTrace.",
  },
  {
    q: "Comment le P-Δ est-il pris en compte dans un portique ?",
    a: "Par le coefficient αcr = Fcr/FEd (EN 1993-1-1 §5.2.1) : si αcr ≥ 10 (portiques contreventés) l'analyse du 1er ordre suffit ; entre 3 et 10, l'EN 1990 §5.1.4 (H) ou une analyse du 2nd ordre s'impose. Le solveur RDM Studio calcule λcr (flambement linéaire global) et l'option P-Δ ajoute la raideur géométrique [Kg(N)] au système [Ke + Kg(N)]·u = F.",
  },
  {
    q: "Quelle courbe de flambement pour un HEA laminé ?",
    a: "Pour le flambement d'axe fort (y-y) d'un laminé en S235 avec h/b ≤ 1,2 (cas du HEA 200 : 190/200), l'annexe tabulaire du §6.3.1.2 donne la courbe b (αimp = 0,34) pour t ≤ 100 mm ; l'axe faible (z-z) prend la courbe c. RDM Studio sélectionne la courbe automatiquement selon h/b, tf et l'acier.",
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
    name: "RDM Studio — calcul de portique Eurocode 3",
    applicationCategory: "EngineeringApplication",
    operatingSystem: "Web (PWA, local-first)",
    url: `${SITE_URL}/calcul-portique-eurocode-3`,
    softwareVersion: "2.2.0",
    description:
      "Vérification d'un poteau de portique HEA 200 en flexion-compression : flambement χy, interaction EN 1993-1-1 6.61/6.62, sensibilité P-Δ αcr — calcul local-first.",
  };
  return buildHeadTags({
    title: "Calcul de portique Eurocode 3 (flambement, interaction 6.61, P-Δ) — RDM Studio",
    description:
      "Poteau HEA 200 en flexion-compression selon EN 1993-1-1 : Ncr, λ̄y, χy, Nb,Rd, interaction 6.61 et sensibilité P-Δ αcr — exemple chiffré complet à recalculer dans l'atelier.",
    canonicalPath: "/calcul-portique-eurocode-3",
    ogType: "article",
    ogTitle: "Calcul de portique Eurocode 3 — flambement et interaction 6.61",
    ogDescription:
      "La vérification complète d'un poteau HEA 200 en flexion-compression : χy, Nb,Rd, équation 6.61, P-Δ — avec exemple chiffré.",
    locale: "fr",
    pairedFrPath: "/calcul-portique-eurocode-3",
    pairedEnPath: "/en/portal-frame-eurocode-3",
    jsonLd: [faqLd, appLd],
  });
});
