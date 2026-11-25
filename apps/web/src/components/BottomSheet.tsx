import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Trans } from "@lingui/react/macro";

/**
 * Mobile bottom sheet (ARCHITECTURE.md section 5, `BottomSheet.tsx`;
 * section 18 M7): on viewports below `lg` the inspector becomes a draggable
 * sheet (Motion `drag="y"`, physical spring snap); on `lg`+ the children
 * render inline as before. One DOM instance via matchMedia.
 */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => globalThis.matchMedia?.("(max-width: 1023px)").matches ?? false,
  );
  useEffect(() => {
    const query = globalThis.matchMedia("(max-width: 1023px)");
    const onChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };
    query.addEventListener("change", onChange);
    return () => {
      query.removeEventListener("change", onChange);
    };
  }, []);
  return isMobile;
}

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
    <>
      {/* Collapsed handle bar */}
      <button
        type="button"
        data-testid={testId ? `${testId}-handle` : undefined}
        className="flex min-h-11 w-full touch-none items-center justify-between rounded-t-panel border border-b-0 border-hairline bg-panel px-4 text-[13px] font-medium text-ink-secondary"
        onClick={() => setOpen(true)}
      >
        <span>{title}</span>
        <span aria-hidden className="text-ink-muted">
          ▲
        </span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            data-testid={testId}
            className="fixed inset-x-0 bottom-0 z-40 max-h-[70dvh] touch-none overflow-auto rounded-t-panel border-t border-hairline bg-panel p-4 pb-8 shadow-[0_-8px_30px_rgba(17,24,39,0.12)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 96 || info.velocity.y > 800) {
                setOpen(false);
              }
            }}
          >
            <div
              className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline"
              data-testid="sheet-drag-handle"
            />
            <h2 className="mb-3 text-[15px] font-semibold">{title}</h2>
            {children}
            <button
              type="button"
              className="mt-3 min-h-11 w-full rounded border border-hairline text-[13px] text-ink-secondary"
              onClick={() => setOpen(false)}
            >
              <Trans>Fermer</Trans>
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
