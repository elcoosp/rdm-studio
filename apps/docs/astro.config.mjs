// astro.config.mjs — RDM Studio documentation (Starlight + docs-toolkit).
//
// The `defineDocsConfig` helper from @elcoosp/docs-toolkit wires the full
// Starlight plugin stack: Diataxis topics sidebar, i18n parity, glossary,
// link preview, related pages, OG images (Space Grotesk + JetBrains Mono),
// llms.txt and the native doc-graph pipeline. The site origin comes from
// PUBLIC_DOCS_URL (beta default: https://rdm-studio-docs.vercel.app) — the
// same env var the marketing site and the studio use for cross-app links.
import { defineDocsConfig } from '@elcoosp/docs-toolkit/config';

const docsUrl = process.env.PUBLIC_DOCS_URL ?? 'https://rdm-studio-docs.vercel.app';

export default await defineDocsConfig({
  site: docsUrl,
  domain: new URL(docsUrl).hostname,
  github: 'elcoosp/rdm-studio',
  title: 'RDM Studio Docs',
  description:
    'Official documentation of RDM Studio — the local-first 3D structural Eurocode workstation: tutorials, guides, normative reference and solver architecture.',
  logoPath: './src/assets/logo.png',
  favicon: '/logo.svg',
  defaultLocale: 'root',
  locales: {
    root: { label: 'English', lang: 'en' },
    fr: { label: 'Français', lang: 'fr' },
  },
  topics: true,
  og: {
    fontFamily: 'Inter',
    monoFontFamily: 'JetBrains Mono',
    fonts: [
      {
        src: './node_modules/@fontsource/inter/files/inter-latin-400-normal.woff',
        family: 'Inter',
        role: 'sans',
      },
      {
        src: './node_modules/@fontsource/inter/files/inter-latin-700-normal.woff',
        family: 'Inter',
        role: 'sans',
      },
      {
        src: './node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff',
        family: 'JetBrains Mono',
        role: 'mono',
      },
    ],
  },
  extraStarlight: {
    logo: { src: './src/assets/logo.svg', alt: 'RDM Studio' },
    components: {
      ThemeProvider: './src/components/ForceLightTheme.astro',
    },
    head: [
      process.env.PUBLIC_UMAMI_WEBSITE_ID ? {
        tag: 'script',
        attrs: {
          async: true,
          defer: true,
          'data-website-id': process.env.PUBLIC_UMAMI_WEBSITE_ID,
          src: 'https://umami.rdm-studio.com/umami.js',
        },
      } : undefined,
    ].filter(Boolean),
  },
  social: {
    theme: 'light',
  },
});
