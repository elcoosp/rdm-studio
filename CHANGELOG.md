# Changelog — RDM Studio

All notable changes to RDM Studio are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [2.2.0] — 2026-11-26

### Added

- **3-app architecture** deployable on free `.vercel.app` beta URLs:
  `rdm-studio-site.vercel.app` (marketing), `rdm-studio-app.vercel.app` (studio PWA),
  `rdm-studio-docs.vercel.app` (documentation) — cross-app links driven by the
  `PUBLIC_SITE_URL` / `PUBLIC_APP_URL` / `PUBLIC_DOCS_URL` env vars so a custom-domain
  swap is a one-env-var change.
- `apps/site` — the v2.1.2 landing page ported verbatim to the Oxide static adapter,
  plus 4 programmatic Eurocode SEO landing pages (`/calcul-poutre-ipe`,
  `/calcul-portique-eurocode-3`, `/calcul-berceau-levage-naval`,
  `/calcul-poutre-bois-eurocode-5`), `SoftwareApplication` + `FAQPage` JSON-LD,
  `sitemap.xml` and `robots.txt`.
- `apps/docs` — exhaustive 14-page bilingual (EN + FR) Diataxis documentation site on
  Astro Starlight powered by `@elcoosp/docs-toolkit@^1.8.0`, with `<DocMedia>` media
  slots wired to `media-manifest.json` for the next automated screenshot/GIF capture
  session, a bilingual glossary, and `starlight-links-validator` link checks.
- Pedagogical solver error card with a 1-click "Activer Plan 2D & recalculer" fix,
  replacing the raw mechanism dump.
- Report page auto-solve on direct `/report` visits (no more blank ELU reaction boxes).

### Changed

- `/` in the studio now redirects immediately to `/geometry`.
- BottomSheet renders above the mobile tab bar (`z-50`) with safe-area padding.
- ValidationModal reorganized into the 4-tier Swiss Metrology certification hierarchy
  with French titles for all 41 benchmarks (`R01–R30`, `E01–E11`).

## [2.1.2] — 2026-11-25

### Added

- Flagship Three.js / R3F hero on the landing page (portal frame / Warren truss /
  3-span beam) with live load slider driving the thermal spectrum and rolling
  fr-FR readouts.
- 12 Stitch PNG illustrations precached by the PWA service worker.
- 4-tier pricing (Découverte 0 € / Pass Projet 48 h 19 € HT / Pro 49 € HT/mois /
  Équipe / Intranet) mirrored in `LicenseModal` with 1-click pass activation.

### Fixed

- `Réglages` popover clipping migrated onto the Base UI portal.
- Shared-geometry memoization stabilized (BVH no longer rebuilds on route ticks).

## [2.1.1] — 2026-11-24

### Added

- Hash navigation from `/legal` to `/#fonctionnalites` and `/#tarifs`.
- 48 px studio header with uniform 28 px controls and grouped hairline dividers.

[2.2.0]: https://github.com/elcoosp/rdm-studio/releases/tag/v2.2.0
[2.1.2]: https://github.com/elcoosp/rdm-studio/releases/tag/v2.1.2
[2.1.1]: https://github.com/elcoosp/rdm-studio/releases/tag/v2.1.1
