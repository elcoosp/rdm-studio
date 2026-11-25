import type { ProjectData } from "@/state/projectStore";
import type { SolveReport } from "@/wasmBridge/workerClient";

/**
 * Calculation-report document (ARCHITECTURE.md section 5, `pdfTakumiReport.tsx`;
 * section 18 M8/e1): a typed report document rendered to vector PDF by
 * takumi-pdf (`PdfRenderer`, A4 paged, section 2.3 pin). The plan names
 * `@pdfcn` templates, but that package is an empty `0.0.0` placeholder on
 * npm — the document is therefore a typed HTML template consumed by
 * takumi-pdf's own renderer (drift documented in the PR body).
 *
 * Eurocode values (combination factors, deflection limit) are NEVER
 * hardcoded here: combination labels and utilizations come from
 * `rdm-eurocode` through the solver report, and only presentation lives
 * in this file.
 */

export interface ReportMeta {
  /** Interactive 3D share URL encoded in the QR code. */
  shareUrl: string;
  /** True when solved under the current model (report fresh). */
  fresh: boolean;
}

/** Thermal tier text color for a utilization ratio (section 17 palette). */
function utilizationColor(eta: number): string {
  if (eta >= 1) {
    return "#EF4444";
  }
  if (eta >= 0.75) {
    return "#F59E0B";
  }
  if (eta >= 0.25) {
    return "#10B981";
  }
  return "#2563EB";
}

const escape = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const fmt = (value: number, digits = 2): string =>
  Number.isFinite(value) ? value.toFixed(digits) : "—";

/** Builds the full A4 report document (HTML string for takumi-pdf). */
export function buildReportHtml(
  project: ProjectData,
  report: SolveReport | null,
  meta: ReportMeta,
  qrPng?: { src: string; data: Uint8Array },
): { html: string; images?: { src: string; data: Uint8Array }[] } {
  const uls = report?.combinations.find((c) => c.kind === "ULS");
  const sls = report?.combinations.find((c) => c.kind === "SLS");
  const caseG = report?.cases.find((c) => c.code === "G");
  const nodeById = new Map(project.structure.nodes.map((n) => [n.id, n]));
  const beamById = new Map(project.structure.beams.map((b) => [b.id, b]));
  const today = new Date().toISOString().slice(0, 10);

  const hypothesis = `
	<div style="display: flex; flex-direction: column; gap: 4px; padding: 12px; border: 1px solid #E5E7EB; border-radius: 6px;">
	  ${row("Projet", escape(project.name))}
	  ${row("Date", today)}
	  ${row(
      "Structure",
      `${report?.n_nodes ?? project.structure.nodes.length} noeuds / ${report?.n_beams ?? project.structure.beams.length} poutres / ${project.structure.supports.length} appuis / ${project.structure.loads.length} charges`,
    )}
	  ${row("Poids propre", project.structure.self_weight_enabled ? "inclus (case G)" : "exclu")}
	  ${row("Referentiel", "EN 1990 (combinaisons) + EN 1993-1-1 (verification)")}
	  ${row("Unites", "kN, m, mm — tabular-nums")}
	</div>`;

  const profiles = project.structure.beams
    .map(
      (b) =>
        `<div style="display: flex; gap: 16px; padding: 3px 12px; font-family: JetBrains Mono; font-size: 10px; color: #4B5563;">
		  <span style="width: 32px;">P${b.id}</span>
		  <span style="width: 72px;">N${b.n1}-N${b.n2}</span>
		  <span style="width: 90px;">${escape(b.section_id)}</span>
		  <span>${escape(b.material_id)}</span>
		</div>`,
    )
    .join("");

  const ulsRows = (uls?.beams ?? [])
    .map((b) => {
      const beam = beamById.get(b.beam_id);
      const eta = b.utilization;
      return `<div style="display: flex; gap: 16px; padding: 3px 12px; font-family: JetBrains Mono; font-size: 10px; border-bottom: 1px solid #F3F4F6;">
		  <span style="width: 48px;">P${b.beam_id}</span>
		  <span style="width: 90px;">${escape(beam?.section_id ?? "—")}</span>
		  <span style="width: 96px; color: ${utilizationColor(eta)}; font-weight: 600;">eta = ${fmt(eta, 3)}</span>
		  <span style="width: 120px;">delta_mid = ${fmt(b.midspan_deflection * 1000, 1)} mm</span>
		  <span style="color: ${eta >= 1 ? "#EF4444" : "#10B981"};">${eta >= 1 ? "NON VERIFIE" : "verifie"}</span>
		</div>`;
    })
    .join("");

  const slsRows = (sls?.beams ?? [])
    .map((b) => {
      const beam = beamById.get(b.beam_id);
      const node = beam ? nodeById.get(beam.n1) : undefined;
      const nodeB = beam ? nodeById.get(beam.n2) : undefined;
      const length =
        node && nodeB
          ? Math.sqrt((nodeB.x - node.x) ** 2 + (nodeB.y - node.y) ** 2 + (nodeB.z - node.z) ** 2)
          : Number.NaN;
      const limit = Number.isFinite(length) ? (length / 250) * 1000 : Number.NaN;
      const delta = b.midspan_deflection * 1000;
      const ok = Number.isFinite(limit) && delta <= limit;
      return `<div style="display: flex; gap: 16px; padding: 3px 12px; font-family: JetBrains Mono; font-size: 10px; border-bottom: 1px solid #F3F4F6;">
		  <span style="width: 48px;">P${b.beam_id}</span>
		  <span style="width: 120px;">delta_mid = ${fmt(delta, 1)} mm</span>
		  <span style="width: 110px;">limite L/250 = ${fmt(limit, 1)} mm</span>
		  <span style="color: ${ok ? "#10B981" : "#EF4444"};">${ok ? "OK" : "KO"}</span>
		</div>`;
    })
    .join("");

  const reactions =
    caseG === undefined
      ? ""
      : `<div style="padding: 3px 12px; font-family: JetBrains Mono; font-size: 10px; color: #4B5563;">
		Réactions max (G): ${fmt(Math.max(...caseG.reactions.map((r) => Math.abs(r))), 2)} kN
	</div>`;

  const qrImage = qrPng ? `<img src="${qrPng.src}" style="width: 88px; height: 88px;" />` : "";
  const images = qrPng ? [qrPng] : undefined;

  const html = `
	<div style="display: flex; flex-direction: column; gap: 14px; font-family: Inter; color: #111827;">
	  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0891B2; padding-bottom: 8px;">
		<div style="display: flex; flex-direction: column;">
		  <span style="font-size: 18px; font-weight: 700;">RDM Studio — Rapport de calcul</span>
		  <span style="font-size: 11px; color: #6B7280;">Portique plan — verification EN 1990 / EN 1993-1-1</span>
		</div>
		<div style="display: flex; flex-direction: column; align-items: flex-end;">
		  <span style="font-size: 10px; color: #6B7280;">${meta.fresh ? "Resultats a jour" : "Modele modifie — relancer le calcul"}</span>
		  <span style="font-size: 10px; color: #6B7280;">${today}</span>
		</div>
	  </div>
	  ${hypothesis}
	  <div style="display: flex; flex-direction: column; gap: 4px;">
		<span style="font-size: 13px; font-weight: 600;">Profils (EN 10365 / 10210 / 10056)</span>
		${profiles || '<span style="font-size: 10px; color: #6B7280; padding-left: 12px;">Aucune poutre.</span>'}
	  </div>
	  ${
      uls === null || uls === undefined
        ? '<span style="font-size: 11px; color: #6B7280;">Aucun calcul — lancer l\'etape 4.</span>'
        : `<div style="display: flex; flex-direction: column; gap: 4px;">
		<span style="font-size: 13px; font-weight: 600;">Verification ULE — ${escape(uls.label)}</span>
		${ulsRows}
	  </div>
	  <div style="display: flex; flex-direction: column; gap: 4px;">
		<span style="font-size: 13px; font-weight: 600;">Deformations SLS — ${escape(sls?.label ?? "")}</span>
		${slsRows}
	  </div>
	  ${reactions}`
    }
	  <div style="display: flex; gap: 12px; align-items: center; border-top: 1px solid #E5E7EB; padding-top: 10px;">
		${qrImage}
		<div style="display: flex; flex-direction: column; gap: 2px;">
		  <span style="font-size: 10px; font-weight: 600;">Lien interactif (3D)</span>
		  <span style="font-size: 9px; color: #6B7280; font-family: JetBrains Mono;">${escape(meta.shareUrl.slice(0, 96))}</span>
		  <span style="font-size: 9px; color: #6B7280;">Scannez pour rouvrir le modele dans RDM Studio.</span>
		</div>
	  </div>
	</div>`;

  return { html, images };
}

function row(label: string, value: string): string {
  return `<div style="display: flex; gap: 16px; font-size: 11px;">
	  <span style="width: 110px; color: #6B7280;">${escape(label)}</span>
	  <span style="font-family: JetBrains Mono;">${escape(value)}</span>
	</div>`;
}
