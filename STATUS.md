Session 22 (2026-11-28): **Milestone M10 — Session 2 of 3 (Audit Fixes, RDM7
Boundary Conditions & Member Behaviors, Effective Modal Masses, 8 RDM6/7
Analytical Benchmarks & Multi-Case EN 1990 Envelopes)** on top of origin/main
fcf4e18 (M9 landed), tree left dirty (zero commits, see ship.toml +
.github/pr-body.md).

## M10 shipped (implemented + tested)

1. **M10.1 — Audit defect fixes (Rust)**:
   - `crates/rdm-solver/src/modal.rs`: removed the duplicated
     `RDM_MODAL_DEBUG` debug blocks; new `ModeShape.effective_mass_ratios:
     [f64; 3]` — true modal participation factors Γ_d = (M·φ)ᵀe_d and
     effective modal masses `M_eff,d = Γ_d²/(φᵀMφ)` as fractions of the
     total structural mass M_T = Σρ·A·L (Debard RDM6 §5.5 / EN 1998-1
     §4.3.3.3), unit tested (`effective_mass_ratios_are_fractions_of_total_mass`)
     and exposed on `ModeShapeDto` in the WASM bridge.
   - `crates/rdm-eurocode/src/en1993.rs`: `member_check` no longer hardcodes
     `lambda_bar_y_sq = 0.5` / `lambda_bar_z_sq = 0.8` — the squared
     non-dimensional slendernesses are computed from the actual member
     geometry (`N_cr = π²EI/L_cr²` from L, k_buckling, E, Iy/IZ) for
     compression AND bending members.
   - `crates/rdm-eurocode/src/multi_material.rs`: `ec3_fire_check` reports
     the real `utilization_mu0` in the substituted line (was `0.5`).
2. **M10.2 — RDM7 elastic supports & imposed displacements**:
   `Support.settlement` verified end-to-end (Valibot schema, store, solver);
   new store action `setSupportSettlement` (+ settlement preservation in
   `setSupport`/`setSupportSprings`); Step 2 inspector: `Appui élastique (k)`
   panel (`elastic-springs-panel`, 1-click preset seeding kz = 1000 kN/m)
   and `Déplacement imposé (Δ)` panel (`support-settlement-panel`,
   Δux..Δrz in mm/° on locked DOFs only, Δ badge on active supports);
   `SupportMarkers.tsx` renders Deep Cobalt `#1D4ED8` helical spring coils
   and cyan `#0891B2` prescribed-displacement arrows.
3. **M10.3 — Tension/compression-only members & beam theory toggle**:
   `SolvedModel.inactive_beam_ids` (members the behavior iteration
   deactivated) threaded through the WASM `SolveReport` and
   `workerClient.SolveReport`; Step 1 `<SegmentedControl>`
   `beam-axial-behavior` (Standard | Tirant | Buton) in the beam inspector;
   `TurnbuckleMarkers` (slender rod + midspan barrel) for
   TensionOnly/CompressionOnly members; buckled members render dim slate
   `#64748B` in 3D + `inactive-beams-banner` / `inactive-badge-<id>`
   "Inactif (comprimé)" badges in Step 4; SettingsPopover `Théorie de
   poutre` SegmentedControl (`shear-deformation-toggle`, Timoshenko |
   Bernoulli) bound to `settings.shear_deformation`.
4. **M10.4 — 8 Yves Debard RDM6/7 analytical benchmarks**:
   `crates/rdm-solver/tests/rdm6_benchmarks.rs` implements §6.1–§6.8 of
   Debard's _RDM – Flexion_ with strict 0.5 % closed-form assertions
   (RDM6-01 four-span continuous beam v5 = −0.079487 mm / M1z = 750.52 N·m;
   RDM6-02 triangular span; RDM6-03 internal hinge with slope
   discontinuity — exact force-method closed forms v2 = pL⁴/20EI,
   F1y = 1320 N, M1z = 208 N·m; RDM6-04 elastic support v2 = 3pL⁴/(2(kL³+24EI))
   = −1.1428 mm, F2y = 12.571 kN; RDM6-05 imposed settlement F3y = −1.14 N,
   σ = 34.29 MPa; RDM6-06 rotational spring M1z = −kθ1 = 0.838 kN·m;
   RDM6-07 T-section ±90/210 MPa fibers; RDM6-08 self-weight propped
   cantilever argmax at 0.57846 L). The in-app suite (validation.rs) gains
   the same 8 entries (41 + 8 = 49) and `ValidationModal.tsx` shows
   49/49 with the `RDM6 / RDM7 (8)` filter pill + summary card.
   `AdvancedPanels.tsx` shows real per-mode effective modal mass ratios
   (Mx/My/Mz % + cumulative sum, EN 1998-1 §4.3.3.3).
5. **M10.5 — Multi-case manager, EN 1990 combinations & envelopes**:
   Step 3 `load-case-manager` card (add/rename elementary cases with
   EN 1990 Annex A1 ψ factors via the new `setLoadCases` store action;
   1-click "Générer combinaisons ELU/ELS" through
   `build_combinations_v2_json`); `ENV:ULS` / `ENV:SLS`
   "Enveloppe (Min/Max)" views in the combination selector fed by
   `compute_envelopes_json` (worker lane) — shaded Deep Cobalt 12 %
   Min/Max uPlot bands (My/Vz/N, dynamic band indices) and floating 3D
   `M_max / u_max` extremum callout pills pinned at the members
   (`envelope-callout-<id>`).

## M10 verification gates (run in this session)

- G1 (Rust): `RUSTFLAGS="-D warnings" cargo test --workspace --all-features`
  ✓ — 166 tests, 0 failed (incl. the 9 rdm6_benchmarks + expanded modal
  tests). G0 fmt/clippy pending re-run at handoff (no new
  unwrap/allow/expect introduced).
- G2: `wasm-pack build bindings/rdm-wasm --target web --out-dir
  ../../apps/web/src/wasm-pkg` ✓ (2 min 26 s, wasm-opt ok).
- G3 (typecheck): `pnpm --filter web exec tsc --noEmit` ✓ 0 errors.
- G2.5 tsr generate, G4 i18n extract/compile (new UI strings pending),
  G5 vitest and G6 Playwright were NOT re-run in this session — the
  follow-up session should run them on this saved tree
  (`pnpm --filter web exec tsr generate && pnpm --filter web i18n:extract
  && pnpm --filter web i18n:compile && pnpm --filter web test:unit &&
  pnpm --filter web exec playwright test e2e/... --project=chromium --project=firefox`)
  and add `apps/web/e2e/m10-rdm7-solver-envelopes.spec.ts`.

## Next milestone

M10 Session 3 of 3: run G4-G6 on this tree, author the M10 E2E spec, and
extract/compile the Lingui catalogs for the new M10 strings.


---

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