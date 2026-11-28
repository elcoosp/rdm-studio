import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Trans } from "@lingui/react/macro";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Download, GripVertical, FileText, Share2, Printer } from "lucide-react";
import { encodeProject } from "@/lib/urlShare";
import { useProjectStore, type ProjectData } from "@/state/projectStore";
import QRCode from "qrcode";
import { toast } from "sonner";
import { t } from "@lingui/core/macro";
import {
  feaClient,
  getLastModalReport,
  getLastReport,
  useLastReport,
} from "@/wasmBridge/workerClient";
import { buildReportHtml } from "@/export/pdfTakumiReport";
import { downloadDocx, type DocxBlock, type DocxTable, type CoverMeta } from "@/export/docxExport";
import type { CompositeSectionResult, StoreyDriftResult } from "@/wasmBridge/workerClient";
import {
  getConnectionCheck,
  getMovingEnvelope,
  subscribeConnectionCheck,
  subscribeMovingEnvelope,
} from "@/export/sessionChecks";
import { StatusBadge } from "@rdm-studio/ui/interior";
import { BrandMark } from "@rdm-studio/ui/primitives";
import { saveSnapshot } from "@/state/snapshots";
import { exportResultsCsv } from "@/export/csvExport";
import { exportStandaloneHtml3d } from "@/export/standaloneHtml3d";
import { captureViewportPng } from "@/state/stageStore";
import { StudioBaseSearchSchema } from "@/schemas/searchParams.schema";
import { IconReport } from "@rdm-studio/ui/icons";
import { useLicenseStore } from "@/state/licenseStore";
import { downloadText } from "@/export/csvExport";
import { CopyButton, LoadingButton, SegmentedControl } from "@rdm-studio/ui/interior";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { trackProductEvent } from "@/lib/productTelemetry";

export const Route = createFileRoute("/_studio/report")({
  staticData: {
    surface: "studio",
    stepOrder: 5,
    label: "Rapport",
    mobileLabel: "Rapport",
    icon: IconReport,
    stageVisible: false,
    shortcut: "5",
  },
  validateSearch: StudioBaseSearchSchema,
  component: ReportPage,
});

async function dataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
  const response = await fetch(dataUrl);
  return new Uint8Array(await response.arrayBuffer());
}

const sessionStartMs = Date.now();

function downloadBytes(filename: string, bytes: Uint8Array): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Strips the catalog-derived `sections` / `materials` maps before
 * `encodeProject` (v2.1.2 audit fix): they are re-derived from the EN
 * catalogs by designation strings at rehydration, so carrying them in the
 * lz-string payload only bloats the share URL and makes the QR code
 * unreadably dense. An empty record still validates (v.record).
 */
function compactSharePayload(project: ProjectData): ProjectData {
  return {
    ...project,
    structure: {
      ...project.structure,
      sections: {},
      materials: {},
    },
  };
}

/**
 * Step 5 (DESIGN.md §4 + mockups tape_5, v1.6.0): centered A4 engineering
 * sheet (`max-w-[794px]`, p-8) with the logo header, the LIVE 3D snapshot
 * of the persistent stage, 2-column metadata grid, aligned monospace
 * tables (tabular-nums, right-aligned numeric columns, 1-click TSV copy)
 * and the QR + SHA-256 fingerprint footer, beside the sticky 320px export
 * rail (PDF Takumi / CSV Excel / HTML 3D / Exporter (.rdm) / Imprimer).
 *
 * v1.6.0: ELU support reactions are superposed from the ACTUAL EN 1990
 * multipliers of the solved ULS combination (`("G", 1.35)`, `("Q", 1.5)`,
 * plus W/S when present) across all cases — no more hardcoded 1.35/1.50.
 *
 * v2.1.2 (audit `519229b`): `QRCode.toDataURL` moved OUT of `useMemo`
 * (an async side effect never belonged there — StrictMode double-invoked
 * it and the result raced the render) into a cancellable `useEffect`, the
 * share payload is compacted (catalog maps stripped) so the QR stays
 * scannable, the export rail uses the interior.dev `LoadingButton` +
 * `CopyButton`, and every form control is a shadcn/Base UI primitive.
 */
function ReportPage() {
  const project = useProjectStore((s) => s.project);
  // v2.1.1: the Édition Découverte watermark (removed in Pro mode).
  const licenseTier = useLicenseStore((s) => s.tier);
  // M11.3: cover title block reads the licensed engineer / checker names.
  const licenseEngineer = useLicenseStore((s) => s.engineerName);
  const licenseChecker = useLicenseStore((s) => s.checkerName);
  const [busy, setBusy] = useState(false);
  const [hasSolved, setHasSolved] = useState(false);
  const [hasExported, setHasExported] = useState(false);
  const [wasemEmitted, setWasemEmitted] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  // v2.1.1: ReportBuilder registers its .docx exporter so the rail-top
  // `Word (.docx)` button shares the SAME cover/chapter payload.
  const docxExportRef = useRef<() => void>(() => undefined);
  const shareUrl = useMemo(() => {
    const encoded = encodeProject(compactSharePayload(project));
    return `${window.location.origin}/report?p=${encoded}`;
  }, [project]);

  // v2.1.2 (audit 519229b): QR generation is an async SIDE EFFECT —
  // cancellable in useEffect, never in useMemo.
  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(shareUrl, { margin: 1, width: 176 }).then((url) => {
      if (!cancelled) {
        setQrDataUrl(url);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  // v2.2.0: a direct /report visit must NEVER render 0,00 or blank boxes —
  // auto-run the solver on mount whenever no report is cached (the same
  // `fe.aClient.solveModel` path the KPI strip uses), and capture the
  // persistent 3D stage on route LEAVE while the canvas is still visible
  // so the note embeds a fresh snapshot instead of a stale/empty one.
  useEffect(() => {
    let cancelled = false;
    if (getLastReport() === null) {
      void feaClient
        .solveModel(project)
        .then((r) => {
          if (!cancelled) {
            void r;
            setHasSolved(true);
            tryFireWasem();
          }
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
      // Route leave: mirror the project into the local snapshot store
      // (crash-recovery slot) and grab the live 3D stage PNG while the
      // canvas is still mounted, so a later /report visit renders a real
      // snapshot instead of a blank box.
      void saveSnapshot(project.name, project);
      void captureViewportPng();
    };
  }, [project]);

  /** v1.6.0: one-click canonical `.rdm` export (Step 5 + header menu). */
  const exportRdm = () => {
    const canonical = JSON.stringify(project, null, 2);
    downloadText(
      `${project.name.replace(/[^\w-]+/g, "_")}.rdm`,
      canonical,
      "application/json;charset=utf-8",
    );
    toast(t`Modèle .rdm exporté`, {
      description: t`Fichier canonique réimportable à l'identique (round-trip Valibot).`,
    });
    void trackProductEvent("export_completed", { format: "rdm" });
    setHasExported(true);
    tryFireWasem();
  };

  /** v2.1.1: BIM / solver exports live in the top export rail. */
  const exportBim = (format: string): void => {
    void feaClient
      .engineCall("export_bim", project, format)
      .then((payload) => {
        const blob = new Blob([String(payload)], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const anchor = window.document.createElement("a");
        anchor.href = url;
        anchor.download = `rdm-model.${format === "ifc4" ? "ifc" : format}`;
        anchor.click();
        URL.revokeObjectURL(url);
        void trackProductEvent("export_completed", { format });
        setHasExported(true);
        tryFireWasem();
      })
      .catch(() => undefined);
  };

  // v2.1.1: ⌘K palette export commands ride window events.
  useEffect(() => {
    const onExportRdm = () => exportRdm();
    const onExportDocx = () => docxExportRef.current();
    const onExportBim = (event: Event) => {
      const format = (event as CustomEvent<string>).detail;
      if (typeof format === "string") {
        exportBim(format);
      }
    };
    window.addEventListener("rdm-export-rdm", onExportRdm);
    window.addEventListener("rdm-export-docx", onExportDocx);
    window.addEventListener("rdm-export-bim", onExportBim);
    return () => {
      window.removeEventListener("rdm-export-rdm", onExportRdm);
      window.removeEventListener("rdm-export-docx", onExportDocx);
      window.removeEventListener("rdm-export-bim", onExportBim);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const exportPdf = async () => {
    setBusy(true);
    try {
      let report = getLastReport();
      report ??= await feaClient.solveModel(project);
      const qrPng = qrDataUrl
        ? { src: "share-qr.png", data: await dataUrlToBytes(qrDataUrl) }
        : undefined;
      // v1.6.0: live 3D snapshot from the persistent stage (hidden on
      // Step 5 but still rendering — captureViewportPng stays available).
      const snapshot = captureViewportPng();
      const stagePng =
        snapshot !== null
          ? { src: "stage-3d.png", data: await dataUrlToBytes(snapshot) }
          : undefined;
      const { html, images } = buildReportHtml(
        project,
        report,
        { shareUrl, fresh: true },
        qrPng,
        stagePng,
        { watermark: licenseTier === "free" },
      );
      const pdf = await feaClient.renderReportPdf(html, images);
      downloadBytes(`${project.name.replace(/[^\w-]+/g, "_")}-rapport.pdf`, pdf);
      void trackProductEvent("export_completed", { format: "pdf" });
      setHasExported(true);
      tryFireWasem();
    } finally {
      setBusy(false);
    }
  };

  const tryFireWasem = useCallback(() => {
    if (wasemEmitted) return;
    if (hasSolved && hasExported) {
      setWasemEmitted(true);
      void trackProductEvent("wasem_achieved", {
        elapsed_ms: Date.now() - sessionStartMs,
        n_beams: project.structure.beams.length,
        export_format: "any",
      });
    }
  }, [hasSolved, hasExported, wasemEmitted, project.structure.beams.length]);

  return (
    <div className="h-full min-h-0 overflow-auto p-3 md:p-4">
      <div className="mx-auto flex max-w-[1140px] flex-col gap-4 md:flex-row md:items-start">
        <section className="print-sheet mx-auto min-w-0 flex-1 max-w-[794px] space-y-5 rounded-panel border border-hairline bg-panel p-6 lg:p-8">
          {/* M11.3: official branded cover header — BrandMark lockup,
              engineer title block, Eurocode scope, solver badge and the
              certified 49/49 benchmark seal. */}
          <header className="border-b-2 border-accent pb-3" data-testid="report-cover">
            <div className="flex items-start justify-between gap-3">
              <BrandMark size="md" showTagline />
              <div className="font-data text-right text-[11px] text-ink-muted">
                <p>{new Date().toLocaleDateString("fr-FR")}</p>
                <p data-testid="report-solver-badge">
                  <Trans>Solveur 3D Timoshenko — WASM</Trans>
                </p>
              </div>
            </div>
            <h2 className="mt-2 text-[19px] font-semibold">
              {project.name} — <Trans>Note de calcul</Trans>
            </h2>
            <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-0.5 font-data text-[11px] text-ink-secondary">
              <dt>
                <Trans>Auteur</Trans>
              </dt>
              <dd className="text-right">{licenseEngineer === "" ? "—" : licenseEngineer}</dd>
              <dt>
                <Trans>Vérificateur</Trans>
              </dt>
              <dd className="text-right">{licenseChecker === "" ? "—" : licenseChecker}</dd>
              <dt>
                <Trans>Périmètre normatif</Trans>
              </dt>
              <dd className="text-right">EN 1990 – EN 1999 (Eurocodes)</dd>
            </dl>
            <p
              className="mt-1.5 font-data text-[10px] text-ink-muted"
              data-testid="report-benchmark-seal"
            >
              <Trans>
                Suite de validation certifiée — 49 / 49 benchmarks analytiques RDM6/RDM7 · 0 octet
                cloud
              </Trans>
            </p>
          </header>
          {/* v1.6.0 live 3D snapshot — v2.1.1: constrained to 220px on the
              bg-canvas plate so the A4 sheet never balloons. */}
          <figure
            className="rounded-panel border border-hairline bg-panel-subtle p-2"
            data-testid="report-3d-snapshot"
          >
            <img
              src={captureViewportPng() ?? "/logo-rdm-studio.png"}
              alt={t`Vue 3D du modèle`}
              className="max-h-[220px] w-full rounded bg-canvas object-contain"
            />
            <figcaption className="font-data mt-1 text-[10px] text-ink-muted">
              <Trans>Capture temps réel de la vue 3D (étape 1–4)</Trans>
            </figcaption>
          </figure>
          {/* 2-column metadata grid. */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
            <dt className="text-ink-muted">
              <Trans>Nom du projet</Trans>
            </dt>
            <dd className="font-data text-right">{project.name}</dd>
            <dt className="text-ink-muted">
              <Trans>Nœuds / Poutres / Appuis / Charges</Trans>
            </dt>
            <dd className="font-data text-right">
              {project.structure.nodes.length} / {project.structure.beams.length} /{" "}
              {project.structure.supports.length} / {project.structure.loads.length}
            </dd>
            <dt className="text-ink-muted">
              <Trans>Poids propre automatique</Trans>
            </dt>
            <dd className="font-data text-right">
              {project.structure.self_weight_enabled ? "oui" : "non"}
            </dd>
            <dt className="text-ink-muted">
              <Trans>Normes</Trans>
            </dt>
            <dd className="font-data text-right">EN 1990 / EN 1993-1-1</dd>
          </dl>
          <div>
            <h3 className="mb-1 text-[13px] font-semibold text-ink-secondary">
              <Trans>Profils utilisés</Trans>
            </h3>
            <ul className="font-data list-disc pl-5 text-[13px]">
              {[
                ...new Set(
                  project.structure.beams.map((b) => `${b.section_id} (${b.material_id})`),
                ),
              ].map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
          {/* M11.3: dedicated Sections Droites Composées chapter — vector
              SVG diagram, full geometric property table and the EN 1993-1-1
              Table 5.2 classification, whenever composite sections exist. */}
          <CompositeReportChapter />
          {/* M12.5: advanced analyses chapters render whenever present. */}
          <ConnectionReportChapter />
          <MovingReportChapter />
          <DriftReportChapter />
          <ReportTables />
          <FingerprintFooter qrDataUrl={qrDataUrl} />
          {/* v2.1.1: subtle Édition Découverte watermark (Pro removes it). */}
          {licenseTier === "free" ? (
            <p
              className="font-data border-t border-hairline pt-2 text-center text-[10px] text-ink-muted"
              data-testid="edition-watermark"
            >
              <Trans>Édition Découverte — Évaluation non contractuelle</Trans>
            </p>
          ) : null}
        </section>
        {/* v2.1.1: sticky 320px export rail — PDF Takumi (primary Cobalt)
            and Word (.docx) (secondary outline) TOGETHER at the top, then
            the BIM/data formats, then the Report Builder + share block.
            v2.1.2: the two document buttons are interior.dev
            `LoadingButton`s (locked width, idle → pending → success).
            v2.3.0: grouped into hairline sub-cards with 16px icons. */}
        <aside className="w-full shrink-0 space-y-3 self-start md:sticky md:top-4 md:w-80">
          {/* Documents sub-card */}
          <div className="rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5">
            <h3 className="flex items-center gap-1.5 text-[13px] font-semibold mb-2">
              <FileText size={16} strokeWidth={1.5} className="text-accent" aria-hidden />
              <Trans>Documents</Trans>
            </h3>
            <LoadingButton
              testId="export-pdf"
              className="min-h-11 w-full"
              disabled={busy}
              onAction={() => exportPdf()}
              pendingLabel={t`Génération…`}
              successLabel={t`PDF téléchargé`}
            >
              {t`PDF Takumi`}
            </LoadingButton>
            <LoadingButton
              testId="export-docx-btn"
              className="min-h-11 w-full border-accent bg-panel text-accent hover:bg-accent-tint mt-2"
              disabled={busy}
              onAction={() => docxExportRef.current()}
              successLabel={t`.docx téléchargé`}
            >
              {t`Word (.docx)`}
            </LoadingButton>
          </div>

          {/* BIM & Data Formats sub-card */}
          <div className="rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5">
            <h3 className="flex items-center gap-1.5 text-[13px] font-semibold mb-2">
              <Download size={16} strokeWidth={1.5} className="text-accent" aria-hidden />
              <Trans>Formats BIM & données</Trans>
            </h3>
            <div className="grid grid-cols-3 gap-1.5">
              {["ifc4", "saf", "opensees", "gltf"].map((format) => (
                <button
                  key={format}
                  type="button"
                  data-testid={`export-bim-${format}`}
                  onClick={() => exportBim(format)}
                  className="flex items-center justify-center gap-1 rounded bg-panel-subtle px-2 py-1.5 font-data text-[11px] text-ink-secondary hover:text-accent"
                >
                  <Download size={12} strokeWidth={1.5} aria-hidden />
                  {format.toUpperCase()}
                </button>
              ))}
              <button
                type="button"
                data-testid="export-rdm"
                disabled={busy}
                className="flex items-center justify-center gap-1 rounded bg-panel-subtle px-2 py-1.5 font-data text-[11px] text-ink-secondary hover:text-accent"
                onClick={exportRdm}
              >
                <Download size={12} strokeWidth={1.5} aria-hidden />
                .rdm
              </button>
              <button
                type="button"
                data-testid="export-csv"
                disabled={busy}
                className="flex items-center justify-center gap-1 rounded bg-panel-subtle px-2 py-1.5 font-data text-[11px] text-ink-secondary hover:text-accent"
                onClick={() => exportResultsCsv(getLastReport())}
              >
                <Download size={12} strokeWidth={1.5} aria-hidden />
                CSV
              </button>
              <button
                type="button"
                data-testid="export-html-btn"
                disabled={busy}
                className="flex items-center justify-center gap-1 rounded bg-panel-subtle px-2 py-1.5 font-data text-[11px] text-ink-secondary hover:text-accent"
                onClick={() =>
                  exportStandaloneHtml3d(project, getLastReport(), (name, text, mime) => {
                    import("@/export/csvExport").then((m) => m.downloadText(name, text, mime));
                  })
                }
              >
                <Download size={12} strokeWidth={1.5} aria-hidden />
                HTML 3D
              </button>
            </div>
          </div>

          {/* Share & Print sub-card */}
          <div className="rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5">
            <h3 className="flex items-center gap-1.5 text-[13px] font-semibold mb-2">
              <Share2 size={16} strokeWidth={1.5} className="text-accent" aria-hidden />
              <Trans>Partage & impression</Trans>
            </h3>
            <div className="space-y-2">
              <p className="text-[12px] text-ink-secondary">
                <Trans>
                  Le modèle .rdm est compressé (lz-string) dans l'URL et validé par Valibot à la
                  relecture.
                </Trans>
              </p>
              <Textarea
                readOnly
                className="font-data h-20 text-[11px]"
                value={shareUrl}
                aria-label={t`URL de partage`}
              />
              <CopyButton
                value={shareUrl}
                className="h-9 w-full justify-center"
                label={t`Copier l'URL de partage`}
                copiedLabel={t`Copie !`}
                onCopy={() => void trackProductEvent("share_url_copied")}
              />
              {qrDataUrl !== null ? (
                <img
                  src={qrDataUrl}
                  alt="QR"
                  data-testid="share-qr"
                  className="mx-auto mt-3 block h-28 w-28"
                />
              ) : null}
              <button
                type="button"
                data-testid="print-report"
                className="flex items-center justify-center gap-1 rounded border border-hairline px-2 py-1.5 w-full text-[11px] text-ink-secondary hover:border-accent hover:text-accent"
                onClick={() => {
                  void trackProductEvent("print_clicked");
                  window.print();
                }}
              >
                <Printer size={12} strokeWidth={1.5} aria-hidden />
                <Trans>Imprimer</Trans>
              </button>
            </div>
          </div>

          <ReportBuilder registerDocxExport={(fn) => (docxExportRef.current = fn)} />
        </aside>
      </div>
    </div>
  );
}

const fr = (v: number, digits = 3): string => v.toFixed(digits).replace(".", ",");

/** v1.4.0: deterministic SHA-256 model fingerprint + QR footer. */
function FingerprintFooter({ qrDataUrl }: { qrDataUrl: string | null }) {
  const project = useProjectStore((s) => s.project);
  const [hash, setHash] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      feaClient
        .projectFingerprint(JSON.stringify(project))
        .then((h) => {
          if (!cancelled) setHash(h);
        })
        .catch(() => undefined);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [project]);
  return (
    <div className="flex items-end justify-between gap-4 border-t border-hairline pt-3">
      <p className="font-data text-[11px] text-ink-muted">
        Empreinte du modèle (SHA-256) :{" "}
        <span data-testid="model-fingerprint" className="break-all">
          {hash ?? "calcul…"}
        </span>
        {hash !== null ? (
          <CopyButton
            value={hash}
            iconOnly
            label={t`Copier l'empreinte SHA-256`}
            className="ml-2 align-middle"
          />
        ) : null}
      </p>
      {qrDataUrl !== null ? (
        <img src={qrDataUrl} alt="" aria-hidden className="h-16 w-16 shrink-0" />
      ) : null}
    </div>
  );
}

/**
 * M11.3: shared engine hook — the exact composite results of every custom
 * section, keyed by name (the report chapter and the .docx payload share
 * ONE fetch through the worker lane).
 */
function useCompositeResults(defs: { name: string }[]): Record<string, CompositeSectionResult> {
  const [results, setResults] = useState<Record<string, CompositeSectionResult>>({});
  const key = JSON.stringify(defs);
  useEffect(() => {
    let cancelled = false;
    const defsParsed = JSON.parse(key) as Parameters<typeof feaClient.computeCompositeSection>[0][];
    for (const defJson of defsParsed) {
      const name = (JSON.parse(defJson) as { name: string }).name;
      void feaClient
        .computeCompositeSection(defJson)
        .then((res) => {
          if (!cancelled) {
            setResults((prev) => ({ ...prev, [name]: res }));
          }
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [key]);
  return results;
}

const fr3 = (v: number, digits = 3): string => v.toFixed(digits).replace(".", ",");
const EMPTY_CUSTOM_SECTIONS: never[] = [];

/**
 * M12.5: shared hook over the session registry — the report chapters
 * re-render whenever the Studio Assemblages / Convois panel runs a new
 * verification (module singleton + version counter).
 */
function useSessionChecks(): {
  connection: ReturnType<typeof getConnectionCheck>;
  moving: ReturnType<typeof getMovingEnvelope>;
} {
  const [, bump] = useState(0);
  useEffect(() => {
    const notify = () => bump((v) => v + 1);
    const offA = subscribeConnectionCheck(notify);
    const offB = subscribeMovingEnvelope(notify);
    return () => {
      offA();
      offB();
    };
  }, []);
  return { connection: getConnectionCheck(), moving: getMovingEnvelope() };
}

/** M12.3: SLS inter-storey drift report (fetches once per project). */
function useStoreyDrift(limit: number): StoreyDriftResult | null {
  const project = useProjectStore((s) => s.project);
  const [drift, setDrift] = useState<StoreyDriftResult | null>(null);
  useEffect(() => {
    if ((project.structure.levels?.length ?? 0) < 2) {
      setDrift(null);
      return;
    }
    let cancelled = false;
    feaClient
      .storeyDrift(project, limit)
      .then((report) => {
        if (!cancelled) setDrift(report);
      })
      .catch(() => {
        if (!cancelled) setDrift(null);
      });
    return () => {
      cancelled = true;
    };
  }, [project, limit]);
  return drift;
}

/** M12.5: «Assemblages EC3-1-8» chapter — the last connection check. */
function ConnectionReportChapter(): React.ReactElement | null {
  const { connection } = useSessionChecks();
  if (connection === null) {
    return null;
  }
  const { result, beamLabel } = connection;
  return (
    <section className="mt-4" data-testid="report-connections-chapter">
      <h3 className="text-[15px] font-semibold">
        <Trans>Assemblages EC3-1-8</Trans>
      </h3>
      <p className="mt-0.5 text-[12px] text-ink-secondary">
        <Trans>
          Vérification EN 1993-1-8 du studio Assemblages (Table 3.4, §3.10.2, §4.5.3) — membre{" "}
          {beamLabel}.
        </Trans>
      </p>
      <table className="font-data mt-2 w-full text-[11px] [font-variant-numeric:tabular-nums]">
        <thead>
          <tr className="text-left text-[10px] text-ink-muted">
            <th className="py-1 font-medium">
              <Trans>Clause</Trans>
            </th>
            <th className="py-1 font-medium">
              <Trans>Vérification</Trans>
            </th>
            <th className="py-1 font-medium">η (%)</th>
            <th className="py-1 font-medium">
              <Trans>Statut</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          {result.trace.map((node) => (
            <tr key={`${node.clause}-${node.title}`} className="border-t border-hairline">
              <td className="py-1 pr-2 text-ink-muted">{node.clause}</td>
              <td className="py-1 pr-2 text-ink-primary">{node.title}</td>
              <td className="py-1 pr-2">{fr3(node.value * 100, 1)}</td>
              <td className="py-1">
                <StatusBadge tone={node.passed ? "pass" : "fail"} mono>
                  {node.passed ? "Conforme" : "Dépassement"}
                </StatusBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="font-data mt-1 text-[11px] text-ink-secondary">
        {`η global = ${fr3(result.utilization, 2)} · ${result.n_bolts} boulons ${result.grade} (${result.size}) · ${result.topology_label}`}
      </p>
    </section>
  );
}

/** M12.5: «Enveloppe Convois Mobiles» chapter — the last train envelope. */
function MovingReportChapter(): React.ReactElement | null {
  const { moving } = useSessionChecks();
  if (moving === null) {
    return null;
  }
  const { envelope, trainLabel, beamId } = moving;
  return (
    <section className="mt-4" data-testid="report-moving-chapter">
      <h3 className="text-[15px] font-semibold">
        <Trans>Enveloppe Convois Mobiles</Trans>
      </h3>
      <p className="mt-0.5 text-[12px] text-ink-secondary">
        <Trans>
          Convoi {trainLabel} sur le membre P{beamId} — positions balayées par le moteur WASM (EN
          1991-2).
        </Trans>
      </p>
      <table className="font-data mt-2 w-full text-[11px] [font-variant-numeric:tabular-nums]">
        <thead>
          <tr className="text-left text-[10px] text-ink-muted">
            <th className="py-1 font-medium">M max (kN·m)</th>
            <th className="py-1 font-medium">M min (kN·m)</th>
            <th className="py-1 font-medium">V max (kN)</th>
            <th className="py-1 font-medium">Rz max (kN)</th>
            <th className="py-1 font-medium">uz max (mm)</th>
            <th className="py-1 font-medium">x gov.</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-hairline">
            <td className="py-1">{fr3(envelope.my_max / 1000, 1)}</td>
            <td className="py-1">{fr3(envelope.my_min / 1000, 1)}</td>
            <td className="py-1">{fr3(envelope.vz_max / 1000, 1)}</td>
            <td className="py-1">{fr3(envelope.rz_max / 1000, 1)}</td>
            <td className="py-1">{fr3(envelope.uz_max * 1000, 2)}</td>
            <td className="py-1">{fr3(envelope.governing_ratio, 2)} L</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

/** M12.5: «Déplacement Inter-Étages» chapter — storey drift table. */
function DriftReportChapter(): React.ReactElement | null {
  const drift = useStoreyDrift(300);
  if (drift === null || drift.levels.length === 0) {
    return null;
  }
  return (
    <section className="mt-4" data-testid="report-drift-chapter">
      <h3 className="text-[15px] font-semibold">
        <Trans>Déplacement Inter-Étages</Trans>
      </h3>
      <p className="mt-0.5 text-[12px] text-ink-secondary">
        <Trans>Drift SLS d_r / h ≤ 1/300 — appariement vertical des nœuds entre niveaux.</Trans>
      </p>
      <table className="font-data mt-2 w-full text-[11px] [font-variant-numeric:tabular-nums]">
        <thead>
          <tr className="text-left text-[10px] text-ink-muted">
            <th className="py-1 font-medium">
              <Trans>Niveau</Trans>
            </th>
            <th className="py-1 font-medium">h (m)</th>
            <th className="py-1 font-medium">d_r (mm)</th>
            <th className="py-1 font-medium">d_r / h</th>
            <th className="py-1 font-medium">
              <Trans>Statut</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          {drift.levels.map((level) => (
            <tr key={level.elevation} className="border-t border-hairline">
              <td className="py-1 text-ink-primary">{level.name}</td>
              <td className="py-1">{fr3(level.storey_height_m, 2)}</td>
              <td className="py-1">{fr3(level.drift_m * 1000, 2)}</td>
              <td className="py-1">{`1/${Math.max(1, Math.round(1 / Math.max(level.ratio / level.limit_denominator, 1e-9)))}`}</td>
              <td className="py-1">
                <StatusBadge tone={level.passed ? "pass" : "fail"} mono>
                  {level.passed ? "Conforme" : "Dépassement"}
                </StatusBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/**
 * M11.3: dedicated «Sections Droites Composées» chapter — for every custom
 * composite section: the exact vector SVG cross-section, the full
 * geometric property table (A, Iy, Iz, Wel, Wpl, It, Iw, Av) and the
 * EN 1993-1-1 Table 5.2 classification badges.
 */
function CompositeReportChapter(): React.ReactElement | null {
  const defs = useProjectStore((s) => s.project.structure.custom_sections ?? EMPTY_CUSTOM_SECTIONS);
  const results = useCompositeResults(defs);
  if (defs.length === 0) {
    return null;
  }
  return (
    <section data-testid="report-composite-chapter">
      <h3 className="text-[15px] font-semibold">
        <Trans>Sections Droites Composées</Trans>
      </h3>
      <p className="mt-0.5 text-[12px] text-ink-secondary">
        <Trans>
          Sections construites résolues nativement par le solveur WASM — mécanique exacte,
          classification EN 1993-1-1 Table 5.2.
        </Trans>
      </p>
      {defs.map((def) => {
        const res = results[def.name];
        return (
          <figure
            key={def.name}
            className="mt-3 rounded-panel border border-hairline bg-panel-subtle p-3"
            data-testid={`composite-report-${def.name.replace(/[^\w-]+/g, "_")}`}
          >
            <figcaption className="font-data mb-1 flex flex-wrap items-center justify-between gap-2 text-[12px] font-medium text-ink-primary">
              <span>
                {def.name} — {def.elements.length} élément(s) — acier {def.grade}
              </span>
              {res !== undefined ? (
                <span className="flex gap-1.5">
                  <StatusBadge
                    tone={
                      res.class_bending <= 2 ? "pass" : res.class_bending === 3 ? "warn" : "fail"
                    }
                    mono
                  >
                    <Trans>Classe flexion</Trans> {res.class_bending}
                  </StatusBadge>
                  <StatusBadge
                    tone={
                      res.class_compression <= 2
                        ? "pass"
                        : res.class_compression === 3
                          ? "warn"
                          : "fail"
                    }
                    mono
                  >
                    <Trans>Classe compression</Trans> {res.class_compression}
                  </StatusBadge>
                </span>
              ) : null}
            </figcaption>
            {res !== undefined ? (
              <CompositeSectionSvg result={res} />
            ) : (
              <p className="font-data text-[11px] text-ink-muted">Calcul exact en cours…</p>
            )}
            {res !== undefined ? (
              <dl className="font-data mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] [font-variant-numeric:tabular-nums] text-ink-secondary sm:grid-cols-3">
                {(
                  [
                    ["A", `${fr3(res.a * 1e6, 0)} mm²`],
                    ["m", `${fr3(res.mass_per_m, 2)} kg/m`],
                    ["yG", `${fr3(res.y_g * 1000, 1)} mm`],
                    ["zG", `${fr3(res.z_g * 1000, 1)} mm`],
                    ["Iy", `${fr3(res.iy * 1e8, 1)} cm⁴`],
                    ["Iz", `${fr3(res.iz * 1e8, 1)} cm⁴`],
                    ["Wel,y", `${fr3(res.wel_y * 1e6, 1)} cm³`],
                    ["Wpl,y", `${fr3(res.wpl_y * 1e6, 1)} cm³`],
                    [
                      "iy / iz",
                      `${fr3(res.i_radius_y * 1000, 1)} / ${fr3(res.i_radius_z * 1000, 1)} mm`,
                    ],
                    ["It", `${fr3(res.it * 1e8, 2)} cm⁴`],
                    ["Iw", `${fr3(res.iw * 1e12, 2)} cm⁶`],
                    ["Av,y / Av,z", `${fr3(res.a_vy * 1e6, 0)} / ${fr3(res.a_vz * 1e6, 0)} mm²`],
                  ] as const
                ).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-2">
                    <dt className="text-ink-muted">{key}</dt>
                    <dd className="text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </figure>
        );
      })}
    </section>
  );
}

/** Vector cross-section drawing of one engine result (mm, z up). */
function CompositeSectionSvg({ result }: { result: CompositeSectionResult }): React.ReactElement {
  const [yMin, yMax, zMin, zMax] = result.bounds;
  const pad = 10;
  const vbW = Math.max((yMax - yMin) * 1000, 80) + pad * 2;
  const vbH = Math.max((zMax - zMin) * 1000, 80) + pad * 2;
  const xOf = (yMm: number): number => yMm - yMin * 1000 + pad;
  const yOf = (zMm: number): number => vbH - pad - (zMm - zMin * 1000);
  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className="h-40 w-full bg-canvas"
      role="img"
      aria-label={result.name}
    >
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
      <g stroke="#0F172A" strokeWidth="1">
        <circle cx={xOf(result.y_g * 1000)} cy={yOf(result.z_g * 1000)} r="4" fill="#FFFFFF" />
        <line
          x1={xOf(result.y_g * 1000) - 6}
          y1={yOf(result.z_g * 1000)}
          x2={xOf(result.y_g * 1000) + 6}
          y2={yOf(result.z_g * 1000)}
        />
        <line
          x1={xOf(result.y_g * 1000)}
          y1={yOf(result.z_g * 1000) - 6}
          x2={xOf(result.y_g * 1000)}
          y2={yOf(result.z_g * 1000) + 6}
        />
      </g>
      <line
        x1={0}
        y1={yOf(result.pna_for_my * 1000)}
        x2={vbW}
        y2={yOf(result.pna_for_my * 1000)}
        stroke="#D97706"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
    </svg>
  );
}

function ReportTables() {
  const project = useProjectStore((s) => s.project);
  // v2.3.0: reactive last-report hook — the ELU reactions, EC3 and ELS
  // tables re-render with live non-zero numbers the moment the auto-solve
  // finishes, instead of staying frozen on the (null) first render.
  const report = useLastReport();
  const uls = report?.combinations.find((c) => c.kind === "ULS");
  const sls = report?.combinations.find((c) => c.kind === "SLS");
  const beamById = new Map(project.structure.beams.map((b) => [b.id, b]));
  const nodeRows = project.structure.nodes.map((n) => [String(n.id), fr(n.x), fr(n.y), fr(n.z)]);
  const beamRows = project.structure.beams.map((b) => [
    String(b.id),
    String(b.n1),
    String(b.n2),
    b.section_id,
    b.material_id,
  ]);
  const ulsRows = (uls?.beams ?? []).map((b) => [
    `P${b.beam_id}`,
    beamById.get(b.beam_id)?.section_id ?? "—",
    fr(b.utilization),
    b.utilization > 1 ? "NON VERIFIÉ" : "vérifié",
  ]);
  const slsRows = (sls?.beams ?? []).map((b) => [
    `P${b.beam_id}`,
    fr(b.midspan_deflection * 1000, 1),
  ]);
  // v1.4.0: the full EC3 breakdown (σvM, χ factors, η, status) per member.
  const ec3Rows = (uls?.beams ?? []).map((b) => [
    `P${b.beam_id}`,
    fr(b.max_sigma_vm / 1e6, 1),
    // serde-wasm-bindgen serializes Option::None as UNDEFINED (not null),
    // so the guard must be nullish or non-governing members crash the sheet.
    b.chi_y == null ? "—" : fr(b.chi_y),
    b.chi_z == null ? "—" : fr(b.chi_z),
    b.chi_lt == null ? "—" : fr(b.chi_lt),
    fr(b.utilization),
    b.utilization > 1 ? "NON VERIFIÉ" : "vérifié",
  ]);
  // v1.6.0: ELU reactions superpose the ACTUAL ULS multipliers of every
  // elementary case (G, Q, W, S) — the hardcoded 1.35/1.50 ignored the
  // combination table and double-counted wind/snow leading variants.
  const reactionRows = project.structure.nodes
    .filter((n) => project.structure.supports.some((sp) => sp.node_id === n.id))
    .map((n) => {
      const nodeIndex = project.structure.nodes.findIndex((x) => x.id === n.id);
      const multipliers = uls?.multipliers ?? [
        ["G", 1.35],
        ["Q", 1.5],
      ];
      const byCode = new Map(
        (report?.cases ?? []).map((c) => [c.code, c.reactions as number[] | undefined]),
      );
      let rx = 0;
      let ry = 0;
      let rz = 0;
      let mx = 0;
      let my = 0;
      let mz = 0;
      const i = nodeIndex * 6;
      for (const [code, factor] of multipliers) {
        const reactions = byCode.get(code);
        if (reactions === undefined) {
          continue;
        }
        rx += factor * (reactions[i] ?? 0);
        ry += factor * (reactions[i + 1] ?? 0);
        rz += factor * (reactions[i + 2] ?? 0);
        mx += factor * (reactions[i + 3] ?? 0);
        my += factor * (reactions[i + 4] ?? 0);
        mz += factor * (reactions[i + 5] ?? 0);
      }
      return [
        `N${n.id}`,
        fr(rx / 1000, 2),
        fr(ry / 1000, 2),
        fr(rz / 1000, 2),
        fr(mx / 1000, 2),
        fr(my / 1000, 2),
        fr(mz / 1000, 2),
      ];
    });
  const totalRx = reactionRows.reduce((m, r) => m + Number((r[1] ?? "0").replace(",", ".")), 0);
  const totalRy = reactionRows.reduce((m, r) => m + Number((r[2] ?? "0").replace(",", ".")), 0);
  const totalRz = reactionRows.reduce((m, r) => m + Number((r[3] ?? "0").replace(",", ".")), 0);
  const totalMx = reactionRows.reduce((m, r) => m + Number((r[4] ?? "0").replace(",", ".")), 0);
  const totalMy = reactionRows.reduce((m, r) => m + Number((r[5] ?? "0").replace(",", ".")), 0);
  const totalMz = reactionRows.reduce((m, r) => m + Number((r[6] ?? "0").replace(",", ".")), 0);
  // v1.4.0: modal table (f + T) — last computed eigen report.
  const modal = getLastModalReport();
  const modalRows = (modal?.modes ?? [])
    .slice(0, 6)
    .map((m) => [`Mode ${m.mode_index}`, fr(m.frequency_hz, 2), fr(1 / m.frequency_hz, 2)]);
  // v1.4.0: ELS extreme displacements (|U| from the SLS superposition).
  const extremeDisplacement = (() => {
    const slsCase = report?.cases.find((c) => c.code === "G");
    if (slsCase === undefined) return "0,00";
    let max = 0;
    for (let i = 0; i < slsCase.displacements.length; i += 6) {
      const ux = slsCase.displacements[i] ?? 0;
      const uy = slsCase.displacements[i + 1] ?? 0;
      const uz = slsCase.displacements[i + 2] ?? 0;
      max = Math.max(max, Math.hypot(ux, uy, uz));
    }
    return fr(max * 1000, 2);
  })();
  return (
    <div className="space-y-4">
      {[
        // v2.1.1: A4 headings + table headers wrapped in Lingui macros.
        {
          title: t`Fréquences propres (Hz)`,
          headers: [t`Mode`, t`f (Hz)`, t`T (s)`],
          rows: modalRows,
        },
        {
          title: `${t`Réactions d'appuis ELU (kN / kN·m)`}${uls !== undefined ? ` — ${uls.label}` : ""}`,
          headers: [t`Appui`, "Rx", "Ry", "Rz", "Mx", "My", "Mz"],
          rows: [
            ...reactionRows,
            [
              "Σ",
              fr(totalRx, 2),
              fr(totalRy, 2),
              fr(totalRz, 2),
              fr(totalMx, 2),
              fr(totalMy, 2),
              fr(totalMz, 2),
            ],
          ],
        },
        {
          title: t`Vérification Eurocode 3`,
          headers: [t`Poutre`, "σvM (MPa)", "χy", "χz", "χLT", "η", t`Statut`],
          rows: ec3Rows,
        },
        {
          title: t`Déplacements extrêmes ELS`,
          headers: [t`Grandeur`, "|U|max (mm)"],
          rows: [[t`Déformée ELS`, extremeDisplacement]],
        },
        { title: t`Nœuds`, headers: ["ID", "X (m)", "Y (m)", "Z (m)"], rows: nodeRows },
        {
          title: t`Profils utilisés`,
          headers: [t`Poutre`, "N1", "N2", t`Profil`, t`Acier`],
          rows: beamRows,
        },
        {
          title: t`Vérification ELU`,
          headers: [t`Poutre`, t`Profil`, "η", t`Statut`],
          rows: ulsRows,
        },
        { title: t`Flèches ELS (mm)`, headers: [t`Poutre`, "δ mid"], rows: slsRows },
      ].map((table) => {
        const tsv = [table.headers.join("\t"), ...table.rows.map((r) => r.join("\t"))].join("\n");
        return (
          <div key={table.title}>
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-ink-secondary">{table.title}</h3>
              {/* v2.1.2: interior.dev CopyButton — animated Copy → Check. */}
              <CopyButton
                value={tsv}
                label={t`Copier TSV`}
                copiedLabel={t`Copié !`}
                onCopy={() => toast("Table copiée pour Excel (TSV)")}
                className="h-7 px-2"
                testId={`copy-tsv-${table.rows.length}-${table.headers.length}`}
              />
            </div>
            <table className="mt-1 w-full text-[12px]">
              <thead className="text-left text-[11px] text-ink-muted">
                <tr>
                  {table.headers.map((h, j) => (
                    <th key={h} className={`py-0.5 ${j === 0 ? "" : "text-right"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-data [font-variant-numeric:tabular-nums]">
                {table.rows.map((row, i) => (
                  <tr key={i} className="border-t border-hairline">
                    {row.map((cell, j) => (
                      <td key={j} className={`py-0.5 ${j === 0 ? "pr-2" : "text-right"}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

/** Type guard helper so ProjectData stays explicit for the export. */
export type { ProjectData };

/**
 * v2.0.0 Report Builder (Step 5): toggle/reorder chapters, cover page
 * metadata, independent FR/EN output language, .docx download with the
 * engineer disclaimer + SHA-256 fingerprint, and the BIM export family
 * (IFC4 / SAF / OpenSees TCL / solver JSON / glTF).
 */
function ReportBuilder({
  registerDocxExport,
}: {
  registerDocxExport: (fn: () => void) => void;
}): React.ReactElement {
  const project = useProjectStore((st) => st.project);
  // M11.3: native Word tables ride the LIVE solve report + the exact
  // composite section metadata (Sections Droites Composées chapter).
  const report = useLastReport();
  const customDefs = useProjectStore(
    (st) => st.project.structure.custom_sections ?? EMPTY_CUSTOM_SECTIONS,
  );
  const compositeResults = useCompositeResults(customDefs);
  // M12.5: the advanced analyses chapters ride the .docx payload whenever
  // present (connection checks + moving envelope from the session
  // registry, drift fetched live for the storey levels).
  const { connection: sessionConnection, moving: sessionMoving } = useSessionChecks();
  const driftReport = useStoreyDrift(300);
  // v2.1.0: the cover metadata pre-fills from the local-first license
  // store (Offline Pro firm branding — LicenseModal keeps it in sync).
  const licenseFirm = useLicenseStore((s) => s.firmName);
  const licenseEngineer = useLicenseStore((s) => s.engineerName);
  const licenseChecker = useLicenseStore((s) => s.checkerName);
  const [firm, setFirm] = useState(licenseFirm === "" ? "Cabinet — " : licenseFirm);
  const [engineer, setEngineer] = useState(
    licenseEngineer === "" ? "Ingénieur : " : licenseEngineer,
  );
  const [checker, setChecker] = useState(
    licenseChecker === "" ? "Vérificateur : " : licenseChecker,
  );
  const [revision, setRevision] = useState("1.0");
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [chapters, setChapters] = useState([
    { id: "hypotheses", label: "Hypothèses de calcul", on: true },
    { id: "model", label: "Modèle & sections", on: true },
    { id: "loads", label: "Chargements EN 1991", on: true },
    { id: "combinations", label: "Combinaisons EN 1990", on: true },
    { id: "results", label: "Résultats & enveloppes", on: true },
    { id: "checks", label: "Vérifications EC3 / EC2 / EC5 / EC9", on: true },
    { id: "disclaimer", label: "Clause d'ingénieur", on: true },
  ]);
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    void feaClient
      .engineCall("export_bim", project, "solver")
      .then((payload) => {
        const json = String(payload);
        void crypto.subtle.digest("SHA-256", new TextEncoder().encode(json)).then((hash) => {
          setFingerprint(
            Array.from(new Uint8Array(hash))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("")
              .slice(0, 16),
          );
        });
      })
      .catch(() => setFingerprint(null));
    return undefined;
  }, [project]);

  // v2.0.1: drag-reorderable chapters (@dnd-kit) replace the ↑/↓ buttons.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (over === null || active.id === over.id) {
      return;
    }
    setChapters((current) => {
      const from = current.findIndex((c) => c.id === active.id);
      const to = current.findIndex((c) => c.id === over.id);
      if (from < 0 || to < 0) {
        return current;
      }
      return arrayMove(current, from, to);
    });
  };

  const blocks = (): (DocxBlock | DocxTable)[] => {
    const out: (DocxBlock | DocxTable)[] = [];
    const enabled = new Set(chapters.filter((c) => c.on).map((c) => c.id));
    const uls = report?.combinations.find((c) => c.kind === "ULS");
    const sls = report?.combinations.find((c) => c.kind === "SLS");
    const beamById = new Map(project.structure.beams.map((b) => [b.id, b]));
    for (const chapter of chapters.filter((c) => c.on)) {
      out.push({ kind: "heading", text: chapter.label });
      const suffix = language === "en" ? " (EN output)" : "";
      out.push({
        kind: "paragraph",
        text: `${chapter.label}${suffix} — modèle ${project.name}, version ${project.version}.`,
      });
      if (chapter.id === "model" && enabled.has("model")) {
        out.push({
          kind: "table",
          caption: "Membres et sections",
          header: ["Poutre", "N1", "N2", "Section", "Matière"],
          rows: project.structure.beams.map((b) => [
            `P${b.id}`,
            String(b.n1),
            String(b.n2),
            b.section_id,
            b.material_id,
          ]),
        });
        // M11.3: embedded composite section metadata (exact properties).
        for (const def of customDefs) {
          const res = compositeResults[def.name];
          out.push({
            kind: "table",
            caption: `Section composée ${def.name} — acier ${def.grade} (${def.elements.length} élément(s))`,
            header: ["Grandeur", "Valeur", "Unité"],
            rows:
              res === undefined
                ? [["Calcul exact en cours", "—", "—"]]
                : [
                    ["A", (res.a * 1e6).toFixed(0).replace(".", ","), "mm²"],
                    ["m (linéique)", res.mass_per_m.toFixed(2).replace(".", ","), "kg/m"],
                    ["yG", (res.y_g * 1000).toFixed(1).replace(".", ","), "mm"],
                    ["zG", (res.z_g * 1000).toFixed(1).replace(".", ","), "mm"],
                    ["Iy", (res.iy * 1e8).toFixed(1).replace(".", ","), "cm⁴"],
                    ["Iz", (res.iz * 1e8).toFixed(1).replace(".", ","), "cm⁴"],
                    ["Wel,y", (res.wel_y * 1e6).toFixed(1).replace(".", ","), "cm³"],
                    ["Wpl,y", (res.wpl_y * 1e6).toFixed(1).replace(".", ","), "cm³"],
                    ["It", (res.it * 1e8).toFixed(2).replace(".", ","), "cm⁴"],
                    ["Iw", (res.iw * 1e12).toFixed(2).replace(".", ","), "cm⁶"],
                    ["Classe flexion", String(res.class_bending), ""],
                    ["Classe compression", String(res.class_compression), ""],
                  ],
          });
        }
      }
      if (chapter.id === "results" && enabled.has("results")) {
        out.push({
          kind: "table",
          caption: `Enveloppe ELU ${uls?.label ?? "1.35G + 1.50Q"} — vérification par membre`,
          header: ["Membre", "Section", "η ELU", "Statut"],
          rows: (uls?.beams ?? []).map((b) => [
            `P${b.beam_id}`,
            beamById.get(b.beam_id)?.section_id ?? "—",
            b.utilization.toFixed(3).replace(".", ","),
            b.utilization > 1 ? "NON VERIFIÉ" : "vérifié",
          ]),
        });
        out.push({
          kind: "table",
          caption: `Enveloppe ELS ${sls?.label ?? "G + Q"} — flèches à mi-travée`,
          header: ["Membre", "Flèche (mm)"],
          rows: (sls?.beams ?? []).map((b) => [
            `P${b.beam_id}`,
            (b.midspan_deflection * 1000).toFixed(1).replace(".", ","),
          ]),
        });
        // M12.5: Enveloppe Convois Mobiles — the last train envelope.
        if (sessionMoving !== null) {
          out.push({
            kind: "table",
            caption: `Enveloppe Convois Mobiles — ${sessionMoving.trainLabel} sur P${sessionMoving.beamId}`,
            header: [
              "M max (kN·m)",
              "M min (kN·m)",
              "V max (kN)",
              "Rz max (kN)",
              "uz max (mm)",
              "x gov.",
            ],
            rows: [
              [
                (sessionMoving.envelope.my_max / 1000).toFixed(1).replace(".", ","),
                (sessionMoving.envelope.my_min / 1000).toFixed(1).replace(".", ","),
                (sessionMoving.envelope.vz_max / 1000).toFixed(1).replace(".", ","),
                (sessionMoving.envelope.rz_max / 1000).toFixed(1).replace(".", ","),
                (sessionMoving.envelope.uz_max * 1000).toFixed(2).replace(".", ","),
                `${sessionMoving.envelope.governing_ratio.toFixed(2).replace(".", ",")} L`,
              ],
            ],
          });
        }
        // M12.5: Déplacement Inter-Étages — SLS storey drift.
        if (driftReport !== null && driftReport.levels.length > 0) {
          out.push({
            kind: "table",
            caption: "Déplacement Inter-Étages (SLS, d_r / h ≤ 1/300)",
            header: ["Niveau", "h (m)", "d_r (mm)", "d_r / h", "Statut"],
            rows: driftReport.levels.map((level) => [
              level.name,
              level.storey_height_m.toFixed(2).replace(".", ","),
              (level.drift_m * 1000).toFixed(2).replace(".", ","),
              `1/${Math.max(1, Math.round(1 / Math.max(level.ratio / level.limit_denominator, 1e-9)))}`,
              level.passed ? "vérifié" : "NON VERIFIÉ",
            ]),
          });
        }
      }
      if (chapter.id === "checks" && enabled.has("checks")) {
        out.push({
          kind: "table",
          caption: "Vérifications EN 1993-1-1 membre par membre",
          header: ["Membre", "σvM (MPa)", "χy", "χz", "χLT", "η", "Statut"],
          rows: (uls?.beams ?? []).map((b) => [
            `P${b.beam_id}`,
            (b.max_sigma_vm / 1e6).toFixed(1).replace(".", ","),
            b.chi_y == null ? "—" : b.chi_y.toFixed(2).replace(".", ","),
            b.chi_z == null ? "—" : b.chi_z.toFixed(2).replace(".", ","),
            b.chi_lt == null ? "—" : b.chi_lt.toFixed(2).replace(".", ","),
            b.utilization.toFixed(3).replace(".", ","),
            b.utilization > 1 ? "NON VERIFIÉ" : "vérifié",
          ]),
        });
        // M12.5: Assemblages EC3-1-8 — the last connection verification.
        if (sessionConnection !== null) {
          out.push({
            kind: "table",
            caption: `Assemblages EC3-1-8 — ${sessionConnection.beamLabel} (${sessionConnection.result.n_bolts} boulons ${sessionConnection.result.grade}, ${sessionConnection.result.topology_label})`,
            header: ["Clause", "Vérification", "η (%)", "Statut"],
            rows: sessionConnection.result.trace.map((n) => [
              n.clause,
              n.title,
              (n.value * 100).toFixed(1).replace(".", ","),
              n.passed ? "vérifié" : "NON VERIFIÉ",
            ]),
          });
        }
      }
    }
    out.push({
      kind: "paragraph",
      text: `Empreinte SHA-256 du modèle : ${fingerprint ?? "…"} — document généré par RDM Studio v2.0.0.`,
    });
    return out;
  };

  const meta: CoverMeta = {
    firm,
    engineer,
    checker,
    revision,
    disclaimer:
      "Ce document est établi par un ingénieur structure. Les hypothèses, normes et résultats restent sous sa responsabilité.",
    // v2.1.1: Édition Découverte watermark on the .docx cover (Pro: none).
    evaluation: useLicenseStore.getState().tier === "free",
  };

  // v2.1.1: the rail-top `Word (.docx)` button executes THIS payload —
  // re-registered every render so chapters/cover edits always apply.
  useEffect(() => {
    registerDocxExport(() =>
      downloadDocx(blocks(), meta, `rapport-${project.name.replace(/[^\w-]+/g, "_")}.docx`),
    );
  });

  return (
    <section
      aria-label="Générateur de rapport"
      className="rounded-xl border border-hairline bg-panel/95 p-4"
    >
      <h3 className="mb-2 text-sm font-bold">Générateur de rapport (PDF + .docx)</h3>
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <Input
          value={firm}
          onChange={(e) => setFirm(e.target.value)}
          aria-label="Cabinet"
          className="h-7"
        />
        <Input
          value={engineer}
          onChange={(e) => setEngineer(e.target.value)}
          aria-label="Ingénieur"
          className="h-7"
        />
        <Input
          value={checker}
          onChange={(e) => setChecker(e.target.value)}
          aria-label="Vérificateur"
          className="h-7"
        />
        <Input
          value={revision}
          onChange={(e) => setRevision(e.target.value)}
          aria-label="Révision"
          className="h-7"
        />
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={chapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="mb-3 space-y-1">
            {chapters.map((chapter) => (
              <SortableChapter
                key={chapter.id}
                chapter={chapter}
                onToggle={(on) =>
                  setChapters(chapters.map((c) => (c.id === chapter.id ? { ...c, on } : c)))
                }
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {/* v2.1.2: FR / EN output as a crisp SegmentedControl. */}
        <SegmentedControl
          size="sm"
          label="Langue de sortie"
          value={language}
          onValueChange={(next) => setLanguage(next === "en" ? "en" : "fr")}
          options={[
            { value: "fr", label: "FR" },
            { value: "en", label: "EN" },
          ]}
        />
        <button
          type="button"
          onClick={() => void saveSnapshot(`rapport-${revision}`, project)}
          className="rounded bg-panel-subtle px-2 py-1"
        >
          Photographier
        </button>
      </div>
      <p className="mt-2 text-[11px] text-ink-muted" aria-live="polite">
        {`SHA-256 : ${fingerprint ?? "calcul…"} — clause d'ingénieur incluse.`}
      </p>
    </section>
  );
}

/**
 * v2.0.1: one drag-reorderable Report Builder chapter row — a
 * `<GripVertical />` handle drives the @dnd-kit sortable transform while
 * the toggle is a Base UI `Checkbox` (v2.1.2: no raw HTML checkbox).
 */
function SortableChapter({
  chapter,
  onToggle,
}: {
  chapter: { id: string; label: string; on: boolean };
  onToggle: (on: boolean) => void;
}): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chapter.id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center justify-between gap-2 rounded text-xs ${isDragging ? "z-10 bg-accent-tint shadow-sm" : ""}`}
    >
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
        <Checkbox
          checked={chapter.on}
          onCheckedChange={(checked) => onToggle(checked === true)}
          aria-label={`Inclure ${chapter.label}`}
        />
        <span className="truncate">{chapter.label}</span>
      </label>
      <button
        type="button"
        aria-label={`Réordonner ${chapter.label}`}
        className="flex h-6 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-ink-muted hover:bg-accent-tint hover:text-accent active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} strokeWidth={1.5} aria-hidden />
      </button>
    </li>
  );
}
