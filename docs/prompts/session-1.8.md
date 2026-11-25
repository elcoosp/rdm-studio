Task: github.com/elcoosp/rdm-studio. Ship v1.8.0 — transform RDM Studio into a real-time `< 20 ms` interactive CAD & structural optimization workstation:
(1) **Persistent WASM Model Handle & Coalesced Worker Pipeline (`< 20 ms` Live Drag-Solve)** (`open_model`, `apply_delta`, `solve_session`, `solve_case_rhs`, `cancel` in `bindings/rdm-wasm/src/lib.rs` + latest-wins coalescing & priority lanes in `workerClient.ts`, enabling live node dragging and slider scrubbing with real-time 3D diagram updates);
(2) **Full 3D CAD Manipulation Suite, Model Tree & Keyboard 3D Navigation** (`apps/web/src/modeling/`: Move, Rotate, Mirror, Linear/Polar Array, Offset, Split/Trim, Merge Duplicates, Copy/Paste at cursor, CAD dynamic numeric input with `Tab`/`Enter`, Box/Lasso/Crossing selection, Member Groups/Layers with visibility/lock/color, Storeys/Levels duplication, Visual Undo-History timeline drawer, inline unit-aware table parsing `4m / 4000mm / 12kN`, Comfortable/Compact/Dense density & Light/Dark/High-Contrast themes, and full 3D keyboard navigation via arrow keys + `Enter` + `Esc`);
(3) **3D On-Member Internal Force Diagrams (`N, Vy, Vz, T, My, Mz, δ`), Camera Bookmarks & Clip Box** (`ForceDiagrams3D.tsx` rendering signed translucent fills + outline curves along 3D members with amplitude slider, extrema badges, undeformed ghost overlay, live hover probe synced with `uPlot`, camera bookmarks `1–9`, ortho/persp toggle, clip box, and color-vision-safe `viridis / cividis` thermal palettes);
(4) **Automated Eurocode 3 Section Optimizer (with Pareto Scatter) & `"Why Does This Fail?"` Explainer** (`crates/rdm-design/src/optimizer.rs` + `OptimizerModal.tsx`: lightest catalog profile per member group passing ULS & SLS in ≤ 10 iterative re-solves, Pareto mass-vs-utilization chart, before/after diff table with steel mass `kg`, embodied carbon `kgCO₂e`, and cost `€/kg` + 1-click Apply/Undo, plus Step 4 `"Why does this fail?"` explainer ranking the 3 cheapest 1-click mitigations).

EXECUTION CONTRACT (NON-NEGOTIABLE — 100% AUTONOMOUS, SINGLE BUILD TREE):

- **ZERO QUESTIONS / FULL AUTONOMY:** Operate autonomously end-to-end from bootstrap to final `.zip` archive without prompting.
- **SINGLE SHARED BUILD TREE:** Execute sequentially in waves inside the single `rdm-studio` working tree (never create parallel `git worktree` directories).
- **STRICT SI & ZERO PANICS:** Strict SI units internally; zero `.unwrap()` / `.expect()` / `panic!()` in `crates/` and `bindings/rdm-wasm`.
- **FAST SANDBOX PLAYWRIGHT (`AGENTS.md` §4):** Run Playwright strictly with `--project=chromium --project=firefox --reporter=list`.
- Write complete, clean files (never blind regex/tab patches) to avoid `oxfmt` whitespace no-ops.

1. **Bootstrap & Sync (< 3 tool calls):**
   - `cd rdm-studio && git fetch origin && git reset --hard origin/main` (or clone `https://github.com/elcoosp/rdm-studio.git` if missing).
   - Ensure `rustc`/`cargo`, `wasm-pack`, `pnpm`, and `ship` are installed, then read `AGENTS.md`, `STATUS.md`, and `DESIGN.md`.

2. **Wave 1 — Iterative Section Optimizer & Persistent WASM Model Session (`crates/rdm-eurocode`, `bindings/rdm-wasm`):**
   - Implement `optimizer.rs` in `crates/rdm-eurocode`: iteratively re-solve statically indeterminate force redistribution (≤ 10 passes, explicit stop reason) until every member group selects the lightest catalog section satisfying ULS `η ≤ target` and SLS deflection, returning `OptimizationReport` with per-group proposals, mass/carbon/cost totals, and Pareto frontier points (`mass_kg` vs `max_utilization`).
   - Implement stateful `ModelSession` in `bindings/rdm-wasm/src/lib.rs` (`open_model`, `apply_delta`, `solve_session`, `solve_case_rhs`, `optimize_sections`) caching symbolic & numeric Cholesky factorizations (`< 2 ms` RHS-only load re-solve, `< 20 ms` delta re-solve on 200-beam models).

3. **Wave 2 — Coalesced Worker Pipeline, CAD Tools, Groups/Levels, Themes & 3D Keyboard Nav (`apps/web/src/wasmBridge/`, `apps/web/src/modeling/`, `apps/web/src/state/`):**
   - Upgrade `workerClient.ts` with priority lanes (`LIVE_SOLVE` latest-wins coalescing + cancellation; `OPTIMIZE` / `EXPORT` non-blocking).
   - Implement CAD transform tools (`Move`, `Rotate`, `Mirror`, `Linear/Polar Array`, `Offset`, `Split/Trim`, `Merge Duplicates`, `Copy/Paste at cursor`) + CAD dynamic cursor numeric input (`Tab` / `Enter`), Box/Lasso selection, Member Groups/Layers (visibility, lock, color), Storeys/Levels duplication, Model Tree + Visual Undo-History drawer, unit-aware numeric input parser (`4m`, `4000mm`, `12kN`, `3,5 kN/m`), UI density (`Comfortable / Compact / Dense`) + theme (`Light / Dark / High-Contrast`), and 3D keyboard navigation (`Arrow` keys node-to-node, `Enter` edit, `Esc` exit).

4. **Wave 3 — 3D Force Diagrams, Live Drag-Solve, Optimizer + Pareto & `"Why Does This Fail?"` (`apps/web/src/viewport3d/`, `apps/web/src/routes/results.tsx`):**
   - Build `ForceDiagrams3D.tsx` rendering signed translucent fills + outline curves for `My, Mz, Vy, Vz, N, T, δ` directly along 3D members with amplitude slider, peak callouts, undeformed ghost wireframe, and live 3D hover probe synced with `uPlot`, plus camera bookmarks `1–9`, ortho/persp toggle, clip box, and `viridis / cividis` color-vision-safe palettes.
   - Enable live 3D node dragging with `< 20 ms` coalesced re-solve updating deformed shape, diagrams, and KPIs in real time.
   - Add `"Why does this fail?"` explainer card on Step 4 (naming governing clause + top 3 cheapest 1-click mitigations with before/after preview) and `OptimizerModal.tsx` (Pareto scatter + diff table + mass/carbon/cost `€/kg` + 1-click Apply/Undo).
   - Wrap all new UI copy in Lingui `<Trans>` / `t` and translate 100% of `apps/web/src/i18n/locales/en.po` (`0` untranslated strings).

5. **Verify All Gates (`G0 → G6`, `AGENTS.md` §4) & Archive:**
   - Run `G0 → G6` (`cargo fmt`, `clippy -D warnings`, `cargo test`, `wasm-pack`, `oxfmt`, `oxlint`, `tsr generate`, `i18n:extract`, `i18n:compile`, `tsc --noEmit`, `vitest`, `playwright test --project=chromium --project=firefox --reporter=list`) to 100% green.
   - Update `STATUS.md` (`v1.8.0`), `.github/pr-body.md`, `ship.toml`, run `ship validate` until exit `0`, and zip the clean tree (`rdm-studio-v1.8.0-<SHA>.zip`) into the downloads folder.

# Session 13 (`v1.9.0`) — P-Δ / Flambement LBA / Séisme EC8, Multi-Matériaux (`EC2 / EC5 / EC3-1-8 / EC3-1-2 / EC9`), IFC4/SAF/DOCX, Snapshots & Audit Sécurité/A11y

Task: github.com/elcoosp/rdm-studio. Ship v1.9.0 — complete multi-material Eurocode engineering suite, advanced P-Δ / buckling / seismic dynamics, scenario comparison, BIM interoperability, customizable calculation reports & commercial release audit:
(1) **Advanced Analysis (`crates/rdm-solver`)**: P-Δ geometric second-order analysis, linear buckling eigenvalues `λcr` + mode shapes (`[K_e + λ K_g] φ = 0`), influence lines + moving loads (EN 1991-2 LM1 simplified), and EN 1998-1 modal response spectrum analysis (CQC / SRSS with ≥ 90% modal mass participation check);
(2) **Multi-Material Eurocode Engines (`crates/rdm-eurocode`)**:

- **EN 1992-1-1 (EC2 Concrete):** rectangular & T-beam ULS flexure (`As,req` rebar suggestion) + shear (`VRd,c / VRd,s`) for `C25/30..C50/60` + `B500B`;
- **EN 1995-1-1 (EC5 Timber):** solid/glulam (`C24`, `GL24h`, `GL28h`) bending, shear, compression/buckling with service class `1/2/3`, `kmod`, and creep deflection `kdef`;
- **EN 1993-1-8 (EC3 Steel Joints):** nodal bolted end-plate / fin-plate shear & moment capacity + fillet weld throat check;
- **EN 1993-1-2 (EC3 Fire Design):** critical steel temperature `θa,cr` (`°C`) and `R30 / R60 / R90` check;
- **EN 1999-1-1 (EC9 Aluminium):** `6061-T6` / `6082-T6` cross-section & buckling check (each emitting `CalcTraceNode`);
  (3) **Scenario Comparator, IndexedDB Crash Recovery/Snapshots, BIM Interop (`IFC4 / SAF / Excel / DXF Underlay`) & Report Builder (`PDF + .docx`)**:
- Side-by-side **Scenario Comparator** (`ScenarioCompareModal.tsx`) + named IndexedDB snapshots with diff view & crash recovery;
- Pure-Rust **IFC4 Structural & SAF** import/export, tributary area-load generator, 2-click DXF/PNG underlay tracing, CSV/Excel bulk importer with column mapping, and File System Access API open/save in place;
- Interactive **Report Builder** on Step 5 (reorder/toggle chapters, firm/engineer/checker/revision cover page, auto `"Hypothèses de calcul"` page, vector SVG force curves inside Takumi PDF, and `.docx` Word export), **12 validated engineering templates** with `"Pourquoi ce modèle"` notes, `ES/DE/PT-BR` i18n scaffolding (`needs-review`), **WCAG 2.2 AA** ARIA live regions, and `cargo deny` / `pnpm audit` security gates.

EXECUTION CONTRACT (NON-NEGOTIABLE — 100% AUTONOMOUS, SINGLE BUILD TREE):

- **ZERO QUESTIONS / FULL AUTONOMY:** Operate autonomously end-to-end from bootstrap to final `.zip` archive without prompting.
- **SINGLE SHARED BUILD TREE:** Execute sequentially in waves inside the single `rdm-studio` working tree (never create parallel `git worktree` directories).
- **STRICT SI & ZERO PANICS:** Strict SI units internally; zero `.unwrap()` / `.expect()` / `panic!()` in `crates/` and `bindings/rdm-wasm`.
- **FAST SANDBOX PLAYWRIGHT (`AGENTS.md` §4):** Run Playwright strictly with `--project=chromium --project=firefox --reporter=list`.
- Write complete, clean files (never blind regex/tab patches) to avoid `oxfmt` whitespace no-ops.

1. **Bootstrap & Sync (< 3 tool calls):**

- `cd rdm-studio && git fetch origin && git reset --hard origin/main` (or clone `https://github.com/elcoosp/rdm-studio.git` if missing).
- Ensure `rustc`/`cargo`, `wasm-pack`, `pnpm`, and `ship` are installed, then read `AGENTS.md`, `STATUS.md`, and `DESIGN.md`.

2. **Wave 1 — P-Δ, Linear Buckling `λcr`, Response Spectrum EC8 & Multi-Material Eurocodes (`crates/rdm-solver`, `crates/rdm-eurocode`, `crates/rdm-cad`):**

- Implement P-Δ geometric stiffness iteration, linear buckling eigenvalue solver (`buckling.rs` for top 4 `λcr` modes), influence lines + simplified EN 1991-2 LM1 moving load envelope, and EN 1998-1 response spectrum (Type 1/2 spectrum, CQC & SRSS combination, modal mass participation report).
- Add `C25/30..C50/60` concrete + `B500B` rebar, `C24 / GL24h / GL28h` timber, and `6061-T6 / 6082-T6` aluminium catalogs + `check_ec2_beam`, `check_ec5_timber`, `check_ec3_joint`, `check_ec3_fire`, and `check_ec9_aluminium` (each emitting `CalcTraceNode`).
- Implement pure-Rust `export_ifc4_structural` / `import_ifc4_structural` and `export_saf_json` / `import_saf_json` in `crates/rdm-cad/src/bim_interop.rs`.

3. **Wave 2 — Snapshots/Crash Recovery, Scenario Comparator, Tributary Loads, Underlay & 12-Template Gallery (`apps/web/src/`):**

- Add IndexedDB persistence with automatic crash recovery, named project snapshots + diff view, and side-by-side **Scenario Comparator** (`ScenarioCompareModal.tsx` with delta chips `Δ Masse`, `Δ Carbone`, `Δ Taux`, `Δ Flèche`).
- Add one-way / two-way tributary area-load generator, 2-click DXF/PNG underlay tracing on the Step 1 grid, column-mapped CSV/Excel bulk importer, and File System Access API (`showOpenFilePicker` / `showSaveFilePicker`) with blob fallback.
- Expand `ProjectGalleryModal` to **12 validated engineering templates** (_Poutre isostatique_, _Poutre continue 3 travées_, _Portique simple_, _Portique à 2 versants avec pannes_, _Treillis Warren 24 m_, _Treillis Pratt_, _Treillis Howe_, _Potence encastrée_, _Ossature R+2 contreventée_, _Auvent porte-à-faux_, _Passerelle piétonne_, _Poutre bois lamellé-collé GL24h_) with `"Pourquoi ce modèle"` notes.

4. **Wave 3 — Customizable Report Builder (`PDF + .docx`), WCAG 2.2 AA, `ES/DE/PT-BR` Scaffold & Security Audit (`apps/web/src/routes/report.tsx`, `apps/web/src/export/`):**

- Build Step 5's interactive **Report Builder** (reorder/toggle sections, firm/author/checker/revision cover page, auto `"Hypothèses de calcul"` page, vector SVG force curves inside Takumi PDF, clean `.docx` Word export, mandatory engineering disclaimer + SHA-256 fingerprint).
- Add ARIA live regions announcing solve completion, scaffold `ES / DE / PT-BR` locales (`needs-review`) alongside 100% translated `FR + EN`, and verify security & dependency health (`pnpm audit --prod` / `cargo deny check` if installed).

5. **Verify All Gates (`G0 → G6`, `AGENTS.md` §4) & Archive:**

- Run `G0 → G6` (`cargo fmt`, `clippy -D warnings`, `cargo test`, `wasm-pack`, `oxfmt`, `oxlint`, `tsr generate`, `i18n:extract`, `i18n:compile`, `tsc --noEmit`, `vitest`, `playwright test --project=chromium --project=firefox --reporter=list`) to 100% green.
- Update `STATUS.md` (`v1.9.0`), `.github/pr-body.md`, `ship.toml`, run `ship validate` until exit `0`, and zip the clean tree (`rdm-studio-v1.9.0-<SHA>.zip`) into the downloads folder with zip contents proof.
