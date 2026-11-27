import { useProjectStore, type ProjectData } from "@/state/projectStore";
import type { SolveReport } from "@/wasmBridge/workerClient";

/**
 * CSV export (ARCHITECTURE.md section 5, `csvExport.ts`; section 18 M8/e2):
 * results table with a UTF-8 BOM so Excel opens accents and the units
 * header correctly. Pure string building, tested in vitest.
 */

function csvEscape(value: string): string {
  return /[",;\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Builds the results CSV (semicolon-separated, French Excel locale). */
export function buildResultsCsv(project: ProjectData, report: SolveReport | null): string {
  const lines: string[] = [];
  lines.push("RDM Studio — Résultats");
  lines.push(`Projet;${project.name}`);
  lines.push(`Noeuds;${project.structure.nodes.length}`);
  lines.push(`Poutres;${project.structure.beams.length}`);
  lines.push("");
  lines.push(
    ["Poutre", "Section", "Materiau", "eta ELU", "fleche mid SLS (mm)"].map(csvEscape).join(";"),
  );
  const uls = report?.combinations.find((c) => c.kind === "ULS");
  const sls = report?.combinations.find((c) => c.kind === "SLS");
  for (const beam of project.structure.beams) {
    const eta = uls?.beams.find((b) => b.beam_id === beam.id)?.utilization;
    const delta = sls?.beams.find((b) => b.beam_id === beam.id)?.midspan_deflection;
    lines.push(
      [
        `P${beam.id}`,
        beam.section_id,
        beam.material_id,
        eta === undefined ? "" : eta.toFixed(3),
        delta === undefined ? "" : (delta * 1000).toFixed(1),
      ]
        .map(csvEscape)
        .join(";"),
    );
  }
  lines.push("");
  if (report !== null) {
    for (const c of report.cases) {
      lines.push(
        `Cas ${c.code};deplacements=${c.displacements.length} DOF;reactions=${c.reactions.length}`,
      );
    }
    for (const c of report.combinations) {
      lines.push(`Combinaison;${c.kind};${c.label}`);
    }
    // v2.4.0: support reactions with all 6 components (Rx..Rz in kN,
    // Mx..Mz in kN·m) superposed over the ULS multipliers.
    const uls = report.combinations.find((c) => c.kind === "ULS");
    const multipliers: [string, number][] = uls?.multipliers ?? [
      ["G", 1.35],
      ["Q", 1.5],
    ];
    const byCode = new Map(report.cases.map((c) => [c.code, c.reactions as number[] | undefined]));
    const supportNodes = project.structure.nodes.filter((n) =>
      project.structure.supports.some((sp) => sp.node_id === n.id),
    );
    if (supportNodes.length > 0) {
      lines.push("");
      lines.push(
        ["Appui", "Rx (kN)", "Ry (kN)", "Rz (kN)", "Mx (kN·m)", "My (kN·m)", "Mz (kN·m)"]
          .map(csvEscape)
          .join(";"),
      );
      for (const n of supportNodes) {
        const nodeIndex = project.structure.nodes.findIndex((x) => x.id === n.id);
        let rx = 0;
        let ry = 0;
        let rz = 0;
        let mx = 0;
        let my = 0;
        let mz = 0;
        const i = nodeIndex * 6;
        for (const [code, factor] of multipliers) {
          const reactions = byCode.get(code);
          if (reactions === undefined) continue;
          rx += factor * (reactions[i] ?? 0);
          ry += factor * (reactions[i + 1] ?? 0);
          rz += factor * (reactions[i + 2] ?? 0);
          mx += factor * (reactions[i + 3] ?? 0);
          my += factor * (reactions[i + 4] ?? 0);
          mz += factor * (reactions[i + 5] ?? 0);
        }
        lines.push(
          [
            `N${n.id}`,
            (rx / 1000).toFixed(2),
            (ry / 1000).toFixed(2),
            (rz / 1000).toFixed(2),
            (mx / 1000).toFixed(2),
            (my / 1000).toFixed(2),
            (mz / 1000).toFixed(2),
          ]
            .map(csvEscape)
            .join(";"),
        );
      }
    }
  }
  // UTF-8 BOM: Excel reads accents without an import wizard.
  return `\ufeff${lines.join("\n")}\n`;
}

/** Downloads a text blob with the browser file dialog. */
export function downloadText(
  filename: string,
  text: string,
  mime = "text/csv;charset=utf-8",
): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Convenience: current project + last report from the client cache. */
/** Accent-preserving file slug: `Poutre démo` -> `Poutre_demo`. */
export function slugify(name: string): string {
  const ascii = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ascii.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") || "projet";
}

export function exportResultsCsv(report: SolveReport | null): void {
  const project = useProjectStore.getState().project;
  downloadText(`${slugify(project.name)}-résultats.csv`, buildResultsCsv(project, report));
}
