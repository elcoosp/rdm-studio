import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { encodeProject } from "@/lib/urlShare";
import { useProjectStore } from "@/state/projectStore";
import QRCode from "qrcode";
import { toast } from "sonner";
import { feaClient, getLastModalReport, getLastReport } from "@/wasmBridge/workerClient";
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

/**
 * Step 5 (DESIGN.md §4 + mockups tape_5, v1.5.0): centered A4 engineering
 * sheet (`max-w-[794px]`, p-8) with the logo header, 2-column metadata
 * grid, aligned monospace tables (tabular-nums, right-aligned numeric
 * columns, 1-click TSV copy) and the QR + SHA-256 fingerprint footer,
 * beside the sticky 320px export rail (PDF Takumi / CSV Excel / HTML 3D /
 * Imprimer).
 */
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
    <div className="h-full min-h-0 overflow-auto p-3 md:p-4">
      <div className="mx-auto flex max-w-[1140px] flex-col gap-4 md:flex-row md:items-start">
        <section className="print-sheet mx-auto w-full max-w-[794px] space-y-5 rounded-panel border border-hairline bg-panel p-8">
          {/* A4 sheet header: logo + title + date. */}
          <div className="flex items-center justify-between border-b-2 border-accent pb-2">
            <div className="flex items-center gap-2">
              <img src="/logo-rdm-studio.svg" alt="" className="h-7 w-7" />
              <h2 className="text-[17px] font-semibold">RDM Studio — Rapport de calcul</h2>
            </div>
            <span className="font-data text-[11px] text-ink-muted">
              {new Date().toISOString().slice(0, 10)}
            </span>
          </div>
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
        </section>
        {/* Sticky 320px export rail. */}
        <aside className="w-full shrink-0 self-start md:sticky md:top-4 md:w-80">
          <div className="space-y-3 rounded-panel border border-hairline bg-panel p-4">
            <h3 className="text-[15px] font-semibold">
              <Trans>Exports (étape 5)</Trans>
            </h3>
            <button
              type="button"
              data-testid="export-pdf"
              disabled={busy !== null}
              className="min-h-11 w-full rounded bg-accent px-2 py-1.5 text-[13px] text-white disabled:opacity-50"
              onClick={() => void exportPdf()}
            >
              {busy === "pdf" ? <Trans>Génération…</Trans> : <Trans>PDF Takumi</Trans>}
            </button>
            <button
              type="button"
              data-testid="export-csv"
              disabled={busy !== null}
              className="min-h-11 w-full rounded border border-accent px-2 py-1.5 text-[13px] text-accent"
              onClick={() => exportResultsCsv(getLastReport())}
            >
              <Trans>CSV Excel</Trans>
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
              <Trans>HTML 3D</Trans>
            </button>
            <button
              type="button"
              data-testid="print-report"
              className="min-h-11 w-full rounded border border-hairline px-2 py-1.5 text-[13px] text-ink-secondary hover:border-accent hover:text-accent"
              onClick={() => window.print()}
            >
              <Trans>Imprimer</Trans>
            </button>
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
  // v1.5.0 defect fix: support reactions are indexed by the node's 0-based
  // ARRAY position (nodeIndex * 6), matching `Structure::dof_offset` in the
  // Rust solver — the old `n.id * 6` was 1-based and reported wrong rows
  // whenever node ids are not contiguous (DXF import, deletions).
  const permanent = report?.cases.find((c) => c.code === "G");
  const variable = report?.cases.find((c) => c.code === "Q");
  const reactionRows = project.structure.nodes
    .filter((n) => project.structure.supports.some((sp) => sp.node_id === n.id))
    .map((n) => {
      const nodeIndex = project.structure.nodes.findIndex((x) => x.id === n.id);
      const g = permanent?.reactions ?? [];
      const q = variable?.reactions ?? [];
      const i = nodeIndex * 6;
      // ELU superposition 1.35G + 1.50Q per EN 1990 (6.10b additive form).
      const rx = 1.35 * (g[i] ?? 0) + 1.5 * (q[i] ?? 0);
      const ry = 1.35 * (g[i + 1] ?? 0) + 1.5 * (q[i + 1] ?? 0);
      const rz = 1.35 * (g[i + 2] ?? 0) + 1.5 * (q[i + 2] ?? 0);
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
        { title: "Fréquences propres (Hz)", headers: ["Mode", "f (Hz)", "T (s)"], rows: modalRows },
        {
          title: "Réactions d'appuis ELU (kN)",
          headers: ["Appui", "Rx", "Ry", "Rz"],
          rows: [...reactionRows, ["Σ", fr(totalRx, 2), fr(totalRy, 2), fr(totalRz, 2)]],
        },
        {
          title: "Vérification Eurocode 3",
          headers: ["Poutre", "σvM (MPa)", "χy", "χz", "χLT", "η", "Statut"],
          rows: ec3Rows,
        },
        {
          title: "Déplacements extrêmes ELS",
          headers: ["Grandeur", "|U|max (mm)"],
          rows: [["Déformée ELS", extremeDisplacement]],
        },
        { title: "Nœuds", headers: ["ID", "X (m)", "Y (m)", "Z (m)"], rows: nodeRows },
        {
          title: "Profils utilisés",
          headers: ["Poutre", "N1", "N2", "Profil", "Acier"],
          rows: beamRows,
        },
        { title: "Vérification ELU", headers: ["Poutre", "Profil", "η", "Statut"], rows: ulsRows },
        { title: "Flèches ELS (mm)", headers: ["Poutre", "δ mid"], rows: slsRows },
      ].map((table) => (
        <div key={table.title}>
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-ink-secondary">{table.title}</h3>
            <button
              type="button"
              className="rounded border border-hairline px-2 py-0.5 text-[11px] text-ink-secondary hover:border-accent"
              onClick={() => copy(table.headers, table.rows)}
            >
              Copier TSV
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
