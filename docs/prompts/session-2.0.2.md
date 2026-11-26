Task: github.com/elcoosp/rdm-studio. Ship v2.0.2 — final production-grade polish: fix every visual defect captured in the 5-step browser video (purge all dark-mode `bg-slate-900` cards leaking into the Daylight UI, anchor `<GizmoHelper>` cleanly in the bottom-right corner, move Step 4's combination/scale bar out of the 3D HUD into the Step 4 header, fit `uPlot` + legend cleanly inside the `220px` dock, cache the 3D snapshot on route exit so Step 5's A4 sheet shows a real 3D render instead of a blank box, fix `FamilyPills` full-width placement, replace the black-bordered `CadToolbar` row with a sleek Swiss Metrology segmented strip + `Outils ▾` menu, restore `FR | EN` in the header, add sleek `6px` custom scrollbars, upsize all engineering & Lucide icons to `18–24 px`), fix all 9 physics/audit bugs (including the `Extrusion` infinite-loop tab freeze), verify actual PNG screenshots across all 5 screens, and pass 100% of `G0 → G6` + `vite build` + `ship validate`:

EXECUTION CONTRACT (NON-NEGOTIABLE — 100% AUTONOMOUS, SINGLE BUILD TREE):

- **ZERO QUESTIONS / FULL AUTONOMY:** Operate autonomously end-to-end from bootstrap to final `.zip` archive without prompting.
- **SINGLE SHARED BUILD TREE:** Execute inside the single `rdm-studio` working tree (never create parallel `git worktree` directories).
- **STRICT SWISS METROLOGY DAYLIGHT TOKENS (`DESIGN.md`):** Purge ALL raw `dark:*`, `bg-slate-900`, `border-slate-*`, `text-slate-*`, and `bg-blue-600` classes from `apps/web/src/components/` and `apps/web/src/routes/` — every card, rail, popover, and modal MUST use `bg-panel` (`#FFFFFF`), `bg-panel-subtle` (`#F1F5F9`), `border-hairline` (`1px #E2E8F0`), `text-ink-primary` (`#0F172A`), `text-ink-secondary` (`#475569`), and `bg-accent` (`#1D4ED8`).
- **STRICT SI & ZERO PANICS:** Keep strict SI units (`m`, `N`, `Pa`, `rad`, `kg/m³`) and zero `.unwrap()` / `.expect()` / `panic!()` in `crates/` and `bindings/rdm-wasm`.
- **FAST SANDBOX PLAYWRIGHT (`AGENTS.md` §4):** Run Playwright strictly with `--project=chromium --project=firefox --reporter=list`.
- Write complete, clean files (never blind regex/tab patches) to avoid `oxfmt` whitespace no-ops.

1. **Bootstrap & Sync (< 3 tool calls):**
   - `cd rdm-studio && git fetch origin && git reset --hard origin/main` (or clone `https://github.com/elcoosp/rdm-studio.git` if missing).
   - Ensure `rustc`/`cargo`, `wasm-pack`, `pnpm`, and `ship` (`command -v ship >/dev/null 2>&1 || cargo install --git https://github.com/elcoosp/ship`) are installed, then read `AGENTS.md`, `DESIGN.md`, `STATUS.md`, and `.agents/skills/impeccable/reference/craft-floor.md`.

2. **Wave 1 — Rust Envelope Multipliers & Real `member_calc_trace` (`crates/rdm-solver/src/envelopes.rs`, `bindings/rdm-wasm/src/lib.rs`):**
   - Update `compute_envelopes` in `crates/rdm-solver/src/envelopes.rs` to call `crate::section_cut::superimposed_beam_state(structure, solved, weights, index)` so `span_state` includes weighted `Variable` / `Wind` / `Snow` distributed loads in addition to `Permanent`.
   - Update `member_calc_trace` in `bindings/rdm-wasm/src/lib.rs` to derive real `n_ed`, `my_ed`, `mz_ed`, `chi_y`, `chi_z`, `chi_lt`, `n_b_rd_y`, `n_b_rd_z`, `mc_y_rd`, `mc_z_rd`, and `lambda_bar` from the solved beam forces and Eurocode buckling curves, then rebuild `wasm-pack`.

3. **Wave 2 — Fix All 9 Video Visual Bugs, `extrude` Infinite Loop, Icon Sizing & Audit Bugs (`apps/web/src/`):**
   - **A. Fix `extrude` Infinite-Loop Freeze (`apps/web/src/modeling/cadTools.ts`):** Iterate over `model.beams` instead of `clone.beams` in `extrude.apply` so clicking `"Extruder"` never freezes the browser tab, and add a unit test in `viewport3d.test.ts`.
   - **B. Purge All Dark-Mode `bg-slate-900` / `border-slate-*` Leaks Across the App:**
     - Rewrite `AdvancedPanels.tsx`, `ReportBuilder` (`report.tsx`), `EnvLoadGenerators` (`loads.tsx`, using realistic Eurocode defaults: `Neige sk = 0,45 kN/m²`, `Vent vb = 26 m/s`, `Imposée cat. B = 3,0 kN/m²`), `OptimizerModal.tsx`, `ScenarioCompareModal.tsx`, `ValidationModal.tsx`, `SettingsPopover.tsx`, `FamilyPills.tsx`, `ProjectGalleryModal.tsx`, and `ForceDiagrams3D.tsx` using pure `DESIGN.md` Daylight tokens (`bg-panel`, `bg-panel-subtle`, `border-hairline`, `text-ink-primary`, `text-ink-secondary`, `bg-accent text-white`) — zero `dark:*` or `bg-slate-900` classes anywhere.
   - **C. Sleek Swiss Metrology `CadToolbar` & Custom `6px` Scrollbars (`CadToolbar.tsx`, `app.css`):**
     - Replace the raw 10-button black-bordered `CadToolbar` row with a refined `DESIGN.md` hairline tool strip (`flex items-center justify-between gap-2`):
       - Left segmented group (`inline-flex items-center rounded-[4px] border border-hairline bg-panel divide-x divide-hairline`): the 5 primary CAD actions (`Polyligne`, `Extruder`, `Déplacer`, `Rotation`, `Miroir`) with `16px` `lucide-react` icons (`Spline`, `BoxSelect`, `Move`, `RotateCw`, `FlipHorizontal2`), subtle `hover:bg-accent-tint hover:text-accent` states, and a compact Base UI `DropdownMenu` (`Outils ▾`) holding the 5 secondary actions (`Répétition linéaire`, `Fusionner doublons`, `Copier au curseur`, `Sélection similaire`, `Isoler`).
       - Right compact parameter & help group: unit-aware `Input` (`h-7 w-16 font-data text-[12px]`, default `4m`), live status pill (`text-[11px] text-ink-muted`), and `?` shortcut cheat-sheet trigger (`h-7 w-7 rounded-[4px] border border-hairline text-ink-secondary hover:border-accent hover:text-accent`).
     - Target `selection.nodeId` / `selection.selectedBeamIds` in `runCommand("move")`.
     - Add `scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent;` and `6px` `::-webkit-scrollbar` rules in `app.css`.
   - **D. Fix Header Clipping (`FR | EN`), Step 1 `FamilyPills`, Step 4 Layout & Step 5 3D Snapshot:**
     - **Header (`__root.tsx`, `SettingsPopover.tsx`):** Shorten `"Réglages normatifs"` to `"Réglages"`, hide `"Validation"` label below `xl` (keep `16px` `BadgeCheck` icon), and keep `LocaleSwitch` (`FR | EN`) `shrink-0` and 100% visible at `1280×900` and `860×900`.
     - **Step 1 (`geometry.tsx`):** Place `<FamilyPills>` full-width **above** `<div className="grid grid-cols-[112px_1fr] ...">`, keep `+ Nœud` + `X / Y / Z` on one clean row, and remove the duplicate `<h3>` inside `DataDock` with compact `h-6 w-16` coordinate inputs.
     - **3D Gizmo (`ViewportCanvas.tsx`):** Anchor `<GizmoHelper alignment="bottom-right" margin={[44, 44]}>` with `<GizmoViewport scale={0.75} ... />` cleanly in the bottom-right corner so it never floats over the center of the viewport.
     - **Step 4 (`results.tsx`):** Move the combination/eigenmode selector (`1.35G + 1.50Q`) and thermal scale toggles (`Taux EC3 | σvM / fy | Auto`) out of the floating 3D HUD into Step 4's top control bar so `LayerToolbar` never collides with them, and set `uPlot` chart height to `122 px` (`height: 122`) so the chart + legend fit cleanly inside the `220px` bottom dock with zero vertical clipping.
     - **Step 5 (`stageStore.ts`, `PersistentStage.tsx`, `report.tsx`):** Cache `lastSnapshot` (`string | null`) inside `stageStore.ts` whenever the active stage renders on `/geometry`, `/supports`, `/loads`, or `/results` (before hiding on `/report`), so Step 5's A4 sheet (`report-3d-snapshot`) and Takumi PDF always embed a crisp, populated 3D render instead of a blank box.
   - **E. Upsize All Engineering & Lucide Icons (`18–24 px`) + 12-Template Supports + Scenario Mass:**
     - Set default `size = 22` in `EngineeringIcons.tsx` and use `18–22 px` on cards, presets, load tabs, and section headers, and `16–18 px` on toolbar/header controls across all routes and modals.
     - Add canonical `supports` to all 12 templates in `apps/web/src/lib/engineeringTemplates.ts` and load them in `ProjectGalleryModal.tsx`; compute exact mass in `ScenarioCompareModal.tsx` via `computeModelMassKg`.

4. **Wave 3 — Real Legacy `.rdm` v1 Drop Test, Actual Visual Screenshot Eyeball Loop & Full Green Gate Run (`G0 → G6` + `vite build`):**
   - Update `apps/web/e2e/real-world-scenarios.spec.ts` so the legacy `.rdm` v1 test dispatches a real `.rdm` file drop (`DataTransfer` with `version: 1` JSON) and verifies migration, solve, `.docx`, `IFC4`, and `.rdm` exports, plus add a Playwright test clicking `"Extruder"` on `/geometry` and asserting the page remains responsive and doubles nodes/beams.
   - **Mandatory Screenshot Eyeball Pass:** Build (`pnpm --filter web build`), capture PNG screenshots of `/geometry`, `/supports`, `/loads`, `/results` (solved), `/report`, and `ProjectGalleryModal` across `1440×900`, `860×900`, and `390×844` into `/tmp/v202-eyeball-*.png`, **open and visually inspect the PNG images** to verify zero dark-mode cards, zero ugly black borders, zero clipped controls (`FR | EN` visible), anchored bottom-right gizmo, non-blank Step 5 3D snapshot, sleek `6px` scrollbars, crisp `18–24 px` icons, and balanced hierarchy; polish any visual flaw found, re-verify the screenshots, and remove temporary `/tmp/v202-eyeball-*.png` files before packaging.
   - Run EVERY gate sequentially and verify **0 errors, 0 warnings, 0 failed tests**:
     - `cargo fmt --all --check && cargo clippy --workspace --all-targets --all-features -- -D warnings`
     - `RUSTFLAGS="-D warnings" cargo test --workspace --all-features`
     - `wasm-pack build bindings/rdm-wasm --target web --out-dir ../../apps/web/src/wasm-pkg`
     - `pnpm --filter web exec oxfmt --check && pnpm --filter web exec oxlint --deny-warnings && pnpm --filter web exec tsr generate && pnpm --filter web i18n:extract && pnpm --filter web i18n:compile && pnpm --filter web exec tsc --noEmit && pnpm --filter web test:unit`
     - `pnpm --filter web exec playwright test --project=chromium --project=firefox --reporter=list`
     - `pnpm --filter web build`

5. **Strict Handoff, `ship.toml` Packaging & Full `.zip` Verification (Leave Tree Dirty — No Commits):**
   Utilisez le code avec précaution.
   • NEVER commit (git log -1 stays at base_commit). Leave the working tree dirty with all changes ready for ship.
   • Update STATUS.md with v2.0.2 completed and the full green Playwright + build gate counts.
   • Author .github/pr-body.md (gitignored): reviewer-facing documentation of the codebase changes ONLY (zero ship.toml, gate, or branch ceremony narration), ending with:
   Per-file history lives on fix/v202-final-polish.
   • Overwrite ship.toml at repo root (gitignored) following these exact ship validate rules:toml
   [delivery]
   branch = "fix/v202-final-polish"
   pr_title = "fix: complete v2.0.2 visual polish, extrude fix and E2E gates"
   pr_body = ".github/pr-body.md"
   base_commit = "<40-char output of git rev-parse HEAD>"

[[commit]]
message = "fix(scope): specific description of this single file change"
files = ["path/to/dirty/file"]
Utilisez le code avec précaution.

    • CRITICAL ship.toml RULES (enforced by ship validate):
    	1. base_commit MUST be the exact 40-character SHA from git rev-parse HEAD.
    	2. pr_title MUST follow Conventional Commits (fix: ...) and be ≤ 72 characters.
    	3. Every [[commit]] message MUST follow Conventional Commits (type(scope): subject, ≤ 72 chars) and describe that specific file's change.
    	4. EXACTLY ONE [[commit]] block per dirty file (covering every modified and untracked file in git status --porcelain, INCLUDING STATUS.md, .github/pr-body.md, and ship.toml), with strictly one path in files = ["..."] (zero multi-file commits, zero duplicate files, zero clean files).
    	5. Order the [[commit]] blocks by dependency (crates/ → bindings/rdm-wasm/ → apps/web/src/lib/ & modeling/ & components/ → apps/web/src/routes/ → apps/web/e2e/ → STATUS.md → .github/pr-body.md → ship.toml).
• Run ship validate while the tree is dirty and fix any reported issue until ship validate exits 0.
• Create rdm-studio-v2.0.2-<SHORT_SHA>.zip in the downloads folder containing git ls-files PLUS explicit enumeration of all untracked files (ship.toml, .github/pr-body.md, STATUS.md, and any new files — do NOT rely solely on --others --exclude-standard), excluding ONLY .git/, target/, node_modules/, and caches. Verify with unzip -t and unzip -l that Cargo.toml, Cargo.lock, .gitignore, .github/workflows/ci.yml, crates/, apps/web/src/, ship.toml, and .github/pr-body.md are present and zero target/ or .git/ files leaked.
