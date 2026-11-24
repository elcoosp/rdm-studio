---
name: Daylight CAD Workstation
colors:
  surface: '#f6fafd'
  surface-dim: '#d6dbdd'
  surface-bright: '#f6fafd'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f4f7'
  surface-container: '#eaeef1'
  surface-container-high: '#e5e9eb'
  surface-container-highest: '#dfe3e6'
  on-surface: '#171c1e'
  on-surface-variant: '#3e484d'
  inverse-surface: '#2c3133'
  inverse-on-surface: '#edf1f4'
  outline: '#6e797e'
  outline-variant: '#bdc8ce'
  surface-tint: '#006780'
  primary: '#00647c'
  on-primary: '#ffffff'
  primary-container: '#007f9d'
  on-primary-container: '#fafdff'
  inverse-primary: '#6cd3f7'
  secondary: '#555f6d'
  on-secondary: '#ffffff'
  secondary-container: '#d6e0f1'
  on-secondary-container: '#596372'
  tertiary: '#4551b8'
  on-tertiary: '#ffffff'
  tertiary-container: '#5f6bd3'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b7eaff'
  primary-fixed-dim: '#6cd3f7'
  on-primary-fixed: '#001f28'
  on-primary-fixed-variant: '#004e61'
  secondary-fixed: '#d9e3f4'
  secondary-fixed-dim: '#bdc7d8'
  on-secondary-fixed: '#121c28'
  on-secondary-fixed-variant: '#3e4755'
  tertiary-fixed: '#dfe0ff'
  tertiary-fixed-dim: '#bdc2ff'
  on-tertiary-fixed: '#000965'
  on-tertiary-fixed-variant: '#2e3aa2'
  background: '#f6fafd'
  on-background: '#171c1e'
  surface-variant: '#dfe3e6'
  canvas-base: '#F9FAFB'
  surface-panel: '#FFFFFF'
  border-hairline: '#E5E7EB'
  border-subtle: '#D1D5DB'
  text-primary: '#111827'
  text-secondary: '#4B5563'
  text-muted: '#6B7280'
  fea-stress-min: '#2563EB'
  fea-stress-low: '#0891B2'
  fea-stress-mid: '#10B981'
  fea-stress-warn: '#F59E0B'
  fea-stress-max: '#EF4444'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.01em
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
  data-mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  data-mono-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  data-mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
  label-ui:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  label-code:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 12px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system targets structural calculation specialists, civil engineers, and FEA (Finite Element Analysis) practitioners who demand uncompromising clarity during sustained technical workflows. Drawing from high-performance developer tool ergonomics and the International Typographic Style, the interface replaces dim, neon-lit CAD environments with a clean daylight workstation aesthetic.

### Aesthetic Principles
- **Surgical Restraint:** Pure functional surfaces, zero extraneous decorative panels, and strict visual economy. Every UI pixel is dedicated to engineering clarity.
- **Instrument Precision:** Hairline 1px dividers, tabular alignment, and crisp contrast tiers replace bulky card containers and excessive drop shadows.
- **Cognitive Daylight:** A soft, high-key canvas palette calibrated to reduce optical strain during 8+ hour computational analysis, modeling, and meshing sessions.

## Colors

The color architecture enforces strict separation between background canvas infrastructure, structural panels, text legibility, and technical telemetry.

### Palette Allocation
- **Primary (`#0891B2`):** Reserved for focal triggers, active tool toggles, active node selections, and focused input boundaries.
- **Secondary (`#4B5563`):** Governs structural icons, interactive subheadings, and secondary tool toggles.
- **Tertiary (`#5E6AD2`):** Serves auxiliary software integrations, version branch trees, and metadata badges.
- **Canvas Base (`#F9FAFB`):** Ambient background providing contrast behind pure white operational panels.
- **Surface Panel (`#FFFFFF`):** Workstation inspectors, property lists, coordinate strips, and docked toolbars.
- **Structural Lines (`#E5E7EB`):** Crisp 1px separations for panels, cell grids, and coordinate matrices.

### Color Usage Rules
- Pure white (`#FFFFFF`) is strictly used as an operational surface layer over the `#F9FAFB` canvas.
- Colored backgrounds are prohibited on data rows; state is communicated via hairline indicators and primary text emphasis.
- The FEA stress spectrum (`#2563EB` through `#EF4444`) is isolated exclusively to mesh visualizations, stress maps, and failure analysis limit flags.

## Typography

Typography balances rapid UI navigation with numerical certitude. Two typeface engines divide these cognitive tasks:

- **Inter:** Handles structural navigation, control triggers, hierarchical labels, and natural prose.
- **JetBrains Mono:** Mandated for all mathematical entities, vectors, spatial coordinates $(X, Y, Z)$, physical units, matrix arrays, and telemetry data tables.

### Typographic Rules
- Always apply tabular figures (`font-variant-numeric: tabular-nums`) across all mono levels to ensure alignment across stacked columns.
- Units of measure (such as `kN`, `MPa`, `mm`, `kg/m³`) must be rendered with an immutable non-breaking space after numerical tokens.
- Keep label and property hierarchy compact; line-heights are constrained to match dense parameter grids without vertical overflow.

## Layout & Spacing

The workstation layout follows a fixed-docking modular grid calibrated for high-resolution screens (1440px minimum width, optimized for 1920x1080 and 4K displays).

### Shell Model
- **Command Header:** Fixed 44px height spanning the viewport. Houses global actions, active document state, and workspace mode switcher.
- **Model Hierarchy Pane (Left):** Width fixed at 260px (collapsible to 40px icon rail).
- **Primary Viewport (Center):** Fluid CAD/FEA canvas stretching across all available screen space.
- **Inspector Pane (Right):** Width fixed at 300px. Houses parameter lists, material coefficients, and solve parameters.
- **Status & Telemetry Rail (Bottom):** Fixed 28px height displaying cursor coordinates, unit scale, and solver latency.

### Spacing Principles
- Spacing units adhere strictly to a 4px/8px baseline rhythm.
- Vertical density in property inspector panels favors 28px–32px row heights to maximize visible parameter bandwidth without scrolling.

## Elevation & Depth

Visual hierarchy is maintained through crisp hairline borders and tonal surfaces rather than heavy blur shadows, preserving a light, flat engineering plane.

### Surface Tiers
- **Tier 0 (Canvas Base):** Background substrate `#F9FAFB`.
- **Tier 1 (Structural Workspaces):** Pure white `#FFFFFF` panels separated strictly by 1px solid `#E5E7EB` borders.
- **Tier 2 (Floating Viewport Tools & Palettes):** Surface `#FFFFFF` bordered by 1px solid `#D1D5DB` with a subtle technical drop: `0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 8px -2px rgba(0, 0, 0, 0.03)`.
- **Tier 3 (Modal Dialogs & Export Consoles):** Surface `#FFFFFF`, bordered by 1px solid `#D1D5DB`, elevated by `0 8px 24px -4px rgba(0, 0, 0, 0.08)`, seated on a translucent backdrop of `rgba(17, 24, 39, 0.20)`.

## Shapes

Corner radii prioritize mechanical precision. The shape language stays between 2px and 6px to avoid ballooned geometry that compromises data density.

### Radius Assignments
- **Compact Radii (2px):** Table row focus tags, status dots, and indicator ticks.
- **Component Radii (4px):** Form controls, inputs, action buttons, select menus, and tool rail buttons.
- **Overlay Radii (6px):** Floating viewport toolbars, dropdown containers, context menus, and modal frames.
- **Full Radii (9999px):** Node vertex handles in the 3D viewport and circular scalar indicators.

## Components

### Buttons & Interactive Controls
- **Primary Action:** Solid `#0891B2` background, `#FFFFFF` text, 4px radius, 28px height, padding 0 10px. Hover: `#0E7490`. Active: `#155E75`. Focus outline: 1px solid `#0891B2` with 2px offset.
- **Secondary Tool:** `#FFFFFF` background, 1px solid `#E5E7EB`, `#111827` text. Hover: `#F9FAFB` surface and `#D1D5DB` border.
- **Ghost Utility:** Borderless `#FFFFFF` surface, `#4B5563` text. Hover: `#F3F4F6` background, `#111827` text.

### Flat Property List Rhythm
- Key-value pairs arranged with zero outer box containment.
- Keys styled in `label-ui` (`#6B7280`), right-aligned or left-aligned within a clean grid row.
- Values styled in `data-mono-md` (`#111827`).
- Separated only by 1px hairline rules (`#E5E7EB`) with 6px vertical cell padding.

### Numeric & Dimension Inputs
- Height: 26px.
- Background: `#FFFFFF`. Border: 1px solid `#E5E7EB`.
- Text: `data-mono-md` (`#111827`).
- Embedded right-hand suffix: fixed-width unit label (`label-code` in `#6B7280`).
- Focus state: Border transitions to `#0891B2`, with a crisp 1px box-shadow ring in `#0891B2`.

### Checkboxes & Segmented Toggles
- **Checkboxes:** 14px square, 3px corner radius, 1px solid `#D1D5DB`. Checked: `#0891B2` fill with white check vector.
- **Segmented Tool Switchers:** Pure white `#FFFFFF` enclosure, 1px solid `#E5E7EB`, housing 22px segmented toggle buttons. Selected option: `#F3F4F6` background, `#111827` text, and subtle 1px border.

### Status Indicators & Badges
- 18px height, 4px corner radius, padding 0 6px.
- Subtle tinted fill: background at 8% opacity of status color, text rendered in full intensity (e.g., `#0891B2` for active state, `#EF4444` for mesh constraint error).