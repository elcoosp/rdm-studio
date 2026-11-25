import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PdfRenderer } from "takumi-pdf";
import { buildReportHtml } from "./pdfTakumiReport";
import { buildResultsCsv } from "./csvExport";
import { buildStandaloneHtml3d } from "./standaloneHtml3d";
import type { ProjectData } from "@/state/projectStore";
import type { SolveReport } from "@/wasmBridge/workerClient";

/** Minimal 2-beam portico mirroring the demo project shape. */
const project: ProjectData = {
  version: 1,
  name: "Portique test",
  structure: {
    sections: {},
    materials: {},
    nodes: [
      { id: 1, x: 0, y: 0, z: 0 },
      { id: 2, x: 6, y: 0, z: 0 },
      { id: 3, x: 6, y: 0, z: 3.2 },
      { id: 4, x: 0, y: 0, z: 3.2 },
    ],
    beams: [
      {
        id: 1,
        n1: 1,
        n2: 4,
        section_id: "IPE 200",
        material_id: "S235JR",
        roll_angle_rad: 0,
        releases_start: [false, false, false, false, false, false],
        releases_end: [false, false, false, false, false, false],
        k_buckling_y: 1,
        k_buckling_z: 1,
      },
      {
        id: 2,
        n1: 4,
        n2: 3,
        section_id: "IPE 300",
        material_id: "S235JR",
        roll_angle_rad: 0,
        releases_start: [false, false, false, false, false, false],
        releases_end: [false, false, false, false, false, false],
        k_buckling_y: 1,
        k_buckling_z: 1,
      },
    ],
    supports: [
      {
        node_id: 1,
        locked_dofs: [true, true, true, true, true, true],
        spring_stiffness: [0, 0, 0, 0, 0, 0],
      },
      {
        node_id: 2,
        locked_dofs: [false, false, true, false, false, false],
        spring_stiffness: [0, 0, 0, 0, 0, 0],
      },
    ],
    loads: [
      {
        case: "Permanent",
        kind: "Nodal",
        node_id: 3,
        forces: { fx: 0, fy: 0, fz: -12000, mx: 0, my: 0, mz: 0 },
      },
    ],
    self_weight_enabled: true,
  },
};

const report: SolveReport = {
  n_nodes: 4,
  n_beams: 2,
  cases: [
    {
      code: "G",
      displacements: new Array(24).fill(0.001),
      reactions: [12, -3, 4, 0, 0, 8],
      beam_end_forces: new Array(24).fill(0),
    },
    {
      code: "Q",
      displacements: new Array(24).fill(0.0004),
      reactions: [5, -1, 2, 0, 0, 3],
      beam_end_forces: new Array(24).fill(0),
    },
  ],
  combinations: [
    {
      kind: "ULS",
      label: "1.35G + 1.50Q",
      beams: [
        { beam_id: 1, utilization: 0.312, midspan_deflection: 0.0008 },
        { beam_id: 2, utilization: 1.02, midspan_deflection: 0.0041 },
      ],
    },
    {
      kind: "SLS",
      label: "1.00G + 1.00Q",
      beams: [
        { beam_id: 1, utilization: 0.23, midspan_deflection: 0.0006 },
        { beam_id: 2, utilization: 0.71, midspan_deflection: 0.0029 },
      ],
    },
  ],
};

function font(name: string, file: string, weight: number) {
  return { name, data: readFileSync(resolve("public/fonts", file)), weight };
}

describe("takumi-pdf report pipeline (M8/e1)", () => {
  it("renders the A4 report to real PDF bytes with bundled fonts and QR", async () => {
    const qrPng = {
      src: "share-qr.png",
      data: Uint8Array.from(
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
          "base64",
        ),
      ),
    };
    const { html, images } = buildReportHtml(
      project,
      report,
      {
        shareUrl: "https://rdm.example/report?p=demo",
        fresh: true,
      },
      qrPng,
    );
    expect(html).toContain("Rapport de calcul");
    expect(html).toContain("eta = 1.020");

    const renderer = new PdfRenderer();
    const pdf = await renderer.render(html, {
      size: "a4",
      margin: 60,
      images,
      fonts: [
        font("Inter", "inter-latin-400-normal.ttf", 400),
        font("Inter", "inter-latin-600-normal.ttf", 600),
        font("Inter", "inter-latin-700-normal.ttf", 700),
        font("JetBrains Mono", "jetbrains-mono-latin-400-normal.ttf", 400),
        font("JetBrains Mono", "jetbrains-mono-latin-600-normal.ttf", 600),
      ],
    });
    const magic = Buffer.from(pdf.slice(0, 5)).toString("latin1");
    expect(magic).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(800);
  }, 30_000);
});

describe("csv export (M8/e2)", () => {
  it("emits UTF-8 BOM and tabular results", () => {
    const csv = buildResultsCsv(project, report);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("eta ULE;fleche mid SLS (mm)");
    expect(csv).toContain("IPE 300;S235JR;1.020;2.9");
  });
});

describe("standalone html 3d (M8/e2)", () => {
  it("embeds three.js, the model data and is fully self-contained", () => {
    const html = buildStandaloneHtml3d(project, report);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("const MODEL =");
    expect(html).toContain("new THREE.Scene()");
    // No external fetches: no http(s):// resource references in tags.
    expect(html).not.toMatch(/src="https?:\/\//);
    expect(html.length).toBeGreaterThan(400_000); // three.js embedded
  });
});
