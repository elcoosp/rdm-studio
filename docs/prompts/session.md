Task: github.com/elcoosp/rdm-studio. Fast, plan-aligned architectural work. Gates green pre-handoff. Deliver ship.toml.
Goal: ship real, plan-aligned architectural milestones fast — not invented features, not busywork, and no ceremonial red→green TDD stalls.

1 Read plan/design docs FIRST (`STATUS.md` if present, `ARCHITECTURE.md` §5/§15/§18/§19, `DESIGN.md`, `./mockups/`), then inspect `Cargo.toml`, `package.json`, `.github/workflows/`, `crates/`, `bindings/`, `apps/web/`, `git status -s`, and `git log -20 --oneline`.
Build a concise reconciliation table: `plan item (ARCHITECTURE.md §18 M0..M8) → claimed status → codebase evidence (paths/symbols) → verdict (done|partial|missing)`.

2 Pick the earliest `missing` or `partial` milestone(s) (`M_k`, and `M_{k+1}` if context allows) STRICTLY from `ARCHITECTURE.md` §18:

- Ship as many consecutive complete milestones as possible in this session while keeping all gates 100% green; never ship a partial milestone or invent features outside `ARCHITECTURE.md` / `DESIGN.md` / `./mockups/`.
- Do not edit `ARCHITECTURE.md` or `DESIGN.md` to match shortcuts.
- All physics, sparse Cholesky (`faer`), modal analysis, and Eurocode 0/3 checks live in pure Rust (`crates/`) in strict SI units (`m`, `N`, `Pa`, `rad`, `kg/m³`). Display conversions (`mm`, `kN`, `MPa`) live exclusively in `apps/web`.
- UI must match `DESIGN.md` and `./mockups/` (`#F9FAFB`/`#FFFFFF`/`#0891B2`, Tailwind v4, Motion, TanStack Router with `v.parse(SearchParamsSchema, s)`, Lingui SWC `fr`/`en` macros, Valibot, PWA with `maximumFileSizeToCacheInBytes: 15 * 1024 * 1024`, mobile `100dvh` + draggable `BottomSheet`).
- Implement each milestone completely end-to-end: types/traits → impl → wiring → unit/property/E2E tests (written directly to pass green on first run, no artificial failing-test loop) + rustdocs; zero stubs/todo!/dead scaffolding.
  PREFIX ∈ feat|fix|docs|refactor|perf|chore|build|test|ci|style|revert (feat only net-new).
  SLUG kebab ≤40 chars. BRANCH = "PREFIX/SLUG".
  PR_TITLE = "prefix: slug description" (≤72 chars, Conventional Commits regex).

3 Direct Implementation → Immediate Green Verification:

- Implement clean, idiomatic code directly alongside comprehensive tests (`cargo test` with `approx` / `proptest` / `insta` for Rust; `vitest` + `linkedom` and/or `playwright` for Web) so tests pass green immediately. Fix any compiler, lint, or test failure at once.

4 No commits; leave tree dirty. Author:
• `STATUS.md` at repo root — concise ledger of completed milestones (`M0..Mx`), verified green gates, and the exact next milestone for the next session.
• `.github/pr-body.md` — reviewer-facing description of the CODEBASE work (NO branch/gate/ship.toml process narration). Required sections:
(a) Plan reconciliation: `ARCHITECTURE.md` section per milestone, verdict, codebase+git-log evidence, and why this milestone is next;
(b) Milestones shipped: capability, why now, design decisions/tradeoffs;
(c) Modules/traits/APIs/components touched + new seams (paths);
(d) Test + benchmark evidence (commands and results);
(e) Docs drift fixed + micro-debt cleaned (if any);
(f) Remaining gaps/risks and next milestone.
Closing line: `Per-file history lives on <BRANCH>.`
• `ship.toml` at repo root (overwritten fresh for this session, see §6).
Ensure both `ship.toml` and `.github/pr-body.md` are in `.gitignore`.
Record `git rev-parse HEAD` as `base_commit` in `ship.toml`.
**Install & Validate:** Run `cargo install --git https://github.com/elcoosp/ship` then run `ship validate` (MUST be run while the tree is dirty). Fix all reported errors and re-run until it exits 0. Do not proceed until validation passes.
Zip `rdm-studio-<SLUG>.zip` into the downloads folder = FULL tree: `git ls-files` + explicit untracked enumeration (`ship.toml`, `.github/pr-body.md`, `STATUS.md`, and all new `crates/`/`bindings/`/`apps/`/`.github/`/config files). Do NOT rely on `--others --exclude-standard`.
Exclude ONLY `.git/`, `target/`, `node_modules/`, caches; never `src/`/`crates/`/`tests/`/`docs/`/config/lock/CI; not changed-only.
Prove in report: `Cargo.toml` / `Cargo.lock` / `.gitignore` / CI / source files present in zip; zero `target/` or `.git/` escape.

5 Gates (run all applicable to touched layers — zero warnings/errors):

- **G0 (Polyglot Format & Lint):**
  `cargo fmt --all --check`
  `cargo clippy --workspace --all-targets --all-features -- -D warnings -W pedantic`
  `grep -rnE '#!?\[(allow|expect)\(|cfg_attr\([^)]*_allow\(' crates/ bindings/ 2>/dev/null` (must be empty; any lint config goes in `[lints.clippy]` with rationale)
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

7 Report briefly: reconciliation verdicts, milestones shipped (`done`) + `ARCHITECTURE.md` section + `prefix/slug`, files/tests added, gates output, zip proof, `ship.toml` validity, not-run, contrib (`≈N commits + 1 PR`).
