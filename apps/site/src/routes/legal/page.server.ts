import { defineMeta } from "@oxide-fw/core/server";
import { SITE_URL } from "../../lib/env";

export const meta = defineMeta(() => {
  return {
    title: "Informations légales & confidentialité — RDM Studio",
    description:
      "Mentions légales (LCEN), CGU/CGV, politique de confidentialité RGPD (100 % local — aucune donnée envoyée sur un serveur) et clause de responsabilité technique de l'ingénieur.",
    canonical: `${SITE_URL}/legal`,
    openGraph: {
      title: "Informations légales & confidentialité — RDM Studio",
      description:
        "LCEN, CGU/CGV, RGPD 100 % local et clause de responsabilité de l'ingénieur — le cadre juridique de l'atelier de calcul local-first.",
      url: `${SITE_URL}/legal`,
      type: "article",
      siteName: "RDM Studio",
      locale: "fr_FR",
    },
  };
});
