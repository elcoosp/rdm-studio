Task: github.com/elcoosp/rdm-studio. Maximum-velocity, plan-aligned implementation following `AGENTS.md`, `ARCHITECTURE.md`, `DESIGN.md`, and `./mockups/`.

1. **Bootstrap & Sync (< 3 tool calls):**
   - If `rdm-studio` is not cloned locally, `git clone https://github.com/elcoosp/rdm-studio.git && cd rdm-studio`; if it already exists, `cd rdm-studio && git fetch origin && git reset --hard origin/main` so `HEAD` matches your latest pushed `main`.
   - Ensure `rustc`/`cargo` (`wasm32-unknown-unknown`, `rustfmt`, `clippy`), `wasm-pack`, `pnpm`, and `ship` (`cargo install --git https://github.com/elcoosp/ship`) are installed, then read `STATUS.md` and `git log -5 --oneline` to identify the next `missing`/`partial` milestone(s) in `ARCHITECTURE.md` §18 (`M0..M8`).
2. **Ship Complete Milestones:** Implement as many consecutive complete milestones (`M_k`, `M_{k+1}`, ...) as context allows using direct-to-green implementation + comprehensive tests (zero stubs, zero `.unwrap()` in solver/cad/wasm, zero hardcoded Eurocode/unit conversions in Web). Never edit `ARCHITECTURE.md` or `DESIGN.md`.
3. **Verify Gates:** Run all applicable Gates `G0 → G6` (`AGENTS.md` §4) until 100% green with zero warnings.
4. **Handoff & Archive (Leave Tree Dirty — No Commits):** Update `STATUS.md`, write `.github/pr-body.md` and `ship.toml` (1 dirty file per `[[commit]]`, ordered by dependency), run `ship validate` until exit `0`, and zip the full clean tree (`rdm-studio-<SLUG>.zip`, excluding only `.git/`, `target/`, `node_modules/`, caches) into the downloads folder with zip contents proof.
