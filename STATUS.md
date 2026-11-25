# STATUS.md — RDM Studio milestone ledger

Session 10 (2026-11-25): **v1.6.0 — complete full-stack, security-hardened,
60-FPS persistent 3D stage, pure-Rust parametric CAD & visual metrology
parity** on top of origin/main `7d6bec5` (v1.5.0). Tree left dirty by
design; per-file history lands via `ship.toml`.

## Requirement map (v1.6.0)

1. **Single persistent 3D WebGL stage** — `PersistentStage.tsx` (new) is
   mounted ONCE in `__root.tsx`; the `<Canvas>` never remounts across
   `/geometry`, `/supports`, `/loads`, `/results` (orbit/zoom/pan survive
   every step switch, verified in e2e). Routes register a *slot* pane and
   a 3D layer stack through `state/stageStore.ts` (new); the stage is
   glued over the slot every animation frame via direct style writes
   (zero React churn at 60 FPS) and stays alive — hidden — on `/report`
   so `captureViewportPng()` embeds a live snapshot into the A4 sheet and
   the Takumi PDF. ONE BVH-indexed `BufferGeometry` is built per render
   state in the stage and shared by `BeamMeshes` (new `geometry` prop)
   AND the picking layer (no duplicate build).
2. **Pure-Rust parametric generator** — `crates/rdm-cad/src/parametric.rs`
   (new): `ParametricTemplate` (`WarrenTruss`, `PortalFrame`, `Cantilever`,
   `ContinuousBeam`) with SI params (`span_m`, `height_m`, `bays`,
   primary/secondary sections, material), rigid-body-safe default
   supports and dense 1-based ids; exposed as
   `generate_parametric_structure(params_json, project_name)` in
   `bindings/rdm-wasm` returning a complete `.rdm` project JSON. The Step
   1 gallery hosts the configurator (Portée L, Hauteur H, Travées,
   Profilés). `subdivideBeam(beamId, segments)` in `projectStore.ts`
   splits a member into N collinear segments (section/material/roll/
   k_buckling preserved, span loads re-targeted exactly, interior joints
   rigid) — undoable via zundo.
3. **Interactive 3D metrology annotations** — `ViewportLabels.tsx` (new)
   renders `N1..Nn` node badges, `P1 · IPE 200` member tags, live ULS
   reaction callouts `Rz = +12,4 kN` (exact multipliers superposition) on
   Steps 2–4 and peak SLS deflection `δ = −3,2 mm` callouts on Step 4;
   `DimensionLines.tsx` (new) draws RDM-style metric dimension lines
   (`4,00 m`). Both are toggled from `LayerToolbar` (`Repères N/P`,
   `Cotes`, `Réactions`).
4. **All 8 security & performance audit findings closed**:
   - stored XSS in `standaloneHtml3d.ts` — HTML-escaped `<title>`/`<h1>`
     + `\u003c`/`\u003e` sanitization of the embedded JSON (vitest-tested);
   - Valibot `ProjectFileSchema` enforcement on every `.rdm` import in
     `useFileOpening.ts` (vitest + e2e-tested: hostile payloads rejected
     with a toast, model untouched);
   - `X-Content-Type-Options: nosniff` + `Referrer-Policy:
     strict-origin-when-cross-origin` in `vercel.json`;
   - 25 MiB CAD guard in `import_cad_structure` (native test);
   - 40-IPC waterfall eliminated: `SectionShapeDto.a` now carries the
     exact catalog area so `computeModelMassKg` uses zero extra
     `catalogSectionProperties` roundtrips;
   - `thread_local!` `RefCell` solve cache in `rdm-wasm` —
     `section_stress_grid` / `beam_span_forces` reuse the already-
     factorized Cholesky while scrubbing `x ∈ [0, L]` (Rc-identity-tested);
   - GPU hygiene: `CuttingPlane` memoizes + `.dispose()`s its plane/edges
     geometries, `NodeMarkers` / `SupportMarkers` share module-level
     geometries + materials, `BeamMeshes` disposes internal rims.

## Extra engineering (v1.6.0 requirement 5 — Rust engine parity in UI)

- `BeamCombinationResult` extended with `n_pl_rd`, `v_pl_rd`, `m_cr`,
  `lambda_lt`, `length`; `CombinationReport.multipliers` exposes the
  exact EN 1990 weights (`G, Q, W, S`) so Step 5's ELU reactions table
  superposes across ALL cases (no more hardcoded 1.35/1.50).
- `SpanForcesDto.t` — the 5th internal-force curve; the Step 4 dock plots
  `My / Mz / Vz / N / T` with `±M_Rd` capacity lines and a ResizeObserver.
- `validate_model_issues(project_json)` returns structured
  `{ code, subject, message }[]` diagnostics (machine slugs mirror
  `rdm_model::ModelIssueCode::slug()`).
- Step 2 Appuis élastiques (`kx..krz`) wired to `Support.spring_stiffness`
  via `setSupportSprings`; per-support locked-DOF badges + `×` removal.
- Step 3 `S` (Neige EN 1990) case tab + collapsible Moments concentrés
  (`Mx, My, Mz` en `kN·m`) on nodal & span loads.
- Step 4: `L/200 | L/250 | L/300` SLS selector, combination selector
  across every computed EN 1990 ULS/SLS permutation + `Modes propres
  1..6`, right 340px EC3 diagnostic rail (`Classe · χy · χz · χLT`,
  `Npl,Rd · Vpl,Rd · Mcr · λLT`, both mitigation buttons).

## The 6 video/audit UI bugs — all closed

1. Header horizontal scrollbar — `overflow-x-auto` removed from
   `<nav id="rdm-steps">`; compact labels (`1`..`5` + icon below `xl`,
   `Étape 1`..`5` at `xl+`); `Enregistré en local` only at `xl:inline`;
   `FR | EN` 100% visible at 860×900 with `scrollWidth ≤ clientWidth`
   (e2e-asserted).
2. Mobile `Vaul` drawer — `activeSnapPoint` starts at `0.42`
   (`snapPoints={[0.42, 0.78]}`), compact top-right `×` icon button
   beside the title replaces the bulky bottom `Fermer`, and the content
   pane scrolls INSIDE the snapped slice (zero white void).
3. Viewport HUDs — compact `Iso | XY | XZ | YZ` presets and icon-led
   `Volumique / Filaire` toggles with `≥ 24 px` separation at 860 px
   (e2e-asserted); LayerToolbar gains the metrology toggles and the
   `Grille : 10 | 50 | 100 mm` `snapStep` selector.
4. All 32 `EngineeringIcons` wired — family-accurate
   `ProfileIpe/Hea/Upn/Chs/Rhs/Angle` in the Step 1 Combobox +
   `SectionDiagram`, `VolumetricMesh`/`WireframeMesh` in LayerToolbar,
   `MagneticSnap` on the snap selector, `ReleaseHinge` on the treillis
   toggle, `SupportSpring`/`SupportReaction` on Step 2, `SectionCut`/
   `DeflectionLimit`/`ModalVibration` on Step 4 KPIs.
5. `ResizeObserver` on the Step 4 `uPlot` (plot glued to its pane).
6. Step 5 ELU reactions computed from the actual ULS multipliers across
   all cases; `Exporter (.rdm)` in Step 5 + the header project menu.

## Gates (G0 → G6)

- G0: `cargo fmt --check` ✓; clippy `-D warnings` ✓; oxfmt ✓; oxlint
  `--deny-warnings` **0 warnings / 0 errors**.
- G1: `RUSTFLAGS="-D warnings" cargo test --workspace --all-features` ✓
  (126 passed: parametric topology/validation, 25 MiB CAD guard, solve
  cache Rc identity, multipliers, Npl/Rd/length DTOs).
- G2: `wasm-pack build bindings/rdm-wasm --target web --out-dir
  ../../apps/web/src/wasm-pkg` ✓.
- G2.5–G5: `tsr generate` ✓ (routeTree byte-identical); `i18n:extract`
  133/133 FR ✓; `i18n:compile` ✓; `tsc --noEmit` ✓; vitest **40/40** ✓
  (XSS escaping, Valibot import enforcement, subdivide/undo, springs,
  moments, catalog-area mass math, en.po 100% completeness).
- G6: Playwright chromium + firefox `--reporter=list` — see final
  session output (v160.spec.ts adds the persistent-canvas, Valibot
  import, parametric, subdivision, springs, Snow, `.rdm` round-trip and
  1440×900 / 860×900 / 390×844 matrix suites).

## Explicitly NOT done (residual)

- WebKit e2e remains sandbox-blocked (no sudo for GTK4/GStreamer system
  libs); `testIgnore: /.*/` per the AGENTS.md guardrail.
- Firefox headless renders the static WebGL fallback in this sandbox
  (no GPU/Mesa); the 3D HUD/canvas contracts are exercised on chromium
  (per-spec `test.skip(browserName !== "chromium")`).

## Next session

1. WebKit on a provisioned machine.
2. Optional: incremental BVH rebuild (dirty-region) for 10k+ member models.
