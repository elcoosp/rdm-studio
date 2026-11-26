# STATUS.md — RDM Studio milestone ledger

Session 17 (2026-11-26): **v2.1.0 — URL-first TanStack Router refactor &
commercial product layer** on top of origin/main `b33fc6e` (v2.0.2): the
complete routing rework into pathless `_marketing` / `_studio` layouts with
`beforeLoad` `?p=`/`?template=` hydration + IndexedDB rehydration +
`retainSearchParams`, 100% URL-driven query params through Valibot
`validateSearch` schemas (zero Zustand/useState mirrors — the store fields
were deleted), `StaticDataRouteOption` module augmentation + `getStudioSteps()`
derived workflow (no hardcoded STEPS anywhere), `useMatches()`-driven
`PersistentStage` visibility, router-level 404/error cards and
`defaultPreload: "intent"`, the `/` commercial landing page (hero badges,
interactive 3-model showcase, capabilities grid, 3-tier pricing, FAQ) and
`/legal` (LCEN / CGU-CGV / zero-cloud RGPD / engineer responsibility), the
local-first Offline Pro license store + Base UI LicenseModal + EditionBadge
with Step 5 cover pre-fill, and the 22fd9fa audit closed (Uniform in
`ProjectFileSchema`, Z-up gravity on all 12 templates, true 3D on-member
`ForceDiagrams3D`, Lucide `X` in ValidationModal, the Extruder E2E store
assertion) — tree left dirty for ship.

## Shipped (implemented + tested)

1. **Wave 1 — routing & state**: `schemas/searchParams.schema.ts`
   (StudioBase + per-route schemas, graceful fallbacks, layer/snap codecs);
   `router.tsx` (instance + augmentation + steps derivation); `main.tsx`
   shared instance; `useStudioQuery.ts` zero-duplicate hooks; stores slimmed
   (`viewportStore` transient-only, `projectStore` batch-only);
   `_studio`/`_marketing` layouts; every route/component moved to URL state.
2. **Wave 2 — commercial**: `licenseStore` + `LicenseModal` +
   `LicenseBadge`; landing page with showcase telemetry precomputed from the
   EN 10365 catalog areas; legal surface; `en.po` 100% translated.
3. **Wave 3 — audit & tests**: Uniform schema variant; Z-up templates (+ a
   genuine 12 kN wind push on the R+2 frame); true 3D `ForceDiagrams3D`
   layer; ValidationModal icon; real-world Extruder assertion (IndexedDB);
   new `url-first`, `marketing` and `console-hygiene` E2E specs (54+ tests
   total, chromium+firefox).
4. **Handoff**: `ship.toml` (delivery `feat/v210-tanstack-router-url-first`,
   one-file commit blocks), `.github/pr-body.md`, `ship validate`.

## Gate ledger at cut-off

- `cargo fmt --all` ✓ — `cargo clippy -D warnings` ✓ 0 (after the oxlint
  dead-variable cleanup); workspace Rust tests unaffected (no Rust changes
  beyond fmt).
- `oxfmt --check` ✓ — `oxlint --deny-warnings` ✓ 0 — `tsr generate` ✓ —
  `i18n:extract` + `i18n:compile` ✓ (en.po 0 untranslated) —
  `tsc --noEmit` ✓ — `vitest` 47/47 ✓ — `pnpm --filter web build` ✓
  (131 precached entries).
- Playwright chromium+firefox (`--reporter=list`, download/e2e-v210.log):
  **117 passed / 17 failed / 7 skipped** of 141. The 17 failures cluster
  into five items (see download/e2e-v210-failures.md): the Escape-clears-
  selection hotkey (2), the real-world portal optimizer η / mechanism /
  legacy-drop trio (2×3), the console-hygiene workflow run (2), the v160
  malformed-.rdm drop toast (2) and the v160 header FR|EN visibility matrix
  (2×3) — all documented in the PR body's remaining gaps.

## Next session

1. Re-attach the final Playwright tally from `download/e2e-v210.log`.
2. Investigate the remaining real-world-scenarios firefox items if any
   (portal optimizer η, legacy drop) against a WebGL-capable Firefox.
