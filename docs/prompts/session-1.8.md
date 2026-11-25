Task: github.com/elcoosp/rdm-studio. Ship v1.8.0 — first land the deferred `v1.7.0` Wave 3 WASM/UI surface & 8 pedantic clippy fixes documented in `STATUS.md`, then elevate RDM Studio into a real-time `< 20 ms` interactive CAD & structural optimization workstation:
(1) **Finish `v1.7.0` Wave 3 (`STATUS.md` residuals) & Persistent WASM Session (`< 20 ms` Live Solve)**: - Clear the 8 pedantic clippy lints in `crates/`, rebuild `wasm-pack`, and expose `v1.7.0` (`calc_trace`, `envelopes`, `custom_sections`, `national_annex`, `combination_method`, `shear_deformation`, `plane_frame_2d`, `generate_env_loads`, `run_validation_suite`) + `v1.8.0` stateful `ModelSession` (`open_model`, `apply_delta`, `solve_session`, `solve_case_rhs`, `cancel`) with latest-wins coalescing & priority lanes in `workerClient.ts`; - Surface all `v1.7.0` UI controls: Header settings popover (`National Annex FR/BE/DE/UK/EN`, `6.10 / 6.10a-b`, `Timoshenko shear`, `2D Plane Frame`), `ValidationModal` (41 live benchmarks), Step 1 family pills (`Tous | IPE | HEA | UPN | CHS | RHS | L | Perso`) + `SectionBuilderModal` (PRS/RHS/CHS/Rect/Round) + steel grade `fy/E/G/ρ` + `Standard/Tirant/Buton` + tapered/rigid-offsets + `Shift+Click` batch releases/buckling, Step 2 inclined support angle + prescribed settlements, Step 3 `EN 1991` Imposed/Snow/Wind generators + Thermal load + `EN 1990` formula card, and lazy-loaded `KaTeX` `CalcTraceTree` + shaded `Min/Max` envelopes in Step 4 & Step 5;
(2) **Full 3D CAD Manipulation Suite, Model Tree, Themes & Keyboard 3D Navigation (`apps/web/src/modeling/`)**: - CAD tools (`Polyline`, `Extrude`, `Move`, `Rotate`, `Mirror`, `Linear/Polar Array`, `Offset`, `Split/Trim`, `Merge Duplicates`, `Copy/Paste at cursor`) + CAD dynamic numeric cursor input (`Tab`/`Enter`), Box/Lasso/Crossing selection, `Select Similar` / `Isolate`, full geometric snapping (`endpoint`, `midpoint`, `intersection`, `perpendicular`, `parallel`, `polar 15/30/45°`, `X/Y/Z axis lock` with 3D indicators), Member Groups/Layers (visibility, lock, color), Storeys/Levels duplication, Model Tree + Visual Undo-History drawer, scrubbable & unit-aware inline table parsing (`4m / 4000mm / 12kN`), Comfortable/Compact/Dense density & Light/Dark/High-Contrast themes, 3D arrow-key navigation (`Arrow` node-to-node, `Enter` edit, `Esc` exit), and `?` cheat-sheet generated from the single shortcut registry;
(3) **3D On-Member Internal Force Diagrams (`N, Vy, Vz, T, My, Mz, δ`), Live Drag-Solve, Section Optimizer + Pareto & `"Why Does This Fail?"`**: - `ForceDiagrams3D.tsx` (signed translucent fills + outline curves along 3D members, amplitude slider, extrema badges, undeformed ghost, hover probe synced with `uPlot`, camera bookmarks `1–9`, ortho/persp toggle, clip box, `viridis / cividis` palettes) + live 3D node dragging (`< 20 ms` coalesced re-solve); - Iterative EC3 Section Optimizer (`crates/rdm-eurocode/src/optimizer.rs` + `OptimizerModal.tsx`: lightest catalog profile per member group passing ULS & SLS in ≤ 10 passes + Pareto mass-vs-utilization scatter + diff table + mass/carbon/cost `€/kg` + 1-click Apply/Undo) and Step 4 `"Why does this fail?"` explainer ranking the 3 cheapest 1-click mitigations.

EXECUTION CONTRACT (NON-NEGOTIABLE — 100% AUTONOMOUS, SINGLE BUILD TREE):

- **ZERO QUESTIONS / FULL AUTONOMY:** Operate autonomously end-to-end from bootstrap to final `.zip` archive without prompting.
- **SINGLE SHARED BUILD TREE:** Execute sequentially in waves inside the single `rdm-studio` working tree (never create parallel `git worktree` directories).
- **STRICT SI & ZERO PANICS:** Strict SI units internally; zero `.unwrap()` / `.expect()` / `panic!()` in `crates/` and `bindings/rdm-wasm`.
- **FAST SANDBOX PLAYWRIGHT (`AGENTS.md` §4):** Run Playwright strictly with `--project=chromium --project=firefox --reporter=list`.
- Write complete, clean files (never blind regex/tab patches) to avoid `oxfmt` whitespace no-ops.

1. **Bootstrap & Sync (< 3 tool calls):**
   - `cd rdm-studio && git fetch origin && git reset --hard origin/main` (or clone `https://github.com/elcoosp/rdm-studio.git` if missing).
   - Ensure `rustc`/`cargo`, `wasm-pack`, `pnpm`, and `ship` are installed; add `katex` (`pnpm --filter web add katex && pnpm --filter web add -D @types/katex`), and read `AGENTS.md`, `STATUS.md`, and `DESIGN.md`.

2. **Wave 1 — Clear 8 Clippy Lints, Iterative Section Optimizer & Stateful WASM `ModelSession` (`crates/`, `bindings/rdm-wasm`):**
   - Resolve the 8 pedantic clippy lints listed in `STATUS.md` (`cargo clippy --workspace --all-targets --all-features -- -D warnings` → 0 warnings).
   - Implement `optimizer.rs` in `crates/rdm-eurocode` (iterative multi-pass lightest profile selection per member group + Pareto points + mass/carbon/cost totals).
   - Update `bindings/rdm-wasm/src/lib.rs` to expose all `v1.7.0` Wave 3 functions (`calc_trace`, `envelopes`, `custom_sections`, `generate_env_loads`, `run_validation_suite`) AND stateful `ModelSession` (`open_model`, `apply_delta`, `solve_session`, `solve_case_rhs`, `optimize_sections`) with symbolic/numeric factorization caching (`< 2 ms` RHS load re-solve, `< 20 ms` delta re-solve), then run `wasm-pack build`.

3. **Wave 2 — Coalesced Worker, `v1.7.0` Wave 3 UI Surfaces & Full 3D CAD Manipulation Suite (`apps/web/src/`):**
   - Upgrade `workerClient.ts` with priority lanes (`LIVE_SOLVE` latest-wins coalescing + cancellation; optional `SharedArrayBuffer` when `COOP/COEP` allows) and full `v1.7.0` DTO typings.
   - Build all `v1.7.0` UI surfaces: Header settings popover (`National Annex`, `6.10 / 6.10a-b`, `Timoshenko`, `2D Plane Frame`), `ValidationModal` (41 live benchmarks), Step 1 family pills + `SectionBuilderModal` + steel grade `fy/E/G/ρ` + `Standard/Tirant/Buton` + tapered/rigid-offsets + `Shift+Click` batch releases/buckling, Step 2 inclined support angle + prescribed settlements, Step 3 `EN 1991` Imposed/Snow/Wind generators + Thermal load + `EN 1990` formula card, and lazy-loaded `KaTeX` `CalcTraceTree` + shaded `Min/Max` envelopes in Step 4 & Step 5.
   - Build the full CAD manipulation suite (`Polyline`, `Extrude`, `Move`, `Rotate`, `Mirror`, `Linear/Polar Array`, `Offset`, `Split/Trim`, `Merge Duplicates`, `Copy/Paste at cursor`), CAD dynamic cursor numeric input (`Tab`/`Enter`), Box/Lasso/Crossing selection, `Select Similar` / `Isolate`, geometric snapping (`endpoint`, `midpoint`, `intersection`, `perpendicular`, `parallel`, `polar 15/30/45°`, `X/Y/Z axis lock`), Member Groups/Layers, Storeys/Levels duplication, Model Tree + Visual Undo-History drawer, scrubbable & unit-aware table parser (`4m`, `4000mm`, `12kN`), UI density (`Comfortable / Compact / Dense`) + theme (`Light / Dark / High-Contrast`), 3D arrow-key navigation, and `?` cheat-sheet from the single shortcut registry.

4. **Wave 3 — 3D Force Diagrams, Live Drag-Solve & Optimizer + `"Why Does This Fail?"` (`apps/web/src/viewport3d/`, `apps/web/src/routes/results.tsx`):**
   - Build `ForceDiagrams3D.tsx` (`My, Mz, Vy, Vz, N, T, δ` signed fills + outlines, amplitude slider, extrema labels, undeformed ghost, live hover probe synced with `uPlot`), camera bookmarks `1–9`, ortho/persp toggle, clip box, `viridis / cividis` palettes, and live 3D node dragging (`< 20 ms` coalesced re-solve).
   - Add `"Why does this fail?"` 3-mitigation card and `OptimizerModal.tsx` (Pareto scatter + diff table + mass/carbon/cost `€/kg` + 1-click Apply/Undo) on Step 4.
   - **Mandatory Rust-to-UI Surface Contract:** Verify in Playwright E2E that every `v1.7.0` & `v1.8.0` engine feature has a working UI control (`Timoshenko`, `National Annex`, `tapered/rigid-offsets/behavior`, `inclined/settlements`, `EN 1991` + `Thermal`, `Envelopes` + `KaTeX CalcTraceTree`, `ValidationModal`, `live drag-solve`, `3D diagrams`, `OptimizerModal`, `"Why does this fail?"`, and `Themes/Density`).
   - Wrap all new UI copy in Lingui `<Trans>` / `t` and translate 100% of `apps/web/src/i18n/locales/en.po` (`0` untranslated strings).

5. **Verify All Gates (`G0 → G6`, `AGENTS.md` §4) & Archive:**
   - Run `G0 → G6` (`cargo fmt`, `clippy -D warnings`, `cargo test`, `wasm-pack`, `oxfmt`, `oxlint`, `tsr generate`, `i18n:extract`, `i18n:compile`, `tsc --noEmit`, `vitest`, `playwright test --project=chromium --project=firefox --reporter=list`) to 100% green.
   - Update `STATUS.md` (`v1.8.0` complete), `.github/pr-body.md`, `ship.toml`, run `ship validate` until exit `0`, and zip the clean tree (`rdm-studio-v1.8.0-<SHA>.zip`) into the downloads folder with zip contents proof.

# Step 3 — Session 13 (`v1.9.0`) Master Prompt (Final Release: P-Δ, Buckling `λcr`, EC8 Seismic, Multi-Material `EC2/EC5/EC3-1-8/EC3-1-2/EC9`, IFC4/SAF, Scenario Compare, Snapshots & `PDF + .docx` Report Builder)

Task: github.com/elcoosp/rdm-studio. Ship v1.9.0 — final commercial-release completion: advanced P-Δ / linear buckling / EC8 seismic dynamics, multi-material Eurocode engines (`EC2 / EC5 / EC3-1-8 / EC3-1-2 / EC9`), scenario comparator, IndexedDB crash recovery & snapshots, BIM interop (`IFC4 / SAF / OpenSees / glTF`), customizable `PDF + .docx` report builder, 12-template gallery & WCAG 2.2 AA audit:
(1) **Advanced Analysis (`crates/rdm-solver`)**: P-Δ geometric second-order analysis, linear buckling eigenvalues `λcr` + mode shapes (`[K_e + λ K_g] φ = 0`), influence lines + moving loads (EN 1991-2 LM1 simplified), and EN 1998-1 modal response spectrum analysis (CQC / SRSS with ≥ 90% modal mass participation);
(2) **Multi-Material Eurocode Engines (`crates/rdm-eurocode`)**:

- **EN 1992-1-1 (EC2 Concrete):** rectangular & T-beam ULS flexure (`As,req` rebar suggestion) + shear (`VRd,c / VRd,s`) for `C25/30..C50/60` + `B500B`;
- **EN 1995-1-1 (EC5 Timber):** solid/glulam (`C24`, `GL24h`, `GL28h`) bending, shear, compression/buckling with service class `1/2/3`, `kmod`, and creep deflection `kdef`;
- **EN 1993-1-8 (EC3 Steel Joints):** nodal bolted end-plate / fin-plate shear & moment capacity + fillet weld throat check;
- **EN 1993-1-2 (EC3 Fire Design):** critical steel temperature `θa,cr` (`°C`) and `R30 / R60 / R90` check;
- **EN 1999-1-1 (EC9 Aluminium):** `6061-T6` / `6082-T6` cross-section & buckling check (each emitting `CalcTraceNode`);
  (3) **Scenario Comparator, IndexedDB Snapshots, BIM Interop (`IFC4 / SAF / OpenSees / glTF`), Report Builder (`PDF + .docx`) & Release Audit**:
- IndexedDB crash recovery + named snapshots with diff view + side-by-side **Scenario Comparator** (`ScenarioCompareModal.tsx`);
- Pure-Rust **IFC4 Structural, SAF, OpenSees TCL, plain solver JSON & glTF** exports/imports, tributary area-load generator, 2-click DXF/PNG/PDF underlay tracing, CSV/Excel bulk importer with column mapping, and File System Access API open/save in place;
- Interactive **Report Builder** on Step 5 (reorder/toggle chapters, firm/engineer/checker/revision cover page, auto `"Hypothèses de calcul"` page, independent FR/EN output language, unit/precision prefs, batch export, vector SVG force curves in Takumi PDF, clean `.docx` Word export, engineer disclaimer + SHA-256 fingerprint);
- **12 validated templates** with `"Pourquoi ce modèle"` notes, `ES/DE/PT-BR` i18n scaffolding (`needs-review`), **WCAG 2.2 AA** ARIA live regions, route-level lazy loading (`≤ 350 kB gz` initial JS), `pnpm audit` / `cargo deny` security checks, and timed Playwright verification of the 10 canonical engineering workflows across `1440×900`, `860×900`, and `390×844` (light + dark).

EXECUTION CONTRACT (NON-NEGOTIABLE — 100% AUTONOMOUS, SINGLE BUILD TREE):

- **ZERO QUESTIONS / FULL AUTONOMY:** Operate autonomously end-to-end from bootstrap to final `.zip` archive without prompting.
- **SINGLE SHARED BUILD TREE:** Execute sequentially in waves inside the single `rdm-studio` working tree (never create parallel `git worktree` directories).
- **STRICT SI & ZERO PANICS:** Strict SI units internally; zero `.unwrap()` / `.expect()` / `panic!()` in `crates/` and `bindings/rdm-wasm`.
- **FAST SANDBOX PLAYWRIGHT (`AGENTS.md` §4):** Run Playwright strictly with `--project=chromium --project=firefox --reporter=list`.
- Write complete, clean files (never blind regex/tab patches) to avoid `oxfmt` whitespace no-ops.

1. **Bootstrap & Sync (< 3 tool calls):**

- `cd rdm-studio && git fetch origin && git reset --hard origin/main` (or clone `https://github.com/elcoosp/rdm-studio.git` if missing).
- Ensure `rustc`/`cargo`, `wasm-pack`, `pnpm`, and `ship` are installed, then read `AGENTS.md`, `STATUS.md`, and `DESIGN.md`.

2. **Wave 1 — P-Δ, Linear Buckling `λcr`, EC8 Seismic, Multi-Material Eurocodes & IFC4/SAF/OpenSees (`crates/`, `bindings/rdm-wasm`):**

- Implement P-Δ second-order iteration, linear buckling eigenvalue solver (`buckling.rs` for top 4 `λcr` modes), influence lines + simplified EN 1991-2 LM1 moving loads, and EN 1998-1 modal response spectrum (Type 1/2 spectrum, CQC & SRSS, ≥ 90% modal mass participation) in `crates/rdm-solver`.
- Add `C25/30..C50/60` concrete + `B500B` rebar, `C24 / GL24h / GL28h` timber, and `6061-T6 / 6082-T6` aluminium catalogs + `check_ec2_beam`, `check_ec5_timber`, `check_ec3_joint`, `check_ec3_fire`, and `check_ec9_aluminium` (each emitting `CalcTraceNode`) in `crates/rdm-eurocode`.
- Implement pure-Rust `export_ifc4_structural` / `import_ifc4_structural`, `export_saf_json` / `import_saf_json`, `export_opensees_tcl`, and `export_solver_json` in `crates/rdm-cad/src/bim_interop.rs`, expose all functions in `bindings/rdm-wasm`, and rebuild `wasm-pack`.

3. **Wave 2 — Snapshots/Crash Recovery, Scenario Comparator, Tributary Loads, Underlay & 12-Template Gallery (`apps/web/src/`):**

- Add IndexedDB persistence with automatic crash recovery, named project snapshots + diff view, and side-by-side **Scenario Comparator** (`ScenarioCompareModal.tsx` with delta chips `Δ Masse`, `Δ Carbone`, `Δ Taux`, `Δ Flèche`).
- Add one-way / two-way tributary area-load generator, 2-click DXF/PNG/PDF underlay tracing on the Step 1 grid, column-mapped CSV/Excel bulk importer, File System Access API (`showOpenFilePicker` / `showSaveFilePicker`) with blob fallback, and glTF export.
- Expand `ProjectGalleryModal` to **12 validated engineering templates** (_Poutre isostatique_, _Poutre continue 3 travées_, _Portique simple_, _Portique à 2 versants avec pannes_, _Treillis Warren 24 m_, _Treillis Pratt_, _Treillis Howe_, _Potence encastrée_, _Ossature R+2 contreventée_, _Auvent porte-à-faux_, _Passerelle piétonne_, _Poutre bois lamellé-collé GL24h_) with `"Pourquoi ce modèle"` notes.

4. **Wave 3 — Customizable Report Builder (`PDF + .docx`), WCAG 2.2 AA, `ES/DE/PT-BR` Scaffold & Release Audit (`apps/web/src/routes/report.tsx`, `apps/web/src/export/`):**

- Build Step 5's interactive **Report Builder** (reorder/toggle sections, firm/author/checker/revision cover page, auto `"Hypothèses de calcul"` page, independent FR/EN output language, unit/precision prefs, batch export, vector SVG force curves inside Takumi PDF, clean `.docx` Word export, mandatory engineering disclaimer + SHA-256 fingerprint).
- Lazy-load heavy routes (`KaTeX`, `uPlot`, `Takumi`, report builder) keeping initial JS `≤ 350 kB gz`, add ARIA live regions, scaffold `ES / DE / PT-BR` locales (`needs-review`) alongside 100% translated `FR + EN`, and verify security & dependency health (`pnpm audit --prod` / `cargo deny check`).
- **Mandatory Rust-to-UI Surface Contract:** Verify in Playwright E2E that P-Δ, Linear Buckling `λcr`, Moving Loads, Seismic EC8, EC2/EC5/EC3-1-8/EC3-1-2/EC9 checks, IFC4/SAF/OpenSees/glTF exports, Scenario Comparator, Snapshots, and `.docx` Report Builder are all clickable and tested across the 10 canonical engineering workflows at `1440×900`, `860×900`, and `390×844` (light + dark).

5. **Verify All Gates (`G0 → G6`, `AGENTS.md` §4) & Archive:**

- Run `G0 → G6` (`cargo fmt`, `clippy -D warnings`, `cargo test`, `wasm-pack`, `oxfmt`, `oxlint`, `tsr generate`, `i18n:extract`, `i18n:compile`, `tsc --noEmit`, `vitest`, `playwright test --project=chromium --project=firefox --reporter=list`) to 100% green.
- Update `STATUS.md` (`v1.9.0` complete), `.github/pr-body.md`, `ship.toml`, run `ship validate` until exit `0`, and zip the clean tree (`rdm-studio-v1.9.0-<SHA>.zip`) into the downloads folder with zip contents proof.
