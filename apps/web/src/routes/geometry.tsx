import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { IconPlus, IconTrash } from "@/components/icons";
import { feaClient, type SectionSummary } from "@/wasmBridge/workerClient";
import { useProjectStore } from "@/state/projectStore";

export const Route = createFileRoute("/geometry")({
  component: GeometryPage,
});

function GeometryPage() {
  const { project, selection } = useProjectStore();
  const addNode = useProjectStore((s) => s.addNode);
  const removeNode = useProjectStore((s) => s.removeNode);
  const addBeam = useProjectStore((s) => s.addBeam);
  const removeBeam = useProjectStore((s) => s.removeBeam);
  const selectBeam = useProjectStore((s) => s.selectBeam);
  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [newSection, setNewSection] = useState("IPE 200");

  useEffect(() => {
    void feaClient.fetchCatalog().then((c) => setSections(c.sections));
  }, []);

  const ipeSections = sections.filter((s) => s.family === "IPE");
  const material = project.structure.beams[0]?.material_id ?? "S235JR";

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
      <section className="rounded-panel border border-hairline bg-panel p-4">
        <h2 className="mb-3 text-[15px] font-semibold">
          <Trans>Noeuds</Trans>
        </h2>
        <NodeTable />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="flex items-center gap-1 rounded bg-accent px-2.5 py-1.5 text-[13px] text-white"
            onClick={() => addNode(0, 0, 0)}
          >
            <IconPlus size={12} />
            <Trans>Ajouter un noeud</Trans>
          </button>
        </div>
        <h2 className="mt-6 mb-3 text-[15px] font-semibold">
          <Trans>Poutres</Trans>
        </h2>
        <BeamTable />
      </section>
      <aside className="rounded-panel border border-hairline bg-panel p-4">
        <h2 className="mb-3 text-[15px] font-semibold">
          <Trans>Inspecteur de section</Trans>
        </h2>
        <label className="block text-[12px] text-ink-secondary">
          <Trans>Profil (EN 10365)</Trans>
        </label>
        <select
          className="font-data mt-1 w-full rounded border border-hairline px-2 py-1.5 text-[13px]"
          value={newSection}
          onChange={(e) => setNewSection(e.currentTarget.value)}
        >
          {ipeSections.map((s) => (
            <option value={s.designation}>{s.designation}</option>
          ))}
        </select>
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-1 rounded border border-accent px-2 py-1.5 text-[13px] text-accent disabled:opacity-40"
          disabled={selection.nodeId === null}
          onClick={() => {
            const node = useProjectStore.getState().selection.nodeId;
            if (node === null) return;
            const beams = project.structure.beams;
            const target = beams.find((b) => b.n1 === node || b.n2 === node);
            if (target === undefined) {
              addBeam(node, node === 1 ? 2 : 1, newSection, material);
            } else {
              selectBeam(target.id);
            }
          }}
        >
          <Trans>Connecter au noeud sélectionné</Trans>
        </button>
        <dl className="font-data mt-4 space-y-1 text-[12px] text-ink-secondary">
          <dt className="mt-2 text-[11px] font-medium uppercase tracking-wide">
            <Trans>Catalogue</Trans>
          </dt>
          <dd>{sections.length} profils — EN 10365 / 10210 / 10056</dd>
        </dl>
      </aside>
    </div>
  );
}

function NodeTable() {
  const nodes = useProjectStore((s) => s.project.structure.nodes);
  const selectNode = useProjectStore((s) => s.selectNode);
  const removeNode = useProjectStore((s) => s.removeNode);
  const moveNode = useProjectStore((s) => s.moveNode);
  const selection = useProjectStore((s) => s.selection);
  return (
    <table className="w-full text-[13px]">
      <thead className="text-left text-[11px] uppercase tracking-wide text-ink-muted">
        <tr>
          <th className="py-1">ID</th>
          <th>X (m)</th>
          <th>Y (m)</th>
          <th>Z (m)</th>
          <th />
        </tr>
      </thead>
      <tbody className="font-data">
        {nodes.map((n) => (
          <tr
            key={n.id}
            className={`cursor-pointer border-t border-hairline ${selection.nodeId === n.id ? "bg-accent/10" : ""}`}
            onClick={() => selectNode(n.id)}
          >
            <td className="py-1">{n.id}</td>
            {(["x", "y", "z"] as const).map((axis) => (
              <td key={axis}>
                <input
                  className="w-20 rounded border border-hairline px-1 py-0.5"
                  value={n[axis]}
                  onChange={(e) => {
                    const v = Number(e.currentTarget.value);
                    if (Number.isFinite(v))
                      moveNode(
                        n.id,
                        axis === "x" ? v : n.x,
                        axis === "y" ? v : n.y,
                        axis === "z" ? v : n.z,
                      );
                  }}
                />
              </td>
            ))}
            <td className="text-right">
              <button
                type="button"
                aria-label="remove node"
                className="text-ink-muted hover:text-fea-max"
                onClick={() => removeNode(n.id)}
              >
                <IconTrash size={13} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BeamTable() {
  const beams = useProjectStore((s) => s.project.structure.beams);
  const selectBeam = useProjectStore((s) => s.selectBeam);
  const removeBeam = useProjectStore((s) => s.removeBeam);
  const selection = useProjectStore((s) => s.selection);
  return (
    <table className="w-full text-[13px]">
      <thead className="text-left text-[11px] uppercase tracking-wide text-ink-muted">
        <tr>
          <th className="py-1">ID</th>
          <th>N1</th>
          <th>N2</th>
          <th>
            <Trans>Profil</Trans>
          </th>
          <th />
        </tr>
      </thead>
      <tbody className="font-data">
        {beams.map((b) => (
          <tr
            key={b.id}
            className={`cursor-pointer border-t border-hairline ${selection.beamId === b.id ? "bg-accent/10" : ""}`}
            onClick={() => selectBeam(b.id)}
          >
            <td className="py-1">{b.id}</td>
            <td>{b.n1}</td>
            <td>{b.n2}</td>
            <td>{b.section_id}</td>
            <td className="text-right">
              <button
                type="button"
                aria-label="remove beam"
                className="text-ink-muted hover:text-fea-max"
                onClick={() => removeBeam(b.id)}
              >
                <IconTrash size={13} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
