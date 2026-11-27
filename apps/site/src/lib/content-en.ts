/**
 * English landing FAQ — the EN mirror of `buildFaq()` in `./content.ts`.
 * Kept in a separate module (not extracted to the Lingui catalog) because
 * the FAQPage JSON-LD and the `FaqAccordion` island must render the exact
 * same strings, and the EN `page.server.ts` meta needs them at build time
 * without a locale-aware runtime call.
 */
import type { FaqItem } from "../islands/faq-accordion";

export function buildFaqEn(): FaqItem[] {
  return [
    {
      q: "Does RDM Studio really work offline?",
      topic: "Offline",
      a: "Yes. The app is a PWA: the Rust solver compiled to WASM, the profile catalogues and the print fonts are cached by the service worker. Once loaded, it starts and solves with no connection at all — in the office, in the workshop, and on site.",
    },
    {
      q: "Where are my projects stored?",
      topic: "Storage",
      a: "In IndexedDB, on your machine only. No remote database, no mandatory account. Sharing happens through a URL carrying the lz-string-compressed model (revalidated by Valibot on import), or through a .rdm file.",
    },
    {
      q: "Which standards are covered?",
      topic: "Standards",
      a: "EN 1990 (combinations), EN 1991 (actions), EN 1993-1-1 (steel, checks 6.61/6.62 + C1), EN 1992 / 1995 / 1998 / 1999 for concrete, timber, aluminium and composite. The 41 built-in analytical benchmarks verify the solver on every update.",
    },
    {
      q: "Is RDM Studio really free, with no limits?",
      topic: "Free",
      a: "Yes. The Open Source edition is complete and free for life: solver, Eurocodes, models and exports — no account, no throttling, no data sent to any server. The project is funded by engineering-firm sponsoring (GitHub Sponsors) and by B2B / closed-intranet services on request (offline deployment, custom templates, dedicated engineering support).",
    },
    {
      q: "Can I import my DXF or STEP drawings?",
      topic: "Import",
      a: "Yes — drag and drop a .dxf, .step or .igs file into the workshop: the wireframe geometry becomes nodes and beams, ready to be profiled and loaded. The .rdm export is canonical and re-importable identically.",
    },
    {
      q: "What is the 48 h Project Pass for?",
      topic: "Legacy product",
      a: "That product no longer exists: the Open Source edition already covers every need, 100% free. For a closed-intranet deployment or custom trade checks (EN 13155, DNV-ST-N001), contact us through the project's contact page.",
    },
  ];
}
