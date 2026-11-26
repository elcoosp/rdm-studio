// oxide.config.ts — rdm-studio marketing site.
//
// The v2.1.2 landing (`apps/web/src/routes/_marketing/*`) ported verbatim to
// the Oxide static adapter: every route is prerendered to plain HTML/CSS/JS,
// deployable to any static host (rdm-studio-site.vercel.app). The single
// WebGL surface — the 3D hero — ships as a client-only `<Island>` with the
// architectural SVG fallback prerendered during SSR.
//
// Cross-app URLs come from env vars with the beta `.vercel.app` defaults so
// swapping to custom domains later is a one-env-var change:
//   PUBLIC_SITE_URL (this site), PUBLIC_APP_URL (studio), PUBLIC_DOCS_URL.
import react from "@oxide-fw/react";
import { tailwind } from "@oxide-fw/tailwind";
import { defineConfig } from "@oxide-fw/core";

// §16.3: origin used by the emitted sitemap.xml and robots.txt. The CLI's
// static config extractor reads this string literal directly, so the beta
// `.vercel.app` default stays inline; page/link URLs resolve through
// `src/lib/env.ts` (PUBLIC_SITE_URL / PUBLIC_APP_URL / PUBLIC_DOCS_URL).
export default defineConfig({
  siteUrl: process.env.PUBLIC_SITE_URL ?? "https://rdm-studio-site.vercel.app",
  // §6.6 / D5: Tailwind v4 native plugin — compiles src/styles/app.css
  // (the DESIGN.md Swiss Metrology daylight tokens) with Tailwind's own
  // Rust scanner over src/.
  plugins: [tailwind()],

  // §16.3: origin used by the emitted sitemap.xml and robots.txt.
  siteUrl,

  framework: react({
    ssr: "real",
    // §10.3 islands registry: `<Island component="Hero3D" …>` on the landing
    // page resolves through this map. Hero3D owns the interactive hero panel
    // (model switcher + lazy WebGL stage + load slider + readouts);
    // ShowcaseTabs and FaqAccordion own the remaining client interactions.
    // The islands map is consumed by the CLI's static extractor
    // (crates/config/src/extract.rs); the published AdapterOptions type
    // lags behind this runtime surface, hence the cast.
    islands: {
      Hero3D: "src/islands/hero-3d.tsx",
      ShowcaseTabs: "src/islands/showcase-tabs.tsx",
      FaqAccordion: "src/islands/faq-accordion.tsx",
    },
  } as unknown as Parameters<typeof react>[0]),

  routes: { dir: "src/routes" },

  render: { default: "auto" },

  build: { target: "baseline-widely-available", sourcemap: "hidden" },

  // Static export: dist/ is pure HTML + hashed assets (Vercel static deploy).
  adapter: "static",

  modules: [],
});
