import { defineMeta } from "@oxide-fw/core/server";
import { SITE_URL } from "../../lib/env";
import { buildFaq } from "../../lib/content";

/**
 * `/` head model: SoftwareApplication + FAQPage JSON-LD (Google rich
 * results) plus OpenGraph, canonical and description. All URLs resolve
 * through the PUBLIC_* env defaults (beta `.vercel.app` hosts).
 */
export const meta = defineMeta(() => {
  const faq = buildFaq();
  const softwareLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "RDM Studio",
    applicationCategory: "EngineeringApplication",
    operatingSystem: "Web (PWA, local-first)",
    url: SITE_URL,
    softwareVersion: "2.2.0",
    description:
      "Atelier de calcul de structures 3D aux Eurocodes local-first : solveur Timoshenko Rust/WASM, CAO 3D, vérifications EN 1990 → 1999, note de calcul vectorielle — zéro cloud.",
    offers: [
      { "@type": "Offer", name: "Découverte", price: "0", priceCurrency: "EUR" },
      { "@type": "Offer", name: "Pass Projet 48 h", price: "19", priceCurrency: "EUR" },
      { "@type": "Offer", name: "Bureau d'Études Pro", price: "49", priceCurrency: "EUR" },
    ],
    featureList: [
      "Solveur poutres 3D Timoshenko 12 DDL (Rust/WASM, Cholesky creuse)",
      "Eurocodes EN 1990 → 1999 (acier, inox, alu, bois, béton, feu)",
      "CAO 3D interactive, import DXF / STEP / IGES",
      "41 benchmarks analytiques embarqués",
      "Note de calcul PDF A4 vectorielle et .docx, BIM IFC4 / SAF",
    ],
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  return {
    title: "RDM Studio — Le calcul de structures 3D aux Eurocodes, sur votre poste",
    description:
      "Atelier local-first de calcul de structures 3D : solveur Timoshenko Rust/WASM, CAO interactive, Eurocodes EN 1990 → 1999, 41 benchmarks analytiques, note de calcul vectorielle. Zéro cloud.",
    canonical: SITE_URL,
    openGraph: {
      title: "RDM Studio — calcul de structures 3D aux Eurocodes, 100 % local",
      description:
        "Solveur Timoshenko Rust/WASM, CAO 3D, vérifications EN 1990 → 1999 et 41 benchmarks analytiques — vos projets ne quittent jamais votre poste.",
      url: SITE_URL,
      type: "website",
      siteName: "RDM Studio",
      locale: "fr_FR",
    },
    jsonLd: [JSON.stringify(softwareLd), JSON.stringify(faqLd)],
  };
});
