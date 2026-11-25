Task: github.com/elcoosp/rdm-studio. Maximum-velocity, plan-aligned architectural work. Gates green pre-handoff. Deliver ship.toml.
Goal: ship real, plan-aligned architectural milestones fast — not invented features, not busywork, and no ceremonial red→green TDD stalls.

0 Fast Bootstrap (1 shell block, zero manual registry/crates.io URL curls):

- If not inside `rdm-studio`, `git clone https://github.com/elcoosp/rdm-studio.git && cd rdm-studio`.
- Ensure `rustc`/`cargo` (`wasm32-unknown-unknown`, `rustfmt`, `clippy`), `wasm-pack`, and `pnpm` exist; install only what is missing. Let `cargo` and `pnpm` resolve versions directly from `ARCHITECTURE.md` (fallback to `^` if a container mirror lags).

1 Instant Resume (< 3 tool calls):
Read `STATUS.md`, `ARCHITECTURE.md` (§5, §18, §19), `DESIGN.md`, and inspect `./mockups/` + `git status -s && git log -10 --oneline`.
Output a 5-line status summary identifying the exact next `missing` or `partial` milestone(s) in `ARCHITECTURE.md` §18 (`M0..M8`).

2 Scope & Implementation Rules (`M_k` + `M_{k+1}` if context allows):

- Ship as many consecutive complete milestones as possible while keeping all gates 100% green; never ship a partial milestone or invent features outside `ARCHITECTURE.md` / `DESIGN.md` / `./mockups/`. Never edit `ARCHITECTURE.md` or `DESIGN.md`.
- **Rust (`crates/`, `bindings/`):** All physics, sparse Cholesky (`faer`), modal analysis (`modal.rs`), 2D cross-section stress grid (`section_cut.rs`), DXF import (`rdm-cad`), and Eurocode 0/3 checks live in pure Rust in strict SI units (`m`, `N`, `Pa`, `rad`, `kg/m³`). Zero `.unwrap()`, `todo!()`, or `panic!()`.
- **Web (`apps/web/`):** Display conversions (`mm`, `kN`, `MPa`) live exclusively here. Match `DESIGN.md` & `./mockups/` (`#F8FAFC` canvas, `#FFFFFF` panels, `1px #E2E8F0` hairlines, `#1D4ED8` Cobalt primary accent, 24 custom `1.5px` SVG engineering icons, Tailwind v4, Motion, TanStack Router with `v.parse(SearchParamsSchema, s)`, Lingui SWC `fr`/`en` macros, Valibot, PWA with `maximumFileSizeToCacheInBytes: 15 * 1024 * 1024`, mobile `100dvh` + draggable `BottomSheet`). Build real functional vertical-slice UI on active routes rather than empty placeholder pages; unbuilt later-milestone widgets remain omitted until their milestone.
  PREFIX ∈ feat|fix|docs|refactor|perf|chore|build|test|ci|style|revert (feat only net-new).
  SLUG kebab ≤40 chars. BRANCH = "PREFIX/SLUG".
  PR_TITLE = "prefix: slug description" (≤72 chars, Conventional Commits regex).

3 Direct Implementation → Immediate Green Verification:

- Implement clean, idiomatic code directly alongside comprehensive tests (`cargo test` with `approx` / `proptest` / `insta`; `vitest` + `linkedom` and/or `playwright`) so tests pass green on first run. Fix any compiler, lint, or test failure immediately.

4 No commits; leave tree dirty. Author:
• `STATUS.md` at repo root — concise ledger of completed milestones (`M0..Mx`), verified green gates, and the exact next milestone.
• `.github/pr-body.md` — reviewer-facing description of the CODEBASE work (NO branch/gate/ship.toml process narration):
(a) Plan reconciliation (`ARCHITECTURE.md` §18 verdict + evidence);
(b) Milestones shipped (capability, design decisions/tradeoffs);
(c) Modules/traits/APIs/components touched + new seams;
(d) Test + benchmark evidence;
(e) Docs/data drift fixed (if any);
(f) Remaining gaps/risks and next milestone.
Closing line: `Per-file history lives on <BRANCH>.`
• `ship.toml` at repo root (overwritten fresh for this session, see §6).
Ensure both `ship.toml` and `.github/pr-body.md` are in `.gitignore`.
Record `git rev-parse HEAD` as `base_commit` in `ship.toml`.
**Install & Validate:** Run `command -v ship >/dev/null 2>&1 || cargo install --git https://github.com/elcoosp/ship` then run `ship validate` (MUST be run while tree is dirty). Fix any error and re-run until exit 0.
Zip `rdm-studio-<SLUG>.zip` into the downloads folder = FULL tree: `git ls-files` + explicit untracked enumeration (`ship.toml`, `.github/pr-body.md`, `STATUS.md`, and all new `crates/`/`bindings/`/`apps/`/`.github/`/config files). Do NOT rely on `--others --exclude-standard`.
Exclude ONLY `.git/`, `target/`, `node_modules/`, caches; never `src/`/`crates/`/`tests/`/`docs/`/config/lock/CI; not changed-only.
Prove in report: `Cargo.toml` / `Cargo.lock` / `.gitignore` / CI / source files present in zip; zero `target/` or `.git/` escape.

5 Gates (run all applicable to touched layers — zero warnings/errors):

- **G0 (Polyglot Format & Lint):**
  `cargo fmt --all --check`
  `cargo clippy --workspace --all-targets --all-features -- -D warnings -W pedantic`
  `grep -rnE '#!?\[(allow|expect)\(|cfg_attr\([^)]*_allow\(' crates/ bindings/ 2>/dev/null` (must be empty; lint config only in `[lints.clippy]` with rationale)
  `pnpm --filter web exec oxfmt --check && pnpm --filter web exec oxlint --deny-warnings`
- **G1 (Rust Tests, if Rust touched):** `RUSTFLAGS="-D warnings" cargo test --workspace --all-features`
- **G2 (WASM Build, if Rust touched):** `wasm-pack build bindings/rdm-wasm --target web --out-dir ../../apps/web/src/wasm-pkg`
- **G2.5–G5 (Web Routing, i18n, Types & Unit, if Web touched):** `pnpm --filter web exec tsr generate && pnpm --filter web i18n:extract && pnpm --filter web i18n:compile && pnpm --filter web exec tsc --noEmit && pnpm --filter web test:unit`
- **G6 (Browser E2E, when UI flows/3D/PWA/exports touched):** `pnpm --filter web test:e2e`

6 `ship.toml` (the deliverable):

[delivery]
branch = "feat/my-slug"
pr_title = "feat: my slug"
pr_body = ".github/pr-body.md"
base_commit = "<git rev-parse HEAD hash>"

[[commit]]
message = "feat(scope): description"
files = ["path/to/file"]

[[commit]]
message = "feat(scope): description"
files = ["another/path"]

AI Constraints (enforced by `ship validate`):
• `branch` starts with a valid prefix.
• `pr_body = ".github/pr-body.md"` (gitignored); content describes codebase milestone work, not ship process.
• `base_commit` = valid 40-char Git SHA (`git rev-parse HEAD`).
• `messages` follow Conventional Commits (`subject ≤ 72` chars).
• Exactly one `[[commit]]` block per dirty file, each with **exactly one path** in `files`; one commit per file, no multi-file commits.
• `message` describes that file's specific change; order blocks so dependencies land first (`types/traits → impl → tests → config/STATUS.md`).
• Every dirty file (including `ship.toml`, `.github/pr-body.md`, `STATUS.md`) listed **exactly once** (union check).

7 Report briefly: reconciliation summary, milestones shipped (`done`) + `ARCHITECTURE.md` section + `prefix/slug`, files/tests added, gates output, zip proof, `ship.toml` validity, not-run, contrib (`≈N commits + 1 PR`).
