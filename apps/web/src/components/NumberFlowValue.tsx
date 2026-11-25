import { useEffect, useMemo, useReducer } from "react";
import NumberFlow, { type Format } from "@number-flow/react";

/**
 * Rolling tabular telemetry (DESIGN.md §8.1): JetBrains Mono tabular-nums
 * rolling digit transitions (240 ms default) — zero-bounce precision curve.
 * The `format` object is memoized (an unstable inline object re-triggers the
 * number-flow effects every render) and the custom element mounts only
 * after `document.fonts` settle so headless font probing never races paint.
 */

let fontsReady = typeof document !== "undefined" && document.fonts?.status === "loaded";
const pending: (() => void)[] = [];
if (typeof document !== "undefined" && fontsReady !== true) {
  void document.fonts?.ready.then(() => {
    fontsReady = true;
    for (const notify of pending.splice(0)) {
      notify();
    }
  });
}

function useFontsReady(): boolean {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (fontsReady) {
      return;
    }
    pending.push(force);
    return () => {
      const i = pending.indexOf(force);
      if (i >= 0) {
        pending.splice(i, 1);
      }
    };
  }, []);
  return fontsReady;
}

export function NumberFlowValue({
  value,
  format,
  className,
  testId,
}: {
  value: number;
  /** number-flow format, e.g. `{ maximumFractionDigits: 2 }`. */
  format?: Format;
  className?: string;
  testId?: string;
}) {
  const ready = useFontsReady();
  const stableFormat = useMemo(() => JSON.stringify(format ?? {}), [format]) as string;
  const formatObj = useMemo<Format | undefined>(
    () => (stableFormat === "{}" ? undefined : (JSON.parse(stableFormat) as Format)),
    [stableFormat],
  );
  if (!ready) {
    return (
      <span
        className={className ?? "font-data [font-variant-numeric:tabular-nums]"}
        style={{ fontFamily: "var(--font-mono)" }}
        data-testid={testId}
      >
        {value.toFixed(formatObj?.maximumFractionDigits ?? 2)}
      </span>
    );
  }
  return (
    <span className={className} data-testid={testId}>
      <NumberFlow
        value={Number.isFinite(value) ? value : 0}
        format={formatObj}
        className="font-data [font-variant-numeric:tabular-nums]"
        style={{ fontFamily: "var(--font-mono)" }}
      />
    </span>
  );
}
