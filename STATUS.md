# STATUS.md — RDM Studio milestone ledger

Session 3 (2026-11-25): **M4 + M5 shipped on top of the M0–M3 base** now
committed on origin/main (`6074db3`). Tree left dirty by design; per-file
history lands via `ship.toml`.

## Milestones completed

### M0 — CI green / M1 — Rust core / M2 — WASM / M3 — routing — **done** (origin/main)
Committed in sessions 1–2: workspace + catalogs (144 profiles, EN
1990/1993), faer LLᵀ solver + benchmarks, rdm-wasm + worker, TanStack
routing, Lingui fr/en, zustand store, vertical-slice pages.

### M4 — Interactive 3D viewport (§18, criterion: selection < 0.2 ms @ 10k) — **done**
- `apps/web/src/viewport3d/` per §5: `ViewportCanvas.tsx` (Z-up scene,
  infinite metric grid, XYZ gizmo, view presets 3D Iso / Dessus XY / Face
  XZ / Côté YZ, CAD orbit + touch), `BeamMeshes.tsx` (merged volumetric
  geometry with `beamId` vertex attribute + §17 thermal vertex colors),
  `SupportMarkers.tsx` (RDM 7 symbols from the 6-DOF pattern),
  `ForceVectors3D.tsx`, `SnapGrid.tsx` (10/50/100 mm + node > midpoint >
  grid ordering + Shift orthogonal lock), `LayerToolbar.tsx` (layer
  visibility + volumetric/wireframe + live pick-latency readout),
  `useBvhPicking.ts` (three-mesh-bvh accelerated raycast + measured
  wall-clock selection).
- Picking design: all beams merge into ONE BufferGeometry carrying a
  `beamId` attribute → a single accelerated raycast resolves the member;
  validated in vitest (node, no renderer needed): **median selection
  < 0.2 ms over 200 rays on 10,000 beams** (M4 criterion).
- `/geometry`: side-by-side viewport + inspector (DESIGN.md desktop
  layout); `/results`: deformed-shape viewport (SLS 1.00G+1.00Q
  superposition, auto exaggeration) with ULS-utilization thermal colors
  and the η legend. Thermal spectrum strictly quarantined to 3D fields.
- `viewportStore.ts` (zustand): layers, render mode, camera preset.
- Tests: spectrum/snap/geometry unit tests + the BVH benchmark; e2e
  covers canvas, layer toolbar, view presets, FEA legend.

### M5 — PWA installable (§18, criterion: Lighthouse PWA ≥ 95 + offline) — **done**
- `UpdatePrompt.tsx` (§5 components): workbox-window registration of
  `/sw.js`, "waiting" → discreet reload toast (§8.7 update flow).
- Manifest icons: generated `icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png` (safe-zone) from the logo design; wired into the
  §19.1 manifest (the plan's config omitted icons, which Chrome
  installability requires — extension documented in the PR body).
- **Lighthouse 9.6.8 PWA audit: 100/100** (installable-manifest,
  service-worker, splash-screen, maskable-icon, viewport, ... all 1).
  Lighthouse 13 removed the PWA category; 9.6.8 is the last auditing
  version (run via `pnpm dlx`, CHROME_PATH → Playwright chromium).
- **Offline verified in Playwright e2e** (`pwa-offline.spec.ts`, against
  the production build via `vite preview`): SW installs/activates, then
  `context.setOffline(true)` + reload still serves the precached app
  shell and renders the loads page. `serviceWorkers: "allow"` is set in
  the Playwright config (blocked by default).

## Gates verified this session (all green)
- G0: `cargo fmt --all --check` ok, clippy `-D warnings -W pedantic` 0
  errors, lint-attr grep 0, `oxfmt --check` ok, `oxlint --deny-warnings` ok
- G1: `cargo test --workspace` 12/12 suites (also under
  `RUSTFLAGS="-D warnings"`)
- G2: wasm-pkg built (`wasm-pack --target web`)
- G2.5: route tree stable (`tsr generate` no-op diff), G3 `tsc --noEmit` ok
- G4: i18n extract 42 msgs / EN 100% / compile ok
- G5: vitest 29/29 (incl. M4 BVH benchmark)
- G6: Playwright 3/3 (workflow + SW activation + offline reload),
  production-build webServer

## Explicitly NOT done (next milestones)
- M7 mobile bottom sheet + touch targets (100dvh already used).
- M6 de facto done (42/42 messages translated, in-place switch).
- M8 release: multi-browser e2e (Firefox/Safari), deep-link sweep, PDF/CSV
  exports (e1/e2), fuzz targets (b2), `rdm-cad`, `modal.rs`, `section_cut.rs`.

## Next session
1. M7: BottomSheet.tsx (Motion drag="y"), 44px touch targets, mobile e2e.
2. M8: PDF/HTML/CSV exports (pdfTakumiReport, standaloneHtml3d), then
   release checklist.
