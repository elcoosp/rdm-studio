/**
 * `/en/timber-beam-eurocode-5` — server module (the LIVE meta channel).
 * English meta + English FAQPage, mirrored from `/calcul-poutre-bois-eurocode-5`.
 */
import { defineLoad, defineMeta } from "@oxide-fw/core/shared";
import { SITE_URL } from "../../../lib/env";
import { buildHeadTags } from "../../../lib/meta";

const FAQ_EN = [
  {
    q: "What are kmod and γM for in Eurocode 5?",
    a: "kmod (EN 1995-1-1 §3.1.3, Table 3.1) reduces the strength according to the service class (moisture) and load duration: 0.8 for GL24h in service class 1 under medium-term load. γM (Table 2.3) is 1.3 for glued laminated timber. The design strength becomes fm,d = kmod·fm,k/γM = 0.8 × 24 / 1.3 = 14.8 MPa — two identical beams in service class 1 or 3 do not have the same strength.",
  },
  {
    q: "What deflection limits for a timber beam?",
    a: "EN 1995-1-1 Table 7.2 recommends (indicative National Annex values): winst ≤ L/300 to L/500, and wnet,fin ≤ L/150 to L/250 depending on the sensitivity of the finishes. The final deflection ufin includes creep via kdef (0.8 for glulam in service class 1) applied to the quasi-permanent parts of the loads.",
  },
  {
    q: "How does the solver check timber?",
    a: "The solver computes the internal forces (N, V, M) independently of the material; the check then applies the EN 1995-1-1 formulas (6.11 σm,d ≤ fm,d, 6.13 τd ≤ fv,d) with the GL24h/GL28h/GL32h properties built into the catalogue. The same model can mix steel members (EC3), timber beams (EC5) and concrete columns (EC2).",
  },
];

export const load = defineLoad(() => ({}));

export const meta = defineMeta(() => {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_EN.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  const appLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "RDM Studio — timber beam calculation to Eurocode 5",
    applicationCategory: "EngineeringApplication",
    operatingSystem: "Web (PWA, local-first)",
    url: `${SITE_URL}/en/timber-beam-eurocode-5`,
    softwareVersion: "2.2.0",
    description:
      "Check of a GL24h glulam beam per EN 1995-1-1: fm,d with kmod/γM, shear fv,d, instantaneous winst and final ufin deflections with kdef — local-first multi-material calculation.",
  };
  return buildHeadTags({
    title: "Timber beam calculation to Eurocode 5 (GL24h, kmod, deflection) — RDM Studio",
    description:
      "EN 1995-1-1 method for a glulam beam: fm,d = kmod·fm,k/γM, shear, instantaneous and final deflection with creep kdef — worked example, 160×320 mm beam over 6 m.",
    canonicalPath: "/en/timber-beam-eurocode-5",
    ogType: "article",
    ogTitle: "Timber beam calculation to Eurocode 5 — GL24h, kmod and deflections",
    ogDescription:
      "The complete check of a GL24h 160×320 beam: fm,d, fv,d, winst ≤ L/300 and creep kdef — with a worked example.",
    locale: "en",
    pairedFrPath: "/calcul-poutre-bois-eurocode-5",
    pairedEnPath: "/en/timber-beam-eurocode-5",
    jsonLd: [faqLd, appLd],
  });
});
