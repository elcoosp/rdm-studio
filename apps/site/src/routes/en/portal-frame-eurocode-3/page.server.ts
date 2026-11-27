/**
 * `/en/portal-frame-eurocode-3` — server module (the LIVE meta channel).
 * English meta + English FAQPage, mirrored from `/calcul-portique-eurocode-3`.
 */
import { defineLoad, defineMeta } from "@oxide-fw/core/shared";
import { SITE_URL } from "../../../lib/env";
import { buildHeadTags } from "../../../lib/meta";

const FAQ_EN = [
  {
    q: "When does interaction 6.61 or 6.62 apply?",
    a: "Equation 6.61 (NEd/MEd, rolled sections, negligible torsion) covers lateral-torsional buckling for doubly symmetric sections in single-axis bending; 6.62 covers biaxial bending. The most unfavourable of the two governs; RDM Studio computes both ratios and keeps the maximum, with the kyy/kyz detail and the Cmy,C0 equivalence factors traceable in the CalcTrace.",
  },
  {
    q: "How is P-Δ taken into account in a portal frame?",
    a: "Through the coefficient αcr = Fcr/FEd (EN 1993-1-1 §5.2.1): if αcr ≥ 10 (braced frames) first-order analysis is enough; between 3 and 10, EN 1990 §5.1.4 (H) or a second-order analysis is required. The RDM Studio solver computes λcr (global linear buckling) and the P-Δ option adds the geometric stiffness [Kg(N)] to the system [Ke + Kg(N)]·u = F.",
  },
  {
    q: "Which buckling curve for a rolled HEA?",
    a: "For strong-axis (y-y) buckling of a rolled S235 section with h/b ≤ 1.2 (HEA 200: 190/200), the §6.3.1.2 tabular annex gives curve b (αimp = 0.34) for t ≤ 100 mm; the weak axis (z-z) takes curve c. RDM Studio selects the curve automatically from h/b, tf and the steel grade.",
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
    name: "RDM Studio — portal frame calculation to Eurocode 3",
    applicationCategory: "EngineeringApplication",
    operatingSystem: "Web (PWA, local-first)",
    url: `${SITE_URL}/en/portal-frame-eurocode-3`,
    softwareVersion: "2.2.0",
    description:
      "Check of an HEA 200 portal column in compression and bending: buckling χy, EN 1993-1-1 interaction 6.61/6.62, P-Δ sensitivity αcr — local-first calculation.",
  };
  return buildHeadTags({
    title: "Portal frame calculation to Eurocode 3 (buckling, interaction 6.61, P-Δ) — RDM Studio",
    description:
      "HEA 200 portal column in compression and bending per EN 1993-1-1: Ncr, λ̄y, χy, Nb,Rd, interaction 6.61 and P-Δ sensitivity αcr — full worked example to recalculate in the workshop.",
    canonicalPath: "/en/portal-frame-eurocode-3",
    ogType: "article",
    ogTitle: "Portal frame calculation to Eurocode 3 — buckling and interaction 6.61",
    ogDescription:
      "The complete check of an HEA 200 column in compression and bending: χy, Nb,Rd, equation 6.61, P-Δ — with a worked example.",
    locale: "en",
    pairedFrPath: "/calcul-portique-eurocode-3",
    pairedEnPath: "/en/portal-frame-eurocode-3",
    jsonLd: [faqLd, appLd],
  });
});
