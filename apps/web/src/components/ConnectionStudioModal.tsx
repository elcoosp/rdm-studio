import { useEffect, useMemo, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { CopyButton, SegmentedControl, StatusBadge } from "@rdm-studio/ui/interior";
import { DialogContent, DialogHeader, DialogRoot, DialogTitle } from "@/components/ui/dialog";
import { NumberFieldRoot, NumberFieldInput } from "@/components/ui/number-field";
import { feaClient, type ConnectionCheckResult } from "@/wasmBridge/workerClient";
import { useProjectStore } from "@/state/projectStore";
import { useSelectedIds } from "@/hooks/useStudioQuery";
import { recordConnectionCheck } from "@/export/sessionChecks";

/**
 * M12.1 — Studio Assemblages EC3-1-8 (EN 1993-1-8 steel connections):
 * a two-column Swiss Metrology daylight dialog pairing an interactive
 * dimensioned SVG joint elevation + bolt-grid drawing (plate outlines,
 * bolt rows/columns with the e1/e2/p1/p2 pitch dimensions, weld throat
 * symbols and the N/V/M force vectors) with the clause-by-clause
 * verification column (Table 3.4 shear/bearing/tension, §3.7 combined
 * interaction, §3.10.2 block tearing, §4.5.3 directional fillet weld).
 * The design actions (N_Ed, V_Ed, M_Ed) are auto-imported from the active
 * ULS envelope of the selected member through the WASM engine.
 *
 * Units: the builder inputs are mm / kN / kN·m (display layer); the
 * engine payload keeps strict SI (m / N / N·m) per ARCHITECTURE.md §19.4.
 */

const TOPOLOGIES = [
  { value: "end_plate", label: t`Platine d'about` },
  { value: "fin_plate", label: t`Éclisse / Attache d'âme` },
  { value: "gusset", label: t`Gousset de treillis` },
] as const;

const BOLT_GRADES = ["4.6", "5.6", "6.8", "8.8", "10.9"] as const;
const BOLT_SIZES = ["M12", "M16", "M20", "M24", "M27", "M30", "M36"] as const;
const STEEL_GRADES = ["S235", "S275", "S355", "S460"] as const;

/** French decimal comma formatting for the telemetry table. */
function fr(value: number, digits = 1): string {
  return value.toFixed(digits).replace(".", ",");
}

/** Millimetre display of a SI metre input. */
function mm(value: number): number {
  return Math.round(value * 1000 * 100) / 100;
}

/** One labelled NumberField row (mm display, SI m state). */
function DimRow({
  label,
  unit,
  valueSi,
  mmStep,
  minMm,
  onChange,
  testId,
}: {
  label: string;
  unit: string;
  valueSi: number;
  mmStep: number;
  minMm: number;
  onChange: (si: number) => void;
  testId?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-[12px] text-ink-secondary">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <NumberFieldRoot
          value={mm(valueSi)}
          min={minMm}
          step={mmStep}
          onValueChange={(next) => {
            if (next !== null && Number.isFinite(next)) onChange(next / 1000);
          }}
        >
          <NumberFieldInput
            className="font-data h-7 w-20 text-right text-[12px]"
            data-testid={testId}
            inputMode="decimal"
          />
        </NumberFieldRoot>
        <span className="w-7 text-[11px] text-ink-muted">{unit}</span>
      </span>
    </label>
  );
}

export function ConnectionStudioModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const { beamId } = useSelectedIds();
  const [topology, setTopology] = useState<string>("fin_plate");
  const [grade, setGrade] = useState<string>("8.8");
  const [size, setSize] = useState<string>("M20");
  const [steelGrade, setSteelGrade] = useState<string>("S355");
  const [nRows, setNRows] = useState(4);
  const [nCols, setNCols] = useState(2);
  const [p1, setP1] = useState(0.08);
  const [p2, setP2] = useState(0.09);
  const [e1, setE1] = useState(0.05);
  const [e2, setE2] = useState(0.04);
  const [plateT, setPlateT] = useState(0.012);
  const [weldA, setWeldA] = useState(0.004);
  const [weldL, setWeldL] = useState(0.3);
  const [result, setResult] = useState<ConnectionCheckResult | null>(null);
  const [busy, setBusy] = useState(false);

  const beam = project.structure.beams.find((b) => b.id === beamId) ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }
    const input: Record<string, unknown> = {
      topology,
      grade,
      size,
      steel_grade: steelGrade,
      n_rows: nRows,
      n_cols: nCols,
      p1,
      p2,
      e1,
      e2,
      plate_t: plateT,
      weld_throat_a: weldA,
      weld_length: weldL,
    };
    if (beam !== null) {
      input.project_json = JSON.stringify(project);
      input.beam_id = beam.id;
    }
    setBusy(true);
    feaClient
      .ec3ConnectionCheck(input)
      .then((r) => {
        setResult(r);
        // M12.5: feed the Step 5 report chapter (last run wins).
        recordConnectionCheck({
          beamLabel: beam !== null ? `P${beam.id} · ${beam.section_id}` : "Sans membre",
          result: r,
        });
      })
      .catch(() => setResult(null))
      .finally(() => setBusy(false));
  }, [
    open,
    topology,
    grade,
    size,
    steelGrade,
    nRows,
    nCols,
    p1,
    p2,
    e1,
    e2,
    plateT,
    weldA,
    weldL,
    beam,
    project,
  ]);

  /** Bolt-grid geometry echoed by the engine (drawing in mm). */
  const drawing = useMemo(() => {
    if (result === null) {
      return null;
    }
    const plateHeightMm = e1 * 2 + (nRows - 1) * p1;
    const plateWidthMm = e2 * 2 + (nCols - 1) * p2;
    return {
      height: mm(plateHeightMm),
      width: mm(plateWidthMm),
      hole: mm(result.d0),
      rowPitch: mm(p1),
      colPitch: mm(p2),
      end: mm(e1),
      edge: mm(e2),
    };
  }, [result, nRows, nCols, e1, e2, p1, p2]);

  const tsv = useMemo(() => {
    if (result === null) {
      return "";
    }
    const lines = [
      ["Clause", "Vérification", "η (%)", "Statut"].join("\t"),
      ...result.trace.map((n) =>
        [
          n.clause,
          n.title.replace(/\t/g, " "),
          fr(n.value * 100, 1),
          n.passed ? "Conforme" : "Dépassement",
        ].join("\t"),
      ),
      ["", "Utilisation globale", fr(result.utilization * 100, 1), ""].join("\t"),
    ];
    return lines.join("\n");
  }, [result]);

  return (
    <DialogRoot open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="flex max-h-[92dvh] w-[min(1060px,94vw)] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-hairline px-4 py-3">
          <DialogTitle className="text-[15px] font-semibold">
            <Trans>Studio Assemblages EC3-1-8</Trans>
            {beam !== null ? (
              <span className="font-data ml-2 text-[12px] text-ink-secondary">
                P{beam.id} · {beam.section_id}
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1.1fr_1fr] lg:overflow-hidden">
          {/* LEFT — interactive dimensioned joint elevation. */}
          <section className="border-b border-hairline p-4 lg:border-r lg:border-b-0">
            <div
              data-testid="connection-svg"
              className="rounded-panel border border-hairline bg-canvas p-2"
            >
              {drawing !== null && result !== null ? (
                <svg
                  viewBox="0 0 420 320"
                  className="h-auto w-full"
                  role="img"
                  aria-label={t`Élévation de l'assemblage`}
                >
                  {/* Plate outline centred in the canvas (mm scaled). */}
                  {(() => {
                    const scale = Math.min(
                      300 / Math.max(drawing.height, 1),
                      180 / Math.max(drawing.width, 1),
                    );
                    const h = drawing.height * scale;
                    const w = drawing.width * scale;
                    const x0 = 210 - w / 2;
                    const y0 = 160 - h / 2;
                    const rows = Math.max(1, nRows);
                    const cols = Math.max(1, nCols);
                    const rowStep = drawing.rowPitch * scale;
                    const colStep = drawing.colPitch * scale;
                    const holeR = (drawing.hole / 2) * scale;
                    const bolts: { cx: number; cy: number }[] = [];
                    for (let rIdx = 0; rIdx < rows; rIdx++) {
                      for (let cIdx = 0; cIdx < cols; cIdx++) {
                        bolts.push({
                          cx: x0 + drawing.edge * scale + cIdx * colStep,
                          cy: y0 + drawing.end * scale + rIdx * rowStep,
                        });
                      }
                    }
                    return (
                      <>
                        {/* Plate */}
                        <rect
                          x={x0}
                          y={y0}
                          width={w}
                          height={h}
                          fill="#EFF6FF"
                          stroke="#0F172A"
                          strokeWidth={1.5}
                        />
                        {/* Beam stub to the left (connected member). */}
                        <rect
                          x={x0 - 64}
                          y={y0 + h * 0.3}
                          width={64}
                          height={h * 0.4}
                          fill="#FFFFFF"
                          stroke="#475569"
                          strokeWidth={1.2}
                        />
                        {/* Weld throat triangles along the joint line. */}
                        <polygon
                          points={`${x0 - 2},${y0 + h * 0.3} ${x0 + 6},${y0 + h * 0.3 + 8} ${x0 - 2},${y0 + h * 0.3 + 8}`}
                          fill="#F59E0B"
                          stroke="#F59E0B"
                          strokeWidth={1}
                        />
                        <polygon
                          points={`${x0 - 2},${y0 + h * 0.7} ${x0 + 6},${y0 + h * 0.7 - 8} ${x0 - 2},${y0 + h * 0.7 - 8}`}
                          fill="#F59E0B"
                          stroke="#F59E0B"
                          strokeWidth={1}
                        />
                        {/* Bolt grid (clearance holes). */}
                        {bolts.map((b, i) => (
                          <g key={i}>
                            <circle
                              cx={b.cx}
                              cy={b.cy}
                              r={holeR}
                              fill="#FFFFFF"
                              stroke="#1D4ED8"
                              strokeWidth={1.4}
                            />
                            <line
                              x1={b.cx - 3}
                              y1={b.cy}
                              x2={b.cx + 3}
                              y2={b.cy}
                              stroke="#1D4ED8"
                              strokeWidth={0.8}
                            />
                            <line
                              x1={b.cx}
                              y1={b.cy - 3}
                              x2={b.cx}
                              y2={b.cy + 3}
                              stroke="#1D4ED8"
                              strokeWidth={0.8}
                            />
                          </g>
                        ))}
                        {/* p1 pitch dimension (right side). */}
                        {rows > 1 ? (
                          <>
                            <line
                              x1={x0 + w + 12}
                              y1={y0 + drawing.end * scale}
                              x2={x0 + w + 12}
                              y2={y0 + drawing.end * scale + rowStep}
                              stroke="#475569"
                              strokeWidth={1}
                              markerStart="url(#arrow)"
                              markerEnd="url(#arrow)"
                            />
                            <text
                              x={x0 + w + 18}
                              y={y0 + drawing.end * scale + rowStep / 2}
                              className="font-data"
                              fontSize={10}
                              fill="#475569"
                            >
                              p₁ = {fr(drawing.rowPitch, 0)}
                            </text>
                          </>
                        ) : null}
                        {/* e1 end distance (left). */}
                        <line
                          x1={x0 - 84}
                          y1={y0}
                          x2={x0 - 84}
                          y2={y0 + drawing.end * scale}
                          stroke="#475569"
                          strokeWidth={1}
                          markerStart="url(#arrow)"
                          markerEnd="url(#arrow)"
                        />
                        <text
                          x={x0 - 104}
                          y={y0 + (drawing.end * scale) / 2}
                          className="font-data"
                          fontSize={10}
                          fill="#475569"
                        >
                          e₁ = {fr(drawing.end, 0)}
                        </text>
                        {/* e2 edge distance (top). */}
                        <line
                          x1={x0}
                          y1={y0 - 14}
                          x2={x0 + drawing.edge * scale}
                          y2={y0 - 14}
                          stroke="#475569"
                          strokeWidth={1}
                          markerStart="url(#arrow)"
                          markerEnd="url(#arrow)"
                        />
                        <text x={x0} y={y0 - 18} className="font-data" fontSize={10} fill="#475569">
                          e₂ = {fr(drawing.edge, 0)}
                        </text>
                        {/* Force vectors: V_Ed down, N_Ed right. */}
                        <line
                          x1={x0 + w / 2}
                          y1={y0 + h + 6}
                          x2={x0 + w / 2}
                          y2={y0 + h + 42}
                          stroke="#DC2626"
                          strokeWidth={2}
                          markerEnd="url(#arrowRed)"
                        />
                        <text
                          x={x0 + w / 2 + 6}
                          y={y0 + h + 38}
                          className="font-data"
                          fontSize={10}
                          fill="#DC2626"
                        >
                          V = {fr(result.v_ed / 1000, 0)} kN
                        </text>
                        <line
                          x1={x0 - 64}
                          y1={y0 + h * 0.5}
                          x2={x0 - 110}
                          y2={y0 + h * 0.5}
                          stroke="#1D4ED8"
                          strokeWidth={2}
                          markerEnd="url(#arrowBlue)"
                        />
                        <text
                          x={x0 - 108}
                          y={y0 + h * 0.5 - 6}
                          className="font-data"
                          fontSize={10}
                          fill="#1D4ED8"
                        >
                          N = {fr(result.n_ed / 1000, 0)} kN
                        </text>
                        <text
                          x={x0 - 64}
                          y={y0 - 26}
                          className="font-data"
                          fontSize={10}
                          fill="#475569"
                        >
                          M = {fr(result.m_ed / 1000, 0)} kN·m
                        </text>
                        <defs>
                          <marker
                            id="arrow"
                            markerWidth="6"
                            markerHeight="6"
                            refX="3"
                            refY="3"
                            orient="auto"
                          >
                            <circle cx="3" cy="3" r="1.4" fill="#475569" />
                          </marker>
                          <marker
                            id="arrowRed"
                            markerWidth="7"
                            markerHeight="7"
                            refX="5"
                            refY="3.5"
                            orient="auto"
                          >
                            <polygon points="0,0 7,3.5 0,7" fill="#DC2626" />
                          </marker>
                          <marker
                            id="arrowBlue"
                            markerWidth="7"
                            markerHeight="7"
                            refX="5"
                            refY="3.5"
                            orient="auto"
                          >
                            <polygon points="0,0 7,3.5 0,7" fill="#1D4ED8" />
                          </marker>
                        </defs>
                      </>
                    );
                  })()}
                </svg>
              ) : (
                <p className="text-[12px] text-ink-muted">
                  <Trans>L'élévation de l'assemblage s'affiche au premier calcul.</Trans>
                </p>
              )}
            </div>
            {/* Auto-imported ULS design actions. */}
            <div className="font-data mt-3 grid grid-cols-3 gap-2 text-[11px] [font-variant-numeric:tabular-nums]">
              {result !== null ? (
                <>
                  <div className="rounded-panel border border-hairline bg-panel px-2 py-1.5">
                    <p className="text-[10px] text-ink-muted">N Ed</p>
                    <p className="text-ink-primary">{fr(result.n_ed / 1000, 1)} kN</p>
                  </div>
                  <div className="rounded-panel border border-hairline bg-panel px-2 py-1.5">
                    <p className="text-[10px] text-ink-muted">V Ed</p>
                    <p className="text-ink-primary">{fr(result.v_ed / 1000, 1)} kN</p>
                  </div>
                  <div className="rounded-panel border border-hairline bg-panel px-2 py-1.5">
                    <p className="text-[10px] text-ink-muted">M Ed</p>
                    <p className="text-ink-primary">{fr(result.m_ed / 1000, 1)} kN·m</p>
                  </div>
                </>
              ) : null}
            </div>
            <p className="mt-1 text-[10px] text-ink-muted">
              {beam !== null ? (
                <Trans>
                  Efforts auto-importés de l'enveloppe ELU active de la barre sélectionnée.
                </Trans>
              ) : (
                <Trans>Sélectionnez une barre pour importer les efforts de l'enveloppe ELU.</Trans>
              )}
            </p>
          </section>
          {/* RIGHT — inputs + clause-by-clause verification. */}
          <section className="flex min-h-0 flex-col overflow-y-auto p-4">
            <SegmentedControl
              className="w-full"
              label={t`Topologie`}
              value={topology}
              onValueChange={setTopology}
              options={TOPOLOGIES.map((tOpt) => ({
                value: tOpt.value,
                label: tOpt.label,
                testId: `connection-topology-${tOpt.value}`,
              }))}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <SegmentedControl
                className="w-full"
                label={t`Classe de boulon`}
                value={grade}
                onValueChange={setGrade}
                options={BOLT_GRADES.map((g) => ({
                  value: g,
                  label: g,
                  testId: `connection-grade-${g.replace(".", "_")}`,
                }))}
              />
              <SegmentedControl
                className="w-full"
                label={t`Diamètre`}
                value={size}
                onValueChange={setSize}
                options={BOLT_SIZES.map((s) => ({
                  value: s,
                  label: s,
                  testId: `connection-size-${s}`,
                }))}
              />
            </div>
            <SegmentedControl
              className="mt-2 w-full"
              label={t`Acier de la platine`}
              value={steelGrade}
              onValueChange={setSteelGrade}
              options={STEEL_GRADES.map((g) => ({
                value: g,
                label: g,
                testId: `connection-steel-${g}`,
              }))}
            />
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              <label className="flex items-center justify-between gap-2 text-[12px] text-ink-secondary">
                <span>
                  <Trans>Rangées de boulons</Trans>
                </span>
                <NumberFieldRoot
                  value={nRows}
                  min={1}
                  max={12}
                  step={1}
                  onValueChange={(v) => {
                    if (v !== null) setNRows(Math.round(v));
                  }}
                >
                  <NumberFieldInput
                    className="font-data h-7 w-16 text-right text-[12px]"
                    inputMode="numeric"
                    data-testid="connection-n-rows"
                  />
                </NumberFieldRoot>
              </label>
              <label className="flex items-center justify-between gap-2 text-[12px] text-ink-secondary">
                <span>
                  <Trans>Colonnes de boulons</Trans>
                </span>
                <NumberFieldRoot
                  value={nCols}
                  min={1}
                  max={8}
                  step={1}
                  onValueChange={(v) => {
                    if (v !== null) setNCols(Math.round(v));
                  }}
                >
                  <NumberFieldInput
                    className="font-data h-7 w-16 text-right text-[12px]"
                    inputMode="numeric"
                    data-testid="connection-n-cols"
                  />
                </NumberFieldRoot>
              </label>
              <DimRow
                label={t`Pas p₁ (rangées)`}
                unit="mm"
                valueSi={p1}
                mmStep={5}
                minMm={20}
                onChange={setP1}
                testId="connection-p1"
              />
              <DimRow
                label={t`Pas p₂ (colonnes)`}
                unit="mm"
                valueSi={p2}
                mmStep={5}
                minMm={20}
                onChange={setP2}
                testId="connection-p2"
              />
              <DimRow
                label={t`Distance d'about (e₁)`}
                unit="mm"
                valueSi={e1}
                mmStep={5}
                minMm={20}
                onChange={setE1}
                testId="connection-e1"
              />
              <DimRow
                label={t`Distance au bord (e₂)`}
                unit="mm"
                valueSi={e2}
                mmStep={5}
                minMm={20}
                onChange={setE2}
                testId="connection-e2"
              />
              <DimRow
                label={t`Épaisseur platine`}
                unit="mm"
                valueSi={plateT}
                mmStep={1}
                minMm={4}
                onChange={setPlateT}
                testId="connection-plate-t"
              />
              <DimRow
                label={t`Gorge de soudure a`}
                unit="mm"
                valueSi={weldA}
                mmStep={0.5}
                minMm={0}
                onChange={setWeldA}
                testId="connection-weld-a"
              />
              <DimRow
                label={t`Longueur de soudure`}
                unit="mm"
                valueSi={weldL}
                mmStep={10}
                minMm={0}
                onChange={setWeldL}
                testId="connection-weld-l"
              />
            </div>
            {result !== null ? (
              <div className="mt-4 min-h-0" data-testid="connection-trace">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-ink-secondary">
                    <Trans>Vérification EN 1993-1-8</Trans>
                  </h3>
                  <CopyButton value={tsv} label={t`Copier pour Excel`} />
                </div>
                <dl className="grid gap-x-4 gap-y-1">
                  {result.trace.map((node) => (
                    <div key={`${node.clause}-${node.title}`} className="flex items-center gap-2">
                      <dt className="w-52 shrink-0 text-[11px] text-ink-secondary">
                        <span className="font-data block truncate text-[10px] text-ink-muted">
                          {node.clause}
                        </span>
                        {node.title}
                      </dt>
                      <div className="h-1.5 flex-1 rounded bg-panel-subtle" role="presentation">
                        <div
                          className="h-1.5 rounded"
                          style={{
                            width: `${Math.min(100, node.value * 100).toFixed(0)}%`,
                            background:
                              node.value > 1 ? "#DC2626" : node.value > 0.8 ? "#F59E0B" : "#10B981",
                          }}
                        />
                      </div>
                      <dd className="font-data w-16 shrink-0 text-right text-[11px] text-ink-primary">
                        {fr(node.value * 100, 1)} %
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex items-center gap-2">
                  <StatusBadge
                    tone={result.utilization <= 1 ? "pass" : "fail"}
                    mono
                    testId="connection-utilization"
                  >
                    {`η = ${fr(result.utilization, 2)} ${
                      result.utilization <= 1 ? "· Conforme EC3-1-8" : "· Dépassement"
                    }`}
                  </StatusBadge>
                  <span className="text-[11px] text-ink-muted">
                    {result.n_bolts} boulons {result.grade} · {result.topology_label}
                  </span>
                </div>
                <p className="font-data mt-1 text-[10px] text-ink-muted">
                  Fv,Rd = {fr(result.fv_rd / 1000, 1)} kN · Fb,Rd = {fr(result.fb_rd / 1000, 1)} kN
                  {" · "}Ft,Rd = {fr(result.ft_rd / 1000, 1)} kN · Veff,1,Rd ={" "}
                  {fr(result.v_eff_rd / 1000, 1)} kN
                  {result.fw_rd > 0 ? ` · Fw,Rd = ${fr(result.fw_rd / 1000, 1)} kN` : ""}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-[12px] text-ink-muted">
                {busy ? (
                  <Trans>Vérification EN 1993-1-8 en cours…</Trans>
                ) : (
                  <Trans>Ajustez la géométrie pour lancer la vérification.</Trans>
                )}
              </p>
            )}
          </section>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
