import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, RotateCcw, Sparkles, X } from "lucide-react";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLicenseStore } from "@/state/licenseStore";

/**
 * LicenseModal (v2.1.0): inspect the plan limits of each edition, enter a
 * `RDM-PRO-…` offline key or activate a 1-click demonstration Pro. Built
 * on the Base UI `Dialog` primitive with the DESIGN.md Daylight tokens
 * (white panel, 1px #E2E8F0 hairlines, Deep Cobalt accent, zero dark
 * classes). Activation is 100 % offline — the key never leaves the device.
 */

export function LicenseModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const tier = useLicenseStore((s) => s.tier);
  const firmName = useLicenseStore((s) => s.firmName);
  const engineerName = useLicenseStore((s) => s.engineerName);
  const checkerName = useLicenseStore((s) => s.checkerName);
  const activateKey = useLicenseStore((s) => s.activateKey);
  const activateDemoPro = useLicenseStore((s) => s.activateDemoPro);
  const resetToFree = useLicenseStore((s) => s.resetToFree);
  const [keyInput, setKeyInput] = useState("");
  const [firm, setFirm] = useState(firmName);
  const [engineer, setEngineer] = useState(engineerName);
  const [checker, setChecker] = useState(checkerName);

  // i18n: the plan copy is built inside the component so every string is
  // a Lingui macro literal (extractable + translatable in en.po).
  const plans = [
    {
      id: "decouverte",
      name: t`Découverte`,
      price: "0 €",
      points: [
        t`Atelier 3D complet, 5 étapes`,
        t`Solveur Timoshenko + EC3`,
        t`Projets IndexedDB locaux`,
        t`Export PDF / CSV / .rdm`,
      ],
    },
    {
      id: "pro",
      name: t`Bureau d'Études Pro`,
      price: t`49 €/mois · Licence perpétuelle`,
      points: [
        t`Firm branding sur les notes de calcul`,
        t`Multi-matériaux EC2 / EC5 / EC8 / EC9`,
        t`BIM IFC4 / SAF`,
        t`Support prioritaire hors-ligne`,
      ],
    },
  ] as const;

  const saveBranding = () => {
    useLicenseStore.setState({ firmName: firm, engineerName: engineer, checkerName: checker });
    toast(t`Firm branding enregistré`, {
      description: t`La couverture des notes de calcul pré-remplira ces champs.`,
    });
  };

  return (
    <DialogRoot open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[86vh] overflow-auto" data-testid="license-modal">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle>
                <Trans>Licence & branding</Trans>
              </DialogTitle>
              <DialogDescription>
                <Trans>
                  RDM Studio est local-first : l'activation s'effectue hors-ligne, aucune donnée
                  n'est envoyée sur un serveur.
                </Trans>
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t`Fermer`}
              className="flex h-7 w-7 items-center justify-center rounded text-ink-secondary hover:bg-panel-subtle hover:text-ink-primary"
            >
              <X size={18} strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        </DialogHeader>

        {/* Plan limits side by side (flat hairline columns, no nested cards). */}
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => {
            const active = plan.id === "pro" ? tier === "pro" : tier === "free";
            return (
              <section
                key={plan.id}
                className={`rounded-[8px] border p-3 ${active ? "border-accent bg-accent-tint/40" : "border-hairline"}`}
                data-testid={`plan-${plan.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[14px] font-semibold text-ink-primary">{plan.name}</h3>
                  {active ? (
                    <span className="font-data rounded-[2px] border border-accent bg-accent-tint px-1.5 py-0.5 text-[10px] text-accent">
                      <Trans>Actif</Trans>
                    </span>
                  ) : null}
                </div>
                <p className="font-data mt-0.5 text-[12px] text-ink-secondary">{plan.price}</p>
                <ul className="mt-2 space-y-1">
                  {plan.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-1.5 text-[12px] text-ink-secondary"
                    >
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
            );
          })}
        </div>

        {/* Activation row: offline key OR 1-click demo. */}
        <div className="mt-3 border-t border-hairline pt-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid flex-1 gap-1 text-[12px] font-medium text-ink-secondary">
              <Trans>Clé de licence</Trans>
              <div className="flex items-center gap-1.5">
                <KeyRound size={14} strokeWidth={1.5} className="text-ink-muted" aria-hidden />
                <input
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="RDM-PRO-…"
                  spellCheck={false}
                  data-testid="license-key-input"
                  className="font-data h-8 w-full rounded-[4px] border border-hairline bg-panel px-2 text-[13px]"
                />
              </div>
            </label>
            <button
              type="button"
              data-testid="license-activate"
              className="h-8 rounded bg-accent px-3 text-[13px] font-semibold text-white hover:bg-accent-hover"
              onClick={() => {
                const result = activateKey(keyInput);
                if (result.ok) {
                  toast(t`Licence Pro activée (hors-ligne)`);
                  setKeyInput("");
                } else {
                  toast.error(t`Clé refusée`, {
                    description: t`Une clé valide commence par RDM-PRO-.`,
                  });
                }
              }}
            >
              <Trans>Activer</Trans>
            </button>
            <button
              type="button"
              data-testid="license-demo"
              className="flex h-8 items-center gap-1.5 rounded border border-accent px-3 text-[13px] font-semibold text-accent hover:bg-accent-tint"
              onClick={() => {
                activateDemoPro();
                toast(t`Démonstration Pro activée`, {
                  description: t`Toutes les fonctionnalités Pro sont débloquées sur ce poste.`,
                });
              }}
            >
              <Sparkles size={14} strokeWidth={1.5} aria-hidden />
              <Trans>Activer une démonstration Pro</Trans>
            </button>
            {tier === "pro" ? (
              <button
                type="button"
                data-testid="license-reset"
                className="flex h-8 items-center gap-1.5 rounded border border-hairline px-3 text-[13px] text-ink-secondary hover:border-accent hover:text-accent"
                onClick={() => {
                  resetToFree();
                  toast(t`Retour à l'édition Découverte`);
                }}
              >
                <RotateCcw size={14} strokeWidth={1.5} aria-hidden />
                <Trans>Réinitialiser</Trans>
              </button>
            ) : null}
          </div>
        </div>

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
                <input
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={fallback}
                  className="h-8 rounded-[4px] border border-hairline bg-panel px-2 text-[13px]"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={saveBranding}
            className="mt-2 rounded border border-accent px-3 py-1.5 text-[13px] font-semibold text-accent hover:bg-accent-tint"
          >
            <Trans>Enregistrer le branding</Trans>
          </button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
