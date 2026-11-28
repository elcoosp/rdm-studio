import { useEffect, useMemo, useRef, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { toast } from "sonner";
import { ProfileIpe } from "@rdm-studio/ui/icons";
import { CopyButton, SegmentedControl, SliderDetents, StatusBadge } from "@rdm-studio/ui/interior";
import { DialogContent, DialogHeader, DialogRoot, DialogTitle } from "@/components/ui/dialog";
import {
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot,
} from "@/components/ui/combobox";
import { NumberFieldRoot, NumberFieldInput } from "@/components/ui/number-field";
import { Input } from "@/components/ui/input";
import { feaClient, type CompositeSectionResult } from "@/wasmBridge/workerClient";
import {
  useProjectStore,
  type CompositeElementData,
  type CompositeSectionDefData,
} from "@/state/projectStore";
import { useSelectedIds } from "@/hooks/useStudioQuery";
import { trackProductEvent } from "@/lib/productTelemetry";

/**
 * M11.2 — Visual _Sections Droites_ Studio (composite built-up sections):
 * a two-column Swiss Metrology daylight dialog pairing an interactive
 * metrological SVG canvas (dimensioned mm grid, exact vector outlines with
 * rolled fillets, centroid reticle, centroidal + principal axes, dashed
 * amber plastic neutral axis and a live normal-stress diagram) with the
 * builder + telemetry column (1-click presets, NumberField steppers in
 * mm / °, steel grade SegmentedControl, tabular-nums readout with French
 * comma decimals, EN 1993-1-1 Table 5.2 class badges and TSV/JSON export).
 * _Appliquer à la barre sélectionnée_ persists the definition on the model
 * state and re-targets the active beam(s) — the WASM solver then resolves
 * the composite natively (M11.1 bridge).

 * Units: the builder inputs are mm / ° / kN (display layer); the store
 * keeps strict SI (m / rad / N) per ARCHITECTURE.md §19.4.
 */

const GRADES = ["S235", "S275", "S355", "S460"] as const;
const EMPTY_SECTIONS: CompositeSectionDefData[] = [];

/** French decimal comma formatting for the telemetry table. */
function fr(value: number, digits = 1): string {
  return value.toFixed(digits).replace(".", ",");
}

/** M11.2 one-click presets: canonical built-ups, SI metres. */
const PRESETS: { slug: string; label: string; build: () => CompositeSectionDefData }[] = [
  {
    slug: "prs-symetrique",
    label: t`PRS symétrique`,
    build: () => ({
      name: "PRS 300",
      grade: "S355",
      elements: [
        plate(0.25, 0.012, 0, 0.144),
        plate(0.25, 0.012, 0, -0.144),
        plate(0.276, 0.008, 0, 0, Math.PI / 2),
      ],
    }),
  },
  {
    slug: "caisson-soude",
    label: t`Caisson soudé`,
    build: () => ({
      name: "Caisson 200x300",
      grade: "S355",
      elements: [
        plate(0.3, 0.01, -0.095, 0, Math.PI / 2),
        plate(0.3, 0.01, 0.095, 0, Math.PI / 2),
        plate(0.2, 0.01, 0, 0.145),
        plate(0.2, 0.01, 0, -0.145),
      ],
    }),
  },
  {
    slug: "2upn-dos-a-dos",
    label: t`2×UPN dos-à-dos`,
    build: () => ({
      name: "2UPN 200",
      grade: "S355",
      elements: [
        // Backs 10 mm apart: the channel centroid sits e = 21,6 mm from the
        // web back face (EN 10365 UPN 200), so dy = ±(e − g/2).
        element({ kind: "profile", designation: "UPN 200" }, -0.01664, 0, 0, true, false),
        element({ kind: "profile", designation: "UPN 200" }, 0.01664, 0, 0, false, false),
      ],
    }),
  },
  {
    slug: "ipe-platine-semelle",
    label: t`IPE + platine semelle`,
    build: () => ({
      name: "IPE 300 renforcé",
      grade: "S355",
      elements: [
        element({ kind: "profile", designation: "IPE 300" }, 0, 0, 0, false, false),
        plate(0.2, 0.01, 0, 0.155),
        plate(0.2, 0.01, 0, -0.155),
      ],
    }),
  },
  {
    slug: "hea-upn-roulement",
    label: t`Chemin de roulement HEA+UPN`,
    build: () => ({
      name: "Chemin de roulement",
      grade: "S355",
      elements: [
        element({ kind: "profile", designation: "HEA 200" }, 0, 0, 0, false, false),
        element({ kind: "profile", designation: "UPN 200" }, 0, 0.195, 0, false, false),
      ],
    }),
  },
];

/** Horizontal plate helper (length along y, thickness along z, metres). */
function plate(
  length: number,
  thickness: number,
  dy: number,
  dz: number,
  theta = 0,
): CompositeElementData {
  return element({ kind: "plate", length, thickness }, dy, dz, theta, false, false);
}

function element(
  kind: CompositeElementData["kind"],
  dy: number,
  dz: number,
  theta: number,
  mirrorY: boolean,
  mirrorZ: boolean,
): CompositeElementData {
  return { kind, dy, dz, theta, mirror_y: mirrorY, mirror_z: mirrorZ };
}

/** Human label of one sub-element (mm, French comma). */
function elementLabel(el: CompositeElementData): string {
  switch (el.kind.kind) {
    case "plate":
      return `Platine ${fr(el.kind.length * 1000, 0)}×${fr(el.kind.thickness * 1000, 1)}`;
    case "profile":
      return el.kind.designation;
    case "chs":
      return `CHS ${fr(el.kind.diameter * 1000, 1)}×${fr(el.kind.thickness * 1000, 1)}`;
    case "rhs":
      return `RHS ${fr(el.kind.height * 1000, 0)}×${fr(el.kind.width * 1000, 0)}×${fr(el.kind.thickness * 1000, 1)}`;
  }
}

export function CompositeSectionStudio({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const customSections = useProjectStore(
    (s) => s.project.structure.custom_sections ?? EMPTY_SECTIONS,
  );
  const upsertCompositeSection = useProjectStore((s) => s.upsertCompositeSection);
  const batchIds = useProjectStore((s) => s.batch.selectedBeamIds);
  const { beamId } = useSelectedIds();
  const [def, setDef] = useState<CompositeSectionDefData>(
    () =>
      PRESETS[0]?.build() ?? {
        name: "PRS 300",
        grade: "S355",
        elements: [plate(0.25, 0.012, 0, 0.144)],
      },
  );
  const [result, setResult] = useState<CompositeSectionResult | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [stressNkN, setStressNkN] = useState<number>(-100);
  const [stressMykNm, setStressMykNm] = useState<number>(20);
  const [selectedElement, setSelectedElement] = useState<number>(0);
  const [designations, setDesignations] = useState<string[]>([]);
  // Latest-wins guard for the debounced engine preview.
  const previewToken = useRef(0);

  useEffect(() => {
    void feaClient.fetchCatalog().then((c) => {
      setDesignations(c.sections.map((s) => s.designation));
    });
  }, []);

  // Debounced exact re-computation through the WASM engine (150 ms).
  useEffect(() => {
    if (!open) {
      return;
    }
    const token = ++previewToken.current;
    const timer = setTimeout(() => {
      void feaClient
        .computeCompositeSection(JSON.stringify(def))
        .then((res) => {
          if (previewToken.current === token) {
            setResult(res);
            setEngineError(null);
          }
        })
        .catch((err: unknown) => {
          if (previewToken.current === token) {
            setResult(null);
            setEngineError(err instanceof Error ? err.message : String(err));
          }
        });
    }, 150);
    return () => {
      clearTimeout(timer);
    };
  }, [def, open]);

  const patchElement = (index: number, patch: Partial<CompositeElementData>): void => {
    setDef((prev) => ({
      ...prev,
      elements: prev.elements.map((el, i) => (i === index ? { ...el, ...patch } : el)),
    }));
  };

  const patchElementKind = (index: number, kind: CompositeElementData["kind"]): void => {
    setDef((prev) => ({
      ...prev,
      elements: prev.elements.map((el, i) => (i === index ? { ...el, kind } : el)),
    }));
  };

  const addElement = (kind: CompositeElementData["kind"]): void => {
    setDef((prev) => ({
      ...prev,
      elements: [
        ...prev.elements,
        element(kind, 0, (prev.elements.length + 1) * 0.08, 0, false, false),
      ],
    }));
    setSelectedElement(def.elements.length);
  };

  const removeElement = (index: number): void => {
    setDef((prev) => {
      if (prev.elements.length <= 1) {
        return prev;
      }
      return { ...prev, elements: prev.elements.filter((_, i) => i !== index) };
    });
    setSelectedElement(0);
  };

  const activeBeamIds = useMemo(() => {
    if (batchIds.length > 0) {
      return batchIds;
    }
    return beamId !== null ? [beamId] : [];
  }, [batchIds, beamId]);

  const apply = async (): Promise<void> => {
    if (activeBeamIds.length === 0) {
      return;
    }
    await upsertCompositeSection(def, activeBeamIds);
    void trackProductEvent("composite_section_applied", {
      beams: activeBeamIds.length,
      elements: def.elements.length,
    });
    toast.info(t`Section « ${def.name} » appliquée à ${activeBeamIds.length} barre(s)`, {
      description: t`Le solveur WASM recalcule avec les propriétés exactes de la section composée.`,
      duration: 4_000,
    });
    onOpenChange(false);
  };

  // TSV / JSON exports of the exact engine telemetry.
  const tsv = useMemo(() => {
    if (result === null) return "";
    const rows: string[][] = [
      ["Grandeur", "Valeur", "Unité"],
      ["A", fr(result.a * 1e6, 0), "mm²"],
      ["m", fr(result.mass_per_m, 1), "kg/m"],
      ["yG", fr(result.y_g * 1000, 2), "mm"],
      ["zG", fr(result.z_g * 1000, 2), "mm"],
      ["Iy", fr(result.iy * 1e8, 1), "cm⁴"],
      ["Iz", fr(result.iz * 1e8, 1), "cm⁴"],
      ["Iyz", fr(result.iyz * 1e8, 1), "cm⁴"],
      ["alpha", fr((result.alpha_rad * 180) / Math.PI, 2), "°"],
      ["Wel,y", fr(result.wel_y * 1e6, 1), "cm³"],
      ["Wpl,y", fr(result.wpl_y * 1e6, 1), "cm³"],
      ["iy", fr(result.i_radius_y * 1000, 1), "mm"],
      ["iz", fr(result.i_radius_z * 1000, 1), "mm"],
      ["It", fr(result.it * 1e8, 1), "cm⁴"],
      ["Iw", fr(result.iw * 1e12, 2), "cm⁶"],
      ["Av,y", fr(result.a_vy * 1e6, 0), "mm²"],
      ["Av,z", fr(result.a_vz * 1e6, 0), "mm²"],
      ["Classe flexion", String(result.class_bending), ""],
      ["Classe compression", String(result.class_compression), ""],
    ];
    return rows.map((r) => r.join("\t")).join("\n");
  }, [result]);

  if (!open) {
    return <span />;
  }

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[min(1060px,94vw)] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-hairline px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-semibold text-ink-primary">
            <ProfileIpe size={18} />
            <Trans>Studio Sections Composées</Trans>
            <span className="font-data text-[11px] font-normal text-ink-muted">
              <Trans>Sections droites — mécanique exacte EN 1993-1-1</Trans>
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1.15fr_1fr] lg:overflow-hidden">
          {/* Left column — interactive metrological SVG canvas. */}
          <div className="border-hairline p-3 lg:border-r lg:overflow-y-auto">
            <CompositeCanvas
              result={result}
              error={engineError}
              stressNkN={stressNkN}
              stressMykNm={stressMykNm}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-ink-secondary">
                  <Trans>Effort normal N (kN)</Trans>
                </span>
                <NumberFieldRoot
                  value={stressNkN}
                  step={5}
                  onValueChange={(v) => {
                    if (v !== null) setStressNkN(v);
                  }}
                >
                  <NumberFieldInput
                    className="font-data h-8 w-full"
                    aria-label="N kN"
                    data-testid="composite-stress-n"
                  />
                </NumberFieldRoot>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-ink-secondary">
                  <Trans>Moment My (kN·m)</Trans>
                </span>
                <NumberFieldRoot
                  value={stressMykNm}
                  step={5}
                  onValueChange={(v) => {
                    if (v !== null) setStressMykNm(v);
                  }}
                >
                  <NumberFieldInput
                    className="font-data h-8 w-full"
                    aria-label="My kNm"
                    data-testid="composite-stress-my"
                  />
                </NumberFieldRoot>
              </label>
            </div>
            <SliderDetents
              value={stressMykNm}
              onValueChange={setStressMykNm}
              min={-100}
              max={100}
              step={5}
              detents={[-100, -50, 0, 50, 100]}
              label={t`Diagramme de contrainte My`}
              className="mt-2"
              formatValue={(v) => `${fr(v, 0)} kN·m`}
            />
          </div>

          {/* Right column — builder & telemetry. */}
          <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto p-3">
            {/* 1-click presets. */}
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-ink-secondary">
                <Trans>Gabarits (1 clic)</Trans>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.slug}
                    type="button"
                    data-testid={`composite-preset-${preset.slug}`}
                    className={`rounded-[4px] border px-2 py-1 text-[12px] font-medium transition-colors ${
                      def.name === preset.build().name
                        ? "border-accent bg-accent-tint text-accent"
                        : "border-hairline bg-panel text-ink-secondary hover:border-accent hover:text-accent"
                    }`}
                    onClick={() => {
                      const next = preset.build();
                      setDef(next);
                      setSelectedElement(0);
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Section name + steel grade. */}
            <div className="grid grid-cols-[110px_1fr] items-center gap-x-2 gap-y-2">
              <label className="text-xs font-medium text-ink-secondary" htmlFor="composite-name">
                <Trans>Nom de la section</Trans>
              </label>
              <Input
                id="composite-name"
                value={def.name}
                onChange={(e) => setDef((prev) => ({ ...prev, name: e.currentTarget.value }))}
                className="font-data h-8"
                data-testid="composite-name"
              />
              <span className="text-xs font-medium text-ink-secondary">
                <Trans>Acier</Trans>
              </span>
              <SegmentedControl
                testId="composite-grade"
                label={t`Nuance d'acier`}
                size="sm"
                value={def.grade}
                onValueChange={(next) => {
                  setDef((prev) => ({
                    ...prev,
                    grade: next as CompositeSectionDefData["grade"],
                  }));
                }}
                options={GRADES.map((grade) => ({ value: grade, label: grade }))}
              />
            </div>

            {/* Sub-element list. */}
            <div>
              <p className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-ink-secondary">
                <Trans>Éléments constitutifs</Trans>
                <span className="font-data text-[10px] text-ink-muted">
                  {def.elements.length} élément(s)
                </span>
              </p>
              <div className="space-y-1.5">
                {def.elements.map((el, index) => (
                  <div
                    key={index}
                    className={`rounded-[6px] border p-2 ${
                      selectedElement === index
                        ? "border-accent bg-accent-tint/40"
                        : "border-hairline bg-panel"
                    }`}
                    data-testid={`composite-element-${index}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        className="font-data min-w-0 flex-1 truncate text-left text-[12px] font-medium text-ink-primary"
                        onClick={() => setSelectedElement(index)}
                      >
                        {elementLabel(el)}
                      </button>
                      <button
                        type="button"
                        aria-label={t`Miroir y`}
                        aria-pressed={el.mirror_y}
                        className={`rounded border px-1.5 py-0.5 font-data text-[10px] ${
                          el.mirror_y
                            ? "border-accent bg-accent-tint text-accent"
                            : "border-hairline text-ink-secondary"
                        }`}
                        onClick={() => patchElement(index, { mirror_y: !el.mirror_y })}
                      >
                        miroir y
                      </button>
                      <button
                        type="button"
                        aria-label={t`Miroir z`}
                        aria-pressed={el.mirror_z}
                        className={`rounded border px-1.5 py-0.5 font-data text-[10px] ${
                          el.mirror_z
                            ? "border-accent bg-accent-tint text-accent"
                            : "border-hairline text-ink-secondary"
                        }`}
                        onClick={() => patchElement(index, { mirror_z: !el.mirror_z })}
                      >
                        miroir z
                      </button>
                      <button
                        type="button"
                        aria-label={t`Supprimer l'élément`}
                        data-testid={`composite-remove-${index}`}
                        className="rounded border border-hairline px-1.5 py-0.5 text-[10px] text-ink-secondary hover:border-red-500 hover:text-red-500"
                        onClick={() => removeElement(index)}
                      >
                        ×
                      </button>
                    </div>
                    {selectedElement === index ? (
                      <ElementEditor
                        index={index}
                        el={el}
                        designations={designations}
                        patchElement={patchElement}
                        patchElementKind={patchElementKind}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  data-testid="composite-add-plate"
                  className="rounded-[4px] border border-hairline bg-panel px-2 py-1 text-[12px] text-ink-secondary hover:border-accent hover:text-accent"
                  onClick={() => addElement({ kind: "plate", length: 0.2, thickness: 0.01 })}
                >
                  + <Trans>Platine</Trans>
                </button>
                <button
                  type="button"
                  data-testid="composite-add-profile"
                  className="rounded-[4px] border border-hairline bg-panel px-2 py-1 text-[12px] text-ink-secondary hover:border-accent hover:text-accent"
                  onClick={() => addElement({ kind: "profile", designation: "IPE 200" })}
                >
                  + <Trans>Profilé</Trans>
                </button>
                <button
                  type="button"
                  data-testid="composite-add-chs"
                  className="rounded-[4px] border border-hairline bg-panel px-2 py-1 text-[12px] text-ink-secondary hover:border-accent hover:text-accent"
                  onClick={() => addElement({ kind: "chs", diameter: 0.1143, thickness: 0.006 })}
                >
                  + CHS
                </button>
                <button
                  type="button"
                  data-testid="composite-add-rhs"
                  className="rounded-[4px] border border-hairline bg-panel px-2 py-1 text-[12px] text-ink-secondary hover:border-accent hover:text-accent"
                  onClick={() =>
                    addElement({ kind: "rhs", height: 0.2, width: 0.1, thickness: 0.008 })
                  }
                >
                  + RHS
                </button>
              </div>
            </div>

            {/* Telemetry readout. */}
            <CompositeTelemetry result={result} error={engineError} tsv={tsv} />

            {/* Apply to the active beam(s) — triggers the WASM re-solve. */}
            <button
              type="button"
              data-testid="apply-composite-section"
              className="w-full rounded-[4px] bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-40"
              disabled={activeBeamIds.length === 0 || result === null}
              onClick={apply}
            >
              {activeBeamIds.length > 0
                ? t`Appliquer à la barre sélectionnée (${activeBeamIds.length})`
                : t`Sélectionnez une barre pour appliquer`}
            </button>
            {customSections.length > 0 ? (
              <p className="font-data text-[10px] text-ink-muted">
                {customSections.length} section(s) personnalisée(s) dans le modèle —{" "}
                {customSections.map((d) => d.name).join(", ")}
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}

/** Per-element editing fields (mm / ° steppers, designation combobox). */
function ElementEditor({
  index,
  el,
  designations,
  patchElement,
  patchElementKind,
}: {
  index: number;
  el: CompositeElementData;
  designations: string[];
  patchElement: (index: number, patch: Partial<CompositeElementData>) => void;
  patchElementKind: (index: number, kind: CompositeElementData["kind"]) => void;
}): React.ReactElement {
  // Const capture keeps the discriminant narrowing alive inside callbacks.
  const kind = el.kind;
  const mmField = (
    label: string,
    value: number,
    onValue: (mm: number) => void,
    step = 1,
    testId?: string,
  ): React.ReactElement => (
    <label className="flex flex-col gap-0.5">
      <span className="font-data text-[10px] text-ink-muted">{label}</span>
      <NumberFieldRoot
        value={Math.round(value * 1000 * 100) / 100}
        step={step}
        onValueChange={(v) => {
          if (v !== null) onValue(v / 1000);
        }}
      >
        <NumberFieldInput
          className="font-data h-7 w-full min-w-0 px-1.5 text-[12px]"
          aria-label={label}
          data-testid={testId}
        />
      </NumberFieldRoot>
    </label>
  );

  return (
    <div className="mt-2 space-y-2 border-t border-hairline pt-2">
      <div className="grid grid-cols-3 gap-1.5">
        {mmField(
          "Δy (mm)",
          el.dy,
          (mm) => patchElement(index, { dy: mm }),
          1,
          `composite-dy-${index}`,
        )}
        {mmField(
          "Δz (mm)",
          el.dz,
          (mm) => patchElement(index, { dz: mm }),
          1,
          `composite-dz-${index}`,
        )}
        <label className="flex flex-col gap-0.5">
          <span className="font-data text-[10px] text-ink-muted">θ (°)</span>
          <NumberFieldRoot
            value={Math.round((el.theta * 180) / Math.PI)}
            step={5}
            onValueChange={(v) => {
              if (v !== null) patchElement(index, { theta: (v * Math.PI) / 180 });
            }}
          >
            <NumberFieldInput
              className="font-data h-7 w-full min-w-0 px-1.5 text-[12px]"
              aria-label="theta deg"
              data-testid={`composite-theta-${index}`}
            />
          </NumberFieldRoot>
        </label>
      </div>
      {kind.kind === "plate" ? (
        <div className="grid grid-cols-2 gap-1.5">
          {mmField(
            "Longueur b (mm)",
            kind.length,
            (mm) =>
              patchElementKind(index, { kind: "plate", length: mm, thickness: kind.thickness }),
            5,
            `composite-plate-length-${index}`,
          )}
          {mmField(
            "Épaisseur t (mm)",
            kind.thickness,
            (mm) => patchElementKind(index, { kind: "plate", length: kind.length, thickness: mm }),
            1,
            `composite-plate-thickness-${index}`,
          )}
        </div>
      ) : null}
      {kind.kind === "profile" ? (
        <ComboboxRoot
          items={designations}
          value={kind.designation}
          onValueChange={(next: string | null) => {
            if (next !== null) {
              patchElementKind(index, { kind: "profile", designation: next });
            }
          }}
        >
          <ComboboxInput className="h-7" aria-label="Désignation EN" />
          <ComboboxContent
            className="min-w-[260px]"
            renderItem={(designation: string) => (
              <ComboboxItem key={designation} value={designation}>
                <span className="font-data flex-1">{designation}</span>
              </ComboboxItem>
            )}
          >
            <ComboboxEmpty>Aucun profilé</ComboboxEmpty>
          </ComboboxContent>
        </ComboboxRoot>
      ) : null}
      {kind.kind === "chs" ? (
        <div className="grid grid-cols-2 gap-1.5">
          {mmField(
            "Diamètre d (mm)",
            kind.diameter,
            (mm) =>
              patchElementKind(index, { kind: "chs", diameter: mm, thickness: kind.thickness }),
            5,
          )}
          {mmField(
            "Épaisseur t (mm)",
            kind.thickness,
            (mm) =>
              patchElementKind(index, { kind: "chs", diameter: kind.diameter, thickness: mm }),
            1,
          )}
        </div>
      ) : null}
      {kind.kind === "rhs" ? (
        <div className="grid grid-cols-3 gap-1.5">
          {mmField(
            "Hauteur h (mm)",
            kind.height,
            (mm) =>
              patchElementKind(index, {
                kind: "rhs",
                height: mm,
                width: kind.width,
                thickness: kind.thickness,
              }),
            5,
          )}
          {mmField(
            "Largeur b (mm)",
            kind.width,
            (mm) =>
              patchElementKind(index, {
                kind: "rhs",
                height: kind.height,
                width: mm,
                thickness: kind.thickness,
              }),
            5,
          )}
          {mmField(
            "Épaisseur t (mm)",
            kind.thickness,
            (mm) =>
              patchElementKind(index, {
                kind: "rhs",
                height: kind.height,
                width: kind.width,
                thickness: mm,
              }),
            1,
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The metrological canvas: exact vector outlines, dimensioned mm grid,
 * centroid reticle + axes, principal axes, dashed amber ANP and the live
 * normal-stress diagram σ(z) = N/A + My/Iy·z.
 */
function CompositeCanvas({
  result,
  error,
  stressNkN,
  stressMykNm,
}: {
  result: CompositeSectionResult | null;
  error: string | null;
  stressNkN: number;
  stressMykNm: number;
}): React.ReactElement {
  if (result === null) {
    return (
      <div
        className="flex h-64 items-center justify-center rounded-[8px] border border-hairline bg-panel-subtle text-[12px] text-ink-muted"
        data-testid="composite-section-svg"
      >
        {error !== null ? error : <Trans>Calcul en cours…</Trans>}
      </div>
    );
  }
  // mm space, y right / z up (SVG y = −z).
  const [yMin, yMax, zMin, zMax] = result.bounds;
  const pad = 18;
  const diagramWidth = 64;
  const spanY = yMax * 1000 - yMin * 1000;
  const spanZ = zMax * 1000 - zMin * 1000;
  const vbW = Math.max(spanY, 120) + pad * 2 + diagramWidth;
  const vbH = Math.max(spanZ, 120) + pad * 2;
  const xOf = (yMm: number): number => yMm - yMin * 1000 + pad;
  const yOf = (zMm: number): number => vbH - pad - (zMm - zMin * 1000);

  const stressMy = stressMykNm * 1000;
  const stressN = stressNkN * 1000;
  const sigma = (zMm: number): number => stressN / result.a + (stressMy / result.iy) * zMm;
  const sigmaTop = sigma(zMax * 1000);
  const sigmaBot = sigma(zMin * 1000);
  const sigmaAbsMax = Math.max(Math.abs(sigmaTop), Math.abs(sigmaBot), 1);
  const kScale = (diagramWidth * 0.72) / sigmaAbsMax;
  // Neutral fibre z0 where sigma = 0 (My ≠ 0).
  const z0 = stressMy !== 0 ? (-stressN * result.iy) / (stressMy * result.a) : null;
  const x0 = xOf(yMax * 1000) + 20;

  // Principal axes through the centroid (rotated by alpha from y).
  const alpha = result.alpha_rad;
  const span = Math.max(spanY, spanZ) * 0.6;
  const centY = xOf(result.y_g * 1000);
  const centZ = yOf(result.z_g * 1000);
  const gridStep = 50; // mm
  const gridLines: React.ReactElement[] = [];
  const yStartMm = Math.ceil((yMin * 1000) / gridStep) * gridStep;
  for (let yMm = yStartMm; yMm <= yMax * 1000; yMm += gridStep) {
    gridLines.push(
      <line key={`gv${yMm}`} x1={xOf(yMm)} y1={pad / 2} x2={xOf(yMm)} y2={vbH - pad / 2} />,
    );
  }
  const zStartMm = Math.ceil((zMin * 1000) / gridStep) * gridStep;
  for (let zMm = zStartMm; zMm <= zMax * 1000; zMm += gridStep) {
    gridLines.push(
      <line key={`gh${zMm}`} x1={pad / 2} y1={yOf(zMm)} x2={xOf(yMax * 1000) + 8} y2={yOf(zMm)} />,
    );
  }

  return (
    <figure
      className="rounded-[8px] border border-hairline bg-canvas p-2"
      data-testid="composite-section-svg"
    >
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        className="h-72 w-full"
        role="img"
        aria-label={t`Coupe composée — grille millimétrique`}
      >
        {/* Dimensioned millimetre grid. */}
        <g stroke="#E2E8F0" strokeWidth="0.5">
          {gridLines}
        </g>
        {/* Sub-element outlines (exact engine vectors, fillets included). */}
        <g stroke="#1D4ED8" fill="#EFF6FF" strokeWidth="1" strokeLinejoin="round">
          {result.elements.map((element) =>
            element.paths.map((path, pathIndex) => (
              <polygon
                key={`${element.label}-${pathIndex}`}
                points={path.map((pt) => `${xOf(pt[0] * 1000)},${yOf(pt[1] * 1000)}`).join(" ")}
              />
            )),
          )}
        </g>
        {/* Centroidal axes y / z through G. */}
        <g stroke="#475569" strokeWidth="0.75" strokeDasharray="6 3">
          <line x1={pad / 2} y1={centZ} x2={x0 - 8} y2={centZ} />
          <line x1={centY} y1={pad / 2} x2={centY} y2={vbH - pad / 2} />
        </g>
        {/* Principal axes u / v (rotated by alpha). */}
        <g stroke="#7C3AED" strokeWidth="0.9" strokeDasharray="2 2.5">
          <line
            x1={centY - span * Math.cos(alpha)}
            y1={centZ + span * Math.sin(alpha)}
            x2={centY + span * Math.cos(alpha)}
            y2={centZ - span * Math.sin(alpha)}
          />
          <line
            x1={centY + span * Math.sin(alpha)}
            y1={centZ + span * Math.cos(alpha)}
            x2={centY - span * Math.sin(alpha)}
            y2={centZ - span * Math.cos(alpha)}
          />
        </g>
        {/* Dashed amber plastic neutral axis (ANP, equal-area bisection). */}
        <line
          x1={pad / 2}
          y1={yOf(result.pna_for_my * 1000)}
          x2={x0 - 8}
          y2={yOf(result.pna_for_my * 1000)}
          stroke="#D97706"
          strokeWidth="1.1"
          strokeDasharray="4 3"
        />
        {/* Centroid reticle G(yG, zG). */}
        <g stroke="#0F172A" strokeWidth="1">
          <circle cx={centY} cy={centZ} r="4.5" fill="#FFFFFF" />
          <line x1={centY - 7} y1={centZ} x2={centY + 7} y2={centZ} />
          <line x1={centY} y1={centZ - 7} x2={centY} y2={centZ + 7} />
        </g>
        <text x={centY + 9} y={centZ - 6} fontSize="9" fill="#0F172A" className="font-data">
          G({fr(result.y_g * 1000, 1)} ; {fr(result.z_g * 1000, 1)})
        </text>
        {/* Live normal-stress diagram sigma(z) beside the section. */}
        <g>
          <line
            x1={x0}
            y1={yOf(zMax * 1000)}
            x2={x0}
            y2={yOf(zMin * 1000)}
            stroke="#94A3B8"
            strokeWidth="0.75"
          />
          <polygon
            points={[
              [x0, yOf(zMax * 1000)],
              [x0 + kScale * sigmaTop, yOf(zMax * 1000)],
              [x0 + (kScale * (sigmaTop + sigmaBot)) / 2, yOf((zMax + zMin) * 500)],
              [x0 + kScale * sigmaBot, yOf(zMin * 1000)],
              [x0, yOf(zMin * 1000)],
            ]
              .map(([x, y]) => `${x},${y}`)
              .join(" ")}
            fill={sigmaTop * sigmaBot <= 0 ? "#1D4ED8" : sigmaTop < 0 ? "#1D4ED8" : "#DC2626"}
            fillOpacity="0.28"
            stroke="#1D4ED8"
            strokeWidth="0.8"
          />
          {/* Neutral fibre of the stress diagram. */}
          {z0 !== null && z0 * 1000 >= zMin * 1000 && z0 * 1000 <= zMax * 1000 ? (
            <line
              x1={pad / 2}
              y1={yOf(z0 * 1000)}
              x2={x0 + 8}
              y2={yOf(z0 * 1000)}
              stroke="#DC2626"
              strokeWidth="0.8"
              strokeDasharray="3 2.5"
            />
          ) : null}
          <text
            x={x0 + 4}
            y={yOf(zMax * 1000) - 4}
            fontSize="8"
            fill="#475569"
            className="font-data"
          >
            σ = {fr(sigmaTop / 1e6, 1)} MPa
          </text>
          <text
            x={x0 + 4}
            y={yOf(zMin * 1000) + 10}
            fontSize="8"
            fill="#475569"
            className="font-data"
          >
            σ = {fr(sigmaBot / 1e6, 1)} MPa
          </text>
        </g>
      </svg>
      <figcaption className="font-data mt-1 text-[10px] text-ink-muted">
        {result.name} — {fr(result.a * 1e6, 0)} mm² · {fr(result.mass_per_m, 1)} kg/m ·{" "}
        <Trans>grille en mm</Trans>
      </figcaption>
    </figure>
  );
}

/** Tabular-nums telemetry readout with EN 1993-1-1 class badges. */
function CompositeTelemetry({
  result,
  error,
  tsv,
}: {
  result: CompositeSectionResult | null;
  error: string | null;
  tsv: string;
}): React.ReactElement {
  const defJson = result === null ? "" : JSON.stringify(result.section_properties);
  if (result === null) {
    return (
      <div
        className="rounded-[8px] border border-hairline bg-panel p-3 text-[12px] text-ink-muted"
        data-testid="composite-telemetry"
      >
        {error !== null ? error : <Trans>Télémétrie en attente du calcul…</Trans>}
      </div>
    );
  }
  const rows: [string, string][] = [
    ["A", `${fr(result.a * 1e6, 0)} mm²`],
    ["m", `${fr(result.mass_per_m, 2)} kg/m`],
    ["yG", `${fr(result.y_g * 1000, 2)} mm`],
    ["zG", `${fr(result.z_g * 1000, 2)} mm`],
    ["Iy", `${fr(result.iy * 1e8, 1)} cm⁴`],
    ["Iz", `${fr(result.iz * 1e8, 1)} cm⁴`],
    ["Iyz", `${fr(result.iyz * 1e8, 2)} cm⁴`],
    ["α", `${fr((result.alpha_rad * 180) / Math.PI, 2)} °`],
    ["Iu / Iv", `${fr(result.iu * 1e8, 1)} / ${fr(result.iv * 1e8, 1)} cm⁴`],
    ["Wel,y", `${fr(result.wel_y * 1e6, 1)} cm³`],
    ["Wpl,y", `${fr(result.wpl_y * 1e6, 1)} cm³`],
    ["iy / iz", `${fr(result.i_radius_y * 1000, 1)} / ${fr(result.i_radius_z * 1000, 1)} mm`],
    ["It", `${fr(result.it * 1e8, 2)} cm⁴`],
    ["Iw", `${fr(result.iw * 1e12, 2)} cm⁶`],
    ["Av,y / Av,z", `${fr(result.a_vy * 1e6, 0)} / ${fr(result.a_vz * 1e6, 0)} mm²`],
  ];
  const classTone = (cls: number): "pass" | "accent" | "warn" | "fail" =>
    cls <= 2 ? "pass" : cls === 3 ? "warn" : "fail";
  return (
    <div
      className="rounded-[8px] border border-hairline bg-panel p-2.5"
      data-testid="composite-telemetry"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-ink-secondary">
          <Trans>Télémétrie exacte</Trans>
        </p>
        <span className="flex items-center gap-1.5">
          <CopyButton value={tsv} testId="composite-copy-tsv" label={t`TSV`} iconOnly />
          <CopyButton value={defJson} testId="composite-copy-json" label="JSON" iconOnly />
        </span>
      </div>
      <dl className="font-data mt-1.5 grid grid-cols-[92px_1fr] gap-x-3 gap-y-0.5 text-[11px] [font-variant-numeric:tabular-nums] text-ink-secondary">
        {rows.map(([key, value]) => (
          <div key={key} className="col-span-2 grid grid-cols-subgrid items-baseline">
            <dt className="text-ink-muted">{key}</dt>
            <dd className="text-right text-ink-primary">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-hairline pt-2">
        <StatusBadge tone={classTone(result.class_bending)} mono testId="composite-class-bending">
          <Trans>Classe flexion</Trans> {result.class_bending}
        </StatusBadge>
        <StatusBadge
          tone={classTone(result.class_compression)}
          mono
          testId="composite-class-compression"
        >
          <Trans>Classe compression</Trans> {result.class_compression}
        </StatusBadge>
        <span className="font-data text-[10px] text-ink-muted">
          EN 1993-1-1 Tab. 5.2 — {result.grade_code}
        </span>
      </div>
    </div>
  );
}
