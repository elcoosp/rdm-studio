import type { ReactNode } from "react";

import { useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * Locked workstation split (v1.5.0, DESIGN.md §4 + AGENTS.md split-screen
 * contract): at `md+` (≥ 768 px, INCLUDING 860 px split-screen desktop
 * windows) the inspector docks LEFT as a fixed `w-80` (320 px) full-height
 * aside and the viewport pane fills the remaining width — no percentage
 * panels, no bottom sheet, no mobile tab bar. Below 768 px the children
 * stack for the phone layout (drawer overlay + full-bleed viewport).
 */
export function DesktopSplit({ inspector, main }: { inspector: ReactNode; main: ReactNode }) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  if (!isDesktop) {
    // Phone: main viewport FIRST at full remaining height, the drawer
    // trigger last (bottom-sheet ergonomics above the h-14 tab bar). The
    // h-full flex column keeps the 3D pane full-bleed under the header.
    return (
      <div className="flex h-full min-h-0 flex-col">
        {main}
        {inspector}
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 w-full items-stretch">
      {inspector}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{main}</div>
    </div>
  );
}
