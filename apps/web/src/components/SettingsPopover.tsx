import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useProjectStore, type ModelSettingsData } from "../state/projectStore";

/**
 * Header settings popover (v1.7.0/v1.8.0): National Annex, EN 1990
 * combination method, Timoshenko shear and 2D plane-frame mode — all
 * schema-v2 fields of the `.rdm` settings block.
 */

export function SettingsPopover(): React.ReactElement {
  const nationalAnnex = useProjectStore((st) => st.project.structure.settings?.national_annex ?? "FR");
  const combinationMethod = useProjectStore((st) => st.project.structure.settings?.combination_method ?? "Eq610");
  const shearDeformation = useProjectStore((st) => st.project.structure.settings?.shear_deformation ?? true);
  const planeFrame2d = useProjectStore((st) => st.project.structure.settings?.plane_frame_2d ?? false);
  const updateSettings = useProjectStore((st) => st.updateSettings);
  const [open, setOpen] = useState(false);

  const annexes: ModelSettingsData["national_annex"][] = ["FR", "BE", "DE", "UK", "EN"];

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
      >
        <Trans>Réglages normatifs</Trans>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={t`Normative settings`}
          className="absolute right-0 z-50 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <p className="mb-2 text-sm font-semibold">
            <Trans>Annexe nationale</Trans>
          </p>
          <div className="mb-3 flex flex-wrap gap-1">
            {annexes.map((annex) => (
              <button
                key={annex}
                type="button"
                onClick={() => updateSettings({ national_annex: annex })}
                className={`rounded px-2 py-1 text-xs font-semibold ${
                  nationalAnnex === annex
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                {annex}
              </button>
            ))}
          </div>
          <p className="mb-2 text-sm font-semibold">
            <Trans>Combinaisons EN 1990</Trans>
          </p>
          <div className="mb-3 flex gap-1">
            <button
              type="button"
              onClick={() => updateSettings({ combination_method: "Eq610" })}
              className={`flex-1 rounded px-2 py-1 text-xs font-semibold ${
                combinationMethod === "Eq610"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800"
              }`}
            >
              6.10
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ combination_method: "Eq610ab" })}
              className={`flex-1 rounded px-2 py-1 text-xs font-semibold ${
                combinationMethod === "Eq610ab"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800"
              }`}
            >
              6.10a/b
            </button>
          </div>
          <label className="mb-2 flex items-center justify-between text-sm">
            <Trans>Cisaillement Timoshenko</Trans>
            <input
              type="checkbox"
              checked={shearDeformation}
              onChange={(e) => updateSettings({ shear_deformation: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            <Trans>Plan 2D (Uy/Rx/Rz bloqués)</Trans>
            <input
              type="checkbox"
              checked={planeFrame2d}
              onChange={(e) => updateSettings({ plane_frame_2d: e.target.checked })}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}