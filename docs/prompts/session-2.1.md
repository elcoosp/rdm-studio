Task: github.com/elcoosp/rdm-studio. Ship v2.1.0 — refactor routing & UI state to best-in-class TanStack Router architecture (100% URL-driven query params with Valibot `validateSearch` + `retainSearchParams` + zero duplicate Zustand/useState mirrors, `StaticDataRouteOption` module augmentation, pathless layout routes `_marketing` & `_studio`, `useMatches()`-driven `PersistentStage`, `beforeLoad` `?p=` & `?template=` hydration on `_studio` with seamless `IndexedDB` rehydration, `notFoundComponent` / `errorComponent`, `defaultPreload: "intent"`, zero legacy root compat), ship the commercial product layer (`/` Landing Page with interactive structure preview, Offline Pro License & Firm Branding, `/legal` LCEN/GDPR/Responsibility pages) designed with `.agents/skills/impeccable` + `DESIGN.md` (leaving Astro Starlight docs in its own separate monorepo package outside the PWA), and lock in a comprehensive 25+ test real-world E2E suite with zero uncaught console/page errors:

EXECUTION CONTRACT (NON-NEGOTIABLE — 100% AUTONOMOUS, SINGLE BUILD TREE):

- **ZERO QUESTIONS / FULL AUTONOMY:** Operate autonomously end-to-end from bootstrap to final `.zip` archive without prompting.
- **SINGLE SHARED BUILD TREE:** Execute inside the single `rdm-studio` working tree (never create parallel `git worktree` directories).
- **LEVERAGE `impeccable` + `DESIGN.md` ON NEW SCREENS:** Before writing `_marketing/index.tsx`, `_marketing/legal.tsx`, and `LicenseModal.tsx`, read `.agents/skills/impeccable/SKILL.md` + `reference/{layout,typography,spatial-design,polish,craft-floor}.md` + `DESIGN.md` (`#F8FAFC` canvas, `#FFFFFF` panels, `1px #E2E8F0` hairlines, `#1D4ED8` Deep Cobalt accent, `Inter` + `JetBrains Mono` `tabular-nums`, zero drop shadows on docked cards, zero `dark:*` / `bg-slate-900` / `border-slate-*` classes).
- **URL IS SINGLE SOURCE OF TRUTH (ZERO ZUSTAND DUPLICATES):** Never mirror URL-backed state (`beam`, `node`, `view`, `render`, `snap`, `layers`, `cutBeam`, `cut`, `family`, `tab`, `dock`, `case`, `loadTab`, `combo`, `scale`, `sls`, `diagrams`, `modal`) in Zustand stores or component `useState`. Components read directly from `Route.useSearch()` / `useStudioQuery` hooks and update via `navigate({ search: (prev) => ({ ...prev, ... }), replace: true })`.
- **DO NOT ADD DOCS PAGES INSIDE THE PWA:** Documentation lives in a separate Astro Starlight package in the monorepo; link cleanly to `/docs` from the header & footer without bundling Starlight or markdown docs inside `apps/web`.
- **FAST SANDBOX PLAYWRIGHT (`AGENTS.md` §4):** Run Playwright strictly with `--project=chromium --project=firefox --reporter=list`.
- Write complete, clean files (never blind regex/tab patches) to avoid `oxfmt` whitespace no-ops.

1. **Bootstrap, Sync & Load `impeccable` + `DESIGN.md` (< 3 tool calls):**
   - `cd rdm-studio && git fetch origin && git reset --hard origin/main` (or clone `https://github.com/elcoosp/rdm-studio.git` if missing).
   - Ensure `rustc`/`cargo`, `wasm-pack`, `pnpm`, and `ship` (`command -v ship >/dev/null 2>&1 || cargo install --git https://github.com/elcoosp/ship`) are installed.
   - Read `AGENTS.md`, `DESIGN.md`, `STATUS.md`, and `.agents/skills/impeccable/` (`SKILL.md`, `layout.md`, `typography.md`, `spatial-design.md`, `polish.md`, `craft-floor.md`), enabling `node .agents/skills/impeccable/scripts/hooks.mjs on || true`.

2. **Wave 1 — Best-in-Class TanStack Router & URL-First State Architecture (`router.ts`, `searchParams.schema.ts`, `useStudioQuery.ts`, `routes/_marketing.tsx`, `routes/_studio.tsx`):**
   - **A. Comprehensive Valibot Search Schemas (`apps/web/src/schemas/searchParams.schema.ts`):**
     - Define `StudioBaseSearchSchema` (shared across every `_studio` route, wrapped in `v.fallback(..., undefined)` per key so invalid URL query values gracefully fall back instead of throwing):
       - `p?: string` (compressed `.rdm` payload),
       - `template?: "warren" | "portique" | "potence" | "travees"`,
       - `beam?: number` (selected member id),
       - `node?: number` (selected node id),
       - `view?: "iso" | "top-xy" | "face-xz" | "side-yz"` (default `"iso"`),
       - `render?: "volumetric" | "wireframe"` (default `"volumetric"`),
       - `snap?: 10 | 50 | 100` (default `50` mm),
       - `layers?: string` (compact active layer flags, default `"nblsL"` = nodes, beams, loads, supports, labels),
       - `cutBeam?: number` & `cut?: number` (`0..1` cutting-plane station).
     - Extend with route-specific schemas:
       - `GeometrySearchSchema`: `family?: "Tous" | "IPE" | "HEA" | "UPN" | "CHS" | "RHS" | "L" | "Perso"`, `tab?: "nodes" | "beams"`, `dock?: 0 | 1`.
       - `LoadsSearchSchema`: `case?: "Permanent" | "Variable" | "Wind" | "Snow" | "Acceleration"`, `loadTab?: "nodal" | "uniform" | "trapezoid" | "point"`.
       - `ResultsSearchSchema`: `combo?: string`, `scale?: "ec3" | "svm" | "auto"`, `sls?: 200 | 250 | 300`, `diagrams?: 0 | 1`, `modal?: "optim" | "compare"`.
   - **B. Typed Router, `StaticDataRouteOption`, `notFoundComponent` & `retainSearchParams` (`apps/web/src/router.ts`, `main.tsx`):**
     - Create `src/router.ts` creating the TanStack Router instance (`defaultPreload: "intent"`, `search: { structuralSharing: true }`, `defaultNotFoundComponent` rendering a clean _Swiss Metrology_ 404 card with `"Retour à l'atelier 3D →"`, and `defaultErrorComponent` with a safe recovery button) and augmenting `@tanstack/react-router`'s `Register` AND `StaticDataRouteOption` (`surface?: "marketing" | "studio"`, `stepOrder?: number`, `label?: string`, `mobileLabel?: string`, `icon?: ComponentType<{ size?: number; className?: string }>`, `stageVisible?: boolean`, `shortcut?: string`).
     - Export `getStudioSteps()` derived dynamically from `router.flatRoutes` filtered by `staticData?.surface === "studio"` and sorted by `stepOrder` — eliminating every hardcoded `STEPS` array across `__root.tsx`, `CommandPalette.tsx`, and `useAppHotkeys.ts` (and preserve active search params when navigating via `⌘Enter` / `⌘P`!).
   - **C. Pathless Layout Route Split (`_marketing.tsx` & `_studio.tsx`) + Zero-Duplicate URL Hooks (`useStudioQuery.ts`):**
     - Keep `routes/__root.tsx` lean (global `Toaster`, `CommandPalette`, `UpdatePrompt`, `useFileOpening`, `useAppHotkeys`, `LicenseModal` host).
     - Create `routes/_marketing.tsx` for public/commercial pages (`_marketing/index.tsx` at `/` and `_marketing/legal.tsx` at `/legal` — pure landing/legal routes with zero legacy redirect logic) with a crisp _Swiss Metrology_ editorial header (`RDM Studio`, `Fonctionnalités`, `Tarifs`, `Légal`, external `Documentation ↗` link to `/docs`, `EditionBadge`, `LocaleSwitch`, and `"Ouvrir l'atelier 3D →"` CTA) and normal document scrolling.
     - Create `routes/_studio.tsx` for the locked `100dvh` CAD workstation (`_studio/geometry.tsx`, `_studio/supports.tsx`, `_studio/loads.tsx`, `_studio/results.tsx`, `_studio/report.tsx`):
       - Hydrate `?p=` and `?template=` in `_studio.tsx`'s `beforeLoad` (validating `?p=` via `parseProject` or loading `quickStartProject(template)`, then stripping `p`/`template` via `redirect` / `replace: true` while retaining all other search params; if neither is present, allow `rehydrateProject()` from IndexedDB on initial mount).
       - Attach `searchMiddlewares: [retainSearchParams(["beam", "node", "view", "render", "snap", "layers"])]` on `_studio.tsx` so navigating between Steps 1–5 preserves selection and 3D viewport state automatically in the URL!
       - Refactor `viewportStore.ts` and `projectStore.ts` to remove all URL-duplicated fields (`nodeId`, `beamId`, `renderMode`, `cameraPreset`, `snapStep`, `layers`, `cutting`), replacing them with `useStudioQuery.ts` hooks (`useSelectedIds()`, `useViewportParams()`) backed directly by TanStack Router `useSearch` + `useNavigate({ replace: true })`.
       - Update `PersistentStage.tsx` to read `useMatches()` and derive visibility directly from `matches.at(-1)?.staticData.stageVisible === true`.

3. **Wave 2 — Commercial Landing Page (`/`), Offline Pro License Store & Legal Page (`/legal`) (`impeccable` + `DESIGN.md`):**
   - **A. Local-First License & Firm Branding Store (`apps/web/src/state/licenseStore.ts`, `apps/web/src/components/LicenseModal.tsx`):**
     - Create `licenseStore.ts` (Zustand + `localStorage` persistence) managing `tier: "free" | "pro"`, `licenseKey`, `firmName`, `engineerName`, `checkerName`, `activateKey(key)` (validates `RDM-PRO-` prefix), `activateDemoPro()`, and `resetToFree()`.
     - Build `LicenseModal.tsx` using Base UI `Dialog` + `DESIGN.md` Daylight tokens so users can inspect plan limits, enter a `RDM-PRO-...` key, or click `"Activer une démonstration Pro"` in 1 click, and pre-fill Step 5's `ReportBuilder` cover metadata from `licenseStore`.
   - **B. Commercial Product Landing Page (`apps/web/src/routes/_marketing/index.tsx`):**
     - Craft a distinctive, high-authority _Swiss Metrology_ landing page at `/` (following `impeccable` `layout.md` & `spatial-design.md` — crisp `1px #E2E8F0` grid cards, `JetBrains Mono` technical telemetry, zero generic SaaS fluff) with:
       - Engineering Hero with live technical badges (`Rust + WASM · < 20 ms`, `EN 1990 / 1991 / 1992 / 1993 / 1995 / 1998 / 1999`, `100 % Hors-Ligne & Zéro Cloud`), primary `"Ouvrir l'atelier 3D →"` CTA (`/geometry`), and an interactive **3-Model Engineering Showcase** (_Portique 18 m_, _Treillis Warren 24 m_, _Poutre 3 travées_) displaying an architectural SVG preview + telemetry (`Masse`, `Profilés`, `Norme`) and 1-click launch into `/geometry?template=...`;

- 6-card Engineering Capabilities Grid (Timoshenko 3D Solver, Complete EC3 `6.61/6.62 + C1` + `KaTeX CalcTrace`, Multi-Material `EC2/EC5/EC8/EC9`, Interactive 3D CAD + Section Optimizer, A4 Vector PDF + `.docx` + `IFC4/SAF` BIM, Local-First GDPR Privacy);
- 3-tier Pricing & Editions section (Découverte — 0 €, Bureau d'Études Pro — 49 €/mois ou Licence Perpétuelle, Équipe / Entreprise) with 1-click activation;
  - Engineering FAQ `Accordion` + footer links to `/legal` and external Starlight `/docs`.
  * C. Legal, GDPR Zero-Cloud & Engineer Responsibility (`apps/web/src/routes/_marketing/legal.tsx`):Build `/legal` covering Mentions légales (LCEN), Conditions Générales d'Utilisation & de Vente (CGU/CGV), Politique de Confidentialité RGPD (100 % local — aucune donnée envoyée sur un serveur), and Clause de Responsabilité Technique Ingénieur.
  * Wrap all new UI copy in Lingui `<Trans>` / `t` and translate 100% of `apps/web/src/i18n/locales/en.po` (`0` untranslated strings).
    Utilisez le code avec précaution.

4. Wave 3 — Comprehensive 25+ Test Real-World E2E Matrix, Token-Hygiene Gate & Visual Screenshot Eyeball (G0 → G6 + vite build):
   • Add a Vitest check in apps/web/src/lib/cn.test.ts verifying zero bg-slate-900 / dark:bg-slate-900 strings exist in apps/web/src/{components,routes,viewport3d}.
   • Author 4 thorough Playwright E2E suites (asserting zero uncaught pageerror / console errors in every test): 1. apps/web/e2e/commercial.spec.ts:
   • / renders the landing page, interactive 3-model showcase, pricing tiers, and clicking "Portique 18 m" navigates to /geometry?template=portique and hydrates the 4-node portal frame automatically;
   • Selecting a member updates ?beam= in the URL, and navigating /geometry?beam=2 → /supports → /results retains ?beam=2 via retainSearchParams;
   • Opening /results?sls=300&scale=svm&cutBeam=1&cut=0.25 hydrates L/300, σvM / fy, and 0.25 L directly from the URL;
   • Activating RDM-PRO-2026-BET updates the edition badge to Pro and pre-fills Step 5's cover metadata; /legal renders LCEN/GDPR/responsibility clauses; unknown routes render the 404 recovery page; FR | EN works on /, /legal, and /geometry. 2. apps/web/e2e/cad-modeling.spec.ts:
   • Exercises CAD tools (Polyligne, Extruder, Déplacer, Rotation, Miroir, Fusionner doublons, Outils ▾ menu, ? shortcut cheat-sheet modal), unit-aware input (4m, 4000mm), FamilyPills (IPE, HEA, CHS), 2D cross-section SVG diagram, Subdiviser en N tronçons, Barre de treillis (articuler N1/N2), DXF/STEP file drop import, and loads + solves templates from the 12-template ENGINEERING_TEMPLATES gallery. 3. apps/web/e2e/eurocode-advanced.spec.ts:
   • Tests SettingsPopover (National Annex FR/BE/DE/UK/EN, 6.10 vs 6.10a/b, Cisaillement Timoshenko, Plan 2D, P-Δ), Step 3 EN 1991 generators (Imposée, Neige, Vent) + Thermal ΔT + Concentrated moments (Mx, My, Mz), Step 4 AdvancedPanels (Flambement global λcr, Sismique EN 1998-1 spectrum chart, Multimatière EC2 / EC5 / EC3-1-8 / EC3-1-2 / EC9), OptimizerModal (Pareto scatter + 1-click Apply + ⌘Z Undo), ScenarioCompareModal (pinning 2 variants A/B and asserting Δ Masse, Δ CO₂, Δ η, Δ δ), ForceDiagrams3D envelopes, and ValidationModal (41/41 benchmarks passing). 4. apps/web/e2e/report-bim-persistence.spec.ts:
   • Tests Step 5 ReportBuilder (chapter toggling, cover metadata, FR | EN output toggle), verifies real non-empty downloads for .docx, IFC4, SAF, OpenSees TCL, Solver JSON, glTF, .rdm, PDF Takumi, and CSV, verifies IndexedDB persistence across page.reload(), and tests keyboard shortcuts (⌘K, ⌘Z, ⇧⌘Z, ⌥R, ⇧⌘I).
   • Mandatory impeccable Screenshot Eyeball Pass: Capture Playwright screenshots of /, /legal, /geometry, /supports, /loads, /results, and /report at 1440×900, 860×900, and 390×844 into /tmp/v210-eyeball-_.png, open and visually inspect the PNG images to confirm Swiss Metrology pixel-perfection (1px hairlines, zero clipped controls, balanced spacing), polish any visual flaw, and delete /tmp/v210-eyeball-_.png.
   • Run EVERY gate sequentially and verify 0 errors, 0 warnings, 0 failed tests:
   • cargo fmt --all --check && cargo clippy --workspace --all-targets --all-features -- -D warnings
   • RUSTFLAGS="-D warnings" cargo test --workspace --all-features
   • wasm-pack build bindings/rdm-wasm --target web --out-dir ../../apps/web/src/wasm-pkg
   • pnpm --filter web exec oxfmt --check && pnpm --filter web exec oxlint --deny-warnings && pnpm --filter web exec tsr generate && pnpm --filter web i18n:extract && pnpm --filter web i18n:compile && pnpm --filter web exec tsc --noEmit && pnpm --filter web test:unit
   • pnpm --filter web exec playwright test --project=chromium --project=firefox --reporter=list
   • pnpm --filter web build
5. Strict Handoff, ship.toml Packaging & Full .zip Verification (Leave Tree Dirty — No Commits):
   • NEVER commit (git log -1 stays at base_commit). Leave the working tree dirty with all changes ready for ship.
   • Update STATUS.md with v2.1.0 completed and full green gate counts.
   • Author .github/pr-body.md (gitignored): reviewer-facing documentation of the codebase changes ONLY, ending with:
   Per-file history lives on feat/v210-tanstack-router-url-first.
   • Overwrite ship.toml at repo root (gitignored) with branch = "feat/v210-tanstack-router-url-first", pr_title = "feat: refactor routing to URL-first TanStack layouts and add commercial pages", pr_body = ".github/pr-body.md", base_commit = "<40-char git rev-parse HEAD>", and strictly one [[commit]] block per dirty file (one path per files = ["..."], ordered by dependency, including STATUS.md, .github/pr-body.md, and ship.toml).
   • Run ship validate while the tree is dirty until exit 0, then zip the full clean tree (rdm-studio-v2.1.0-<SHORT_SHA>.zip, excluding only .git/, target/, node_modules/, caches) into the downloads folder and verify with unzip -t and unzip -l.
