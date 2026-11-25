import init, {
  beam_span_forces,
  catalog_materials,
  catalog_section_properties,
  catalog_section_shapes,
  catalog_sections,
  import_dxf,
  modal_analysis,
  section_stress_grid,
  solve,
} from "../wasm-pkg/rdm_wasm.js";

/**
 * fea.worker.ts (ARCHITECTURE.md section 4): every matrix computation runs
 * here at 60 FPS; the main thread never touches WASM.
 */

export interface SolveRequest {
  type: "SOLVE_MODEL";
  project: unknown;
}

export interface CatalogRequest {
  type: "FETCH_CATALOG";
}

export interface ModalRequest {
  type: "MODAL_ANALYSIS";
  project: unknown;
  nModes: number;
}

export interface SectionStressRequest {
  type: "SECTION_STRESS";
  project: unknown;
  beamId: number;
  ratio: number;
  gridN: number;
}

export interface SpanForcesRequest {
  type: "SPAN_FORCES";
  project: unknown;
  beamId: number;
  nRatios: number;
}

export interface CatalogPropertiesRequest {
  type: "CATALOG_PROPERTIES";
  designation: string;
}

export interface ImportDxfRequest {
  type: "IMPORT_DXF";
  bytes: ArrayBuffer;
  name: string;
}

export interface RenderPdfRequest {
  type: "RENDER_PDF";
  html: string;
  images?: { src: string; data: Uint8Array }[];
}

export type WorkerRequest =
  | SolveRequest
  | CatalogRequest
  | RenderPdfRequest
  | ModalRequest
  | SectionStressRequest
  | ImportDxfRequest
  | CatalogPropertiesRequest
  | SpanForcesRequest;

/**
 * takumi-pdf state (ARCHITECTURE.md section 6: PDF generation runs in the
 * worker). Lazily initialized on the first report render; fonts come from
 * the self-hosted /fonts directory (service-worker precached, offline ok).
 */
let takumiReady: Promise<unknown> | null = null;
const fontCache = new Map<string, { name: string; weight: number; data: Uint8Array }>();

async function ensureTakumi(): Promise<void> {
  takumiReady ??= (async () => {
    const [{ default: initTakumi, PdfRenderer }, { default: takumiWasmUrl }] = await Promise.all([
      import("takumi-pdf"),
      import("takumi-pdf/wasm-url"),
    ]);
    await initTakumi({ module_or_path: takumiWasmUrl });
    return PdfRenderer;
  })();
  await takumiReady;
}

async function loadFont(name: string, weight: number, file: string) {
  const cached = fontCache.get(file);
  if (cached !== undefined) {
    return cached;
  }
  const response = await fetch(`/fonts/${file}`);
  const data = new Uint8Array(await response.arrayBuffer());
  const font = { name, weight, data };
  fontCache.set(file, font);
  return font;
}

let ready: Promise<unknown> | null = null;

async function ensureReady(): Promise<void> {
  ready ??= init() as Promise<unknown>;
  await ready;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  await ensureReady();
  if (request.type === "FETCH_CATALOG") {
    const sections = catalog_sections();
    const materials = catalog_materials();
    // v1.0.0 bug 2: true SI outline dims for the 3D extrusion.
    const sectionDims = catalog_section_shapes();
    self.postMessage({ type: "CATALOG", sections, materials, sectionDims });
    return;
  }
  if (request.type === "MODAL_ANALYSIS") {
    const report = modal_analysis(JSON.stringify(request.project), request.nModes);
    if ((report as { kind?: string }).kind === "Fault") {
      self.postMessage({ type: "MODAL_FAULT", fault: report });
      return;
    }
    self.postMessage({ type: "MODAL_RESULT", report });
    return;
  }
  if (request.type === "SECTION_STRESS") {
    const grid = section_stress_grid(
      JSON.stringify(request.project),
      request.beamId,
      "ULS",
      request.ratio,
      request.gridN,
    );
    if ((grid as { kind?: string }).kind === "Fault") {
      self.postMessage({ type: "STRESS_FAULT", fault: grid });
      return;
    }
    self.postMessage({ type: "STRESS_RESULT", grid });
    return;
  }
  if (request.type === "SPAN_FORCES") {
    const forces = beam_span_forces(
      JSON.stringify(request.project),
      request.beamId,
      "ULS",
      request.nRatios,
    );
    if ((forces as { kind?: string }).kind === "Fault") {
      self.postMessage({ type: "SPAN_FORCES_FAULT", fault: forces });
      return;
    }
    self.postMessage({ type: "SPAN_FORCES_RESULT", forces });
    return;
  }
  if (request.type === "CATALOG_PROPERTIES") {
    const props = catalog_section_properties(request.designation);
    if ((props as { kind?: string }).kind === "Fault") {
      self.postMessage({ type: "CATALOG_PROPS_FAULT", fault: props });
      return;
    }
    self.postMessage({ type: "CATALOG_PROPS_RESULT", props });
    return;
  }
  if (request.type === "IMPORT_DXF") {
    const json = import_dxf(new Uint8Array(request.bytes), request.name);
    if ((json as { kind?: string }).kind === "Fault") {
      self.postMessage({ type: "DXF_FAULT", fault: json });
      return;
    }
    self.postMessage({ type: "DXF_RESULT", json });
    return;
  }
  if (request.type === "RENDER_PDF") {
    await ensureTakumi();
    const { PdfRenderer } = await import("takumi-pdf");
    const fonts = await Promise.all([
      loadFont("Inter", 400, "inter-latin-400-normal.ttf"),
      loadFont("Inter", 600, "inter-latin-600-normal.ttf"),
      loadFont("Inter", 700, "inter-latin-700-normal.ttf"),
      loadFont("JetBrains Mono", 400, "jetbrains-mono-latin-400-normal.ttf"),
      loadFont("JetBrains Mono", 600, "jetbrains-mono-latin-600-normal.ttf"),
    ]);
    const renderer = new PdfRenderer();
    const pdf = await renderer.render(request.html, {
      size: "a4",
      margin: 60,
      images: request.images,
      fonts,
    });
    console.info("[fea.worker] report rendered:", pdf.byteLength, "bytes");
    self.postMessage({ type: "PDF_RESULT", pdf }, [pdf.buffer]);
    return;
  }
  // M2 criterion: the first FE calculation is displayed in the Worker
  // console, then posted back to the UI.
  console.info("[fea.worker] SOLVE_MODEL received");
  const result = solve(JSON.stringify(request.project));
  const fault = (result as { kind?: string }).kind;
  if (typeof fault === "string") {
    console.error("[fea.worker] solve fault:", fault, (result as { message?: string }).message);
    self.postMessage({ type: "SOLVE_FAULT", fault: result });
    return;
  }
  const report = result as {
    n_nodes: number;
    n_beams: number;
    combinations: { kind: string; label: string }[];
  };
  console.info(
    "[fea.worker] solved",
    report.n_nodes,
    "nodes /",
    report.n_beams,
    "beams —",
    report.combinations.map((c) => c.label).join(", "),
  );
  self.postMessage({ type: "SOLVE_RESULT", report: result });
};
