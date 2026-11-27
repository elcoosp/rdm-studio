/**
 * `/legal` — server module (the LIVE meta channel; see `index/page.server.ts`).
 */
import { defineLoad, defineMeta } from "@oxide-fw/core/shared";
import { buildHeadTags } from "../../lib/meta";

export const load = defineLoad(() => ({}));

export const meta = defineMeta(() =>
  buildHeadTags({
    title: "Informations légales & confidentialité — RDM Studio",
    description:
      "Mentions légales (LCEN), CGU/CGV, politique de confidentialité RGPD (100 % local — aucune donnée envoyée sur un serveur) et clause de responsabilité technique de l'ingénieur.",
    canonicalPath: "/legal",
    ogType: "article",
    ogTitle: "Informations légales & confidentialité — RDM Studio",
    ogDescription:
      "LCEN, CGU/CGV, RGPD 100 % local et clause de responsabilité de l'ingénieur — le cadre juridique de l'atelier de calcul local-first.",
    locale: "fr",
    pairedFrPath: "/legal",
    pairedEnPath: "/en/legal",
  }),
);
