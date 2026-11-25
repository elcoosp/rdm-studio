Task: github.com/elcoosp/rdm-studio. Ship v1.5.0 — execute the full `impeccable` v4.0.4 `Operate`-mode design craft overhaul (`layout` + `adapt` + `polish` + `audit` + `critique` + `craft-floor.md`) across all 5 workstation routes (`geometry`, `supports`, `loads`, `results`, `report`) + responsive tablet/mobile layouts, verified by Playwright visual bounding-box & screenshot assertions following `AGENTS.md`, `ARCHITECTURE.md`, and `DESIGN.md` (§1–§8).

EXECUTION CONTRACT (NON-NEGOTIABLE — 100% AUTONOMOUS):

- **ZERO QUESTIONS / FULL AUTONOMY:** Never pause to ask the user for confirmation, routing choices, or whether to run `init`. Operate autonomously end-to-end from bootstrap to final `.zip` archive. If `context.mjs` reports `CONTEXT_STALE` or missing `PRODUCT.md`, proceed directly with `Operate` mode on the incumbent `DESIGN.md` without blocking or prompting.
- Do NOT rewrite Rust math or replace Base UI / Vaul / ResizablePanel / TanStack Table — all v1.4.0 engines and UI primitives are already in place.
- **MANDATORY `impeccable` v4.0.4 3-STEP PROTOCOL (FOLLOW VERBATIM):**
  1. **Setup (`context.mjs`):** Run `node .agents/skills/impeccable/scripts/context.mjs --target apps/web/src/routes/geometry.tsx` once (keep `cwd` at repo root) and obey its layout/token directives.
  2. **Load Command Playbooks & `Operate` Mode:** Read `.agents/skills/impeccable/SKILL.md` AND the exact playbooks owning this work:
     - `.agents/skills/impeccable/reference/operate.md` (Operate mode rules for CAD editors & engineering tools)
     - `.agents/skills/impeccable/reference/layout.md` (spacing, rhythm, visual hierarchy, split-pane geometry)
     - `.agents/skills/impeccable/reference/adapt.md` (desktop `1440×900`, split-screen `900×800`, tablet `820×1180`, mobile `390×844`)
     - `.agents/skills/impeccable/reference/polish.md` & `.agents/skills/impeccable/reference/audit.md`
     - Inspect incumbent visual truth (`DESIGN.md` §1–§8, `./mockups/`, `apps/web/src/app.css`).
  3. **Load `craft-floor.md` Immediately Before Editing UI:** Read `.agents/skills/impeccable/reference/craft-floor.md` right before modifying any `.tsx`/`.css` file, and enable the design detector hook (`node .agents/skills/impeccable/scripts/hooks.mjs on || true`) so any craft-floor violation is caught immediately.
  4. **Bounded Visual Verification Pass (Max 2 Rounds per `SKILL.md`):**
     - Capture Playwright screenshots across `1440×900`, `900×800`, `820×1180`, and `390×844` for `/geometry`, `/supports`, `/loads`, `/results`, and `/report` in one batched pass, fix every spacing/alignment/overflow defect in one batch, confirm in one final pass, and stop polishing.
- Write complete, clean files (never blind regex/tab patches) to avoid `oxfmt` whitespace no-ops.

1. **Bootstrap, Sync & Run `impeccable` Setup (< 3 tool calls):**
   - `cd rdm-studio && git fetch origin && git reset --hard origin/main` (or clone `https://github.com/elcoosp/rdm-studio.git` if missing).
   - Ensure `rustc`/`cargo`, `wasm-pack`, `pnpm`, and `ship` (`cargo install --git https://github.com/elcoosp/ship`) are installed.
   - Install `impeccable` if missing (`pnpm dlx skills add https://github.com/pbakaus/impeccable --skill impeccable -y || true`), run `node .agents/skills/impeccable/scripts/context.mjs --target apps/web/src/routes/geometry.tsx`, and read `operate.md`, `layout.md`, `adapt.md`, `polish.md`, `audit.md`, and `craft-floor.md`.

2. **Enforce `Operate`-Mode Swiss Metrology Workstation Geometry (`DESIGN.md` §4 & `./mockups/`):**
   - **A. Locked `100dvh` Workstation Shell (`__root.tsx`):**
     - Header fixed at `h-11` (`44px`), single `border-b border-hairline bg-panel`, 3 clean zones (`justify-between`): Left (`/logo-rdm-studio.svg` `24×24` + `RDM Studio` + project switcher `DropdownMenu`), Center (5 step tabs with `2px` `#1D4ED8` `layoutId` underline), Right (Undo/Redo buttons, node/beam counter, `⌘K`, `OfflinePill`, `?` 8-step tour button, active `FR | EN` pill).
     - Main workspace `flex-1 min-h-0 overflow-hidden` on desktop (`md:overflow-hidden`) so the 3D canvas NEVER gets pushed off-screen by scrolling tables.
   - **B. Consistent Left-Docked `320px` Inspector (`Steps 1, 2, 3`):**
     - On `md+` (`≥ 768px`), Steps 1 (`/geometry`), 2 (`/supports`), and 3 (`/loads`) MUST use an identical two-pane layout: **Left `320px` Inspector** (`w-80 shrink-0 h-full overflow-y-auto border-r border-hairline bg-panel p-3 space-y-3`) + **Right 3D Viewport** (`flex-1 min-w-0 h-full relative bg-canvas`).
     - Eliminate nested card borders inside the `320px` inspector: separate sections with clean `border-t border-hairline pt-3` hairlines and `12px` (`text-xs font-medium text-ink-secondary`) section headers — zero inner rounded cards stacking borders inside borders (`craft-floor.md`).
     - Align property controls into a crisp **2-column key-value grid** (`grid-cols-[112px_1fr] items-center gap-x-2 gap-y-2`): Label on left, Base UI `Combobox` / `Select` / `NumberField` (`h-8`, `4px` radius) on right.
   - **C. Step 1 (`/geometry`) Collapsible Bottom Data Grid (`@tanstack/react-table`):**
     - Place `Nœuds` / `Poutres` (`@tanstack/react-table`) inside a clean **collapsible bottom dock** (`h-44` when expanded, `h-9` tab bar `Nœuds (N) | Poutres (M)` when collapsed, with inline click-to-edit coordinates rather than permanent `<input>` boxes in every cell) so the 3D viewport commands **75%+ of the screen area**.
     - Keep all 4 viewport HUD corners strictly non-overlapping: Top-left `LayerToolbar`, Top-right `3D Iso | Dessus XY | Face XZ | Côté YZ`, Bottom-left profile legend + mouse/keyboard hint, Bottom-right `GizmoHelper` (`margin={}`).
   - **D. Step 4 (`/results`) Precision Metrology Layout (`DESIGN.md` §4 & `mockups/tape_4`):**
     - **Top Strip:** Compact 4-KPI bar (`grid-cols-2 lg:grid-cols-4 gap-2`, `p-2.5` per card, `NumberFlowValue` `tabular-nums`, inline EC3 status badge + 1-click upgrade button).
     - **Center (`flex-1 min-h-[260px]`):** Full-bleed deformed 3D viewport with a single consolidated top-right control bar (Combination/Eigenmode selector + Harmonic Play + Thermal Scale selector + Amplification slider) and bottom-center horizontal thermal legend bar (`η = 0` → `1.25`).
     - **Bottom Dock (`h-[220px] shrink-0`):** Clean 2-column split (`grid-cols-[280px_1fr] gap-3`) with the 2D `σvM` cross-section heatmap + top/neutral/bottom fiber stress readouts (`MPa`) on the left, and the `uPlot` internal-force chart (`My,Ed`, `Vz,Ed`, `N,Ed`) with exact `plot.over`-aligned cursor + `±M_Rd` capacity lines on the right.
   - **E. Step 5 (`/report`) Centered A4 Engineering Sheet (`max-w-[794px]`):**
     - Crisp white A4 sheet (`p-8`, `border border-hairline`, `space-y-5`) with `/logo-rdm-studio.svg` header, 2-column metadata grid, 5 aligned monospace engineering tables (`tabular-nums`, right-aligned numeric columns, `Copier TSV` buttons), QR code + SHA-256 model fingerprint footer, and sticky `320px` right export rail (`PDF Takumi`, `CSV Excel`, `HTML 3D`, `Imprimer`).
   - **F. Tablet (`768–1023px`) & Mobile (`< 768px`) Adaptation (`adapt.md`):**
     - Tablet (`768–1023px`): Side-by-side `280px` left inspector + live 3D viewport (never a covering bottom modal).
     - Mobile (`< 768px`): Full-bleed `100dvh - 100px` 3D viewport + non-modal `Vaul` drawer (`bottom-14`, snap points `0.35 / 0.78`) + `56px` (`h-14`) 5-tab bottom navigation bar with zero overlap.

3. **Add Playwright Layout & Visual Geometry Regression Tests (`apps/web/e2e/layout-craft.spec.ts`):**
   - Assert via `boundingBox()` across `1440×900`, `900×800`, and `390×844` that:
     1. On `1440×900`, `[data-testid="inspector-sheet"]` is docked on the left (`box.x < 40`, `box.width` between `300` and `360`) and `[data-testid="viewport-canvas"]` occupies at least `60%` of viewport width and `55%` of viewport height on Steps 1, 2, and 3.
     2. On `1440×900`, top-left `LayerToolbar` and top-right camera preset bar never intersect (`leftBox.x + leftBox.width < rightBox.x`).
     3. On `390×844`, the mobile `Vaul` drawer and `h-14` bottom navigation bar never clip or overlap interactive buttons, and `document.body.scrollHeight <= window.innerHeight + 1`.

4. **Verify All Gates (`G0 → G6`, `AGENTS.md` §4) 100% Green:**
   - `cargo fmt --all --check && cargo clippy --workspace --all-targets --all-features -- -D warnings`
   - `RUSTFLAGS="-D warnings" cargo test --workspace --all-features`
   - `wasm-pack build bindings/rdm-wasm --target web --out-dir ../../apps/web/src/wasm-pkg`
   - `pnpm --filter web exec oxfmt --check && pnpm --filter web exec oxlint --deny-warnings && pnpm --filter web exec tsr generate && pnpm --filter web i18n:extract && pnpm --filter web i18n:compile && pnpm --filter web exec tsc --noEmit && pnpm --filter web test:unit && pnpm --filter web test:e2e`

5. **Handoff & Archive (Leave Tree Dirty — No Commits):**
   - Update `STATUS.md` (`v1.5.0` complete), write `.github/pr-body.md` and `ship.toml` (1 dirty file per `[[commit]]`, ordered by dependency), run `ship validate` until exit `0`, and zip the full clean tree (`rdm-studio-v1.5.0-<SHA>.zip`, excluding only `.git/`, `target/`, `node_modules/`, caches) into the downloads folder with zip contents proof.
