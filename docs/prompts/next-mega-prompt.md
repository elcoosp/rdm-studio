Task: github.com/elcoosp/rdm-studio. Ship v1.7.0 "Apex" — make RDM Studio the most trustworthy, fastest, densest and most delightful browser-native structural analysis workstation for small/mid engineering offices (steel/timber/concrete frames and trusses, Eurocode). Benchmarks to beat: RDM6, Ftool, SkyCiv, ClearCalcs, Autodesk Robot, RFEM/RSTAB, SAP2000, SCIA. Winning angles no incumbent matches together: local-first/offline/zero-telemetry, instant live re-solve while dragging, a transparent hand-checkable calculation trace for every number, zero install, and beautiful dense UI.

Use a PARALLEL MULTI-AGENT build (git worktrees). If your runtime cannot run sub-agents, execute the same workstreams as sequential waves in the same dependency order.

═══ GROUND TRUTH FROM THE v1.4 CODE REVIEW (HEAD 374ca49) — VERIFY, THEN BUILD ON IT ═══
This was read from a source dump. The dump had NO docs (STATUS/DESIGN/ARCHITECTURE/AGENTS/mockups) and does NOT show whether the v1.5 (impeccable Operate UI overhaul) and v1.6 (persistent stage, parametric, security) sessions landed. Phase 0 must establish which did. Trust the repo over this prompt. No backward compatibility: rename/delete/restructure freely, delete dead code, bump `.rdm` to schema v2 (a tiny one-way v1→v2 migrator is welcome, optional).

ALREADY EXISTS (extend, do not rebuild):

- Crates: rdm-model (Node, Beam 12-DOF with releases_start/end[6], roll angle, k_buckling_y/z; Support with locked_dofs[6] + spring_stiffness[6]; Load kinds Nodal / PointOnSpan / Trapezoid / AccelerationField; validator with ModelIssue), rdm-solver (faer sparse Cholesky LLᵀ; per-case back-substitution; Element::build condenses end releases by Schur complement; consistent-mass modal analysis with deflated inverse iteration; section_cut with von Mises grids; station forces), rdm-eurocode (EN 10365/10210/10056/10025 catalogs, EN 1993-1-1 classification, buckling curves, LTB, shear areas, MemberCheck; EN 1990 combinations), rdm-cad (DXF, STEP importers, topology cleaner), bindings/rdm-wasm.
- Web: React 19, TanStack Router/Table, Zustand + zundo, Base UI, Tailwind 4, three + R3F + drei + three-mesh-bvh, uPlot, Lingui (FR/EN), Valibot, Vaul, cmdk, NumberFlow, Takumi PDF, PWA, Playwright, vitest.

KNOWN GAPS (each is a candidate workstream item; confirm in Phase 0):
ENGINE CORRECTNESS / SCOPE

- Euler-Bernoulli only: no shear deformation (Timoshenko) → short/deep members are too stiff.
- Load cases are a hardcoded 5-value enum (G,Q,W,S,Acc); no custom cases, no case metadata, no ψ per case. Loads are identified by ARRAY INDEX (`removeLoad(index)`): fragile; give loads stable ids.
- No thermal loads, support settlements, inclined supports, rigid end offsets, tapered sections, partial/trapezoid in local axes, tension/compression-only members, P-Δ, linear buckling, influence lines, moving loads, seismic, shells.
- EN 1993-1-1 check is thin and must be made defensible: NO N+My+Mz interaction (6.61/6.62: only independent ratios + von Mises); LTB hardcodes C1=1.0 on the full member length (no restraint spacing, no moment-diagram factor); Mz and Vy never checked as resistances (Mz only feeds von Mises); class 4 returns an error instead of effective section; γM1 absent (only γM0); Table 6.3 rejects h/b>3.1; no EN 1993-1-8 / -1-2 / EC2 / EC5.
- EN 1990: only 6.10 ULS with a single leading action and characteristic SLS. No 6.10a/b, frequent/quasi-permanent SLS, accidental, seismic, patterns; no National Annex selection.
- Silent masking in wasm: `beam_length(...).unwrap_or(0.0)` / `unwrap_or(1.0)` in `bindings/rdm-wasm/src/lib.rs` hides bad models → replace with typed errors.
- Only 6 analytical benchmark tests + 3 invariant tests. No fuzzing, no published-reference suite, no in-app validation page.
  PERFORMANCE / ARCHITECTURE
- `fea.worker` client is a single FIFO queue with a `busy` flag: no cancellation, no coalescing, no priorities; every call re-serializes the full project JSON and re-parses/re-factorizes in wasm. Live drag-solve is impossible today. Fix: persistent model handle inside wasm, delta updates, factorization cache (load-case change re-solves RHS only), cancellation + latest-wins coalescing, worker pool for independent jobs (modal, optimizer).
- Per-element `DOF = 6 × node index` with node lookup by linear `.find()`: use id→index maps.
- Giant route files: `geometry.tsx` (~870 lines), `results.tsx` (~880), `loads.tsx` (~600), `projectStore.ts` (~720), `lib.rs` wasm (~1000). No route-level lazy loading. Split by feature.
- One canvas per route (if v1.6 did not land), per-frame geometry allocation, no instancing.
  PRODUCT / UX
- 5-step linear wizard (geometry → supports → loads → results → report). Experts want free navigation, a model tree, a properties panel, tools with dynamic input, and live results everywhere.
- Missing: member groups/layers, copy/paste/array/mirror, levels, DXF underlay, undo-history panel, shortcut registry, quantity/mass/carbon/cost totals, optimizer, scenario compare, report builder, save/open in place, snapshots/versions.

═══ EXECUTION CONTRACT (NON-NEGOTIABLE — 100% AUTONOMOUS) ═══

- ZERO QUESTIONS. Ambiguity → pick what best serves an expert engineer in a hurry; record one line in `docs/v1.7/DECISIONS.md`; continue.
- Follow `AGENTS.md`, `ARCHITECTURE.md`, `DESIGN.md` (update them wherever v1.7 changes the truth).
- Strict SI internally (`m`, `N`, `Pa`, `rad`, `kg/m³`); display units are presentation only. Zero `.unwrap()` / `.expect()` / `panic!()` / silent `unwrap_or` fallbacks in non-test code of `crates/` and `bindings/rdm-wasm`; enforce with clippy lints (`unwrap_used`, `expect_used`, `panic`, `indexing_slicing` where practical), tests exempt via `#[cfg(test)]`.
- Typed errors everywhere (Rust enum → stable code → localized message key). No stringly-typed errors across the wasm boundary.
- Write complete clean files (no blind regex/whitespace patches → `oxfmt` no-ops).
- Nothing is labelled "validated" unless it matches an analytical or published reference in CI.

═══ PHASE 0 — BOOTSTRAP + GROUND TRUTH (parallel recon) ═══
0.1 `cd rdm-studio && git fetch origin && git reset --hard origin/main` (clone if missing). Ensure `rustc/cargo`, `wasm-pack`, `pnpm`, `ship` installed; install `impeccable` if missing. Run `node .agents/skills/impeccable/scripts/context.mjs --target apps/web/src/routes/geometry.tsx`. Read impeccable `SKILL.md` + `operate`, `layout`, `adapt`, `polish`, `audit`, `critique`, `craft-floor` references; `node .agents/skills/impeccable/scripts/hooks.mjs on || true`. Read `STATUS.md`, `DESIGN.md`, `ARCHITECTURE.md`, `AGENTS.md`, `./mockups/`, `docs/prompts/*`.
0.2 Parallel recon agents, one file each under `docs/v1.7/`:

- RECON-UI: build; screenshot every route at 1440×900, 860×900, 390×844, light + dark; `BASELINE-UI.md` with defects + bounding-box evidence; run impeccable `audit` + `critique` per screen, record scores. Determine exactly what v1.5 changed (does `BottomSheet` trigger at 767px? is the left-docked 320px inspector present?).
- RECON-CODE: determine whether v1.6 landed (persistent stage, parametric.rs, Valibot on import, XSS fix in standaloneHtml3d, 25 MB CAD cap, thread_local solve cache, `a` in SectionShapeDto). Map stores, worker protocol, wasm API, test inventory, bundle size (gz per chunk), dead code, `any`, TODOs. Verify every STATUS.md claim.
- RECON-ENGINE: verify the KNOWN GAPS above against code; list numerical risks (conditioning with springs vs. rigid, singular/mechanism detection quality, units); produce a prioritized correctness backlog.
- RECON-MARKET: web-search the competitors. `COMPETITIVE-MATRIX.md` (modeling, loads, analysis, code checks, results viz, reporting, interop, collaboration, speed, price, UX friction). Name the 15 highest-leverage gaps and the 5 places RDM Studio can be categorically better.
  0.3 Orchestrator writes `docs/v1.7/PLAN.md`: confirm/adjust the workstreams against ground truth, assign tiers (T0/T1/T2), define the cut-line.

═══ PHASE 1 — CONTRACTS FIRST (orchestrator only, then FREEZE) ═══
`docs/v1.7/CONTRACTS.md` + compiling skeletons:

- `.rdm` v2 (Rust serde = single source of truth; generate Valibot schema + `public/schema/rdm-v2.schema.json`): stable ids for nodes, beams, loads, load cases, groups, levels; custom load cases with category + ψ0/ψ1/ψ2; sections by designation + optional custom/tapered; per-member design params (restraint spacing, C1/moment-diagram mode, effective lengths, fire rating, material grade); analysis settings (order 1/2, shear deformation, National Annex, combination method); metadata (author/checker/revision).
- wasm/worker API: persistent model handle (`open_model`, `apply_delta`, `solve`, `solve_case_rhs`, `cancel`), every DTO, typed error enum.
- `CalcTrace`: `{ clause, title, formulaLatex, substituted, value, unit, limit, utilisation, status, children[] }`; every design check must emit one.
- Store slices + viewport↔panel event bus (`selection`, `hover`, `probe`, `tool`), design + motion tokens, i18n key namespaces, ONE keyboard-shortcut registry (palette, tooltips, cheat-sheet all read it).
- File-ownership map per workstream. Cross-ownership edits go through `docs/v1.7/REQUESTS.md`. Contracts frozen; changes need orchestrator approval + CHANGELOG line.

═══ PHASE 2 — PARALLEL BUILD (12 workstreams, worktrees; each ships code + tests + `docs/v1.7/ws-<id>.md`) ═══
Agents rebase on the integration branch at each wave boundary and never edit another agent's files.

[WS-A SOLVER CORE — rdm-solver, rdm-model]
T0: id→index maps (kill linear node lookups); Timoshenko shear deformation option (default on for short members, auto-flag when L/h < 8); thermal loads (uniform + gradient); prescribed settlements; inclined supports; rigid end offsets; tapered/haunched members; local-axis and partial trapezoid loads; tension-only/compression-only members (iterative, clean non-convergence report); automatic 2D plane-frame mode reusing the 3D engine; envelopes across all combinations (min/max N,V,M,δ per member + governing combo id).
T0: factorization cache + RHS-only re-solve; mechanism/instability diagnosis that names the offending DOFs/nodes in the UI; conditioning guard for spring-vs-rigid supports.
T1: P-Δ second-order analysis; linear buckling (load factors + shapes); influence lines + moving loads (EN 1991-2 LM1 simplified); EN 1998-1 response spectrum (CQC/SRSS, ≥90% mass participation).
T2: membrane/plate elements + mesher; cable elements.
Targets: 500-beam model < 100 ms in wasm; delta re-solve < 20 ms on 200-beam model.

[WS-B DESIGN CODES + CALC TRACE — new crates/rdm-design]
T0: move EC3 out of rdm-eurocode into rdm-design and complete it: γM0/γM1/γM2 from National Annex; full 6.2 cross-section resistance incl. Mz, Vy, V–M reduction, torsion; 6.3 flexural buckling about both axes + torsional/torsional-flexural; LTB with proper C1 from the actual moment diagram, restraint spacing per member, general + rolled method; N+My+Mz interaction 6.61/6.62 with Annex A and Annex B selectable; class 4 effective-section; remove the h/b>3.1 hard stop (use general method). EVERY check emits a `CalcTrace` and the UI renders it as clause → KaTeX formula → substituted numbers → result. This trace is the signature differentiator: hand-checkable by a reviewing engineer.
T0: National Annex selector (FR default; BE, DE, UK, generic EN).
T1: EC2 rectangular/T-beam flexure+shear with reinforcement suggestion; EC5 timber (kmod/kdef, LTB, combined, creep deflection); EC3-1-8 bolted end-plate/shear-tab/fillet weld checks at nodes; EC3-1-2 simplified fire critical temperature.
T2: EC9 aluminium; EN 1993-1-5 plate buckling.

[WS-C LOADS + COMBINATIONS — rdm-model/loads, rdm-eurocode/en1990]
T0: custom load-case library with EN 1990 categories and per-case ψ0/ψ1/ψ2 (replaces the fixed enum); stable load ids; self-weight toggle per case; auto-generated combinations: 6.10 and 6.10a/b, accidental, SLS characteristic/frequent/quasi-permanent, with a combination browser; pattern live loads on continuous beams.
T0: generators with visible formulas and editable outputs: snow EN 1991-1-3 (altitude/zone → sk, shape coefficients), wind EN 1991-1-4 simplified (terrain category, qp, cpe → member line loads), imposed loads EN 1991-1-1 by category.
T1: tributary area-load distribution from a drawn bay (one-way/two-way); copy/scale/clear/duplicate loads across selection.

[WS-D OPTIMIZER + ECONOMICS — rdm-design/opt + panel]
T0: "Optimize sections": per member group, lightest catalog profile with utilisation ≤ target (default 0,90) and SLS satisfied, re-analysing until forces converge (≤10 iterations, explicit stop reason). Diff table (old→new, mass, utilisation), Apply/Revert as ONE undo step. Live totals: steel mass, embodied carbon (documented factor table), cost with editable €/kg.
T1: Pareto scatter (mass vs. max utilisation). T2: topology hints ("remove brace X, util 0,03").

[WS-E MODELING UX — apps/web/src/modeling/]
T0: tool system with visible HUD: Select, Node, Beam, Polyline, Extrude, Move, Rotate, Mirror, Array (linear/polar), Offset, Trim/Extend, Split, Subdivide, Merge-duplicates; CAD-style dynamic input at the cursor (type a length, Tab, Enter).
T0: box/lasso/crossing selection, filters, invert, select-similar, isolate, groups/layers (visibility/lock/colour), copy/cut/paste-at-cursor, visible undo-history panel (click to time-travel), model tree.
T0: snapping: grid (10/50/100/custom mm), endpoint, midpoint, intersection, perpendicular, parallel, polar tracking (15/30/45°), X/Y/Z axis lock, snap indicators in 3D.
T1: levels/storeys + quick-duplicate frame per level; DXF/PNG/PDF underlay traced in 2 clicks; parametric configurator v2 (Warren, Pratt, Howe, lattice, space frame, multi-storey, gable portal with purlins) as an editable regenerating "parametric group"; live ModelIssue badges anchored in 3D with 1-click fixes.

[WS-F VIEWPORT — apps/web/src/viewport3d/]
T0: one persistent stage (land it if v1.6 didn't); instanced nodes/supports/arrows; BVH picking; culling + LOD; 10k members ≥ 60 FPS on integrated GPU (report hardware); no per-frame allocation; dispose audit.
T0: results in 3D: N/V/M/T/δ diagrams on members with amplitude slider, signed fills, extrema labels, true cubic deformed shape, reaction arrows with values, ghost undeformed; hover probe card (x, N, V, M, δ, σ) linked to the chart cursor.
T0: view cube, camera bookmarks 1–9, ortho/persp, standard views, zoom-selection (F) / all (A), clip box, render modes (wire / line / true-profile / shaded+SSAO).
T1: WebGPU path with WebGL2 fallback behind one interface; SDF labels; colour-vision-safe palettes (viridis/cividis/diverging); PNG/SVG/GLB export with annotations baked in.

[WS-G RESULTS COCKPIT — routes/results*, components/results/]
T0: zero-scroll cockpit at 1440×900, 860×900, 390×844 (redesign freely after the baseline). Combination/envelope selector, governing-member jump, worst-first sortable utilisation table (all members × all checks, click → select + zoom), member detail drawer with CalcTrace tree, all 5 internal-force charts with ±capacity lines, fiber stress plot.
T0: "Why does this fail?" explainer: names the governing clause, shows the 3 cheapest mitigations (bigger profile, lateral restraint, change release, add brace), applies one in a click, re-solves, shows before/after.
T1: scenario compare (≥2 snapshots side by side with delta chips); all tables export CSV/TSV/XLSX + copy in one keystroke.

[WS-H INTEROP — rdm-cad, apps/web/src/io/]
T0: hardened DXF/STEP/IGES/.rdm importers (size cap 25 MB, time guards, Valibot validation, structured errors with entity context); `.rdm` round-trip test; File System Access API open/save in place with autosave + atomic writes; drag-drop anywhere.
T1: IFC4 structural + SAF import/export; Excel/CSV bulk import with column mapping; OpenSees TCL + plain JSON solver-input export; glTF export; shareable read-only link (gzip+base64url fragment, size-capped, download fallback).
T2: RDM6/Robot best-effort geometry import.

[WS-I REPORTS — apps/web/src/report/, Takumi PDF]
T0: report builder: pick/reorder sections (summary, geometry, loads, combinations, reactions, member checks with full CalcTrace, deflections, mass/carbon, 3D views, assumptions); cover page (logo, company, engineer, checker, revisions); live A4 preview with real pagination, TOC, page numbers, vector SVG charts in PDF; output language FR/EN independent of UI; unit/precision prefs; SHA-256 fingerprint + QR; auto "assumptions" page listing every non-default setting.
T1: DOCX export, templates, multi-model batch.

[WS-J PLATFORM & PERF — apps/web/src/platform/, workers, PWA]
T0: worker pool + cancellation + latest-wins coalescing; live-solve while dragging (<50 ms, non-blocking indicator); SharedArrayBuffer where COOP/COEP allow, graceful fallback.
T0: IndexedDB persistence, crash recovery, named snapshots + diff view, auto-snapshot before destructive ops.
T0: PWA offline + update toast; route-level lazy loading of everything heavy (KaTeX, uPlot, Takumi, three addons, report); CI budgets: initial JS ≤ 350 kB gz, LCP < 1.5 s, no long task > 50 ms during interaction.
T0: security: strict CSP (no inline script), SRI, headers (nosniff, referrer-policy), sanitized exports (confirm the stored-XSS fix, add regression test).
T1: opt-in E2E-encrypted collaboration (Yjs; key in URL fragment; presence, follow mode).

[WS-K DESIGN SYSTEM, DELIGHT, A11Y, I18N — apps/web/src/ui/, i18n/]
T0: finish the design system under impeccable rules (tokens; Comfortable/Compact/Dense; light/dark/high-contrast); inspector pattern; inline-editable tables with unit-aware parsing (`4m`, `4000mm`, `12kN`, `3,5 kN/m`); scrubbable number fields.
T0: ⌘K palette v2: fuzzy over commands, members (`P12`, `N3`), profiles (`IPE 240` → assign), load cases, settings, recent files; shows shortcuts; `?` cheat-sheet from the registry; context-aware commands.
T0: onboarding: 90-second interactive tour on the real UI (build portal frame → load → check); gallery of ≥12 validated examples with "why this example" notes (beam, continuous beam, portal, Warren, Pratt, space frame, multi-storey, gable shed, canopy, crane runway, footbridge, mezzanine); useful empty states.
T0: WCAG 2.2 AA: full keyboard use incl. the 3D scene (arrows move selection node→node, Enter edit, Esc exit), focus rings, ARIA live regions for solve results, reduced-motion, axe-verified contrast.
T0: i18n: FR+EN 100%; ES/DE/PT-BR scaffolded and flagged `needs-review`; locale-correct number/unit formatting; logical CSS properties (RTL-ready).
T1: micro-interactions that clarify (solve pulse, bar easing, snap tick), <200 ms, off under reduced motion.

[WS-L VERIFICATION, QA, RED TEAM — crates/*/tests, apps/web/e2e, docs/validation/]
T0: Validation Suite ≥40 benchmarks with closed-form/published references (beams under all load types, continuous beams via three-moment, portals via slope-deflection, trusses via method of joints, Euler buckling, NAFEMS-style eigenfrequencies, SCI/ECCS EC3 worked examples including N+M interaction and LTB with real C1) with stated tolerances in CI; an in-app "Validation" page shows live reference / computed / error.
T0: proptest: ΣF=0 and ΣM=0 equilibrium, case superposition, rigid-body and unit-scaling invariance, symmetry. Fuzz `.rdm`/DXF/STEP parsers; any panic is P0.
T0: visual regression (route × 3 viewports × light/dark, ≤0.1% diff, committed baselines), axe, trace-based perf budgets, bundle-size guard, bounding-box overlap/overflow assertions on every route.
T0: RED TEAM (from Wave B): huge models, pathological geometry, malformed files, rapid tool switching, undo storms, offline flapping, locale switch mid-edit, 200% zoom. Findings in `docs/v1.7/REDTEAM.md` with repros; owners fix; red team re-verifies.

═══ WAVES & INTEGRATION ═══
Wave A: WS-A, B, C, H, J, K start; WS-E/F on contract skeletons; WS-L builds harness + visual/perf infra.
Wave B: WS-D, G, I start on real engine outputs; RED TEAM starts; all integrate shortcut registry, CalcTrace, i18n keys.
Wave C (feature freeze at 70% of the session): fixes, polish, tests, docs only. INTEGRATION agent merges worktrees in dependency order (model/solver → design → wasm → stores → viewport → UI → reports), keeping the tree buildable at each step.
Then three independent reviewers on the full diff: (1) CODE REVIEWER (correctness, unwrap/panic/unwrap_or hunt, units, errors, dead code), (2) UX CRITIC (impeccable critique+polish+audit on every screen × 3 viewports; first-time-user and power-user walkthroughs; count clicks/keystrokes for 10 canonical tasks, each ≤ best competitor), (3) PERF/SECURITY (budgets, CSP, sanitization, `cargo deny`, `pnpm audit`). Owners fix; max 2 rounds.

CUT-LINE: T0 > T1 > T2. Under time pressure cut T2, then T1 by lowest competitive-matrix leverage. NEVER cut tests, validation, a11y, EC3 correctness (WS-B T0) or gates for a feature. Anything not meeting the bar goes behind a flag and into `STATUS.md`. Honest "not done" beats fake "done".

DEFINITION OF DONE:

- All T0 shipped; ≥70% of T1.
- 500-beam solve < 100 ms; live drag feedback < 50 ms; 10k-member model ≥ 60 FPS (hardware reported); initial JS ≤ 350 kB gz.
- EC3 member check includes N+M interaction, real C1/restraint LTB, Mz/Vy resistances, class 4; each emits a CalcTrace; ≥6 SCI/ECCS worked examples match within tolerance.
- 10 canonical tasks (build portal frame; snow+wind loads; EC3 check; optimize sections; see why a member fails and fix it; compare two variants; export PDF note; import DXF; share link; recover after crash) each under a documented click/time budget, evidenced by timed Playwright scripts.
- Zero overlap/clipping/vertical overflow on all routes at 1440×900, 860×900, 390×844, light + dark.
- ≥40 validation benchmarks green; proptest + fuzz green; axe 0 serious/critical.
- FR/EN 100% translated; ES/DE/PT-BR scaffolded.
- Security tests green (XSS, schema validation, size cap, CSP, headers).

GATES (G0→G6, AGENTS.md §4) 100% green:
cargo fmt --all --check && cargo clippy --workspace --all-targets --all-features -- -D warnings
RUSTFLAGS="-D warnings" cargo test --workspace --all-features
wasm-pack build bindings/rdm-wasm --target web --out-dir ../../apps/web/src/wasm-pkg
pnpm --filter web exec oxfmt --check && pnpm --filter web exec oxlint --deny-warnings && pnpm --filter web exec tsr generate && pnpm --filter web i18n:extract && pnpm --filter web i18n:compile && pnpm --filter web exec tsc --noEmit && pnpm --filter web test:unit && pnpm --filter web test:e2e
plus new gates G7–G9 (document in AGENTS.md): validation suite + visual-regression + a11y + perf/bundle budgets; `cargo deny check`; `pnpm audit --prod`.

HANDOFF & ARCHIVE (leave `main` tree dirty — NO commits on main):

- Update `STATUS.md` (shipped / flagged / cut, with evidence), `docs/v1.7/*`, `CHANGELOG.md`, `docs/validation/REPORT.md`.
- Write `.github/pr-body.md` and `ship.toml` (1 dirty file per `[[commit]]`, ordered by dependency); run `ship validate` until exit 0.
- Zip the clean tree as `rdm-studio-v1.7.0-<SHA>.zip` (exclude only `.git/`, `target/`, `node_modules/`, caches) into the downloads folder; print zip contents proof + a one-screen summary: features shipped, benchmarks passed, perf numbers, screenshot index, what was cut.s
