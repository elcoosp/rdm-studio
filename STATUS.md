# STATUS.md — RDM Studio milestone ledger

Session 21 (2026-11-28): **Milestone M9 — RDM7 CAD Power Tools, Parametric
Structure Library & Synchronized Metrology Spreadsheet** on top of origin/main
dd3c74a (Session 1 of 4 of the M9 wave), tree left dirty (zero commits, see
ship.toml + .github/pr-body.md).

## M9 shipped (implemented + tested)

1. **M9.1 — 1-click topological cleanup ("Compacter / Nettoyer le modèle",
   _Ossatures_ §3.7) + Auto-Split on Draw** — `apps/web/src/modeling/
   modelCleanup.ts`: pure deterministic `mergeDuplicateNodes` (weld ≤ 1e-4 m,
   remap n1/n2 + supports + nodal loads, drop zero-length beams),
   `splitIntersectingBeams` (T-junctions weld the existing node, X-crossings
   share one junction id; children inherit section/material/roll/buckling,
   outer releases kept, interior rigid; loads proportionally remapped —
   trapezoid/uniform re-sampled, point-on-span half-open ownership, thermal
   rides every child), `deduplicateBeams`, `purgeOrphanNodes`,
   `compactModel` (atomic pass + `{ mergedNodes, splitBeams,
   removedDuplicates, removedOrphans }` stats), `autoSplitOnDraw`. UI:
   Compacter buttons with `<Tooltip>` in CadToolbar (`compact-model`) and
   Step 1 inspector (`compact-model-inspector`) with the undoable Sonner
   summary toast; `autoSplitOnDraw` viewport flag (default true) with Base UI
   checkbox in the beam tool row; beam tool cuts hosts under drawn members.
2. **M9.2 — "Discrétiser (N tronçons)" (§3.8.13)** — pure
   `subdivideBeam(project, beamId, segments)` (2 ≤ N ≤ 50, equidistant
   interior nodes, inherited properties, rigid interior junctions, load
   remap); store action delegates to the pure transform; inspector control
   upgraded with 2/4/8/10 presets (`subdivide-preset-*`), NumberField max
   24 → 50, locked `subdivide-beam` testid.
3. **M9.3 — Bibliothèque d'ossatures paramétrées (§3.10)** —
   `apps/web/src/modeling/parametricGenerators.ts` (pure, deterministic,
   clamped) + `ParametricFrameModal.tsx` (Base UI dialog,
   `parametric-generator-modal`, live 2D/3D SVG wireframe preview re-derived
   per keystroke, Replace-project / Insert-at-origin modes with id
   remapping): portique à traverse brisée / monopente (2D/3D, bays, frames +
   purlins, HEA/IPE, Encastrement/Rotule presets with the 3D rigid-mode
   guard), treillis Pratt / Howe / Warren (RDM6 #50–#58, end/ridge heights,
   auto-pinned diagonals), ferme à entrait retroussé / Polonceau
   (RDM6 #200–#206, raised tie + king post + struts), pylône treillis 3D
   tronconique (RDM6 #100–#105, tapered, X / K bracing). Opened from Step 1
   (`open-parametric-generator`).
4. **M9.4 — CAD ghost preview + synchronized metrology spreadsheet** —
   `viewport3d/DrawGhost.tsx` (dashed Deep Cobalt `#1D4ED8` preview segment,
   X/Y/Z axis-lock guide lines, floating JetBrains Mono HUD pill with
   ΔL (m) / α (°), Escape cancel); `components/ModelDataTable.tsx`
   (`model-data-table` bottom drawer, Nœuds / Poutres TanStack tabs: inline
   X/Y/Z NumberFields, support badges, per-row Section Combobox + Matériau
   Select + Roulis + mono L (m), delete rows; bidirectional 3D sync —
   row hover → 3D highlight via `hoveredNodeId`/`hoveredBeamId`, row click →
   `?node=`/`?beam=`, 3D selection → scroll-into-view; spreadsheet paste of
   tab/CSV `x y z` rows batch-creates nodes). Locked v1.5.0 dock selectors
   preserved (`data-dock`, `dock-tab-*`, `data-dock-toggle`).

## M9 verification gates (all green)

- G0: cargo fmt --all --check ✓; cargo clippy --workspace --all-targets
  --all-features -- -D warnings ✓ (Rust untouched); oxfmt --check ✓ (149
  files); oxlint --deny-warnings ✓ (0 warnings, 0 errors).
- G1: RUSTFLAGS="-D warnings" cargo test --workspace --all-features ✓ (63 tests, 0 failed).
- G2: wasm-pack build bindings/rdm-wasm --target web --out-dir
  ../../apps/web/src/wasm-pkg ✓.
- G2.5: pnpm --filter web exec tsr generate ✓.
- G3/G4: i18n:extract ✓ (645 strings) + i18n:compile ✓ — fr source,
  en 100 % (24 new M9 strings filled), de/es/pt_BR refreshed.
- G5: pnpm --filter web exec tsc --noEmit ✓; pnpm --filter web test:unit ✓
  (99/99 — +34: 18 modelCleanup, 16 parametricGenerators);
  pnpm --filter @rdm-studio/ui build ✓; pnpm --filter web build ✓.
- G6: new apps/web/e2e/m9-cad-powertools.spec.ts ✓ 7/7 on Chromium AND
  Firefox (compact T-junction + dedup stats, subdivision presets, portal
  replace + support badges, Pratt replace + counts, bidirectional table sync,
  spreadsheet paste incl. the Firefox ClipboardEvent path, auto-split
  toggle). Full-suite sweep: 124 passed / 7 skipped (WebKit skipped per the
  rootless-sandbox guardrail) with a residual failure set that reproduces at
  pristine HEAD dd3c74a in this sandbox (v211 header/⌘K/locale specs, v160
  layout matrix + combination-selector drift, marketing Firefox WebGL,
  console-hygiene Firefox worker load, layout-craft) — verified by running
  the same specs against a HEAD worktree; the two M9-caused regressions
  (v160 subdivision toast wording after the Discrétiser rename; Firefox
  paste-event clipboardData) were found and fixed in this session.

## Next milestone

M9 Session 2 of 4 (per the session plan): remaining CAD power-tool depth on
top of this tree.

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

## v2.3.0 Wave 1 Complete (2026-11-26) — Unified Commercial Architecture

**Created @rdm-studio/ui package** (`packages/ui/`) as the single source of truth for all Swiss Metrology tokens, engineering icons, primitives, interior components, templates, deeplinks, and viewport utilities:
- `tokens.css` — Complete Swiss Metrology daylight tokens (canvas #F8FAFC, panel #FFFFFF, hairline #E2E8F0, accent #1D4ED8, Inter + JetBrains Mono tabular-nums, rounded-[4px] buttons, rounded-[8px] cards)
- `EngineeringIcons.tsx` — 44 custom icons (32 from mockups/icons-sheet.html + 12 from mockups/icons-sheet-v2.html + 5 workflow + BrandEmblem) with strokeWidth="1.5", exact SVG paths
- `primitives/` — Button (rounded-[4px] strict), Badge, Card (rounded-[8px]), cn utility
- `interior/` — SegmentedControl (animated gliding pill), LoadingButton, CopyButton, HoldToConfirm, TooltipGroup (warm tooltip group), SliderDetents, StatusBadge (pass/fail/warn/accent), ExpandablePanel, NumberFlowValue (fr-FR locale, font-data tabular-nums)
- `templates/engineeringCatalog.ts` — 14 canonical models with English slugs + legacy French aliases
- `deeplinks/studioLinks.ts` — Typed studio URL builders with canonical English query params + silent French alias support
- `viewport/spectrum.ts` — 5-tier thermal spectrum (tuple + object API) matching DESIGN.md exactly
- Barrel exports at `src/index.ts`, `templates/index.ts`, `deeplinks/index.ts`, `viewport/index.ts`

**Refactored apps/web** — 18 files migrated to import from `@rdm-studio/ui`:
LayerToolbar, ViewportCanvas, CadToolbar, _studio.tsx, _studio/results, _studio/supports, _studio/loads, _studio/geometry, _studio/report, HeroViewport3D, _marketing/index, AdvancedPanels, ProjectGalleryModal, CommandPalette, LicenseModal, CadImportDialog, ScenarioCompareModal, LicenseBadge

**Refactored apps/site** — icons.tsx re-exports from `@rdm-studio/ui/icons`; index/page.tsx and legal/page.tsx include meta exports for real oxide SSR prerendered HTML (6 routes, 6 prerendered); oxide.config.ts fixed siteUrl const hoisting

**Updated pnpm-workspace.yaml** to include `packages/*` alongside `apps/*`

**All Quality Gates G0→G5 PASS**:
- G0: cargo fmt --all --check ✓, cargo clippy --workspace --all-targets --all-features -- -D warnings ✓, pnpm --filter web exec oxfmt --check ✓, pnpm --filter web exec oxlint --deny-warnings ✓
- G1: RUSTFLAGS="-D warnings" cargo test --workspace --all-features ✓ (150 tests pass)
- G2: wasm-pack build bindings/rdm-wasm --target web --out-dir ../../apps/web/src/wasm-pkg ✓
- G2.5: pnpm --filter web exec tsr generate ✓
- G3: pnpm --filter web i18n:extract ✓ (520 strings, en 100%, fr 100%)
- G4: pnpm --filter web i18n:compile ✓
- G5: pnpm --filter web exec tsc --noEmit ✓, pnpm --filter web test:unit ✓ (52 tests pass)

## Known gaps (deferred to Wave 2)

- apps/docs refactor to import from @rdm-studio/ui
- ValidationModal 4-tier bilingual rewrite
- SectionCutCard redesign
- Inspector hairline sub-cards
- EnvLoadGenerators beamId sync
- SearchParamsSchema 14 canonical English slugs + ?lang
- licenseStore signed offline keys + mint-license script
- 2 new bilingual tutorials + TryInStudio component
- Wave 3: docs:capture pipeline (smooth cursor, MP4 H.264 <6MB), E2E tests