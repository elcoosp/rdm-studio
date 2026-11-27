/**
 * `/en/ipe-beam-calculator` — server module (the LIVE meta channel).
 * English meta + English FAQPage, mirrored from `/calcul-poutre-ipe`.
 */
import { defineLoad, defineMeta } from "@oxide-fw/core/shared";
import { SITE_URL } from "../../../lib/env";
import { buildHeadTags } from "../../../lib/meta";

const FAQ_EN = [
  {
    q: "What is the difference between Wel,y and Wpl,y for an IPE beam?",
    a: "Wel,y (elastic section modulus) drives the elastic stress σ = M/Wel, used for class 3 and 4 sections or SLS checks. Wpl,y (plastic section modulus) drives Mc,Rd = Wpl,y·fy/γM0 for class 1 or 2 sections — the case for rolled IPE beams in strong-axis bending: the tensile fibre can yield, and the resisting moment is about 13 to 15% higher.",
  },
  {
    q: "How do you check the deflection of an IPE beam to Eurocode 3?",
    a: "EN 1993-1-1 sets no numeric limit: Table 7.2 of EN 1993-1-1 refers to the National Annex. In common French practice, w ≤ L/250 (standard elements) to L/500 (fragile elements, sensitive coverings) is used under the characteristic SLS combination. RDM Studio shows both limits with the computed w/L ratio.",
  },
  {
    q: "Must web buckling be checked for an IPE?",
    a: "For a rolled IPE in simple bending, webs stay in the non-buckling range (class limits respected for fy ≤ 460 MPa) except under very high local loads or dominant shear: the VEd/Vpl,Rd check and web crippling (§6.2.7) are nevertheless computed by the workshop.",
  },
  {
    q: "Must an IPE beam be checked for lateral-torsional buckling?",
    a: "Yes, as soon as compression is not laterally restrained: the §6.3.2 check with χLT applies (LTB). On the example beam, bridging or connected slab concrete prevents lateral-torsional buckling; unrestrained, RDM Studio automatically computes Mcr, λ̄LT and χLT with method 1 or 2 as chosen.",
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
    name: "RDM Studio — IPE beam calculation to Eurocode 3",
    applicationCategory: "EngineeringApplication",
    operatingSystem: "Web (PWA, local-first)",
    url: `${SITE_URL}/en/ipe-beam-calculator`,
    softwareVersion: "2.2.0",
    description:
      "Complete check of an IPE beam per EN 1993-1-1: Mc,Rd, Vpl,Rd, SLS deflection, lateral-torsional buckling χLT — worked example and local-first calculation.",
  };
  return buildHeadTags({
    title: "IPE beam calculation to Eurocode 3 (Mc,Rd, Vpl,Rd, deflection) — RDM Studio",
    description:
      "EN 1993-1-1 method for an IPE beam: plastic resistance Mc,Rd = Wpl,y·fy/γM0, shear Vpl,Rd, L/500 deflection, worked example for a 6 m IPE 300 S235 — check it free in the local-first workshop.",
    canonicalPath: "/en/ipe-beam-calculator",
    ogType: "article",
    ogTitle: "IPE beam calculation to Eurocode 3 — method and worked example",
    ogDescription:
      "Bending Mc,Rd, shear Vpl,Rd, SLS deflection: the complete check of a 6 m IPE 300 S235 step by step per EN 1993-1-1.",
    locale: "en",
    pairedFrPath: "/calcul-poutre-ipe",
    pairedEnPath: "/en/ipe-beam-calculator",
    jsonLd: [faqLd, appLd],
  });
});
