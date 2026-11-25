import { useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { Trans } from "@lingui/react/macro";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * Unified responsive inspector shell (v1.5.0, DESIGN.md §4):
 *
 * - **`md+` (≥ 768 px, including 860 px split-screen desktop windows):**
 *   the inspector renders as an inline LEFT-DOCKED `320px` `<aside>` —
 *   full height, hairline right border, zero drawer chrome, zero
 *   "Fermer" button. The mobile drawer no longer hijacks half-screen
 *   desktop windows (the old `(max-width: 1023px)` threshold forced a
 *   broken bottom sheet between 800–1023 px).
 * - **`< 768 px` (true phones):** a non-blocking Vaul drawer — native
 *   spring physics, two snap points (35% / 78%) and a drag handle, while
 *   the 3D viewport stays orbitable and the h-14 tab bar stays tappable
 *   (`modal={false}` + pointer-events-none overlay).
 */
export function BottomSheet({
  title,
  children,
  testId,
}: {
  title: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [open, setOpen] = useState(true);

  if (!isMobile) {
    return (
      <aside
        data-testid={testId}
        className="h-full w-80 shrink-0 space-y-3 overflow-y-auto border-r border-hairline bg-panel p-3"
      >
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {children}
      </aside>
    );
  }
  return (
    <Drawer.Root
      open={open}
      onOpenChange={setOpen}
      modal={false}
      snapPoints={[0.35, 0.78]}
      fadeFromIndex={1}
    >
      <Drawer.Trigger
        data-testid={testId ? `${testId}-handle` : undefined}
        className="flex min-h-11 w-full touch-none items-center justify-between rounded-t-panel border border-b-0 border-hairline bg-panel px-4 text-[13px] font-medium text-ink-secondary"
      >
        <span>{title}</span>
        <span aria-hidden className="text-ink-muted">
          ▲
        </span>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="pointer-events-none bg-ink-primary/15" />
        <Drawer.Content
          data-testid={testId}
          // vaul's fractional snap points translate a container-height drawer
          // by (1 - snap) × viewport, so the element itself is h-[100dvh]
          // with internal scrolling — the visible slice then matches the
          // snap exactly (0.35 → ~35dvh above the tab bar, 0.78 → expanded).
          className="fixed inset-x-0 bottom-0 z-30 h-[100dvh] touch-none overflow-auto rounded-t-panel border border-b-0 border-hairline bg-panel p-4 pb-16 shadow-[0_-8px_30px_rgba(17,24,39,0.12)]"
        >
          <div
            className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline"
            data-testid="sheet-drag-handle"
          />
          <Drawer.Title className="mb-3 text-[15px] font-semibold">{title}</Drawer.Title>
          {children}
          <Drawer.Close
            className="mt-3 min-h-11 w-full rounded border border-hairline text-[13px] text-ink-secondary"
            data-testid="sheet-close"
          >
            <Trans>Fermer</Trans>
          </Drawer.Close>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
