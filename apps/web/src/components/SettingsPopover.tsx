import { useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { SlidersHorizontal } from "lucide-react";
import { useProjectStore, type ModelSettingsData } from "../state/projectStore";

/**
 * Header settings popover (v1.7.0/v1.8.0): National Annex, EN 1990
 * combination method, Timoshenko shear, 2D plane-frame mode and the
 * v2.0.1 P-Δ second-order toggle — all schema-v2 fields of the `.rdm`
 * settings block.
 */

/**
 * Module-level default settings (v2.0.1): stable object identity shared by
 * every selector fallback. A fresh object literal inside a zustand selector
 * loops `useSyncExternalStore` on every route render (React #185).
 */
export const DEFAULT_SETTINGS: ModelSettingsData = {
  national_annex: "FR",
  combination_method: "Eq610",
  shear_deformation: true,
  plane_frame_2d: false,
  p_delta: false,
};

export function SettingsPopover(): React.ReactElement {
  // v2.1.1: the macro `t` comes from the SUBSCRIBING useLingui() hook so
  // the aria-label re-translates the moment FR / EN flips in place.
  const { t } = useLingui();
  const nationalAnnex = useProjectStore(
    (st) => st.project.structure.settings?.national_annex ?? DEFAULT_SETTINGS.national_annex,
  );
  const combinationMethod = useProjectStore(
    (st) =>
      st.project.structure.settings?.combination_method ?? DEFAULT_SETTINGS.combination_method,
  );
  const shearDeformation = useProjectStore(
    (st) => st.project.structure.settings?.shear_deformation ?? DEFAULT_SETTINGS.shear_deformation,
  );
  const planeFrame2d = useProjectStore(
    (st) => st.project.structure.settings?.plane_frame_2d ?? DEFAULT_SETTINGS.plane_frame_2d,
  );
  const pDelta = useProjectStore(
    (st) => st.project.structure.settings?.p_delta ?? DEFAULT_SETTINGS.p_delta,
  );
  const updateSettings = useProjectStore((st) => st.updateSettings);
  const [open, setOpen] = useState(false);

  // v2.1.1: the ⌘K palette opens the normative settings via event.
  useEffect(() => {
    const openSettings = () => setOpen(true);
    window.addEventListener("rdm-open-settings", openSettings);
    return () => window.removeEventListener("rdm-open-settings", openSettings);
  }, []);

  const annexes: ModelSettingsData["national_annex"][] = ["FR", "BE", "DE", "UK", "EN"];

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t`Réglages`}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-md border border-hairline px-1.5 py-1 text-[12px] font-medium text-ink-secondary hover:bg-panel-subtle xl:px-3 xl:py-1.5 xl:text-sm"
      >
        <SlidersHorizontal size={14} strokeWidth={1.5} aria-hidden />
        <span className="hidden xl:inline">
          <Trans>Réglages</Trans>
        </span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={t`Normative settings`}
          className="absolute right-0 z-50 mt-2 w-72 rounded-lg border border-hairline bg-panel p-4 shadow-lg"
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
                    ? "bg-accent text-white"
                    : "bg-panel-subtle text-ink-secondary hover:bg-accent-tint hover:text-accent"
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
                combinationMethod === "Eq610" ? "bg-accent text-white" : "bg-panel-subtle"
              }`}
            >
              6.10
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ combination_method: "Eq610ab" })}
              className={`flex-1 rounded px-2 py-1 text-xs font-semibold ${
                combinationMethod === "Eq610ab" ? "bg-accent text-white" : "bg-panel-subtle"
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
          <label className="mb-2 flex items-center justify-between text-sm">
            <Trans>Plan 2D (Uy/Rx/Rz bloqués)</Trans>
            <input
              type="checkbox"
              checked={planeFrame2d}
              onChange={(e) => updateSettings({ plane_frame_2d: e.target.checked })}
            />
          </label>
          <label
            className="flex items-center justify-between text-sm"
            data-testid="settings-p-delta"
          >
            <Trans>P-Δ (second ordre)</Trans>
            <input
              type="checkbox"
              checked={pDelta}
              onChange={(e) => updateSettings({ p_delta: e.target.checked })}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
