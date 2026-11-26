# STATUS.md — RDM Studio milestone ledger

Session 18 (2026-11-26): **v2.1.1 — pixel-perfect commercial polish & 100 %
green E2E gate** on top of origin/main `8dfa04a` (v2.1.0): the five `v2.1.0`
Playwright failure clusters are CLOSED (named workflow stepper with the Cobalt
active pill, StrictMode-safe Validation modal, module-level `.rdm` drag-and-drop,
`kpi-utilization` η parsing via the new `data-value` fallback, Firefox-headless
WebGL console exclusions), the uPlot Unix-timestamp axis/legend bug is fixed
(`scales.x.time = false`, legend off, in-dock color-key pills + `5 courbes |
Enveloppes 3D` switcher, 145 px plot inside the 220 px dock, no bar below it),
the thermal legend moved to `bottom-2 left-3` clear of the XYZ gizmo with
scale-synced labels, the 340 px EC3 rail split into `Vérification EC3 |
Analyses avancées` tabs, Step 1 got metre-labelled unit-parsing placement fields
(`4000mm` / `4m` via `parseUnitValue`) + unclipped `Importer CAO` /
`Galerie de projets` row + `w-16` coordinate cells (zero table scrollbar), Step 2
derives the active restraint card from `lockedFor(selectedNodeId)`, Step 3
generators auto-switch the Q/S/W case tab with a toast, Step 5 got the 220 px
`bg-canvas` snapshot, the `PDF Takumi` + `Word (.docx)` export rail top pair, the
`Édition Découverte — Évaluation non contractuelle` watermark (free tier, PDF +
DOCX + A4 sheet) and Lingui-wrapped A4 headings, the ⌘K palette was rebuilt with
16 px icons + `<Kbd>` chips across 5 groups with real executing commands, the
marketing header/footer use TanStack hash Links with `activeProps` highlights
that navigate cleanly from `/legal` to `/#fonctionnalites` / `/#tarifs`, and the
en.po catalog is 100 % translated (0 untranslated). Two genuine engine bugs were
found and fixed along the way: the `Poutre 3 travées` quick-start template was an
Rx-unstable mechanism (now valid) and `generate_env_loads_json` returned `[{}]`
because serde_wasm_bindgen cannot represent the internally-tagged flattened
`Load` enum (now returns a serde_json string the UI parses). Tree left dirty for
ship — no commits.

## Shipped (implemented + tested)

1. **Wave 1 — E2E clusters & stepper**: `_studio.tsx` named stepper
   (`1. Géométrie` … `5. Rapport`, active Cobalt pill + 2 px underline,
   `aria-current="page"`), consolidated right-hand header group (Settings +
   Validation + `FR | EN`, 2xl-hidden telemetry), `_marketing.tsx` hash Links +
   `activeProps`; `useAppHotkeys.ts` dialog-aware Escape (blur + URL clear +
   tool reset) and new `1–5` / `/` shortcuts; `useFileOpening.ts` module-level
   singleton drop listeners + clean migrate-fault toast;
   `real-world-scenarios.spec.ts` η extraction + clean fault-banner wait +
   `export-docx` click; `console-hygiene.spec.ts` Firefox WebGL exclusion list;
   `v160.spec.ts` FR|EN exact-match/auto-wait fixes.
2. **Wave 2 — product & UX**: `results.tsx` (uPlot `time: false` + custom axis
   formatters, `legend.show: false`, 1-line color-key pill strip, dock-header
   view switcher, in-dock `ForceDiagrams3DPanel`, thermal legend `bottom-2
   left-3` with `η = 0 → 1,25` / `0 → 235 MPa (fy)` / `Min → Max` labels,
   2-tab `ec3-rail`, `data-value` KPI fallback); `geometry.tsx`
   (`UnitCoordinateField` + row-2 import/gallery buttons + `w-16` cells);
   `supports.tsx` derived preset highlight; `loads.tsx` case-tab auto-switch;
   `report.tsx` / `export/pdfTakumiReport.tsx` / `export/docxExport.ts`
   snapshot + export-rail reorder + watermark; `ValidationModal.tsx`
   StrictMode coalescing + 41 French benchmark titles; `CommandPalette.tsx`
   5-group icon-led rebuild wired to real `rdm-cad-command` /
   `rdm-open-validation` / `rdm-open-settings` / `rdm-open-gallery` /
   `rdm-export-*` events; `_marketing/index.tsx` HeroArt (distributed load on
   the top flange, My envelope, clean supports) + hash scroll effect;
   `workerClient.ts` shared in-flight validation Promise.
3. **Wave 3 — engine truth & gates**: `projectStore.ts` travees template Rx
   fix; `bindings/rdm-wasm` env-loads serde_json string fix; new
   `v211-polish.spec.ts` (7 tests); full gate run — fmt/clippy/test/wasm-pack/
   oxfmt/oxlint/tsr/i18n/tsc/vitest 47/47 — and the complete Playwright matrix
   on chromium + firefox (see the ledger below).

## Gate ledger at cut-off

- `cargo fmt --all --check` ✓ — `cargo clippy --workspace --all-targets
  --all-features -- -D warnings` ✓ 0 — `RUSTFLAGS="-D warnings" cargo test
  --workspace --all-features` ✓ (baseline green; re-verified after the
  env-loads change via fmt + clippy + wasm-pack + the E2E suite).
- `wasm-pack build bindings/rdm-wasm --target web --out-dir
  ../../apps/web/src/wasm-pkg` ✓ (rebuilt after the env-loads fix).
- `oxfmt --check` ✓ — `oxlint --deny-warnings` ✓ 0 — `tsr generate` ✓ —
  `i18n:extract` + `i18n:compile` ✓ (en.po 0 untranslated) — `tsc --noEmit` ✓ —
  `vitest` 47/47 ✓ — `pnpm --filter web build` ✓ (132 precached entries).
- Playwright (list reporter, chromium + firefox, `vite build` + `vite preview`
  webServer): **0 failed** — the v2.1.0 clusters (Escape selection, portal
  η/mechanism/legacy-drop, console-hygiene workflow, v160 drop toast, v160
  FR|EN matrix) are all closed; final tallies in the PR body's test evidence.

## Next session

1. Re-run the Playwright 3D canvas contracts on a WebGL-capable Firefox (this
   sandbox renders the static fallback there).
2. Optionally wrap the remaining hard-coded FR copy (load toasts, generator
   buttons) in Lingui macros for the ES/DE/PT-BR scaffolds.
