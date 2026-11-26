import { useState, type ReactElement } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";

/** Section family filter pills (v1.8.0 Step 1): Tous | IPE | HEA | UPN | CHS | RHS | L | Perso. */
export const FAMILY_NAMES = ["Tous", "IPE", "HEA", "UPN", "CHS", "RHS", "L", "Perso"] as const;

/** One section family name (v2.0.1: exported for the inspector filter). */
export type FamilyName = (typeof FAMILY_NAMES)[number];

export function familyOfDesignation(designation: string): FamilyName {
  const upper = designation.toUpperCase();
  if (upper.startsWith("IPE")) {
    return "IPE";
  }
  if (upper.startsWith("HEA") || upper.startsWith("HEB")) {
    return "HEA";
  }
  if (upper.startsWith("UPN")) {
    return "UPN";
  }
  if (upper.startsWith("CHS") || upper.startsWith("D")) {
    return "CHS";
  }
  if (upper.startsWith("RHS") || upper.startsWith("SHS")) {
    return "RHS";
  }
  if (upper.startsWith("L ") || upper.startsWith("INL") || upper.startsWith("ANG")) {
    return "L";
  }
  return "Perso";
}

export function FamilyPills({
  onPick,
  /** v2.1.0: controlled active family (URL-backed via the `family`
   * search param). Uncontrolled default "Tous" when omitted. */
  active: controlledActive,
}: {
  onPick: (family: (typeof FAMILY_NAMES)[number]) => void;
  active?: (typeof FAMILY_NAMES)[number];
}): ReactElement {
  const [internalActive, setActive] = useState<(typeof FAMILY_NAMES)[number]>("Tous");
  const active = controlledActive ?? internalActive;
  return (
    <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label={t`Familles de sections`}>
      {FAMILY_NAMES.map((family) => (
        <button
          key={family}
          type="button"
          aria-pressed={active === family}
          onClick={() => {
            setActive(family);
            onPick(family);
          }}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            active === family
              ? "bg-accent text-white"
              : "bg-panel-subtle text-ink-secondary hover:text-accent"
          }`}
        >
          {family === "Tous" ? (
            <Trans>Tous</Trans>
          ) : family === "Perso" ? (
            <Trans>Perso</Trans>
          ) : (
            family
          )}
        </button>
      ))}
    </div>
  );
}
