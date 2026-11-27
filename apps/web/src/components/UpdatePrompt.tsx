import { useEffect, useRef, useState } from "react";
import { Workbox } from "workbox-window";
import { Trans } from "@lingui/react/macro";

/**
 * PWA update prompt (ARCHITECTURE.md section 5, `UpdatePrompt.tsx`;
 * section 8.7): registers the service worker via workbox-window and offers
 * a discreet reload toast when a new worker is waiting. Also the M5
 * installability hook: `/sw.js` is registered on first visit.
 */
export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  // Mirrors the state for the "controlling" listener (stale-closure safe).
  const needRefreshRef = useRef(false);
  const wbRef = useRef<Workbox | null>(null);

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
      return;
    }
    const wb = new Workbox("/sw.js");
    wb.addEventListener("waiting", () => {
      needRefreshRef.current = true;
      setNeedRefresh(true);
    });
    // v1.5.0 defect: workbox fires "controlling" on the FIRST install too
    // (clientsClaim) — force-reloading the app mid-task wiped user state
    // and randomly interrupted flows. Reload only after an ACCEPTED update.
    wb.addEventListener("controlling", () => {
      if (needRefreshRef.current) {
        window.location.reload();
      }
    });
    void wb.register();
    wbRef.current = wb;
    return () => {
      wbRef.current = null;
    };
  }, []);

  if (!needRefresh) {
    return null;
  }
  return (
    <div
      className="fixed right-4 bottom-20 z-50 flex max-w-sm items-center justify-between gap-3 rounded-panel border border-hairline bg-panel p-3 shadow-lg md:bottom-4"
      role="status"
      data-testid="update-prompt"
    >
      <span className="text-[13px] text-ink-secondary">
        <Trans>Une nouvelle version est disponible.</Trans>
      </span>
      <button
        type="button"
        className="rounded bg-accent px-3 py-1.5 text-[13px] text-white"
        onClick={() => {
          wbRef.current?.messageSkipWaiting();
        }}
      >
        <Trans>Recharger</Trans>
      </button>
    </div>
  );
}
