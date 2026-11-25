import { createFileRoute } from "@tanstack/react-router";
import { BottomSheet } from "@/components/BottomSheet";
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
      <section className="print-sheet mx-auto w-full max-w-[720px] rounded-panel border border-hairline bg-panel p-6">
        <div className="flex items-center justify-between border-b-2 border-accent pb-2">
          <h2 className="text-[17px] font-semibold">RDM Studio — Rapport de calcul</h2>
          <span className="font-data text-[11px] text-ink-muted">
            {new Date().toISOString().slice(0, 10)}
          </span>
        </div>
        <dl className="text-[13px]">
          <dt className="text-ink-muted">
            <Trans>Nom du projet</Trans>
          </dt>
          <dd className="font-data">{project.name}</dd>
          <dt className="mt-2 text-ink-muted">
            <Trans>Nœuds / Poutres / Appuis / Charges</Trans>
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
          <Trans>Profils utilisés</Trans>
        </h3>
        <ul className="font-data list-disc pl-5 text-[13px]">
          {[
            ...new Set(project.structure.beams.map((b) => `${b.section_id} (${b.material_id})`)),
          ].map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
        <ReportTables />
        <FingerprintFooter />
      </section>
      <BottomSheet testId="inspector-sheet" title={<Trans>Partage par URL</Trans>}>
        <p className="text-[12px] text-ink-secondary">
          <Trans>
            Le modèle .rdm est compresse (lz-string) dans l'URL et valide par Valibot a la
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
          <Trans>Exports (étape 5)</Trans>
        </h3>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            data-testid="export-pdf"
            disabled={busy !== null}
            className="min-h-11 w-full rounded bg-accent px-2 py-1.5 text-[13px] text-white disabled:opacity-50"
            onClick={() => void exportPdf()}
          >
            {busy === "pdf" ? <Trans>Génération…</Trans> : <Trans>Rapport PDF (takumi)</Trans>}
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

const fr = (v: number, digits = 3): string => v.toFixed(digits).replace(".", ",");

/** 4 calculation tables (mockups tape_5) with 1-click TSV copy. */
/** v1.4.0: deterministic SHA-256 model fingerprint footer. */
function FingerprintFooter() {
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
    <p className="font-data mt-4 border-t border-hairline pt-2 text-[11px] text-ink-muted">
      Empreinte du modèle (SHA-256) :{" "}
      <span data-testid="model-fingerprint">{hash ?? "calcul…"}</span>
    </p>
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
    b.chi_y === null ? "—" : fr(b.chi_y),
    b.chi_z === null ? "—" : fr(b.chi_z),
    b.chi_lt === null ? "—" : fr(b.chi_lt),
    fr(b.utilization),
    b.utilization > 1 ? "NON VERIFIÉ" : "vérifié",
  ]);
  // v1.4.0: ELU support reactions (Rx, Ry, Rz) + Σ footer.
  const permanent = report?.cases.find((c) => c.code === "G");
  const variable = report?.cases.find((c) => c.code === "Q");
  const reactionRows = project.structure.nodes
    .filter((n) => project.structure.supports.some((sp) => sp.node_id === n.id))
    .map((n) => {
      const g = permanent?.reactions ?? [];
      const q = variable?.reactions ?? [];
      const rx = (g[n.id * 6] ?? 0) + 1.5 * (q[n.id * 6] ?? 0) + 0.35 * (g[n.id * 6] ?? 0);
      const ry =
        (g[n.id * 6 + 1] ?? 0) + 1.5 * (q[n.id * 6 + 1] ?? 0) + 0.35 * (g[n.id * 6 + 1] ?? 0);
      const rz =
        (g[n.id * 6 + 2] ?? 0) + 1.5 * (q[n.id * 6 + 2] ?? 0) + 0.35 * (g[n.id * 6 + 2] ?? 0);
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
    <div className="mt-4 space-y-4">
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
              Copier pour Excel
            </button>
          </div>
          <table className="mt-1 w-full text-[12px]">
            <thead className="text-left text-[11px] text-ink-muted">
              <tr>
                {table.headers.map((h) => (
                  <th key={h} className="py-0.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-data">
              {table.rows.map((row, i) => (
                <tr key={i} className="border-t border-hairline">
                  {row.map((cell, j) => (
                    <td key={j} className="py-0.5 pr-2">
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
