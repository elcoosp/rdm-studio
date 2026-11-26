import { t } from "@lingui/core/macro";
import { useLicenseStore } from "@/state/licenseStore";

/**
 * EditionBadge (v2.1.0): compact `Dé-couverte` / `Pro` edition pill shown
 * in the studio header and the marketing header. Clicking it opens the
 * global license modal through the `rdm-open-license` window event.
 */
export function LicenseBadge(): React.ReactElement {
  const tier = useLicenseStore((s) => s.tier);
  return (
    <button
      type="button"
      data-testid="license-badge"
      onClick={() => window.dispatchEvent(new Event("rdm-open-license"))}
      className={`font-data hidden shrink-0 rounded-[2px] border px-1.5 py-0.5 text-[11px] 2xl:inline ${
        tier === "pro"
          ? "border-accent bg-accent-tint text-accent"
          : "border-hairline text-ink-muted hover:text-ink-secondary"
      }`}
      aria-label={tier === "pro" ? t`Édition Pro` : t`Édition Découverte`}
    >
      {tier === "pro" ? "Pro" : "Découverte"}
    </button>
  );
}
