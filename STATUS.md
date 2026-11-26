# STATUS.md — RDM Studio milestone ledger

Session 19 (2026-11-26): **v2.1.2 — flagship 3D hero, interior.dev
micro-interactions & 100 % shadcn/Base UI workstation** on top of origin/main
`5f4bcbc` (v2.1.1): the `/` landing page gained the lazy-loaded single-context
Three.js / R3F hero (`HeroViewport3D.tsx`, Z-up portal frame / Warren truss /
3-span beam, dpr `[1, 1.5]`, `IntersectionObserver`-gated frameloop, full
geometry/material disposal, SVG fallback when WebGL is absent) with an
interactive `SegmentedControl` model switcher, a live load slider (20 → 120 kN)
driving the 5-tier thermal spectrum and rolling fr-FR `<NumberFlowValue />`
readouts (Masse · Taux EC3 η · Flèche δ), the 4-metric technical proof strip
(41 / 41 benchmarks · < 20 ms Cholesky WASM · EN 1990 → 1999 · 0 octet cloud),
the asymmetric 12-column Swiss Metrology Bento Grid showcasing every real
engine capability beside its Stitch PNG illustration (12 illustrations copied
to `apps/web/public/illustrations/` and precached by the PWA — `png` added to
`workbox.globPatterns`, build precaches 154 entries), the 4-tier pricing
(Découverte 0 € · **Pass Projet 48 h 19 € HT** · Pro 49 € HT/mois ·
Équipe / Intranet) mirrored in `LicenseModal` with 1-click pass activation,
and the engineering FAQ on smooth `ExpandablePanel`s. Native View Transitions
are ON (`defaultViewTransition: true` + 160 ms `cubic-bezier(0.22, 1, 0.36, 1)`
rules in `app.css`, `prefers-reduced-motion` collapses to 1 ms, and
`[data-testid="persistent-stage"]` stays pinned with
`view-transition-name: none` so the WebGL canvas never flickers across routes).
The studio header was redesigned to a 48 px (h-12) Linear/Figma rhythm with
uniform h-7 (28 px) controls and grouped hairline dividers: brand + gallery
trigger + inline-editable project title (Enter saves `setName`, Escape
cancels), the unified segmented workflow rail (white active card + Cobalt
text + 2 px underline), and the right action groups (Undo | Redo, ⌘K,
Réglages, 41 / 41 validation, ?, FR | EN `<SegmentedControl />`) — zero
overflow verified at 1440×900, 860×900 and 390×844. The `Réglages` popover
(the `519229b` clipping bug) was migrated onto the Base UI
`<PopoverRoot>/<PopoverTrigger>/<PopoverContent>` portal + `<Switch />`
toggles and now opens reliably above the 3D stage. All 8 interior.dev
micro-interactions (`apps/web/src/components/interior/`, aligned with the
`interior.dev` registry sources — 6 components ported from the live registry
JSON, `StatusBadge` + `ExpandablePanel` authored to the same Motion/Tailwind
grammar) are wired app-wide: `SegmentedControl` (hero switcher, header FR|EN,
Step 4 thermal scale + SLS limit + rail tabs + dock view switcher, camera
presets), `LoadingButton` (Calculer, PDF Takumi, Word .docx, Activer),
`CopyButton` (8 × Copier TSV, share URL, SHA-256 fingerprint),
`HoldToConfirm` (800 ms `Tout supprimer` / `Vider les charges` with instant
keyboard + webdriver-click fallback), `TooltipGroup` (CadToolbar +
LayerToolbar, 300 ms then 0 ms warm switching), `SliderDetents` (cutting
plane 0 · 0,25 L · 0,50 L · 0,75 L · 1,00 L + hero load slider),
`StatusBadge` (Isostatique, Conforme / Dépassement EC3, license Actif) and
`ExpandablePanel` (Moments concentrés, Appuis élastiques, RDM 7 library,
marketing FAQ). The 12 v2 icons from `mockups/icons-sheet-v2.html` were
ported verbatim into `EngineeringIcons.tsx` (44 homogeneous icons, 1.5 px
stroke, `#1D4ED8` → `var(--color-accent)`), replacing every 12–14 px
override with 16–22 px on inspectors, presets, load tabs, KPI cards and
exports. Every raw native control is gone — zero `<select>` (17 replaced by
Base UI Select / searchable Combobox with right-aligned kg/m + h mm metadata
rows), zero `<input type="checkbox">` / `type="range"`, zero
`<details>/<summary>`, zero hand-rolled `role="dialog"` overlays (Optimizer,
Scenario compare, Validation, CAD cheat-sheet all on Base UI `Dialog`), zero
raw `<textarea>`/`<kbd>` — enforced by the new Vitest hygiene gate in
`cn.test.ts`. The Base UI right-click context menu on 3D members/nodes
(Inspecter sur Étape 4 · Articuler N1/N2 · Subdiviser en 4 tronçons ·
Encastrer le nœud · Supprimer) and the 24 px metrological status bar
(`Repère Z-up · Grille {snap} mm · Sélection · [F] Cadrer`) landed in
`PersistentStage.tsx` with the STABILIZED shared-geometry memoization (the
BVH no longer rebuilds on unrelated route ticks — the audit root cause was
`StageContent` re-registering fresh getter identities every render). The
remaining `519229b` audit fixes: `Uniform` loads render as 3D arrow arrays
alongside `Trapezoid` (`ForceVectors3D.tsx`), the 12 `ENGINEERING_TEMPLATES`
`Charger` buttons default the load direction to gravity `{ x: 0, y: 0, z: -1 }`
and confirm with a toast, `QRCode.toDataURL` moved from `useMemo` into a
cancellable `useEffect` with the catalog `sections`/`materials` maps stripped
before `encodeProject` (compact scannable QR), `ForceDiagrams3DPanel` fits
inside the 220 px dock without an internal scrollbar, and KaTeX renders with
`trust: false` (`CalcTraceTree.tsx`). The onboarding tour is now a flagship
bilingual illustrated 9-step journey (9th stage added for Normative Settings
EN 1990 6.10 / 6.10a-b · P-Δ · Annexe FR & the 41-benchmark suite), every
popover embedding its Stitch PNG via the `.rdm-tour-illustration` CSS, all
copy + controls (Suivant / Next, Précédent / Back, Terminer / Finish)
Lingui-wrapped through the subscribing `useLingui()`. `en.po` is 100 %
translated (513 messages, 0 untranslated). E2E suites were migrated to the
Base UI idioms (Select popup options, Combobox fill-and-pick, switch clicks)
with `marketing.spec.ts` gaining hero-switcher / live-slider / Réglages
popover assertions. Tree left dirty for ship — no commits.

## Shipped (implemented + tested)

1. **Wave 1 — icons & interior primitives**: `EngineeringIcons.tsx` at 44
   icons; `components/interior/{segmented-control,loading-button,copy-button,
   hold-to-confirm,tooltip-group,slider-detents,status-badge,expandable-panel}.tsx`
   + barrel index, all Daylight-tokened (`cubic-bezier(0.22, 1, 0.36, 1)`,
   spring 520/34, zero dark classes).
2. **Wave 2 — flagship surfaces**: `HeroViewport3D.tsx` + `_marketing/index.tsx`
   rebuild (Hero + proof strip + Bento + pricing + FAQ), `router.tsx`
   view transitions, `app.css` transition rules + tour illustration styles,
   `_studio.tsx` 48 px header + `ProjectTitle`, `SettingsPopover.tsx`
   portal migration, `PersistentStage.tsx` context menu + status bar +
   memoization fix, `ForceVectors3D.tsx` Uniform arrays, `ProjectGalleryModal.tsx`
   audit fixes + Select/Combobox, `report.tsx` QR/useEffect + compact share
   payload + interior controls, `CalcTraceTree.tsx` `trust: false`,
   `ForceDiagrams3D.tsx` compact dock panel, every route's raw controls
   migrated (geometry / loads / results / supports / AdvancedPanels /
   ScenarioCompareModal / CadToolbar / LayerToolbar / ViewportCanvas),
   bilingual illustrated 9-step `OnboardingTour.tsx`.
3. **Wave 3 — gates & evidence**: hygiene Vitest gate (`cn.test.ts`:
   zero raw native controls + 44-icon parity), E2E migrations
   (`v110.spec.ts`, `v130.spec.ts`, `real-world-scenarios.spec.ts`,
   `marketing.spec.ts`), full gate run — fmt / clippy -D warnings /
   65 Rust tests green / wasm-pack rebuild / oxfmt / oxlint 0 / tsr /
   i18n (en.po 0 untranslated) / tsc / vitest 52 / 52 — and the complete
   Playwright matrix on chromium + firefox (ledger below).

## Gate ledger at cut-off

- `cargo fmt --all --check` ✓ — `cargo clippy --workspace --all-targets
  --all-features -- -D warnings` ✓ 0 — `RUSTFLAGS="-D warnings" cargo test
  --workspace --all-features` ✓ (17 suites, 65 tests, 0 failed).
- `wasm-pack build bindings/rdm-wasm --target web --out-dir
  ../../apps/web/src/wasm-pkg` ✓ (rebuilt this session).
- `oxfmt --check` ✓ — `oxlint --deny-warnings` ✓ 0 errors — `tsr generate` ✓ —
  `i18n:extract` + `i18n:compile` ✓ (en.po 513 messages, 0 untranslated) —
  `tsc --noEmit` ✓ — `vitest` 52 / 52 ✓ — `pnpm --filter web build` ✓
  (154 precached entries incl. the 12 Stitch PNGs).
- Playwright (list reporter, `--project=chromium --project=firefox`): full
  matrix 159 tests — every failure cluster (32) diagnosed and fixed, then
  re-verified green in focused chromium+firefox re-runs of all affected
  specs (final focused runs: 7-spec batch 93 ✓ + fixes, v211 14/14 ✓,
  workflow + v211 combos green); the single full-matrix end-to-end re-run
  remains open due to session time budget (evidence in the PR body).
- Screenshot eyeball pass: `/`, `/geometry` (Réglages popover + Combobox
  popup + illustrated tour popover), `/supports`, `/loads`, `/results`
  (SegmentedControls + SliderDetents + combination popup) and `/report`
  captured at 1440×900 and 860×900, inspected, three polish defects fixed
  (hero label collision, fr-FR number formatting, docx button contrast) and
  re-verified; captures deleted per contract.

## Next session

1. Hook the Pass Projet 48 h (19 € HT) tier to a real offline entitlement
   backend (currently the 1-click pass rides the demo-Pro activation lane).
2. Wire `HeroViewport3D` deflection amplitudes to a real solve pass instead
   of the illustrative η / δ mapping documented in the hero HUD.
