# STATUS.md — RDM Studio milestone ledger

Session 4 (2026-11-25): **M7 + M8 shipped on top of the M0–M5 base**
(origin/main `eaaa7d9`). The sandbox was recycled at session start; the
workspace was re-cloned and the toolchain rebuilt. Tree left dirty by
design; per-file history lands via `ship.toml`.

## Milestones completed this session

### M7 — Mobile responsive (§18: bottom sheet, touch controls, 100dvh) — **done**
- `BottomSheet.tsx` (§5): Motion `drag="y"` sheet with spring snap, drag
  handle, Fermer button; single DOM instance via matchMedia — inline aside
  on `lg`+, sheet below. Wired into geometry/support-adjacent loads,
  results and report inspectors.
- Header: 44px (`min-h-11`) touch targets on every stepper link; below
  `sm` the stepper collapses to icons with `aria-label` (WCAG names kept),
  brand label hidden, locale switch `shrink-0`, nav `overflow-x-auto` —
  no horizontal overflow at 390/412px (verified by an overflow probe +
  Lighthouse content-width audit).
- e2e `mobile.spec.ts`: iPhone 13 + iPad Mini emulation — sheet
  open/close (drag on chromium; button path on firefox, whose touch
  emulation cancels synthetic pointer streams), touch navigation across
  all 5 steps, 100dvh shell does not overflow the visual viewport.

### M8 — v1.0.0 release track (§18 + e1/e2/e3) — **done to environment limits**
- **e1 PDF**: `export/pdfTakumiReport.tsx` builds a typed A4 report
  (hypotheses, profiles EN 10365, ULE verification with thermal-tiered η,
  SLS L/250 deflection check per EN 1993-1-1 §7.2, G-case reactions, QR
  of the share URL) rendered to **real vector PDF bytes by `takumi-pdf`
  0.21.3 `PdfRenderer`** inside the FEA worker (§6: PDF generation runs in
  the worker; `RENDER_PDF` op + transferable buffer). The plan names
  `@pdfcn`, which is an empty `0.0.0` placeholder on npm — the document is
  a typed HTML template consumed by takumi-pdf (drift documented).
- **e2 CSV + HTML 3D**: `csvExport.ts` (semicolon CSV, UTF-8 BOM, Excel
  locale) and `standaloneHtml3d.ts` — ONE self-contained .html embedding
  the vendored three.module.js + model JSON + utilization heatmap +
  hand-rolled orbit/pan/zoom; zero network references (asserted in tests).
- **e3 multi-browser e2e**: chromium + firefox projects green (17 tests);
  webkit cannot launch in this sandbox — 8 system libraries missing and
  `playwright install-deps webkit` requires sudo. Mobile touch gestures
  run on chromium only (see above); all other specs run on both engines.
- **Deep links**: share-URL round-trip restores the encoded model on a
  fresh navigation (`?p=` → Valibot-validated store hydration).
- **Robustness fixes shipped with M8**: WebGL feature detection before
  mounting R3F (a bare `getContext()` succeeds where the renderer then
  fails on headless firefox; an R3F renderer failure escaped subtree
  boundaries and tore down the route) + `ViewportErrorBoundary` + static
  fallback view. Fonts are now bundled (Inter/JetBrains Mono TTF in
  `public/fonts`, `@font-face` in app.css, precached by the SW via
  `ttf` in globPatterns) — full offline typography for app and PDF.

## Gates verified this session (all green)
- G0: `cargo fmt` ok, clippy `-D warnings -W pedantic` 0 errors,
  non-test `.unwrap()/panic!/todo!` grep = **0**, `oxfmt --check` ok,
  `oxlint --deny-warnings` ok
- G1: `cargo test --workspace` 12/12 suites
- G2: `wasm-pack build bindings/rdm-wasm --target web` rebuilt after the
  sandbox recycle
- G2.5: route tree stable; G3 `tsc --noEmit` ok; G4 i18n 49/49 EN 100%
- G5: vitest 32/32 (incl. takumi-pdf A4 `%PDF-` pipeline test with fonts
  + QR, CSV BOM test, standalone-HTML no-network test)
- G6: Playwright 17/17 (chromium + firefox): workflow + PWA offline +
  exports + deep links + mobile viewports; **Lighthouse 9.6.8 PWA: 100**
  (re-verified after the header overflow fix)

## Explicitly NOT done (residual)
- WebKit execution (environment: missing system libs, no sudo available).
- Firefox touch-drag gesture in emulation (synthetic pointer stream
  cancelled by the engine — chromium validates the gesture; firefox
  validates sheet open/close via the button path).
- Fuzz targets (b2), `rdm-cad` DXF/STEP import, `modal.rs`,
  `section_cut.rs`, uPlot section cuts, driver.js onboarding, cmdk
  palette, box multi-select: reserved, no stubs shipped.

## Next session
1. Optional hardening: webkit run on a machine with the system libs.
2. Feature backlog above, in plan order (b2 → cad → modal).
