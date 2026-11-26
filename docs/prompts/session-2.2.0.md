Task: github.com/elcoosp/rdm-studio. Ship v2.2.0 — migrate the ALREADY-BUILT `v2.1.2` landing page, 3D Hero, Bento Grid, pricing, and legal page verbatim from `apps/web` into a dedicated Oxide-powered package (`apps/site`, built with `elcoosp/oxide` `adapter: "static"` for sub-30 ms Vercel Edge CDN delivery and full SSR/SSG SEO on `rdm-studio.fr`), add 4 programmatic Eurocode SEO pages, streamline `apps/web` (`app.rdm-studio.fr`) to redirect `/` → `/geometry`, fix the mobile `BottomSheet` z-index occlusion above the bottom nav bar, and upgrade `ValidationModal.tsx` into a 4-tier visual-hierarchy certification view with all 41 benchmark titles translated into French:

DO NOT REINVENT OR REDESIGN THE LANDING PAGE:

- The flagship landing page (`_marketing.tsx`, `_marketing/index.tsx`, `_marketing/legal.tsx`, and `HeroViewport3D.tsx`) is ALREADY built and visually verified in `apps/web` (`v2.1.2`).
- Port those exact components, layout, Stitch PNG illustrations (`/illustrations/bento-*.png`), 3D Three.js Hero (`HeroViewport3D.tsx` wrapped as an Oxide client `<Island>`), Bento Grid, 4-tier pricing (_Découverte 0 €_, _Pass Projet 48 h 19 € HT_, _BET Pro 49 € HT/mois_, _Équipe / Intranet_), and `/legal` page directly into `apps/site`—preserving their exact markup, Swiss Metrology design tokens, copy, and visual craft while updating studio CTAs to point to `${APP_URL}/geometry` (defaulting to `https://app.rdm-studio.fr`).

EXECUTION CONTRACT (NON-NEGOTIABLE — 100% AUTONOMOUS, SINGLE BUILD TREE):

- **ZERO QUESTIONS / FULL AUTONOMY:** Operate autonomously end-to-end from bootstrap to final `.zip` archive without prompting.
- **SINGLE SHARED BUILD TREE:** Execute inside the single `rdm-studio` working tree (never create parallel `git worktree` directories).
- **STRICT SWISS METROLOGY DAYLIGHT TOKENS (`DESIGN.md`):** Zero `dark:*`, `bg-slate-900`, `border-slate-*`, or `text-slate-*` classes in `apps/site/src/` or `apps/web/src/`.
- **SSR-SAFE THREE.JS ISLAND IN OXIDE:** Wrap `HeroViewport3D` inside an Oxide client island (`apps/site/src/islands/hero-3d.tsx`) that dynamically imports Three.js/R3F only after client mount (rendering the static architectural SVG fallback during `oxide build` SSR/prerender so V8/Node never touches `window` or `WebGLRenderingContext`).
- **FAST SANDBOX PLAYWRIGHT (`AGENTS.md` §4):** Run Playwright strictly with `--project=chromium --project=firefox --reporter=list`.
- Write complete, clean files (never blind regex/tab patches) to avoid `oxfmt` whitespace no-ops.

1. **Bootstrap & Download Prebuilt `oxide` CLI (< 3 tool calls):**
   - `cd rdm-studio && git fetch origin && git reset --hard origin/main` (or clone `https://github.com/elcoosp/rdm-studio.git` if missing).
   - Download the prebuilt Linux x64 release binary `oxide-0.18.0-x86_64-unknown-linux-gnu` (or latest release tag via GitHub API) from `https://github.com/elcoosp/oxide/releases/download/v0.18.0/oxide-0.18.0-x86_64-unknown-linux-gnu` into `/usr/local/bin/oxide` (`chmod +x /usr/local/bin/oxide`), verify `oxide --version`, and export `OXIDE_BIN=/usr/local/bin/oxide` (falling back to `cargo build --release -p oxide-fw-cli` from `github.com/elcoosp/oxide` only if release download fails).
   - Ensure `rustc`/`cargo`, `wasm-pack`, `pnpm`, and `ship` (`command -v ship >/dev/null 2>&1 || cargo install --git https://github.com/elcoosp/ship`) are installed, then read `AGENTS.md`, `DESIGN.md`, and `STATUS.md`.

2. **Wave 1 — Migrate Existing `v2.1.2` Landing Page into `apps/site` Powered by Oxide (`apps/site/`):**
   - Create workspace package `apps/site` (`oxide.config.ts` with `framework: react()`, `adapter: "static"`, `@oxide-fw/tailwind`, self-hosted `Inter` + `JetBrains Mono` `.woff2` fonts in `apps/site/public/fonts/`, and Stitch PNGs copied into `apps/site/public/illustrations/`).
   - **Direct Migration from `apps/web` (Zero Reinvention):**
     - Port `apps/web/src/routes/_marketing.tsx` → `apps/site/src/routes/layout.tsx` (replacing TanStack `<Link>` with standard `<a>` / Oxide links and routing studio CTAs to `${APP_URL}/geometry` defaulting to `https://app.rdm-studio.fr`);
     - Port `apps/web/src/routes/_marketing/index.tsx` + `HeroViewport3D.tsx` → `apps/site/src/routes/index/page.tsx` + `apps/site/src/islands/hero-3d.tsx` (preserving the exact Hero, interactive 3D model switcher + `20→120 kN` load slider, 4-stat proof strip, 12-column Bento Grid with `/illustrations/bento-*.png`, 4-tier pricing with Pass Projet 48 h 19 € HT, and FAQ accordion, plus JSON-LD `SoftwareApplication` + `FAQPage` SEO metadata);
     - Port `apps/web/src/routes/_marketing/legal.tsx` → `apps/site/src/routes/legal/page.tsx`;
     - Add 4 concise programmatic SEO pages reusing the exact same layout & Bento card components (`src/routes/calcul-poutre-ipe/page.tsx`, `src/routes/calcul-portique-eurocode-3/page.tsx`, `src/routes/calcul-berceau-levage-naval/page.tsx`, `src/routes/calcul-poutre-bois-eurocode-5/page.tsx`) deep-linking into `${APP_URL}/geometry?template=...`.
   - Run `OXIDE_BIN=/usr/local/bin/oxide pnpm --filter site build` and verify prerendered HTML files (`index.html`, `legal/index.html`, `calcul-poutre-ipe/index.html`, `calcul-portique-eurocode-3/index.html`, `calcul-berceau-levage-naval/index.html`, `calcul-poutre-bois-eurocode-5/index.html`), `sitemap.xml`, and `robots.txt` are emitted cleanly.

3. **Wave 2 — Streamline `apps/web` (`app.rdm-studio.fr`), Fix Mobile `BottomSheet` Z-Index & Upgrade 4-Tier Bilingual `ValidationModal` (`apps/web/src/`):**
   - **Streamline `apps/web` Root Route (`apps/web/src/routes/_marketing/index.tsx`):** Update `/` to immediately redirect to `/geometry` (`throw redirect({ to: "/geometry", replace: true })`), keeping `LicenseModal` accessible from the studio header/settings.
   - **Fix Mobile `BottomSheet` Occlusion (`apps/web/src/components/BottomSheet.tsx`):** Raise `BottomSheet` to `z-50` above the `z-30` mobile bottom navigation bar and add `pb-[calc(52px+env(safe-area-inset-bottom))]` so the sheet, drag handle, and action buttons are 100% visible above the mobile bottom nav bar at `390×844`.
   - **Upgrade & Localize `ValidationModal.tsx` with Clear 4-Tier Visual Hierarchy (`apps/web/src/components/ValidationModal.tsx`):**
     - Invoke `useLingui()` and map every benchmark ID (`R01`..`R30`, `E01`..`E11`) to an accurate French structural-engineering title when `i18n.locale === "fr"` (and English `row.title` when `"en"`);
     - Structure the modal into 4 crisp visual tiers inside Base UI `<DialogContent className="max-w-4xl">`:
       1. _Tier 1 — Certification Header_: `/illustrations/tour-settings-benchmarks.png` (`96×54 px` framed schematic), `18px` bold title (`Certificat de Validation Analytique`), subtitle (`Timoshenko 3D · Stabilité P-Δ · Eurocode 3`), and a prominent right-aligned `28px` `JetBrains Mono tabular-nums` `41 / 41` score with an emerald `<StatusBadge>`;
       2. _Tier 2 — 4-Column Summary Strip_: `RDM & Stabilité (30/30)`, `Eurocode 3 (11/11)`, `Tolérance (< 0,10 %)`, and `Temps WASM` in `11px` uppercase muted labels above `15px` bold `tabular-nums` values;
       3. _Tier 3 — Sticky Filter Toolbar_: `<SegmentedControl>` (`Tous (41) | RDM & Flambement (30) | Eurocode 3 (11)`) paired with an instant search `<Input>`;
       4. _Tier 4 — Grouped Metrology Table_: Category section dividers (`I. RDM & Stabilité R01–R30`, `II. Eurocode 3 E01–E11`), `py-2.5` row spacing separating primary title (`13px font-medium text-ink-primary`) + Cobalt ID badge (`R01`) from right-aligned `tabular-nums` reference/computed values, miniature tolerance bar gauge, and emerald `PASS` pill, plus a `<CopyButton>` in the footer to export the full TSV certificate.
   - Run `pnpm --filter web i18n:extract`, translate **100% of `en.po` (`0` untranslated strings)**, and run `pnpm --filter web i18n:compile`.
   - Update `apps/web/e2e/marketing.spec.ts` and `apps/web/e2e/v211-polish.spec.ts` to assert: (a) `/` redirects cleanly to `/geometry`, (b) `ValidationModal` displays French titles for `R01`..`E11` under `FR` and English titles under `EN` with the 4-tier hierarchy and filter tabs, and (c) mobile `BottomSheet` at `390×844` clears the mobile bottom nav bar completely.

4. **Wave 3 — PNG Screenshot Eyeball Loop & Full Green Gate Run (`G0 → G6` + `oxide build` + `vite build`):**
   - Capture PNG screenshots of `apps/site` (`/`, `/legal`, `/calcul-poutre-ipe`, `/calcul-berceau-levage-naval` at `1440×900` and `390×844`) and `apps/web` (`/geometry` at `390×844` with `BottomSheet` open + `1440×900` with upgraded `ValidationModal` open in `FR` and `EN`) into `/tmp/v220-eyeball-*.png`, **open and visually inspect every PNG image** to verify the migrated landing page matches `v2.1.2` pixel-for-pixel, mobile `BottomSheet` clears the nav bar, and `ValidationModal` has crisp 4-tier hierarchy and French titles in `FR`, fix any blemish, and delete `/tmp/v220-eyeball-*.png`.
   - Run EVERY gate sequentially and verify **0 errors, 0 warnings, 0 failed tests**:
     - `cargo fmt --all --check && cargo clippy --workspace --all-targets --all-features -- -D warnings`
     - `RUSTFLAGS="-D warnings" cargo test --workspace --all-features`
     - `wasm-pack build bindings/rdm-wasm --target web --out-dir ../../apps/web/src/wasm-pkg`
     - `pnpm --filter web exec oxfmt --check && pnpm --filter web exec oxlint --deny-warnings && pnpm --filter web exec tsr generate && pnpm --filter web i18n:extract && pnpm --filter web i18n:compile && pnpm --filter web exec tsc --noEmit && pnpm --filter web test:unit`
     - `OXIDE_BIN=/usr/local/bin/oxide pnpm --filter site build`
     - `pnpm --filter web exec playwright test --project=chromium --project=firefox --reporter=list`
     - `pnpm --filter web build`

5. **Strict Handoff, `ship.toml` Packaging & Mandatory `.zip` Verification (Leave Tree Dirty — No Commits):**

- NEVER commit (`git log -1` stays at `base_commit`). Leave the working tree dirty with all changes ready for `ship`.
- Update `STATUS.md` with `v2.2.0` completed (`apps/site` migrated onto `oxide`, `apps/web` streamlined PWA, mobile `BottomSheet` fix, 4-tier bilingual `ValidationModal`, full green gate counts).
- Author `.github/pr-body.md` (gitignored): reviewer-facing documentation of the codebase changes ONLY, ending with:
  `Per-file history lives on feat/v220-oxide-site-migration.`
- Overwrite `ship.toml` at repo root (gitignored) with `branch = "feat/v220-oxide-site-migration"`, `pr_title = "feat: migrate marketing site to Oxide package and upgrade bench modal"`, `pr_body = ".github/pr-body.md"`, `base_commit = "<exact 40-char output of git rev-parse HEAD>"`, and strictly one `[[commit]]` block per dirty file (one path per `files = ["..."]`, ordered by dependency, including `STATUS.md`, `.github/pr-body.md`, and `ship.toml`).
- Run `ship validate` while the tree is dirty until exit `0`, then zip the full clean tree (`rdm-studio-v2.2.0-<SHORT_SHA>.zip`, excluding only `.git/`, `target/`, `node_modules/`, caches) from the union of `git ls-files` + `git status --porcelain` untracked files + explicit `ship.toml .github/pr-body.md STATUS.md`, and assert via `unzip -l` that `ship.toml`, `.github/pr-body.md`, `STATUS.md`, `apps/site/`, and `apps/web/` are all present.
