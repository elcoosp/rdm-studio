/**
 * Engineering icons needed by the marketing site — ported verbatim from
 * `apps/web/src/components/icons/EngineeringIcons.tsx` (DESIGN.md §5:
 * 24×24 optical grid, 1.5px stroke, cobalt accents on the token palette).
 */

import type { ReactNode } from "react";

type IconProps = { size?: number };

function Svg({ size, children }: IconProps & { children: ReactNode }) {
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
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function VolumetricMesh({ size = 22 }: IconProps) {
  return (
    <Svg size={size}>
      <polygon points="4,10 13,5 20,8 20,15 11,20 4,17" />
      <polyline points="4,10 11,13 20,8" />
      <line x1="11" y1="13" x2="11" y2="20" />
    </Svg>
  );
}

export function SectionCut({ size = 22 }: IconProps) {
  return (
    <Svg size={size}>
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

export function ConcreteBeamIcon({ size = 22 }: IconProps) {
  return (
    <Svg size={size}>
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

export function DynamicAcceleration({ size = 22 }: IconProps) {
  return (
    <Svg size={size}>
      <line x1="4" y1="8.5" x2="9" y2="8.5" />
      <line x1="3" y1="12" x2="8" y2="12" />
      <line x1="4" y1="15.5" x2="9" y2="15.5" />
      <line x1="10.5" y1="12" x2="20" y2="12" stroke="var(--color-accent)" />
      <polyline points="16.5,8.5 20,12 16.5,15.5" stroke="var(--color-accent)" />
    </Svg>
  );
}

export function MagneticSnap({ size = 22 }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M7.5 4.5v5a4.5 4.5 0 0 0 9 0v-5" />
      <line x1="6.5" y1="7" x2="8.5" y2="7" stroke="var(--color-accent)" />
      <line x1="15.5" y1="7" x2="17.5" y2="7" stroke="var(--color-accent)" />
      <line x1="12" y1="16.5" x2="12" y2="20.5" stroke="var(--color-accent)" />
      <line x1="10" y1="18.5" x2="14" y2="18.5" stroke="var(--color-accent)" />
    </Svg>
  );
}

export function SteelJointIcon({ size = 22 }: IconProps) {
  return (
    <Svg size={size}>
      <line x1="7.5" y1="4.5" x2="7.5" y2="19.5" />
      <line x1="10.5" y1="6" x2="10.5" y2="18" stroke="var(--color-accent)" />
      <line x1="10.5" y1="9" x2="19.5" y2="9" />
      <line x1="10.5" y1="15" x2="19.5" y2="15" />
      <line x1="5.5" y1="8" x2="12.5" y2="8" stroke="var(--color-accent)" />
      <line x1="5.5" y1="16" x2="12.5" y2="16" stroke="var(--color-accent)" />
    </Svg>
  );
}

export function PortalFrameIcon({ size = 22 }: IconProps) {
  return (
    <Svg size={size}>
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

export function WarrenTrussIcon({ size = 22 }: IconProps) {
  return (
    <Svg size={size}>
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

export function ContinuousBeamIcon({ size = 22 }: IconProps) {
  return (
    <Svg size={size}>
      <line x1="4" y1="10" x2="20" y2="10" stroke="var(--color-accent)" />
      <polygon points="5.5,10 3.5,14.5 7.5,14.5" />
      <polygon points="12,10 10,14.5 14,14.5" />
      <polygon points="18.5,10 16.5,14.5 20.5,14.5" />
      <line x1="3" y1="17" x2="21" y2="17" />
    </Svg>
  );
}
