import { useState, type ReactElement } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";

/** Section family filter pills (v1.8.0 Step 1): Tous | IPE | HEA | UPN | CHS | RHS | L | Perso. */
export const FAMILY_NAMES = ["Tous", "IPE", "HEA", "UPN", "CHS", "RHS", "L", "Perso"] as const;

export function familyOfDesignation(designation: string): (typeof FAMILY_NAMES)[number] {
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
}: {
  onPick: (family: (typeof FAMILY_NAMES)[number]) => void;
}): ReactElement {
  const [active, setActive] = useState<(typeof FAMILY_NAMES)[number]>("Tous");
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
              ? "bg-blue-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
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
