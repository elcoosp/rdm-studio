import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useLocation, useMatches, useNavigate, useRouterState } from "@tanstack/react-router";
import { useLingui } from "@lingui/react/macro";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useProjectStore } from "@/state/projectStore";
import { useStageStore, captureViewportPng } from "@/state/stageStore";
import { ForceDiagram3DLayer } from "./ForceDiagrams3D";
import { useSelectedIds, useViewportParams } from "@/hooks/useStudioQuery";
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
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

/**
 * PersistentStage (v1.6.0, requirement 1): ONE WebGL stage mounted once in
 * `__root.tsx` for Steps 1–4. The `<Canvas>` NEVER unmounts across
 * `/geometry`, `/supports`, `/loads`, `/results` — user orbit/zoom/pan
 * survives every step switch — and ONE BVH-indexed `BufferGeometry`
 * serves both rendering (`BeamMeshes`) and picking (raycast layer).
 *
 * v2.1.2 (audit `519229b`): the shared geometry memoization is STABILIZED
 * — it depends only on the model identity and the meaningful render
 * inputs (`colorRatios` / `displacements` / `deformScale`), never on the
 * route's getter identities, so unrelated state ticks (hover, picking
 * latency, URL params) can no longer rebuild & dispose the BVH tree.
 *
 * The stage is glued over the active route's registered slot pane every
 * animation frame (fixed positioning updated by direct style writes, so
 * layout changes never re-render the React tree), and stays alive —
 * merely hidden — on `/report` so `captureViewportPng()` can embed a live
 * 3D snapshot into the A4 sheet & Takumi PDF. v2.1.2 adds a Base UI
 * right-click context menu on beams/nodes and the 24px metrological
 * status bar (`Repère Z-up · Grille · Sélection · [F] Cadrer`).
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

/** Where the last stage right-click landed (member + nearest node). */
interface StageContextPick {
  beamId: number | null;
  nodeId: number | null;
  clientX: number;
  clientY: number;
}

/**
 * In-canvas bridge resolving the right-click target: BVH member pick plus
 * the nearest endpoint node (distance to the ray), surfaced to the DOM
 * context menu through a ref (never a re-render per event).
 */
function StageContextMenuBridge({
  geometry,
  nodes,
  onPick,
}: {
  geometry: THREE.BufferGeometry | null;
  nodes: { id: number; x: number; y: number; z: number }[];
  onPick: (pick: StageContextPick) => void;
}) {
  const { camera, gl } = useThree();
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  useEffect(() => {
    if (geometry === null) {
      return;
    }
    const dom = gl.domElement;
    const handler = (event: MouseEvent) => {
      const rect = dom.getBoundingClientRect();
      const ndc = {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
      };
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      const result = pickBeamAtRay(raycaster, geometry);
      let nodeId: number | null = null;
      if (result.beamId !== null) {
        // Nearest node to the ray (contextual node target for Encastrer /
        // Inspecter — the member under the pointer defines the vicinity).
        let bestDist = Number.POSITIVE_INFINITY;
        for (const n of nodesRef.current) {
          const d = raycaster.ray.distanceToPoint(new THREE.Vector3(n.x, n.y, n.z));
          if (d < bestDist) {
            bestDist = d;
            nodeId = n.id;
          }
        }
      }
      pickRef.current({
        beamId: result.beamId,
        nodeId,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };
    dom.addEventListener("contextmenu", handler);
    return () => dom.removeEventListener("contextmenu", handler);
  }, [geometry, camera, gl]);
  return null;
}

/** Grid-plane click-to-place node + 2-node click-to-connect beam tools. */
function ModelTools({ nodes }: { nodes: { id: number; x: number; y: number; z: number }[] }) {
  const toolMode = useViewportStore((s) => s.toolMode);
  // v2.1.0: the magnetic snap grid is the URL `?snap=` param (10|50|100 mm).
  const { snapStep } = useViewportParams();
  const addNode = useProjectStore((s) => s.addNode);
  const addBeam = useProjectStore((s) => s.addBeam);
  const { selectNode } = useSelectedIds();
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
  const updateBeam = useProjectStore((s) => s.updateBeam);
  const subdivideBeam = useProjectStore((s) => s.subdivideBeam);
  const setSupport = useProjectStore((s) => s.setSupport);
  const removeBeam = useProjectStore((s) => s.removeBeam);
  const removeNode = useProjectStore((s) => s.removeNode);
  // v2.1.0: selection writes go to the URL (`?beam=` / `?node=`); layer
  // flags and the cutting plane are URL params too (zero store mirrors).
  const { selectBeam, selectNode, beamId: selectedBeamId } = useSelectedIds();
  const { layers, cutting, snapStep } = useViewportParams();
  const contentGetter = useStageStore((s) => s.contentGetter);
  const optionsGetter = useStageStore((s) => s.optionsGetter);
  const pathname = useLocation().pathname;
  const matches = useMatches();
  const navigate = useNavigate();
  const { t } = useLingui();
  // The stage only covers the active leaf route when its staticData
  // declares `stageVisible: true` (report → false: the stage hides but
  // keeps rendering for the A4 snapshot).
  const stageVisible = matches.at(-1)?.staticData.stageVisible === true;
  const diagramsOn = useRouterState({ select: (s) => s.location.search.diagrams === 1 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const [sectionDims, setSectionDims] = useState<Map<string, SectionDims>>(new Map());
  const [pickMs, setPickMs] = useState<number | undefined>(undefined);
  const [ctxPick, setCtxPick] = useState<StageContextPick | null>(null);
  const [ctxOpen, setCtxOpen] = useState(false);

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
  const stageVisibleRef = useRef(stageVisible);
  stageVisibleRef.current = stageVisible;
  // Glue the stage over the active slot pane every frame: direct style
  // writes keep 60 FPS and never re-render the R3F tree.
  useEffect(() => {
    let raf = 0;
    let lastKey = "";
    const tick = () => {
      const el = wrapRef.current;
      const slot = useStageStore.getState().slotEl;
      const live = slot !== null && stageVisibleRef.current && hasModelRef.current;
      if (el !== null) {
        if (!live) {
          // No slot (Step 5): keep the last geometry, hide from view —
          // the canvas stays alive for captureViewportPng().
          if (lastKey !== "hidden") {
            // v2.0.2: cache the last live render BEFORE hiding so the
            // Step 5 A4 sheet and the Takumi PDF embed a populated 3D
            // snapshot instead of a cleared blank buffer.
            const png = useStageStore.getState().capture?.() ?? null;
            if (png !== null) {
              useStageStore.getState().setLastSnapshot(png);
            }
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
            // v2.0.2: refresh the cached snapshot once the pane settles.
            window.setTimeout(() => {
              const png = useStageStore.getState().capture?.() ?? null;
              if (png !== null) {
                useStageStore.getState().setLastSnapshot(png);
              }
            }, 350);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // v2.1.2 (audit 519229b): the meaningful render inputs are read from
  // the route's options getter and tracked by VALUE, not by the getter's
  // function identity — unrelated route re-render ticks (pick latency,
  // hover, URL params) no longer rebuild + dispose the BVH geometry.
  const options = optionsGetter?.() ?? {};
  const colorRatios = options.colorRatios ?? null;
  const displacements = options.displacements ?? null;
  const deformScale = options.deformScale ?? null;
  const profiles = useMemo(
    () => (sectionDims.size > 0 ? beamProfileLookup(beams, sectionDims) : undefined),
    [beams, sectionDims],
  );
  const sharedGeometry = useMemo(() => {
    if (beams.length === 0) {
      return null;
    }
    // v2.2.0: the solver fault path clears `displacements` — build the
    // deformed mesh when a displacement field exists, but if it collapses
    // to an empty mesh (or throws), fall back to the UNDEFORMED geometry
    // so BeamMeshes never vanish and leave floating member labels in
    // mid-air while the diagnostic card is on screen.
    const build = (deformed: boolean) => {
      try {
        return buildBeamGeometry(nodes, beams, {
          colorRatios: deformed ? (colorRatios ?? undefined) : undefined,
          displacements: deformed ? (displacements ?? undefined) : undefined,
          deformScale: deformed ? (deformScale ?? undefined) : undefined,
          profiles,
        });
      } catch {
        return build(false);
      }
    };
    let geometry = build(displacements !== null);
    if ((geometry.getAttribute("position")?.count ?? 0) === 0) {
      geometry.dispose();
      geometry = build(false);
    }
    return geometry;
  }, [nodes, beams, colorRatios, displacements, deformScale, profiles]);
  useEffect(() => {
    return () => {
      sharedGeometry?.dispose();
    };
  }, [sharedGeometry]);

  const selectedBeam = beams.find((b) => b.id === selectedBeamId) ?? null;
  const ctxBeamId = ctxPick?.beamId ?? null;
  const ctxBeam = beams.find((b) => b.id === ctxBeamId) ?? null;
  const ctxNodeId = ctxPick?.nodeId ?? null;

  return (
    <ContextMenuRoot
      open={ctxOpen}
      // The in-canvas bridge is the ONLY opener (it stores the pick
      // first); this handler merely closes and clears the pick.
      onOpenChange={(open) => {
        if (!open) {
          setCtxOpen(false);
          setCtxPick(null);
        }
      }}
    >
      <ContextMenuTrigger
        render={
          <div
            ref={wrapRef}
            data-testid="persistent-stage"
            className="fixed z-10 overflow-hidden"
            style={{ visibility: "hidden" }}
          />
        }
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
          <StageContextMenuBridge
            geometry={sharedGeometry}
            nodes={nodes}
            onPick={(pick) => {
              setCtxPick(pick);
              // Only open over a member / node — empty space keeps the
              // default browser behaviour suppressed but shows no menu.
              if (pick.beamId !== null || pick.nodeId !== null) {
                setCtxOpen(true);
              }
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
          {/* v2.1.0: true 3D signed force diagrams along the members
              (`?diagrams=1`, Step 4 only — 22fd9fa audit item). */}
          {diagramsOn && pathname === "/results" ? <ForceDiagram3DLayer /> : null}
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
        {/* v2.1.2: 24px bottom metrological status bar — Z-up convention,
            live magnetic grid step, current selection and the [F] hint. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex h-6 items-center justify-between gap-2 border-t border-hairline bg-panel/85 px-2 font-data text-[10px] text-ink-muted backdrop-blur"
          data-testid="stage-status-bar"
        >
          <span>
            {t`Repère Z-up`} · {t`Grille`} {Math.round(snapStep * 1000)} mm
          </span>
          <span className="min-w-0 truncate">
            {selectedBeam !== null
              ? `${t`Sélection`} : P${selectedBeam.id} (${selectedBeam.section_id})`
              : t`Sélection : aucune`}
          </span>
          <span>[F] {t`Cadrer`}</span>
        </div>
      </ContextMenuTrigger>
      {/* v2.1.2: Base UI right-click context menu on 3D beams/nodes —
          portal-rendered above the WebGL stage. */}
      <ContextMenuContent data-testid="stage-context-menu">
        {ctxBeam !== null || ctxNodeId !== null ? (
          <>
            <ContextMenuItem
              disabled={ctxBeamId === null}
              onSelect={() => {
                if (ctxBeamId === null) return;
                selectBeam(ctxBeamId);
                void navigate({ to: "/results" });
                setCtxOpen(false);
              }}
            >
              {t`Inspecter sur Étape 4`}
            </ContextMenuItem>
            <ContextMenuItem
              disabled={ctxBeamId === null}
              onSelect={() => {
                if (ctxBeamId === null) return;
                const beam = beams.find((b) => b.id === ctxBeamId);
                if (beam === undefined) return;
                const isTruss =
                  beam.releases_start.slice(1).every(Boolean) &&
                  beam.releases_end.slice(1).every(Boolean);
                const next = isTruss
                  ? [false, false, false, false, false, false]
                  : [false, true, true, true, true, true];
                updateBeam(ctxBeamId, { releases_start: next, releases_end: next });
                setCtxOpen(false);
              }}
            >
              {t`Articuler N1/N2`}
            </ContextMenuItem>
            <ContextMenuItem
              disabled={ctxBeamId === null}
              onSelect={() => {
                if (ctxBeamId === null) return;
                subdivideBeam(ctxBeamId, 4);
                setCtxOpen(false);
              }}
            >
              {t`Subdiviser en 4 tronçons`}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              disabled={ctxNodeId === null}
              onSelect={() => {
                if (ctxNodeId === null) return;
                setSupport(ctxNodeId, [true, true, true, true, true, true]);
                setCtxOpen(false);
              }}
            >
              {t`Encastrer le nœud`}
            </ContextMenuItem>
            <ContextMenuItem
              disabled={ctxBeamId === null && ctxNodeId === null}
              onSelect={() => {
                if (ctxBeamId !== null) {
                  removeBeam(ctxBeamId);
                } else if (ctxNodeId !== null) {
                  removeNode(ctxNodeId);
                }
                setCtxOpen(false);
              }}
            >
              {t`Supprimer`}
            </ContextMenuItem>
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenuRoot>
  );
}

export { captureViewportPng };
