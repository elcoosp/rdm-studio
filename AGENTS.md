# AGENTS.md — RDM Studio Autonomous Engineering Playbook

This repository (`rdm-studio`) is a **Local-First 3D Finite Element & Eurocode 3 Structural Engineering Workstation** built as a polyglot monorepo (**Rust / WASM + React 19 / TypeScript 7 / Three.js R3F**).

---

## 1. Source of Truth Documents (Read First)

- **`STATUS.md`** — Current milestone ledger (`M0..M8`), verified green gates, and the exact next milestone to implement.
- **`docs/ROADMAP.md`** — Definitive M14–2029 engineering roadmap, §3 physics/security fixes, locked product decisions, and accelerated Q1 2027 Tauri desktop milestone.
- **`ARCHITECTURE.md`** — Canonical module layout (§5), milestone roadmap (§18), Vite/Lingui/PWA config (§19.1–§19.3), and SI domain contracts (§19.4).
- **`DESIGN.md`** — _Swiss Metrology Workstation_ daylight tokens (`#F8FAFC` canvas, `#FFFFFF` panels, `1px #E2E8F0` hairlines, `#1D4ED8` Deep Cobalt accent), typography (`Inter` + `JetBrains Mono` `tabular-nums`), responsive mobile `100dvh` + `BottomSheet`, and v1.1 ergonomics (§7).
- **`mockups/`** — Visual reference screens (9 desktop, 5 mobile `390×844`, and `mockups/icons-sheet.html` containing the exact 32 `<svg viewBox="0 0 24 24">` engineering icons).

---

## 2. Non-Negotiable Architecture & Safety Invariants

1. **Pure Rust Core & Strict SI Units:**
   - All physics, sparse Cholesky (`faer`), modal analysis, 2D cross-section stress grids, DXF parsing, and Eurocode 0 / Eurocode 3 logic live exclusively under `crates/` in strict SI units (`m`, `N`, `Pa`, `rad`, `kg/m³`).
   - Display conversions (`mm`, `kN`, `MPa`) and locale formatting (`Intl.NumberFormat`) live exclusively in `apps/web/`.
2. **Zero Panics in WASM:**
   - **Never** use `.unwrap()`, `.expect()`, `todo!()`, or `panic!()` in `crates/rdm-solver`, `crates/rdm-cad`, or `bindings/rdm-wasm`. Propagate typed `thiserror` domain errors.
   - Zero `#[allow(...)]` or `#[expect(...)]` attributes outside `[lints.clippy]` in `Cargo.toml` (use `clippy::pedantic` instead of bare `pedantic` in Rust 1.100+).
3. **Zero Hardcoding:**
   - All Eurocode profile dimensions (`EN 10365`, `EN 10210`, `EN 10056`) and material properties (`EN 1993-1-1`, `EN 1993-1-4`, `EN 1999-1-1`) live in `crates/rdm-eurocode/data/*.json`.
4. **Known Build & Dependency Guardrails (Already Solved — Do Not Regress):**
   - **`faer` WASM compatibility:** Keep `default-features = false` on `faer` in `Cargo.toml` so `rand`/`rayon`/`spindle` do not break `wasm32-unknown-unknown`.
   - **Vite 8 plugin order (`apps/web/vite.config.ts`):** `TanStackRouterVite` MUST precede `@vitejs/plugin-react-swc` (with `@lingui/swc-plugin`). Keep `workbox.maximumFileSizeToCacheInBytes: 15 * 1024 * 1024` for `.wasm` caching and `optimizeDeps.exclude: ["rdm-wasm", "occt-import-js", "@takumi-rs/wasm"]`.
   - **Valibot v1 API:** Use `v.parse(SearchParamsSchema, search)` (never `Schema.parse(...)`).
   - **i18n (`fr` default, `en` secondary):** Keep `compileNamespace: "es"` in `lingui.config.ts` (prevents `module.exports` crash in Vite 8 ESM) and wrap all user-facing strings in Lingui macros (`t`, `<Trans>`). Never use ALL-CAPS eyebrow kickers in UI copy (`DESIGN.md` §1).
   - **`shadcn/ui` Component Primitives:** Use `shadcn/ui` (`apps/web/src/components/ui/*` + `components.json` for Tailwind v4) for all interactive UI controls (`Select`, `Dialog`, `Command`, `Tabs`, `Switch`, `Slider`, `Tooltip`, `Sheet`, `Table`), themed strictly with `DESIGN.md` tokens (`#1D4ED8` Cobalt, `4px` radius, `1px #E2E8F0` borders).
   - **Vector PDF & Offline Fonts:** Use `takumi-pdf` (`PdfRenderer`, NOT `@takumi-rs/wasm` raster output) with bundled `.ttf` fonts (`Inter` + `JetBrains Mono`) included in Workbox `globPatterns` (`ttf`).
   - **Standalone 3D HTML Export:** `three@0.187` ships `build/three.module.js` (no `three.min.js`); inline it via `<script type="module">`.
   - **3D Gizmo & WebGL Graceful Fallback:** Always wrap `<GizmoViewport />` inside `<GizmoHelper alignment="top-right" margin={[72, 72]}>` (never bare inside `<Canvas>`, which renders a 1m RGB block at `(0,0,0)`), and guard `<Canvas>` with a WebGL capability check + ErrorBoundary so headless GPU failures degrade gracefully. Run Playwright on `chromium` and `firefox` (skip `webkit` in rootless containers lacking GTK4/GStreamer system libs, and guard mobile synthetic touch-drag assertions with `test.skip(browserName !== "chromium")` because Firefox headless touch-emulation locks Motion `drag="y"` pointers).
   - **Clean Full-File Edits & `oxfmt` Whitespace:** `oxfmt` formats `.ts`/`.tsx` with 2-space indentation; prefer writing clean complete files or matching 2-space indentation rather than unasserted regex/tab replacements. Set `touch-action: none` on `BottomSheet` drag handles and `reuseExistingServer: !process.env.CI` in `playwright.config.ts`.
   - **44 Custom Engineering Icons:** Port the exact `<svg viewBox="0 0 24 24">` paths from `mockups/icons-sheet.html` (32) and `mockups/icons-sheet-v2.html` (12) into `apps/web/src/components/icons/EngineeringIcons.tsx` (`strokeWidth="1.5"`, `#0F172A` + `var(--color-accent)`).
   - **WASM Enum Serialization (`Load`):** Never return `Vec<rdm_model::Load>` directly via `serde_wasm_bindgen::to_value` (`#[serde(tag = "kind")]` + `#[serde(flatten)]` emits `{}`); serialize via `serde_json::to_string` in Rust and `JSON.parse` in TypeScript.
   - **`NumberFlow` Shadow DOM:** Keep `data-value={String(value)}` on `NumberFlowValue` so E2E tests can read numeric values directly without piercing Shadow DOM.
   - **Collinear `X`-Beam Torsion (`Rx`):** Every collinear `X`-axis template/quick-start model must lock `Rx` (`locked_dofs[3] = true`) on at least one support.
   - **Lingui Live Locale Re-render:** Shared header/overlay components using `t` macros must invoke `useLingui()` so they re-render immediately when `activateLocale` switches `FR ↔ EN`.
   - **Zero Raw HTML Form/Overlay Primitives:** Never emit raw `<select>`, `<details>`, `<input type="checkbox">`, `<input type="range">`, or hand-rolled `<div role="dialog">` in `apps/web/src/{components,routes,viewport3d}`; always use `@/components/ui/*` (Base UI) and `@/components/interior/*`, preserving locked E2E selectors (`N1`, `N2`, `combination-selector`, `sls-limit-selector`, `scale-modes`, `clear-supports`, `clear-loads`, `hero-cta`, `showcase-*`, `launch-*`, `.driver-popover-rdm`).
   - **Context-Lean Wave Execution:** Always prepend `$HOME/.cargo/bin` to `PATH` before probing `cargo`/`wasm-pack`/`ship`, and read files per-wave (in parallel) rather than reading the entire repo upfront.

---

## 3. Execution Philosophy (Direct-to-Green, No Ceremonial TDD Stalls)

- Ship as many consecutive complete milestones (`M_k`, `M_{k+1}`, ...) as context allows in one session, leaving zero partial or stubbed milestones.
- Implement clean, idiomatic code directly alongside comprehensive tests (`approx` at `1e-12`, `proptest` invariants, `insta` snapshots, `vitest` + `linkedom`, `playwright` E2E) so tests pass green on the first run.
- On `apps/web` routes, build real functional vertical-slice UI wired to the WASM Worker rather than placeholder text; omit unbuilt later-milestone widgets until their milestone.

---

## 4. Mandatory Quality Gates (Run for All Touched Layers — 0 Warnings)

- **G0 (Format & Lint):**

  ```bash
  cargo fmt --all --check && \
  cargo clippy --workspace --all-targets --all-features -- -D warnings && \
  pnpm --filter web exec oxfmt --check && \
  pnpm --filter web exec oxlint --deny-warnings
  ```
- **G1 (Rust Tests):** `RUSTFLAGS="-D warnings" cargo test --workspace --all-features`
- **G2 (WASM Build):** `wasm-pack build bindings/rdm-wasm --target web --out-dir ../../apps/web/src/wasm-pkg`
- **G2.5–G5 (Web Routing, i18n, Types & Unit):**

  ```bash
  pnpm --filter web exec tsr generate && \
  pnpm --filter web i18n:extract && \
  pnpm --filter web i18n:compile && \
  pnpm --filter web exec tsc --noEmit && \
  pnpm --filter web test:unit
  ```
- **G6 (Browser E2E — when UI flows, 3D, PWA, or exports change):** `pnpm --filter web test:e2e`

---

## 5. Handoff & `ship.toml` Packaging Rules (Do Not Commit)

1. Update **`STATUS.md`** with completed milestones, verified gate results, and the exact next milestone.
2. Author **`.github/pr-body.md`** (gitignored) with reviewer-facing codebase documentation (reconciliation, milestones shipped, modules/seams, test evidence, remaining gaps, ending with `Per-file history lives on <BRANCH>.`).
3. Overwrite **`ship.toml`** (gitignored) with `base_commit = "<git rev-parse HEAD>"`, valid Conventional Commits (`subject ≤ 72` chars), and **exactly one `[[commit]]` block per dirty file** (including `ship.toml`, `.github/pr-body.md`, `STATUS.md`), ordered by dependency (`types → impl → tests → config/STATUS.md`).
4. Run `command -v ship >/dev/null 2>&1 || cargo install --git https://github.com/elcoosp/ship` and `ship validate` while the tree is dirty until exit `0`.
5. Create `rdm-studio-<SLUG>.zip` in the downloads folder containing `git ls-files` plus all untracked files (`ship.toml`, `.github/pr-body.md`, `STATUS.md`, and new source/test/config files), excluding only `.git/`, `target/`, `node_modules/`, and caches.

---

## 6. Release Process: Git Audit, Banners, GFM Notes, Manifest Bumps & GitHub Releases

Every tagged release (`vX.Y.Z`) follows a deterministic 5-step pipeline using Git history (`vPREV..HEAD`), `@rdm-studio/brand-studio` (`packages/brand-studio`), and `gh release`:

1. **Audit `git log` & `git diff` Since the Previous Release (`vPREV..HEAD`):**
   - Identify the previous tag (`vPREV=$(git describe --tags --abbrev=0)`) and inspect the full commit list, diff summary, and touched modules so every banner highlight and changelog claim is grounded in the exact code shipped:
     ```bash
     vPREV=\$(git describe --tags --abbrev=0)
     git --no-pager log --no-merges --oneline "\${vPREV}..HEAD"
     git --no-pager diff --stat "\${vPREV}..HEAD" -- ':!*.po' ':!*.po.ts' ':!pnpm-lock.yaml'
     git --no-pager diff --shortstat "\${vPREV}..HEAD" -- ':!*.po' ':!*.po.ts' ':!pnpm-lock.yaml'
     ```
   - Group the commits by subsystem (`crates/`, `bindings/rdm-wasm/`, `packages/ui/`, `apps/web/`, `apps/site/`, `apps/docs/`, `e2e/`) to derive the banner `title`, `subtitle`, 3–4 `highlights`, governing `standards`, and the GFM Architecture & Release Matrix.

2. **Align All Monorepo Manifests (`X.Y.Z`):**
   - Bump `"version"` to `"X.Y.Z"` across all 7 workspace manifests:
     - `package.json`
     - `apps/web/package.json`
     - `apps/docs/package.json`
     - `apps/site/package.json`
     - `packages/ui/package.json`
     - `Cargo.toml` (`[workspace.package]`)
     - `crates/rdm-cad/Cargo.toml`
   - Run `cargo check --workspace --quiet` to sync `Cargo.lock`.

3. **Output Copy-Pasteable Google Stitch Illustration Prompt & Render `1280×640` Banner (`@rdm-studio/brand-studio`):**
   - Register the release metadata (`version`, `title`, `subtitle`, `tags`, `stitchIllustrationPrompt`) derived from Step 1 in `packages/brand-studio/src/releases.ts`.
   - Output a ready-to-copy Google Stitch prompt prefixed with the version screen label (`vX.Y.Z` so the exported file is named `vX.Y.Z.png` in Downloads) instructing Stitch to produce a pure isometric illustration on a solid `#FFFFFF` background with zero rendered text, numbers, or logos.
   - Once the user provides the exported Stitch PNG (via chat upload or `~/Downloads/vX.Y.Z.png`), save the raw image into `docs/releases/illustrations/raw/vX.Y.Z.png` (gitignored) and run border-connected flood-fill alpha cutout (`PIL`/`scipy`/`cv2`) to save the transparent-background PNG at `docs/releases/illustrations/vX.Y.Z.png`.
   - Render the final `1280×640` banner compositing `docs/releases/illustrations/vX.Y.Z.png` via:
     ```bash
     pnpm --dir packages/brand-studio render -- --version vX.Y.Z
     ```
     producing `docs/releases/banner-vX.Y.Z.png`.

4. **Author GitHub-Flavored Markdown Release Notes (`docs/releases/notes/vX.Y.Z.md`):**
   - **Never alter historical release notes** (`v1.0.0.md` through `v2.4.0.md`).
   - Create `docs/releases/notes/vX.Y.Z.md` from the Step 1 `vPREV..HEAD` audit following the canonical GFM template:
     - Clickable `1280×640` banner image pointing to `https://githubusercontent.com` + top navigation bar (`Launch 3D Studio ↗`, `Documentation ↗`, `Overview & Benchmarks ↗`, `Full Diff`, `Sponsor ♥`).
     - `> [!NOTE]` Release Summary with governing Eurocode/RDM standards.
     - `## Architecture & Release Matrix` GFM table with verified `blob/main/...` repository links.
     - `## Detailed Engineering Changelog` grouped by milestone deliverables from `vPREV..HEAD`.
     - `> [!TIP]` Zero-Cloud Local-First Execution callout, collapsible `<details>` `Commit & Diff Ledger` (`git --no-pager log --no-merges "${vPREV}..HEAD"` + `git --no-pager diff --shortstat "${vPREV}..HEAD"`), and footer links.

5. **Tag & Publish on GitHub (`gh release`):**
   - Commit manifest bumps, `packages/brand-studio/src/releases.ts`, `docs/releases/illustrations/vX.Y.Z.png`, `docs/releases/banner-vX.Y.Z.png`, and `docs/releases/notes/vX.Y.Z.md` to `main`.
   - Create annotated tag and push:
     ```bash
     git tag -a vX.Y.Z -m "RDM Studio vX.Y.Z — <Release Title>"
     git push origin main
     git push origin vX.Y.Z
     ```
   - Demote the previous release and publish `vX.Y.Z` as `Latest`:
     ```bash
     gh release edit "\${vPREV}" --latest=false
     gh release create vX.Y.Z docs/releases/banner-vX.Y.Z.png \
       --verify-tag \
       --title "RDM Studio vX.Y.Z — <Release Title>" \
       --notes-file docs/releases/notes/vX.Y.Z.md \
       --latest
     ```
