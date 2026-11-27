import { t } from "@lingui/core/macro";

/**
 * EditionBadge (v2.3.0): RDM Studio is 100 % free & open-source, so the
 * header pill reads `Open Source` — no more `Découverte` / `Pro` tiers.
 * Clicking it opens the global license modal through the
 * `rdm-open-license` window event.
 */
export function LicenseBadge(): React.ReactElement {
  return (
    <button
      type="button"
      data-testid="license-badge"
      onClick={() => window.dispatchEvent(new Event("rdm-open-license"))}
      className="font-data hidden shrink-0 rounded-[2px] border border-accent bg-accent-tint px-1.5 py-0.5 text-[11px] text-accent 2xl:inline"
      aria-label={t`Open Source — 100 % gratuit`}
    >
      Open Source
    </button>
  );
}
