Task: ://github.com. Maximum-velocity, plan-aligned implementation following `AGENTS.md`, `ARCHITECTURE.md`, `DESIGN.md`, and `./mockups/`.

1. **Bootstrap & Sync (< 3 tool calls):**
   - If `rdm-studio` is not cloned locally, `git clone https://://github.com.git && cd rdm-studio`; if it already exists, `cd rdm-studio && git fetch origin && git reset --hard origin/main` so `HEAD` matches your latest pushed `main`.
   - Ensure `rustc`/`cargo` (`wasm32-unknown-unknown`, `rustfmt`, `clippy`), `wasm-pack`, `pnpm`, and `ship` (`cargo install --git https://github.com`) are installed, then read `STATUS.md` and `git log -5 --oneline` to confirm `HEAD` (`4189cbb`) and prepare **Milestone M9 (Session 1 of 4 — RDM7 CAD Power Tools, Parametric Structure Library & Synchronized Metrology Spreadsheet)**.

2. **Ship Complete Milestone M9 (CAD Power Tools, Parametric Frame Generators & Astonishing Step 1 UI):**
   Implement all 4 deliverables below direct-to-green with full unit + E2E tests (zero stubs, zero `.unwrap()`/`.expect()` in Rust, zero raw HTML primitives `<select>`, `<details>`, `<input type="checkbox">`, `<input type="range">` in `apps/web/src/`, zero ALL-CAPS text, strict SI units in state/WASM):
   - **M9.1 — 1-Click Topological Cleanup ("Compacter / Nettoyer le modèle", RDM6/7 _Ossatures_ §3.7) & Auto-Split Intersections:**
     - Create `apps/web/src/modeling/modelCleanup.ts` with deterministic pure functions + unit tests (`modelCleanup.test.ts`):
       1. `mergeDuplicateNodes(project, tolM = 1e-4)`: welds coincident nodes within tolerance, remaps `beam.start_node` / `beam.end_node`, `supports`, `nodal_loads`, and removes zero-length beams (`start_node === end_node`).
       2. `splitIntersectingBeams(project, tolM = 1e-4)`: detects both T-junctions (an existing node lying strictly inside a beam segment $t \in (0, 1)$) and X-crossings (two non-coincident 3D beam segments intersecting within `tolM`), splits the host beam(s) at the intersection point(s), preserves `section_id`, `material_id`, `roll_angle_rad`, and end releases (outer ends keep original releases; new interior junctions are rigid by default), and proportionally remaps distributed/point beam loads onto the child segments.
       3. `purgeOrphanNodes(project)`: removes nodes not referenced by any beam, support, or nodal load.
       4. `compactModel(project, tolM = 1e-4)`: runs `mergeDuplicateNodes` → `splitIntersectingBeams` → `deduplicateBeams` → `purgeOrphanNodes` in one atomic operation, returning `{ project, stats: { mergedNodes, splitBeams, removedDuplicates, removedOrphans } }`.
     - Wire an **Auto-Split on Draw** toggle (`autoSplitOnDraw: boolean`, default `true`) into `cadTools.ts` / `viewportStore.ts` so drawing a new beam onto an existing beam's midpoint/interior automatically splits the host beam and connects cleanly.
     - Expose a **Compacter** (`data-testid="compact-model"`) button with `<Tooltip>` in `CadToolbar.tsx` and Step 1 (`geometry.tsx`) showing a Sonner summary toast (e.g., `Modèle compacté : 2 poutres découpées, 1 nœud fusionné`).

   - **M9.2 — Beam Subdivision into $N$ Equal Segments ("Discrétiser une poutre", RDM6/7 _Ossatures_ §3.8.13):**
     - Add `subdivideBeam(project, beamId, segments: number)` ($2 \le N \le 50$) in `apps/web/src/modeling/modelCleanup.ts`: creates $N-1$ equidistant interior nodes along the beam, replaces the beam with $N$ contiguous sub-beams inheriting section, material, roll angle, and outer end releases, and remaps beam loads onto the affected sub-segments.
     - Add a **Discrétiser ($N$ tronçons)** popover/control (`data-testid="subdivide-beam"`) in the Step 1 beam inspector (`geometry.tsx`) with quick segment presets (`2`, `4`, `8`, `10`) and a `NumberField`.

   - **M9.3 — RDM6/7 Parametric Structure Generators (_Bibliothèque d'ossatures paramétrées_, _Ossatures_ §3.10):**
     - Create `apps/web/src/modeling/parametricGenerators.ts` + `ParametricFrameModal.tsx` (`data-testid="parametric-generator-modal"`) accessible from Step 1 (`geometry.tsx`, button `data-testid="open-parametric-generator"`):
       1. **Portique à traverse brisée / monopente / multipans (2D/3D Portal Frame):** span $L$, eave height $H_1$, ridge height $H_2$, number of bays $N_{\text{bays}}$, 3D depth & spacing $L_y$ (when $N_{\text{frames}} > 1$), column section (`HEA`), rafter section (`IPE`), base support preset (`Encastrement` / `Rotule`).
       2. **Treillis plan Pratt / Howe / Warren (RDM6 #50–#58):** span $L$, height at ends $H_0$, ridge height $H_c$, panel count $N$, chord section & web diagonal section, auto-pinned diagonals option.
       3. **Ferme à entrait retroussé / Polonceau (RDM6 #200–#206):** span $L$, column height $H_1$, truss rise $H_2$, panel subdivisions $N$.
       4. **Pylône treillis 3D / Tour tronconique (RDM6 #100–#105):** height $H$, base width $(L_{x,\text{inf}}, L_{y,\text{inf}})$, top width $(L_{x,\text{sup}}, L_{y,\text{sup}})$, tier count $N$, X or K bracing.
     - Include a live **2D/3D SVG wireframe preview** inside `ParametricFrameModal.tsx` that updates instantaneously as parameters change, plus an option to **Replace project** or **Insert at origin $(x_0, y_0, z_0)$**.

   - **M9.4 — Astonishing Swiss-Metrology Step 1 UI (CAD Ghost Preview + Synchronized Nodes & Beams Spreadsheet Drawer):**
     - **3D CAD Ghost Preview (`apps/web/src/viewport3d/`):** While drawing a beam (`draw_beam` tool) after clicking the start node, render a dashed Deep Cobalt (`#1D4ED8`) preview segment to the snapped cursor point, perpendicular/axis alignment guide lines (`X`, `Y`, `Z` snap indicators), and a floating monospace HUD pill showing live length $\Delta L$ (`m`) and angle $\alpha$ (`°`).
     - **Synchronized Nodes & Beams Data Table (`apps/web/src/components/ModelDataTable.tsx`):** Add a collapsible bottom metrology drawer (`data-testid="model-data-table"`) in Step 1 with two tabs (`Nœuds` and `Poutres`) built with `@tanstack/react-table` and `@rdm-studio/ui` primitives:
       - **Nœuds tab:** ID (`N1`…), editable `X (m)`, `Y (m)`, `Z (m)` inline `NumberField`s, support badge, and delete row button.
       - **Poutres tab:** ID (`B1`…), `Nœud i`, `Nœud j`, `Section` (`Select`/`Combobox`), `Matériau`, `Roulis (°)`, calculated length `L (m)` in `JetBrains Mono tabular-nums`, and delete row button.
       - **Bidirectional 3D Sync:** Clicking or hovering a row highlights and focuses the corresponding node/beam in the 3D viewport; selecting a node/beam in 3D scrolls to and highlights its row in the table.
       - **Spreadsheet Paste:** Support pasting tab/CSV coordinate rows (`x y z`) directly to batch-create nodes.
     - Extract and compile Lingui i18n catalogs (`pnpm --filter web i18n:extract && pnpm --filter web i18n:compile`).

3. **Verify Gates:**
   - Run all applicable Gates `G0 → G6` (`AGENTS.md` §4):
     - `pnpm --filter @rdm-studio/ui build`
     - `pnpm --filter web exec tsr generate`
     - `pnpm --filter web exec oxfmt --write src && pnpm --filter web exec oxfmt --check`
     - `pnpm --filter web exec oxlint --deny-warnings`
     - `pnpm --filter web exec tsc --noEmit`
     - `pnpm --filter web test:unit`
     - `pnpm --filter web build`
     - `pnpm --filter web test:e2e` (verify all existing E2E suites remain green + add `apps/web/e2e/m9-cad-powertools.spec.ts` testing compact model, beam subdivision, parametric truss/portal generation, and synchronized Nodes/Beams table).
   - Fix every single error or warning until 100% green.

4. **Handoff & Archive (Leave Tree Dirty — No Commits):**
   - Leave the working tree dirty with zero commits created during this session (`git status` shows all new/modified files).
   - Update `STATUS.md` with Milestone M9 completion status and verification gate results.
   - Write `.github/pr-body.md` summarizing Milestone M9 features, geometry invariants, and test results.
   - Write `ship.toml` at the repo root with **strictly 1 dirty file per `[[commit]]`**, ordered by dependency (`packages/ui` → `modeling/` → `viewport3d/` → `components/` → `routes/` → `i18n/` → `e2e/` → `STATUS.md` → `.github/pr-body.md`).
   - Run `ship validate` until exit `0`.
   - Zip the full clean tree (`rdm-studio-m9-cad-powertools.zip`, excluding only `.git/`, `target/`, `node_modules/`, caches) into the downloads folder with zip contents proof.
