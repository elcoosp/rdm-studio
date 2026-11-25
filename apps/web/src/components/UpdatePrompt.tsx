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
  const wbRef = useRef<Workbox | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    const wb = new Workbox("/sw.js");
    wb.addEventListener("waiting", () => {
      setNeedRefresh(true);
    });
    wb.addEventListener("controlling", () => {
      window.location.reload();
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
      className="fixed inset-x-4 bottom-4 z-50 flex items-center justify-between gap-3 rounded-panel border border-hairline bg-panel p-3 shadow-lg"
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
