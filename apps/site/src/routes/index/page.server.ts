/**
 * `/` — server module (the LIVE meta channel).
 *
 * The `export const meta = defineMeta(...)` that used to live in `page.tsx`
 * is dead code: the worker only evaluates `meta` on the `page.server.ts`
 * sibling (via `loader:run`). This file is where the landing title,
 * description, canonical, Open Graph, hreflang and JSON-LD actually come
 * from. The content mirrors the (now inert) `page.tsx` meta verbatim.
 *
 * The `load` is a trivial empty loader: the worker errors on a server
 * module with neither `load` nor `actions`/`config`, and the meta is only
 * evaluated after the load runs.
 */
import { defineLoad, defineMeta } from "@oxide-fw/core/shared";
import { SITE_URL } from "../../lib/env";
import { buildFaq } from "../../lib/content";
import { buildHeadTags } from "../../lib/meta";
import { activateSiteLocale } from "../../i18n/i18n";

// Activate the route's locale before `meta` runs: `buildFaq()` resolves
// its strings through the `i18n` singleton, and the worker renders routes
// sequentially — an EN route rendered first would otherwise leave the
// singleton on `en` and the FR FAQPage JSON-LD would come out in English.
export const load = defineLoad(() => {
  activateSiteLocale("fr");
  return {};
});

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
      { "@type": "Offer", name: "Édition Open Source", price: "0", priceCurrency: "EUR" },
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
  return buildHeadTags({
    title: "RDM Studio — Le calcul de structures 3D aux Eurocodes, sur votre poste",
    description:
      "Atelier local-first de calcul de structures 3D : solveur Timoshenko Rust/WASM, CAO interactive, vérifications EN 1990 → 1999, 41 benchmarks analytiques, note de calcul vectorielle. Zéro cloud.",
    canonicalPath: "/",
    ogType: "website",
    ogTitle: "RDM Studio — calcul de structures 3D aux Eurocodes, 100 % local",
    ogDescription:
      "Solveur Timoshenko Rust/WASM, CAO 3D, vérifications EN 1990 → 1999 et 41 benchmarks analytiques — vos projets ne quittent jamais votre poste.",
    locale: "fr",
    pairedFrPath: "/",
    pairedEnPath: "/en",
    jsonLd: [softwareLd, faqLd],
  });
});
