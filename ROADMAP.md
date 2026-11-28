# RDM Studio — Definitive Roadmap, M14 to 2029

*Prepared 28 November 2026 against `main` @ `274a7f7` (v2.5.0, 886 commits). Written for the product owner and for the AI agent that will execute it.*

## 0. The short version

- **The product is real and the foundations are good.** About 19 k lines of Rust across four crates plus a 3 k-line WASM binding, about 33 k lines of TypeScript, strict SI units, zero-panic rules, a Swiss-Metrology design system, 49 validation benchmarks, FR/EN (and more) i18n, PDF/DOCX/offline-HTML exports, a PWA. That is a serious base.
- **Your three-hour window for M14–M16 is workable only as vertical slices.** M14, M15 and M16 each bundle 2–3 deliverables that, in this repo's own history, took 1–3 sessions each (M11 took three sessions; M12 took two and still has three failing E2E flows). So each milestone below has an **hour slice** (what the agent ships in its hour, fully tested) and **completion work** (what finishes it to the quality bar). Nothing ships half-wired.
- **Several defects in code that M14–M16 will build on were found by reading source.** The most important: the EN 1998-1 elastic spectrum looks wrong on its ascending branch, the CQC correlation formula differs from the standard, the current wind generator is a placeholder that assigns `beam_id` as a `node_id`, and buckling, modal and P-Δ use dense O(n³) matrices. All are listed in §3 and should be fixed first, because M14.3 and M16.1 depend on them.
- **"Beating every competitor" is not a 3-year goal on breadth** (RFEM, Robot, SCIA, Advance Design, ETABS have decades of element and code coverage). It is a realistic goal on five dimensions where a browser-native, local-first tool can genuinely win. §9 defines them.
- **My review has limits** (§1). I could not compile or run anything, so every defect is labeled "read from source; write the failing test first".

## 1. What I actually reviewed, and what I did not

**Read in full or near-full:** `AGENTS.md`, `DESIGN.md`, `CHANGELOG.md`, `README.md`, `STATUS.md` (sessions 23–24), `ARCHITECTURE.md` (table of contents, §18 roadmap), `ci.yml`, `package.json`, `urlShare.ts`.

**Read in the code:** `rdm-solver` public surface, `buckling.rs` (assembly and iteration), `modal.rs` (structure), `p_delta.rs` (head), `seismic.rs`, `en1991.rs`, `rdm-model` (`Structure`, loads, `Thermal`, `AccelerationField`), the WASM export list and the `generate_env_loads_json`, `buckling_analysis_json`, `seismic_spectrum_json` bindings, the worker message list, file inventory with line counts.

**Skimmed or not read:** `sections.rs`, `multi_material.rs`, `en1993.rs` internals, `static_sparse.rs` beyond the factorization, all React components beyond headers, the 18 Playwright specs, `apps/site`, `apps/docs`, `packages/brand-studio`, the mockups.

**Not done:** no build, no tests, no profiling. The sandbox has no Rust toolchain and cannot reach the installer host. Treat §3 as a prioritized list of leads. Where I cite standard values from memory (EN 1998-1 Table 3.2) I say so, and the agent must confirm against your licensed copy.

**Assumption about M13.** M13 (2D plane/plate studio) is not in the repository: HEAD is M12 session 1, and STATUS.md says M12 session 2 is still pending. I treat your description of M13 as a plan. M15 depends heavily on it (§5.2).

## 2. State of the product

| Area | What exists | What limits it |
| --- | --- | --- |
| Static solver | Sparse CSC + faer `LLᵀ`, per-case solve, ULS/SLS superposition | Good. No nonlinear path. |
| Modal, buckling, P-Δ | Consistent mass, geometric stiffness, inverse iteration, P-Δ loop | Dense `nalgebra` matrices; buckling only on the Permanent case; no Sturm check for missed modes |
| Model | `Structure` with `Vec` nodes/beams, DOF offset = node position | Linear `find` lookups (O(n) each); no surfaces, shells, hinges, restraints list |
| Eurocode | EC3 member checks, LTB, classification, EC3-1-8 connections, EN 1990 combinations (6.10 and 6.10a/b), pattern loads, LM1 convoys, composite sections, optimizer | Wind/snow generators are placeholders; no EC2, EC5-in-depth, EC7, EC8 beyond spectrum + CQC |
| WASM bridge | \~45 exports, one 2 981-line `lib.rs`, JSON strings in and out, one-entry parse cache | Whole-project JSON re-parsed on a cache miss; file is a maintenance hotspot |
| Web | React 19, R3F, BVH picking, zustand + zundo + idb, worker, Lingui, shadcn/Base UI, uPlot | Four routes of 1 300–2 000 lines each (`results`, `report`, `loads`, `geometry`) |
| Exports | Vector PDF (takumi), DOCX, CSV, offline 3D HTML | Not yet tied to a traceable "calculation note" object |
| Quality | fmt, clippy `-D warnings`, oxlint, \~195 Rust `#[test]` + proptest/insta, 99 unit, 18 E2E specs; CI runs E2E on Chromium | Firefox not in CI; no solver benchmarks or perf budgets; E2E not green for M11/M12 at last record |
| Sharing | `lz-string` payload in the `p` search param | Query string reaches the host's logs; unencrypted (§3, item 8) |

## 3. Findings to fix before or alongside M14

Confidence labels: **High** = visible in the code by inspection; **Medium** = depends on how it is called or on my memory of a standard.

1. **EN 1998-1 elastic spectrum, ascending branch (High).** `elastic_spectrum` returns `ag·S·(2.5 + 0.5·T/TB)` for `T ≤ TB`. The standard's expression is `ag·S·[1 + (T/TB)·(η·2.5 − 1)]`, which is `ag·S` at `T = 0` rising to `2.5·ag·S` at `TB`. The current form gives 2.5 at `T = 0` and 3.0 at `TB`. Existing tests only cover the plateau and the descending branch, which is why it survived. This feeds the seismic panel today and would feed M14.3 (N2 target displacement) and M16.1 (spectrum-matched records).
2. **Type 1 ground parameters (Medium).** From memory, Table 3.2 gives C: `S = 1.15, TB = 0.20` and E: `S = 1.4`. The code has C: `1.35, 0.15` and E: `1.35`. Check against the standard.
3. **CQC correlation (Medium–High).** The Der Kiureghian form for equal damping is `ρ = 8ζ²(1+β)β^{3/2} / [(1−β²)² + 4ζ²β(1+β)²]`. The code uses `β^{2.5}` in the numerator and `(1−β²)⁴ + 4ζ²β(1−β²)²` in the denominator. The existing test only checks well-separated modes (where any formula gives ρ ≈ 0), so it cannot catch this.
4. **Wind generator (High).** `wind_load` emits a `Nodal` load with `node_id: beam_id` (a beam id used as a node id), a fixed `cf = 1.3`, a fixed `exposure = 1.0`, a fixed reference height, and `q = 1.5625·v²` regardless of terrain or height. Snow uses `Ce = Ct = 1` and a hard-coded 15° slope in the binding. M14.1 replaces all of this; delete the old path rather than extend it.
5. **Dense eigen-solvers (High).** `buckling_analysis` and `modal_analysis` build `DMatrix` of size `n_free²` (and `buckling` clones `K` via `k * 1.0` for the Cholesky). At 500 nodes (3 000 DOF) that is \~72 MB per matrix; at 1 700 nodes (10 000 DOF) it is \~800 MB per matrix against a 4 GB wasm32 ceiling. Static analysis scales; eigenvalue analysis does not. M14.2 (α\_cr) and M16.1 (time-history) both need a sparse path.
6. **Missed-mode risk (Medium).** Inverse iteration with deflation can silently skip a lowest mode when the start vector is orthogonal to it (symmetric frames are exactly where this happens). α\_cr is a safety classification; a missed mode misclassifies a sway frame as non-sway. Add a Sturm-sequence count (negative pivots of `K + λK_g` at a trial λ) to certify that no mode lies below the reported one.
7. **Buckling only on Permanent.** α\_cr must be evaluated on each ULS combination, since the governing combination is rarely the permanent one.
8. **Share links leak to the host and are not encrypted (High).** The payload is the `p` search parameter, so it is part of the HTTP request path and appears in host/CDN logs. That contradicts the "0 bytes cloud" claim. A URL *fragment* is never sent to the server. M16.3 fixes this; the move to the fragment can ship in M14 as a one-hour security fix.
9. **Process debt.** M11's E2E sweep was never recorded green; M12 has three failing flows, including a **`.ifc` export → re-import that hits the error branch** (a data-integrity risk, not cosmetic). `README.md` still says "pre-release / M8", `DESIGN.md` contains §7 twice, and README links to a Google search URL. Fix these in the first hour; they cost minutes and protect credibility.

## 4. Sizing model and Definition of Done

**Unit.** One milestone = one agent-hour of generation. A session = 3 hours = 3 milestones. This matches the velocity you described.

**The honest multiplier.** In this repo a milestone of M12's size shipped "implemented + unit-tested" in a session and left verification for the next. Plan for that: every fourth milestone is a **hardening milestone** (E2E green on Chromium and Firefox, perf budgets, docs, i18n, accessibility).

**Definition of Done for every milestone** (extends `AGENTS.md` gates G0–G6):

- **D1 Physics:** at least one *independent* reference per feature (closed form, published benchmark, or public worked example), tolerance stated, test in `crates/*/tests`.
- **D2 Traceability:** every number a user can see carries a calc trace (clause, formula, inputs) already supported by `CalcTrace`.
- **D3 Performance:** meets the budget in §8 or the milestone says why not. A criterion benchmark exists for any new numeric kernel.
- **D4 UX:** one-click path from a fresh project, undo/redo works, keyboard path exists, mobile bottom-sheet layout checked.
- **D5 Safety:** no new `unwrap`/`expect`/`panic` in solver/cad/wasm; typed errors; fuzz or proptest on any new parser.
- **D6 Docs and i18n:** FR source, EN complete, docs page, STATUS.md entry.
- **D7 E2E:** Chromium and Firefox green for the flow; screenshot captured for docs.

**Provenance rule for standards data.** The agent must not recall code tables from memory. Every coefficient lives in `crates/*/data/*.json` with a `source` field (standard, clause or table, edition, national annex). A human engineer signs off each data file once. Public worked examples from the JRC Eurocodes programme are the best golden tests; ask a human to supply them as fixtures.

## 5. M14–M16, rewritten as executable milestones

### 5.1 M14 — Climatic loads, sway classification, plastic pushover

**Hour-0 prerequisites (30–45 min, inside the M14 hour):** fix findings 1–3 with failing tests first (spectrum at `T = 0`, `T = TB`, continuity at `TB`, `TC`, `TD`; CQC against a hand-computed ρ for β = 0.5, 0.8, 0.95); move the share payload to the URL fragment; repair README/DESIGN hygiene.

**M14.1 Wind and snow generator (EN 1991-1-4, EN 1991-1-3)**

*Design decisions.*

- New crate `rdm-climate` (data-driven, no solver dependency). `rdm-eurocode` keeps thin re-exports.
- Introduce a **`SurfaceLoad` abstraction** (region + pressure field + normal convention) and a **`LoadDistributor`** (pressure on a region → line loads on the members that carry it, by tributary width and local axes). M15 reuses it for shells; building it now avoids a rewrite.
- Inputs: `L, B, H, α`, frame spacing `s`, terrain category 0–IV, national annex (wind zone / snow region / altitude), orography factor default 1, direction and season factors default 1. Data file per annex (the model already has `NationalAnnex`).
- Wind: `vb = cdir·cseason·vb,0`; `cr(z) = kr·ln(z/z0)` for `zmin ≤ z ≤ 200 m` with `kr = 0.19·(z0/0.05)^0.07`; `Iv(z) = kI/(co·ln(z/z0))`; `qp = (1 + 7Iv)·½ρ·vm²`; `we = qp(ze)·cpe`. Zones: vertical walls A/B/C/D/E by `h/d` and `e = min(b, 2h)`; roofs F/G/H/I (flat, monopitch, duopitch with J where applicable) by α and θ = 0°/90°. Use `cpe,10` for member design. Internal pressure as `cpi` envelope (two sign cases) and as an opening-ratio option.
- Output **load cases**, not one case: W(θ=0, cpi+), W(θ=0, cpi−), W(θ=90, ...), plus snow undrifted and drifted arrangements for duopitch and a multi-span μ2 option. Each rafter that crosses zone boundaries gets piecewise partial loads (`a_start`/`a_end` exist on `Trapezoid`).
- Pressure acts normal to the roof, so the generator writes loads in the member's local axes (the load type already carries `local_axes`).

*Acceptance.* A portal frame (e.g. 24 m × 60 m × 8 m, α = 5°, terrain II) reproduces a published worked example within 1 % on qp, zone widths, and resultant pressures; wall/roof total force balance holds (Σ pressure×area equals the integrated line loads to 1e-9); zone breakpoints land exactly at `e/10`, `e/4`, `e/2`.

*Hour slice:* `rdm-climate` core + walls and duopitch/monopitch/flat roofs for θ = 0° and 90°, snow μ1 (both pitches, drifted/undrifted), one-click UI wired to existing portal generators. *Completion:* canopies, free-standing walls, friction coefficients, opening-ratio cpi, orography, multi-span snow μ2/sliding, exceptional drifts.

**M14.2 Sway classifier and buckling-length assistant (EN 1993-1-1 §5.2)**

*Prerequisites in the solver.* (a) buckling evaluated per ULS combination using that combination's first-order axial forces; (b) a sparse generalized eigensolver (shift-invert Lanczos or block subspace iteration on a `faer` sparse factorization of `K` or `K + σKg`) with a Sturm count certifying the lowest mode; (c) a dense fallback only below \~1 500 DOF.

*Rules to implement.* `αcr = Fcr/FEd`. First-order analysis is acceptable if `αcr ≥ 10` (elastic) and **`αcr ≥ 15` when the analysis is plastic** (§5.2.1(3)). That second threshold matters for M14.3, so the UI must warn when pushover is run on a frame with 10 ≤ αcr < 15. For 3 ≤ αcr < 10, offer the amplified sway-moment method (factor `1/(1 − 1/αcr)`, §5.2.2(5B)); below 3, require second-order analysis (the existing P-Δ loop). Also show the approximate portal formula `αcr = (HEd/VEd)(h/δH,Ed)` as a cross-check where its conditions hold.

*Buckling lengths.* Derive in-plane `Lcr` from the eigenmode per member: `Ncr,i = αcr·NEd,i`, `Lcr = π·√(EI/Ncr,i)`, valid only for members with a significant share of strain energy in that mode; otherwise fall back to stiffness-distribution-factor formulas. Out-of-plane lengths come from **restraints**, not from the global mode, so add `lateral_restraints` (positions along the member: purlins, bracing, floors) to `Beam`. Write results to the existing `k_buckling_y`/`k_buckling_z` with a visible "auto" provenance flag, and keep user overrides sticky.

*Acceptance.* Euler column and Horne/Merchant portal closed forms; cantilever column K = 2.0, fixed-pinned 0.7, sway-free 0.5/1.0 within 0.5 %; a symmetric frame test that fails the old inverse iteration and passes the Sturm-checked solver.

*Hour slice:* per-combination α\_cr via the existing solver with the Sturm guard and a size cap, classification badge, `k_y`/`k_z` population with provenance. *Completion:* sparse eigensolver, restraint editor, amplified sway moments, LTB lengths and C1 from the moment diagram.

**M14.3 Nonlinear plastic-hinge pushover (EN 1998-1 §4.3.3.4)**

*Method.* Two stages: gravity (G + ψ2Q) first, then a lateral pattern scaled by λ (modal-proportional and uniform patterns, per EN 1998-1). Use **event-to-event** stepping: solve elastic, compute the λ increment to the next member end reaching `Mpl,Rd` (reduced for axial force per EC3 §6.2.9 and for shear per §6.2.8), insert a rotational release carrying the residual moment, continue. Detect the mechanism through a pivot test, not through a failed Cholesky alone. Add a displacement-controlled mode so softening after a mechanism can be traced, and a small residual-stiffness option for robustness.

*Outputs.* Capacity curve (V\_base or λ vs control-node δ) live in uPlot; hinge sequence with step numbers on the 3D model; bilinear idealization by equal energy; ductility μ; overstrength `αu/α1` (feeds the EN 1998-1 behaviour-factor discussion); N2-method target displacement (Annex B) using the corrected spectrum. Progressive-collapse (notional member removal, EN 1991-1-7) is a separate analysis: schedule it for Q2 of year one.

*Acceptance (closed forms).* Fixed-fixed beam, central load: `Pu = 8Mp/L`; propped cantilever, central load: `6Mp/L`; simply supported: `4Mp/L`; uniform load fixed-fixed: `wu = 16Mp/L²`; fixed-base portal with equal Mp: sway mechanism `H·h = 4Mp`, beam mechanism `W·L/... = 8Mp` form, and the combined mechanism `H·h + W·L/2 = 6Mp`. Hinge order and λ at each event within 1e-9.

*Hour slice:* planar and spatial frames, hinges at member ends with M-N reduction, event-to-event curve, hinge overlay, bilinear fit. *Completion:* distributed plasticity (fiber sections), P-Δ coupling inside steps, rotation-capacity limits, N2 and capacity-spectrum UI, progressive collapse.

### 5.2 M15 — Unified shell-and-beam solver

**Dependency check first.** If M13 lands plane/plate elements inside `rdm-solver`, move them into a new `rdm-shell` crate (element kernels with no app knowledge) before M15 starts; otherwise M15 duplicates them.

*Elements.* Primary: **MITC4** (Reissner–Mindlin, locking-free) with an in-plane membrane carrying a drilling DOF (Allman-type or Hughes–Brezzi), 6 DOF per node so beams and shells connect without special tying. Secondary: a 3-node element (MITC3 or DKT-based plate + membrane with drilling) because arbitrary slab outlines need triangles. Quads where the geometry is regular; triangles elsewhere.

*Meshing.* Constrained Delaunay (the `spade` crate is WASM-friendly) with **conforming constraint edges** along beam lines, wall bases and openings, so beams share nodes with the shell. Add beam eccentricity (rigid offsets between the slab mid-surface and the beam centroid), because composite floor behaviour depends on it.

*Loads and results.* Surface pressure, hydrostatic (linear in depth), temperature gradient through thickness (thermal curvature), line supports and edge springs. Contours of Von Mises (top/bottom fiber), principal moments, and **Wood–Armer** design moments for reinforcement; nodal recovery by averaging first, SPR later. Colour maps as vertex attributes in a custom shader, with a perceptually uniform option alongside the DESIGN.md thermal ramp.

*Model schema.* Bump `.rdm` to v3 with an ID-indexed arena for nodes, members and surfaces (fixes the linear-lookup issue), reusing `migrate_project_json`. Breaking the format is acceptable and `ProjectFile` already carries a version.

*Acceptance (standard shell suite).* Patch tests (membrane and bending), MacNeal–Harder set: Scordelis-Lo roof, pinched cylinder, hemisphere with hole, twisted beam, Morley skew plate; Navier simply-supported plate series; beam-slab compatibility test (T-beam deflection against a hand estimate); convergence-rate tests under mesh refinement; drilling-DOF zero-energy modes counted exactly (6 rigid-body modes).

*Hour slice:* MITC4 + membrane, rectangular and polygon slabs via triangulated fallback, surface pressure, one fringe plot (Von Mises) in the 3D viewport, beam-shell connection on shared nodes. *Completion:* MITC3, openings, shear walls, hydrostatic/thermal, Wood–Armer, line supports, eccentricity, mesh-quality diagnostics, shell checks.

### 5.3 M16 — Time-history, footings, shareable review

**M16.1 Time-history (Newmark-β).** Average acceleration (`β = 1/4, γ = 1/2`, unconditionally stable) as the default. For linear models the effective stiffness `K̂ = K + γ/(βΔt)·C + 1/(βΔt²)·M` is constant: **factor once** with the faer sparse Cholesky and re-use it each step. Rayleigh damping by two target frequencies and ratios (`ξi = ½(α/ωi + β·ωi)`), shown on a ξ(ω) plot so engineers see where damping drifts. A modal-superposition path with exact piecewise-linear integration is the cheap option for many steps. Accelerograms: **do not bundle El Centro or other archive records** without checking licence terms; ship synthetic records and a parser for common archive formats (PEER AT2, ESM, CSV). Synthetic spectrum-matched records follow EN 1998-1 §3.2.3.1.2 (stationary part ≥ 10 s; ≥ 3 records; mean spectrum within the stated tolerance of the target over 0.2T1–2T1), generated by random-phase synthesis with iterative amplitude correction (`rustfft`/`realfft`). This only works once finding 1 is fixed. Acceptance: SDOF free vibration and harmonic steady state against closed forms; period elongation error vs Δt; energy balance within 1e-6.

**M16.2 Footing designer (EN 1992-1-1 + EN 1997-1).** Import support reactions from the active combination sets and pick the right ones: for GEO under Design Approach 1, Combination 1 (A1 + M1 + R1) and Combination 2 (A2 + M2 + R1); the model already has the combination builder to extend. Checks: effective area (`B' = B − 2e`), bearing from EN 1997-1 Annex D (drained and undrained), sliding, EQU/overturning, EC2 §6.4 punching with the β eccentricity factor and the enhancement within 2d, and flexure with the rectangular stress block and `As,min`/spacing rules; bar selection `HA10–HA25` (data-driven). **Market-fit warning:** French practitioners work to NF P 94-261, not generic EC7 Annex D. Decide now whether this milestone ships an EC7-only module labelled as such, or adds an NF P 94-261 profile; do not default French users into EC7 DA1 without saying so.

**M16.3 Encrypted snapshot links and review.** AES-256-GCM through WebCrypto; the key lives in the **fragment** (`#k=…`), never in the query. Compress with `CompressionStream('deflate-raw')` or `fflate`. URL length caps the model size (messaging apps break long links), so also offer a `.rdmshare` file, and treat an optional ciphertext relay as an explicit opt-in so the default stays at zero bytes. Pinned cameras are stored as part of the snapshot. Reviews: comments as an append-only signed log (Ed25519 via WebCrypto) merged with a CRDT (Automerge or Yjs), so a reviewer's reply returns as a file or link and merges without a server. Add a visible verification state ("signed by …, model hash matches"), which is also what makes a checker's stamp meaningful.

*Hour slice for M16 (all three):* Newmark with the cached factorization, Rayleigh, import of CSV/AT2, harmonic and pulse loads, envelope plot; footing bearing + sliding + overturning + punching + flexure for a single pad with imported reactions; AES-GCM fragment links with a pinned camera. *Completion:* synthetic matching, strip footings, NF P 94-261 profile, CRDT comments, signature verification, relay.

## 6. Architecture decisions that unlock the next three years

Each is a decision record the agent should write into `docs/adr/` as it implements. They are ordered by how much later work they unblock.

1. **ADR-1: ID-indexed model arena, `.rdm` schema v3.** Replace `Vec` + `find` and "DOF offset = position" with an arena (dense `Vec` plus id-to-index map, or `slotmap`). Add `surfaces`, `restraints`, `hinges`, `stages`. Breaking change, one migration function, golden migration tests from every historical version.
2. **ADR-2: A stateful model handle inside WASM.** Today each call passes the whole project as a JSON string with a one-entry parse cache. Move to a `Project` object living in wasm memory that accepts small **patches** (`add_node`, `set_section`, `move_node`) and answers queries. This is the prerequisite for live editing on 10 k-member models and for incremental re-analysis. Split the 2 981-line `lib.rs` into one module per domain at the same time.
3. **ADR-3: A shared nonlinear/eigen core (`rdm-nl`).** Sparse generalized eigensolver with Sturm certification, Newton with line search, displacement/arc-length control, event-driven stepping. M14.2 (αcr), M14.3 (pushover), M16.1 (time-history) and Year-2 geometric and material nonlinearity all sit on it.
4. **ADR-4: Element kernels in their own crate (`rdm-shell` or `rdm-fem`).** Pure functions from nodal coordinates and properties to matrices and stress recovery, tested element-by-element before assembly. Shared by M13 and M15.
5. **ADR-5: Standards as data packs.** `crates/rdm-standards/data/<standard>/<edition>/<annex>.json`, each coefficient with `source`, `clause`, `edition`, `reviewer`, `reviewed_on`. The engine refuses to run a pack marked unreviewed in "release" mode and labels results "draft" otherwise.
6. **ADR-6: Calculation graph as first-class output.** Generalize `CalcTrace` into a typed graph (inputs, formulas, clauses, intermediate values, units) that renders to the UI, PDF, DOCX and a "why?" explorer, and enables diffs between design iterations.
7. **ADR-7: Reproducibility.** Every result stores solver version, data-pack hashes and a content hash of the model. "Reproduce this result" re-runs and verifies bit-for-bit where the platform allows. This is what a checking engineer actually needs.
8. **ADR-8: Native companion.** All numerics are pure Rust, so a Tauri shell gives the same code native speed, no 4 GB wasm32 ceiling and real threads. Browser stays the primary product; desktop is the answer for 100 k-DOF models. For wasm threads, plan the COOP/COEP headers early (they affect embeds and third-party scripts) and keep `faer` with `default-features = false` as `AGENTS.md` requires.
9. **ADR-9: Headless engine.** Publish the engine as an npm/WASM package and a CLI so firms can script runs, batch-check libraries of frames, and regression-test their own templates.

## 7. Quality and performance system

### 7.1 Budgets (targets to be measured, not yet measured)

| Quantity | Target | Mechanism |
| --- | --- | --- |
| Static solve, 1 000 nodes | < 150 ms (wasm, single thread) | criterion bench, nightly gate |
| Static solve, 10 000 nodes | < 2 s | same |
| αcr, 1 000 nodes, 4 modes | < 1.5 s | sparse eigensolver bench |
| Pushover, 100 members, 200 hinge events | < 1 s | event-driven stepping bench |
| Time-history, 1 000 DOF × 4 000 steps | < 2 s | cached factorization |
| Shell model, 20 k DOF | < 1.5 s | faer sparse + AMD ordering |
| Viewport | 60 fps at 20 k members; pick < 0.2 ms | `InstancedMesh`/`BatchedMesh`, existing BVH |
| Cold start from share link to first result | < 3 s on mid-range laptop | Lighthouse CI + Playwright trace |
| WASM payload | tracked per PR, regression > 5 % blocks | size-limit style check |
| Peak memory, 10 k nodes | < 1.2 GB | memory probe in nightly |

The repo has a vitest BVH benchmark but no solver benchmarks. Add `criterion` benches in the first hardening milestone so every later claim has a number.

### 7.2 Correctness layers (cheap to expensive)

1. **Closed forms** (beams, columns, mechanisms, Euler, SDOF). Already the repo's strength.
2. **Invariants as property tests**: global equilibrium, symmetry, six rigid-body modes, energy balance, Maxwell–Betti reciprocity, mesh-refinement convergence rates.
3. **N-version golden values**: an independent Python reference (numpy/sympy, written without reading the Rust) produces expected values for each new kernel. This is the strongest defence against an AI agent confidently implementing a wrong formula, which is exactly the class of bug in §3.
4. **Differential testing against another solver.** The product already exports OpenSees input (`export_bim`). Generate random frames with proptest, run both in a nightly job (openseespy), and compare displacements and reactions. Add Code\_Aster or CalculiX for shells.
5. **Published benchmarks**: MacNeal–Harder, Navier plate series, NAFEMS-style cases, public Eurocode worked examples.
6. **Mutation testing** (`cargo-mutants`) monthly on the solver and Eurocode crates. The spectrum bug would have shown up as a surviving mutant.
7. **Fuzzing** (`cargo-fuzz`) for `.rdm`, DXF, STEP, IFC4 and SAF parsers; the backlog already lists it. The failing `.ifc` round-trip is a reminder that import/export need property tests (`export → import` equals identity).
8. **A public Validation Book**: every benchmark rendered from the test suite into a browsable manual (inputs, reference, result, error, date, commit). Competitors publish verification examples; an auto-generated one that cannot go stale is a differentiator.
9. **Human sign-off** on each standards data pack and each design module by a licensed engineer, recorded in the pack metadata.

### 7.3 Web quality

- Add **WebKit** to CI (Playwright's hosted runners support it; only the local sandbox lacked libraries). Safari and iPad users are in the target audience.
- Add Firefox to CI; it is currently local-only.
- WCAG 2.2 AA, keyboard-only modeling path, colour-blind-safe contour option, reduced-motion respected (already configured).
- Supply chain: `cargo-deny`, `cargo-audit`, `pnpm audit`, SBOM per release, CSP and COOP/COEP review. The dependency set is on very recent majors (React 19.3, TypeScript 7, Vite 8); keep a documented upgrade cadence and pin by lockfile.

## 8. Three-year plan

**Cadence assumed:** one 3-hour session yields three milestones, one session every two to three weeks, one milestone in four is hardening. That is about **165 milestones in about 55 sessions** over three years. Humans (review, standards sign-off, user research) are the real pacing item, not generation. The first quarter is specified in detail; later quarters are scoped by epic and re-planned at each quarter boundary using what shipped.

### Year 1 — A credible engine (M14–M60)

| Quarter | Milestones | Theme and outcomes |
| --- | --- | --- |
| Q1 2027 | M14–M16 (this window), M17–M24 | **M17 hardening:** M12/M14–M16 E2E green on three browsers, criterion benches, README/DESIGN cleanup, mutation run. **M18:** ADR-1/2/3 (arena, model handle, `rdm-nl` with sparse eigen). **M19–M20:** M14–M15 completion (sparse αcr, restraint editor, MITC3, openings, shear walls). **M21:** hardening. **M22–M23:** EN 1993-1-1 completeness: LTB general and special methods with C1 from moment diagrams, class-4 effective sections (EN 1993-1-5), Annex A/B interaction. **M24:** hardening and first Validation Book release |
| Q2 2027 | M25–M36 | **Concrete and foundations:** EC2 beams/columns/slabs (flexure, shear, N–M interaction, nominal curvature), Wood–Armer to bar schedules, strip/pad/raft footings, NF P 94-261 profile, EC2 detailing and drawings (bar schedules as tables first). Progressive collapse (EN 1991-1-7). Timber EC5 and aluminium EC9 depth. Two hardening milestones |
| Q3 2027 | M37–M48 | **Seismic done properly (EN 1998-1):** behaviour factor workflow, capacity design for steel and RC frames, DCL/DCM/DCH checks, torsional effects and accidental eccentricity, N2 UI, spectrum-matched records in 3D, soil-structure springs. Semi-rigid joints from the EC3-1-8 component method feeding global analysis |
| Q4 2027 | M49–M60 | **Workflow and trust:** project health dashboard, living calculation notes with design-iteration diffs, signed reviews (CRDT), org libraries (profiles, materials, templates), headless CLI/npm engine (ADR-9), desktop beta (ADR-8). Public beta with design partners |

### Year 2 — A complete workstation (M61–M120)

- **Nonlinear and construction stages:** corotational large displacements, fiber sections for distributed plasticity, tension-only and compression-only members, gaps and contact springs, cables, staged construction and creep/shrinkage (concrete), temperature histories.
- **Bridges and heavy industry:** full EN 1991-2 traffic models, influence surfaces, crane runways (EN 1993-6) and fatigue (EN 1993-1-9), steel–concrete composite beams (EN 1994).
- **Fire and robustness:** EN 1991-1-2 fire curves, EN 1993-1-2 / EN 1992-1-2 section checks, then thermal-mechanical coupling.
- **Foundations:** piles, rafts on Winkler and layered soil, settlements, retaining walls.
- **Optimization and sustainability:** multi-objective sizing (mass, cost, embodied carbon from EPD data packs), what-if comparisons across design alternatives.
- **Interop and automation:** robust IFC4 import/export, SAF, Revit/Rhino/Grasshopper bridges as plugins on the headless engine, a scripting API (JS first, Python in a worker).
- **Collaboration:** optional zero-knowledge relay for real-time review, organization workspaces, offline-first merge.

### Year 3 — Ecosystem and certification (M121–M180)

- **Standards marketplace:** national annex and national-standard packs (FR first, then DE, BE, NL, IT, ES, PL, UK) created by the pack tooling, each reviewed and signed.
- **Plugin SDK** with a capability-based sandbox; verified third-party design modules (precast, cold-formed steel, glass, masonry).
- **Enterprise:** self-hosted team server, SSO, audit logs, quality-management exports for ISO-style documentation.
- **Independent verification:** commission a third-party validation report (university or inspection body) against the Validation Book. This is the single biggest credibility asset for professional adoption.
- **GPU and scale:** `wgpu` for contour and mode rendering at scale, optional GPU iterative solver on desktop for very large shell models.
- **AI as an assistant, never as the calculator.** Natural-language modeling ("portal frame, 24 m span, IPE 400, snow region B2") produces a *model* that the deterministic engine checks; an explainer reads the calculation graph; an anomaly detector flags unstable supports, unit slips and inconsistent restraints. The rule is hard: no design check number ever originates from a language model.

## 9. Where RDM Studio can actually beat the incumbents

The established tools (RFEM, Robot, SCIA, Advance Design, ETABS and others) lead on element breadth, national code coverage and BIM integration, and will for years. I have not audited their current releases, so treat this as a positioning hypothesis to test with 10–15 interviews per segment. The areas where a local-first browser product can win:

1. **Time to first answer.** No install, no licence server, a result in seconds, a share link that opens to a solved model.
2. **Transparency and auditability.** The calculation graph, an open Validation Book, reproducibility hashes and signed reviews. Checking engineers want to see why, not trust a number.
3. **Privacy by construction.** "0 bytes cloud" matters for naval, defence, industrial and any client under NDA. It must be literally true, which is why the share-link fix (finding 8) is a trust issue and not a polish item.
4. **Learning and collaboration.** The product's naming and benchmarks (RDM6/RDM7) point at the French engineering-school ecosystem. Education is the natural beachhead: students become professionals with the tool already in their hands.
5. **Automation.** A headless engine and scripting API turn the product into infrastructure that firms embed in their own workflows.
6. **Price and licence model.** The existing tiers (a 48-hour project pass, monthly Pro, team/intranet) are already unusual in this market.

For a French audience specifically, the default locale, NF national annexes and NF P 94-261 for foundations are table stakes, not extras.

## 10. What "astonishing, beautiful, ergonomic, intuitive" means in concrete moves

- **Keep the 5-step spine.** M14–M16 add several analysis types. Do not add top-level steps. In Step 4 use a single **analysis lens** control (Static, Stability, Modal, Pushover, Time-history) plus command-palette entries, so the navigation stays learnable.
- **Always-live results.** The worker already has `LIVE_SOLVE`. Show the previous result dimmed while recomputing, keep small models under \~100 ms, and (via ADR-2) update diagrams while a node is being dragged.
- **Make stability visible.** Animate the critical eigenmode, highlight the member that governs `Lcr`, and explain "why αcr = 8.3" in one sentence with a link to the clause.
- **Pushover as a storyboard.** Scrub the capacity curve and watch hinges form in order on the 3D model; same scrubber idiom as the existing cutting plane and train position.
- **One "project health" panel** collecting validation issues, unreviewed standards packs, αcr status, mesh quality, unresolved review comments. It is the single place that answers "can I trust this model?"
- **Design-iteration diffs.** Extend the existing what-if toast (mass and utilization delta) to a full compare view between two versions of a project.
- **Direct manipulation everywhere.** Drag loads, drag supports, type a number in the 3D label; selection filters, isolate, clip box and layers for big models.
- **Reports as living documents.** A calculation note is a view of the calculation graph, versioned, signed and diffable, not an export step.
- **Onboarding that cannot rot.** Make the guided first-model tour a Playwright flow that doubles as the documentation media capture (the repo already has `capture-docs-media.mjs`).
- **Decision for you:** `DESIGN.md` bans dark mode. Long sessions and site use argue for an optional dark theme. The token system makes it cheap; the spectrum-isolation rule would need a dark-safe ramp. I suggest scheduling it in Q4 2027 and testing demand first.

## 11. Risks and the human gates that control them

| Risk | Why it matters | Control |
| --- | --- | --- |
| Wrong coefficient or formula from an AI agent | Safety-relevant software; §3 shows the failure mode is real | Provenance rule, N-version golden values, mutation tests, human sign-off per data pack |
| Professional liability | Output is used for real structures | Clear licence/terms, "draft" labelling of unreviewed packs, independent validation, legal and insurance advice before commercial launch |
| Standards copyright | Eurocode texts are copyrighted | Store coefficients and clause references, not verbatim text; get a legal opinion before shipping tables or text in docs |
| Velocity outruns verification | M11 and M12 left E2E red | Hardening milestone every fourth; no milestone counted done without D1–D7 |
| Browser memory ceiling | wasm32 4 GB, mobile tabs far less | Sparse paths, memory budgets, native companion (ADR-8) |
| Safari gaps | iPad is a field device | WebKit in CI |
| Bleeding-edge dependencies | Very recent majors across the stack | Upgrade cadence, lockfile, automated update PRs with the full gate |
| Scope creep in navigation | Many analyses compete for space | Lens control, palette, project-health panel |
| Bus factor | Knowledge is in the agent's output | ADRs, Validation Book, `STATUS.md` discipline |

## 12. What to do next

**Before the agent starts (about one hour of your time)**

1. Decide the **default national annex** and whether footings ship as EC7-only or with NF P 94-261.
2. Confirm **where M13 lives**. If it is not merged, tell the agent M15 starts from an empty `rdm-shell`.
3. Give the agent a **fixtures folder**: worked examples and standard extracts for EN 1991-1-3/-1-4, EN 1993-1-1 §5.2, EN 1998-1 §3.2 and §4.3.3.4. Without them the agent will fall back on memory.
4. Instruct it to write the **failing tests from §3 first**, then fix.

**Inside the three hours**

- Hour 0 (inside the M14 hour): §3 items 1–3, the fragment move for share links, README/DESIGN cleanup.
- Hour 1: M14 slice. Hour 2: M15 slice. Hour 3: M16 slice. Last 15 minutes: gates G0–G5, `STATUS.md`, `ship.toml`, `.github/pr-body.md` per `AGENTS.md`, and a plain list of anything not verified.

**Immediately after**

- Run G6 on Chromium, Firefox and WebKit. Resolve the three M12 failures (grouped optimizer label, `.ifc` round-trip) before any new feature.
- Have a human check the spectrum parameters and one wind worked example against your licensed standards.
- Schedule **M17 as a pure hardening milestone**.

**Decisions I need from you**

1. Default national annex and the NF P 94-261 question (§5.3).
2. Dark theme: schedule it or keep the ban.
3. Desktop companion: commit to Tauri in Year 1, or defer.
4. Which first segment to court: French design offices, naval/lifting, timber, or education.
