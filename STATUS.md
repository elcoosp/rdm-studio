# STATUS.md — RDM Studio milestone ledger

Session 5 (2026-11-25): **v1.0.0 COMPLETE — final UI/UX fidelity overhaul,
10-bug fix, remaining engines** on top of origin/main `c5ae8fa` (which
landed the session-4 M7/M8 ships). Tree left dirty by design; per-file
history lands via `ship.toml`.

## The 10 audit bugs — all fixed

1. **3D giant RGB blocks at (0,0,0)** — `<GizmoViewport/>` now renders
   inside `<GizmoHelper alignment="top-right" margin={[72,72]}>`
   (`ViewportCanvas.tsx`): corner HUD triad, no 1 m scene cube.
2. **Real extruded profiles + auto-framed camera** — `ProfileShapes.ts`
   builds true I/U/CHS/RHS/L outlines from catalog `h/b/tw/tf`;
   `BeamMeshes.tsx` extrudes them (caps via `ShapeUtils.triangulateShape`,
   side walls, holes); square-box path kept as benchmark fallback.
   `catalog_section_shapes()` export feeds the dims. `FitCamera` frames
   the model bounding box on mount/model change. Viewport embedded on
   steps 1–4.
3. **EC3 governing-section check** — `member_check` now evaluates span
   stations `[0, 0.25, 0.5, 0.75, 1.0]` with simply-supported superposition
   of span loads (`internal_forces.rs`: point `PL·a(1-b)`, trapezoid
   closed-form that closes exactly at a=0/1, verified by unit tests
   `qL²/8`, `PL/4`, linear end-moment interpolation). Governing max
   utilization reported per beam per combination.
4. **Deep-link `?p=` hydration** — `main.tsx` parses the share payload
   BEFORE first render and hydrates the store (Valibot-validated), so
   `/report?p=…` restores arbitrary non-demo models (e2e covers it).
5. **Step 1 beam creation** — explicit N1 → N2 selects + "Relier N1 → N2"
   button replace the hardcoded demo pair; `updateBeam` store action added.
6. **UpdatePrompt + clean SW registration** — mounted inside `RootLayout`;
   `injectRegister: null` so `workbox-window` owns `/sw.js`.
7. **results.tsx** — heading `Déplacements nodaux (Q)` now matches the
   displayed case; dead `formatKn(0) === "0.0 kN" ? "" : ""` removed
   (replaced with a real node/beam count line).
8. **ULE → ELU + csvExport cleanup** — terminology fixed across
   `csvExport.ts`, `pdfTakumiReport.tsx`, `standaloneHtml3d.ts`,
   `exports.spec.ts`, routes and locales; unused `beamById` removed;
   CSV filename gets an accent-preserving slug (`Poutre démo` →
   `Poutre_demo-résultats.csv`).
9. **Palette, diacritics, kickers** — all `#0891B2`/`#F9FAFB`/`#2563EB`
   tier-1 replaced with `#1D4ED8` Deep Cobalt / `#F8FAFC` canvas
   (DESIGN.md §2; spectrum tier-1/5 now `#1D4ED8`/`#DC2626`, enforced by
   unit test); French diacritics fixed everywhere (`Nœuds`, `Déformée`,
   `Résultats`, `Modèle`, `Profils utilisés`…); every
   `uppercase tracking-wide` kicker removed (craft-floor ban).
10. **Auto-reactive solving** — results re-solve 150 ms after any
    geometry/support/load/profile mutation (debounced trailing edge);
    Results never shows stale calculations.

## Remaining engines — all implemented

- **`crates/rdm-solver/src/modal.rs`** — consistent-mass 12-DOF frame
  element (translations ρAL/420, couplings ρAIL²/420, rotary ρAIL³/420)
  + M-orthogonal deflated inverse-iteration eigensolver. Verified against
  the analytical Euler-Bernoulli cantilever: weak-axis first mode and
  strong-axis second mode within the documented 2-element discretization
  brackets, ascending frequencies. Exposed via `modal_analysis()` wasm
  export → Step 4 KPI 4.
- **`crates/rdm-solver/src/section_cut.rs`** — `superimposed_beam_state`
  + n-point `beam_forces_at` + `von_mises_grid` (axial + bi-axial bending
  exact on the outline, thin-wall shear estimate documented); wasm
  `section_stress_grid()` → Step 4 heatmap; `beam_span_forces()` →
  synchronized uPlot My/Vz/N diagrams with the x ∈ [0, L] slider.
- **`crates/rdm-cad/`** — `dxf = "0.6.2"` in the workspace; DXF `LINE` /
  `LWPOLYLINE` / `POLYLINE` extraction (`dxf_importer.rs`, tested against
  a real ASCII DXF fixture), coincident-node merging within ε via
  quantized neighbour-cell hashing and T/X intersection splitting
  (`topology_cleaner.rs`); wasm `import_dxf()` → Step 1 CAD import modal
  (file input → worker → fresh `.rdm` with IPE 200/S235JR defaults).

## UI/UX fidelity (DESIGN.md v1.0.0 + mockups + impeccable craft)

- **Navigation spine** — 44px header: logo link + project switcher
  (`RDM Studio / <name> ▾` opening `ProjectGalleryModal`: idb-keyval
  saves + 4 parametric templates: Treillis Warren 24 m, Portique
  industriel, Potence encastrée, Poutre continue), 5-step tabs with
  `2px #1D4ED8` active underline (desktop only — mobile gets the
  thumb-friendly bottom tab bar, per the mobile mockups), node/beam
  counter, ⌘K button, FR | EN toggle, offline pill, `?` driver.js tour.
  No duplicate sidebar, no clipped avatars, no FPS bars.
- **Step 1** — EN 10365 inspector row (A, Iy, Iz, It, Iw, Wel,y, Wpl,y,
  Masse from the worker catalog), roll angle θx, N1/N2 end-release
  checkboxes [Ux..Rz], ky/kz buckling lengths, inline X/Y/Z node coords,
  N1→N2 connector, DXF import + welcoming empty state at 0 nodes.
- **Step 2/3** — RDM 7 presets, 6-DOF checkboxes, isostatic status bar;
  EN 1990 case tabs, self-weight toggle, nodal + span loads, crimson
  force arrows, primary cobalt CTA.
- **Step 4** — 4-KPI strip (Masse totale from ρ·A·L, Flèche max ELS,
  Taux max EC3 with pass/fail badge + 1-click corrective profile upgrade
  + 5 s sonner undo toast, 1er mode propre), amplification slider ×1–30,
  calibrated 0→η 1.25 scale bar, docked bottom inspector: σ_vM SVG
  heatmap + uPlot diagrams + station slider.
- **Step 5** — centered A4 sheet (print stylesheet), date line, 4 tables
  (Nœuds, Profils utilisés, Vérification ELU, Flèches ELS) each with
  1-click `Copier pour Excel` (TSV), PDF/HTML-3D/CSV/URL exports.
- **32 engineering icons** ported verbatim from `mockups/icons-sheet.html`
  into `components/icons/EngineeringIcons.tsx` (24×24, 1.5px stroke,
  token-bound accents).
- **Tokens** — cobalt palette, 4px control radius, 1px `#E2E8F0`
  hairlines, zero drop shadows on docked panels; text selection, focus
  rings and scrollbars themed from the palette (craft floor); 16px inputs
  under `lg` (iOS auto-zoom guard); `@media print` stylesheet.
- **cmdk palette** (⌘K), **driver.js** onboarding (FR labels), full
  Lingui catalogs: 61/61 EN strings translated (0 missing).

## Gates verified this session (all green)

- G0: `cargo fmt --all --check` ok; `cargo clippy --workspace
  --all-targets --all-features -- -D warnings` = 0; `oxfmt --check` ok;
  `oxlint --deny-warnings` ok.
- G1: `cargo test --workspace --all-features` **85 passed / 0 failed**
  (was 12 suites pre-v1.0.0 — +modal, +internal-forces, +cad, +section
  suites; RUSTFLAGS `-D warnings`).
- G2: `wasm-pack build bindings/rdm-wasm --target web` rebuilt after
  every Rust change; `uuid` wasm32 js-feature unification added for the
  `dxf` dependency tree.
- G3: `tsc --noEmit` ok; G4: i18n extract + compile, EN 61/61 = 100%.
- G5: vitest **32/32** (spectrum tiers re-pinned to the v1.0.0 tokens,
  exact-endpoint stop colors).
- G6: Playwright **16/16 chromium + firefox** (workflow, PWA offline,
  exports incl. accent-preserving CSV filename, deep links, mobile
  viewports + touch).

## Explicitly NOT done (residual, environmental only)

- WebKit execution: 8 system libraries missing in the sandbox and
  `playwright install-deps webkit` requires sudo (no root). Chromium +
  firefox validate the suite; webkit runs are expected green on a
  provisioned machine.
- Firefox touch-drag gesture in emulation (synthetic pointer stream
  cancelled by the engine — chromium validates the gesture; firefox
  validates sheet open/close via the button path).
- Fuzz targets (b2) remain reserved (no stubs shipped); consistent/lumped
  mass-matrix switch defaults to consistent only.
- `ship.toml` ships one file per commit in dependency order; `.agents/`
  + `skills-lock.json` (impeccable skill install) and `test-results/`
  stay untracked, out of the delivery.

## Next session
1. Webkit run on a provisioned machine (only environmental residual).
2. Optional hardening: lumped-mass option, fuzz targets (b2), STEP import.
