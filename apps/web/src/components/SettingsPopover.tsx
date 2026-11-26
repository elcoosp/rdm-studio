import { useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Settings2 } from "lucide-react";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useProjectStore, type ModelSettingsData } from "../state/projectStore";

/**
 * Header settings popover (v2.1.2, audit `519229b` fix): migrated onto the
 * Base UI `<PopoverRoot> / <PopoverTrigger> / <PopoverContent>` portal
 * primitive + `<Switch />` toggles — the old absolutely-positioned
 * `role="dialog"` div was CLIPPED invisible behind the `<header>`; the
 * portal now opens reliably above the 3D stage. Schema-v2 fields:
 * National Annex, EN 1990 combination method, Timoshenko shear, 2D plane
 * frame and the P-Δ second-order toggle.
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
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={t`Réglages`}
        title={t`Réglages normatifs`}
        className="flex h-7 items-center gap-1 rounded-[4px] border border-hairline bg-panel px-2 text-[12px] font-medium text-ink-secondary hover:bg-panel-subtle hover:text-ink-primary"
      >
        <Settings2 size={14} strokeWidth={1.5} aria-hidden />
        <span className="hidden xl:inline">
          <Trans>Réglages</Trans>
        </span>
      </PopoverTrigger>
      <PopoverContent
        aria-label={t`Normative settings`}
        data-testid="settings-popover"
        className="w-80 p-4"
        align="end"
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
        <label className="mb-2 flex items-center justify-between gap-2 text-sm">
          <Trans>Cisaillement Timoshenko</Trans>
          <Switch
            checked={shearDeformation}
            onCheckedChange={(checked) => updateSettings({ shear_deformation: checked })}
            aria-label={t`Cisaillement Timoshenko`}
          />
        </label>
        <label className="mb-2 flex items-center justify-between gap-2 text-sm">
          <Trans>Plan 2D (Uy/Rx/Rz bloqués)</Trans>
          <Switch
            checked={planeFrame2d}
            onCheckedChange={(checked) => updateSettings({ plane_frame_2d: checked })}
            aria-label={t`Plan 2D (Uy/Rx/Rz bloqués)`}
          />
        </label>
        <label
          className="flex items-center justify-between gap-2 text-sm"
          data-testid="settings-p-delta"
        >
          <Trans>P-Δ (second ordre)</Trans>
          <Switch
            checked={pDelta}
            onCheckedChange={(checked) => updateSettings({ p_delta: checked })}
            aria-label={t`P-Δ (second ordre)`}
            data-testid="settings-p-delta-switch"
          />
        </label>
      </PopoverContent>
    </PopoverRoot>
  );
}
