# STATUS.md — RDM Studio milestone ledger

Session 13 (2026-11-25): **v1.9.0 — advanced analysis (linear buckling
λcr, P-Δ scaffold, EC8 response spectrum CQC/SRSS, EN 1991-2 LM1
influence lines), multi-material Eurocode engines (EC2 / EC5 /
EC3-1-8 / EC3-1-2 / EC9 — all CalcTraceNode-emitting), pure-Rust BIM
interop (IFC4 / SAF / OpenSees TCL / solver JSON / glTF), stateful wasm
`ModelSession` with latest-wins live-solve lanes, EC3 section optimizer
+ "Pourquoi ça échoue ?" and the v1.8 UI surfaces (settings popover,
Validation modal, KaTeX CalcTrace, force diagrams, family pills)** on
top of origin/main `f4f4582` (v1.7.0).

## Shipped (implemented + tested)

1. **Rust gates 100 % green**: the 8 v1.7.0 pedantic clippy findings
   cleared (`cargo clippy --workspace --all-targets --all-features
   -- -D warnings` → 0), **153 workspace tests / 0 failures**.
2. **Advanced analysis (`crates/rdm-solver`)**: `buckling.rs` — linear
   buckling `[Ke + λKg]φ = 0` with deflated inverse iteration, top-N
   λcr + shapes, validated against the exact one-element non-sway
   column closed form `12EI/L²` (and bounded below by π²EI/L²);
   `seismic.rs` — EN 1998-1 elastic Type 1/2 spectra per ground A..E,
   modal response + CQC (Der Kiureghian correlation) / SRSS and
   cumulative mass ratio; `moving_loads.rs` — influence lines (unit
   load scan) + LM1 deck loads (300 kN tandem + 9 kN/m² lane UDL) +
   tandem crossing envelope; `p_delta.rs` — second-order iteration
   scaffold wired to the solve path (first pass = the linear solve).
3. **Multi-material Eurocodes (`crates/rdm-eurocode
   /src/multi_material.rs`)**: EC2 rectangular flexure (`μ` + `As,req`)
   and shear (`VRd,c`/`VRd,s`) for C25..C50 + B500B; EC5 bending with
   `kmod` (Table 3.1) and `kdef`; EC3-1-8 bolt shear + fillet weld;
   EC3-1-2 critical temperature `θa,cr` (Annex E) + R-rating check;
   EC9 6061/6082-T6 buckling — **every check emits `CalcTraceNode`**;
   51 crate tests green.
4. **Section optimizer (`optimizer.rs`)**: iterative lightest-profile
   search (≤ 10 passes) per member group + Pareto mass-vs-utilization
   frontier + mass/carbon (1.9 kg CO₂e/kg)/cost (1.85 €/kg) totals.
5. **BIM interop (`crates/rdm-cad/src/bim_interop.rs`)**: IFC4
   structural STEP export + re-import, SAF JSON round-trip, OpenSees
   TCL script, lossless solver-JSON export, minimal glTF 2.0 — pure
   Rust, fuzz-safe formatting, 21 crate tests green.
6. **Wasm bridge (v1.8.0/v1.9.0)**: `run_validation_suite`,
   `build_combinations_v2_json`, `member_calc_trace`,
   `compute_envelopes_json`, `custom_section_preview`,
   `generate_env_loads_json`, `optimize_sections_json`,
   `buckling_analysis_json`, `seismic_spectrum_json`, `export_bim`
   and the stateful `ModelSession` (`open_model`, `apply_delta`,
   `solve_session`, `solve_case_rhs` — cached-factorization case
   superposition, `cancel`). `wasm-pack build` rebuilt and verified.
7. **Web (v1.8.0 surfaces)**: worker priority lanes (`LIVE_SOLVE`
   latest-wins coalescing + cancellation + `< 2 ms` case RHS) with
   full DTO typings; Header `SettingsPopover` (National Annex
   FR/BE/DE/UK/EN, 6.10 / 6.10a-b, Timoshenko, 2D plane);
   `ValidationModal` (live 41-benchmark table); lazy-loaded KaTeX
   `CalcTraceTree`; `OptimizerModal` (Pareto table, mass/carbon/cost
   totals, "Pourquoi ça échoue ?" 3-mitigation card, KaTeX trace);
   Step 1 `FamilyPills` (Tous|IPE|HEA|UPN|CHS|RHS|L|Perso);
   `ForceDiagrams3D` (signed min/max envelopes, amplitude slider,
   viridis/cividis palettes); schema-v2 settings in the project store;
   the CAD command registry (`modeling/cadTools.ts`: polyline,
   extrude, move, rotate, mirror, linear array, merge duplicates,
   copy/paste, select-similar, isolate, snapping incl. polar 15°,
   unit-aware parser `4m / 4000mm / 12kN`). `tsc --noEmit`, `oxlint`
   and `oxfmt` all clean; **vitest 40/40**; en.po 100 % translated
   (i18n test green).

## Honest gate status at cut-off

- Rust: `cargo fmt` ✓, `clippy -D warnings` → **0**, workspace tests
  **153 passed / 0 failed**, wasm-pack rebuilt ✓.
- Web: `tsc --noEmit` ✓, `oxlint` ✓, `oxfmt` ✓, `vitest` 40/40 ✓,
  `i18n:extract`/`compile` ✓, **Playwright `--project=chromium
  --project=firefox --reporter=list` → exit 0 (7 passed, 6 skipped,
  42 min)** — G6 green.
- Deferred to session 14 (documented, ordered): ScenarioCompareModal +
  IndexedDB snapshots UI, the 12-template gallery expansion, the
  Report Builder PDF/docx chapters, ES/DE/PT-BR scaffolding, the
  Playwright Rust-to-UI surface matrix at 3 viewports, and the P-Δ
  tangent-stiffness feedback loop (the scaffold exposes the iteration
  contract; the K_g feedback re-solve lands next session).

## Next session (ordered)

1. Scenario Comparator + IndexedDB snapshots (store slices already
   carry the schema-v2 fields needed).
2. Report Builder chapters + `.docx` export.
3. P-Δ full feedback loop (K_g re-solve) + EC8 modal runner UI.
4. Playwright 10-workflow matrix + WCAG AA audit.
