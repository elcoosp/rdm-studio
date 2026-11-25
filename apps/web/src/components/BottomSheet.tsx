import { useState, type ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { Drawer } from "vaul";
import { Trans } from "@lingui/react/macro";

/** Live `(max-width: 1023px)` subscription (v1.4.0 defect-2 pattern). */
function useIsMobile(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = globalThis.matchMedia("(max-width: 1023px)");
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => globalThis.matchMedia("(max-width: 1023px)").matches,
    () => false,
  );
}

/**
 * Mobile inspector (v1.4.0): a **non-blocking Vaul drawer** — native
 * spring physics, two snap points (35% / 78%) and a drag handle, while
 * the 3D viewport stays orbitable and the h-14 tab bar stays tappable
 * (`modal={false}` + pointer-events-none overlay). On `lg`+ the children
 * render inline as the docked left inspector (one DOM instance).
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
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(true);

  if (!isMobile) {
    return (
      <aside
        data-testid={testId}
        className="w-full shrink-0 self-start rounded-panel border border-hairline bg-panel p-4 lg:w-[320px]"
      >
        <h2 className="mb-3 text-[15px] font-semibold">{title}</h2>
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
          className="fixed inset-x-0 bottom-14 z-40 max-h-[85dvh] touch-none overflow-auto rounded-t-panel border border-hairline border-b-0 bg-panel p-4 pb-8 shadow-[0_-8px_30px_rgba(17,24,39,0.12)] md:bottom-0"
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
