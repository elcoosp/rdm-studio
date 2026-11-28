import { useEffect, useMemo, useRef } from "react";
import { useSearch } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useLingui } from "@lingui/react/macro";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, ClipboardPaste } from "lucide-react";
import { Badge } from "@rdm-studio/ui/primitives";
import { DataTable } from "@/components/ui/data-table";
import { NumberFieldRoot, NumberFieldInput } from "@/components/ui/number-field";
import {
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot,
} from "@/components/ui/combobox";
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconTrash } from "@rdm-studio/ui/icons";
import { useProjectStore, type BeamData, type NodeData } from "@/state/projectStore";
import { useSelectedIds, useUpdateSearch } from "@/hooks/useStudioQuery";

/**
 * M9.4 — Synchronized Nodes & Beams Metrology Spreadsheet (Step 1 bottom
 * drawer, Swiss Metrology `ModelDataTable`): two TanStack Table tabs
 * (Nœuds / Poutres) with inline `NumberField` coordinate editing, support
 * badges, per-row Section Combobox + Matériau Select + Roulis fields and
 * JetBrains Mono `L (m)` readouts — BIDIRECTIONALLY synchronized with the
 * persistent 3D viewport:
 *
 * - hovering a row highlights the node/beam in 3D (`hoveredNodeId` /
 *   `hoveredBeamId` render options),
 * - clicking a row selects it (`?node=` / `?beam=` URL contract),
 * - picking in 3D scrolls the corresponding row into view,
 * - pasting tab/CSV coordinate rows (`x y z`) batch-creates nodes.
 */

const MATERIALS = ["S235JR", "S355J2", "304L", "6061-T6"] as const;

/** Human support label from the 6-DOF lock matrix. */
function supportLabel(locked: boolean[]): string {
  const [tx, ty, tz] = [locked[0] === true, locked[1] === true, locked[2] === true];
  const rotations = locked.slice(3);
  if (tx && ty && tz && rotations.every(Boolean)) {
    return "Encastrement";
  }
  if (tx && ty && tz && !rotations.some(Boolean)) {
    return "Rotule";
  }
  if (tz && !tx && !ty) {
    return "Appui simple";
  }
  if (tx && tz && !ty) {
    return "Glissière";
  }
  return "Partiel";
}

/**
 * Collapsible bottom metrology drawer (v1.5.0 data dock lineage): Nœuds /
 * Poutres TanStack tables behind a h-9 tab bar with a h-44 scroll pane
 * when expanded — the 3D viewport keeps 75%+ of the screen. Locked E2E
 * selectors (`data-dock`, `dock-tab-nodes`, `dock-tab-beams`,
 * `data-dock-toggle`) ride the same DOM as the v2.5.0
 * `model-data-table` contract.
 */
export function ModelDataTable({
  onHoverNode,
  onHoverBeam,
  sections = [],
}: {
  onHoverNode?: (id: number | null) => void;
  onHoverBeam?: (id: number | null) => void;
  /** EN 10365 / 10210 / 10056 designations for the Section Combobox. */
  sections?: string[];
}) {
  const { t } = useLingui();
  // URL-backed dock tab (`?tab=`) and visibility (`?dock=`).
  const search = useStudioSearchShim();
  const updateSearch = useUpdateSearch();
  const tab = search.tab === "beams" ? "beams" : "nodes";
  const open = (search.dock ?? 1) === 1;
  const setTab = (next: "nodes" | "beams"): void => {
    updateSearch((prev) => ({ ...prev, tab: next }));
  };
  const setOpen = (next: boolean): void => {
    updateSearch((prev) => ({ ...prev, dock: next ? 1 : 0 }));
  };
  const nodeCount = useProjectStore((s) => s.project.structure.nodes.length);
  const beamCount = useProjectStore((s) => s.project.structure.beams.length);
  const addNode = useProjectStore((s) => s.addNode);

  // Spreadsheet paste: tab / CSV / space-separated `x y z` rows.
  const onPaste = (text: string): void => {
    const rows = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "");
    const points: [number, number, number][] = [];
    for (const row of rows) {
      const cells = row
        .split(/[\t;,]+|\s+/)
        .map((c) => c.trim())
        .filter((c) => c !== "");
      if (cells.length < 3) {
        continue;
      }
      const nums = cells.slice(0, 3).map((c) => Number(c.replace(",", ".")));
      if (nums.length < 3 || nums.some((n) => !Number.isFinite(n))) {
        continue;
      }
      points.push([nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0]);
    }
    if (points.length === 0) {
      toast.error(t`Presse-papiers illisible — attendu « x y z » par ligne`);
      return;
    }
    for (const [x, y, z] of points) {
      addNode(x, y, z);
    }
    toast(t`${points.length} nœud(s) créé(s) depuis le presse-papiers`);
  };

  return (
    <section
      className="shrink-0 overflow-hidden rounded border border-hairline bg-panel"
      data-testid="model-data-table"
      onPaste={(event) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        if (text.trim() !== "") {
          event.preventDefault();
          onPaste(text);
        }
      }}
    >
      {/* Legacy locked E2E wrapper: the v1.5.0 dock selectors
          (`data-dock` → tabs + table pane) stay addressable under the
          v2.5.0 `model-data-table` contract. */}
      <div className="overflow-hidden" data-testid="data-dock">
        <div className="flex h-9 items-center gap-1 px-1.5">
          <button
            type="button"
            data-testid="dock-tab-nodes"
            className={`flex h-7 items-center rounded px-2 text-[12px] ${
              tab === "nodes" ? "bg-accent-tint text-accent" : "text-ink-secondary"
            }`}
            onClick={() => setTab("nodes")}
          >
            Nœuds ({nodeCount})
          </button>
          <button
            type="button"
            data-testid="dock-tab-beams"
            className={`flex h-7 items-center rounded px-2 text-[12px] ${
              tab === "beams" ? "bg-accent-tint text-accent" : "text-ink-secondary"
            }`}
            onClick={() => setTab("beams")}
          >
            Poutres ({beamCount})
          </button>
          <span
            className="ml-auto hidden items-center gap-1 pr-1 text-[10px] text-ink-muted md:flex"
            data-testid="paste-coords-hint"
          >
            <ClipboardPaste size={12} strokeWidth={1.5} aria-hidden />
            {t`Coller x y z (Tab/CSV) pour créer des nœuds`}
          </span>
          <button
            type="button"
            aria-label={open ? "Replier le tableau de données" : "Déplier le tableau de données"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-muted hover:text-ink-primary"
            data-testid="data-dock-toggle"
            onClick={() => setOpen(!open)}
          >
            {open ? (
              <ChevronDown size={14} strokeWidth={1.5} aria-hidden />
            ) : (
              <ChevronUp size={14} strokeWidth={1.5} aria-hidden />
            )}
          </button>
        </div>
        {open ? (
          <div
            className="h-44 overflow-auto border-t border-hairline px-2 pb-2"
            tabIndex={0}
            data-testid="nodes-paste-target"
          >
            {tab === "nodes" ? (
              <NodesSheet onHoverNode={onHoverNode} />
            ) : (
              <BeamsSheet onHoverBeam={onHoverBeam} sections={sections} />
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Legacy search shim: the drawer reads `?tab=` / `?dock=` through the
 *  studio schema without re-declaring route types here. */
function useStudioSearchShim(): { tab?: string; dock?: number } {
  return useSearch({ strict: false }) as { tab?: string; dock?: number };
}

// --- Nœuds sheet ------------------------------------------------------------

function NodesSheet({ onHoverNode }: { onHoverNode?: (id: number | null) => void }) {
  const nodes = useProjectStore((s) => s.project.structure.nodes);
  const supports = useProjectStore((s) => s.project.structure.supports);
  const { nodeId, selectNode } = useSelectedIds();
  const removeNode = useProjectStore((s) => s.removeNode);
  const moveNode = useProjectStore((s) => s.moveNode);
  const paneRef = useRef<HTMLDivElement>(null);
  const supportByNode = useMemo(
    () => new Map(supports.map((s) => [s.node_id, s.locked_dofs])),
    [supports],
  );

  // 3D → table: the URL selection scrolls its row into view.
  useEffect(() => {
    if (nodeId === null || paneRef.current === null) {
      return;
    }
    const index = nodes.findIndex((n) => n.id === nodeId);
    const row = paneRef.current.querySelectorAll("tbody tr")[index];
    row?.scrollIntoView({ block: "nearest" });
  }, [nodeId, nodes]);

  const columns = useMemo<ColumnDef<NodeData, unknown>[]>(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: (ctx) => (
          <span className="font-data pr-2" data-testid={`node-id-${ctx.row.original.id}`}>
            N{ctx.row.original.id}
          </span>
        ),
      },
      ...(["x", "y", "z"] as const).map((axis) => ({
        id: axis,
        header: `${axis.toUpperCase()} (m)`,
        meta: { numeric: true },
        cell: (ctx: { row: { original: NodeData } }) => (
          <NumberFieldRoot
            value={ctx.row.original[axis]}
            step={0.1}
            onValueChange={(value) => {
              if (value === null) {
                return;
              }
              moveNode(
                ctx.row.original.id,
                axis === "x" ? value : ctx.row.original.x,
                axis === "y" ? value : ctx.row.original.y,
                axis === "z" ? value : ctx.row.original.z,
              );
            }}
          >
            <NumberFieldInput
              className="h-7 w-16 px-1 py-0 text-[12px]"
              aria-label={`Nœud ${ctx.row.original.id} · coordonnée ${axis}`}
            />
          </NumberFieldRoot>
        ),
      })),
      {
        id: "support",
        header: "Liaison",
        cell: (ctx: { row: { original: NodeData } }) => {
          const locked = supportByNode.get(ctx.row.original.id);
          return locked === undefined ? (
            <span className="text-[11px] text-ink-muted">—</span>
          ) : (
            <Badge size="sm" mono data-testid={`node-support-${ctx.row.original.id}`}>
              {supportLabel(locked)}
            </Badge>
          );
        },
      },
      {
        id: "remove",
        header: "",
        cell: (ctx: { row: { original: NodeData } }) => (
          <button
            type="button"
            aria-label={`Supprimer le nœud ${ctx.row.original.id}`}
            className="text-ink-muted hover:text-fea-max"
            onClick={(event) => {
              event.stopPropagation();
              removeNode(ctx.row.original.id);
            }}
          >
            <IconTrash size={13} />
          </button>
        ),
      },
    ],
    [moveNode, removeNode, supportByNode],
  );
  return (
    <div ref={paneRef} data-testid="nodes-sheet">
      <DataTable<NodeData>
        columns={columns}
        data={nodes}
        onRowClick={(n) => selectNode(n.id)}
        onRowHover={
          onHoverNode === undefined ? undefined : (n) => onHoverNode(n === null ? null : n.id)
        }
        rowClassName={(n) => (nodeId === n.id ? "bg-accent-tint" : undefined)}
      />
    </div>
  );
}

// --- Poutres sheet ----------------------------------------------------------

function BeamsSheet({
  onHoverBeam,
  sections,
}: {
  onHoverBeam?: (id: number | null) => void;
  sections: string[];
}) {
  const beams = useProjectStore((s) => s.project.structure.beams);
  const nodes = useProjectStore((s) => s.project.structure.nodes);
  const { beamId, selectBeam } = useSelectedIds();
  const removeBeam = useProjectStore((s) => s.removeBeam);
  const updateBeam = useProjectStore((s) => s.updateBeam);
  const batch = useProjectStore((s) => s.batch.selectedBeamIds);
  const paneRef = useRef<HTMLDivElement>(null);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  useEffect(() => {
    if (beamId === null || paneRef.current === null) {
      return;
    }
    const index = beams.findIndex((b) => b.id === beamId);
    const row = paneRef.current.querySelectorAll("tbody tr")[index];
    row?.scrollIntoView({ block: "nearest" });
  }, [beamId, beams]);

  const columns = useMemo<ColumnDef<BeamData, unknown>[]>(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: (ctx) => (
          <span className="font-data pr-2" data-testid={`beam-id-${ctx.row.original.id}`}>
            B{ctx.row.original.id}
          </span>
        ),
      },
      {
        accessorKey: "n1",
        header: "Nœud i",
        cell: (ctx) => <span className="font-data">N{ctx.row.original.n1}</span>,
      },
      {
        accessorKey: "n2",
        header: "Nœud j",
        cell: (ctx) => <span className="font-data">N{ctx.row.original.n2}</span>,
      },
      {
        accessorKey: "section_id",
        header: "Section",
        cell: (ctx: { row: { original: BeamData } }) => (
          <ComboboxRoot
            items={sections}
            value={ctx.row.original.section_id}
            onValueChange={(next: string | null) => {
              if (next !== null) {
                updateBeam(ctx.row.original.id, { section_id: next });
              }
            }}
          >
            <ComboboxInput
              className="h-7 w-28"
              aria-label={`Section poutre ${ctx.row.original.id}`}
              placeholder={ctx.row.original.section_id}
            />
            <ComboboxContent
              className="min-w-[220px]"
              renderItem={(designation: string) => (
                <ComboboxItem key={designation} value={designation}>
                  <span className="font-data">{designation}</span>
                </ComboboxItem>
              )}
            >
              <ComboboxEmpty>Aucun profilé</ComboboxEmpty>
            </ComboboxContent>
          </ComboboxRoot>
        ),
      },
      {
        accessorKey: "material_id",
        header: "Matériau",
        cell: (ctx: { row: { original: BeamData } }) => (
          <SelectRoot
            value={ctx.row.original.material_id}
            onValueChange={(next) => {
              if (next !== null) {
                updateBeam(ctx.row.original.id, { material_id: next });
              }
            }}
          >
            <SelectTrigger
              aria-label={`Matériau poutre ${ctx.row.original.id}`}
              className="h-7 w-24 text-[12px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATERIALS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRoot>
        ),
      },
      {
        id: "roll",
        header: "Roulis (°)",
        meta: { numeric: true },
        cell: (ctx: { row: { original: BeamData } }) => (
          <NumberFieldRoot
            value={Math.round((ctx.row.original.roll_angle_rad * 180) / Math.PI)}
            step={5}
            onValueChange={(deg) => {
              if (deg !== null) {
                updateBeam(ctx.row.original.id, { roll_angle_rad: (deg * Math.PI) / 180 });
              }
            }}
          >
            <NumberFieldInput
              className="h-7 w-14 px-1 py-0 text-[12px]"
              aria-label={`Roulis poutre ${ctx.row.original.id}`}
            />
          </NumberFieldRoot>
        ),
      },
      {
        id: "length",
        header: "L (m)",
        meta: { numeric: true },
        cell: (ctx: { row: { original: BeamData } }) => {
          const a = nodeById.get(ctx.row.original.n1);
          const b = nodeById.get(ctx.row.original.n2);
          const length =
            a !== undefined && b !== undefined ? Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) : 0;
          return (
            <span className="font-data" data-testid={`beam-length-${ctx.row.original.id}`}>
              {length.toFixed(2).replace(".", ",")}
            </span>
          );
        },
      },
      {
        id: "remove",
        header: "",
        cell: (ctx: { row: { original: BeamData } }) => (
          <button
            type="button"
            aria-label={`Supprimer la poutre ${ctx.row.original.id}`}
            className="text-ink-muted hover:text-fea-max"
            onClick={(event) => {
              event.stopPropagation();
              removeBeam(ctx.row.original.id);
            }}
          >
            <IconTrash size={13} />
          </button>
        ),
      },
    ],
    [nodeById, removeBeam, sections, updateBeam],
  );

  return (
    <div ref={paneRef} data-testid="beams-sheet">
      <DataTable<BeamData>
        columns={columns}
        data={beams}
        onRowClick={(b, event) => {
          if (event.shiftKey) {
            useProjectStore.getState().toggleBeamSelection(b.id);
            return;
          }
          selectBeam(b.id);
        }}
        onRowHover={
          onHoverBeam === undefined ? undefined : (b) => onHoverBeam(b === null ? null : b.id)
        }
        rowClassName={(b) =>
          beamId === b.id || batch.includes(b.id) ? "bg-accent-tint" : undefined
        }
      />
    </div>
  );
}
