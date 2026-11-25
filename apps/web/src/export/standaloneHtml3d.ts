// Vendored copy of three.module.js (pinned three 0.187.0) so the standalone
// report is fully offline: bare "three" exports no single build file.
import threeSource from "./vendor/three.module.js?raw";
import type { ProjectData } from "@/state/projectStore";
import type { SolveReport } from "@/wasmBridge/workerClient";

/**
 * Self-contained interactive 3D HTML report (ARCHITECTURE.md section 5,
 * `standaloneHtml3d.ts`; section 18 M8/e2): embeds three.js source, the
 * model JSON and the ELU thermal colors into ONE .html file that opens in
 * any browser — fully offline, no server, no CDN.
 */
/**
 * HTML-escapes a project name for safe interpolation into the standalone
 * report `<title>` / `<h1>` (v1.6.0 security audit A: a stored
 * `<script>`-bearing project name used to execute in the exported file).
 */
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildStandaloneHtml3d(project: ProjectData, report: SolveReport | null): string {
  const uls = report?.combinations.find((c) => c.kind === "ULS");
  const sls = report?.combinations.find((c) => c.kind === "SLS");
  const model = {
    name: project.name,
    nodes: project.structure.nodes.map((n) => [n.x, n.y, n.z]),
    beams: project.structure.beams.map((b) => ({
      id: b.id,
      n1: b.n1 - 1,
      n2: b.n2 - 1,
      section: b.section_id,
    })),
    utilizations: Object.fromEntries((uls?.beams ?? []).map((b) => [b.beam_id, b.utilization])),
    deflections: Object.fromEntries(
      (sls?.beams ?? []).map((b) => [b.beam_id, b.midspan_deflection * 1000]),
    ),
  };
  // v1.6.0 security audit A: `</script>` (or any `<`) inside the JSON —
  // e.g. a beam named from a hostile .rdm import — used to break out of the
  // inline `<script type="module">`. Unicode-escape the angle brackets so
  // the embedded JSON can never close the script element.
  const data = JSON.stringify(model).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e");
  const safeName = escapeHtml(project.name);

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RDM Studio — ${safeName} — rapport 3D</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; font-family: Inter, system-ui, sans-serif; color: #0F172A; background: #F8FAFC; }
  header { display: flex; align-items: baseline; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #E2E8F0; background: #fff; }
  header h1 { font-size: 15px; margin: 0; }
  header span { font-size: 11px; color: #94A3B8; }
  #scene { position: absolute; inset: 57px 0 0 0; }
  #legend { position: absolute; right: 16px; top: 72px; background: #fff; border: 1px solid #E2E8F0; border-radius: 6px; padding: 10px 12px; font-size: 11px; }
  #bar { height: 8px; width: 140px; margin-top: 6px; background: linear-gradient(to right, #1D4ED8, #06B6D4, #10b981, #F59E0B, #DC2626); border-radius: 4px; }
  #hint { position: absolute; left: 16px; bottom: 12px; font-size: 11px; color: #94A3B8; }
</style>
</head>
<body>
<header><h1>RDM Studio — ${safeName}</h1><span>Rapport 3D autonome — ELU η = exploitation (EN 1990 / EN 1993-1-1)</span></header>
<div id="scene"></div>
<div id="legend">η (ELU)<div id="bar"></div><span>0.00</span> — <span>1.25</span></div>
<div id="hint">Glisser: orbite · Molette: zoom · Clic droit: pan</div>
<script type="module">
const MODEL = ${data};
${threeSource}
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xF8FAFC);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.01, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.getElementById("scene").appendChild(renderer.domElement);

// Thermal spectrum (section 17)
const STOPS = [[0,0x1D4ED8],[0.25,0x06B6D4],[0.5,0x10B981],[0.75,0xF59E0B],[1,0xDC2626]].map(([t, c]) => [t, new THREE.Color(c)]);
function spectrum(ratio) {
  const t = Math.min(1, Math.max(0, ratio || 0));
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i-1]; const [t1, c1] = STOPS[i];
      return c0.clone().lerp(c1, (t - t0) / (t1 - t0));
    }
  }
  return STOPS.at(-1)[1];
}

const group = new THREE.Group();
let maxDefl = 0.000001;
for (const id in MODEL.deflections) maxDefl = Math.max(maxDefl, Math.abs(MODEL.deflections[id]));
const scale = (0.05 * 6) / maxDefl;
for (const beam of MODEL.beams) {
  const a = MODEL.nodes[beam.n1], b = MODEL.nodes[beam.n2];
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const dir = end.clone().sub(start);
  const length = dir.length();
  const geo = new THREE.CylinderGeometry(0.04, 0.04, length, 10);
  const eta = MODEL.utilizations[beam.id] !== undefined ? MODEL.utilizations[beam.id] / 1.25 : 0.5;
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: spectrum(eta) }));
  mesh.position.copy(start.clone().add(end).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  group.add(mesh);
}
scene.add(group);
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(4, -6, 8);
scene.add(sun);

// Hand-rolled orbit/pan/zoom (no drei in the standalone file)
let theta = Math.PI / 4, phi = Math.PI / 3, radius = 12;
const target = new THREE.Vector3(0, 0, 0.5);
function applyCamera() {
  camera.position.set(
    target.x + radius * Math.sin(phi) * Math.cos(theta),
    target.y + radius * Math.sin(phi) * Math.sin(theta),
    target.z + radius * Math.cos(phi),
  );
  camera.lookAt(target);
}
applyCamera();
let dragging = null, lastX = 0, lastY = 0;
const dom = renderer.domElement;
dom.addEventListener("pointerdown", (e) => { dragging = e.button === 2 ? "pan" : "orbit"; lastX = e.clientX; lastY = e.clientY; dom.setPointerCapture(e.pointerId); });
dom.addEventListener("pointermove", (e) => {
  if (dragging === null) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  if (dragging === "orbit") {
    theta -= dx * 0.01;
    phi = Math.min(Math.PI - 0.05, Math.max(0.05, phi - dy * 0.01));
  } else {
    const right = new THREE.Vector3().subVectors(camera.position, target).cross(camera.up).normalize();
    target.addScaledVector(right, dx * radius * 0.002);
    target.z += dy * radius * 0.002;
  }
  applyCamera();
});
dom.addEventListener("pointerup", () => { dragging = null; });
dom.addEventListener("contextmenu", (e) => e.preventDefault());
dom.addEventListener("wheel", (e) => { radius *= 1 + Math.sign(e.deltaY) * 0.1; applyCamera(); }, { passive: true });
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
renderer.setAnimationLoop(() => renderer.render(scene, camera));
</script>
</body>
</html>`;
}

/** Downloads the standalone 3D report. */
export function exportStandaloneHtml3d(
  project: ProjectData,
  report: SolveReport | null,
  download: (filename: string, text: string, mime?: string) => void,
): void {
  download(
    `${project.name.replace(/[^\w-]+/g, "_")}-rapport-3d.html`,
    buildStandaloneHtml3d(project, report),
    "text/html;charset=utf-8",
  );
}
