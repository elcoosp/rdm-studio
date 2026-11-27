/**
 * `/calcul-berceau-levage-naval` — server module (the LIVE meta channel; see
 * `index/page.server.ts`). FAQ array duplicated verbatim from `page.tsx`
 * (visible FAQ is the source of truth); de-duplicate later by exporting
 * `FAQ` from `page.tsx` (follow-up, Phase 2).
 */
import { defineLoad, defineMeta } from "@oxide-fw/core/shared";
import { SITE_URL } from "../../lib/env";
import { buildHeadTags } from "../../lib/meta";

const FAQ = [
  {
    q: "Quelles accélérations retenir pour un transport naval ou un levage ?",
    a: "Pour le levage, l'EN 13001 ou les coefficients d'amplification dynamique du manutentionnaire (φ = 1,2 à 1,4 selon la grue et le marnage) majorent g selon l'axe vertical. Pour le transport maritime, les règles de transport (DNV-ST-N001, Cargo Resistance) donnent (ax, ay, az) en fraction de g selon la zone de mer. RDM Studio modélise ces champs comme des accélérations volumiques (ax, ay, az) × g appliquées à toute la structure, puis génère les combinaisons EN 1990 associées.",
  },
  {
    q: "Comment combiner les accélérations entre elles ?",
    a: "Chaque accélération devient une action variable : la combinaison fondamentale type devient G + az·g + ψ0,1·ay·g (+ ψ0,2·ax·g), avec les ψ0 issus des règles de transport ou fixés par l'ingénieur. L'atelier les traite comme des cas de charge classiques : 6.10, 6.10a/b avec groupes d'actions, y compris l'inversion de signe (deux gisements par accélération).",
  },
  {
    q: "S355 ou aluminium 6082-T6 pour un berceau de levage ?",
    a: "L'acier S355 offre une limite élastique de 355 MPa et une bonne résilience à froid (J2/K2) ; l'alu 6082-T6 (EN 1999-1-1, fo = 250 MPa, fu = 290 MPa) s'impose quand la masse embarquée prime (pont, structure soudable TIG/MIG). RDM Studio vérifie les deux dans le même modèle : EN 1993-1-1 pour l'acier, EN 1999-1-1 (sections classes, soudabilité, facteurs ω) pour l'aluminium.",
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
    name: "RDM Studio — calcul de berceau de levage naval",
    applicationCategory: "EngineeringApplication",
    operatingSystem: "Web (PWA, local-first)",
    url: `${SITE_URL}/calcul-berceau-levage-naval`,
    softwareVersion: "2.2.0",
    description:
      "Dimensionnement d'un berceau de levage/transport naval sous champs d'accélération (ax, ay, az) × g : EN 1990, S355 et aluminium 6082-T6 (EN 1999), calcul local-first.",
  };
  return buildHeadTags({
    title: "Calcul de berceau de levage naval ((ax, ay, az) × g, S355) — RDM Studio",
    description:
      "Méthode EN 1990/EN 1993 pour un berceau de transport naval : transformation des accélérations (ax, ay, az) × g en ELU, vérification des transverses IPE 200 S355 — exemple 12 t à az = 1,3 g.",
    canonicalPath: "/calcul-berceau-levage-naval",
    ogType: "article",
    ogTitle: "Calcul de berceau de levage naval — accélérations et S355",
    ogDescription:
      "De (ax, ay, az) × g aux combinaisons ELU, vérification des transverses de berceau en S355 ou alu 6082-T6 — exemple chiffré 12 t.",
    locale: "fr",
    pairedFrPath: "/calcul-berceau-levage-naval",
    pairedEnPath: "/en/naval-lifting-cradle",
    jsonLd: [faqLd, appLd],
  });
});
