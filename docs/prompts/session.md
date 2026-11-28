Task: github.com/elcoosp/rdm-studio. Maximum-velocity, plan-aligned implementation following `AGENTS.md`, `ARCHITECTURE.md`, `DESIGN.md`, and `./mockups/`.

1. **Bootstrap & Sync (< 3 tool calls):**
   - If `rdm-studio` is not cloned locally, `git clone https://://github.com.git && cd rdm-studio`; if it already exists, `cd rdm-studio && git fetch origin && git reset --hard origin/main` so `HEAD` matches your latest pushed `main` (with M9 landed).
   - Ensure `rustc`/`cargo` (`wasm32-unknown-unknown`, `rustfmt`, `clippy`), `wasm-pack`, `pnpm`, and `ship` (`cargo install --git https://github.com`) are installed, then read `STATUS.md` and `git log -5 --oneline` to confirm `HEAD` and prepare **Milestone M10 (Session 2 of 3 — Audit Fixes, RDM7 Boundary Conditions & Member Behaviors, Effective Modal Masses, 8 RDM6/7 Analytical Benchmarks & Multi-Case EN 1990 Envelopes)**.

2. **Ship Complete Milestone M10 (Rust/WASM Audit Fixes + RDM7 Physics Wiring + Multi-Case Envelopes):**
   Implement all 5 deliverables below direct-to-green with full Rust `cargo test`, Vitest unit tests, and Playwright E2E tests (zero stubs, zero `.unwrap()`/`.expect()`/`panic!()` in `crates/rdm-solver`, `crates/rdm-cad`, or `bindings/rdm-wasm`, zero `#[allow(...)]`/`#[expect(...)]` outside `Cargo.toml`, zero raw HTML primitives `<select>`, `<details>`, `<input type="checkbox">`, `<input type="range">` in `apps/web/src/`, zero ALL-CAPS text, strict SI units in state/WASM):
   - **M10.1 — Audit Defect Fixes in `crates/rdm-solver` & `crates/rdm-eurocode`:**
     - **`crates/rdm-solver/src/modal.rs`:**
       - Remove the duplicated `if std::env::var("RDM_MODAL_DEBUG").is_ok()` debug blocks in `modal_analysis`.
       - Compute true **modal participation factors** $\Gamma_{x,i}, \Gamma_{y,i}, \Gamma_{z,i}$ and **effective modal masses $M^{\text{eff}}_{x,i}, M^{\text{eff}}_{y,i}, M^{\text{eff}}_{z,i}$ (`kg`)** + **effective mass ratios (`0.0..=1.0`, representing `0..100 %` of total structural mass $M_T$)** per mode (following Yves Debard _RDM6 – Méthodes de calculs_ §5.5 and EN 1998-1 §4.3.3.3) and expose `effective_mass_ratios: [f64; 3]` on `ModeShape` and WASM modal DTOs.
     - **`crates/rdm-eurocode/src/en1993.rs`:**
       - Fix `member_check` where `lambda_bar_y_sq` and `lambda_bar_z_sq` were hardcoded to `0.5` and `0.8`: compute the actual squared non-dimensional slendernesses $\bar{\lambda}_y^2 = A f_y / N_{cr,y}$ and $\bar{\lambda}_z^2 = A f_y / N_{cr,z}$ from member length $L$, `k_buckling`, $E$, and $I_y, I_z$ for both compression and bending members so EN 1993-1-1 Eqs. 6.61 / 6.62 Annex A/B factors are physically exact.
     - **`crates/rdm-eurocode/src/multi_material.rs`:**
       - Fix `ec3_fire_check` where `substituted` formatted `0.5` instead of `utilization_mu0`; pass the actual `utilization_mu0` into `CalcNodeFire`.

   - **M10.2 — Wire RDM7 Elastic Supports ($k_u, k_\theta$) & Imposed Support Displacements ($\Delta u, \Delta \theta$) (`supports.tsx` + `SupportMarkers.tsx`):**
     - `Support.spring_stiffness: [f64; 6]` and `Support.settlement: [f64; 6]` are already implemented in `crates/rdm-model` and `crates/rdm-solver`! Verify `bindings/rdm-wasm` round-trips both arrays cleanly.
     - **Step 2 UI (`apps/web/src/routes/_studio/supports.tsx`):**
       - Add two collapsible Swiss Metrology cards (`ExpandablePanel`) in the Step 2 support inspector:
         1. **Appui élastique ($k$)** (`data-testid="elastic-springs-panel"`): 6 `NumberField` inputs (`kx, ky, kz` in `kN/m` converted to `N/m`, `krx, kry, krz` in `kN·m/rad` converted to `N·m/rad`) + a 1-click preset `"Appui élastique (k)"` (`SupportSpring` icon).
         2. **Déplacement imposé ($\Delta$)** (`data-testid="support-settlement-panel"`): 6 `NumberField` inputs (`Δux, Δuy, Δuz` in `mm` converted to `m`, `Δrx, Δry, Δrz` in `°` converted to `rad`) enabled on locked DOFs.
     - **3D Symbols (`apps/web/src/viewport3d/SupportMarkers.tsx`):**
       - Render **3D helical spring coils** (Deep Cobalt `#1D4ED8`) on nodes with non-zero `spring_stiffness`, and **directional prescribed-displacement arrows** (`#0891B2` cyan) when any `settlement[i] !== 0`.

   - **M10.3 — Wire Nonlinear Tension-Only / Compression-Only Members (_Tirants / Butons_) & Timoshenko/Bernoulli Toggle:**
     - `Beam.behavior: MemberBehavior` (`Standard` | `TensionOnly` | `CompressionOnly`) and `ModelSettings.shear_deformation` are already implemented in `crates/rdm-model` and `crates/rdm-solver`!
     - **WASM Bridge (`bindings/rdm-wasm`):** Expose `inactive_beam_ids: Vec<u32>` in the solve result (any `TensionOnly` / `CompressionOnly` beam whose final residual axial force collapsed to near-zero `|N| < 1e-3 N` while under opposite-sign strain).
     - **Step 1 & 3D UI (`geometry.tsx`, `BeamMeshes.tsx`, `results.tsx`):**
       - Add a `<SegmentedControl>` **Comportement axial** (`Standard` | `Tirant` | `Buton`, `data-testid="beam-axial-behavior"`) in Step 1 beam inspector (`geometry.tsx`).
       - Render `TensionOnly` members as slender tension rods with a central turnbuckle cylinder in `BeamMeshes.tsx`, and visually dim inactive buckled cables in Step 4 (`results.tsx`, dashed slate wireframe + badge `Inactif (comprimé)`).
     - **Solver Formulation Toggle (`SettingsPopover.tsx`):**
       - Add a `<SegmentedControl>` **Théorie de poutre** (`Timoshenko` | `Bernoulli`, `data-testid="shear-deformation-toggle"`) bound to `structure.settings.shear_deformation`.

   - **M10.4 — 8 Yves Debard RDM6/7 Analytical Benchmarks (`rdm6_benchmarks.rs` + `ValidationModal.tsx`):**
     - Create `crates/rdm-solver/tests/rdm6_benchmarks.rs` implementing and asserting all **8 analytical examples from Yves Debard's _RDM – Flexion_ (§6.1–§6.8)** against closed-form values (`< 0.5%` relative tolerance):
       1. `RDM6-01`: 4-span continuous clamped-ends beam with partial UDL + point load ($v_5 = -0.079487\text{ mm}$, $M_{1z} = 750.52\text{ N·m}$).
       2. `RDM6-02`: 3-span continuous beam with triangular/trapezoidal distributed load.
       3. `RDM6-03`: Clamped beam with internal hinge (`releases_end`) + double triangular load (slope discontinuity $\theta_L \neq \theta_R$).
       4. `RDM6-04`: Continuous beam on elastic translational spring support ($F_{2y} = -k v_2 = 12.571\text{ kN}$).
       5. `RDM6-05`: Continuous beam with imposed support displacement ($d = -1\text{ mm} \implies F_{3y} = -1.14\text{ N}$).
       6. `RDM6-06`: Beam with elastic rotational spring restraint ($M_{1z} = -k_\theta \theta_{1z} = 0.838\text{ kN·m}$).
       7. `RDM6-07`: Asymmetric T-section cantilever extreme fiber stresses ($\sigma_{\text{sup}} = +90\text{ MPa}$ vs $\sigma_{\text{inf}} = -210\text{ MPa}$).
       8. `RDM6-08`: Clamped-pinned beam under self-weight (maximum deflection at $x = \frac{15-\sqrt{33}}{16} L = 0.57846 L$).
     - Surface these 8 benchmarks in `ValidationModal.tsx` (bringing the certified suite to **49 / 49 benchmarks**, with a filter pill `RDM6 / RDM7 (8)`) and show real modal effective mass ratios (`Mx %`, `My %`, `Mz %` + cumulative sum) in `AdvancedPanels.tsx`.

   - **M10.5 — Multi-Load Case Manager, Eurocode 0 Combinations & Min/Max Envelope Engine (`loads.tsx`, `results.tsx`, `ViewportCanvas.tsx`):**
     - Wire `structure.load_cases` (`LoadCaseDef` with `G`, `Q`, `W`, `S`, `Acc`) and `en1990::build_combinations_v2` (`6.10` and `6.10a/b`) into Step 3 (`loads.tsx`):
       - Add a **Cas de charges & Combinaisons EN 1990** card (`data-testid="load-case-manager"`) allowing engineers to add/rename elementary cases (`G1`, `Q1`, `Q2`, `W+`, `S`), inspect active $\psi_0 / \psi_1 / \psi_2$ factors, and click **Générer combinaisons ELU/ELS** (`1.35G + 1.5Q`, `1.0G + 1.0Q`, etc.).
     - Wire `rdm_solver::compute_envelopes` into `fea.worker.ts` and Step 4 (`results.tsx`):
       - Add **Enveloppe ELU (Min/Max)** (`value="ENV:ULS"`) and **Enveloppe ELS (Min/Max)** (`value="ENV:SLS"`) options to `combination-selector` in `results.tsx`.
       - When an Envelope mode is selected, render **shaded Min/Max envelope bands** in `uPlot` (translucent `#1D4ED8`/12% fill between `min` and `max` curves) and **floating 3D peak extremum callout pills** (`M_max`, `u_max`) pinned at critical beam stations in the 3D viewport.
     - Extract and compile Lingui i18n catalogs (`pnpm --filter web i18n:extract && pnpm --filter web i18n:compile`, 0 untranslated strings in `en.po`).

3. **Verify Gates:**
   - Run all applicable Gates `G0 → G6` (`AGENTS.md` §4):
     - `cargo fmt --all --check && cargo clippy --workspace --all-targets --all-features -- -D warnings && cargo test --workspace --all-features`
     - `wasm-pack build bindings/rdm-wasm --target web --out-dir ../../apps/web/src/wasm-pkg`
     - `pnpm --filter @rdm-studio/ui build`
     - `pnpm --filter web exec tsr generate`
     - `pnpm --filter web exec oxfmt --write src && pnpm --filter web exec oxfmt --check`
     - `pnpm --filter web exec oxlint --deny-warnings`
     - `pnpm --filter web exec tsc --noEmit`
     - `pnpm --filter web test:unit`
     - `pnpm --filter web build`
     - `pnpm --filter web exec playwright test e2e/m10-rdm7-solver-envelopes.spec.ts e2e/m9-cad-powertools.spec.ts e2e/workflow.spec.ts --project=chromium --project=firefox --reporter=list` (add `apps/web/e2e/m10-rdm7-solver-envelopes.spec.ts` testing elastic springs, imposed settlements, tension-only bracing, 49/49 benchmarks in ValidationModal, and EN 1990 envelopes).
   - Fix every single error or warning until 100% green.

4. **Handoff & Archive (Leave Tree Dirty — No Commits):**
   - Leave the working tree dirty with zero commits created during this session (`git status` shows all new/modified files).
   - Update `STATUS.md` with Milestone M10 completion status and verification gate results.
   - Write `.github/pr-body.md` summarizing Milestone M10 audit fixes, RDM7 boundary/member features, 49/49 benchmarks, and EN 1990 envelope results.

- Write `ship.toml` at the repo root with strictly 1 dirty file per `[[commit]]`, ordered by dependency (`crates/` → `bindings/` → `packages/ui` → `apps/web/src/` → `i18n/` → `e2e/` → `STATUS.md` → `.github/pr-body.md`).
- Run `ship validate` until exit `0`.
- Zip the full clean tree (`rdm-studio-m10-solver-envelopes.zip`, excluding only `.git/`, `target/`, `node_modules/`, caches) into the downloads folder with zip contents proof.
