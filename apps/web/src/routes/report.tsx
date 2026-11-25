import { createFileRoute } from "@tanstack/react-router";
import { BottomSheet } from "@/components/BottomSheet";
import { useMemo, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { encodeProject } from "@/lib/urlShare";
import { useProjectStore } from "@/state/projectStore";
import QRCode from "qrcode";
import { feaClient, getLastReport } from "@/wasmBridge/workerClient";
import { buildReportHtml } from "@/export/pdfTakumiReport";
import { exportResultsCsv } from "@/export/csvExport";
import { exportStandaloneHtml3d } from "@/export/standaloneHtml3d";

export const Route = createFileRoute("/report")({
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

function ReportPage() {
  const project = useProjectStore((s) => s.project);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const shareUrl = useMemo(() => {
    const encoded = encodeProject(project);
    return `${window.location.origin}/report?p=${encoded}`;
  }, [project]);

  useMemo(() => {
    void QRCode.toDataURL(shareUrl, { margin: 1, width: 176 }).then(setQrDataUrl);
  }, [shareUrl]);

  const exportPdf = async () => {
    setBusy("pdf");
    try {
      let report = getLastReport();
      report ??= await feaClient.solveModel(project);
      const qrPng = qrDataUrl
        ? { src: "share-qr.png", data: await dataUrlToBytes(qrDataUrl) }
        : undefined;
      const { html, images } = buildReportHtml(project, report, { shareUrl, fresh: true }, qrPng);
      const pdf = await feaClient.renderReportPdf(html, images);
      downloadBytes(`${project.name.replace(/[^\w-]+/g, "_")}-rapport.pdf`, pdf);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
      <section className="rounded-panel border border-hairline bg-panel p-4">
        <h2 className="mb-3 text-[15px] font-semibold">
          <Trans>Rapport de model</Trans>
        </h2>
        <dl className="text-[13px]">
          <dt className="text-ink-muted">
            <Trans>Nom du projet</Trans>
          </dt>
          <dd className="font-data">{project.name}</dd>
          <dt className="mt-2 text-ink-muted">
            <Trans>Noeuds / Poutres / Appuis / Charges</Trans>
          </dt>
          <dd className="font-data">
            {project.structure.nodes.length} / {project.structure.beams.length} /{" "}
            {project.structure.supports.length} / {project.structure.loads.length}
          </dd>
          <dt className="mt-2 text-ink-muted">
            <Trans>Poids propre automatique</Trans>
          </dt>
          <dd className="font-data">{project.structure.self_weight_enabled ? "oui" : "non"}</dd>
        </dl>
        <h3 className="mt-4 mb-2 text-[13px] font-semibold text-ink-secondary">
          <Trans>Profils utilises</Trans>
        </h3>
        <ul className="font-data list-disc pl-5 text-[13px]">
          {[
            ...new Set(project.structure.beams.map((b) => `${b.section_id} (${b.material_id})`)),
          ].map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </section>
      <BottomSheet testId="inspector-sheet" title={<Trans>Partage par URL</Trans>}>
        <p className="text-[12px] text-ink-secondary">
          <Trans>
            Le modele .rdm est compresse (lz-string) dans l'URL et valide par Valibot a la
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
            className="mt-3 mx-auto block h-28 w-28"
          />
        ) : null}
        <h3 className="mt-4 mb-2 text-[13px] font-semibold">
          <Trans>Exports (etape 5)</Trans>
        </h3>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            data-testid="export-pdf"
            disabled={busy !== null}
            className="min-h-11 w-full rounded bg-accent px-2 py-1.5 text-[13px] text-white disabled:opacity-50"
            onClick={() => void exportPdf()}
          >
            {busy === "pdf" ? <Trans>Generation…</Trans> : <Trans>Rapport PDF (takumi)</Trans>}
          </button>
          <button
            type="button"
            data-testid="export-csv"
            disabled={busy !== null}
            className="min-h-11 w-full rounded border border-accent px-2 py-1.5 text-[13px] text-accent"
            onClick={() => exportResultsCsv(getLastReport())}
          >
            <Trans>Resultats CSV (Excel)</Trans>
          </button>
          <button
            type="button"
            data-testid="export-html3d"
            disabled={busy !== null}
            className="min-h-11 w-full rounded border border-accent px-2 py-1.5 text-[13px] text-accent"
            onClick={() =>
              exportStandaloneHtml3d(project, getLastReport(), (name, text, mime) => {
                import("@/export/csvExport").then((m) => m.downloadText(name, text, mime));
              })
            }
          >
            <Trans>Rapport 3D autonome (HTML)</Trans>
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
