import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useLocation } from "@tanstack/react-router";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useProjectStore } from "@/state/projectStore";
import { useStageStore, captureViewportPng } from "@/state/stageStore";
import { useViewportStore } from "@/state/viewportStore";
import { ViewportCanvas } from "./ViewportCanvas";
import { BeamMeshes, buildBeamGeometry, nodePositions } from "./BeamMeshes";
import { SupportMarkers } from "./SupportMarkers";
import { NodeMarkers } from "./NodeMarkers";
import { ForceVectors3D } from "./ForceVectors3D";
import { CuttingPlane } from "./CuttingPlane";
import { ViewportLabels } from "./ViewportLabels";
import { DimensionLines } from "./DimensionLines";
import { useBeamBoundsTree, pickBeamAtRay } from "./useBvhPicking";
import { beamProfileLookup } from "./ProfileShapes";
import type { SectionDims } from "@/wasmBridge/workerClient";
import { feaClient } from "@/wasmBridge/workerClient";

/**
 * PersistentStage (v1.6.0, requirement 1): ONE WebGL stage mounted once in
 * `__root.tsx` for Steps 1–4. The `<Canvas>` NEVER unmounts across
 * `/geometry`, `/supports`, `/loads`, `/results` — user orbit/zoom/pan
 * survives every step switch — and ONE BVH-indexed `BufferGeometry`
 * serves both rendering (`BeamMeshes`) and picking (raycast layer).
 *
 * The stage is glued over the active route's registered slot pane every
 * animation frame (fixed positioning updated by direct style writes, so
 * layout changes never re-render the React tree), and stays alive —
 * merely hidden — on `/report` so `captureViewportPng()` can embed a live
 * 3D snapshot into the A4 sheet & Takumi PDF.
 */

/** Re-renders on every R3F frame; writes the capture bridge once. */
function CaptureBridge(): null {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    useStageStore.getState().setCapture(() => {
      try {
        gl.render(scene, camera);
        return gl.domElement.toDataURL("image/png");
      } catch {
        return null;
      }
    });
    return () => {
      useStageStore.getState().setCapture(null);
    };
  }, [gl, scene, camera]);
  return null;
}

/**
 * Canvas-level pointer picking through the SHARED BVH-indexed geometry
 * (one geometry for rendering AND picking — no duplicate build).
 */
function StagePickLayer({
  geometry,
  onPick,
}: {
  geometry: THREE.BufferGeometry | null;
  onPick: (beamId: number | null, ms: number) => void;
}) {
  useBeamBoundsTree(geometry);
  const { camera, gl } = useThree();
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  useEffect(() => {
    if (geometry === null) {
      return;
    }
    const dom = gl.domElement;
    const handler = (event: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      const ndc = {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
      };
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      const result = pickBeamAtRay(raycaster, geometry);
      pickRef.current(result.beamId, result.lastSelectionMs);
    };
    dom.addEventListener("pointerdown", handler);
    return () => dom.removeEventListener("pointerdown", handler);
  }, [geometry, camera, gl]);
  return null;
}

/** Grid-plane click-to-place node + 2-node click-to-connect beam tools. */
function ModelTools({ nodes }: { nodes: { id: number; x: number; y: number; z: number }[] }) {
  const toolMode = useViewportStore((s) => s.toolMode);
  const snapStep = useViewportStore((s) => s.snapStep);
  const addNode = useProjectStore((s) => s.addNode);
  const addBeam = useProjectStore((s) => s.addBeam);
  const selectNode = useProjectStore((s) => s.selectNode);
  const pendingRef = useRef<number | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  if (toolMode === "select") {
    return null;
  }
  const snap = (v: number): number => Math.round(v / snapStep) * snapStep;
  if (toolMode === "node") {
    // Invisible pick plane on the metric grid (z = 0): clicking places a
    // snapped node at the intersection point.
    return (
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -0.001]}
        data-testid="grid-pick-plane"
        onClick={(event) => {
          event.stopPropagation();
          const p = event.point;
          addNode(snap(p.x), snap(p.y), snap(p.z));
        }}
      >
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    );
  }
  // Beam mode: first click arms the start node, second click connects.
  return (
    <group>
      {nodes.map((n) => (
        <mesh
          key={n.id}
          position={[n.x, n.y, n.z]}
          onClick={(event) => {
            event.stopPropagation();
            if (pendingRef.current === null) {
              pendingRef.current = n.id;
              setPendingId(n.id);
              selectNode(n.id);
              return;
            }
            const n1 = pendingRef.current;
            pendingRef.current = null;
            setPendingId(null);
            if (n1 !== n.id) {
              addBeam(n1, n.id, "IPE 200", "S235JR");
            }
          }}
        >
          <sphereGeometry args={[pendingId === n.id ? 0.12 : 0.09, 12, 10]} />
          <meshBasicMaterial
            color={pendingId === n.id ? "#06B6D4" : "#1D4ED8"}
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export function PersistentStage(): ReactElement {
  const nodes = useProjectStore((s) => s.project.structure.nodes);
  const beams = useProjectStore((s) => s.project.structure.beams);
  const supports = useProjectStore((s) => s.project.structure.supports);
  const loads = useProjectStore((s) => s.project.structure.loads);
  const selectBeam = useProjectStore((s) => s.selectBeam);
  const selectNode = useProjectStore((s) => s.selectNode);
  const layers = useViewportStore((s) => s.layers);
  const cutting = useViewportStore((s) => s.cutting);
  const contentGetter = useStageStore((s) => s.contentGetter);
  const optionsGetter = useStageStore((s) => s.optionsGetter);
  const pathname = useLocation().pathname;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [sectionDims, setSectionDims] = useState<Map<string, SectionDims>>(new Map());
  const [pickMs, setPickMs] = useState<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void feaClient
      .fetchCatalog()
      .then((c) => {
        if (!cancelled) {
          setSectionDims(new Map(c.sectionDims.map((d) => [d.designation, d])));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // v1.6.0: with a 0-node project the route's empty-state UI must stay
  // clickable — the stage hides itself until a model exists.
  const hasModel = nodes.length > 0;
  const hasModelRef = useRef(hasModel);
  hasModelRef.current = hasModel;
  // Glue the stage over the active slot pane every frame: direct style
  // writes keep 60 FPS and never re-render the R3F tree.
  useEffect(() => {
    let raf = 0;
    let lastKey = "";
    const tick = () => {
      const el = wrapRef.current;
      const slot = useStageStore.getState().slotEl;
      const live = slot !== null && hasModelRef.current;
      if (el !== null) {
        if (!live) {
          // No slot (Step 5): keep the last geometry, hide from view —
          // the canvas stays alive for captureViewportPng().
          if (lastKey !== "hidden") {
            el.style.visibility = "hidden";
            el.style.pointerEvents = "none";
            lastKey = "hidden";
          }
        } else {
          const r = slot.getBoundingClientRect();
          const key = `${r.left.toFixed(1)}|${r.top.toFixed(1)}|${r.width.toFixed(1)}|${r.height.toFixed(1)}`;
          if (lastKey !== key) {
            el.style.visibility = "visible";
            el.style.pointerEvents = "auto";
            el.style.left = `${r.left + 1}px`;
            el.style.top = `${r.top + 1}px`;
            el.style.width = `${r.width - 2}px`;
            el.style.height = `${r.height - 2}px`;
            lastKey = key;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ONE shared BVH-indexed geometry for rendering AND picking.
  const options = optionsGetter?.() ?? {};
  const sharedGeometry = useMemo(() => {
    if (beams.length === 0) {
      return null;
    }
    return buildBeamGeometry(nodes, beams, {
      colorRatios: options.colorRatios,
      displacements: options.displacements,
      deformScale: options.deformScale,
      profiles: sectionDims.size > 0 ? beamProfileLookup(beams, sectionDims) : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- options come
    // from the route render pass; recompute on every stage render.
  }, [nodes, beams, sectionDims, optionsGetter, contentGetter]);
  useEffect(() => {
    return () => {
      sharedGeometry?.dispose();
    };
  }, [sharedGeometry]);

  return (
    <div
      ref={wrapRef}
      data-testid="persistent-stage"
      className="fixed z-10 overflow-hidden"
      style={{ visibility: "hidden" }}
    >
      <ViewportCanvas
        // Kept `viewport-canvas` for the layout-craft regression suite.
        testId="viewport-canvas"
        pickLatency={pickMs}
        nodes={nodes}
        beams={beams}
      >
        <CaptureBridge />
        <StagePickLayer
          geometry={sharedGeometry}
          onPick={(beamId, ms) => {
            setPickMs(ms);
            selectBeam(beamId);
          }}
        />
        {contentGetter?.() ?? null}
        {layers.beams && sharedGeometry !== null ? (
          <BeamMeshes
            nodes={nodes}
            beams={beams}
            geometry={sharedGeometry}
            wireframe={options.wireframe === true}
            selectedBeamId={options.selectedBeamId ?? null}
            hoveredBeamId={options.hoveredBeamId ?? null}
            onPick={(id) => selectBeam(id)}
          />
        ) : null}
        {layers.supports ? <SupportMarkers nodes={nodes} supports={supports} /> : null}
        {layers.loads ? <ForceVectors3D nodes={nodes} beams={beams} loads={loads} /> : null}
        {layers.nodes ? (
          <>
            <NodeMarkers
              positions={nodePositions(nodes)}
              nodeIds={nodes.map((n) => n.id)}
              highlightNodeId={null}
              onPickNode={(id) => selectNode(id)}
            />
            <ModelTools nodes={nodes} />
          </>
        ) : null}
        <ViewportLabels nodes={nodes} beams={beams} pathname={pathname} />
        <DimensionLines nodes={nodes} beams={beams} pathname={pathname} />
        {pathname === "/results" && cutting !== null ? (
          <CuttingPlane beamId={cutting.beamId} ratio={cutting.ratio} />
        ) : null}
      </ViewportCanvas>
    </div>
  );
}

export { captureViewportPng };
