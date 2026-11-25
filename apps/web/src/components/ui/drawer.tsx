import type { ComponentProps } from "react";
import { Drawer as VaulDrawer } from "vaul";

import { cn } from "@/lib/cn";

/**
 * Non-blocking tactile drawer (Vaul, DESIGN.md §4 mobile): snap points,
 * pointer-events-none overlay — 3D orbit and the h-14 tab bar stay live.
 */
export const DrawerRoot = VaulDrawer.Root;
export const DrawerTrigger = VaulDrawer.Trigger;
export const DrawerClose = VaulDrawer.Close;
export const DrawerTitle = VaulDrawer.Title;
export const DrawerDescription = VaulDrawer.Description;

type DrawerContentProps = ComponentProps<typeof VaulDrawer.Content> & {
  overlayClassName?: string;
};

export function DrawerContent({
  className,
  overlayClassName,
  children,
  ...props
}: DrawerContentProps) {
  return (
    <>
      <VaulDrawer.Overlay
        className={cn("pointer-events-none bg-ink-primary/15", overlayClassName)}
      />
      <VaulDrawer.Content
        className={cn(
          "fixed inset-x-0 bottom-14 z-40 rounded-t-panel border-t border-hairline bg-panel p-4 pb-8",
          className,
        )}
        {...props}
      >
        <div className="mx-auto mb-2 h-1 w-9 rounded-full border-border-subtle bg-panel-subtle" />
        {children}
      </VaulDrawer.Content>
    </>
  );
}
