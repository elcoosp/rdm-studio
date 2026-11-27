/**
 * `/calcul-poutre-bois-eurocode-5` — server module (the LIVE meta channel;
 * see `index/page.server.ts`). FAQ array duplicated verbatim from
 * `page.tsx` (visible FAQ is the source of truth); de-duplicate later by
 * exporting `FAQ` from `page.tsx` (follow-up, Phase 2).
 */
import { defineLoad, defineMeta } from "@oxide-fw/core/shared";
import { SITE_URL } from "../../lib/env";
import { buildHeadTags } from "../../lib/meta";

const FAQ = [
  {
    q: "À quoi servent kmod et γM dans l'Eurocode 5 ?",
    a: "kmod (EN 1995-1-1 §3.1.3, tableau 3.1) réduit la résistance selon la classe de service (humidité) et la durée de charge : 0,8 pour du GL24h en classe 1 à charge moyenne-terme. γM (tableau 2.3) vaut 1,3 pour le bois lamellé-collé. La résistance de calcul devient fm,d = kmod·fm,k/γM = 0,8 × 24 / 1,3 = 14,8 MPa — deux poutres identiques en classe 1 ou classe 3 n'ont pas la même résistance.",
  },
  {
    q: "Quelles limites de flèche pour une poutre en bois ?",
    a: "L'EN 1995-1-1 tableau 7.2 recommande (valeurs indicatives de l'Annexe Nationale) : winst ≤ L/300 à L/500, et wnet,fin ≤ L/150 à L/250 selon la sensibilité des finitions. La flèche finale ufin intègre le fluage via kdef (0,8 pour le GL en classe 1) appliqué aux parts quasi-permanentes des charges.",
  },
  {
    q: "Comment le solveur vérifie-t-il le bois ?",
    a: "Le solveur calcule les efforts internes (N, V, M) indépendamment du matériau ; la vérification applique ensuite les formules EN 1995-1-1 (6.11 σm,d ≤ fm,d, 6.13 τd ≤ fv.d) avec les propriétés du GL24h/GL28h/GL32h intégrées au catalogue. Le même modèle peut mélanger barreaux acier (EC3), poutres bois (EC5) et poteaux béton (EC2).",
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
    name: "RDM Studio — calcul de poutre bois Eurocode 5",
    applicationCategory: "EngineeringApplication",
    operatingSystem: "Web (PWA, local-first)",
    url: `${SITE_URL}/calcul-poutre-bois-eurocode-5`,
    softwareVersion: "2.2.0",
    description:
      "Vérification d'une poutre lamellé-collé GL24h selon EN 1995-1-1 : fm,d avec kmod/γM, cisaillement fv,d, flèches winst/ufin avec kdef — calcul local-first multi-matériaux.",
  };
  return buildHeadTags({
    title: "Calcul de poutre bois Eurocode 5 (GL24h, kmod, flèche) — RDM Studio",
    description:
      "Méthode EN 1995-1-1 pour une poutre lamellé-collé : fm,d = kmod·fm,k/γM, cisaillement, flèche instantanée et finale avec fluage kdef — exemple chiffré 160×320 mm de 6 m.",
    canonicalPath: "/calcul-poutre-bois-eurocode-5",
    ogType: "article",
    ogTitle: "Calcul de poutre bois Eurocode 5 — GL24h, kmod et flèches",
    ogDescription:
      "La vérification complète d'une poutre GL24h 160×320 : fm,d, fv,d, winst ≤ L/300 et fluage kdef — avec exemple chiffré.",
    locale: "fr",
    pairedFrPath: "/calcul-poutre-bois-eurocode-5",
    pairedEnPath: "/en/timber-beam-eurocode-5",
    jsonLd: [faqLd, appLd],
  });
});
