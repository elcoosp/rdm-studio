# STATUS.md — RDM Studio milestone ledger

Session 8 (2026-11-25): **v1.4.0 — Base UI foundation, flagship onboarding,
SHA-256 fingerprint, 12 audit/live regressions closed** on top of
origin/main `42bf477` (which carries the committed v1.3.0 work). Tree left
dirty by design; per-file history lands via `ship.toml`.

## UI foundation: Base UI + 24-component workstation suite

- `@base-ui/react@1.9` replaces every `@radix-ui/*` (removed from
  package.json): `dialog`, `select`, `slider`, `switch`, `tabs`,
  `tooltip` migrated; new `button` is radix-slot-free.
- New suite in `apps/web/src/components/ui/`: `combobox` (searchable EN
  10365 catalog with SVG icons, `items` render-function), `number-field`
  (steppers), `resizable` (pinned v3 panels + `DesktopSplit`), `drawer`
  (Vaul), `dropdown-menu`, `popover`, `accordion`, `collapsible`,
  `alert`, `card`, `progress` (`UtilizationProgress` tiered fills),
  `separator`, `scroll-area`, `kbd`, `data-table` (TanStack v8,
  `tabular-nums`, Shift+Click rows), `toggle-group`, `checkbox`,
  `input`, `textarea`, `label`. All styled strictly with the DESIGN.md
  Daylight Swiss tokens (4px controls, 8px overlays, hairlines, cobalt).
- `@tanstack/react-table` pinned to v8 (v9 removed `useReactTable`);
  `react-resizable-panels` pinned to v3 (v4 is a docking framework).
- `ProfileDims` accepts catalog `null` dims (precedent `1025bd8`).

## Keyboard layer + onboarding

- `hooks/useAppHotkeys.ts` (react-hotkeys-hook): `mod+k` palette,
  `mod+z` / `mod+shift+z` undo-redo (header ↩/↪ buttons),
  `mod+enter` → /results, `mod+p` → /report, `v`/`n`/`b`/`escape` tool
  modes (now shared via `viewportStore.toolMode`), `f`/`i` camera events
  (gated on `viewportMounted`), `shift+mod+i` invert selection, `alt+r`
  end-release toggle, `delete`/`backspace` removal. All ad-hoc keydown
  listeners removed from CommandPalette, geometry and ViewportCanvas.
- `OnboardingTour.tsx`: 8-stage driver.js tour navigating all 5 routes
  (`onNextClick` → `router.navigate` + 150 ms settle), custom-styled in
  `app-tour.css` (white popover, cobalt CTA, `1 / 8` mono counter, 350 ms
  stage highlight, Passer/Précédent/Suivant/Commencer), auto-launch once
  via `rdm-tour-done`, skipped for `?p=` deep links and `navigator.webdriver`,
  re-launchable from the header `?`.

## WASM: full EC3 detail + fingerprint

- `BeamCombinationResult` += `checks` (every ratio at the governing
  station), `class_index` (via new `Classification::as_u8`), `chi_y`,
  `chi_z`, `chi_lt`, `m_rd` (Mb,Rd under LTB else Mel,Rd).
- `project_fingerprint` wasm export (pure `project_fingerprint_structure`
  helper) over `ProjectFile::fingerprint()` — canonical SHA-256; exposed
  through the worker (`FINGERPRINT` request) and
  `feaClient.projectFingerprint`; rendered as the Step 5 sheet footer.

## The 12 audit/live regressions — all closed

1. Dead empty-state "Importer DXF" (fileRef) → live "Importer CAO".
2. Distributed `Trapezoid` (5-arrow array + tie bar) and `PointOnSpan`
   loads render as crimson 3D arrows; hooks stay unconditional.
3. `uplot-cursor` anchored via `plot.valToPos + bbox.left/dpr`; the plot
   surface scrubs the station on pointer-down/move.
4. `SnapOverlay` re-binds pointer listeners from a reactive
   `runtimeReady` counter (WebGL init + resize).
5. `BeamMeshes`: `sectionDims` in both geometry memos; selected beam
   tinted `#2563EB` cobalt body + `#1D4ED8` edges.
6. Canonical serialization: all six `updatedAt` injections removed from
   `projectStore`; manifest `theme_color #1D4ED8` / `background_color
   #F8FAFC`; `reuseExistingServer: !process.env.CI`.
7. Step 1 inspector docks LEFT (`lg:flex-row-reverse`).
8. Camera auto-reframe only on mount + project/template change (no more
   re-fit per node edit).
9. Node markers are real 3D spheres (r = 0.055 m, cobalt when selected,
   keyed by `nodeIds`), profile Combobox applies immediately to the
   selected beam, and the double-plus "+ Nœud" label is fixed.
10. Drag-and-drop of `.rdm` / `.dxf` / `.step` / `.igs` onto the shell
    (`useFileOpening` with drop affordance) + PWA `launchQueue` consumer.
11. `vercel.json` at repo root: SPA rewrite, `application/wasm` headers,
    `no-cache` on `/sw.js`.
12. Header undo aria-labels de-duplicated from toast "Annuler" (strict
    locator collision caught by the v130 suite).

## Mockup parity (16 screens)

- Step 1: quick-start pills (Treillis Warren 24 m, Portique 18 m,
  Potence HEA 200, Poutre 3 travées) from new `quickStartProject`
  parametric templates; gallery metadata cards (node/beam counts, span,
  height, standard tags), "+ Nouveau projet vierge" and a direct import
  picker; batch inspector ΣL / Σm totals.
- Step 2: selected node `(X, Y, Z)` coordinates + free/locked DOF count.
- Step 3: estimated self-weight mass beside the 1g toggle + equilibrium
  status pill (Système équilibré / Appuis incomplets).
- Step 4: 4-clause EC3 breakdown card (`checks` + `UtilizationProgress`
  bars + Classe/χy/χz/χLT badges) with the "Maintien latéral mi-travée
  (kz = 0,5)" mitigation CTA.
- Step 5: Fréquences propres (f + T), Réactions ELU with Σ footer,
  Vérification Eurocode 3 (σvM, χy, χz, χLT, η, statut), Déplacements
  extrêmes ELS and the existing Nœuds/Profils/ELU/ELS tables — all with
  TSV copy — plus the SHA-256 fingerprint footer.

## Gates (G0 → G6) — all green

- G0: `cargo fmt --check` ✓; clippy `-D warnings` **0** (collapsed
  if-lets, `map_or`, `Path::extension`); oxfmt ✓; oxlint ✓.
- G1: `cargo test --workspace --all-features` **94 passed / 0 failed**
  (new: full EC3 detail + 64-hex fingerprint).
- G2: wasm-pack rebuilt with the new exports.
- G3: `tsr generate` ✓; `tsc --noEmit` ✓; G4: i18n 89/89 EN.
- G5: vitest **32/32** (fixtures extended for checks/χ/m_rd).
- G6: Playwright **34/34** chromium + firefox across 6 suites incl. the
  new `v140`: Combobox search+apply, tour cross-route stepping, gallery
  blank-project + quick pills, Step 5 Σ reactions + SHA-256 fingerprint,
  EC3 breakdown visibility.

## Notable engineering caught by the new tests

- The Sonner undo toasts and the new header undo button collided on the
  accessible name "Annuler" — Playwright strict mode surfaced it; the
  header uses "Annuler la dernière action" and tests scope to the toast.
- Base UI Combobox requires `items` + a render-function list for the
  filter to engage; the plain-JSX variant listed all 144 profiles.

## Explicitly NOT done (residual)

- WebKit e2e remains sandbox-blocked (no sudo for system libs).
- `NumberField` steppers are wired into the component suite but not yet
  swapped into every numeric table cell (NodeTable keeps inline inputs
  at 16px iOS-safe sizing).
- uPlot dashed ±M_Rd capacity lines land with the next cursor pass; the
  My/Vz/N readouts and the EC3 card already expose the values.

## Next session
1. Swap NodeTable coordinate cells to `NumberField`.
2. uPlot capacity lines + cross-route undo stack surfacing.
3. WebKit on a provisioned machine.
