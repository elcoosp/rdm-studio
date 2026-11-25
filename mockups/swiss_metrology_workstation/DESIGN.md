---
name: Swiss Metrology Workstation
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#747686'
  outline-variant: '#c4c5d7'
  surface-tint: '#2151da'
  primary: '#0037b0'
  on-primary: '#ffffff'
  primary-container: '#1d4ed8'
  on-primary-container: '#cad3ff'
  inverse-primary: '#b7c4ff'
  secondary: '#00687a'
  on-secondary: '#ffffff'
  secondary-container: '#57dffe'
  on-secondary-container: '#006172'
  tertiary: '#004f35'
  on-tertiary: '#ffffff'
  tertiary-container: '#006a48'
  on-tertiary-container: '#60eeb1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001551'
  on-primary-fixed-variant: '#0039b5'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  headline-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
  data-metric:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.5rem
  margin: 0.75rem
  space-xs: 0.125rem
  space-sm: 0.25rem
  space-md: 0.5rem
  space-lg: 0.75rem
  space-xl: 1rem
---

## Brand & Style

The design system establishes a high-precision, technical aesthetic tailored for structural engineering, finite element analysis (FEA), and Eurocode 3 regulatory verification. Blending the utilitarian precision of Swiss graphic design with the modern keyboard-first density of contemporary software tools, it presents an analytical environment that feels like an instrument of calibration rather than an enterprise web portal.

### Target Audience & Psychological Posture
Designed for structural engineers, civil estimators, and Eurocode compliance auditors. The interface projects uncompromised structural reliability, exactitude, and absolute clarity. The emotional atmosphere is calm, scientific, and authoritative—eliminating visual noise to support complex multi-criteria spatial reasoning.

### Aesthetic Foundation
- **Precision Minimalism & Functional Grid Alignment:** Razor-sharp 1px hairline dividers provide structural definition without volumetric distraction. 
- **Utilitarian Metrology:** Data rows align flush along horizontal axes, referencing calibration sheets and physical gauge readouts.
- **Micro-Scale Density:** Compact information density with zero decorative flourishes; every visual token corresponds to a structural attribute, verification state, or kinematic degree of freedom.
- **Copy Demeanor:** Strict sentence-case terminology across all labels, tooltips, and inspectors. Avoid uppercase eyebrow headers to preserve visual calm.

## Colors

The system uses a calibrated daylight palette engineered for long computational sessions. Contrast ratios exceed WCAG AAA standards for all technical data rows.

### Core Interface Roles
- **Chrome Surfaces (`#FFFFFF`):** High-reflectance, crisp white used strictly for toolbars, side-dock inspectors, tree views, and top navigation ribbons.
- **Viewport Canvas (`#F8FAFC`):** Soft architectural off-white dedicated to the 3D scene, rendering member geometry, cross-sections, and spatial point clouds without ocular glare.
- **Hairline Structural Boundaries (`#E2E8F0`):** Neutral gray applied across all 1px container boundaries, vertical dividers, and data-grid rules.
- **Deep Cobalt Accent (`#1D4ED8`):** The primary UI accent for active tool toggles, selected node states, and primary actions. Interacts via a deeper hover state (`#1E40AF`) and an ambient surface tint (`#EFF6FF`).

### FEA Scientific Spectrum
Reserved exclusively for finite element visualization (stress contours, bending moments, axial loads, displacement gradients, and Eurocode unity check utilization ratios). Never apply these colors to generic chrome controls:
- **0.0 - 0.2 Utilization / Minimum Stress:** Cobalt Blue (`#1D4ED8`)
- **0.2 - 0.5 Low Stress:** Cyan (`#06B6D4`)
- **0.5 - 0.8 Elastic Capacity:** Emerald (`#10B981`)
- **0.8 - 1.0 Plastic Limit Approach:** Amber (`#F59E0B`)
- **> 1.0 Eurocode Verification Failure:** Crimson (`#DC2626`)

## Typography

The dual-type hierarchy isolates operational human dialogue from physical measurement values.

### Typeface Roles
- **Inter:** Drives all functional application UI, tree structures, configuration menus, contextual dialogues, and operational documentation. All section headings, menu titles, and inspector labels must follow sentence-case capitalization. Uppercase treatment is strictly prohibited.
- **JetBrains Mono:** Drives all quantitative metrics, matrix coordinates, scalar dimensions, finite element calculations, and engineering units (`MPa`, `kN`, `kNm`, `mm`, `daN/m²`).

### Numerical Alignment Rules
- Numerical readings must enforce tabular lining figures (`font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;`) to guarantee continuous vertical column alignment across property inspectors.
- Engineering unit suffixes must follow standard metric spacing rules: a fixed non-breaking space between the numerical value and the symbol (e.g., `355 MPa`, `12.4 kN`).

## Layout & Spacing

The layout operates on a desktop-first workstation model comprising fixed operational toolbars, persistent dockable inspectors, and an expansive 3D viewport.

### Panel Architecture
- **Application Header:** 40px fixed height; holds project metadata, calculation status indicators, and global compute triggers.
- **Left Panel (Tree / Scenarios):** 280px default width; holds structural hierarchy, material profiles, and Eurocode combination sets.
- **Center Canvas (3D Viewport):** Flex-grow canvas with an underlying `#F8FAFC` viewport surface.
- **Right Panel (Property Inspector / Eurocode 3 Verification):** 320px default width; holds horizontal property tables, member dimensions, stress utilization bars, and verification checks.
- **Bottom Shelf (Calculations Console / Matrix Output):** Collapsible panel with a 180px default height.

### Horizontal Data Grid Rhythm
- Standard inspector rows are fixed at 28px height, maximizing the vertical visibility of complex member parameters.
- Property keys occupy the left 45% of the row; dynamic values with their units occupy the right 55%, separated by an optional hairline divider.
- Elements remain aligned flush to the 1px panel boundaries to maintain a calibrated instrument feel.

## Elevation & Depth

Visual hierarchy is achieved through crisp 1px borders and distinct surface tones rather than multi-layered dropshadows.

### Structural Depth Architecture
- **Tier 0 (Base Canvas):** `#F8FAFC` viewport surface housing the 3D structural model and camera controls.
- **Tier 1 (Surface Chrome):** `#FFFFFF` sidebars, top navigation bars, and footer ribbons. Bounded by a crisp 1px border (`#E2E8F0`).
- **Tier 2 (Internal Wells & Form Controls):** Inactive input fields and table cells sit flat at `#FFFFFF` with a 1px border (`#E2E8F0`). Focused fields switch to a 1px border (`#1D4ED8`) with an inset ring tint (`#EFF6FF`).
- **Tier 3 (Floating Overlays & Contextual Sheets):** Modals, contextual right-click menus, and active command palettes represent the sole application of drop shadows:
  - Menu Shadow: `0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 1px 3px 0 rgba(15, 23, 42, 0.04)`
  - Modal Shadow: `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`
  - Both floating elements retain an explicit 1px boundary (`#CBD5E1`).

## Shapes

The design system maintains geometric precision through compact corner radiuses that mirror engineering hardware displays.

### Radius Distribution
- **Inputs, Buttons, and Data Cells:** 4px (`0.25rem`). Ensures structural sharpness while preventing visual harshness at high data density.
- **Inspector Sections, Popovers, and Dialogs:** 6px to 8px (`0.375rem` to `0.5rem`). Applied to outer viewport containers and floating utility panels.
- **Pill Shapes:** Strictly prohibited for functional buttons or badges. Status pills are replaced by compact rectangular badges with 2px radiuses.

## Components

### Buttons & Action Triggers
- **Primary Action (Compute / Validate):** Solid cobalt blue background (`#1D4ED8`), `#FFFFFF` text, 4px border radius, 28px height, Inter 13px weight 500. Hover: `#1E40AF`.
- **Secondary Action (Sub-routine / Filter):** Crisp white background (`#FFFFFF`), 1px border (`#E2E8F0`), text `#334155`. Hover: `#F8FAFC` background with border `#CBD5E1`.
- **Ghost Utility Button (Viewport tools):** Transparent background, 24px height, `#64748B` icon fill. Active state: background `#EFF6FF`, icon fill `#1D4ED8`.

### Horizontal Property Rows
- **Layout:** Flex row, 28px fixed height, boundary border-bottom 1px solid `#F1F5F9`.
- **Property Label:** Inter 12px, text `#64748B`, sentence-case, left-aligned.
- **Value Container:** JetBrains Mono 12px, text `#0F172A`, tabular numbers, right-aligned with unit tokens in `#94A3B8`.
- **Row Interaction:** Hovering over a row highlights the target 3D member in the active viewport with a hairline cobalt outline.

### Input Fields & Metric Steppers
- **Default State:** Height 24px, background `#FFFFFF`, border 1px solid `#CBD5E1`, border radius 3px. JetBrains Mono 12px text.
- **Focus State:** Border 1px solid `#1D4ED8`, outline none, box-shadow `0 0 0 1px #1D4ED8`.
- **Inline Stepper:** Integrated micro-increment carets (+ / -) aligned flush to the right edge with a 1px vertical divider.

### Eurocode 3 Verification Bars (Utilization Meters)
- **Bar Track:** 4px or 16px height, background `#F1F5F9`, border-radius 2px.
- **Indicator Fill:** Dynamic width calculated directly from the utilization ratio $\eta = N_{Ed} / N_{c,Rd}$.
- **Spectrum Fill Mapping:**
  - $\eta \le 0.80$: Emerald (`#10B981`)
  - $0.80 < \eta \le 1.00$: Amber (`#F59E0B`)
  - $\eta > 1.00$: Crimson (`#DC2626`)
- **Metric Labeling:** Accompanied by JetBrains Mono 11px notation displaying the exact value (e.g., `η = 0.84 [-] Conforme EC3-1-1`).

### Selection & State Controls (Checkboxes & Radios)
- **Dimensions:** 14px × 14px, 1px border `#CBD5E1`, 2px radius for checkboxes, circular for radios.
- **Selected State:** Background `#1D4ED8`, border `#1D4ED8`. Check indicator is a sharp 1.5px white geometric stroke.