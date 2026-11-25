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

export type WorkerRequest = SolveRequest | CatalogRequest;

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
