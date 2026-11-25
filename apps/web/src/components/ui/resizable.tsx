import type { ComponentProps, ReactNode } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/cn";

/**
 * Draggable inspector/viewport/dock split (react-resizable-panels).
 * Handles are 1px hairlines that widen to cobalt on hover/drag.
 */
export function ResizableGroup(props: ComponentProps<typeof PanelGroup>) {
  return <PanelGroup {...props} />;
}

export function ResizablePanel(props: ComponentProps<typeof Panel>) {
  return <Panel {...props} />;
}

export function ResizableHandle({ className, ...props }: ComponentProps<typeof PanelResizeHandle>) {
  return (
    <PanelResizeHandle
      className={cn(
        "group relative w-px bg-hairline transition-colors hover:bg-accent data-[resize-handle-active]:bg-accent",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Steps 1–4 desktop shell (v1.4.0): the 320px left inspector and the 3D
 * pane become drag-resizable panels; below `lg` children stack naturally
 * in the route's flex column.
 */
export function DesktopSplit({
  inspector,
  main,
  inspectorDefault = 24,
}: {
  inspector: ReactNode;
  main: ReactNode;
  inspectorDefault?: number;
}) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  if (!isDesktop) {
    return (
      <>
        {inspector}
        {main}
      </>
    );
  }
  return (
    <ResizableGroup direction="horizontal" className="min-h-0 flex-1">
      <ResizablePanel
        defaultSize={inspectorDefault}
        minSize={14}
        maxSize={40}
        className="min-w-0 overflow-auto"
      >
        {inspector}
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={100 - inspectorDefault} className="min-w-0">
        {main}
      </ResizablePanel>
    </ResizableGroup>
  );
}
