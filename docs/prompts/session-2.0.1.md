Task: github.com/elcoosp/rdm-studio. Ship v2.1.0 — refactor routing & UI state to best-in-class TanStack Router architecture (100% URL-driven query params with Valibot `validateSearch` + `retainSearchParams` + zero duplicate Zustand/useState mirrors, `StaticDataRouteOption` module augmentation, pathless layout routes `_marketing` & `_studio`, `useMatches()`-driven `PersistentStage`, `beforeLoad` `?p=` & `?template=` hydration on `_studio` with seamless `IndexedDB` rehydration, `notFoundComponent` / `errorComponent`, `defaultPreload: "intent"`, zero legacy root compat), ship the commercial product layer (`/` Landing Page with interactive 3-model preview, Offline Pro License & Firm Branding, `/legal` LCEN/GDPR/Responsibility pages) designed with `.agents/skills/impeccable` + `DESIGN.md` (leaving Astro Starlight docs in its own separate monorepo package outside the PWA), close all 7 remaining audit items from `22fd9fa` (`Uniform` load in `ProjectFileSchema`, Z-up gravity on all 12 `ENGINEERING_TEMPLATES`, true 3D on-member `ForceDiagrams3D` in `PersistentStage`, and the 3 `real-world-scenarios.spec.ts` assertions), and lock in a 25+ test real-world E2E suite with zero uncaught console/page errors:

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

2. **Wave 1 — Best-in-Class TanStack Router, URL-First State & `22fd9fa` Audit Fixes (`router.ts`, `searchParams.schema.ts`, `project.schema.ts`, `engineeringTemplates.ts`, `ForceDiagrams3D.tsx`, `routes/_marketing.tsx`, `routes/_studio.tsx`):**
   - **A. Close Remaining `22fd9fa` Codebase Defects:**
     - Add `Uniform` load variant (`{ case, kind: "Uniform", beam_id, q_start, q_end, direction }`) to `LoadSchema` in `apps/web/src/schemas/project.schema.ts` so `.rdm` files containing EN 1991 snow/wind/imposed loads pass Valibot validation on re-import.
     - Re-orient all 12 templates in `apps/web/src/lib/engineeringTemplates.ts` to RDM Studio's canonical **`Z-up`** coordinate frame (`X-Z` plane, `gravity = { x: 0, y: 0, z: -1 }`) so all 12 gallery models solve under vertical gravity.
     - Upgrade `ForceDiagrams3D.tsx` to render true 3D signed force diagrams (`My, Mz, Vz, N, T`) along the 3D members inside `PersistentStage.tsx` when `diagrams=1`, and replace the raw `×` in `ValidationModal.tsx` with `<X size={18} strokeWidth={1.5} />`.
   - **B. Comprehensive Valibot Search Schemas (`apps/web/src/schemas/searchParams.schema.ts`):**
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
   - **C. Typed Router, `StaticDataRouteOption`, `notFoundComponent` & `retainSearchParams` (`apps/web/src/router.ts`, `main.tsx`):**
     - Create `src/router.ts` creating the TanStack Router instance (`defaultPreload: "intent"`, `search: { structuralSharing: true }`, `defaultNotFoundComponent` rendering a clean _Swiss Metrology_ 404 card with `"Retour à l'atelier 3D →"`, and `defaultErrorComponent` with a safe recovery button) and augmenting `@tanstack/react-router`'s `Register` AND `StaticDataRouteOption` (`surface?: "marketing" | "studio"`, `stepOrder?: number`, `label?: string`, `mobileLabel?: string`, `icon?: ComponentType<{ size?: number; className?: string }>`, `stageVisible?: boolean`, `shortcut?: string`).
     - Export `getStudioSteps()` derived dynamically from `router.flatRoutes` filtered by `staticData?.surface === "studio"` and sorted by `stepOrder` — eliminating every hardcoded `STEPS` array across `__root.tsx`, `CommandPalette.tsx`, and `useAppHotkeys.ts` (and preserve active search params when navigating via `⌘Enter` / `⌘P`!).
   - **D. Pathless Layout Route Split (`_marketing.tsx` & `_studio.tsx`) + Zero-Duplicate URL Hooks (`useStudioQuery.ts`):**
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

- Craft a distinctive, high-authority Swiss Metrology landing page at `/` (following `impeccable` `layout.md` & `spatial-design.md` — crisp `1px #E2E8F0` grid cards, `JetBrains Mono` technical telemetry, zero generic SaaS fluff) with:

* Engineering Hero with live technical badges (`Rust + WASM · < 20 ms`, `EN 1990 / 1991 / 1992 / 1993 / 1995 / 1998 / 1999`, `100 % Hors-Ligne & Zéro Cloud`), primary `"Ouvrir l'atelier 3D →"` CTA (`/geometry`), and an interactive 3-Model Engineering Showcase (Portique 18 m, Treillis Warren 24 m, Poutre 3 travées) displaying an architectural SVG preview + telemetry (`Masse`, `Profilés`, `Norme`) and 1-click launch into `/geometry?template=...`;
* 6-card Engineering Capabilities Grid (Timoshenko 3D Solver, Complete EC3 `6.61/6.62 + C1` + `KaTeX CalcTrace`, Multi-Material `EC2/EC5/EC8/EC9`, Interactive 3D CAD + Section Optimizer, A4 Vector PDF + `.docx` + `IFC4/SAF` BIM, Local-First GDPR Privacy);
* 3-tier Pricing & Editions section (Découverte — 0 €, Bureau d'Études Pro — 49 €/mois ou Licence Perpétuelle, Équipe / Entreprise) with 1-click activation;
  - Engineering FAQ `Accordion` + footer links to `/legal` and external Starlight `/docs`.
  * C. Legal, GDPR Zero-Cloud & Engineer Responsibility (`apps/web/src/routes/_marketing/legal.tsx`):Build `/legal` covering Mentions légales (LCEN), Conditions Générales d'Utilisation & de Vente (CGU/CGV), Politique de Confidentialité RGPD (100 % local — aucune donnée envoyée sur un serveur), and Clause de Responsabilité Technique Ingénieur.
  * Wrap all new UI copy in Lingui `<Trans>` / `t` and translate 100% of `apps/web/src/i18n/locales/en.po` (`0` untranslated strings).
    [delivery]
    branch = "feat/v210-tanstack-router-url-first"
    pr_title = "feat: refactor routing to URL-first TanStack layouts and add commercial pages"
    pr_body = ".github/pr-body.md"
    base_commit = "<exact 40-char output of git rev-parse HEAD>"

  [[commit]]
  message = "feat(scope): specific description of this single file change"
  files = ["path/to/dirty/file"]
