# STATUS.md — RDM Studio milestone ledger

Sessions: 2026-11-25 (M0–M2 core) and 2026-11-25 (this one: M2 completion +
M3 + full gates). Base commit: see `ship.toml` `base_commit`.
Tree left dirty by design (no commits; per-file history lands via `ship.toml`).

## Milestones completed

### M0 — CI green (§18, §19.5) — **done**
Root `Cargo.toml` workspace, `package.json` + `pnpm-workspace.yaml`
(workspace + overrides), `.gitignore`, `.github/workflows/ci.yml` (§19.5).

### M1 — Stable Rust core (§18 Phase 1) — **done**
- `crates/rdm-model`: §19.4 canonical SI structs, LoadCase G/Q/W/S/Acc,
  ModelValidator (pedagogical rigid-body diagnostics), `.rdm` + SHA-256.
- `crates/rdm-eurocode`: 144 cross-validated profiles + 7 materials
  (EN 1993-1-1 Table 3.1 / EN 1993-1-4 Table 2.1 / EN 1999-1-1 Table 3.2a),
  EN 1990 combinations, EN 1993-1-1 classification/curves/χ/LTB/Von Mises.
- `crates/rdm-solver`: 12×12 EB element + roll angle + release condensation,
  consistent load vectors, faer sparse LLᵀ (one factorization, per-case
  solve), mechanism detection, reactions, end forces, exact interior
  deflections, ULS/SLS superposition.
- **This session**: `tests/physics_invariants.rs` (proptest, 1000 cases:
  equilibrium, Maxwell-Betti, mirror symmetry) and `tests/report_snapshots.rs`
  (insta JSON snapshots of EC3 member checks).

### M2 — Operational WASM (§18 b1) — **done**
- `bindings/rdm-wasm`: `solve()` / catalog facades / zero-copy buffers.
- **This session**: wasm-pack G2 build green. The faer default features
  (`rand` -> getrandom, `rayon` -> spindle/atomic-wait) have no wasm32
  backend; solved with `default-features = false`,
  `features = ["std", "sparse-linalg"]`.
- `.rdm` v1 format decision: `LoadKind` is serde-internally-tagged
  (`{ case, kind, ... }`) and flattened into `Load`, matching the Valibot
  schema in `apps/web/src/schemas/project.schema.ts`.

### M3 — Type-safe routing (§18 c1/c2, gates G2.5–G5) — **done**
- `apps/web`: Vite 8 config per §19.1 (TanStackRouterVite before react(),
  Lingui SWC plugin, tailwindcss, wasm, VitePWA with
  `maximumFileSizeToCacheInBytes: 15 * 1024 * 1024`), tsconfig per §19.3.
- Route tree per §9.2: `__root` (motion stepper + FR/EN switch), `index`
  (redirect), `geometry` (node/beam editor + catalog inspector), `supports`
  (6-DOF matrix), `loads` (EN 1990 cases), `results`
  (`v.parse(SearchParamsSchema, s)`), `report` (summary + lz-string share).
- `routeTree.gen.ts` generated; `<Link>` navigation compile-time checked.
- Lingui fr/en catalogs (39 messages, 100% translated) + compile gates.
- Zustand + Zundo undo + idb-keyval persistence store (c3), FEA worker +
  typed client (c4) calling rdm-wasm — the real solve runs in the worker.
- Tests: vitest 19/19 (units, cn, urlShare, schemas, store, linkedom DOM)
  and Playwright e2e (chromium): full 5-step workflow with a real FE calc.

## Gates verified this session (all green)
- G0: `cargo fmt --all --check` ok, `cargo clippy -D warnings -W pedantic`
  0 errors, lint-attribute grep 0, `oxfmt --check` ok, `oxlint
  --deny-warnings` ok
- G1: `cargo test --workspace` 12/12 suites (85 tests incl. proptest+insta)
- G2: `wasm-pack build bindings/rdm-wasm --target web` ok
- G2.5: route tree generated (routeTree.gen.ts) ok, G3: `tsc --noEmit` ok
- G4: `i18n:extract` + `i18n:compile` ok, G5: `vitest` 19/19 ok
- G6: `playwright test:e2e` 1/1 ok (chromium)

## Explicitly NOT done (next milestones)
- **M4 — Interactive 3D viewport** (three-mesh-bvh, R3F) is the exact next
  milestone; results currently show numeric tables, no 3D canvas yet.
- PWA installability *proof* (Lighthouse >= 95, offline) = M5; the manifest
  and service worker are already produced by the build.
- Fuzz targets (b2), `rdm-cad` DXF import, `modal.rs`, `section_cut.rs`:
  reserved, no stubs shipped.

## Next session
1. M4: R3F viewport + BVH picking on `/geometry`, FEA vertex colors on
   `/results` (FEA spectrum tokens already in `app.css`).
2. M5: offline proof + Lighthouse audit.
3. Modal analysis (`modal.rs`) once the viewport needs mode shapes.
