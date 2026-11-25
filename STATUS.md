# STATUS.md — RDM Studio milestone ledger

Session 6 (2026-11-25): **v1.1.0 metrology fidelity + v1.2
micro-interactions + 9-bug closure** on top of origin/main `d541fda`
(which carries the committed v1.0.0 work). Tree left dirty by design;
per-file history lands via `ship.toml`.

## The 9 audit bugs — all fixed

1. **`import_dxf` beam IDs** — dense sequential 1-based ids via
   `.enumerate()` (the `n1.max(n2)` scheme collided and dropped members);
   logic factored into a pure `import_dxf_structure` helper with a Rust
   unit test asserting `[1, 2]` on a two-beam ASCII DXF.
2. **`modal.rs` debug block** — the duplicated `RDM_MODAL_DEBUG`
   instrumentation (leftover from the v1.0.0 debugging) removed; block
   deleted twice, verified absent.
3. **Step 4 profile extrusion** — `sectionDims` added to the
   `BeamMeshes` `useMemo` deps; `selectedGeometry` now extrudes the true
   catalog profile instead of the hardcoded `0.12 m` square box;
   `results.tsx` fetches `sectionDims` and passes them into
   `<BeamMeshes>`.
4. **PWA manifest colors** — `theme_color: #1D4ED8`,
   `background_color: #F8FAFC` (DESIGN.md §2).
5. **Logo SVG** — `/logo-rdm-studio.svg` renders in the header brand and
   the Step 5 A4 sheet header (replacing `<IconFrame />`).
6. **Diacritics** — `LayerToolbar` "Nœuds", results "Déformée &
   exploitation", "Résultats de calcul", "exclusives à l'UI".
7. **`csvExport.ts`** — the maintainer-reintroduced unused `beamById`
   removed again.
8. **Playwright** — `reuseExistingServer: !process.env.CI`.
9. **Store actions** — `addBeamSpanLoad` (Trapezoid uniform/trapezoidal +
   PointOnSpan with `position_ratio`) and `batchUpdateBeams(ids, patch)`
   (multi-select editor).

## shadcn/ui + icons + workspaces (Section 3)

- **9 primitives** in `components/ui/` (`button`, `select`, `dialog`,
  `tabs`, `switch`, `slider`, `tooltip`, `table`, `badge`) over Radix +
  CVA, styled strictly from the DESIGN.md tokens (cobalt accent, 4px
  control radius, 1px hairlines, zero docked-panel shadows); `Button`/
  `Badge`/`Switch` in use across Steps 2–3.
- **EngineeringIcons wiring** — `ProfileIpe` on the Step 1 profile label,
  support presets (`SupportFixed/Pinned/Roller/Slider/Spring`) in Step 2,
  load icons (`NodalPointLoad/UniformBeamLoad/TrapezoidalLoad/
  SpanPointLoad/SelfWeightGravity`) in Step 3, and
  `SectionCut/DeflectionLimit/ModalVibration` on the Step 4 KPIs +
  `FlexuralBuckling/LateralTorsionalBuckling/ModalVibration` on the Step 5
  table headers.
- **Step 2** — 320px left inspector with 1-click RDM 7 presets
  (Encastrement/Rotule/Appui simple/Glissière), the 2×3 DOF matrix, the
  active supports list and the live kinematic badge
  (Isostatique/Hyperstatique/Hypostatique by the 6-reaction rule), beside
  the 3D viewport with `<SupportMarkers/>` + snap overlay.
- **Step 3** — 320px left inspector with `G | Q | W | Acc` case tabs
  (layoutId glider), self-weight Switch (1g −Z), load-type tabs
  (Nodale/Uniforme/Trapézoïdale/Ponctuelle a/L) writing through
  `addBeamSpanLoad`, live ΣFx/ΣFy/ΣFz resultants (rolling digits) and the
  cobalt CTA `Lancer le calcul 3D & Eurocode 3`; `ForceVectors3D` now
  renders crimson distributed arrow arrays with a top bar + point-on-span
  arrows.
- **Step 4** — 4 KPI cards on `@number-flow/react` (Masse totale,
  Flèche max ELS, Taux max EC3 with pass/fail badge + governing failure
  diagnostic banner + 1-click corrective upgrade with mass-delta
  `Masse : +X,X kg · Taux : …%` toast + 5 s `Annuler (⌘Z)`, 1er mode
  propre); combination/eigenmode selector (`ELU 1.35G + 1.50Q`, `ELS
  1.00G + 1.00Q`, `Mode propre 1..3`) with harmonic play/pause and the
  amplification slider (×1–30); docked bottom inspector with the σ_vM
  heatmap and `My,Ed` / `Vz,Ed` / `N,Ed` uPlot diagrams plus the
  synchronized Cobalt 3D cutting plane and chart cursor (`x ∈ [0, L]`).
- **Step 5** — A4 sheet with the logo SVG, QR, 5 tables (Nœuds, Profils
  utilisés, Vérification ELU, Flèches ELS, **Modes propres**) each with
  `Copier pour Excel` TSV, print stylesheet, PDF/HTML-3D/CSV/URL exports.
- **Step 1** — material select (Acier S235JR/S355J2, Inox 304L, Alu
  6061-T6) writing through `updateBeam`, Shift+Click multi-select batch
  editor (`batchUpdateBeams`), and the 3-button empty-state hub
  (`+ Placer un premier nœud`, `Charger un modèle type` → gallery,
  `Importer DXF`).

## The 7 micro-interactions (DESIGN.md §8) — all in

1. `<MotionConfig reducedMotion="user">` wraps the router in `main.tsx`.
2. `@number-flow/react` rolling tabular digits on the 4 KPI cards and the
   Step 3 resultants (format memoized + font-gated so headless never
   races the custom-element mount).
3. Critically damped `CameraControls` glides (`smoothTime 0.25`) for the
   presets and `F` (zoom extents) / `I` (iso) shortcuts — replaces the
   hard `camera.position.set` jumps.
4. 3D snap reticle (`SnapOverlay`: Cobalt ring on nodes, Cyan triangle on
   midpoints, dashed orthogonal guides on Shift, `navigator.vibrate(8)`
   tick) + floating cursor pill (`B-14 · IPE 200 · L = 4,00 m`).
5. Synchronized Cobalt 3D cutting plane + uPlot vertical cursor on the
   shared `x ∈ [0, L]` scrubber.
6. Shared-element `layoutId` gliding indicators: the 5-step header
   underline (v1.0.0) and the Step 3 case tabs.
7. Hold-`Alt` JetBrains Mono keycap hints (`[I]`/`[X]`/`[Y]`/`[Z]` on the
   view presets, `[⌘K]` on the palette).

## Mandatory verification tests (Section 5) — green

- Rust: `import_dxf_assigns_sequential_distinct_beam_ids` + garbage
  rejection (rdm-wasm suite, 87/87 total).
- `e2e/v110.spec.ts`: (b) `/supports` mounts `[data-testid=
  "viewport-canvas"]` + the four RDM 7 presets + kinematic badge flip;
  `/loads` mounts the viewport + the distributed load tabs + a real
  uniform load row + ΣFz resultants + CTA navigation; (c) `/results`
  renders the 4 KPI cards, the mode selector with the play toggle and the
  docked inspector with the cursor.

## Gates (G0 → G6) — all green

- G0: `cargo fmt --check` ✓, clippy `-D warnings` 0, `oxfmt --check` ✓,
  `oxlint --deny-warnings` ✓.
- G1: `cargo test --workspace --all-features` **87 passed / 0 failed**
  (RUSTFLAGS `-D warnings`).
- G2: wasm-pack rebuilt after the `import_dxf` fix.
- G3: `tsr generate` ✓; `tsc --noEmit` ✓; G4: i18n extract + compile,
  EN **74/74** (100%).
- G5: vitest **32/32**.
- G6: Playwright **23/23** chromium + firefox (incl. the new v110 suite;
  legacy specs updated for the renamed Step 3/4 headings).

## Notable bug found & fixed by the new tests

- `RuntimeBridge`'s inline `onReady` arrow re-triggered its effect every
  render → infinite re-render loop that pegged the main thread on every
  viewport route (clicks starved). Fixed with a stable `useCallback`;
  the v110 e2e suite caught it immediately.

## Explicitly NOT done (residual, environmental)

- WebKit e2e remains sandbox-blocked (missing system libs, no sudo).
- Firefox touch-drag emulation keeps the chromium-validated gesture path.
- `Radix Tabs` primitives exist but Step 3 uses the custom layoutId tab
  list (spec §8.6) — `tabs.tsx` stays available for future surfaces.
- `.agents/`, `skills-lock.json`, Playwright artifacts stay untracked.

## Next session
1. Webkit run on a provisioned machine.
2. Snap reticle axis locks `[X]/[Y]/[Z]` could drive real placement
   constraints (currently visual guides).
