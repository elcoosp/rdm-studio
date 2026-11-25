Task: github.com/elcoosp/rdm-studio. Ship v1.2.0 — full-stack Rust/WASM + UI/UX completion: wire the official brand emblem (`docs/logo-idea.svg`), close all 6 live-browser video defects, deliver 100% RDM 7 Studio workstation parity (pure-Rust STEP/IGES + DXF CAD importer, solver-native inertial `g`-acceleration fields, per-beam `max_sigma_vm` & governing EC3 check in WASM), AND execute a genuine `impeccable` visual craft audit & polish pass across all 5 routes following `AGENTS.md`, `ARCHITECTURE.md`, and `DESIGN.md` (§1–§8).

EXECUTION CONTRACT (NON-NEGOTIABLE):

- Keep strict SI units (`m`, `N`, `Pa`, `rad`, `kg/m³`) and zero `.unwrap()` / `.expect()` / `panic!()` in `crates/` and `bindings/rdm-wasm`.
- Preserve all v1.1.0 features already on `main` (`shadcn/ui`, 32 `EngineeringIcons`, extruded profiles, `@number-flow/react`, `CameraControls`, 3D cutting plane, `modal.rs`, `section_cut.rs`, `rdm-cad`).
- **MANDATORY `impeccable` SKILL EXECUTION:** You MUST inspect `find .agents/skills/impeccable -maxdepth 3` and READ `.agents/skills/impeccable/SKILL.md` (plus its craft/polish reference files) before touching UI files, and explicitly apply its rules (visual hierarchy, spatial rhythm, hairline borders, zero card clutter, crisp tabular alignment, and tactile focus states) across Steps 1–5.
- Write complete, clean files (never blind regex/tab patches) to avoid `oxfmt` whitespace no-ops.

1. **Bootstrap, Sync & Read `impeccable` Craft Skill (< 3 tool calls):**
   - If `rdm-studio` is not cloned locally, `git clone https://github.com/elcoosp/rdm-studio.git && cd rdm-studio`; otherwise `cd rdm-studio && git fetch origin && git reset --hard origin/main`.
   - Ensure `rustc`/`cargo` (`wasm32-unknown-unknown`, `rustfmt`, `clippy`), `wasm-pack`, `pnpm`, and `ship` (`cargo install --git https://github.com/elcoosp/ship`) are installed.
   - Install `impeccable` if missing (`pnpm dlx skills add https://github.com/pbakaus/impeccable --skill impeccable -y || true`), list all files under `.agents/skills/impeccable/`, and **read `.agents/skills/impeccable/SKILL.md` in full** alongside `STATUS.md` and `DESIGN.md`.

2. **Rust Core & WASM Enhancements (`crates/` + `bindings/rdm-wasm` — SI Units, Zero Panics):**
   - **A. Pure-Rust STEP & IGES Wireframe Importer (`crates/rdm-cad/src/step_importer.rs`, `crates/rdm-cad/src/lib.rs`, `bindings/rdm-wasm/src/lib.rs`):**
     - Implement `import_step_or_iges(bytes: &[u8]) -> Result<Vec<RawSegment>, CadError>` in pure Rust (extracting ISO-10303-21 `CARTESIAN_POINT` + `LINE` / `VECTOR` / `TRIMMED_CURVE` entities from `.step`/`.stp` and `110` Line entities from `.igs`/`.iges`, converting `mm` header units to metres when declared), fed into `clean_topology(segments, 1e-3)`.
     - Expose `import_cad(bytes: &[u8], filename: &str, project_name: &str)` in `bindings/rdm-wasm` dispatching `.dxf`, `.step`/`.stp`, and `.igs`/`.iges` with sequential 1-based beam IDs.
   - **B. Solver-Native Inertial `g`-Acceleration Loads (`crates/rdm-model/src/loads.rs`, `crates/rdm-solver/src/loads.rs`, `apps/web/src/schemas/project.schema.ts`):**
     - Add `LoadKind::AccelerationField { ax_g: f64, ay_g: f64, az_g: f64 }` (dimensionless multiples of `STANDARD_GRAVITY = 9.80665 m/s²`) to `rdm-model` and `project.schema.ts`.
     - Integrate its exact distributed inertial body force `q = ρ · A · g · (ax_g, ay_g, az_g)` in `beam_case_load_local` (`crates/rdm-solver/src/loads.rs`) so quick scenarios (_Poids propre 1g -Z_, _Transport 0,8g X / 1,5g -Z_) and custom `(ax, ay, az)` accelerations solve analytically in Rust.
   - **C. Per-Beam Governing EC3 Check & `max_sigma_vm` (`bindings/rdm-wasm/src/lib.rs`):**
     - Extend `BeamCombinationResult` with `max_sigma_vm: f64` (Pa, evaluated across `STATIONS` `0.0..1.0`) and `governing_check: String` (the check name with highest utilization, e.g. `"Mb,Rd"`, `"Nb,Rd,z"`, `"Von Mises"`), and expose `modal_analysis` up to 6 modes cleanly.

3. **Brand Emblem (`docs/logo-idea.svg`) & All 6 Live-Browser Video Defects (`apps/web/`):**
   1. **Leverage Official Brand Logo (`docs/logo-idea.svg`):**
      - Copy `docs/logo-idea.svg` (falling back to `docs/logo-rdm-studio.svg` if present) into `apps/web/public/logo-rdm-studio.svg` and ensure valid `xmlns="http://www.w3.org/2000/svg"`.
      - Render `/logo-rdm-studio.svg` in the top-left header (`__root.tsx`), Step 5 A4 calculation sheet header (`report.tsx`), `ProjectGalleryModal`, and regenerate `apps/web/public/icon-192.png`, `icon-512.png`, and `icon-maskable-512.png` from this vector logo so PWA icons match the brand mark.
   2. **Prevent Duplicate Beams & Overlapping Orphan Nodes (`geometry.tsx`):** Disable `"Relier N1 → N2"` (`"Déjà reliés"`) when `(beamN1, beamN2)` already exists, auto-default to the last two unconnected nodes, and offset `+ Nœud` to `maxX + 2.0` m when using default coordinates.
   3. **Reactive Window-Resize Navigation & Mobile Sheet Clearance (`__root.tsx`, `BottomSheet.tsx`):** Use a reactive `matchMedia("(max-width: 767px)")` hook so split-screen desktop windows (`768px–1024px`) retain the horizontal top step bar (`hidden md:flex`) and narrow viewports (`< 768px`) toggle the mobile bottom tab bar dynamically; offset mobile `BottomSheet` to `bottom-14` (`56px`) above the bottom tab bar.
   4. **3-Zone Balanced Header & Active Locale Pill (`__root.tsx`):** Lay out `<header>` with `justify-between` (Left: `/logo-rdm-studio.svg` + `RDM Studio / Projet ▾`; Center: `Étape 1..5`; Right: `ml-auto` cluster with node/beam counter, `⌘K`, `OfflinePill`, `?`, and active-highlighted `FR` / `EN` toggle).
   5. **Bottom-Right 3D Gizmo (`ViewportCanvas.tsx`):** Anchor `<GizmoHelper alignment="bottom-right" margin={[72, 72]}>` in the bottom-right corner so the top-right `3D Iso | Dessus XY | Face XZ | Côté YZ` preset bar is 100% unobstructed.

4. **Deliver High-Craft RDM 7 Studio Workstation Parity + `impeccable` Polish:**
   - **Step 1 (`geometry.tsx`):** Add segmented 3D tool mode bar (`Sélection [V]` · `+ Nœud [N]` · `Relier [B]`) with magnetic `SnapGrid` (never place accidental nodes while orbiting), bidirectional hover highlight (`#93C5FD`) between `Nœuds`/`Poutres` tables and 3D viewport, `CadImportDialog` supporting `.dxf`, `.step`/`.stp`, and `.igs`/`.iges` with optional `"Encastrer le nœud le plus à gauche"` + undoable `zundo` import, and `"Suivant : Définir les liaisons →"`.
   - **Step 2 (`supports.tsx`):** 4 primary quick-preset cards (`Encastrement`, `Rotule`, `Appui simple Z`, `Glissière`) + grouped **15-preset RDM 7 selector** (Appuis simples XY/XZ/YZ, Glissants X/Y/Z, Glissières X/Y/Z, Pivots X/Y/Z, Personnalisée) synced with `2×3` DOF checkboxes, 3D node click-to-restrain, `"Tout supprimer"` (undoable), and `"Suivant : Définir les charges →"`.
   - **Step 3 (`loads.tsx`):** Quick scenarios (`Poids propre seul 1g -Z`, `Transport 0,8g X / 1,5g -Z`) + `(ax, ay, az)` `g`-acceleration form wired to `AccelerationField`, 3-axis nodal (`Fx, Fy, Fz` kN) & beam (`qx, qy, qz` kN/m + `Ponctuelle a/L`) forms, `"Vider les charges"` (undoable), and primary CTA `"Lancer le calcul 3D & Eurocode 3 →"`.
   - **Step 4 (`results.tsx`):** 6 eigenmodes (`Mode propre 1..6`) alongside `ELU` & `ELS` with harmonic `Play/Pause`, plus **3 calibrated thermal scale modes** (`Taux EC3 (0 → 1,00)`, `Contrainte σvM (0 → fy)`, `Auto (0 → Max)`) driven by the solver's real `max_sigma_vm` & `utilization`.
   - **`impeccable` Craft Audit & Polish:** Inspect every inspector panel, spacing rhythm (`8px` grid), border contrast (`1px #E2E8F0`), button hierarchy, and empty/dense table states across Steps 1–5 against `.agents/skills/impeccable/SKILL.md`, eliminating any nested-box clutter or raw form controls.

5. **Add Regression Tests & Verify All Gates (`G0 → G6`, `AGENTS.md` §4):**
   - Add Rust tests for `step_importer` (ASCII STEP `LINE` extraction + `mm → m` scaling) and `AccelerationField` inertial force equilibrium, plus Playwright E2E assertions for duplicate-beam guard, responsive resize navigation, 15 RDM 7 support presets, and quick load scenarios.
   - Run all gates to 100% green:
     - `cargo fmt --all --check && cargo clippy --workspace --all-targets --all-features -- -D warnings`
     - `RUSTFLAGS="-D warnings" cargo test --workspace --all-features`
     - `wasm-pack build bindings/rdm-wasm --target web --out-dir ../../apps/web/src/wasm-pkg`
     - `pnpm --filter web exec oxfmt --check && pnpm --filter web exec oxlint --deny-warnings && pnpm --filter web exec tsr generate && pnpm --filter web i18n:extract && pnpm --filter web i18n:compile && pnpm --filter web exec tsc --noEmit && pnpm --filter web test:unit && pnpm --filter web test:e2e`

6. **Handoff & Archive (Leave Tree Dirty — No Commits):**
   - Update `STATUS.md` (`v1.2.0` complete), write `.github/pr-body.md` and `ship.toml` (1 dirty file per `[[commit]]`, ordered by dependency), run `ship validate` until exit `0`, and zip the full clean tree (`rdm-studio-v1.2.0-<SHA>.zip`, excluding only `.git/`, `target/`, `node_modules/`, caches) into the downloads folder with zip contents proof.
