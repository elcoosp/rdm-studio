import { useMemo, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { toast } from "sonner";
import { Button } from "@rdm-studio/ui/primitives";
import { NumberFieldRoot, NumberFieldInput } from "@/components/ui/number-field";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/state/projectStore";
import { trackProductEvent } from "@/lib/productTelemetry";

/**
 * M12.3 / M12.4 — Step 1 studio panels: named member groups
 * (`Poteaux`, `Traverses`, `Diagonales`, ...), storey levels with
 * 1-click Z-elevation auto-detection, and the user-defined material
 * dialog persisted into `structure.materials` (strict SI).
 *
 * Display units: GPa / kg/m³ / MPa in the dialog (converted to Pa at the
 * boundary); store keeps m / Pa / kg/m³ per ARCHITECTURE.md §19.4.
 */

/** Named member groups over the batch selection. */
export function MemberGroupsPanel() {
  const groups = useProjectStore((s) => s.project.structure.groups);
  const upsertMemberGroup = useProjectStore((s) => s.upsertMemberGroup);
  const removeMemberGroup = useProjectStore((s) => s.removeMemberGroup);
  const batchIds = useProjectStore((s) => s.batch.selectedBeamIds);
  const beams = useProjectStore((s) => s.project.structure.beams);
  const [name, setName] = useState("");

  const batchLabel = useMemo(() => {
    if (batchIds.length === 0) {
      return t`Aucune sélection (batch)`;
    }
    return (
      batchIds
        .slice(0, 4)
        .map((id) => `P${id}`)
        .join(", ") + (batchIds.length > 4 ? ` +${batchIds.length - 4}` : "")
    );
  }, [batchIds]);

  return (
    <div
      className="mt-2 rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5"
      data-testid="member-groups-panel"
    >
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
        <Trans>Groupes de barres</Trans>
      </h3>
      <div className="flex items-center gap-1.5">
        <Input
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder={t`Poteaux, Traverses, Diagonales…`}
          className="h-8 flex-1 text-[12px]"
          data-testid="member-group-name"
        />
        <Button
          variant="outline"
          size="sm"
          data-testid="member-group-create"
          disabled={name.trim() === "" || batchIds.length === 0}
          onClick={() => {
            upsertMemberGroup(name.trim(), [...batchIds]);
            toast.success(t`Groupe « ${name.trim()} » créé sur ${batchIds.length} barre(s)`);
            void trackProductEvent("member_group_created", { members: batchIds.length });
            setName("");
          }}
        >
          <Trans>Créer depuis la sélection</Trans>
        </Button>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <button
          type="button"
          className="text-[11px] text-accent hover:underline"
          data-testid="member-group-select-all"
          onClick={() => {
            useProjectStore.getState().selectAllBeams();
          }}
        >
          <Trans>Tout sélectionner</Trans>
        </button>
        <p className="font-data text-[10px] text-ink-muted">
          {t`Sélection batch actuelle`} : {batchLabel}
        </p>
      </div>
      {(groups ?? []).length > 0 ? (
        <ul className="mt-1.5 space-y-1">
          {(groups ?? []).map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between rounded border border-hairline bg-panel px-2 py-1"
              data-testid={`member-group-${g.id}`}
            >
              <span className="text-[12px] text-ink-primary">{g.name}</span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  className="font-data text-[10px] text-ink-muted hover:text-accent"
                  onClick={() => {
                    // Batch-apply the group membership to the current selection.
                    upsertMemberGroup(g.name, [...batchIds], g.id);
                    toast.success(t`Groupe « ${g.name} » mis à jour`);
                  }}
                >
                  <Trans>affecter la sélection</Trans>
                </button>
                <span className="font-data text-[10px] text-ink-muted">{g.beam_ids.length}</span>
                <button
                  type="button"
                  aria-label={t`Supprimer le groupe`}
                  className="text-[12px] text-ink-muted hover:text-[#DC2626]"
                  onClick={() => removeMemberGroup(g.id)}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[11px] text-ink-muted">
          <Trans>
            Aucun groupe — sélectionnez plusieurs barres (Maj+clic) puis créez un groupe nommé.
          </Trans>
        </p>
      )}
      <p className="mt-1 text-[10px] text-ink-muted">
        {beams.length > 0 ? "" : <Trans>Créez d'abord des barres.</Trans>}
      </p>
    </div>
  );
}

/** Storey levels with 1-click node-Z auto-detection. */
export function StoreyLevelsPanel() {
  const nodes = useProjectStore((s) => s.project.structure.nodes);
  const levels = useProjectStore((s) => s.project.structure.levels);
  const setLevels = useProjectStore((s) => s.setLevels);
  const [newZ, setNewZ] = useState(0);
  const [newName, setNewName] = useState("");

  const detect = () => {
    const zs = [...new Set(nodes.map((n) => Number(n.z.toFixed(3))))].sort((a, b) => a - b);
    if (zs.length === 0) {
      toast.error(t`Aucun nœud à analyser`);
      return;
    }
    setLevels(zs.map((elevation, i) => ({ id: i + 1, elevation, name: undefined })));
    toast.success(t`${zs.length} niveaux détectés depuis les cotes Z des nœuds`);
    void trackProductEvent("levels_autodetected", { levels: zs.length });
  };

  return (
    <div
      className="mt-2 rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5"
      data-testid="storey-levels-panel"
    >
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
        <Trans>Niveaux (élévations Z)</Trans>
      </h3>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          data-testid="levels-autodetect"
          onClick={detect}
          disabled={nodes.length === 0}
        >
          <Trans>Détecter les niveaux (cotes Z)</Trans>
        </Button>
        <span className="flex items-center gap-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
            placeholder="R+1"
            className="h-8 w-16 text-[12px]"
            aria-label={t`Nom du niveau`}
          />
          <NumberFieldRoot
            value={newZ}
            step={0.5}
            onValueChange={(v) => {
              if (v !== null) setNewZ(v);
            }}
          >
            <NumberFieldInput
              className="font-data h-8 w-20 text-right text-[12px]"
              aria-label={t`Élévation Z (m)`}
              inputMode="decimal"
            />
          </NumberFieldRoot>
          <span className="text-[11px] text-ink-muted">m</span>
          <Button
            variant="outline"
            size="sm"
            data-testid="level-add"
            onClick={() => {
              const id = (levels ?? []).reduce((m, l) => Math.max(m, l.id), 0) + 1;
              setLevels([
                ...(levels ?? []),
                { id, elevation: newZ, name: newName.trim() === "" ? undefined : newName.trim() },
              ]);
              setNewName("");
            }}
          >
            <Trans>Ajouter</Trans>
          </Button>
        </span>
      </div>
      {(levels ?? []).length > 0 ? (
        <ul className="font-data mt-1.5 space-y-0.5 text-[11px] [font-variant-numeric:tabular-nums]">
          {[...(levels ?? [])]
            .sort((a, b) => a.elevation - b.elevation)
            .map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between border-t border-hairline py-0.5"
              >
                <span className="text-ink-primary">{l.name ?? `Niveau ${l.id}`}</span>
                <span className="flex items-center gap-2 text-ink-secondary">
                  {`Z = ${l.elevation.toFixed(2).replace(".", ",")} m`}
                  <button
                    type="button"
                    aria-label={t`Supprimer le niveau`}
                    className="text-ink-muted hover:text-[#DC2626]"
                    onClick={() => setLevels((levels ?? []).filter((x) => x.id !== l.id))}
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
        </ul>
      ) : (
        <p className="mt-1 text-[11px] text-ink-muted">
          <Trans>
            Aucun niveau — les déplacements inter-étages ne sont pas encore disponibles.
          </Trans>
        </p>
      )}
    </div>
  );
}

/** "Matériau personnalisé…" trigger + SI dialog (M12.4). */
export function CustomMaterialButton({ beamIds }: { beamIds?: number[] }) {
  const upsertCustomMaterial = useProjectStore((s) => s.upsertCustomMaterial);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [eGpa, setEGpa] = useState(200);
  const [nu, setNu] = useState(0.3);
  const [rho, setRho] = useState(7850);
  const [fyMpa, setFyMpa] = useState(235);

  // G derived from E and ν (isotropic); fu defaults to 1.35·fy.
  const gGpa = eGpa / (2 * (1 + nu));
  const fuMpa = Math.round(fyMpa * 1.35);

  return (
    <>
      <button
        type="button"
        className="mt-2 w-full rounded-[4px] border border-hairline px-2 py-1.5 text-[12px] font-medium text-ink-secondary transition-colors hover:border-accent hover:text-accent"
        data-testid="open-custom-material"
        onClick={() => setOpen(true)}
      >
        <Trans>Matériau personnalisé…</Trans>
      </button>
      <DialogRoot open={open} onOpenChange={(next) => (next ? undefined : setOpen(false))}>
        <DialogContent data-testid="custom-material-dialog" className="w-[min(420px,94vw)]">
          <DialogHeader>
            <DialogTitle>
              <Trans>Matériau personnalisé</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>
                Propriétés isotropes persistées dans la table des matériaux du projet (unités SI
                internes).
              </Trans>
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[120px_1fr_24px] items-center gap-x-2 gap-y-2">
            <label className="text-[12px] text-ink-secondary" htmlFor="cm-name">
              <Trans>Nom</Trans>
            </label>
            <Input
              id="cm-name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="S355-J2H, Alu 6060…"
              className="h-8 text-[12px]"
              data-testid="custom-material-name"
            />
            <span />
            <label className="text-[12px] text-ink-secondary" htmlFor="cm-e">
              E
            </label>
            <NumberFieldRoot
              id="cm-e"
              value={eGpa}
              min={1}
              step={1}
              onValueChange={(v) => {
                if (v !== null) setEGpa(v);
              }}
            >
              <NumberFieldInput
                className="font-data h-8 text-right text-[12px]"
                inputMode="decimal"
                data-testid="custom-material-e"
              />
            </NumberFieldRoot>
            <span className="text-[11px] text-ink-muted">GPa</span>
            <label className="text-[12px] text-ink-secondary" htmlFor="cm-nu">
              ν
            </label>
            <NumberFieldRoot
              id="cm-nu"
              value={nu}
              min={0}
              max={0.49}
              step={0.01}
              onValueChange={(v) => {
                if (v !== null) setNu(v);
              }}
            >
              <NumberFieldInput
                className="font-data h-8 text-right text-[12px]"
                inputMode="decimal"
              />
            </NumberFieldRoot>
            <span className="text-[11px] text-ink-muted">—</span>
            <label className="text-[12px] text-ink-secondary" htmlFor="cm-rho">
              ρ
            </label>
            <NumberFieldRoot
              id="cm-rho"
              value={rho}
              min={100}
              step={50}
              onValueChange={(v) => {
                if (v !== null) setRho(v);
              }}
            >
              <NumberFieldInput
                className="font-data h-8 text-right text-[12px]"
                inputMode="decimal"
              />
            </NumberFieldRoot>
            <span className="text-[11px] text-ink-muted">kg/m³</span>
            <label className="text-[12px] text-ink-secondary" htmlFor="cm-fy">
              fy
            </label>
            <NumberFieldRoot
              id="cm-fy"
              value={fyMpa}
              min={1}
              step={5}
              onValueChange={(v) => {
                if (v !== null) setFyMpa(v);
              }}
            >
              <NumberFieldInput
                className="font-data h-8 text-right text-[12px]"
                inputMode="decimal"
              />
            </NumberFieldRoot>
            <span className="text-[11px] text-ink-muted">MPa</span>
          </div>
          <p className="font-data mt-2 text-[11px] text-ink-muted">
            {`G = ${gGpa.toFixed(1).replace(".", ",")} GPa · fu ≈ ${fuMpa} MPa (1,35·fy)`}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              <Trans>Annuler</Trans>
            </Button>
            <Button
              size="sm"
              data-testid="custom-material-save"
              disabled={name.trim() === ""}
              onClick={() => {
                const props = {
                  e: eGpa * 1.0e9,
                  g: gGpa * 1.0e9,
                  nu,
                  rho,
                  fy: fyMpa * 1.0e6,
                  fu: fuMpa * 1.0e6,
                };
                upsertCustomMaterial(name.trim(), props, beamIds ?? []);
                toast.success(t`Matériau « ${name.trim()} » ajouté à la table du projet`);
                void trackProductEvent("custom_material_added", { e_gpa: eGpa });
                setOpen(false);
              }}
            >
              <Trans>Enregistrer</Trans>
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>
    </>
  );
}
