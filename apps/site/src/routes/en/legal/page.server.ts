/** `/en/legal` — server module (the LIVE meta channel). English meta, mirrored from `/legal`. */
import { defineLoad, defineMeta } from "@oxide-fw/core/shared";
import { buildHeadTags } from "../../../lib/meta";

export const load = defineLoad(() => ({}));

export const meta = defineMeta(() =>
  buildHeadTags({
    title: "Legal information & privacy — RDM Studio",
    description:
      "Legal notice (LCEN), Terms of Use & Sale, GDPR privacy policy (100% local — no data sent to any server) and the engineer's technical responsibility clause.",
    canonicalPath: "/en/legal",
    ogType: "article",
    ogTitle: "Legal information & privacy — RDM Studio",
    ogDescription:
      "LCEN, Terms of Use & Sale, 100% local GDPR and the engineer's responsibility clause — the legal framework of the local-first analysis workshop.",
    locale: "en",
    pairedFrPath: "/legal",
    pairedEnPath: "/en/legal",
  }),
);
