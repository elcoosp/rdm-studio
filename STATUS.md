# STATUS.md — RDM Studio milestone ledger

Last session: 2026-11-25. Base commit: see `ship.toml` `base_commit`.
Tree left dirty by design (no commits; per-file history lands via `ship.toml`).

## Milestones completed

### M0 — CI green (ARCHITECTURE.md §18, §19.5) — **done**
- Root `Cargo.toml` workspace (§5.1, minus `dxf`/`arbitrary` which join with
  `rdm-cad`/fuzz in Phase 2+; cargo rejects unused workspace deps).
- `package.json` + `pnpm-workspace.yaml` monorepo scripts, `.gitignore`.
- `.github/workflows/ci.yml` = §19.5 verbatim (G0→G6).
- Verified locally: `cargo fmt --all --check` clean, `cargo test --workspace`
  71/71 green, zero warnings.

### M1 — Stable Rust core (§18 Phase 1) — **done**
- `crates/rdm-model`: §19.4 canonical structs (`Node`, `Beam` with
  `roll_angle_rad`/`releases`/`k_buckling`, `Support`), `LoadCase` G/Q/W/S/Acc,
  `ModelValidator` (orphan nodes, duplicate beams, <1e-4 m, pedagogical
  rigid-body diagnostics), `.rdm` project file + SHA-256 fingerprint.
- `crates/rdm-eurocode`: data-driven catalogs embedded via `include_str!` —
  **144 profiles** (IPE 80-600, HEA/HEB 100-600, HEM 100-400, UPN 50-400,
  UPE 80-300, CHS/SHS/RHS, angles) cross-validated between civilaxis,
  eurocodeapplied and the legacy prototype (≤1.2 %, torsion ≤5 %); 7 materials
  per EN 1993-1-1 Table 3.1 / EN 1993-1-4 Table 2.1 / EN 1999-1-1 Table 3.2a.
  EN 1990 combinations (1.35G+1.50Q, psi0 per Annex A1), EN 1993-1-1:
  classification Table 5.2, buckling curves Table 6.2/6.1, chi §6.3.1.2,
  LTB §6.3.2.2 with published Iw, shear areas §6.2.6, Von Mises §6.2.1/6.2.7,
  deflection limits L/200-300.
- `crates/rdm-solver`: 12×12 Euler-Bernoulli element + roll angle,
  end-release condensation (truss members verified), consistent load vectors
  (point on span, trapezoid, automatic self-weight rho·A·g), sparse CSC
  assembly + faer `SymbolicLlt`/`Llt` single factorization with per-case
  back-substitution, mechanism detection (`UnstableMechanism`), reactions,
  local end forces, exact interior deflections (Hermite + clamped
  particular, analytic integration), linear superposition for ULS/SLS.
- Tests: 71 green = unit tests (model/eurocode/solver/wasm) +
  `tests/analytical_benchmarks.rs` at 1e-12 (SS point/UDL, cantilevers,
  axial, Euler + chi, clamped UDL reactions) + wasm report tests.

### M2 — Operational WASM (§18 Phase 2 b1) — **done (core + binding)**
- `bindings/rdm-wasm`: `solve()` (validate → catalogs → solve → ULS/SLS
  combinations → per-beam EN 1993 checks), `catalog_sections()`,
  `catalog_materials()`, `SolveFault` typed errors, zero-copy
  `Float64Array` views in `buffers.rs`.
- Verified: wasm demo model reproduces P L³/48EI + self-weight exactly;
  `wasm-pack build` = Gate G2 (see session report for run status).

## Explicitly NOT done this session (next steps)
- **M3 — Type-safe routing**: `apps/web` is scaffolded (package.json with the
  pinned §2.3 versions) but the Vite app, route tree, worker wiring and UI
  are NOT built. M3 is the exact next milestone.
- fuzz targets (b2), `rdm-cad`, modal analysis (`modal.rs`), `section_cut.rs` —
  their §5 slots are reserved but unimplemented by design (no stubs shipped).
- Proptest invariants + insta snapshots (§14 L2) — planned next session.

## Next session instructions
1. Build `apps/web` (Vite 8 + React 19 + TanStack Router + Lingui fr/en per
   §19.1-§19.3), wire `fea.worker.ts` to `rdm-wasm`, satisfy G2.5-G6.
2. Add `tests/physics_invariants.rs` (equilibrium, Maxwell-Betti, rotation
   invariance) and `tests/report_snapshots.rs` (insta).
3. M4 next after M3: 3D viewport (three-mesh-bvh).
