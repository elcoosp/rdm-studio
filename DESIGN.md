---

name: RDM Studio — Swiss Metrology Workstation
version: 1.0.0
colors:
canvas: '#F8FAFC'
surface: '#FFFFFF'
surface-subtle: '#F1F5F9'
border: '#E2E8F0'
border-strong: '#CBD5E1'
ink-primary: '#0F172A'
ink-secondary: '#475569'
ink-muted: '#94A3B8'
accent: '#1D4ED8'
accent-hover: '#1E40AF'
accent-tint: '#EFF6FF'
accent-ring: '#93C5FD'
fea-tier-1: '#1D4ED8'
fea-tier-2: '#06B6D4'
fea-tier-3: '#10B981'
fea-tier-4: '#F59E0B'
fea-tier-5: '#DC2626'
status-pass-bg: '#ECFDF5'
status-pass-border: '#A7F3D0'
status-pass-text: '#065F46'
status-fail-bg: '#FEF2F2'
status-fail-border: '#FECACA'
status-fail-text: '#991B1B'
typography:
headline-lg: { fontFamily: Inter, fontSize: 24px, fontWeight: '600', lineHeight: 32px }
headline-md: { fontFamily: Inter, fontSize: 18px, fontWeight: '600', lineHeight: 24px }
headline-sm: { fontFamily: Inter, fontSize: 15px, fontWeight: '600', lineHeight: 20px }
body-lg: { fontFamily: Inter, fontSize: 14px, fontWeight: '400', lineHeight: 20px }
body-md: { fontFamily: Inter, fontSize: 13px, fontWeight: '400', lineHeight: 18px }
body-sm: { fontFamily: Inter, fontSize: 12px, fontWeight: '400', lineHeight: 16px }
mono-lg: { fontFamily: JetBrains Mono, fontSize: 13px, fontWeight: '500', lineHeight: 16px }
mono-md: { fontFamily: JetBrains Mono, fontSize: 12px, fontWeight: '500', lineHeight: 16px }
mono-sm: { fontFamily: JetBrains Mono, fontSize: 11px, fontWeight: '400', lineHeight: 14px }
rounded:
badge: 2px
control: 4px
overlay: 8px
sheet-top: 16px
---

## 1. Brand & Aesthetic Foundation

**RDM Studio** fuses classic Swiss metrological precision with the high-cadence, keyboard-first restraint of modern engineering workstations. Every pixel serves structural calculation, 3D finite element analysis (FEA), and Eurocode 3 compliance.

- **Single Navigation Spine:** A single 5-step workflow bar (`Géométrie & Profilés`, `Liaisons`, `Charges`, `Calcul 3D & Eurocode 3`, `Rapport`) governs navigation—never duplicate step lists in sidebars or add decorative bottom telemetry bars.
- **Strict Spectrum Isolation:** The 5-tier thermal spectrum (`#1D4ED8` → `#06B6D4` → `#10B981` → `#F59E0B` → `#DC2626`) is strictly quarantined to 3D deformed meshes, force vector arrows, cross-section Von Mises heatmaps, and utilization bars. Interface controls remain monolithic neutral + Deep Cobalt (`#1D4ED8`).
- **Copy Demeanor:** Natural sentence-case French (`fr` default) and English (`en`) everywhere. **All-caps eyebrow kickers are strictly prohibited.** Minimum text size is `11px` (`16px` on mobile inputs to prevent iOS Safari auto-zoom).

---

## 2. Color System

### Core Daylight Chrome

- **3D Viewport Canvas (`#F8FAFC`):** Architectural off-white canvas with a subtle 3D metric floor grid (never place decorative grids behind sidebars or forms).
- **Surface Chrome (`#FFFFFF`):** Pure white sidebars, top header bar, and bottom inspector sheets.
- **Hairline Borders (`#E2E8F0` / hover `#CBD5E1`):** `1px solid` borders define all docked panels with zero drop shadows.
- **Text Hierarchy:** `#0F172A` (Primary ink), `#475569` (Labels & Eurocode references), `#94A3B8` (Units & disabled states).
- **Primary Brand Accent (`#1D4ED8`):** Deep Cobalt Blue matching the isometric IPE emblem (`hover: #1E40AF`, `tint: #EFF6FF`, `focus ring: #93C5FD`).

### FEA Thermal Spectrum (Analytical Meshes & Charts Only)

- **Tier 1 (`0.0 – 0.2` / Nominal):** `#1D4ED8` (Cobalt Blue)
- **Tier 2 (`0.2 – 0.5` / Low):** `#06B6D4` (Cyan)
- **Tier 3 (`0.5 – 0.8` / Elastic):** `#10B981` (Emerald)
- **Tier 4 (`0.8 – 1.0` / Plastic Limit Approach):** `#F59E0B` (Amber)
- **Tier 5 (`> 1.0` / Yield or Buckling Failure):** `#DC2626` (Crimson)

---

## 3. Typography & Numerical Alignment

- **Inter:** All UI labels, navigation tabs, headings, and calculation notes in sentence case.
- **JetBrains Mono:** All numerical values, coordinates (`X, Y, Z`), Eurocode formulas (`EN 1993-1-1`, `χy`, `χz`, `Wpl,y`), forces (`kN`, `kN·m`), stresses (`MPa`), and profile designations (`IPE 200`, `HEA 180`).
- **Tabular Alignment:** Enforce `font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 1;` on all numeric readouts, with a non-breaking space before units (`235 MPa`, `4,82 mm`).

---

## 4. Adaptive Layout & Responsive Architecture

### Desktop (`≥ 1024px`)

- **Top Header Bar (`44px`):** Isometric thermal IPE logo + clickable project switcher (`RDM Studio / Treillis-L240 ▾`) on left; 5-step horizontal tabs with `2px solid #1D4ED8` active underline in center; node/beam counter, `⌘K` trigger, `FR | EN` toggle, and `?` onboarding button on right.
- **Left Inspector Sidebar (`320px`, `#FFFFFF`, `1px` right border `#E2E8F0`):** Flat horizontal property rows (`28px–32px` height), closed single-line selects (`30px`), zero nested boxes.
- **Center 3D Viewport (`flex-1`, `#F8FAFC`):** Full-height WebGL2 canvas with floating top-left view controls (`3D Iso`, `Dessus XY`, `Face XZ`, `Côté YZ`, `Volumique 3D`) and top-right XYZ gizmo.
- **Step 4 Docked Bottom Inspector (`240px` height):** Split `32%` calibrated 2D cross-section thermal heatmap / `68%` synchronized `uPlot` internal force diagrams (`My`, `Vz`, `N`) with vertical crimson cursor `x`.

### Tablet & Phone (`< 1024px`, Field & Site Ready)

- **Full-Bleed 3D Viewport (`100dvh`):** Respects `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
- **Compact Mobile Top Bar (`48px`):** Logo + project name on left; `⌘K` search icon (`44×44px`) and `FR | EN` pill on right.
- **Draggable Tactile Bottom Sheet (`motion` `drag="y"`):** `16px` top radius (`rounded-t-2xl`), centered `36×4px` grabber pill (`#CBD5E1`), 3 snap states (_Collapsed `84px`_, _Half `48dvh`_, _Expanded `85dvh`_).
- **Thumb-Friendly Bottom Tab Bar (`56px`):** 5 equal touch targets (`≥ 44×44px`) with `20px` custom SVG icons + concise labels (`Géométrie`, `Liaisons`, `Charges`, `Résultats`, `Rapport`).
- **Touch CAD Ergonomics:** `44px` minimum touch target height, `inputMode="decimal"` with `16px` font on numeric inputs, and `24px` touch picking radius in 3D.

---

## 5. Elevation, Shapes & Custom Engineering Iconography

- **Elevation:** Zero drop shadows on docked sidebars, headers, and bottom tab bars (`box-shadow: none`). Soft shadows (`0 8px 24px rgba(15, 23, 42, 0.08)`) are reserved strictly for floating overlays (`⌘K`, modals, mobile bottom sheet).
- **Corner Radii:** `2px` on rectangular status badges, `4px` on inputs/buttons/selects (no pill-shaped functional buttons), `8px` on modals/popovers, `16px` top corners on mobile bottom sheet.
- **24 Custom Engineering SVG Icons (`24×24` optical grid, `1.5px` stroke):**
  - _Sections:_ `IPE`, `HEA/HEB`, `UPN/UPE`, `CHS`, `SHS/RHS`, `Cornière L`.
  - _Supports & Releases:_ `Encastrement`, `Rotule`, `Appui simple`, `Glissière`, `Appui élastique`, `Relâchement N1/N2`.
  - _Loads:_ `Force ponctuelle`, `Charge uniforme`, `Charge trapézoïdale`, `Moment/Torsion`, `Poids propre 1g`, `Accélération`.
  - _CAD & EC3:_ `Roulis θx`, `Accrochage magnétique`, `Fusion nœuds`, `Coupe section 2D`, `Flambement χ`, `Mode propre`.

---

## 6. Core Components (`shadcn/ui`) & Eurocode 3 Indicators

All interactive UI primitives (`Button`, `Select`, `Dialog`, `Command`, `Tabs`, `Switch`, `Slider`, `Tooltip`, `Sheet`, `Table`) are built on **`shadcn/ui`** (`apps/web/src/components/ui/`) themed strictly with the Swiss Metrology daylight tokens (`#1D4ED8` Cobalt accent, `4px` control radius, `1px #E2E8F0` hairlines, zero dark-mode defaults).

- **Primary CTA Button:** `#1D4ED8` background, `#FFFFFF` text, `4px` radius, `32px` desktop / `44px` mobile height, `Inter` `13px` weight `600`, `2px #93C5FD` focus ring.
- **Horizontal Property Row:** Left label (`Inter` `12px`, `#475569`), right value/control (`JetBrains Mono` `12px`, `#0F172A`) + unit suffix (`#94A3B8`), separated by `1px solid #F1F5F9`.
- **Eurocode 3 Compliance Badges (`2px` radius, `JetBrains Mono` `11px`):**
  - **Pass ($\eta \le 1.00$):** `#ECFDF5` fill, `1px solid #A7F3D0` border, `#065F46` text (e.g., `η = 0,74 Conforme EC3`).
  - **Fail ($\eta > 1.00$):** `#FEF2F2` fill, `1px solid #FECACA` border, `#991B1B` text (e.g., `η = 1,25 Dépassement χz`) paired with a 1-click corrective action button.
- **Utilization Progress Track:** `4px` height, `#F1F5F9` track, dynamic fill (`#10B981` for $\eta \le 0.80$, `#F59E0B` for $0.80 < \eta \le 1.00$, `#DC2626` for $\eta > 1.00$).

---

## 7. Precision Ergonomics & Field-Grade UX Refinements (v1.1)

1. **Exact SVG Icon Source (`mockups/icons-sheet.html` → `EngineeringIcons.tsx`):**
   - Implement all 32 custom engineering icons (`ProfileIpe` through `ModalVibration`) using the exact `viewBox="0 0 24 24"`, `strokeWidth="1.5"`, `#0F172A` + `#1D4ED8` paths defined in `mockups/icons-sheet.html`.
2. **3D Snap Cursor Glyphs & Haptics (`SnapGrid`):**
   - Render a dynamic 3D snap reticle at the cursor: **Cobalt square (`#1D4ED8`)** on existing nodes, **Cyan triangle (`#06B6D4`)** at beam midpoints, and **Slate crosshair (`#64748B`)** on metric grid intersections, paired with a subtle `navigator.vibrate(10)` pulse on touch devices.
3. **Hold-`Alt` Keycap Hints (`KeycapHints`):**
   - Holding `Alt` / `Option` reveals crisp `JetBrains Mono` shortcut badges (`[X]`, `[Y]`, `[Z]` axis locks, `[F]` zoom extents, `[I]` isometric view, `[Space]` modal play/pause, `[⌘K]` palette) over toolbar buttons.
4. **What-If Optimization Diff & 5-Second Undo Toast:**
   - Applying a 1-click Eurocode 3 corrective action (e.g., replacing an overloaded beam with `IPE 240`) displays a compact delta summary (`Masse : +8,3 kg · Taux EC3 : 124,8 % → 68,4 %`) inside a Sonner toast with an immediate `Annuler (⌘Z)` button.
5. **1-Click Excel / LibreOffice TSV Table Copy (`Copier pour Excel`):**
   - Each of the 4 tables in Step 5 (`Rapport`) includes a top-right copy button exporting tab-separated values (`TSV`) formatted with French decimal commas ready for direct `Ctrl+V` paste into spreadsheets.
6. **Native Print Stylesheet (`@media print`):**
   - Pressing `⌘P` / `Ctrl+P` in Step 5 hides all navigation bars and canvas backgrounds, expands the A4 calculation sheet to full width without borders, and applies `break-inside: avoid` on tables and cross-section figures.
7. **Transparent Local / Offline Status Pill (`PWA Status`):**
   - Header displays a subtle status indicator (`Enregistré en local`) that switches cleanly to an amber badge (`Mode hors-ligne actif`) whenever `navigator.onLine === false`.

---

## 7. Precision Ergonomics & Field-Grade UX Refinements (v1.1)

1. **Exact SVG Icon Source (`mockups/icons-sheet.html` → `EngineeringIcons.tsx`):**
   - Implement all 32 custom engineering icons (`ProfileIpe` through `ModalVibration`) using the exact `viewBox="0 0 24 24"`, `strokeWidth="1.5"`, `#0F172A` + `#1D4ED8` paths defined in `mockups/icons-sheet.html`.
2. **3D Snap Cursor Glyphs & Haptics (`SnapGrid`):**
   - Render a dynamic 3D snap reticle at the cursor: **Cobalt square (`#1D4ED8`)** on existing nodes, **Cyan triangle (`#06B6D4`)** at beam midpoints, and **Slate crosshair (`#64748B`)** on metric grid intersections, paired with a subtle `navigator.vibrate(10)` pulse on touch devices.
3. **Hold-`Alt` Keycap Hints (`KeycapHints`):**
   - Holding `Alt` / `Option` reveals crisp `JetBrains Mono` shortcut badges (`[X]`, `[Y]`, `[Z]` axis locks, `[F]` zoom extents, `[I]` isometric view, `[Space]` modal play/pause, `[⌘K]` palette) over toolbar buttons.
4. **What-If Optimization Diff & 5-Second Undo Toast:**
   - Applying a 1-click Eurocode 3 corrective action (e.g., replacing an overloaded beam with `IPE 240`) displays a compact delta summary (`Masse : +8,3 kg · Taux EC3 : 124,8 % → 68,4 %`) inside a Sonner toast with an immediate `Annuler (⌘Z)` button.
5. **1-Click Excel / LibreOffice TSV Table Copy (`Copier pour Excel`):**
   - Each of the 4 tables in Step 5 (`Rapport`) includes a top-right copy button exporting tab-separated values (`TSV`) formatted with French decimal commas ready for direct `Ctrl+V` paste into spreadsheets.
6. **Native Print Stylesheet (`@media print`):**
   - Pressing `⌘P` / `Ctrl+P` in Step 5 hides all navigation bars and canvas backgrounds, expands the A4 calculation sheet to full width without borders, and applies `break-inside: avoid` on tables and cross-section figures.
7. **Transparent Local / Offline Status Pill (`PWA Status`):**
   - Header displays a subtle status indicator (`Enregistré en local`) that switches cleanly to an amber badge (`Mode hors-ligne actif`) whenever `navigator.onLine === false`.
