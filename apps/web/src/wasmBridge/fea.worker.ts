import init, {
  ModelSession,
  beam_span_forces,
  buckling_analysis_json,
  build_combinations_v2_json,
  catalog_materials,
  catalog_section_properties,
  catalog_section_shapes,
  catalog_sections,
  compute_envelopes_json,
  custom_section_preview,
  export_bim,
  generate_env_loads_json,
  generate_parametric_structure,
  import_cad,
  import_dxf,
  member_calc_trace,
  multi_material_check_json,
  migrate_project_json,
  moving_loads_envelope_json,
  modal_analysis,
  optimize_sections_json,
  project_fingerprint,
  run_validation_suite,
  section_stress_grid,
  seismic_spectrum_json,
  solve,
  validate_model_issues,
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

/** v1.4.0: canonical SHA-256 fingerprint request. */
export interface FingerprintRequest {
  type: "FINGERPRINT";
  projectJson: string;
}

/** v1.3.0: extension-dispatched DXF/STEP/IGES import. */
export interface ImportCadRequest {
  type: "IMPORT_CAD";
  bytes: ArrayBuffer;
  filename: string;
  name: string;
}

export interface RenderPdfRequest {
  type: "RENDER_PDF";
  html: string;
  images?: { src: string; data: Uint8Array }[];
}

/** v1.6.0: structured pre-solve validation request. */
export interface ModelIssuesRequest {
  type: "MODEL_ISSUES";
  project: unknown;
}

/** v1.6.0: parametric structure generation request. */
/** v1.8.0: live drag-solve lane request (latest-wins coalescing). */
export interface LiveSolveRequest {
  type: "LIVE_SOLVE";
  token: number;
  project: unknown;
}

/** v1.8.0: case superposition from the cached factorization (< 2 ms). */
export interface SolveCaseRhsRequest {
  type: "SOLVE_CASE_RHS";
  token: number;
  weights: { case: string; weight: number }[];
}

/** v1.8.0: cancels any pending live solve. */
export interface CancelSolveRequest {
  type: "CANCEL_SOLVE";
}

/** v1.8.0: validation suite request (41 closed-form benchmarks). */
export interface ValidationRequest {
  type: "VALIDATION_SUITE";
}

/** v1.8.0: generic named-call lane for the v1.8/v1.9 surface.
 * v2.0.1: every call carries a unique monotonically increasing `callId`
 * echoed back in `ENGINE_RESULT`, so concurrent calls to the same WASM
 * function never overwrite each other's Promise callbacks. */
export interface EngineCallRequest {
  type: "ENGINE_CALL";
  callId: number;
  fn:
    | "build_combinations_v2_json"
    | "member_calc_trace"
    | "compute_envelopes_json"
    | "custom_section_preview"
    | "generate_env_loads_json"
    | "optimize_sections_json"
    | "buckling_analysis_json"
    | "seismic_spectrum_json"
    | "export_bim"
    | "multi_material_check_json"
    | "moving_loads_envelope_json"
    | "migrate_project_json";
  args: unknown[];
}

export interface GenerateParametricRequest {
  type: "GENERATE_PARAMETRIC";
  params: {
    template: string;
    span_m: number;
    height_m: number;
    bays: number;
    primary_section: string;
    secondary_section: string;
    material_id: string;
  };
  name: string;
}

export type WorkerRequest =
  | SolveRequest
  | CatalogRequest
  | RenderPdfRequest
  | LiveSolveRequest
  | SolveCaseRhsRequest
  | CancelSolveRequest
  | ValidationRequest
  | EngineCallRequest
  | ModalRequest
  | SectionStressRequest
  | ImportDxfRequest
  | ImportCadRequest
  | FingerprintRequest
  | CatalogPropertiesRequest
  | SpanForcesRequest
  | ModelIssuesRequest
  | GenerateParametricRequest;

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

/** v1.8.0: stateful session (cached factorization) + latest-wins token. */
let session: ModelSession | null = null;
let liveToken = 0;

function ensureSession(): ModelSession {
  session ??= new ModelSession();
  return session;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  await ensureReady();
  if (request.type === "CANCEL_SOLVE") {
    liveToken = 0;
    ensureSession().cancel();
    return;
  }
  if (request.type === "LIVE_SOLVE") {
    liveToken = request.token;
    const session = ensureSession();
    const applied: void | { kind?: string } = session.apply_delta(
      JSON.stringify(request.project),
    ) as unknown as void | { kind?: string };
    if (applied !== undefined && applied.kind === "Fault") {
      self.postMessage({ type: "LIVE_FAULT", token: request.token, fault: applied });
      return;
    }
    const ok: boolean | { kind?: string } = session.solve_session() as unknown as boolean;
    // Latest-wins: a newer request superseded this pass.
    if (liveToken !== request.token) {
      return;
    }
    if (ok !== true) {
      self.postMessage({
        type: "LIVE_FAULT",
        token: request.token,
        fault: ok as unknown as Record<string, string>,
      });
      return;
    }
    self.postMessage({ type: "LIVE_RESULT", token: request.token });
    return;
  }
  if (request.type === "SOLVE_CASE_RHS") {
    const session = ensureSession();
    if (!session.has_cached_solve()) {
      self.postMessage({
        type: "CASE_FAULT",
        token: request.token,
        fault: { kind: "Fault", message: "no cached solve" },
      });
      return;
    }
    const weights = request.weights.map((w) => `["${w.case}", ${w.weight}]`).join(",");
    // Case codes map onto the LoadCase enum spellings.
    const result = session.solve_case_rhs(
      `[${weights}]`
        .replaceAll('"G"', '"Permanent"')
        .replaceAll('"Q"', '"Variable"')
        .replaceAll('"W"', '"Wind"')
        .replaceAll('"S"', '"Snow"')
        .replaceAll('"Acc"', '"Acceleration"'),
    );
    if ((result as { kind?: string }).kind === "Fault") {
      self.postMessage({ type: "CASE_FAULT", token: request.token, fault: result });
      return;
    }
    if (liveToken !== 0 && request.token !== liveToken) {
      return;
    }
    self.postMessage({ type: "CASE_RESULT", token: request.token, response: result });
    return;
  }
  if (request.type === "VALIDATION_SUITE") {
    const results = run_validation_suite();
    self.postMessage({ type: "VALIDATION_RESULT", results });
    return;
  }
  if (request.type === "ENGINE_CALL") {
    const args = request.args as unknown[];
    let result: unknown;
    try {
      switch (request.fn) {
        case "build_combinations_v2_json":
          result = build_combinations_v2_json(JSON.stringify(args[0]));
          break;
        case "member_calc_trace":
          result = member_calc_trace(JSON.stringify(args[0]), (args[1] as number) ?? 0);
          break;
        case "compute_envelopes_json":
          result = compute_envelopes_json(JSON.stringify(args[0]));
          break;
        case "custom_section_preview":
          result = custom_section_preview(
            args[0] as string,
            args[1] as number,
            args[2] as number,
            args[3] as number,
            args[4] as number,
          );
          break;
        case "generate_env_loads_json":
          result = generate_env_loads_json(
            args[0] as string,
            args[1] as number,
            args[2] as number,
            args[3] as number,
          );
          break;
        case "optimize_sections_json":
          result = optimize_sections_json(JSON.stringify(args[0]), JSON.stringify(args[1]));
          break;
        case "buckling_analysis_json":
          result = buckling_analysis_json(JSON.stringify(args[0]), (args[1] as number) ?? 4);
          break;
        case "seismic_spectrum_json":
          result = seismic_spectrum_json(
            args[0] as number,
            args[1] as string,
            args[2] as string,
            JSON.stringify(args[3]),
          );
          break;
        case "export_bim":
          result = export_bim(JSON.stringify(args[0]), args[1] as string);
          break;
        case "multi_material_check_json":
          result = multi_material_check_json(args[0] as string, JSON.stringify(args[1]));
          break;
        case "migrate_project_json":
          result = migrate_project_json(args[0] as string);
          break;
        case "moving_loads_envelope_json":
          result = moving_loads_envelope_json(
            JSON.stringify(args[0]),
            args[1] as number,
            args[2] as number,
          );
          break;
        default:
          result = { kind: "Fault", message: "unrouted engine call" };
      }
    } catch (error) {
      result = { kind: "Fault", message: String(error) };
    }
    self.postMessage({
      type: "ENGINE_RESULT",
      callId: request.callId,
      fn: request.fn,
      result,
    });
    return;
  }
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
  if (request.type === "FINGERPRINT") {
    // v1.4.0: deterministic model hash for the report sheet and PDF.
    const hash = project_fingerprint(request.projectJson);
    if ((hash as { kind?: string }).kind === "Fault") {
      self.postMessage({ type: "DXF_FAULT", fault: hash });
      return;
    }
    self.postMessage({ type: "FINGERPRINT_RESULT", hash });
    return;
  }
  if (request.type === "IMPORT_CAD") {
    // v1.3.0: extension-dispatched DXF/STEP/IGES import.
    const json = import_cad(new Uint8Array(request.bytes), request.filename, request.name);
    if ((json as { kind?: string }).kind === "Fault") {
      self.postMessage({ type: "DXF_FAULT", fault: json });
      return;
    }
    self.postMessage({ type: "DXF_RESULT", json });
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
  if (request.type === "MODEL_ISSUES") {
    // v1.6.0: structured pre-solve diagnostics for the Steps 1–3 badges.
    const issues = validate_model_issues(JSON.stringify(request.project));
    if ((issues as { kind?: string }).kind === "Fault") {
      self.postMessage({ type: "MODEL_ISSUES_FAULT", fault: issues });
      return;
    }
    self.postMessage({ type: "MODEL_ISSUES_RESULT", issues });
    return;
  }
  if (request.type === "GENERATE_PARAMETRIC") {
    // v1.6.0: pure-Rust parametric structure generator.
    const json = generate_parametric_structure(JSON.stringify(request.params), request.name);
    if ((json as { kind?: string }).kind === "Fault") {
      self.postMessage({ type: "PARAMETRIC_FAULT", fault: json });
      return;
    }
    self.postMessage({ type: "PARAMETRIC_RESULT", json });
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
  if (request.project === undefined) {
    return;
  }
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
