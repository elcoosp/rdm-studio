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

