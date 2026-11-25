# STATUS.md — RDM Studio milestone ledger

Session 9 (2026-11-25): **v1.5.0 — impeccable `Operate`-mode UI/UX overhaul,
unified 768px split-screen workstation, 10 audit regressions closed** on top
of origin/main `374ca49` (v1.4.0). Tree left dirty by design; per-file
history lands via `ship.toml`.

## The 10 dd86689 code/layout regressions — all closed

1. **Split-screen breakpoint disaster** — `BottomSheet` used
   `(max-width: 1023px)`, forcing a mobile drawer on 800–1023px desktop
   windows. The mobile threshold is now **767px** everywhere
   (`BottomSheet`, `__root`, `app.css` input zoom); on `md+` a locked
   `100dvh` side-by-side workstation renders (320px left inspector +
   full-height viewport, zero drawers, zero tab bars).
2. **1-based reaction indexing** (`report.tsx`) — ELU reactions now index
   `reactions` by the node's 0-based array position (`nodeIndex * 6`,
   matching `Structure::dof_offset`); Σ footers report exact equilibrium.
3. **Distributed-load tie bar** (`ForceVectors3D.tsx`) — oriented along the
   member vector via `Quaternion.setFromUnitVectors((1,0,0), dir)` so
   diagonal/vertical members render aligned load bars.
4. **Selected-beam extrusion** (`BeamMeshes.tsx`) — the selection rim now
   passes `profiles` from `beamProfileLookup([beam], sectionDims)`; an
   `IPE 300` highlights its true I-section (0.12m square box only as
   fallback).
5. **Unified importer** — `openProjectOrCadFile` exported from
   `useFileOpening.ts`; the gallery modal, shell DnD and PWA
   `launchQueue` share one `.rdm/.dxf/.step/.igs` path (gallery used to
   JSON.parse-crash on CAD files).
6. **Context-aware ⌘K palette** — surfaces _Relâcher les moments N1/N2
   (⌥R)_ and _Inverser la sélection (⇧⌘I)_ while beams are selected, plus
   _Lancer le calcul (⌘Entrée)_ and _Note de calcul A4/PDF (⌘P)_.
7. **csvExport cleanup + diacritics** — dead `beamById` removed;
   "Nœuds"/"Déformée" (`LayerToolbar`), "exclusives à l'UI" (`results`),
   "compressé/validé à la relecture" (`report`).
8. **A4 report sheet** — centered `max-w-[794px]` sheet (p-8, 2-col
   metadata grid, mono tables with right-aligned numeric columns, TSV
   copy, QR + SHA-256 footer) beside a sticky 320px export rail (PDF
   Takumi / CSV Excel / HTML 3D / Imprimer).
9. **Step 4 metrology dock** — h-[220px] `grid-cols-[280px_1fr]` split:
   σvM heatmap + top/NA/bottom fiber stresses (MPa) | uPlot My/Vz/N with
   plot-over cursor, live force readouts and dashed crimson ±M_Rd
   capacity lines; consolidated top-right control bar; bottom-center
   thermal legend; 1-tap mobile PDF button.
10. **Step 1 data dock** — collapsible Nœuds/Poutres dock (h-44 expanded,
    h-9 tab bar) on TanStack `DataTable` with Base UI NumberField inline
    coordinate editing; profile legend bottom-left, nav hint
    bottom-center, 4 HUD corners non-overlapping; viewport ≥ 62% of the
    screen.

## Extra engineering caught by the visual/e2e passes

- **vaul non-modal fix (pnpm patch)** — vaul never forwarded `modal` to
  the radix dialog, so the whole shell got `aria-hidden` and focus-trapped
  while the drawer was open; the patch forwards `modal` and the tab
  bar/viewport stay interactive (the contract `modal={false}` now holds).
- **Drawer snap geometry** — vaul's fractional snaps translate a
  container-height drawer; the content is `h-[100dvh]` + internal scroll
  at `bottom-0` behind the z-40 tab bar (0.35/0.78 snaps are now exact).
- **UpdatePrompt** — workbox "controlling" fired on the FIRST install
  (clientsClaim) and force-reloaded the app mid-task; reload now happens
  only after an accepted update, and the banner moved to a discreet
  bottom-right toast (ARCHITECTURE.md §8.7) that never covers the CTA.
- **Nullish χ guards** — serde-wasm-bindgen serializes `Option::None` as
  `undefined`; the report EC3 table and results χLT badge use `== null`.
- `DesktopSplit` rewritten as the LOCKED md+ split (the percentage panels
  violated the 260–380px inspector contract at 860px); mobile branch puts
  the viewport first and the drawer trigger last.
- oxlint gate made real: the committed `oxlintrc.json` was never loaded
  (needs a leading dot) and carried an invalid `extends`; it is now an
  effective `.oxlintrc.json` (vendor three.module.js ignored), all other
  warnings fixed at the source.
- `tsr generate` wired via `@tanstack/router-cli@1.99.9` + `tsr.config.json`
  (routeTree.gen.ts verified byte-identical after generation).

## Gates (G0 → G6)

- G0: `cargo fmt --check` ✓; clippy `-D warnings` ✓ (untouched Rust);
  oxfmt ✓; oxlint `--deny-warnings` **0 warnings / 0 errors**.
- G1: `RUSTFLAGS="-D warnings" cargo test --workspace --all-features` ✓
  (exit 0).
- G2: `wasm-pack build bindings/rdm-wasm --target web --out-dir
  ../../apps/web/src/wasm-pkg` ✓.
- G2.5–G5: `tsr generate` ✓ (no diff); `i18n:extract` 101/101 EN ✓;
  `i18n:compile` ✓; `tsc --noEmit` ✓; vitest **32/32** ✓.
- G6: Playwright **68 passed / 1 skipped / 0 failed** (chromium + firefox;
  the skip is the firefox-headless WebGL fallback guarded per AGENTS.md;
  webkit `testIgnore` per the rootless-sandbox guardrail), including the
  new `layout-craft.spec.ts` geometry suite (bounding-box asserts at
  1440×900, 860×900, 390×844 on all 5 routes).
- Visual proof pass: contact sheets inspected at 860×900 / 1440×900 /
  390×844 across the 5 routes; `document.body.scrollHeight` never exceeds
  `innerHeight + 1`; all 4 HUD corners non-overlapping.

## Explicitly NOT done (residual)

- Firefox headless renders the static WebGL fallback in this sandbox (no
  GPU/Mesa); the 3D HUD is exercised on chromium.
- WebKit e2e remains sandbox-blocked (no sudo for system libs).
- `cargo clippy/test` re-ran green but Rust sources are untouched in this
  session.

## Next session
1. Software-GL probe for firefox (LIBGL_ALWAYS_SOFTWARE) to lift the skip.
2. Reintroduce optional drag-resize within the 260–380px inspector band if
   ever requested (current contract is locked 320px).
3. WebKit on a provisioned machine.
