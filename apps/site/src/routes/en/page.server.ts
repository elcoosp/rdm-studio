/**
 * `/en` — server module (the LIVE meta channel; see
 * `../index/page.server.ts`). English meta, mirrored from the FR landing.
 */
import { defineLoad, defineMeta } from "@oxide-fw/core/shared";
import { SITE_URL } from "../../lib/env";
import { buildFaqEn } from "../../lib/content-en";
import { buildHeadTags } from "../../lib/meta";

export const load = defineLoad(() => ({}));

export const meta = defineMeta(() => {
  const faq = buildFaqEn();
  const softwareLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "RDM Studio",
    applicationCategory: "EngineeringApplication",
    operatingSystem: "Web (PWA, local-first)",
    url: `${SITE_URL}/en`,
    softwareVersion: "2.2.0",
    description:
      "Local-first 3D structural analysis to the Eurocodes: Timoshenko Rust/WASM solver, 3D CAD, EN 1990 → 1999 checks, vector calculation note — zero cloud.",
    offers: [
      { "@type": "Offer", name: "Open Source Edition", price: "0", priceCurrency: "EUR" },
    ],
    featureList: [
      "3D Timoshenko beam solver, 12 DOF (Rust/WASM, sparse Cholesky)",
      "Eurocodes EN 1990 → 1999 (steel, stainless, aluminium, timber, concrete, fire)",
      "Interactive 3D CAD, DXF / STEP / IGES import",
      "41 built-in analytical benchmarks",
      "Vector A4 PDF calculation note and .docx, IFC4 / SAF BIM",
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
  return buildHeadTags({
    title: "RDM Studio — 3D structural analysis to the Eurocodes, on your machine",
    description:
      "Local-first 3D structural analysis workshop: Timoshenko Rust/WASM solver, interactive CAD, EN 1990 → 1999 checks, 41 analytical benchmarks, vector calculation note. Zero cloud.",
    canonicalPath: "/en",
    ogType: "website",
    ogTitle: "RDM Studio — 3D structural analysis to the Eurocodes, 100% local",
    ogDescription:
      "Timoshenko Rust/WASM solver, 3D CAD, EN 1990 → 1999 checks and 41 analytical benchmarks — your projects never leave your machine.",
    locale: "en",
    pairedFrPath: "/",
    pairedEnPath: "/en",
    jsonLd: [softwareLd, faqLd],
  });
});
