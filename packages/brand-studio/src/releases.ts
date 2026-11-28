export interface ReleaseSpec {
  version: string;
  title: string;
  subtitle: string;
  tags: readonly string[];
  stitchIllustrationPrompt: string;
}

export const RELEASE_CATALOG: readonly ReleaseSpec[] = [
  {
    version: "v1.0.0",
    title: "3D Timoshenko Solver & Eurocode 3",
    subtitle: "5-step local-first workshop · EN 1993-1-1 · Sparse Cholesky WASM",
    tags: ["3D Timoshenko", "EN 1993-1-1", "WASM < 20 ms"],
    stitchIllustrationPrompt:
      "Isometric 3D architectural engineering illustration on a pure solid #FFFFFF background, zero text, zero labels, zero numbers, zero logos: a steel portal frame (HEA columns, IPE rafter) on a subtle millimeter grid with fixed/pinned support triangles, vertical red distributed load arrows, a translucent #1D4ED8 cobalt section-cut plane, and smooth 5-tier FEA thermal stress gradients (cobalt to cyan, emerald, amber, crimson), studio daylight lighting.",
  },
  {
    version: "v1.1.0",
    title: "Modal Analysis & Metrology Camera",
    subtitle: "Natural modes f₁..f₆ · Rolling telemetry · Iso / XY / XZ / YZ views",
    tags: ["Modes f₁..f₆", "3D Gizmo", "EN 1998-1"],
    stitchIllustrationPrompt:
      "Isometric 3D architectural engineering illustration on a pure solid #FFFFFF background, zero text, zero labels, zero numbers, zero logos: a multi-bay steel frame oscillating in a harmonic eigenmode vibration wave showing a ghosted light-grey undeformed wireframe overlaid with a vibrant cyan-to-emerald deformed mode shape and a floating translucent geometric orientation cube, daylight studio render.",
  },
  {
    version: "v1.3.0",
    title: "STEP / IGES CAD Import & Inertial Fields",
    subtitle: "Native wireframe extraction · 3-axis accelerations · Von Mises σvM",
    tags: ["STEP / IGES", "3D Acceleration", "Von Mises σvM"],
    stitchIllustrationPrompt:
      "Isometric 3D architectural engineering illustration on a pure solid #FFFFFF background, zero text, zero labels, zero numbers, zero logos: an offshore steel lifting cradle frame transitioning smoothly from fine #1D4ED8 cobalt CAD wireframe lines on the left into solid extruded I-sections on the right, subjected to 3-axis directional force arrows in cobalt, cyan, and crimson with Von Mises stress color bands, clean studio daylight.",
  },
  {
    version: "v1.4.0",
    title: "6-DOF Support Matrix & SHA-256 Reports",
    subtitle: "Trapezoidal span loads · RDM 7 restraint library · Cryptographic seal",
    tags: ["6-DOF RDM 7", "Trapezoidal Loads", "SHA-256"],
    stitchIllustrationPrompt:
      "Isometric 3D architectural engineering illustration on a pure solid #FFFFFF background, zero text, zero labels, zero numbers, zero logos: a continuous 3-span steel beam resting on detailed mechanical pinned and roller support assemblies with a crimson trapezoidal distributed load profile above it and clean steel cross-section end caps, studio daylight precision render.",
  },
  {
    version: "v1.5.0",
    title: "Operate-Mode Workstation",
    subtitle: "Responsive split-view · Metrology drawers · Real-time state sync",
    tags: ["Operate Mode", "Split Metrology", "TanStack Tables"],
    stitchIllustrationPrompt:
      "Isometric 3D architectural engineering illustration on a pure solid #FFFFFF background, zero text, zero labels, zero numbers, zero logos: a detailed 3D Warren steel bridge truss rendered with smooth cobalt-to-emerald FEA utilization colors, framed by clean geometric drafting guidelines and translucent frosted-glass architectural planes, daylight studio lighting.",
  },
  {
    version: "v1.6.0",
    title: "Pure-Rust Parametric Frame Generators",
    subtitle: "Portal frames, trusses, Polonceau roofs & towers · 3D dimensioning",
    tags: ["Rust Generators", "Frames & Trusses", "3D Metrology"],
    stitchIllustrationPrompt:
      "Isometric 3D architectural engineering illustration on a pure solid #FFFFFF background, zero text, zero labels, zero numbers, zero logos: a pitched-roof industrial steel portal hall with purlins, wind cross-bracing, bolted baseplates, and crisp #1D4ED8 cobalt architectural dimension ticks and extension lines, clean studio daylight.",
  },
  {
    version: "v1.7.0",
    title: "Timoshenko Shear, Thermal & Tension Bracing",
    subtitle: "Tension-only tie rods · Thermal ΔT loads · 41 certified benchmarks",
    tags: ["Tension / Struts", "Thermal ΔT", "41 Benchmarks"],
    stitchIllustrationPrompt:
      "Isometric 3D architectural engineering illustration on a pure solid #FFFFFF background, zero text, zero labels, zero numbers, zero logos: an X-braced steel lattice tower bay featuring slender diagonal tension tie rods with central turnbuckles glowing in cobalt and emerald, and a subtle amber-to-crimson thermal gradient along the upper chord, daylight studio lighting.",
  },
  {
    version: "v1.9.0",
    title: "Second-Order P-Δ & Multi-Material BIM",
    subtitle: "EC2 Concrete · EC5 Timber · EC9 Aluminium · IFC4 / glTF export",
    tags: ["Second-Order P-Δ", "EC2 / EC5 / EC9", "BIM IFC4 / glTF"],
    stitchIllustrationPrompt:
      "Isometric 3D architectural engineering illustration on a pure solid #FFFFFF background, zero text, zero labels, zero numbers, zero logos: a hybrid multi-material structure combining a warm laminated timber glulam beam, brushed steel columns, and concrete foundation plinths with subtle P-Delta lateral sway curvature arcs in #1D4ED8 cobalt, daylight studio render.",
  },
  {
    version: "v2.0.0",
    title: "True P-Δ Tangent Solver & Pareto Optimizer",
    subtitle: "Mass vs EC3 utilization frontier · Integrated report builder",
    tags: ["Tangent P-Δ", "Pareto Optimizer", "Report Builder"],
    stitchIllustrationPrompt:
      "Isometric 3D architectural engineering illustration on a pure solid #FFFFFF background, zero text, zero labels, zero numbers, zero logos: a 3-storey braced steel building frame with smooth cobalt-to-emerald-to-amber FEA stress contours alongside a sleek floating 3D translucent Pareto optimization surface curve highlighted by a glowing #1D4ED8 cobalt node, daylight studio lighting.",
  },
  {
    version: "v2.0.1",
    title: "Cached WASM Engine & EC3 Curve-d Stability",
    subtitle: "General buckling curve d · Instant multi-view state resolution",
    tags: ["Cached WASM", "EC3 Curve d", "Stability"],
    stitchIllustrationPrompt:
      "Isometric 3D architectural engineering illustration on a pure solid #FFFFFF background, zero text, zero labels, zero numbers, zero logos: a close-up of a slender steel I-section column undergoing lateral-torsional buckling with smooth 5-tier FEA thermal stress bands (cobalt to cyan, emerald, amber) and fine hairline stiffness grid lines, daylight studio render.",
  },
  {
    version: "v2.1.0",
    title: "URL-First Architecture & 3D Force Diagrams",
    subtitle: "Signed N/V/T/M ribbons on 3D members · Compressed URL sharing",
    tags: ["URL-First", "3D N/V/T/M", "Offline Pro"],
    stitchIllustrationPrompt:
      "Isometric 3D architectural engineering illustration on a pure solid #FFFFFF background, zero text, zero labels, zero numbers, zero logos: a steel Pratt truss bridge with translucent signed bending-moment and shear-force ribbons extruded directly along the 3D members in #1D4ED8 cobalt and #06B6D4 cyan, crisp architectural drafting studio look.",
  },
  {
    version: "v2.1.1",
    title: "Bilingual Precision & Vector Takumi PDF",
    subtitle: "Embedded-font A4 calculation notes · Contextual ⌘K command palette",
    tags: ["Takumi A4 PDF", "Bilingual EN / FR", "Command ⌘K"],
    stitchIllustrationPrompt:
      "Isometric 3D architectural engineering illustration on a pure solid #FFFFFF background, zero text, zero labels, zero numbers, zero logos: a 3D steel cantilever jib crane beam with thermal stress gradient beside a floating crisp white layered architectural drafting sheet with #1D4ED8 cobalt geometric accent lines, studio daylight lighting.",
  },
  {
    version: "v2.1.2",
    title: "Spring Micro-Interactions & Swiss Metrology",
    subtitle: "Magnetic x ∈ [0, L] section cursor · Zero native form controls",
    tags: ["Swiss Metrology", "Magnetic Cursor", "Zero Native"],
    stitchIllustrationPrompt:
      "Isometric 3D architectural engineering illustration on a pure solid #FFFFFF background, zero text, zero labels, zero numbers, zero logos: a precision steel portal frame sliced by a glowing translucent #1D4ED8 cobalt cutting plane with graduated millimeter tick marks along the beam axis, clean studio daylight render.",
  },
  {
    version: "v2.2.0",
    title: "3-App Ecosystem & Diataxis Docs",
    subtitle: "WebGL 3D studio · Static Oxide landing site · Bilingual docs",
    tags: ["3D Studio", "Oxide Site", "Diataxis Docs"],
    stitchIllustrationPrompt:
      "Isometric 3D architectural engineering illustration on a pure solid #FFFFFF background, zero text, zero labels, zero numbers, zero logos: three aligned isometric floating frosted-glass architectural plates displaying a 3D structural frame, geometric truss modules, and blueprint wireframe schematics connected by fine #1D4ED8 cobalt lines, studio daylight.",
  },
  {
    version: "v2.3.0",
    title: "RDM7 CAD Power Tools, Springs & Envelopes",
    subtitle: "Elastic supports k · Imposed settlements Δ · 49 benchmarks",
    tags: ["RDM 7 Springs", "EN 1990 Envelopes", "49 Benchmarks"],
    stitchIllustrationPrompt:
      "Isometric 3D architectural engineering illustration on a pure solid #FFFFFF background, zero text, zero labels, zero numbers, zero logos: a 3D Polonceau roof truss resting on detailed #1D4ED8 cobalt helical spring supports with translucent shaded Min/Max bending envelope bands along the rafters, daylight studio lighting.",
  },
  {
    version: "v2.4.0",
    title: "Composite Section Studio & Branded Note",

    subtitle: "Multi-element cross-sections · Plastic neutral axis · .docx export",
    tags: ["Composite Sections", "Principal Axes", "Branded Note"],
    stitchIllustrationPrompt:
    "Isometric 3D architectural engineering illustration on a pure solid #FFFFFF background, zero text, zero labels, zero numbers, zero logos: an extruded built-up composite steel cross-section combining a welded I-girder with back-to-back UPN channels resting on a millimeter coordinate grid with #1D4ED8 cobalt principal axis vectors and an amber plastic neutral plane, studio daylight.",
  },
];
