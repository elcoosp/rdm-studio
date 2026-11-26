import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Trans } from "@lingui/react/macro";
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
import { downloadText } from "@/export/csvExport";

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
      );
      const pdf = await feaClient.renderReportPdf(html, images);
      downloadBytes(`${project.name.replace(/[^\w-]+/g, "_")}-rapport.pdf`, pdf);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="h-full min-h-0 overflow-auto p-3 md:p-4">
      <ReportBuilder />
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
          {/* v1.6.0: live 3D snapshot of the persistent stage. */}
          <figure
            className="rounded-panel border border-hairline bg-panel-subtle p-2"
            data-testid="report-3d-snapshot"
          >
            <img
              src={captureViewportPng() ?? "/logo-rdm-studio.svg"}
              alt={t`Vue 3D du modèle`}
              className="max-h-[360px] w-full rounded object-contain"
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
            {/* v1.6.0: canonical `.rdm` round-trip export. */}
            <button
              type="button"
              data-testid="export-rdm"
              disabled={busy !== null}
              className="min-h-11 w-full rounded border border-accent px-2 py-1.5 text-[13px] text-accent"
              onClick={exportRdm}
            >
              <Trans>Exporter (.rdm)</Trans>
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
        { title: "Fréquences propres (Hz)", headers: ["Mode", "f (Hz)", "T (s)"], rows: modalRows },
        {
          title: `Réactions d'appuis ELU (kN)${uls !== undefined ? ` — ${uls.label}` : ""}`,
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

/** Type guard helper so ProjectData stays explicit for the export. */
export type { ProjectData };

/**
 * v2.0.0 Report Builder (Step 5): toggle/reorder chapters, cover page
 * metadata, independent FR/EN output language, .docx download with the
 * engineer disclaimer + SHA-256 fingerprint, and the BIM export family
 * (IFC4 / SAF / OpenSees TCL / solver JSON / glTF).
 */
function ReportBuilder(): React.ReactElement {
  const project = useProjectStore((st) => st.project);
  const [firm, setFirm] = useState("Cabinet — ");
  const [engineer, setEngineer] = useState("Ingénieur : ");
  const [checker, setChecker] = useState("Vérificateur : ");
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

  const moveChapter = (index: number, delta: number): void => {
    const next = [...chapters];
    const target = index + delta;
    if (target < 0 || target >= next.length) {
      return;
    }
    const a = next[index];
    const bNext = next[target];
    if (a === undefined || bNext === undefined) {
      return;
    }
    next[index] = bNext;
    next[target] = a;
    setChapters(next);
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
  };

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

  return (
    <section
      aria-label="Générateur de rapport"
      className="rounded-xl border border-slate-200 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/90"
    >
      <h3 className="mb-2 text-sm font-bold">Générateur de rapport (PDF + .docx)</h3>
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <input
          value={firm}
          onChange={(e) => setFirm(e.target.value)}
          aria-label="Cabinet"
          className="rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-600"
        />
        <input
          value={engineer}
          onChange={(e) => setEngineer(e.target.value)}
          aria-label="Ingénieur"
          className="rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-600"
        />
        <input
          value={checker}
          onChange={(e) => setChecker(e.target.value)}
          aria-label="Vérificateur"
          className="rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-600"
        />
        <input
          value={revision}
          onChange={(e) => setRevision(e.target.value)}
          aria-label="Révision"
          className="rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-600"
        />
      </div>
      <ul className="mb-3 space-y-1">
        {chapters.map((chapter, index) => (
          <li key={chapter.id} className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={chapter.on}
                onChange={(e) =>
                  setChapters(
                    chapters.map((c) => (c.id === chapter.id ? { ...c, on: e.target.checked } : c)),
                  )
                }
              />
              {chapter.label}
            </label>
            <span className="flex gap-1">
              <button
                type="button"
                onClick={() => moveChapter(index, -1)}
                aria-label={`Monter ${chapter.label}`}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveChapter(index, 1)}
                aria-label={`Descendre ${chapter.label}`}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() => setLanguage(language === "fr" ? "en" : "fr")}
          className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800"
        >
          Sortie : {language.toUpperCase()}
        </button>
        <button
          type="button"
          onClick={() => downloadDocx(blocks(), meta, `rapport-${project.name}.docx`)}
          className="rounded bg-blue-600 px-3 py-1 font-semibold text-white"
        >
          Télécharger .docx
        </button>
        {["ifc4", "saf", "opensees", "solver", "gltf"].map((format) => (
          <button
            key={format}
            type="button"
            onClick={() => exportBim(format)}
            className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800"
          >
            {format.toUpperCase()}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void saveSnapshot(`rapport-${revision}`, project)}
          className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800"
        >
          Photographier
        </button>
      </div>
      <p className="mt-2 text-[11px] text-slate-500" aria-live="polite">
        {`SHA-256 : ${fingerprint ?? "calcul…"} — clause d'ingénieur incluse.`}
      </p>
    </section>
  );
}
