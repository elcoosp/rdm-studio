import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

/**
 * Hold-Alt keycap hints (DESIGN.md §7.3 / §8.7): while Alt/Option is held,
 * toolbar controls reveal JetBrains Mono shortcut badges. A module-level
 * listener keeps every badge in sync with one keydown/keyup pair.
 */
let altHeld = false;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  const set = (value: boolean) => {
    if (altHeld !== value) {
      altHeld = value;
      for (const notify of listeners) {
        notify();
      }
    }
  };
  window.addEventListener("keydown", (e) => {
    if (e.key === "Alt") set(true);
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "Alt") set(false);
  });
  window.addEventListener("blur", () => set(false));
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export function useAltHeld(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => altHeld,
    () => false,
  );
}

export function KeycapHint({ label }: { label: string }) {
  const held = useAltHeld();
  if (!held) {
    return null;
  }
  return (
    <span
      className={cn(
        "pointer-events-none absolute -top-1.5 -right-1.5 z-20 rounded-[2px] border border-hairline bg-panel px-1 py-px font-mono text-[9px] text-ink-secondary",
      )}
      data-testid={`keycap-${label.replace(/[^a-zA-Z]/g, "")}`}
    >
      {label}
    </span>
  );
}
