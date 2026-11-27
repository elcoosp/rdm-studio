/**
 * `/en/naval-lifting-cradle` — server module (the LIVE meta channel).
 * English meta + English FAQPage, mirrored from `/calcul-berceau-levage-naval`.
 */
import { defineLoad, defineMeta } from "@oxide-fw/core/shared";
import { SITE_URL } from "../../../lib/env";
import { buildHeadTags } from "../../../lib/meta";

const FAQ_EN = [
  {
    q: "Which accelerations should be used for naval transport or lifting?",
    a: "For lifting, EN 13001 or the crane operator's dynamic amplification factors (φ = 1.2 to 1.4 depending on the crane and the sea state) amplify g along the vertical axis. For sea transport, the transport rules (DNV-ST-N001, Cargo Resistance) give (ax, ay, az) as a fraction of g depending on the sea area. RDM Studio models these fields as volumetric accelerations (ax, ay, az) × g applied to the whole structure, then generates the associated EN 1990 combinations.",
  },
  {
    q: "How are the accelerations combined with each other?",
    a: "Each acceleration becomes a variable action: the fundamental combination becomes G + az·g + ψ0,1·ay·g (+ ψ0,2·ax·g), with ψ0 factors from the transport rules or set by the engineer. The workshop treats them as ordinary load cases: 6.10, 6.10a/b with action groups, including sign reversal (two headings per acceleration).",
  },
  {
    q: "S355 or 6082-T6 aluminium for a lifting cradle?",
    a: "S355 steel offers a 355 MPa yield strength and good cold resilience (J2/K2); 6082-T6 aluminium (EN 1999-1-1, fo = 250 MPa, fu = 290 MPa) wins when the carried mass matters (deck, TIG/MIG-weldable structure). RDM Studio checks both in the same model: EN 1993-1-1 for steel, EN 1999-1-1 (section classes, weldability, ω factors) for aluminium.",
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
    name: "RDM Studio — naval lifting cradle calculation",
    applicationCategory: "EngineeringApplication",
    operatingSystem: "Web (PWA, local-first)",
    url: `${SITE_URL}/en/naval-lifting-cradle`,
    softwareVersion: "2.2.0",
    description:
      "Sizing a naval lifting/transport cradle under acceleration fields (ax, ay, az) × g: EN 1990, S355 and 6082-T6 aluminium (EN 1999), local-first calculation.",
  };
  return buildHeadTags({
    title: "Naval lifting cradle calculation ((ax, ay, az) × g, S355) — RDM Studio",
    description:
      "EN 1990/EN 1993 method for a naval transport cradle: turning accelerations (ax, ay, az) × g into ULS loads, checking IPE 200 S355 cross members — 12 t example at az = 1.3 g.",
    canonicalPath: "/en/naval-lifting-cradle",
    ogType: "article",
    ogTitle: "Naval lifting cradle calculation — accelerations and S355",
    ogDescription:
      "From (ax, ay, az) × g to ULS combinations, checking cradle cross members in S355 or 6082-T6 aluminium — worked 12 t example.",
    locale: "en",
    pairedFrPath: "/calcul-berceau-levage-naval",
    pairedEnPath: "/en/naval-lifting-cradle",
    jsonLd: [faqLd, appLd],
  });
});
