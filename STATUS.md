# STATUS.md — RDM Studio milestone ledger

Session 20 (2026-11-26): **v2.2.0 — 3-app architecture on free .vercel.app beta
URLs** on top of origin/main 8e7d4a0. apps/site (Oxide static adapter) ports the
v2.1.2 landing verbatim (header/footer layout, hero + proof strip + Bento + 4-tier
pricing + FAQ, Stitch PNGs, self-hosted Inter/JetBrains Mono woff2) with 3 client
islands (Hero3D, ShowcaseTabs, FaqAccordion) and the 4 programmatic Eurocode SEO
pages (+ SoftwareApplication/FAQPage JSON-LD). apps/docs is an exhaustive 14-page
bilingual (EN + FR) Diataxis Starlight site on @elcoosp/docs-toolkit@1.8.0
(topics sidebar, glossary.yml, i18n parity, DiataxisGrid, OG images, llms.txt,
changelogs) with <DocMedia> slots + media-manifest.json (19 capture recipes) ready
for the next automated /media/*.png|gif session. apps/web: / redirects to
/geometry, Documentation links resolve through VITE_DOCS_URL (lib/urls.ts),
LicenseModal opens from the ?license= deep link, pedagogical solver fault card
with 1-click "Activer Plan 2D & recalculer" replaces the raw mechanism dump,
BottomSheet at z-50 + safe-area padding, stepper rail at md+, PersistentStage
never-vanish undeformed geometry fallback, ReportPage auto-solve + route-leave
snapshot. Gates green: docs typecheck 0 / rumdl lint 0 issues (30 files) / build
0 broken links (40 pages); web oxfmt + oxlint + tsc + vitest 52/52 + i18n 100 %
(en.po auto-filled 8 new strings); zero-dead-link audit (scripts/
audit_zero_dead_links.py) over site+docs HTML and web src.

## Shipped (implemented + tested)

1. **apps/site** — Oxide v0.18.0 vendored packages (vendor/oxide-fw, overrides),
   static adapter build (6 routes), vercel.json (cleanUrls, immutable caches,
   security headers), sitemap/robots origin, SEO pages, JSON-LD.
2. **apps/docs** — 30 MDX (14 EN + 14 FR + index/404 ×2), _meta.yml ×8,
   DocMedia.astro + media-manifest.json, glossary (10 terms EN/FR),
   i18n/en+fr.json (108 keys parity), CHANGELOG.md (keep-a-changelog v2.2.0).
3. **apps/web** — 12 defect fixes from the 6fdb913 audit (see .github/pr-body.md).

## Known gaps (deferred)

- Site prerender shells are placeholders (released oxide binary lacks the Node
  SSR worker path baked at compile time; source build OOMs at 9.9G disk) —
  content hydrates client-side; rebuild with a source-built CLI for full SSR.
- ValidationModal 4-tier bilingual rewrite, inspector hairline sub-cards,
  EnvLoadGenerators beamId sync, e2e spec updates + screenshot eyeball pass,
  cargo clippy/test full run: deferred to the next session (budget).
