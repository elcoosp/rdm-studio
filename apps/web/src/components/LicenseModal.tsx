import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { toast } from "sonner";
import { CheckCircle2, X } from "lucide-react";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@rdm-studio/ui/interior";
import { useLicenseStore } from "@/state/licenseStore";
import { trackProductEvent } from "@/lib/productTelemetry";

/**
 * LicenseModal (v2.3.0): open-source edition + firm report branding.
 *
 * RDM Studio is 100 % open source: the edition is free for life, unlimited,
 * zero account, zero throttling, zero cloud. This modal replaces the former
 * paid-tier / activation-key UI with a single open-source edition card and
 * the firm branding fields (Cabinet, Ingénieur, Vérificateur) that pre-fill
 * Step 5's report cover. No contradictory paywalls remain.
 */

export function LicenseModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const firmName = useLicenseStore((s) => s.firmName);
  const engineerName = useLicenseStore((s) => s.engineerName);
  const checkerName = useLicenseStore((s) => s.checkerName);
  const [firm, setFirm] = useState(firmName);
  const [engineer, setEngineer] = useState(engineerName);
  const [checker, setChecker] = useState(checkerName);

  const saveBranding = () => {
    useLicenseStore.setState({ firmName: firm, engineerName: engineer, checkerName: checker });
    toast(t`Branding enregistré`, {
      description: t`La couverture des notes de calcul pré-remplira ces champs.`,
    });
    void trackProductEvent("firm_branding_saved");
  };

  return (
    <DialogRoot open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[86vh] overflow-auto" data-testid="license-modal">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle>
                <Trans>Édition & branding</Trans>
              </DialogTitle>
              <DialogDescription>
                <Trans>
                  RDM Studio est édité en open source : l’édition est 100 % gratuite, illimitée,
                  sans compte et sans cloud. Les métadonnées ci-dessous pré-remplissent la
                  couverture de la note de calcul (étape 5).
                </Trans>
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t`Fermer`}
              className="flex h-7 w-7 items-center justify-center rounded-[4px] hover:bg-panel-subtle hover:text-ink-primary"
            >
              <X size={18} strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        </DialogHeader>

        {/* Single open-source edition — no paid tiers, no activation key. */}
        <section
          className="mt-3 border border-hairline rounded-[8px] bg-panel p-3"
          data-testid="license-edition"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-ink-primary">
              <Trans>Édition Open Source</Trans>
            </h3>
            <StatusBadge tone="accent" mono>
              <Trans>Gratuit — illimité</Trans>
            </StatusBadge>
          </div>
          <p className="font-data mt-1 text-[12px] text-ink-primary">0 €</p>
          <p className="mt-0.5 text-[12px] text-ink-secondary">
            <Trans>
              Gratuit à vie — solveur 3D Timoshenko, tous les Eurocodes, 15 modèles, tous les
              exports.
            </Trans>
          </p>
          <ul className="mt-2 space-y-1 text-[12px] text-ink-secondary">
            {[
              t`100 % du solveur poutres 3D Timoshenko (EC3, P-Δ, flambement)`,
              t`Tous les Eurocodes (EN 1990 → 1999)`,
              t`Les 15 modèles métiers (naval, levage, charpente, bois, mixte)`,
              t`Tous les exports (PDF A4, .docx, IFC4, SAF, CSV, .rdm)`,
              t`Zéro compte, zéro bridage, zéro cloud`,
            ].map((point) => (
              <li key={point} className="flex gap-1.5">
                <CheckCircle2
                  size={13}
                  strokeWidth={1.5}
                  className="mt-0.5 shrink-0 text-accent"
                  aria-hidden
                />
                {point}
              </li>
            ))}
          </ul>
        </section>

        {/* Firm branding — pre-fills Step 5's ReportBuilder cover. */}
        <div className="mt-3 border-t border-hairline pt-3">
          <h3 className="text-[13px] font-semibold text-ink-primary">
            <Trans>Branding du bureau d'études</Trans>
          </h3>
          <p className="mt-0.5 text-[12px] text-ink-secondary">
            <Trans>
              Pré-remplit la couverture A4 / .docx de l'étape 5 (cabinet, ingénieur, vérificateur).
            </Trans>
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {(
              [
                [t`Cabinet`, firm, setFirm, "Cabinet — "],
                [t`Ingénieur`, engineer, setEngineer, "Ingénieur : "],
                [t`Vérificateur`, checker, setChecker, "Vérificateur : "],
              ] as const
            ).map(([label, value, setter, fallback]) => (
              <label key={label} className="grid gap-1 text-[12px] text-ink-secondary">
                {label}
                <Input
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={fallback}
                  className="h-8 text-[13px]"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={saveBranding}
            className="mt-2 rounded-[4px] border border-accent px-3 py-1.5 text-[13px] font-semibold text-accent hover:bg-accent-tint"
          >
            <Trans>Enregistrer le branding</Trans>
          </button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
