Task: github.com/elcoosp/rdm-studio. Maximum-velocity, plan-aligned implementation following `AGENTS.md`, `ARCHITECTURE.md`, `DESIGN.md`, and `./mockups/`.

1. **Bootstrap & Sync (< 3 tool calls):**
   - If `rdm-studio` is not cloned locally, `git clone https://://github.com.git && cd rdm-studio`; if it already exists, `cd rdm-studio && git fetch origin && git reset --hard origin/main` so `HEAD` matches your latest pushed `main` (with M10 & `SpectralLogoCube` landed).
   - Ensure `rustc`/`cargo` (`wasm32-unknown-unknown`, `rustfmt`, `clippy`), `wasm-pack`, `pnpm`, and `ship` (`cargo install --git https://github.com`) are installed, then read `STATUS.md` and `git log -5 --oneline` to confirm `HEAD` and prepare **Milestone M11 (Session 3 of 3 — Composite Cross-Section Studio _Sections Droites_, Client-Side Branded Calculation Note & Full E2E Sweep)**.

2. **Ship Complete Milestone M11 (Composite Cross-Section Engine + Visual _Sections Droites_ Studio + Client Calculation Note & Full E2E Sweep):**
   Implement all 4 deliverables below direct-to-green with full Rust `cargo test`, Vitest unit tests, and Playwright E2E tests (zero stubs, zero `.unwrap()`/`.expect()`/`panic!()` in `crates/rdm-solver`, `crates/rdm-cad`, or `bindings/rdm-wasm`, zero `#[allow(...)]`/`#[expect(...)]` outside `Cargo.toml`, zero raw HTML primitives `<select>`, `<details>`, `<input type="checkbox">`, `<input type="range">` in `apps/web/src/`, zero ALL-CAPS text, strict SI units in state/WASM):
   - **M11.1 — Multi-Element Composite Cross-Section Engine (`crates/rdm-cad/src/sections.rs` + `bindings/rdm-wasm`):**
     - Implement exact analytical cross-section mechanics for multi-element built-up sections (`CompositeSectionDef` composed of $1..N$ sub-elements with local offset $(\Delta y, \Delta z)$ in `m`, rotation $\theta$ in `rad`, mirror flags, and standard EN 10365/10210/10056 profiles, parametric plates $b \times t$, `CHS`, `RHS`/`SHS`):
       - Total cross-sectional area $A = \sum A_i$ (`m²`) and linear mass $m$ (`kg/m`).
       - Centroid coordinates $(y_G, z_G)$ (`m`).
       - Centroidal second moments of area $I_y, I_z, I_{yz}$ (`m⁴`) via parallel-axis theorem (Huygens-Steiner), principal moments $(I_u, I_v)$ (`m⁴`), and principal axis angle $\alpha$ (`rad`).
       - Radii of gyration $i_y, i_z$ (`m`).
       - Extreme fiber distances $(y_{\min}, y_{\max}, z_{\min}, z_{\max})$ (`m`) and elastic section moduli $W_{el,y,\sup}, W_{el,y,\inf}, W_{el,z,\text{left}}, W_{el,z,\text{right}}$ (`m³`).
       - Exact plastic section moduli $W_{pl,y}, W_{pl,z}$ (`m³`) by bisection search for the equal-area plastic neutral axis ($\int_{A^+} f_y \, dA = \int_{A^-} f_y \, dA$), handling asymmetric built-up sections (T-sections, crane girders `HEA + UPN`, asymmetric PRS).
       - Shear areas $A_{vy}, A_{vz}$ (`m²`) per EN 1993-1-1 §6.2.6, Saint-Venant torsion constant $I_t$ (`m⁴`), and warping constant $I_w$ (`m⁶`).
       - Automatic EN 1993-1-1 Table 5.2 cross-section classification (`Class 1`, `Class 2`, `Class 3`, `Class 4`) for pure bending and pure compression across steel grades (`S235`, `S275`, `S355`, `S460`).
     - Expose `compute_composite_section` through `bindings/rdm-wasm` and persist custom composite sections on `ModelState` (`custom_sections: Vec<CompositeSectionDef>`) so beams referencing a composite section solve natively in the 3D Timoshenko WASM solver and EN 1993-1-1 verification pass.
     - Add comprehensive Rust unit tests in `crates/rdm-cad/tests/composite_sections.rs` verifying: single rectangle ($b h^3 / 12$, $W_{pl}/W_{el} = 1.5$), built-up 3-plate `IPE 300` against EN 10365 nominal properties (`< 0.5%`), asymmetric T-section centroid $y_G$ and plastic modulus $W_{pl,y}$, and rotated angle section principal axis angle $\alpha$.

   - **M11.2 — Visual _Sections Droites_ Studio (`apps/web/src/components/CompositeSectionStudio.tsx` + `geometry.tsx`):**
     - Wire an entry trigger **Studio Sections Composées** (`data-testid="open-composite-section-studio"`) in Step 1 (`apps/web/src/routes/_studio/geometry.tsx`) and in the `⌘K` command palette.
     - Build a 2-column Swiss Metrology daylight dialog (`DialogRoot` / `DialogContent`) with:
       - **Left Column — Interactive Metrological SVG Canvas (`data-testid="composite-section-svg"`):**
         - Dimensioned millimeter coordinate grid, exact vector outlines of all sub-elements (with fillets for rolled I/H/U sections), centroid reticle $G(y_G, z_G)$, centroidal axes $(y, z)$, rotated principal axes $(u, v)$, dashed amber Plastic Neutral Axis (`ANP`), and an interactive normal-stress diagram $\sigma(z) = \frac{N}{A} + \frac{M_y}{I_y} z$ driven by `NumberField` / `SliderDetents` inputs for $N$ (`kN`) and $M_y$ (`kN·m`).
       - **Right Column — Builder & Telemetry:**
         - 1-click presets (`PRS Symétrique`, `Caisson Soudé`, `2×UPN Dos-à-Dos`, `IPE + Platine Semelle`, `Chemin de Roulement HEA+UPN`).
         - Sub-element list with `NumberField` steppers ($\Delta y, \Delta z$ in `mm`, $\theta$ in `°`, plate dimensions in `mm`), add/remove controls, and `<SegmentedControl>` for steel grade (`S235` | `S275` | `S355` | `S460`).
         - Tabular telemetry readout (`font-data tabular-nums`, French comma decimal formatting in `fr`) for $A, m, y_G, z_G, I_y, I_z, I_{yz}, \alpha, W_{el}, W_{pl}, i_y, i_z, I_t, I_w$, `<StatusBadge>` for EN 1993-1-1 class, `<CopyButton>` for TSV/JSON export, and **Appliquer à la barre sélectionnée** (`data-testid="apply-composite-section"`) which assigns the composite section to active beam(s) and triggers WASM re-solve.

   - **M11.3 — Client-Side Branded Calculation Note & Vector Exports (`apps/web/src/routes/_studio/report.tsx`):**
     - Upgrade Step 5 (`report.tsx`) so the calculation note renders:
       - Official `<BrandMark />` (`/logo-rdm-studio.png`) cover header with engineer title block (project title, author, date, Eurocode scope EN 1990–1999, 3D Timoshenko WASM solver badge, certified `49 / 49` benchmark seal).
       - Dedicated **Sections Droites Composées** chapter whenever custom composite sections exist in the model, embedding the vector SVG cross-section diagram, full geometric property table ($A, I_y, I_z, W_{el}, W_{pl}, I_t, I_w$), and EN 1993-1-1 Table 5.2 classification.
       - Complete ULS/SLS envelope summary tables and member-by-member Eurocode verification checks.
     - Verify 100 % client-side exports (`0 octet cloud`):
       - **Vector A4 PDF / Print** (`window.print()` / vector print stylesheet).
       - **Structured `.docx` export** (`data-testid="export-docx-btn"`) generated client-side with native Word tables and embedded section metadata.
       - **Standalone Offline 3D HTML Model** (`data-testid="export-html-btn"`) embedding geometry, boundary conditions, and envelope results in a self-contained `.html` download.

   - **M11.4 — Full E2E Suite Sweep & M11 Playwright Contract (`apps/web/e2e/m11-composite-section-report.spec.ts`):**
     - Extract and compile Lingui i18n catalogs (`pnpm --filter web i18n:extract && pnpm --filter web i18n:compile`, zero untranslated strings in `en.po`).
     - Run the **entire Playwright E2E suite** across `apps/web/e2e/` and fix any regression (including any legacy `.svg` logo assertions updated to `/logo-rdm-studio.png` from commit `9840605b`).
     - Create `apps/web/e2e/m11-composite-section-report.spec.ts` verifying:
       1. Opening _Studio Sections Composées_ from `/geometry`.
       2. Selecting `2×UPN Dos-à-Dos` and `PRS Symétrique` presets, verifying $A, I_y, W_{el,y}, W_{pl,y}$, EN 1993-1-1 class badge, and SVG stress diagram updates.
       3. Applying the composite section to a beam, running WASM solve, and verifying the custom section chapter in `/report` plus `.docx` and standalone `.html` downloads.

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
     - `pnpm --filter site typecheck && pnpm --filter site build`
     - `pnpm --filter web exec playwright test --project=chromium --project=firefox --reporter=list` (full E2E sweep including `e2e/m11-composite-section-report.spec.ts`).
   - Fix every single error or warning until 100% green.

4. **Handoff & Archive (Leave Tree Dirty — No Commits):**
   - Leave the working tree dirty with zero commits created during this session (`git status` shows all new/modified files).
   - Update `STATUS.md` with Milestone M11 completion status and verification gate results.
   - Write `.github/pr-body.md` summarizing Milestone M11 composite cross-section engine, visual _Sections Droites_ studio, client-side branded calculation note, and full E2E sweep results.
   - Write `ship.toml` at the repo root with strictly 1 dirty file per `[[commit]]`, ordered by dependency (`crates/` → `bindings/` → `packages/ui` → `apps/web/src/` → `i18n/` → `e2e/` → `STATUS.md` → `.github/pr-body.md`).
   - Run `ship validate` until exit `0`.
   - Zip the full clean tree (`rdm-studio-m11-sections-report.zip`, excluding only `.git/`, `target/`, `node_modules/`, caches) into `~/Downloads/rdm-studio-m11-sections-report.zip` with zip contents proof.
