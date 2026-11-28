# RDM Studio — Definitive Roadmap, M14 to 2029

*Prepared 28 November 2026 against `main` @ `v2.5.0` (886+ commits). Updated with locked Product Owner decisions and accelerated Tauri desktop timeline.*

> [!IMPORTANT]
> **Locked Product Owner Decisions & Active Context:**
> - **M13 In Flight (`v2.6.0`):** M13 (`crates/rdm-mesh` 2D Delaunay mesher, `fem2d.rs` plane stress/strain & Mindlin plate bending, `Fem2dStudioModal`, and DRY Lingui `WhatsNewModal` + `driver.js` spotlight tours) is actively in development. **M15 must extract and reuse M13's 2D element kernels into `crates/rdm-shell` rather than rewriting them.**
> - **Default National Annex & Footings:** **`NF` (France)** is the default national annex. M16.2 footings ship explicitly labeled **`EN 1997-1 Annex D (EC7)`**, followed by **`NF P 94-261`** in Q2 2027.
> - **Theme Policy:** Strict **daylight Swiss Metrology Workstation** (`DESIGN.md` §1) stays locked through M17; optional dark mode is deferred to Q4 2027.
> - **Tauri Desktop Companion (`ADR-8`) — Accelerated to Q1 2027 (M18):** Native Tauri v2 desktop wrapper (`apps/desktop` / `src-tauri`) moves forward from Q4 2027 to **Q1 2027 (M18, immediately following M17 hardening)** to unlock native multi-threaded `faer` execution and bypass the 4 GB `wasm32` ceiling for naval/lifting/industrial models.
> - **Primary Beachhead Segments:** **Dessinateurs / projeteurs et ingénieurs en bureaux d'études (BET)** — charpente métallique, levage/manutention, naval/offshore et génie civil — exigeant rapidité CAO-calcul, notes de calcul Eurocodes traçables (`.docx`/PDF) et confidentialité stricte (`0 bytes cloud` + compagnon desktop Tauri v2).

> [!IMPORTANT]
> **Locked Product Owner Decisions & Active Context:**
> - **M13 In Flight (`v2.6.0`):** M13 (`crates/rdm-mesh` 2D Delaunay mesher, `fem2d.rs` plane stress/strain & Mindlin plate bending, `Fem2dStudioModal`, and DRY Lingui `WhatsNewModal` + `driver.js` spotlight tours) is actively in development. **M15 must extract and reuse M13's 2D element kernels into `crates/rdm-shell` rather than rewriting them.**
> - **Default National Annex & Footings:** **`NF` (France)** is the default national annex. M16.2 footings ship explicitly labeled **`EN 1997-1 Annex D (EC7)`**, followed by **`NF P 94-261`** in Q2 2027.
> - **Theme Policy:** Strict **daylight Swiss Metrology Workstation** (`DESIGN.md` §1) stays locked through M17; optional dark mode is deferred to Q4 2027.
> - **Tauri Desktop Companion (`ADR-8`) — Accelerated to Q1 2027 (M18):** Native Tauri v2 desktop wrapper (`apps/desktop` / `src-tauri`) moves forward from Q4 2027 to **Q1 2027 (M18, immediately following M17 hardening)** to unlock native multi-threaded `faer` execution and bypass the 4 GB `wasm32` ceiling for naval/lifting/industrial models.
> - **Primary Beachhead Segments:** **Dessinateurs / projeteurs et ingénieurs en bureaux d'études (BET)** — charpente métallique, levage/manutention, naval/offshore et génie civil — exigeant rapidité CAO-calcul, notes de calcul Eurocodes traçables (`.docx`/PDF) et confidentialité stricte (`0 bytes cloud` + compagnon desktop Tauri v2).

See `ARCHITECTURE.md` §18 for milestone details.
