import { useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { ChevronUp, X } from "lucide-react";
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
 * - **`< 768 px` (true phones, v1.6.0 bug 2):** a non-blocking Vaul
 *   drawer — closed by default (v2.0.1) so the rendered
 *   `inspector-sheet-handle` trigger opens it with one plain click on
 *   both Chromium and Firefox (no pointer-drag gesture required), native
 *   spring physics, snap points starting at `0.42` (compact working
 *   position) with `0.78` expanded, a compact top-right X icon button
 *   beside the title and NO white void: the content pane is exactly the
 *   snapped slice (`h-[100dvh]` + internal scroll above the z-40 tab (v2.2.0: z-50)
 *   bar).
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
  // v2.0.1: closed by default on phones — the Drawer.Trigger handle is
  // the single open affordance, and the X icon closes it cleanly.
  const [open, setOpen] = useState(false);
  // v1.6.0: controlled snap point so the drawer OPENS at 0.42 (compact)
  // instead of vaul's default first snap, killing the empty white void.
  const [snap, setSnap] = useState<number>(0.42);

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
      snapPoints={[0.42, 0.78]}
      activeSnapPoint={snap}
      setActiveSnapPoint={(snapPoint) => setSnap(typeof snapPoint === "number" ? snapPoint : 0.42)}
      fadeFromIndex={1}
    >
      <Drawer.Trigger
        data-testid={testId ? `${testId}-handle` : undefined}
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full touch-none items-center justify-between rounded-t-panel border border-b-0 border-hairline bg-panel px-4 text-[13px] font-medium text-ink-secondary"
      >
        <span>{title}</span>
        <ChevronUp size={16} strokeWidth={1.5} aria-hidden className="text-ink-muted" />
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="pointer-events-none bg-ink-primary/15" />
        <Drawer.Content
          data-testid={testId}
          // vaul's fractional snap points translate a container-height drawer
          // by (1 - snap) × viewport, so the element itself is h-[100dvh]
          // with internal scrolling — the visible slice then matches the
          // snap exactly (0.42 → compact working pane, 0.78 → expanded).
          className="fixed inset-x-0 bottom-0 z-50 h-[100dvh] touch-none overflow-hidden rounded-t-panel border border-b-0 border-hairline bg-panel shadow-[0_-8px_30px_rgba(17,24,39,0.12)]"
        >
          <div className="flex h-full flex-col">
            <div
              className="mx-auto mt-1 h-1 w-10 shrink-0 rounded-full bg-hairline"
              data-testid="sheet-drag-handle"
              style={{ touchAction: "none" }}
            />
            <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-1 pt-1">
              <Drawer.Title className="text-[15px] font-semibold">{title}</Drawer.Title>
              {/* v1.6.0: compact top-right X close icon (was a bulky full
                  width "Fermer" button below the content). */}
              <Drawer.Close
                aria-label="Fermer le panneau"
                data-testid="sheet-close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-hairline text-ink-secondary hover:border-accent hover:text-accent"
              >
                <X size={16} strokeWidth={1.5} aria-hidden />
              </Drawer.Close>
            </div>
            {/* Zero white void: the content scrolls INSIDE the visible
                slice (flex-1 + overflow-auto), it no longer overflows a
                full-height pane with dead space below the last widget. */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-[calc(64px+env(safe-area-inset-bottom))]">
              {children}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
