import { useEffect, useMemo, useState, type ReactElement } from "react";
import { useLingui } from "@lingui/react/macro";
import { toast } from "sonner";
import { Badge } from "@rdm-studio/ui/primitives";
import { PortalFrameIcon } from "@rdm-studio/ui/icons";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { NumberFieldRoot, NumberFieldInput } from "@/components/ui/number-field";
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SegmentedControl } from "@rdm-studio/ui/interior";
import { feaClient } from "@/wasmBridge/workerClient";
import { useProjectStore } from "@/state/projectStore";
import {
  buildStructure,
  draftToProject,
  insertDraft,
  type GeneratorKind,
  type GeneratorParams,
  type Origin,
  type PolonceauParams,
  type PortalFrameParams,
  type TowerParams,
  type TrussParams,
} from "@/modeling/parametricGenerators";

/**
 * M9.3 — Bibliothèque d'ossatures paramétrées (RDM6/7 _Ossatures_ §3.10):
 * the 4 canonical generators (portique à traverse brisée / monopente,
 * treillis Pratt / Howe / Warren, ferme à entrait retroussé / Polonceau,
 * pylône treillis 3D tronconique) behind a Base UI dialog with a LIVE 2D
 * SVG wireframe preview that re-renders on every parameter change, plus
 * the two insertion modes — Replace project or Insert at origin
 * (x₀, y₀, z₀) with id remapping.
 */

const HEA_FALLBACK = ["HEA 180", "HEA 200"];
const IPE_FALLBACK = ["IPE 140", "IPE 200", "IPE 240", "IPE 300"];

const DEFAULT_PORTAL: PortalFrameParams = {
  kind: "portal",
  span: 18,
  eaveHeight: 5,
  ridgeHeight: 7,
  bays: 1,
  rafterProfile: "broken",
  frames: 1,
  frameSpacing: 6,
  columnSection: "HEA 200",
  rafterSection: "IPE 300",
  baseSupport: "fixed",
};
const DEFAULT_TRUSS: TrussParams = {
  kind: "truss",
  type: "pratt",
  span: 24,
  endHeight: 0.5,
  ridgeHeight: 3,
  panels: 8,
  chordSection: "IPE 200",
  webSection: "IPE 140",
  pinDiagonals: true,
};
const DEFAULT_POLONCEAU: PolonceauParams = {
  kind: "polonceau",
  span: 20,
  columnHeight: 6,
  riseHeight: 4,
  panels: 4,
  rafterSection: "IPE 200",
  tieSection: "IPE 240",
  columnSection: "HEA 200",
};
const DEFAULT_TOWER: TowerParams = {
  kind: "tower",
  height: 30,
  baseWidthX: 4,
  baseWidthY: 4,
  topWidthX: 1.5,
  topWidthY: 1.5,
  tiers: 5,
  bracing: "X",
  legSection: "HEA 200",
  webSection: "IPE 140",
};

interface ParamNumberFieldProps {
  label: string;
  value: number;
  onValue: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

function ParamNumberField({
  label,
  value,
  onValue,
  step = 0.5,
  min,
  max,
}: ParamNumberFieldProps): ReactElement {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="font-data text-[10px] font-medium text-ink-muted">{label}</span>
      <NumberFieldRoot
        value={value}
        step={step}
        min={min}
        max={max}
        onValueChange={(v) => {
          if (v !== null) onValue(v);
        }}
      >
        <NumberFieldInput className="font-data h-8 w-full min-w-0 px-2 text-[12px]" />
      </NumberFieldRoot>
    </label>
  );
}

function SectionPicker({
  label,
  family,
  value,
  catalog,
  onValue,
}: {
  label: string;
  family: "HEA" | "IPE";
  value: string;
  catalog: string[];
  onValue: (v: string) => void;
}): ReactElement {
  const options = catalog.filter((d) => d.startsWith(family));
  const list = options.length > 0 ? options : family === "HEA" ? HEA_FALLBACK : IPE_FALLBACK;
  const items = list.includes(value) ? list : [...list, value];
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="font-data text-[10px] font-medium text-ink-muted">{label}</span>
      <SelectRoot value={value} onValueChange={(next) => next !== null && onValue(next)}>
        <SelectTrigger className="font-data h-8 w-full min-w-0 text-[12px]" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((d) => (
            <SelectItem key={d} value={d}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    </label>
  );
}

/**
 * Live wireframe projection: face view (XZ) for planar drafts, isometric
 * for 3D ones — pure math over the draft nodes, re-derived on every
 * parameter change so the SVG stays instantaneous.
 */
function WireframePreview({ params }: { params: GeneratorParams }): ReactElement {
  const draft = useMemo(() => buildStructure(params), [params]);
  const planar = draft.nodes.every((n) => Math.abs(n.y) < 1e-9);
  const projected = useMemo(() => {
    return draft.nodes.map((n) => {
      if (planar) {
        return { id: n.id, sx: n.x, sy: n.z };
      }
      // Isometric: 30° axes, Z-up.
      return {
        id: n.id,
        sx: (n.x - n.y) * Math.cos(Math.PI / 6),
        sy: n.z + (n.x + n.y) * Math.sin(Math.PI / 6) * 0.5,
      };
    });
  }, [draft, planar]);
  const nodeById = useMemo(() => new Map(projected.map((p) => [p.id, p])), [projected]);
  const bounds = useMemo(() => {
    const xs = projected.map((p) => p.sx);
    const ys = projected.map((p) => p.sy);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const padX = Math.max((maxX - minX) * 0.08, 0.5);
    const padY = Math.max((maxY - minY) * 0.08, 0.5);
    return {
      minX: minX - padX,
      minY: minY - padY,
      w: maxX - minX + 2 * padX,
      h: maxY - minY + 2 * padY,
    };
  }, [projected]);
  const supportIds = new Set(draft.supports.map((s) => s.node_id));
  return (
    <figure
      className="flex min-h-[220px] flex-1 flex-col rounded-[8px] border border-hairline bg-canvas p-2"
      data-testid="generator-preview"
    >
      <svg
        viewBox={`${bounds.minX} ${-bounds.minY - bounds.h} ${bounds.w} ${bounds.h}`}
        className="h-full min-h-[200px] w-full"
        role="img"
        aria-label="Aperçu paramétrique"
      >
        {draft.beams.map((b) => {
          const a = nodeById.get(b.n1);
          const c = nodeById.get(b.n2);
          if (a === undefined || c === undefined) {
            return null;
          }
          return (
            <line
              key={b.id}
              x1={a.sx}
              y1={-a.sy}
              x2={c.sx}
              y2={-c.sy}
              stroke="#0F172A"
              strokeWidth={Math.max(bounds.w / 220, 1)}
              strokeLinecap="round"
            />
          );
        })}
        {projected.map((p) => (
          <circle
            key={p.id}
            cx={p.sx}
            cy={-p.sy}
            r={Math.max(bounds.w / 130, 2)}
            fill={supportIds.has(p.id) ? "#1D4ED8" : "#475569"}
          />
        ))}
      </svg>
      <figcaption className="font-data mt-1 flex items-center justify-between text-[10px] text-ink-muted">
        <span>
          {draft.nodes.length} nœuds · {draft.beams.length} poutres ·{" "}
          {planar ? "face XZ" : "isométrique"}
        </span>
        <span>{draft.name}</span>
      </figcaption>
    </figure>
  );
}

export function ParametricFrameModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): ReactElement {
  const { t } = useLingui();
  const loadProject = useProjectStore((s) => s.loadProject);
  const [kind, setKind] = useState<GeneratorKind>("portal");
  const [portal, setPortal] = useState<PortalFrameParams>(DEFAULT_PORTAL);
  const [truss, setTruss] = useState<TrussParams>(DEFAULT_TRUSS);
  const [polonceau, setPolonceau] = useState<PolonceauParams>(DEFAULT_POLONCEAU);
  const [tower, setTower] = useState<TowerParams>(DEFAULT_TOWER);
  const [origin, setOrigin] = useState<Origin>({ x: 0, y: 0, z: 0 });
  const [catalog, setCatalog] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void feaClient
      .fetchCatalog()
      .then((c) => {
        if (!cancelled) {
          setCatalog(c.sections.map((s) => s.designation));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const params: GeneratorParams =
    kind === "portal"
      ? portal
      : kind === "truss"
        ? truss
        : kind === "polonceau"
          ? polonceau
          : tower;

  const onReplace = (): void => {
    const draft = buildStructure(params);
    loadProject(draftToProject(draft));
    toast(t`Ossature générée : ${draft.name}`, {
      description: t`${draft.nodes.length} nœuds · ${draft.beams.length} poutres · projet remplacé`,
    });
    onClose();
  };

  const onInsert = (): void => {
    const draft = buildStructure(params);
    const project = useProjectStore.getState().project;
    loadProject(insertDraft(project, draft, origin));
    toast(t`Ossature insérée à (${origin.x} ; ${origin.y} ; ${origin.z}) m`, {
      description: t`${draft.nodes.length} nœuds · ${draft.beams.length} poutres ajoutés`,
    });
    onClose();
  };

  return (
    <DialogRoot open={open} onOpenChange={(next) => next || onClose()}>
      <DialogContent
        className="flex max-h-[92dvh] w-[min(96vw,860px)] flex-col gap-3 overflow-y-auto p-4"
        data-testid="parametric-generator-modal"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PortalFrameIcon size={18} />
            {t`Bibliothèque d'ossatures paramétrées`}
          </DialogTitle>
          <DialogDescription>
            {t`Générateurs RDM6/7 — portique, treillis, ferme retroussée, pylône. Aperçu mis à jour en direct.`}
          </DialogDescription>
        </DialogHeader>

        <SegmentedControl
          label="Type d'ossature"
          testId="generator-type"
          value={kind}
          onValueChange={(next) => setKind(next as GeneratorKind)}
          options={[
            { value: "portal", label: "Portique", testId: "generator-type-portal" },
            { value: "truss", label: "Treillis", testId: "generator-type-truss" },
            { value: "polonceau", label: "Ferme retroussée", testId: "generator-type-polonceau" },
            { value: "tower", label: "Pylône 3D", testId: "generator-type-tower" },
          ]}
        />

        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          <div className="flex w-full min-w-0 flex-col gap-2.5 lg:w-[340px] lg:shrink-0">
            {kind === "portal" ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <ParamNumberField
                    label="Portée L (m)"
                    value={portal.span}
                    onValue={(v) => setPortal({ ...portal, span: v })}
                    min={1}
                  />
                  <ParamNumberField
                    label="Hauteur faîtage H2 (m)"
                    value={portal.ridgeHeight}
                    onValue={(v) => setPortal({ ...portal, ridgeHeight: v })}
                    min={1}
                  />
                  <ParamNumberField
                    label="Hauteur sablière H1 (m)"
                    value={portal.eaveHeight}
                    onValue={(v) => setPortal({ ...portal, eaveHeight: v })}
                    min={1}
                  />
                  <ParamNumberField
                    label="Travées N"
                    value={portal.bays}
                    onValue={(v) => setPortal({ ...portal, bays: v })}
                    step={1}
                    min={1}
                    max={12}
                  />
                  <ParamNumberField
                    label="Portiques N (3D)"
                    value={portal.frames}
                    onValue={(v) => setPortal({ ...portal, frames: v })}
                    step={1}
                    min={1}
                    max={12}
                  />
                  <ParamNumberField
                    label="Entraxe Ly (m)"
                    value={portal.frameSpacing}
                    onValue={(v) => setPortal({ ...portal, frameSpacing: v })}
                    min={1}
                  />
                </div>
                <SegmentedControl
                  label="Traverse"
                  value={portal.rafterProfile}
                  onValueChange={(next) =>
                    setPortal({ ...portal, rafterProfile: next as "broken" | "mono" })
                  }
                  options={[
                    { value: "broken", label: "À traverse brisée" },
                    { value: "mono", label: "Monopente" },
                  ]}
                />
                <SegmentedControl
                  label="Pieds de poteaux"
                  value={portal.baseSupport}
                  onValueChange={(next) =>
                    setPortal({ ...portal, baseSupport: next as "fixed" | "pinned" })
                  }
                  options={[
                    { value: "fixed", label: "Encastrement" },
                    { value: "pinned", label: "Rotule" },
                  ]}
                />
                <div className="grid grid-cols-2 gap-2">
                  <SectionPicker
                    label="Poteaux (HEA)"
                    family="HEA"
                    value={portal.columnSection}
                    catalog={catalog}
                    onValue={(v) => setPortal({ ...portal, columnSection: v })}
                  />
                  <SectionPicker
                    label="Traverse (IPE)"
                    family="IPE"
                    value={portal.rafterSection}
                    catalog={catalog}
                    onValue={(v) => setPortal({ ...portal, rafterSection: v })}
                  />
                </div>
              </>
            ) : null}

            {kind === "truss" ? (
              <>
                <SegmentedControl
                  label="Type de treillis"
                  value={truss.type}
                  onValueChange={(next) =>
                    setTruss({ ...truss, type: next as TrussParams["type"] })
                  }
                  options={[
                    { value: "pratt", label: "Pratt" },
                    { value: "howe", label: "Howe" },
                    { value: "warren", label: "Warren" },
                  ]}
                />
                <div className="grid grid-cols-2 gap-2">
                  <ParamNumberField
                    label="Portée L (m)"
                    value={truss.span}
                    onValue={(v) => setTruss({ ...truss, span: v })}
                    min={2}
                  />
                  <ParamNumberField
                    label="Hauteur au faîte Hc (m)"
                    value={truss.ridgeHeight}
                    onValue={(v) => setTruss({ ...truss, ridgeHeight: v })}
                    min={0.5}
                  />
                  <ParamNumberField
                    label="Hauteur aux appuis H0 (m)"
                    value={truss.endHeight}
                    onValue={(v) => setTruss({ ...truss, endHeight: v })}
                    min={0}
                  />
                  <ParamNumberField
                    label="Panels N"
                    value={truss.panels}
                    onValue={(v) => setTruss({ ...truss, panels: v })}
                    step={1}
                    min={2}
                    max={50}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <SectionPicker
                    label="Membrures"
                    family="IPE"
                    value={truss.chordSection}
                    catalog={catalog}
                    onValue={(v) => setTruss({ ...truss, chordSection: v })}
                  />
                  <SectionPicker
                    label="Diagonales"
                    family="IPE"
                    value={truss.webSection}
                    catalog={catalog}
                    onValue={(v) => setTruss({ ...truss, webSection: v })}
                  />
                </div>
                <label className="flex items-center gap-2 text-[12px] text-ink-secondary">
                  <Checkbox
                    checked={truss.pinDiagonals}
                    onCheckedChange={(checked) =>
                      setTruss({ ...truss, pinDiagonals: checked === true })
                    }
                    aria-label="Articuler les diagonales"
                  />
                  {t`Articuler les diagonales (barres de treillis)`}
                </label>
              </>
            ) : null}

            {kind === "polonceau" ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <ParamNumberField
                    label="Portée L (m)"
                    value={polonceau.span}
                    onValue={(v) => setPolonceau({ ...polonceau, span: v })}
                    min={2}
                  />
                  <ParamNumberField
                    label="Flèche de ferme H2 (m)"
                    value={polonceau.riseHeight}
                    onValue={(v) => setPolonceau({ ...polonceau, riseHeight: v })}
                    min={0.5}
                  />
                  <ParamNumberField
                    label="Hauteur poteaux H1 (m)"
                    value={polonceau.columnHeight}
                    onValue={(v) => setPolonceau({ ...polonceau, columnHeight: v })}
                    min={1}
                  />
                  <ParamNumberField
                    label="Subdivisions N"
                    value={polonceau.panels}
                    onValue={(v) => setPolonceau({ ...polonceau, panels: v })}
                    step={1}
                    min={2}
                    max={50}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <SectionPicker
                    label="Poteaux (HEA)"
                    family="HEA"
                    value={polonceau.columnSection}
                    catalog={catalog}
                    onValue={(v) => setPolonceau({ ...polonceau, columnSection: v })}
                  />
                  <SectionPicker
                    label="Entrait retroussé"
                    family="IPE"
                    value={polonceau.tieSection}
                    catalog={catalog}
                    onValue={(v) => setPolonceau({ ...polonceau, tieSection: v })}
                  />
                </div>
              </>
            ) : null}

            {kind === "tower" ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <ParamNumberField
                    label="Hauteur H (m)"
                    value={tower.height}
                    onValue={(v) => setTower({ ...tower, height: v })}
                    min={2}
                  />
                  <ParamNumberField
                    label="Tronçons N"
                    value={tower.tiers}
                    onValue={(v) => setTower({ ...tower, tiers: v })}
                    step={1}
                    min={2}
                    max={30}
                  />
                  <ParamNumberField
                    label="Base Lx (m)"
                    value={tower.baseWidthX}
                    onValue={(v) => setTower({ ...tower, baseWidthX: v })}
                    min={0.5}
                  />
                  <ParamNumberField
                    label="Base Ly (m)"
                    value={tower.baseWidthY}
                    onValue={(v) => setTower({ ...tower, baseWidthY: v })}
                    min={0.5}
                  />
                  <ParamNumberField
                    label="Tête Lx (m)"
                    value={tower.topWidthX}
                    onValue={(v) => setTower({ ...tower, topWidthX: v })}
                    min={0.2}
                  />
                  <ParamNumberField
                    label="Tête Ly (m)"
                    value={tower.topWidthY}
                    onValue={(v) => setTower({ ...tower, topWidthY: v })}
                    min={0.2}
                  />
                </div>
                <SegmentedControl
                  label="Contreventement"
                  value={tower.bracing}
                  onValueChange={(next) => setTower({ ...tower, bracing: next as "X" | "K" })}
                  options={[
                    { value: "X", label: "Croix de Saint-André" },
                    { value: "K", label: "En K" },
                  ]}
                />
                <div className="grid grid-cols-2 gap-2">
                  <SectionPicker
                    label="Montants"
                    family="HEA"
                    value={tower.legSection}
                    catalog={catalog}
                    onValue={(v) => setTower({ ...tower, legSection: v })}
                  />
                  <SectionPicker
                    label="Treillis"
                    family="IPE"
                    value={tower.webSection}
                    catalog={catalog}
                    onValue={(v) => setTower({ ...tower, webSection: v })}
                  />
                </div>
              </>
            ) : null}

            <div className="grid grid-cols-3 gap-2 border-t border-hairline pt-2">
              <ParamNumberField
                label="x₀ (m)"
                value={origin.x}
                onValue={(v) => setOrigin({ ...origin, x: v })}
                step={0.5}
              />
              <ParamNumberField
                label="y₀ (m)"
                value={origin.y}
                onValue={(v) => setOrigin({ ...origin, y: v })}
                step={0.5}
              />
              <ParamNumberField
                label="z₀ (m)"
                value={origin.z}
                onValue={(v) => setOrigin({ ...origin, z: v })}
                step={0.5}
              />
            </div>
          </div>

          <WireframePreview params={params} />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline pt-2">
          <Badge size="sm" mono>
            {t`Unités SI strictes (m)`}
          </Badge>
          <button
            type="button"
            data-testid="generator-insert"
            className="rounded-[4px] border border-hairline bg-panel px-3 py-1.5 text-[12px] font-medium text-ink-secondary transition-colors hover:border-accent hover:text-accent"
            onClick={onInsert}
          >
            {t`Insérer à l'origine`}
          </button>
          <button
            type="button"
            data-testid="generator-replace"
            className="rounded-[4px] bg-accent px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-accent-strong"
            onClick={onReplace}
          >
            {t`Remplacer le projet`}
          </button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
