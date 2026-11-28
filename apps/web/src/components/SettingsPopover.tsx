import { useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Settings2 } from "lucide-react";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { SegmentedControl } from "@rdm-studio/ui/interior";
import { useProjectStore, type ModelSettingsData } from "../state/projectStore";
import { LocaleSwitch } from "../routes/_studio";
import { isTelemetryOptedOut, setTelemetryOptOut, trackProductEvent } from "@/lib/productTelemetry";

export const DEFAULT_SETTINGS: ModelSettingsData = {
  national_annex: "FR",
  combination_method: "Eq610",
  shear_deformation: true,
  plane_frame_2d: false,
  p_delta: false,
};

export function SettingsPopover(): React.ReactElement {
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
  const [telemetryOptedOut, setTelemetryOptedOut] = useState(() => isTelemetryOptedOut());

  useEffect(() => {
    const openSettings = () => setOpen(true);
    window.addEventListener("rdm-open-settings", openSettings);
    return () => window.removeEventListener("rdm-open-settings", openSettings);
  }, []);

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
        className="w-[336px] space-y-3 p-3.5"
        align="end"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-medium text-ink-secondary">
            <Trans>Langue de l'interface</Trans>
          </span>
          <LocaleSwitch />
        </div>

        <div className="border-t border-hairline pt-2.5">
          <p className="mb-1.5 text-[12px] font-medium text-ink-secondary">
            <Trans>Annexe nationale</Trans>
          </p>
          <SegmentedControl
            size="sm"
            value={nationalAnnex}
            onValueChange={(next) =>
              updateSettings({ national_annex: next as ModelSettingsData["national_annex"] })
            }
            options={[
              { value: "FR", label: "FR" },
              { value: "BE", label: "BE" },
              { value: "DE", label: "DE" },
              { value: "UK", label: "UK" },
              { value: "EN", label: "EN" },
            ]}
          />
        </div>

        <div className="border-t border-hairline pt-2.5">
          <p className="mb-1.5 text-[12px] font-medium text-ink-secondary">
            <Trans>Combinaisons EN 1990</Trans>
          </p>
          <SegmentedControl
            size="sm"
            value={combinationMethod}
            onValueChange={(next) =>
              updateSettings({
                combination_method: next as ModelSettingsData["combination_method"],
              })
            }
            options={[
              { value: "Eq610", label: "6.10 (fondamentale)" },
              { value: "Eq610ab", label: "6.10a / 6.10b" },
            ]}
          />
        </div>

        <div className="space-y-2.5 border-t border-hairline pt-2.5">
          {/* M10.3: beam theory toggle — Timoshenko (shear flexible) vs
              Euler-Bernoulli, bound to `settings.shear_deformation`. */}
          <div data-testid="shear-deformation-toggle">
            <p className="mb-1.5 text-[12px] font-medium text-ink-secondary">
              <Trans>Théorie de poutre</Trans>
            </p>
            <SegmentedControl
              size="sm"
              value={shearDeformation ? "Timoshenko" : "Bernoulli"}
              onValueChange={(next) =>
                updateSettings({ shear_deformation: next === "Timoshenko" })
              }
              options={[
                { value: "Timoshenko", label: <Trans>Timoshenko</Trans> },
                { value: "Bernoulli", label: <Trans>Bernoulli</Trans> },
              ]}
            />
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-3 text-[12px] text-ink-primary">
            <span>
              <Trans>Plan 2D (Uy/Rx/Rz bloqués)</Trans>
            </span>
            <Switch
              className="shrink-0"
              checked={planeFrame2d}
              onCheckedChange={(checked) => updateSettings({ plane_frame_2d: checked })}
              aria-label={t`Plan 2D (Uy/Rx/Rz bloqués)`}
            />
          </label>
          <label
            className="flex cursor-pointer items-center justify-between gap-3 text-[12px] text-ink-primary"
            data-testid="settings-p-delta"
          >
            <span>
              <Trans>P-Δ (second ordre)</Trans>
            </span>
            <Switch
              className="shrink-0"
              checked={pDelta}
              onCheckedChange={(checked) => updateSettings({ p_delta: checked })}
              aria-label={t`P-Δ (second ordre)`}
              data-testid="settings-p-delta-switch"
            />
          </label>
        </div>

        <label
          className="flex cursor-pointer items-center justify-between gap-3 border-t border-hairline pt-2.5 text-[12px] leading-4 text-ink-secondary"
          data-testid="settings-telemetry-optout"
        >
          <span>
            <Trans>Statistiques d'usage anonymes (sans cookie)</Trans>
          </span>
          <Switch
            className="shrink-0"
            checked={!telemetryOptedOut}
            onCheckedChange={(checked) => {
              setTelemetryOptedOut(!checked);
              setTelemetryOptOut(!checked);
              trackProductEvent("optout_toggled", { enabled: !checked });
            }}
            aria-label={t`Partager les statistiques d'usage anonymes (sans cookie)`}
            data-testid="settings-telemetry-optout-switch"
          />
        </label>
      </PopoverContent>
    </PopoverRoot>
  );
}
