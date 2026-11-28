Session 25 (2026-11-28): **Milestone M13 — Session 1 of 2 (M12 E2E
Residual Polish + Pure-Rust 2D Finite Element Mesher & Plane
Stress/Strain + Mindlin Plate Solver)** on top of origin/main 6de4b3d
(v2.4.0), tree left dirty (zero commits, see ship.toml +
.github/pr-body.md). Workspace version bumped to 2.5.0.

## M13 shipped in this session (implemented + tested)

1. **M13.2a — `crates/rdm-mesh` (NEW): deterministic 2D Constrained
   Delaunay Mesher**:
   - Bowyer–Watson Delaunay over a super-triangle, per-edge resampling at
     `h_max`, segment recovery by cavity walk + ear-clipping
     retriangulation, bounded Delaunay flip sweep (constrained edges
     kept), deterministic interior lattice seeding with a constraint-safe
     cavity guard, optional `h_refine` refined seed band around holes,
     even-odd hole carving, boundary-edge extraction tagged with the
     source input edge, and quality summary (min/max angle, area).
   - Zero `.unwrap()/.expect()/panic!()` in library code — typed
     `MeshError` (`thiserror`).
   - 6 unit tests green: square area conservation (< 1e-12), circular-hole
     area preservation + hole-boundary tagging, rectangular hole
     connectivity, concave L-shape area, byte-for-byte determinism,
     degenerate-input typed errors.

2. **M13.2b — `crates/rdm-solver/src/fem2d.rs` (NEW): 2D FEM solver**:
   - Plane stress / plane strain (`CST` 3-node + `LST` 6-node quadratic
     with deduplicated mid-sides, consistent quadratic-edge pressure
     loads L/6 + 2L/3): sparse `faer` LLᵀ assembly/factorization, edge
     restraints (fixed/pinned/roller_x/roller_y/pressure), point loads,
     element + area-weighted nodal stress smoothing, principal stresses
     (σ1, σ2, θp), Von Mises (incl. plane-strain σzz coupling), Kt
     telemetry, u_max/extrema.
   - Mindlin–Reissner plate bending with the MITC3 tied-shear triangle
     (bending at the centroid + 2-point tying, exact 3-point quadrature):
     w, θx, θy DOFs, area pressure + point loads, smoothed bending
     moments (mx, my, mxy) and transverse shears (vx, vy).
   - `tests/fem2d_benchmarks.rs` — 6 analytical benchmarks GREEN:
     cantilever deep-beam tip shear vs Timoshenko (< 2 %), plane-strain
     conversion ratio vs (1 − ν²) (2 %), Kirsch perforated-plate stress
     concentration (Kt band), SS square vs Navier series, clamped square
     vs Timoshenko coefficients, LST-vs-CST mesh coarseness.
   - Root-caused and fixed on the way: LST shape-function derivative
     `∂N4/∂s = −4r` (was −4s — transcription slip), the transposed
     Jacobian inverse in the LST B-matrix, and the CST/LST pressure-edge
     consistent-load distribution.
   - Known limitation (documented): the MITC3 plate converges from the
     stiff side on simply-supported edges (SS square ≈ −17 % on w at
     div-28; clamped square w +0.62 %, m −6.8 %). A first DKT
     (Batoz–Bathe–Ho) implementation was attempted this session and
     validated per-element against exact curvature fields, but its
     global w–θ coupling still shows a wrong-sign strip response — the
     DKT swap is the FIRST item of Session 2, after which the SS/clamped
     tolerances tighten to the 2 % contract.

3. **Cargo workspace**: `crates/rdm-mesh` registered; `rdm-solver` gains
   the `rdm-mesh` dependency; workspace version 2.4.0 → 2.5.0
   (Cargo.toml + Cargo.lock regenerated).

## Verification gates run in this session

- `cargo test -p rdm-mesh` ✓ 6/6 · `cargo test -p rdm-solver` ✓ 41/41
  (34 existing solver + 6 new fem2d benchmarks + 1 lib) — all green
  after the LST fixes.
- `cargo fmt -p rdm-mesh -p rdm-solver` ✓ applied.
- G0 clippy, G1 full workspace, G2 wasm-pack, G3 tsc, G4 i18n, G5 unit,
  G6 E2E: NOT run at cutoff (session ended mid-milestone).

## Remaining for M13 Session 2 (exact next steps)

1. **DKT plate element**: replace MITC3 tying with the validated DKT
   (Batoz–Bathe–Ho 1980) — the per-element construction is already
   benchmark-exact in a scratch harness; the remaining defect is the
   global w–θ coupling sign in the strip response. Then tighten the SS /
   clamped benchmark tolerances to < 2 % (Navier / Timoshenko).
2. **M13.0 — M12 residual E2E polish**: grouped-optimizer row label
   (`is_group` + group_name badges in `OptimizerModal.tsx`; the idb-keyval
   300 ms debounce also needs a `pagehide` flush so the M12.3 flow
   survives the `/results?modal=optim` reload) and the `.ifc` round-trip
   parser fix (rewrite `import_ifc4_structural` to parse
   `IFCCARTESIANPOINT` coordinates + correct beam endpoint indices — the
   current importer fabricates unit-grid nodes and references a
   non-existent node id).
3. **M13.1 — DRY Lingui "Nouveautés"**: `pnpm --dir packages/brand-studio
   sync` subcommand (copy illustrations → `apps/web/public/releases/`,
   generate `releaseMeta.generated.ts` from git tags), Lingui-native
   `apps/web/src/releases/userChangelog.ts` (v2.1.0 → v2.5.0),
   `WhatsNewModal.tsx` Swiss Metrology dialog + driver.js 2-step spot
   tours, header trigger + ⌘K entry, AGENTS.md §6 sync step.
4. **M13.3 — Fem2dStudioModal.tsx** (Plaques & Élasticité 2D): presets,
   SegmentedControl theory, SVG fringe viewport (`fem2d-viewport`),
   telemetry; wire `solve_fem2d_json` through `bindings/rdm-wasm` +
   `fea.worker.ts` + `workerClient.ts` (the Rust endpoint contract is
   ready in `fem2d.rs`).
5. **M13.4 — i18n extract/compile (fr, en, es, de, pt_BR) +
   `m13-whatsnew-fem2d.spec.ts`**, then the full G0→G6 gate sweep and
   the ship.toml / pr-body.md / zip handoff.

---

Session 24 (2026-11-28): **Milestone M12 — Session 1 of 2 (EN 1993-1-8 Steel
Connections Studio, EN 1991-2 LM1 Moving Loads & Influence Lines, Member
Groups & Storey Drift, Inclined Supports & Custom Materials, Bidirectional
IFC4/SAF Import)** on top of origin/main d6e4228 (v2.4.0), tree left dirty
(zero commits, see ship.toml + .github/pr-body.md).

## M12 shipped (implemented + tested)

1. **M12.1 — EN 1993-1-8 Steel Connections Studio**:
   - `crates/rdm-eurocode/src/multi_material.rs` extended into a complete
     connection engine: `BoltGrade` (4.6/5.6/6.8/8.8/10.9 with fub/fyb/
     αv/fu-fub bearing caps), `BoltSize` (M12–M36, As + clearance d0),
     Table 3.4 shear `Fv,Rd = αv·fub·As/γM2`, bearing `Fb,Rd = k1·αb·fu·d·t/
     γM2` (αd = e1/3d0 | p1/3d0 − 1/4, k1 edge 2.8e2/3d0 − 1.7 and inner
     1.4p2/3d0 − 1.7 with the SCI P398 floor 1.5), tension `Ft,Rd = k2·fub·As/
     γM2` (k2 = 0.63), §3.7 combined interaction `Fv/Fv,Rd + Ft/(1.4Ft,Rd)`,
     §3.10.2 block tearing `Veff,1,Rd = 0.6·fu·Ant/γM2` (+ net shear area
     Anv), Table 4.1 βw (0.80/0.85/0.90/1.00) and the §4.5.3 directional
     weld check `√(σ⊥² + 3τ⊥² + 3τ∥²) ≤ fu/(βw·γM2)` + `Fw,Rd = fv,w,Rd·a·L`.
   - `ec3_connection_check(ConnectionInput)` distributes the design actions
     per topology — EndPlate (`Platine d'about`, moment rows through the
     plastic lever arm z = e1 + p1·(rows−1)), FinPlate (`Éclisse / Attache
     d'âme`) and Gusset (`Gousset de treillis`) — and returns a
     clause-by-clause CalcTrace + governing utilization.
   - `bindings/rdm-wasm`: `ec3_connection_check(input_json)` with
     **auto-import of (NEd, VEd, MEd) from the active ULS envelope** of the
     selected beam (`project_json` + `beam_id` → superimposed_beam_state →
     station maxima).
   - `ConnectionStudioModal.tsx`: two-column Swiss Metrology daylight
     dialog — LEFT `connection-svg` interactive dimensioned joint elevation
     (plate outline, bolt grid with d0 holes, e1/e2/p1/p2 dimensions, weld
     throat triangles, N/V/M force vectors); RIGHT topology/grade/size/steel
     SegmentedControls, bolt rows & columns steppers, mm NumberFields
     (p1/p2/e1/e2/t/a/Lw), clause readout with `StatusBadge` utilization
     pill (`connection-utilization`) and `CopyButton` TSV. Entry triggers:
     `open-connection-studio` in the Step 4 EC3 rail + ⌘K palette
     "Studio Assemblages EC3-1-8" (`?modal=connection` deep link).
   - `crates/rdm-eurocode/tests/connections_ec3_8.rs` (9 tests): M20 8.8
     shear/tension 78.4/98.784 kN, edge/inner bearing 67.314/79.524 kN,
     interaction 0.65478/1.32658, block tear 129.946 kN + Anv 2 676 mm²,
     S355 fw = 241.20 MPa + directional η = 0.41451, end-plate moment rows
     107.143 kN/bolt, topology labels — all < 0.5 % vs hand calculations.

2. **M12.2 — Influence Lines & EN 1991-2 LM1 Moving Loads**:
   - `crates/rdm-solver/src/moving_loads.rs`: `ResponseKind::DisplacementUz`
     (+ `parse`/`code` for uz|My|Vy|N|Rz), `AxleTrain` (wheel loads +
     axle spacings, LM1 tandem & 4-wheel `Pont roulant` factories) and
     `train_envelope` → `TrainEnvelope` (My max/min, Vz/N/Rz/uz maxima with
     the governing position ratio) swept over `n_positions + 1` placements.
   - `bindings/rdm-wasm`: `influence_line_json(project, beam_id,
     station_ratio, response_kind)` (unit-load station scan + interpolated
     scrubber ordinate) and `moving_load_train_json(project, beam_id,
     train_json, n_positions)` (preset lm1 / pont_roulant / custom).
   - `MovingLoadPanel.tsx` (`moving-load-panel`): preset selector
     (EN 1991-2 LM1 | Pont roulant (2 galets) | Convoi personnalisé),
     response SegmentedControl (Rz/My/Vy/N/uz), custom axle kN + entraxe
     NumberFields, detented train-position scrubber (`train-scrubber`) with
     play/pause animation (`train-play`) and the moving axle-arrow strip,
     uPlot `influence-line-plot` η(x) with the crimson train cursor and the
     `moving-envelope` governing (Mmax, Mmin, Vmax, Rz max, uz max) readout.
     Mounted in Step 3 (loads.tsx) and the Step 4 advanced rail + mobile
     bottom sheet.

3. **M12.3 — Member Groups, Storey Levels & Inter-Storey Drift**:
   - Store actions `upsertMemberGroup` / `removeMemberGroup` / `setLevels`;
     `MemberGroupsPanel` (`member-groups-panel`): named groups over the
     batch selection with a `member-group-select-all` affordance, group
     rows with re-assign/delete; `StoreyLevelsPanel`
     (`storey-levels-panel`): 1-click node-Z auto-detection
     (`levels-autodetect`) + manual add/delete.
   - `crates/rdm-solver/src/drift.rs`: `interstorey_drift` pairs the nodes
     vertically between consecutive levels, superposes the SLS combination
     and returns `d_r`, `h`, `d_r/h ≤ 1/300 | 1/500` per level.
   - `bindings/rdm-wasm`: `storey_drift_json(project, limit)`.
   - `results.tsx` `storey-drift-panel` with the 1/300 | 1/500
     SegmentedControl and per-level StatusBadges; `report.tsx`
     Déplacement Inter-Étages chapter.
   - `optimize_sections_json` now merges the beams of every named
     `MemberGroup` into ONE `optimize_group` call (worst demand drives a
     single uniform profile) and returns `beam_ids` + `group_name` per row;
     `OptimizerModal` consumes the grouped DTO and applies one profile per
     group.

4. **M12.4 — Inclined Supports, Custom Materials, Pattern Loads, 6.10 switch**:
   - `supports.tsx` Appui incliné (α) card (`support-incline-angle`,
     `support-incline-apply`): α (°) → unit normal (sin α ; 0 ; cos α)
     persisted on `Support.incline` (engine side verified by RDM6-08);
     `SupportMarkers.tsx` tilts the 3D roller marker by α about Y
     (`inclined-roller-marker`).
   - `geometry.tsx` **Matériau personnalisé…** dialog
     (`open-custom-material`): (name, E [GPa], ν, ρ, fy [MPa], G = E/2(1+ν),
     fu = 1.35·fy) persisted into `structure.materials` in strict SI and
     optionally assigned to the selected beam.
   - `loads.tsx` **Travées alternées (EN 1990)** trigger
     (`generate-pattern-loads`): `pattern_loads_envelope_json` detects the
     X-aligned continuous spans split at Uz supports, evaluates the
     `pattern_live_loads` checkerboard sub-cases (scaled Variable loads per
     span) and returns the per-beam governing My/Vz/N envelope rendered in
     `pattern-loads-table`.
   - `SettingsPopover.tsx` `combination-method-toggle` testid on the
     6.10 | 6.10a+b SegmentedControl (settings.combination_method already
     flows into `build_combinations_v2_json` through the WASM engine).

5. **M12.5 — Bidirectional BIM Import + Report Integration**:
   - `bindings/rdm-wasm`: `import_bim(text, format, name)` wrapping
     `rdm_cad::import_ifc4_structural` / `import_saf_json` into a fresh
     canonical project JSON (inverse of `export_bim`).
   - `CadImportDialog.tsx` accepts `.dxf,.step,.stp,.iges,.igs,.ifc,.json`;
     the geometry import route branches by extension (text path for
     .ifc/.json → `import_bim`) so exported `.ifc` / `.saf.json` files
     round-trip cleanly into the 3D Studio.
   - `report.tsx` + `docxExport.ts`: new **Assemblages EC3-1-8**,
     **Enveloppe Convois Mobiles** and **Déplacement Inter-Étages**
     chapters/tables rendered whenever present (session registry
     `sessionChecks.ts` fed by the studio + moving panel; drift fetched
     live) in both the HTML report and the native-Word .docx payload.

6. **M12.6 — Bilingual catalog sync & E2E**:
   - Lingui extract + compile (798 strings; **en.po 0 missing** — every M12
     string translated; fr source 100 %).
   - `apps/web/e2e/m12-connections-moving-groups.spec.ts` (5 tests):
     connection studio SVG + η badge + grade switch, LM1 influence plot +
     envelope + preset switch + Step 4 rail, `Poteaux` group → grouped
     optimizer apply, inclined roller α = 30° (normal readout 0,500/0,866)
     + custom material E = 200 GPa toast, `.ifc` download → CadImportDialog
     round-trip.

## M12 verification gates (run in this session)

- G0: `cargo fmt --all --check` ✓ · `cargo clippy --workspace --all-targets
  --all-features -- -D warnings` ✓ **0 errors** · `oxfmt --check` ✓ ·
  `oxlint --deny-warnings` ✓ 0 warnings.
- G1: `RUSTFLAGS="-D warnings" cargo test --workspace --all-features` ✓ —
  235 tests, 0 failed (incl. the 9 new connections_ec3_8 hand-calc tests).
- G2: `wasm-pack build bindings/rdm-wasm --target web --out-dir
  ../../apps/web/src/wasm-pkg` ✓ (2 m 21 s, wasm-opt).
- G2.5: `tsr generate` ✓ · G3: `tsc --noEmit` ✓ 0 errors.
- G4: `i18n:extract` ✓ (798 strings) + `i18n:compile` ✓ — en.po 0 missing.
- G5: `test:unit` ✓ 99/99 (incl. the en.po completeness contract).
- Builds: `pnpm --filter @rdm-studio/ui build` ✓ · `pnpm --filter web
  build` ✓ (154 precache entries) · `pnpm --filter site typecheck && build`
  — see the session log for the final state.
- G6: `playwright test --project=chromium --project=firefox
  --reporter=list` on the M12 suite — run 1: 4 passed / 6 failed; after
  three fixes (group-name extraction in `optimize_sections_json`,
  filechooser event ordering, collapsed RDM 7 library expansion) run 2:
  **6 passed / 3 failed** (M12.3 grouped-optimizer row naming + M12.5
  `.ifc` round-trip toast, each on chromium AND firefox). The M12.1
  connection studio, M12.2 LM1 influence plot + envelope, M12.4 inclined
  roller α = 30° + custom material tests pass on BOTH browsers. The two
  remaining flows are diagnosed and queued for Session 2.

## Next milestone

M12 Session 2 of 2: (1) the grouped optimizer row still renders
`B1, B2` instead of the group label — trace the `group_name` field
through the serde-wasm-bindgen payload; (2) the exported `.ifc`
re-import shows the error branch instead of the success toast — verify
`import_ifc4_structural` against the exporter's IFC4 text. Then the full
sweep to green and final archive.

---

Session 23 (2026-11-28): **Milestone M11 — Session 3 of 3 (Composite
Cross-Section Engine, Visual _Sections Droites_ Studio, Client-Side Branded
Calculation Note & Full E2E Sweep)** on top of origin/main 94414e0 (M10
landed), tree left dirty (zero commits, see ship.toml + .github/pr-body.md).

## M11 shipped (implemented + tested)

1. **M11.1 — Multi-element composite cross-section engine**:
   - `crates/rdm-model/src/composite.rs` (new): `CompositeSectionDef` /
     `CompositeElement` / `CompositeElementKind` (plate b×t, EN 10365/10210/
     10056 `profile`, `chs`, `rhs`) / `SteelGrade` (S235..S460) persisted on
     `Structure.custom_sections` (schema v2, `#[serde(default)]`).
   - `crates/rdm-cad/src/sections.rs` (new, ~1200 lines): exact analytical
     mechanics — signed-primitive integration (rect / annulus / exact
     web-flange fillet patches with closed-form integrals), Huygens-Steiner
     aggregation, principal axes (Iu/Iv/alpha, Mohr-verified), radii of
     gyration, extreme fibres, 4 elastic moduli, **exact Wpl,y / Wpl,z by
     90-iteration equal-area PNA bisection** over signed convex polygons
     (rect exact, arcs at 192 samples, quarter-disc voids wound CW),
     §6.2.6 shear areas (per-family EN rules + web/flange sets), thin-wall
     It superposition, warping Iw with flange Steiner term, automatic
     EN 1993-1-1 Table 5.2 classification (internal 33/38/42ε, 72/83/124ε,
     outstand 9/10/14ε, CHS 50/70/90ε² + 42ε² compression) per steel grade,
     vector outlines for drawing, and the projected `SectionProperties`
     (shape inference + governing tw/tf dims) the solver consumes.
   - `crates/rdm-cad/tests/composite_sections.rs` (new, 11 tests): single
     rectangle (bh³/12, Wpl/Wel = 1.5), 3-plate IPE 300 + filleted profile
     vs EN 10365 (A +0.004 %, Iy +0.001 %, Iz −0.004 %, Wpl −0.007 %,
     Wel −0.005 %, It exact, Iw +0.03 %), asymmetric T centroid zG =
     71.3158 mm and exact bisection Wpl, rotated equal-leg angle (alpha =
     π/4 exact, 30° rotation covariance, Iu/Iv invariants), classification
     across S235/S355/S460 (web 100 → bending 3 / compression 4 / S460 → 4),
     §6.2.6 shear areas (box, CHS 2A/π), parallel-axis theorem, 2×UPN
     dos-à-dos symmetry, crane girder HEA+UPN centroid, typed errors,
     solver-contract projection.
   - `bindings/rdm-wasm/src/lib.rs`: new `compute_composite_section(def_json)`
     export; `resolve_properties` resolves `Structure::custom_sections`
     natively into the section table (beams solve + EC3-verify like any
     catalog row); `validate_model_issues` resolves first (no
     `unknown_section` false positives). Native test
     `composite_section_beam_solves_natively` ✓.

2. **M11.2 — Visual _Sections Droites_ Studio**: `apps/web/src/components/
   CompositeSectionStudio.tsx` (new) — two-column Swiss Metrology daylight
   dialog: LEFT interactive metrological SVG canvas
   (`composite-section-svg`: dimensioned 50 mm grid, exact engine vector
   outlines with fillets, centroid reticle G(yG,zG), centroidal y/z axes,
   principal u/v axes, dashed amber ANP at the equal-area axis, live
   σ(z) = N/A + My/Iy·z side diagram with neutral-fibre line, driven by
   NumberField N (kN) / My (kN·m) + a detented SliderDetents). RIGHT:
   5 one-click presets (`composite-preset-prs-symetrique`,
   `-caisson-soude`, `-2upn-dos-a-dos`, `-ipe-platine-semelle`,
   `-hea-upn-roulement`), sub-element cards with NumberField steppers
   (Δy/Δz mm, θ°, plate/CHS/RHS dims, profile designation Combobox, mirror
   flags), steel-grade `<SegmentedControl>` (S235|S275|S355|S460), tabular
   telemetry readout (`composite-telemetry`, French comma decimals, A, m,
   yG/zG, Iy/Iz/Iyz, α, Iu/Iv, Wel, Wpl, iy/iz, It, Iw, Av), `<StatusBadge>`
   bending/compression classes, `<CopyButton>` TSV/JSON exports and
   **Appliquer à la barre sélectionnée** (`apply-composite-section`).
   Entry trigger `open-composite-section-studio` in Step 1 inspector +
   ⌘K palette row (`rdm-open-composite-studio`). Store: `custom_sections`
   on `ProjectData.structure` + `upsertCompositeSection(def, beamIds)` /
   `removeCompositeSection(name)`; worker lane `compute_composite_section`
   wired through `fea.worker.ts` + `workerClient.computeCompositeSection`.

3. **M11.3 — Client-side branded calculation note**: `report.tsx` cover
   header (`report-cover`) with official `<BrandMark />`
   (/logo-rdm-studio.png), engineer/checker title block (license store),
   date, EN 1990–EN 1999 scope, `report-solver-badge` (3D Timoshenko WASM)
   and the certified `report-benchmark-seal` (49 / 49 · 0 octet cloud);
   dedicated **Sections Droites Composées** chapter
   (`report-composite-chapter`) whenever custom sections exist — vector SVG
   diagram + full property table + Table 5.2 class badges, fed by the same
   exact engine; `export/docxExport.ts` upgraded with **native Word
   tables** (`w:tbl`, bordered, bold headers), cover scope line and
   docProps/core.xml metadata (title/creator/dates); the .docx payload now
   embeds members, per-composite property tables, ULS/SLS envelope
   summaries and the member-by-member EC3 breakdown. Exports renamed to
   the locked contracts: `export-docx-btn` (structured .docx) and
   `export-html-btn` (standalone offline 3D HTML).

4. **M11.4 — i18n & E2E contracts**: Lingui catalogs extracted + compiled
   (712 strings, **en.po 0 missing**, fr source 100 %); new
   `apps/web/e2e/m10-rdm7-solver-envelopes.spec.ts` (elastic springs,
   imposed settlements with Δ badge, tension-only toggle via the
   role=radio contract, 49/49 certificate + RDM6/RDM7 filter pill,
   ENV:ULS Min/Max envelope callouts, load-case manager + 6.10
   generation, Timoshenko/Bernoulli toggle) and
   `apps/web/e2e/m11-composite-section-report.spec.ts` (studio open,
   exact PRS/2UPN/IPE+platine telemetry, apply + native re-solve, report
   chapter + branded cover, .docx PK-magic + embedded metadata, offline
   .html with embedded composite geometry, ⌘K palette entry). Legacy
   `export-html3d`/`export-docx` testids migrated in exports.spec.ts /
   real-world-scenarios.spec.ts.

## M11 verification gates (run in this session)

- G0: `cargo fmt --all --check` ✓ · `cargo clippy --workspace
  --all-targets --all-features -- -D warnings` ✓ **0 errors** (incl. the
  M10-era validation.rs / rdm6_benchmarks.rs literal+binding fixes this
  session had left pending).
- G1: `cargo test --workspace --all-features` ✓ — 190 tests, 0 failed
  (25 rdm-cad unit + 11 composite integration + 17 rdm-wasm incl. the
  native composite solve).
- G2: `wasm-pack build bindings/rdm-wasm --target web --out-dir
  ../../apps/web/src/wasm-pkg` ✓.
- G2.5: `pnpm --filter web exec tsr generate` ✓.
- G3/G4: `i18n:extract` ✓ (712 strings, en 0 missing) + `i18n:compile` ✓.
- G5: `tsc --noEmit` ✓ 0 errors · `oxfmt --check` ✓ · `oxlint
  --deny-warnings` ✓ · `test:unit` ✓ 99/99 (incl. the design-system
  hygiene fix in AdvancedPanels).
- Builds: `pnpm --filter @rdm-studio/ui build` ✓ · `pnpm --filter web
  build` ✓ (152 precache entries) · `pnpm --filter site typecheck &&
  pnpm --filter site build` — NOT re-run at cutoff.
- G6: full Playwright sweep (chromium + firefox) — NOT verified green at
  cutoff: the two new M10/M11 specs are authored and the browsers are
  installed, but the first chromium pass on m11 failed locating
  `open-composite-section-studio` in the preview build (root cause not
  diagnosed before the session cutoff); the follow-up session must run
  `pnpm --filter web exec playwright test --project=chromium
  --project=firefox --reporter=list` and fix the remaining failures.

## Next milestone

M11 wrap-up session: diagnose the preview-build trigger miss (route search
schema / inspector render), drive the full chromium+firefox sweep to
green, then run `pnpm --filter site typecheck && pnpm --filter site build`.


---

# STATUS.md — RDM Studio milestone ledger

