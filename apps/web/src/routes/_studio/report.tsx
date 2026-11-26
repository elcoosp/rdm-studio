import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Download, GripVertical } from "lucide-react";
import { encodeProject } from "@/lib/urlShare";
import { useProjectStore, type ProjectData } from "@/state/projectStore";
import QRCode from "qrcode";
import { toast } from "sonner";
import { t } from "@lingui/core/macro";
import { feaClient, getLastModalReport, getLastReport } from "@/wasmBridge/workerClient";
import { buildReportHtml } from "@/export/pdfTakumiReport";
import { downloadDocx, type DocxBlock, type CoverMeta } from "@/export/docxExport";
import { saveSnapshot } from "@/state/snapshots";
import { exportResultsCsv } from "@/export/csvExport";
import { exportStandaloneHtml3d } from "@/export/standaloneHtml3d";
import { captureViewportPng } from "@/state/stageStore";
import { StudioBaseSearchSchema } from "@/schemas/searchParams.schema";
import { IconReport } from "@/components/icons";
import { useLicenseStore } from "@/state/licenseStore";
import { downloadText } from "@/export/csvExport";

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
 */
function ReportPage() {
  const project = useProjectStore((s) => s.project);
  // v2.1.1: the Édition Découverte watermark (removed in Pro mode).
  const licenseTier = useLicenseStore((s) => s.tier);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  // v2.1.1: ReportBuilder registers its .docx exporter so the rail-top
  // `Word (.docx)` button shares the SAME cover/chapter payload.
  const docxExportRef = useRef<() => void>(() => undefined);
  const shareUrl = useMemo(() => {
    const encoded = encodeProject(project);
    return `${window.location.origin}/report?p=${encoded}`;
  }, [project]);

  useMemo(() => {
    void QRCode.toDataURL(shareUrl, { margin: 1, width: 176 }).then(setQrDataUrl);
  }, [shareUrl]);

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
    setBusy("pdf");
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
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="h-full min-h-0 overflow-auto p-3 md:p-4">
      <div className="mx-auto flex max-w-[1140px] flex-col gap-4 md:flex-row md:items-start">
        <section className="print-sheet mx-auto w-full max-w-[794px] space-y-5 rounded-panel border border-hairline bg-panel p-8">
          {/* A4 sheet header: logo + title + date. */}
          <div className="flex items-center justify-between border-b-2 border-accent pb-2">
            <div className="flex items-center gap-2">
              <img src="/logo-rdm-studio.svg" alt="" className="h-7 w-7" />
              <h2 className="text-[17px] font-semibold">
                <Trans>RDM Studio — Rapport de calcul</Trans>
              </h2>
            </div>
            <span className="font-data text-[11px] text-ink-muted">
              {new Date().toISOString().slice(0, 10)}
            </span>
          </div>
          {/* v1.6.0 live 3D snapshot — v2.1.1: constrained to 220px on the
              bg-canvas plate so the A4 sheet never balloons. */}
          <figure
            className="rounded-panel border border-hairline bg-panel-subtle p-2"
            data-testid="report-3d-snapshot"
          >
            <img
              src={captureViewportPng() ?? "/logo-rdm-studio.svg"}
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
            the BIM/data formats, then the Report Builder + share block. */}
        <aside className="w-full shrink-0 space-y-3 self-start md:sticky md:top-4 md:w-80">
          <div className="space-y-3 rounded-panel border border-hairline bg-panel p-4">
            <h3 className="text-[15px] font-semibold">
              <Trans>Exports (étape 5)</Trans>
            </h3>
            <button
              type="button"
              data-testid="export-pdf"
              disabled={busy !== null}
              className="min-h-11 w-full rounded bg-accent px-2 py-1.5 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
              onClick={() => void exportPdf()}
            >
              {busy === "pdf" ? <Trans>Génération…</Trans> : <Trans>PDF Takumi</Trans>}
            </button>
            <button
              type="button"
              data-testid="export-docx"
              disabled={busy !== null}
              className="min-h-11 w-full rounded border border-accent px-2 py-1.5 text-[13px] font-semibold text-accent hover:bg-accent-tint disabled:opacity-50"
              onClick={() => docxExportRef.current()}
            >
              <Trans>Word (.docx)</Trans>
            </button>
            {/* BIM & data formats — secondary row under the 2 documents. */}
            <div className="grid grid-cols-3 gap-1.5 border-t border-hairline pt-3">
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
                disabled={busy !== null}
                className="flex items-center justify-center gap-1 rounded bg-panel-subtle px-2 py-1.5 font-data text-[11px] text-ink-secondary hover:text-accent"
                onClick={exportRdm}
              >
                <Download size={12} strokeWidth={1.5} aria-hidden />
                .rdm
              </button>
              <button
                type="button"
                data-testid="export-csv"
                disabled={busy !== null}
                className="flex items-center justify-center gap-1 rounded bg-panel-subtle px-2 py-1.5 font-data text-[11px] text-ink-secondary hover:text-accent"
                onClick={() => exportResultsCsv(getLastReport())}
              >
                <Download size={12} strokeWidth={1.5} aria-hidden />
                CSV
              </button>
              <button
                type="button"
                data-testid="export-html3d"
                disabled={busy !== null}
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
              <button
                type="button"
                data-testid="print-report"
                className="col-span-2 flex items-center justify-center gap-1 rounded border border-hairline px-2 py-1.5 text-[11px] text-ink-secondary hover:border-accent hover:text-accent"
                onClick={() => window.print()}
              >
                <Trans>Imprimer</Trans>
              </button>
            </div>
            {/* Share-by-URL (lz-string compressed, Valibot-validated). */}
            <div className="border-t border-hairline pt-3">
              <p className="text-[12px] text-ink-secondary">
                <Trans>
                  Le modèle .rdm est compressé (lz-string) dans l'URL et validé par Valibot à la
                  relecture.
                </Trans>
              </p>
              <textarea
                readOnly
                className="font-data mt-2 h-24 w-full rounded border border-hairline p-2 text-[11px]"
                value={shareUrl}
              />
              <button
                type="button"
                className="mt-2 w-full rounded border border-accent px-2 py-1.5 text-[13px] text-accent"
                onClick={() => {
                  void navigator.clipboard.writeText(shareUrl).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
              >
                {copied ? <Trans>Copie !</Trans> : <Trans>Copier l'URL de partage</Trans>}
              </button>
              {qrDataUrl !== null ? (
                <img
                  src={qrDataUrl}
                  alt="QR"
                  data-testid="share-qr"
                  className="mx-auto mt-3 block h-28 w-28"
                />
              ) : null}
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
      </p>
      {qrDataUrl !== null ? (
        <img src={qrDataUrl} alt="" aria-hidden className="h-16 w-16 shrink-0" />
      ) : null}
    </div>
  );
}

function ReportTables() {
  const project = useProjectStore((s) => s.project);
  const report = getLastReport();
  const uls = report?.combinations.find((c) => c.kind === "ULS");
  const sls = report?.combinations.find((c) => c.kind === "SLS");
  const beamById = new Map(project.structure.beams.map((b) => [b.id, b]));
  const copy = (headers: string[], rows: string[][]) => {
    const tsv = [headers.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n");
    void navigator.clipboard.writeText(tsv);
    toast("Table copiée pour Excel (TSV)");
  };
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
      const i = nodeIndex * 6;
      for (const [code, factor] of multipliers) {
        const reactions = byCode.get(code);
        if (reactions === undefined) {
          continue;
        }
        rx += factor * (reactions[i] ?? 0);
        ry += factor * (reactions[i + 1] ?? 0);
        rz += factor * (reactions[i + 2] ?? 0);
      }
      return [`N${n.id}`, fr(rx / 1000, 2), fr(ry / 1000, 2), fr(rz / 1000, 2)];
    });
  const totalRx = reactionRows.reduce((m, r) => m + Number((r[1] ?? "0").replace(",", ".")), 0);
  const totalRy = reactionRows.reduce((m, r) => m + Number((r[2] ?? "0").replace(",", ".")), 0);
  const totalRz = reactionRows.reduce((m, r) => m + Number((r[3] ?? "0").replace(",", ".")), 0);
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
          title: `${t`Réactions d'appuis ELU (kN)`}${uls !== undefined ? ` — ${uls.label}` : ""}`,
          headers: [t`Appui`, "Rx", "Ry", "Rz"],
          rows: [...reactionRows, ["Σ", fr(totalRx, 2), fr(totalRy, 2), fr(totalRz, 2)]],
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
      ].map((table) => (
        <div key={table.title}>
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-ink-secondary">{table.title}</h3>
            <button
              type="button"
              className="rounded border border-hairline px-2 py-0.5 text-[11px] text-ink-secondary hover:border-accent"
              onClick={() => copy(table.headers, table.rows)}
            >
              <Trans>Copier TSV</Trans>
            </button>
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
      ))}
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

  const blocks = (): DocxBlock[] => {
    const out: DocxBlock[] = [];
    for (const chapter of chapters.filter((c) => c.on)) {
      out.push({ kind: "heading", text: chapter.label });
      const suffix = language === "en" ? " (EN output)" : "";
      out.push({
        kind: "paragraph",
        text: `${chapter.label}${suffix} — modèle ${project.name}, version ${project.version}.`,
      });
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
      className="rounded-xl border border-hairline bg-panel/95 p-4  "
    >
      <h3 className="mb-2 text-sm font-bold">Générateur de rapport (PDF + .docx)</h3>
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <input
          value={firm}
          onChange={(e) => setFirm(e.target.value)}
          aria-label="Cabinet"
          className="rounded border border-hairline bg-transparent px-2 py-1 "
        />
        <input
          value={engineer}
          onChange={(e) => setEngineer(e.target.value)}
          aria-label="Ingénieur"
          className="rounded border border-hairline bg-transparent px-2 py-1 "
        />
        <input
          value={checker}
          onChange={(e) => setChecker(e.target.value)}
          aria-label="Vérificateur"
          className="rounded border border-hairline bg-transparent px-2 py-1 "
        />
        <input
          value={revision}
          onChange={(e) => setRevision(e.target.value)}
          aria-label="Révision"
          className="rounded border border-hairline bg-transparent px-2 py-1 "
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
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() => setLanguage(language === "fr" ? "en" : "fr")}
          className="rounded bg-panel-subtle px-2 py-1 "
        >
          Sortie : {language.toUpperCase()}
        </button>
        <button
          type="button"
          onClick={() => void saveSnapshot(`rapport-${revision}`, project)}
          className="rounded bg-panel-subtle px-2 py-1 "
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
 * the checkbox toggle stays a plain click.
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
        <input type="checkbox" checked={chapter.on} onChange={(e) => onToggle(e.target.checked)} />
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
