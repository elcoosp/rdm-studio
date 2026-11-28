// 44 Custom Engineering Icons + Workflow Icons + Brand Emblem
// Ported verbatim from mockups/icons-sheet.html (32) and mockups/icons-sheet-v2.html (12)
// 24x24 optical grid, 1.5px stroke, #0F172A ink + var(--color-accent) for accent paths

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  className?: string;
};

function Svg({ size = 22, className, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

// ============================================================
// SECTIONS (EN 10365 / 10210 / 10056)
// ============================================================

export function ProfileIpe({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <path d="M6 4h12v2.5h-4.75v11H18V20H6v-2.5h4.75v-11H6V4Z" />
    </Svg>
  );
}

export function ProfileHea({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <path d="M4 4h16v3h-6.5v10H20v3H4v-3h6.5V7H4V4Z" />
    </Svg>
  );
}

export function ProfileUpn({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <path d="M7 4h10v2.75H9.75v10.5H17V20H7V4Z" />
    </Svg>
  );
}

export function ProfileChs({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="5" />
    </Svg>
  );
}

export function ProfileRhs({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <rect x="4" y="5" width="16" height="14" rx="1" />
      <rect x="7" y="8" width="10" height="8" />
    </Svg>
  );
}

export function ProfileAngle({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <path d="M6 4h3v13h11v3H6V4Z" />
    </Svg>
  );
}

// ============================================================
// SUPPORTS & RELEASES (RDM 7 Library)
// ============================================================

export function SupportFixed({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="7" y1="5" x2="7" y2="19" />
      <line x1="7" y1="12" x2="19" y2="12" />
      <line x1="4" y1="7" x2="7" y2="5" />
      <line x1="4" y1="11" x2="7" y2="9" />
      <line x1="4" y1="15" x2="7" y2="13" />
      <line x1="4" y1="19" x2="7" y2="17" />
    </Svg>
  );
}

export function SupportPinned({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <circle cx="12" cy="7" r="1.75" />
      <polygon points="12,8.75 7,17 17,17" />
      <line x1="4" y1="17" x2="20" y2="17" />
      <line x1="6" y1="20" x2="8.5" y2="17" />
      <line x1="10.5" y1="20" x2="13" y2="17" />
      <line x1="15" y1="20" x2="17.5" y2="17" />
    </Svg>
  );
}

export function SupportRoller({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <circle cx="12" cy="6.5" r="1.75" />
      <polygon points="12,8.25 7.5,15 16.5,15" />
      <circle cx="9.25" cy="17.25" r="1.75" />
      <circle cx="14.75" cy="17.25" r="1.75" />
      <line x1="4" y1="19.5" x2="20" y2="19.5" />
    </Svg>
  );
}

export function SupportSlider({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <rect x="7.5" y="9.5" width="9" height="5" rx="0.75" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </Svg>
  );
}

export function SupportSpring({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="7" y1="4" x2="17" y2="4" />
      <polyline
        points="12,4 12,6.5 9,8 15,10.5 9,13 15,15.5 12,17 12,19.5"
        stroke="var(--color-accent)"
      />
      <line x1="5" y1="19.5" x2="19" y2="19.5" />
    </Svg>
  );
}

export function ReleaseHinge({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="4" y1="12" x2="13.5" y2="12" />
      <circle cx="15.75" cy="12" r="2.25" />
      <circle cx="20" cy="12" r="1.25" fill="currentColor" />
    </Svg>
  );
}

export function SupportReaction({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="4" y1="8" x2="20" y2="8" />
      <line x1="8.5" y1="19" x2="8.5" y2="11" stroke="var(--color-accent)" />
      <polyline points="6.25,13.25 8.5,11 10.75,13.25" stroke="var(--color-accent)" />
      <line x1="15.5" y1="19" x2="15.5" y2="11" stroke="var(--color-accent)" />
      <polyline points="13.25,13.25 15.5,11 17.75,13.25" stroke="var(--color-accent)" />
    </Svg>
  );
}

// ============================================================
// LOADS (EN 1991)
// ============================================================

export function NodalPointLoad({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="12" y1="4" x2="12" y2="14.5" stroke="var(--color-accent)" />
      <polyline points="9,11.5 12,14.5 15,11.5" stroke="var(--color-accent)" />
      <circle cx="12" cy="18.25" r="2.25" />
    </Svg>
  );
}

export function UniformBeamLoad({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="4" y1="6" x2="20" y2="6" stroke="var(--color-accent)" />
      <line x1="6" y1="6" x2="6" y2="15" stroke="var(--color-accent)" />
      <polyline points="4.5,13.25 6,15 7.5,13.25" stroke="var(--color-accent)" />
      <line x1="10" y1="6" x2="10" y2="15" stroke="var(--color-accent)" />
      <polyline points="8.5,13.25 10,15 11.5,13.25" stroke="var(--color-accent)" />
      <line x1="14" y1="6" x2="14" y2="15" stroke="var(--color-accent)" />
      <polyline points="12.5,13.25 14,15 15.5,13.25" stroke="var(--color-accent)" />
      <line x1="18" y1="6" x2="18" y2="15" stroke="var(--color-accent)" />
      <polyline points="16.5,14 18,15.5 19.5,14" stroke="var(--color-accent)" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </Svg>
  );
}

export function TrapezoidalLoad({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="4" y1="11" x2="20" y2="5" stroke="var(--color-accent)" />
      <line x1="6" y1="10.25" x2="6" y2="15.5" stroke="var(--color-accent)" />
      <line x1="10" y1="8.75" x2="10" y2="15.5" stroke="var(--color-accent)" />
      <line x1="14" y1="7.25" x2="14" y2="15.5" stroke="var(--color-accent)" />
      <line x1="18" y1="5.75" x2="18" y2="15.5" stroke="var(--color-accent)" />
      <polyline points="16.5,14 18,15.5 19.5,14" stroke="var(--color-accent)" />
      <line x1="4" y1="18.5" x2="20" y2="18.5" />
    </Svg>
  );
}

export function SpanPointLoad({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="12" y1="4.5" x2="12" y2="14.5" stroke="var(--color-accent)" />
      <polyline points="9.25,11.75 12,14.5 14.75,11.75" stroke="var(--color-accent)" />
      <circle cx="4.5" cy="18" r="1.75" />
      <circle cx="19.5" cy="18" r="1.75" />
      <line x1="6.25" y1="18" x2="17.75" y2="18" />
    </Svg>
  );
}

export function TorqueMoment({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="4" y1="12" x2="14" y2="12" />
      <path d="M10.5 6.5A6.5 6.5 0 1 1 8.5 17" stroke="var(--color-accent)" />
      <polyline points="8.5,5 10.5,6.5 9,8.5" stroke="var(--color-accent)" />
    </Svg>
  );
}

export function SelfWeightGravity({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <rect x="6" y="4.5" width="12" height="9" rx="1" />
      <circle cx="12" cy="9" r="1.25" fill="var(--color-accent)" stroke="var(--color-accent)" />
      <line x1="12" y1="10.25" x2="12" y2="19.5" stroke="var(--color-accent)" />
      <polyline points="9.5,17 12,19.5 14.5,17" stroke="var(--color-accent)" />
    </Svg>
  );
}

export function DynamicAcceleration({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="4" y1="8.5" x2="9" y2="8.5" />
      <line x1="3" y1="12" x2="8" y2="12" />
      <line x1="4" y1="15.5" x2="9" y2="15.5" />
      <line x1="10.5" y1="12" x2="20" y2="12" stroke="var(--color-accent)" />
      <polyline points="16.5,8.5 20,12 16.5,15.5" stroke="var(--color-accent)" />
    </Svg>
  );
}

export function ThermalLoadIcon({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <path d="M8.5 13.2V6a1.75 1.75 0 1 1 3.5 0v7.2a3 3 0 1 1-3.5 0Z" />
      <circle
        cx="10.25"
        cy="15.5"
        r="1.25"
        fill="var(--color-accent)"
        stroke="var(--color-accent)"
      />
      <line x1="10.25" y1="8.5" x2="10.25" y2="14.25" stroke="var(--color-accent)" />
      <line x1="15" y1="8.5" x2="19.5" y2="8.5" stroke="var(--color-accent)" />
      <polyline points="17.5,6.5 19.5,8.5 17.5,10.5" stroke="var(--color-accent)" />
      <line x1="15" y1="14.5" x2="19.5" y2="14.5" stroke="var(--color-accent)" />
      <polyline points="17.5,12.5 19.5,14.5 17.5,16.5" stroke="var(--color-accent)" />
    </Svg>
  );
}

// ============================================================
// CAD & EC3 ICONS
// ============================================================

export function LocalAxes({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="9" y1="15" x2="9" y2="4.5" />
      <polyline points="6.75,6.75 9,4.5 11.25,6.75" />
      <line x1="9" y1="15" x2="19.5" y2="15" />
      <polyline points="17.25,12.75 19.5,15 17.25,17.25" />
      <line x1="9" y1="15" x2="4.5" y2="19.5" />
      <polyline points="4.5,16.5 4.5,19.5 7.5,19.5" />
      <circle cx="9" cy="15" r="1.5" fill="var(--color-accent)" stroke="var(--color-accent)" />
    </Svg>
  );
}

export function MagneticSnap({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <path d="M7.5 4.5v5a4.5 4.5 0 0 0 9 0v-5" />
      <line x1="6.5" y1="7" x2="8.5" y2="7" stroke="var(--color-accent)" />
      <line x1="15.5" y1="7" x2="17.5" y2="7" stroke="var(--color-accent)" />
      <line x1="12" y1="16.5" x2="12" y2="20.5" stroke="var(--color-accent)" />
      <line x1="10" y1="18.5" x2="14" y2="18.5" stroke="var(--color-accent)" />
    </Svg>
  );
}

export function MergeNodes({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <circle cx="4.5" cy="12" r="2" />
      <circle cx="19.5" cy="12" r="2" />
      <circle cx="12" cy="12" r="1.75" fill="var(--color-accent)" stroke="var(--color-accent)" />
      <polyline points="8,10 10,12 8,14" stroke="var(--color-accent)" />
      <polyline points="16,10 14,12 16,14" stroke="var(--color-accent)" />
    </Svg>
  );
}

export function SectionCut({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <rect x="4" y="9" width="16" height="6" rx="0.75" />
      <line
        x1="12"
        y1="4.5"
        x2="12"
        y2="19.5"
        stroke="var(--color-accent)"
        strokeDasharray="2.5 2.5"
      />
    </Svg>
  );
}

export function FlexuralBuckling({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line
        x1="9"
        y1="4.5"
        x2="9"
        y2="19.5"
        stroke="var(--color-ink-muted)"
        strokeDasharray="2 2"
      />
      <path d="M9 4.5C15.5 8.5 15.5 15.5 9 19.5" stroke="var(--color-accent)" />
      <line x1="7" y1="19.5" x2="11" y2="19.5" />
    </Svg>
  );
}

export function LateralTorsionalBuckling({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="6" y1="19" x2="16" y2="19" />
      <line x1="11" y1="19" x2="14.5" y2="6.5" stroke="var(--color-accent)" />
      <line x1="9.5" y1="5.25" x2="19.5" y2="7.75" stroke="var(--color-accent)" />
      <polyline points="17.5,4.25 19.75,5.75 17.75,7.25" stroke="var(--color-accent)" />
    </Svg>
  );
}

export function DeflectionLimit({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line
        x1="4.5"
        y1="8"
        x2="19.5"
        y2="8"
        stroke="var(--color-ink-muted)"
        strokeDasharray="2 2"
      />
      <path d="M4.5 8Q12 18.5 19.5 8" stroke="var(--color-accent)" />
      <circle cx="4.5" cy="8" r="1.5" fill="currentColor" />
      <circle cx="19.5" cy="8" r="1.5" fill="currentColor" />
    </Svg>
  );
}

export function ModalVibration({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="4" y1="12" x2="20" y2="12" stroke="var(--color-ink-muted)" strokeDasharray="2 2" />
      <path d="M4 12C6.5 5 9.5 5 12 12C14.5 19 17.5 19 20 12" stroke="var(--color-accent)" />
    </Svg>
  );
}

export function LoadCombination({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <polyline points="12,6 5.5,6 10,12 5.5,18 12,18" />
      <line x1="17" y1="6" x2="17" y2="18" stroke="var(--color-accent)" />
      <polyline points="14.5,15.5 17,18 19.5,15.5" stroke="var(--color-accent)" />
    </Svg>
  );
}

export function RollAngle({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <path d="M5 6h6v1.5H8.75v9H11V18H5v-1.5h2.25v-9H5V6Z" />
      <path d="M15.5 7.5A6.5 6.5 0 0 1 15.5 16.5" stroke="var(--color-accent)" />
      <polyline points="14,6 15.5,7.5 13.75,8.75" stroke="var(--color-accent)" />
    </Svg>
  );
}

// ============================================================
// V2 ICONS (12) — from mockups/icons-sheet-v2.html
// ============================================================

export function BeamSegment({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <circle cx="5.5" cy="17.5" r="2.25" />
      <circle cx="18.5" cy="6.5" r="2.25" />
      <line x1="7.2" y1="16.05" x2="16.8" y2="7.95" stroke="var(--color-accent)" />
    </Svg>
  );
}

export function NodePin({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="12" y1="4.5" x2="12" y2="7.5" stroke="var(--color-ink-muted)" />
      <line x1="12" y1="16.5" x2="12" y2="19.5" stroke="var(--color-ink-muted)" />
      <line x1="4.5" y1="12" x2="7.5" y2="12" stroke="var(--color-ink-muted)" />
      <line x1="16.5" y1="12" x2="19.5" y2="12" stroke="var(--color-ink-muted)" />
      <circle cx="12" cy="12" r="2.25" fill="var(--color-accent)" stroke="var(--color-accent)" />
    </Svg>
  );
}

export function PortalFrameIcon({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <polyline points="5.5,17 5.5,6.5 18.5,6.5 18.5,17" stroke="var(--color-accent)" />
      <circle cx="5.5" cy="6.5" r="1.5" fill="currentColor" />
      <circle cx="18.5" cy="6.5" r="1.5" fill="currentColor" />
      <line x1="3" y1="17" x2="8" y2="17" />
      <line x1="4" y1="19.5" x2="6" y2="17" />
      <line x1="6.5" y1="19.5" x2="8.5" y2="17" />
      <polygon points="18.5,17 16,20.5 21,20.5" />
    </Svg>
  );
}

export function WarrenTrussIcon({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="4" y1="7.5" x2="20" y2="7.5" />
      <line x1="6" y1="16.5" x2="18" y2="16.5" />
      <polyline
        points="4,7.5 7.2,16.5 10.4,7.5 13.6,16.5 16.8,7.5 20,16.5"
        stroke="var(--color-accent)"
      />
      <circle cx="4" cy="7.5" r="1.25" fill="currentColor" />
      <circle cx="20" cy="7.5" r="1.25" fill="currentColor" />
    </Svg>
  );
}

export function ContinuousBeamIcon({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="4" y1="10" x2="20" y2="10" stroke="var(--color-accent)" />
      <polygon points="5.5,10 3.5,14.5 7.5,14.5" />
      <polygon points="12,10 10,14.5 14,14.5" />
      <polygon points="18.5,10 16.5,14.5 20.5,14.5" />
      <line x1="3" y1="17" x2="21" y2="17" />
    </Svg>
  );
}

export function CantileverBracketIcon({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="6" y1="4.5" x2="6" y2="19.5" />
      <line x1="3.5" y1="6.5" x2="6" y2="9" />
      <line x1="3.5" y1="10.5" x2="6" y2="13" />
      <line x1="3.5" y1="14.5" x2="6" y2="17" />
      <line x1="6" y1="8" x2="19" y2="8" stroke="var(--color-accent)" />
      <line x1="6" y1="14" x2="13.5" y2="8" stroke="var(--color-accent)" />
      <line x1="18.5" y1="10.5" x2="18.5" y2="16.5" />
      <polyline points="16.5,14.5 18.5,16.5 20.5,14.5" />
    </Svg>
  );
}

export function PitchedRoofPortalIcon({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <polyline points="5,18 5,9.5 12,5 19,9.5 19,18" stroke="var(--color-accent)" />
      <circle cx="5" cy="9.5" r="1.25" fill="currentColor" />
      <circle cx="12" cy="5" r="1.25" fill="currentColor" />
      <circle cx="19" cy="9.5" r="1.25" fill="currentColor" />
      <line x1="3" y1="18" x2="7" y2="18" />
      <line x1="17" y1="18" x2="21" y2="18" />
    </Svg>
  );
}

export function BracedBuildingFrameIcon({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <rect x="6" y="4.5" width="12" height="14.5" stroke="var(--color-accent)" />
      <line x1="6" y1="9.5" x2="18" y2="9.5" stroke="var(--color-accent)" />
      <line x1="6" y1="14.5" x2="18" y2="14.5" stroke="var(--color-accent)" />
      <line x1="6" y1="9.5" x2="18" y2="14.5" />
      <line x1="18" y1="9.5" x2="6" y2="14.5" />
      <line x1="4" y1="19" x2="20" y2="19" />
    </Svg>
  );
}

export function LiftingBeamIcon({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <circle cx="12" cy="4.75" r="1.5" />
      <polyline points="6.5,10.5 12,6.25 17.5,10.5" />
      <line x1="4.5" y1="10.5" x2="19.5" y2="10.5" stroke="var(--color-accent)" />
      <line x1="7" y1="10.5" x2="7" y2="16.5" stroke="var(--color-accent)" />
      <line x1="17" y1="10.5" x2="17" y2="16.5" stroke="var(--color-accent)" />
      <path d="M5.75 16.5a1.5 1.5 0 1 0 2.5 1.1" />
      <path d="M15.75 16.5a1.5 1.5 0 1 0 2.5 1.1" />
    </Svg>
  );
}

export function WindLoadIcon({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="18.5" y1="4.5" x2="18.5" y2="19.5" />
      <line x1="4.5" y1="7.5" x2="15" y2="7.5" stroke="var(--color-accent)" />
      <polyline points="12.75,5.25 15,7.5 12.75,9.75" stroke="var(--color-accent)" />
      <line x1="6" y1="12" x2="15" y2="12" stroke="var(--color-accent)" />
      <polyline points="12.75,9.75 15,12 12.75,14.25" stroke="var(--color-accent)" />
      <line x1="4.5" y1="16.5" x2="15" y2="16.5" stroke="var(--color-accent)" />
      <polyline points="12.75,14.25 15,16.5 12.75,18.75" stroke="var(--color-accent)" />
    </Svg>
  );
}

export function SnowLoadIcon({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="12" y1="4" x2="12" y2="15.5" stroke="var(--color-accent)" />
      <line x1="7" y1="6.85" x2="17" y2="12.65" stroke="var(--color-accent)" />
      <line x1="17" y1="6.85" x2="7" y2="12.65" stroke="var(--color-accent)" />
      <polyline points="10.25,5.5 12,7 13.75,5.5" stroke="var(--color-accent)" />
      <polyline points="10.25,14 12,12.5 13.75,14" stroke="var(--color-accent)" />
      <line x1="4" y1="18.5" x2="20" y2="18.5" />
    </Svg>
  );
}

export function MassWeightIcon({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <circle cx="12" cy="5.75" r="1.75" stroke="var(--color-accent)" />
      <path d="M6.5 8.5h11l1.25 10.5H5.25L6.5 8.5Z" />
      <line x1="9" y1="14" x2="15" y2="14" stroke="var(--color-accent)" />
    </Svg>
  );
}

export function ConcreteBeamIcon({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <rect x="6" y="4.5" width="12" height="15" rx="0.75" />
      <rect
        x="8.25"
        y="6.75"
        width="7.5"
        height="10.5"
        stroke="var(--color-accent)"
        strokeDasharray="2 2"
      />
      <circle cx="9" cy="16.75" r="1.25" fill="var(--color-accent)" stroke="var(--color-accent)" />
      <circle cx="12" cy="16.75" r="1.25" fill="var(--color-accent)" stroke="var(--color-accent)" />
      <circle cx="15" cy="16.75" r="1.25" fill="var(--color-accent)" stroke="var(--color-accent)" />
    </Svg>
  );
}

export function TimberBeamIcon({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <rect x="6" y="4.5" width="12" height="15" rx="0.75" />
      <line x1="6" y1="8.25" x2="18" y2="8.25" stroke="var(--color-accent)" />
      <line x1="6" y1="12" x2="18" y2="12" stroke="var(--color-accent)" />
      <line x1="6" y1="15.75" x2="18" y2="15.75" stroke="var(--color-accent)" />
    </Svg>
  );
}

export function SteelJointIcon({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <line x1="7.5" y1="4.5" x2="7.5" y2="19.5" />
      <line x1="10.5" y1="6" x2="10.5" y2="18" stroke="var(--color-accent)" />
      <line x1="10.5" y1="9" x2="19.5" y2="9" />
      <line x1="10.5" y1="15" x2="19.5" y2="15" />
      <line x1="5.5" y1="8" x2="12.5" y2="8" stroke="var(--color-accent)" />
      <line x1="5.5" y1="16" x2="12.5" y2="16" stroke="var(--color-accent)" />
    </Svg>
  );
}

export function VolumetricMesh({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <polygon points="4,10 13,5 20,8 20,15 11,20 4,17" />
      <polyline points="4,10 11,13 20,8" />
      <line x1="11" y1="13" x2="11" y2="20" />
    </Svg>
  );
}

export function WireframeMesh({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <circle cx="5" cy="12" r="2.25" />
      <circle cx="19" cy="12" r="2.25" />
      <line x1="7.25" y1="12" x2="16.75" y2="12" />
    </Svg>
  );
}

// ============================================================
// WORKFLOW ICONS (Step Navigation)
// ============================================================

export function IconPlus({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconTrash({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" />
    </Svg>
  );
}

export function IconFrame({ size = 22, ...props }: IconProps) {
  return <VolumetricMesh size={size} {...props} />;
}

export function IconSupport({ size = 22, ...props }: IconProps) {
  return <SupportFixed size={size} {...props} />;
}

export function IconLoad({ size = 22, ...props }: IconProps) {
  return <NodalPointLoad size={size} {...props} />;
}

export function IconResults({ size = 22, ...props }: IconProps) {
  return <SectionCut size={size} {...props} />;
}

export function IconReport({ size = 22, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <line x1="8" y1="10" x2="16" y2="10" stroke="var(--color-accent)" />
      <line x1="8" y1="14" x2="14" y2="14" stroke="var(--color-accent)" />
      <line x1="8" y1="18" x2="12" y2="18" stroke="var(--color-accent)" />
    </Svg>
  );
}

// ============================================================
// BRAND EMBLEM
// ============================================================

export function BrandEmblem({ size = 32, ...props }: IconProps) {
  return (
    <Svg size={size} {...props}>
      <defs>
        <linearGradient id="emblemGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="50%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
      </defs>
      <path
        d="M6 4h12v2.5h-4.75v11H18V20H6v-2.5h4.75v-11H6V4Z"
        fill="url(#emblemGradient)"
        stroke="var(--color-accent)"
        strokeWidth="0.75"
      />
    </Svg>
  );
}

// ============================================================
// ICON REGISTRY (for dynamic access)
// ============================================================

export const engineeringIcons = {
  // Sections
  ProfileIpe,
  ProfileHea,
  ProfileUpn,
  ProfileChs,
  ProfileRhs,
  ProfileAngle,
  // Supports
  SupportFixed,
  SupportPinned,
  SupportRoller,
  SupportSlider,
  SupportSpring,
  ReleaseHinge,
  SupportReaction,
  // Loads
  NodalPointLoad,
  UniformBeamLoad,
  TrapezoidalLoad,
  SpanPointLoad,
  TorqueMoment,
  SelfWeightGravity,
  DynamicAcceleration,
  ThermalLoadIcon,
  // CAD & EC3
  LocalAxes,
  MagneticSnap,
  MergeNodes,
  SectionCut,
  FlexuralBuckling,
  LateralTorsionalBuckling,
  DeflectionLimit,
  ModalVibration,
  LoadCombination,
  RollAngle,
  // V2
  BeamSegment,
  NodePin,
  PortalFrameIcon,
  WarrenTrussIcon,
  ContinuousBeamIcon,
  WindLoadIcon,
  SnowLoadIcon,
  MassWeightIcon,
  ConcreteBeamIcon,
  TimberBeamIcon,
  SteelJointIcon,
  VolumetricMesh,
  WireframeMesh,
  // Workflow
  IconPlus,
  IconTrash,
  IconFrame,
  IconSupport,
  IconLoad,
  IconResults,
  IconReport,
  // Brand
  BrandEmblem,
} as const;

export type EngineeringIconName = keyof typeof engineeringIcons;