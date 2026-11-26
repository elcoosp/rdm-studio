# STATUS.md — RDM Studio milestone ledger

Session 15 (2026-11-26): **v2.0.1 — final stabilization & release: merge-conflict
cleanup (SettingsPopover DEFAULT_SETTINGS + P-Δ toggle, ForceDiagrams3D
null-safe envelope normalization, loads.tsx EnvLoadGenerators re-docked),
EN 1993-1-1 Table 6.3 general curve-d LTB fallback (slender I-sections no
longer abort member_check), worker solve deduplication (cached_solved_model /
cached_structure routing for envelopes + optimizer + buckling + moving loads
+ the parse-cache, killing the silent "unknown section or material" envelope
fault), unique per-call callId engine lane (concurrent WASM calls can no
longer overwrite each other's callbacks), the 10 failing Playwright
interactions fixed (springs "élastique" seeding, closed-by-default Vaul
drawer with click-open handle, 8 s parametric toast), the 4 shadcn/Tailwind
ecosystem libraries actively wired (tw-animate-css popup transitions,
lucide-react 1.5px icon purge incl. select/checkbox/dropdown primitives,
recharts Pareto ScatterChart + EN 1998-1 AreaChart, @dnd-kit sortable
report chapters with GripVertical handles), the impeccable v4.0.4 eyeball
pass (CAD toolbar re-docked above the viewport slot, FamilyPills filtering
the profile combobox in the inspector, AdvancedPanels + Optimiseur/Scénarios
moved into the 340px ec3-rail, ForceDiagrams3D as a toggleable panel below
the 220px dock, ReportBuilder inside the sticky 320px export rail with
sanitized .docx filenames), the new real-world-scenarios.spec.ts E2E suite
(portal frame wind+snow+P-Δ+optimizer+⌘Z, Warren truss λcr, 3-travée
equilibrium + L/300 scrub, unstable-mechanism fault, legacy .rdm v1
migration + export suite), and the pnpm.overrides fix that restores
`tsr generate` (router-generator 1.99.9 pinned at the workspace root)** on
top of origin/main `41a0593` (v2.0.0).

## Shipped (implemented + tested)

1. **Wave 1 — conflicts & engine**: SettingsPopover rewritten clean with the
   module-level `DEFAULT_SETTINGS` (stable selector identity, React #185)
   and the `P-Δ (second ordre)` toggle; ForceDiagrams3D gained
   `normalizeEnvelopes` (fault objects / id-keyed maps → null-safe
   beam_id-sorted arrays); loads.tsx lost its stray top-of-file JSX and
   EnvLoadGenerators is docked below the EN 1990 case tabs;
   `lateral_torsional_buckling` falls back to curve d (αlt = 0.76) for
   h/b > 3.1 with a regression test; `compute_envelopes_json`,
   `optimize_sections_json`, `buckling_analysis_json` and
   `moving_loads_envelope_json` route through `cached_solved_model` /
   `cached_structure` — the demo model now returns `array(2)` envelopes
   instead of a swallowed SolveError; `workerClient.engineCall` keys
   `enginePending` by a monotonic `callId` echoed by `fea.worker.ts`.
2. **Wave 2 — interactions & UI libraries**: spring fields seed kz =
   1000 kN/m when the support has no spring (élastique badge after one
   click); BottomSheet closed by default on phones with an explicit
   `setOpen(true)` trigger and Lucide ChevronUp/X chrome; the parametric
   toast lasts 8 s; `tw-animate-css` imported in app.css with
   animate-in/out + fade/zoom on Popover/Dialog/DropdownMenu/Tooltip/
   Collapsible; ALL raw Unicode UI glyphs (⚙ ✓ ⇄ ↩ ↪ × ▲ ↑ ↓ ▾ ⌃) replaced
   by lucide-react 1.5px icons across root, settings, bottom sheet,
   results, report, optimizer, scenario comparator, select, checkbox and
   dropdown primitives; recharts `<ScatterChart>` Pareto frontier (η = 1.0
   red dashed ReferenceLine) in OptimizerModal and `<AreaChart>` Se(T)
   spectrum in AdvancedPanels; ReportBuilder chapters drag-reorderable via
   @dnd-kit/core + sortable with GripVertical handles.
3. **Wave 2E — impeccable polish (no redesign)**: geometry CAD toolbar
   docked as a flow row above the viewport slot (never over the header or
   the in-stage HUD), FamilyPills moved into the left inspector above the
   profile Combobox filtering ipeSections by familyOfDesignation; results
   AdvancedPanels + Optimiseur/Scénarios moved inside the 340px ec3-rail,
   ForceDiagrams3D toggleable below the 220px dock; report ReportBuilder in
   the sticky 320px export rail, .docx filenames sanitized
   (`replace(/[^\w-]+/g, "_")`); screenshots eyeballed at 1440×900 /
   860×900 / 390×844 on all 5 routes with 0 px horizontal overflow.
4. **Wave 3 — real-world E2E**: new
   `apps/web/e2e/real-world-scenarios.spec.ts` (5 scenarios) covering the
   industrial portal frame (wind + snow + P-Δ + optimizer apply + ⌘Z), the
   24 m Warren truss (λcr modes), the 3-span continuous beam (L/300 SLS +
   x-scrub), the unstable-mechanism pedagogical fault, and the legacy
   schema-v1 `.rdm` migration + .docx/.rdm export downloads.

## Honest gate status at cut-off

- Rust: `cargo fmt` ✓, `clippy --workspace -D warnings` → **0**,
  `RUSTFLAGS="-D warnings" cargo test --workspace --all-features` ✓
  (curve-d LTB regression test included), `wasm-pack build` ✓.
- Web: `oxfmt` ✓, `oxlint --deny-warnings` ✓, `tsr generate` ✓ (fixed the
  misplaced pnpm.overrides — pinned @tanstack/router-generator@1.99.9 at
  the workspace root), `i18n:extract` + `i18n:compile` ✓ (en.po completed
  for the new Pareto string), `tsc --noEmit` ✓, `vitest` 40/40 ✓,
  `pnpm --filter web build` ✓.
- Playwright chromium+firefox: first full run 83 passed / 23 failed / 7 skipped; after the
  toolbar-height fix and the click-open drawer test updates the targeted
  re-run of layout-craft + mobile + v160 finished:
  [firefox] › e2e/layout-craft.spec.ts:139:3 › mobile 390×844 › drawer + bottom nav never clip interactive buttons 
  7 skipped
  53 passed (2.3m). Full logs: `download/e2e-final.log` + `download/e2e-rerun.log`.

## Next session (ordered)

1. Re-run the full Playwright matrix if the sandbox recycled mid-run and
   attach the tally to this ledger.
2. Ship the v2.0.1 tag once `ship validate` exits 0 on a clean CI run.
