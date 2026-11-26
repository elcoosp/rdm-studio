# STATUS.md — RDM Studio milestone ledger

Session 16 (2026-11-26): **v2.0.2 — production-grade visual polish & physics
corrections on top of the v2.0.1 stabilization: real superposed envelopes
(`section_cut::superimposed_beam_state` now feeds weighted Variable/Wind/Snow
span loads into every station sample), a fully derived EC3 CalcTrace (Table
6.2 curves, χ per axis, Euler Ncr with member buckling lengths, λ̄² = A·fy/Ncr,
§6.3.2.2 LTB reduction), the `extrude` infinite-loop tab freeze fixed with a
regression test, the complete Daylight-token purge (zero `dark:*` /
`bg-slate-900` / `border-slate-*` / `bg-blue-600` classes left in components,
routes and the viewport layer), the segmented Swiss Metrology CAD strip with
the Base UI `Outils ▾` menu and 16px Lucide icons, 6px hairline scrollbars,
the header fitting `1280×900` / `860×900` (`Réglages`, icon-only Validation
below xl, `FR | EN` always visible), full-width FamilyPills above the Step 1
property grid, the gizmo anchored bottom-right `[44,44]` at scale 0.75,
Step 4's combination/scale bar moved out of the 3D HUD into the header with a
`122px` uPlot that fits the 220px dock, the `lastSnapshot` stage cache so
Step 5's A4 sheet embeds a populated 3D render, 22px engineering icons,
realistic EN 1991 generator defaults (imposée cat. B 3,0 kN/m², neige sk
0,45 kN/m², vent vb 26 m/s), canonical supports on all 12 gallery templates,
exact snapshot mass via `computeModelMassKg`, the `Uniform` LoadData variant
(fixing the "Cannot read properties of undefined (reading 'fz')" crash the
snow/wind generators exposed), the legacy `version: 1` `.rdm` DataTransfer
drop test and the Extruder responsiveness E2E** — all on top of origin/main
`41a0593` (v2.0.0), tree left dirty for ship.

## Shipped (implemented + tested)

1. **Wave 1 — engine**: `crates/rdm-solver/src/envelopes.rs` routes station
   sampling through `superimposed_beam_state`; `member_calc_trace` derives
   real `n_ed/my_ed/mz_ed/chi_y/chi_z/chi_lt/n_b_rd_y/n_b_rd_z/mc_y_rd/
   mc_z_rd/lambda_bar_*` from the solved model; wasm-pack rebuilt; clippy
   `-D warnings` → 0; workspace tests green.
2. **Wave 2 — UI craft**: dark-mode purge verified by grep (0 leftovers);
   CadToolbar redesign; scrollbars; header clipping fixed; geometry inspector
   layout; gizmo anchoring; Step 4 HUD extraction + dock fit; Step 5
   snapshot cache; icon sizing; EN 1991 defaults; template supports; exact
   scenario mass.
3. **Wave 3 — correctness**: `extrude.apply` iterates the original beams
   (no freeze); the EN 1991 generators' `Uniform` loads are now a first-
   class `LoadData` variant with correct resultant math (mean q × L along
   the declared direction) and crash-free table rendering; scenario E2E
   rewritten around the real gallery kinds, a real `.rdm` drop and the
   Extruder freeze regression.
4. **Handoff**: `ship.toml` (delivery `fix/v202-final-polish`, 56 one-file
   commit blocks ordered crates → bindings → web src → e2e → docs),
   `.github/pr-body.md`, `ship validate` exit 0.

## Gate ledger at cut-off

- `cargo fmt --all --check` ✓ — `cargo clippy --workspace --all-targets
  --all-features -- -D warnings` ✓ 0 — `RUSTFLAGS="-D warnings" cargo test
  --workspace --all-features` ✓ — `wasm-pack build` ✓.
- `oxfmt --check` ✓ — `oxlint --deny-warnings` ✓ — `tsr generate` ✓ —
  `i18n:extract` + `i18n:compile` ✓ (en.po completed) — `tsc --noEmit` ✓ —
  `vitest` 41/41 ✓ — `pnpm --filter web build` ✓.
- Playwright chromium+firefox: full-suite tally recorded in
  `download/e2e-v202b.log` at the end of this session (first v2.0.2 run
  94 passed / 14 failed, root-caused to the Uniform `forces.fz` crash on
  /loads and fixed).
- Screenshots eyeballed at 1440×900 / 860×900 / 390×844 on all 5 routes +
  the gallery (zero horizontal overflow everywhere, zero dark cards).

## Next session

1. Attach the final Playwright tally from `e2e-v202b.log` here.
2. Cut the release tag once CI mirrors the local green run.
