Task: github.com/elcoosp/rdm-studio. Ship v1.4.0 — upgrade the UI foundation to Base UI (`@base-ui/react`) + a complete 24-component `shadcn/ui` workstation suite (`Combobox`, `NumberField`, `ResizablePanel`, non-modal `Vaul` Drawer, `TanStack Table`, `Accordion`, `Alert`, `Popover`, `DropdownMenu`, `ToggleGroup`, `Progress`, `Kbd`), close the 7 code-audit regressions, AND surface every remaining feature across all 16 `./mockups/` screens following `AGENTS.md`, `ARCHITECTURE.md`, and `DESIGN.md` (§1–§8).

EXECUTION CONTRACT (NON-NEGOTIABLE):

- Preserve ALL v1.1.0, v1.2.0, and v1.3.0 features already on `main` (32 `EngineeringIcons`, extruded profiles, `@number-flow/react`, `CameraControls`, 3D cutting plane, `modal.rs`, `section_cut.rs`, `rdm-cad` DXF/STEP/IGES, `AccelerationField`, 15 RDM 7 presets, `impeccable` polish).
- Keep strict SI units (`m`, `N`, `Pa`, `rad`, `kg/m³`) and zero `.unwrap()` / `.expect()` / `panic!()` in `crates/` and `bindings/rdm-wasm`.
- Write complete, clean files (never blind regex/tab patches) to avoid `oxfmt` whitespace no-ops.

1. **Bootstrap, Install Base UI + Shadcn Ecosystem Libs & Sync (< 3 tool calls):**
   - If `rdm-studio` is not cloned locally, `git clone https://github.com/elcoosp/rdm-studio.git && cd rdm-studio`; otherwise `cd rdm-studio && git fetch origin && git reset --hard origin/main`.
   - Ensure `rustc`/`cargo` (`wasm32-unknown-unknown`, `rustfmt`, `clippy`), `wasm-pack`, `pnpm`, and `ship` (`cargo install --git https://github.com/elcoosp/ship`) are installed.
   - Install Base UI & shadcn workstation libraries (and remove unused `@radix-ui/*` packages once migrated):
     `pnpm --filter web add @base-ui/react react-resizable-panels vaul @tanstack/react-table`
   - Read `STATUS.md`, `DESIGN.md` (§1–§8), and `.agents/skills/impeccable/SKILL.md`.

2. **Build the Complete 24-Component Base UI `shadcn/ui` Design System (`apps/web/src/components/ui/`):**
   - Migrate `apps/web/src/components/ui/` from `@radix-ui/*` to **`@base-ui/react`** + **`react-resizable-panels`** + **`vaul`** + **`@tanstack/react-table`**, styled strictly with `DESIGN.md` Daylight Swiss Metrology tokens (`#F8FAFC` canvas, `#FFFFFF` panels, `1px #E2E8F0` hairlines, `#1D4ED8` Cobalt primary accent, `4px` control radius, zero drop shadows on docked panels):
     - **Core & Forms:** `button.tsx`, `input.tsx`, `textarea.tsx`, `label.tsx`, `checkbox.tsx`, `switch.tsx`, `slider.tsx`, `number-field.tsx` (Base UI `NumberField` with steppers for `X/Y/Z`, `θx`, `ky/kz`, loads), `toggle-group.tsx` (for `3D Iso | XY | XZ | YZ` and `Sélection | + Nœud | Relier`).
     - **Pickers & Overlays:** `select.tsx`, `combobox.tsx` (Base UI `Combobox` searchable picker for the 140+ EN 10365/10210/10056 profiles with live SVG cross-section icons), `dialog.tsx`, `drawer.tsx` (`vaul`), `dropdown-menu.tsx` (project switcher), `popover.tsx`, `tooltip.tsx`.
     - **Layout & Data:** `resizable.tsx` (`react-resizable-panels` for draggable left inspector & bottom `240px` results dock), `tabs.tsx`, `accordion.tsx`, `collapsible.tsx`, `card.tsx`, `badge.tsx`, `alert.tsx`, `progress.tsx` (for EC3 utilization bars), `separator.tsx`, `scroll-area.tsx`, `kbd.tsx`, and `data-table.tsx` (`@tanstack/react-table` wrapper with `tabular-nums` & `Shift+Click` row selection).
   - **Non-Blocking Mobile `Vaul` CAD Drawer (`drawer.tsx` & `BottomSheet.tsx`):**
     Configure `<Drawer.Root modal={false} snapPoints={[0.35, 0.78]} fadeFromIndex={1}>`, `<Drawer.Overlay className="pointer-events-none bg-ink-primary/15" />`, and `<Drawer.Content className="fixed inset-x-0 bottom-14 z-40 ...">` so mobile users get native Vaul spring physics, snap points, and drag handle while still being able to orbit/zoom the 3D viewport and tap the `h-14` bottom navigation bar. Wrap desktop Steps 1–4 in `<ResizablePanelGroup>` so users can drag-resize the left inspector and bottom results dock.

3. **Expose Full EC3 Coefficients & Canonical SHA-256 Fingerprint in WASM (`bindings/rdm-wasm/src/lib.rs`, `workerClient.ts`):**
   - Extend `BeamCombinationResult` with:
     - `checks: Vec<(String, f64)>` (all individual `member_check` ratios: `NEd/Npl,Rd`, `Nb,Rd,y`, `Nb,Rd,z`, `Mb,Rd`, `Vpl,Rd`, `Von Mises`),
     - `class_index: Option<u8>`, `chi_y: Option<f64>`, `chi_z: Option<f64>`, `chi_lt: Option<f64>`,
     - `m_rd: f64` (governing bending moment resistance in `N·m` for the `uPlot` capacity line).
   - Add `project_fingerprint(project_json: &str) -> Result<JsValue, JsValue>` calling `ProjectFile::fingerprint()` so Step 5's A4 sheet and Takumi PDF render the true deterministic SHA-256 hash of the `.rdm` model.

4. **Close All 7 Code-Audit Regressions (`apps/web/`):**
   1. **Fix `ForceVectors3D.tsx` Rules-of-Hooks Violation:** Ensure no `useMemo` is called after conditional early `return` statements in `SpanLoadArrows` (extract `<DistributedLoadArrows />` as a dedicated child component).
   2. **Fix `uPlot` Synchronized Cursor Alignment (`results.tsx`):** Position `[data-testid="uplot-cursor"]` relative to `plot.over` (using `plot.valToPos(station, "x") + plot.bbox.left / devicePixelRatio`) instead of `left: ${station * 100}%` on the outer wrapper, and support clicking/dragging on the chart to scrub `station`.
   3. **Fix `SnapOverlay.tsx` Listener Attachment & Resize Sync:** Trigger `SnapOverlay`'s pointer-listener `useEffect` via a reactive `runtimeVersion` counter instead of `[runtimeRef]`, and re-project using current `dom.getBoundingClientRect()` dimensions.
   4. **Fix `BeamMeshes.tsx` Selection Outline `sectionDims` Dependency:** Include `sectionDims` in `selectedGeometry`'s `useMemo` dependency array so the `#1D4ED8` selection outline always matches the true extruded profile.
   5. **Fix `ProjectFile` Canonical Serialization & Diacritics (`projectStore.ts`, `LayerToolbar.tsx`):** Remove undeclared `updatedAt` property injections from `projectStore.ts` and ensure `"Déformée"` carries proper French accents in `LayerToolbar.tsx`.
   6. **Consistent Left-Docked `320px` Inspector on Step 1 (`geometry.tsx`):** Render the inspector first (left) and 3D viewport second (right) in `geometry.tsx` so Steps 1, 2, and 3 share the exact same left-inspector / right-viewport layout (`DESIGN.md` §4).
   7. **Verify Official Brand Logo & PWA PNG Icons (`docs/logo-idea.svg`, `apps/web/public/`):** Ensure `docs/logo-idea.svg` and `apps/web/public/logo-rdm-studio.svg` carry `xmlns="http://www.w3.org/2000/svg"` and verify `icon-192.png`, `icon-512.png`, and `icon-maskable-512.png` render crisp PNGs derived from the official vector emblem.

5. **Surface All Remaining Mockup Features Across Steps 1–5 (`./mockups/` Parity):**
   - **Step 1 (`geometry.tsx`, `CommandPalette.tsx`, `ProjectGalleryModal.tsx`, `projectStore.ts`):**
     - Use Base UI **`Combobox`** for searchable profile selection (`IPE 200`, `HEA 180`, `CHS 101.6×5`, etc.) with live SVG cross-section icons, and **`NumberField`** for `X / Y / Z (mm)`, `θx (°)`, and `ky / kz`.
     - Store `selectedBeamIds: number[]` in `projectStore` (with `selectAllBeams`, `invertBeamSelection` `⇧⌘I`, `clearSelection` `Esc`). When `selectedBeamIds.length > 1`, render the **Batch Inspector** (`ΣL` cumulative length, `Σm` cumulative mass, batch section/material, batch `N1/N2` releases, batch `ky/kz`).
     - Make `CommandPalette.tsx` (`⌘K`) context-aware: when beams are selected, surface _Relâcher les moments N1/N2 (`⌥R`)_, _Inverser la sélection (`⇧⌘I`)_, plus global shortcuts `⌘Enter` (_Lancer le calcul 3D & Eurocode 3_) and `⌘P` (_Imprimer / Exporter PDF_).
     - Upgrade `ProjectGalleryModal` with rich metadata cards (node/beam counts, span/height, standard tags) for the 4 parametric templates, a **`+ Nouveau projet vierge`** button (resets to an empty 0-node model), and a **`Importer (.dxf, .step, .igs, .rdm)`** file picker.
     - On Step 1's Empty State (`nodes === 0`), add the **4 one-click Quick-Start pills** (_Treillis Warren 24 m_, _Portique 18 m_, _Potence HEA 200_, _Poutre 3 travées_) below the 3 primary cards, plus a bottom-left **profile legend** and mouse/keyboard hint bar on the 3D viewport.
   - **Step 2 (`supports.tsx`):** Display the selected node's `(X, Y, Z)` coordinates, free vs locked DOF count, and `"Suivant : Définir les charges →"`.
   - **Step 3 (`loads.tsx`):** Show estimated self-weight mass (`kg` / `t`) beside the `1g -Z` toggle, `"Réinitialiser charges"` button (undoable via `⌘Z`), and a bottom viewport equilibrium status pill (`Système équilibré` / `Appuis incomplets`).
   - **Step 4 (`results.tsx`):**
     - Render the **4-clause Eurocode 3 breakdown card** (`checks` with `<Progress>` bars) and **`Classe · χy · χz · χLT`** badges for the inspected beam, plus a secondary mitigation button **`Maintien latéral mi-travée (kz = 0,5)`** (`updateBeam(id, { k_buckling_z: 0.5 })`) alongside the 1-click profile upgrade.
     - Under the 2D `σvM` cross-section heatmap, display **top fiber, neutral axis, and bottom fiber stress readouts (MPa)**; in `uPlot`, draw dashed crimson **`±M_Rd`** capacity limit lines and show live **`My,Ed · Vz,Ed · N,Ed`** values at the scrubbed cursor position `x`.
   - **Step 5 (`report.tsx` & `pdfTakumiReport.tsx`):**
     - Include **5 complete engineering tables** with TSV copy: (1) _Fréquences propres (`Hz` + Période `T (s)`)_, (2) _Réactions d'appuis ELU (`Rx, Ry, Rz` + ligne `Total Σ`)_, (3) _Vérification Eurocode 3 (`σ_vM (MPa)`, `χy`, `χz`, `χLT`, `Ratio η`, `Statut`)_, (4) _Déplacements extrêmes ELS (`Ux, Uy, Uz, |U|`)_, and (5) _Nœuds & Profils_, plus the **SHA-256 model fingerprint** footer in both the A4 web sheet and Takumi PDF.
   - **Tablet `768–1023px` & Mobile Polish:** Dock the inspector cleanly on tablet viewports without covering the 3D canvas, and add a 1-tap **`Rapport PDF`** button on mobile Step 4.

6. **Add Regression Tests & Verify All Gates (`G0 → G6`, `AGENTS.md` §4):**

- Add Rust & Playwright E2E tests verifying: (a) `BeamCombinationResult` exposes individual EC3 `checks`, `chi_y`/`chi_z`/`chi_lt`, and `project_fingerprint` returns a 64-char hex SHA-256, (b) `Combobox` searches and selects profiles on `/geometry`, (c) `ProjectGalleryModal` `+ Nouveau projet vierge` resets to empty state and empty-state quick pills load a template in 1 click, (d) multi-beam selection surfaces cumulative `ΣL` / `Σm` and context-aware `⌘K` actions, and (e) Step 5 renders the Support Reactions `Σ` table and SHA-256 fingerprint.
- Run all gates to 100% green:`cargo fmt --all --check && cargo clippy --workspace --all-targets --all-features -- -D warnings``RUSTFLAGS="-D warnings" cargo test --workspace --all-features``wasm-pack build bindings/rdm-wasm --target web --out-dir ../../apps/web/src/wasm-pkg``pnpm --filter web exec oxfmt --check && pnpm --filter web exec oxlint --deny-warnings && pnpm --filter web exec tsr generate && pnpm --filter web i18n:extract && pnpm --filter web i18n:compile && pnpm --filter web exec tsc --noEmit && pnpm --filter web test:unit && pnpm --filter web test:e2e`
- Handoff & Archive (Leave Tree Dirty — No Commits):Update `STATUS.md` (`v1.4.0` complete), write `.github/pr-body.md` and `ship.toml` (1 dirty file per `[[commit]]`, ordered by dependency), run `ship validate` until exit `0`, and zip the full clean tree (`rdm-studio-v1.4.0-<SHA>.zip`, excluding only `.git/`, `target/`, `node_modules/`, caches) into the downloads folder with zip contents proof.
