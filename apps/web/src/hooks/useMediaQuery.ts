import { useSyncExternalStore } from "react";

/**
 * Reactive `matchMedia` subscription (v1.3.0 defect fix generalized):
 * split-screen windows resize continuously, so layout decisions must
 * follow live media-query events instead of mount-time snapshots.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
