import init, { catalog_materials, catalog_sections, solve } from "../wasm-pkg/rdm_wasm.js";

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

export interface RenderPdfRequest {
  type: "RENDER_PDF";
  html: string;
  images?: { src: string; data: Uint8Array }[];
}

export type WorkerRequest = SolveRequest | CatalogRequest | RenderPdfRequest;

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
    self.postMessage({ type: "CATALOG", sections, materials });
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
