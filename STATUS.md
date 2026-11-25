# STATUS.md — RDM Studio milestone ledger

Session 7 (2026-11-25): **v1.3.0 — RDM 7 Studio workstation parity,
brand emblem, 6 live-browser defect closures** on top of origin/main
`c4ada27` (which carries the committed v1.1.0/v1.2.0 work). Tree left
dirty by design; per-file history lands via `ship.toml`.

## Brand emblem

- `docs/logo-idea.svg` (official mark) copied to
  `apps/web/public/logo-rdm-studio.svg` (valid `xmlns`), also mirrored to
  `docs/logo-rdm-studio.svg`.
- `icon-192.png`, `icon-512.png` regenerated from the official 1600px
  raster; `icon-maskable-512.png` rebuilt with the 80% W3C safe zone
  (`scripts/regen_pwa_icons.py`, PIL/Lanczos).
- Header (`__root.tsx`), Step 5 A4 sheet (`report.tsx`) and
  `ProjectGalleryModal` all render `/logo-rdm-studio.svg`.

## The 6 live-browser defects — all closed

1. **Duplicate beams & orphan nodes (Step 1)** — "Relier N1 → N2" flips
   to a disabled "Déjà reliés" for an existing (unordered) pair; the
   connector auto-defaults to the last two *unlinked* nodes; explicit
   user picks are sticky (`userN1/userN2` refs) so the auto-default never
   overrides a person examining a pair; `+ Nœud` walks `maxX + 2.0 m`
   past the last point.
2. **Reactive resize navigation** — a live `matchMedia("(max-width:
   767px)")` hook (`useSyncExternalStore`) swaps the mobile bottom tab
   bar and the `md:flex` top step bar dynamically; split-screen 768–1023
   keeps the horizontal bar. Mobile `BottomSheet` sits at `bottom-14`
   (56 px) above the tab bar so "Fermer" is never obscured.
3. **3-zone balanced header** — left: emblem + `RDM Studio` + `▾` gallery
   + project name; center: `Étape 1..5` (`mx-auto`); right (`ml-auto`):
   node/beam counter, `⌘K` + keycap, OfflinePill, `?`, and the active
   locale pill (`FR`/`EN` with cobalt fill + ring on the active locale,
   driven by a `rdm-locale-change` window event).
4. **Gizmo** — `<GizmoHelper alignment="bottom-right" margin={[88, 88]}>`
   so the top-right `3D Iso | Dessus XY | Face XZ | Côté YZ` preset bar is
   100% unobstructed.
5. **Sonner host** — `<Toaster>` moved from /results to the root layout:
   the undo/what-if toasts (Step 1 import, Step 2 clear, Step 3 clear,
   Step 4 upgrade) render on every step.
6. **Strict-mode-safe telemetry** — number-flow stays memoized +
   font-gated; no new mount-time render loops (v1.2 lesson retained).

## RDM 7 workstation parity

- **Step 1** — segmented tool-mode bar (`Sélection [V]` · `+ Nœud [N]` ·
  `Relier [B]`, real keyboard shortcuts), bidirectional hover highlight
  (`#93C5FD` beam edges / cobalt node markers between tables and 3D),
  `CadImportDialog` for `.dxf/.step/.stp/.igs/.iges` with the
  "Encastrer le nœud le plus à gauche" option and an undoable import
  (project snapshot + `Annuler` toast), "Suivant : Définir les liaisons →".
- **Step 2** — 4 primary quick cards + grouped 12-preset RDM 7 library
  (Appuis simples XY/XZ/YZ, Glissants X/Y/Z, Glissières X/Y/Z, Pivots
  X/Y/Z) synced with the 2×3 DOF matrix, 3D node click-to-restrain
  (`NodeMarkers` gained `onPickNode`), undoable "Tout supprimer",
  "Suivant : Définir les charges →".
- **Step 3** — quick scenarios (`Poids propre seul 1g −Z`, `Transport
  0,8g X / 1,5g −Z`), custom `(ax, ay, az)` ×g form writing
  `AccelerationField`, 3-axis nodal (Fx/Fy/Fz) and beam (qx/qy/qz kN/m +
  Ponctuelle a/L) forms, undoable "Vider les charges", CTA
  "Lancer le calcul 3D & Eurocode 3 →".
- **Step 4** — 6 eigenmodes (`Mode propre 1..6`, worker fetches 6, wasm
  clamps 1..6) with harmonic play/pause, plus 3 calibrated thermal scales
  (`Taux EC3 0→1,00`, `Contrainte σvM 0→fy`, `Auto 0→Max`) driven by the
  solver's real `max_sigma_vm` / `utilization`.

## Rust core & WASM (SI units, zero panics)

- **`crates/rdm-cad/src/step_importer.rs`** — pure-Rust ISO-10303-21
  (`CARTESIAN_POINT`/`DIRECTION`/`VECTOR`/`LINE`/`TRIMMED_CURVE`) and
  IGES type-`110` extraction with declared-mm→m conversion;
  `import_cad(bytes, filename)` dispatches `.dxf/.step/.stp/.igs/.iges`;
  `import_cad` wasm export with sequential 1-based member ids.
- **`LoadKind::AccelerationField { ax_g, ay_g, az_g }`** (model +
  validator + schema + store) — exact distributed inertial body force
  `q = ρ·A·g·(ax, ay, az)` integrated in `beam_case_load_local` and seen
  by the EC3 station superposition (`span_loads_local`); equilibrium test
  proves ΣRz = ρ·A·g·L for `1g −Z`.
- **`BeamCombinationResult`** extended with `max_sigma_vm` (Pa, via the
  new `rdm_eurocode::von_mises_stress`) and `governing_check` (resistance
  name at the max utilization across `STATIONS`); `modal_analysis` clamps
  1..=6 modes.

## Gates (G0 → G6) — all green

- G0: `cargo fmt --check` ✓, clippy `-D warnings` **0** (unnested
  or-patterns, `Path::extension` case handling, collapsed if-lets fixed),
  `oxfmt --check` ✓, `oxlint --deny-warnings` ✓.
- G1: `cargo test --workspace --all-features` **92 passed / 0 failed**
  (new: STEP/IGES extraction + mm→m, garbage/empty rejection,
  AccelerationField equilibrium).
- G2: wasm-pack rebuilt after the core changes.
- G3: `tsr generate` ✓; `tsc --noEmit` ✓; G4: i18n 89/89 EN (100%).
- G5: vitest **32/32** (fixtures extended for the new beam fields).
- G6: Playwright **32/32** chromium + firefox incl. the new `v130` suite:
  duplicate-beam guard ("Déjà reliés"), live responsive resize swap, the
  grouped RDM 7 library + clear-all undo, quick g-acceleration scenarios
  + clear undo, 6 modes + 3 thermal scales.

## Notable engineering found by the new tests

- The connector auto-default effect used to fight explicit user
  selection (it re-pointed N2 away from a linked pair the user chose),
  which made the dup-guard unreachable from the UI — fixed with sticky
  user-pick refs; the v130 test drives it through the real selects.
- Sonner toasts never rendered outside /results (the `<Toaster>` was
  route-local) — moved to the root layout.

## Explicitly NOT done (residual, environmental)

- WebKit e2e stays sandbox-blocked (missing system libs, no sudo).
- The tool-mode bar sets the mode + placement behavior; pointer-level
  magnetic grid placement inside the WebGL canvas remains a visual-guide
  path (SnapOverlay) rather than a click-to-place rewrite.
- `.agents/`, `skills-lock.json`, Playwright artifacts stay untracked.

## Next session
1. WebKit run on a provisioned machine.
2. STEP bounded-spline entities (`B_SPLINE_CURVE`) if survey models need
   them; IGES `112` (composite curve).
