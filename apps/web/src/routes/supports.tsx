import { createFileRoute } from "@tanstack/react-router";
import { Trans } from "@lingui/react/macro";
import { useProjectStore } from "@/state/projectStore";

export const Route = createFileRoute("/supports")({
  component: SupportsPage,
});

const DOF_LABELS = ["Ux", "Uy", "Uz", "Rx", "Ry", "Rz"] as const;

function SupportsPage() {
  const nodes = useProjectStore((s) => s.project.structure.nodes);
  const supports = useProjectStore((s) => s.project.structure.supports);
  const setSupport = useProjectStore((s) => s.setSupport);

  const lockedFor = (nodeId: number): boolean[] =>
    supports.find((s) => s.node_id === nodeId)?.locked_dofs ?? [
      false,
      false,
      false,
      false,
      false,
      false,
    ];

  return (
    <div className="p-4">
      <section className="rounded-panel border border-hairline bg-panel p-4">
        <h2 className="mb-3 text-[15px] font-semibold">
          <Trans>Matrice 6 DDL des appuis</Trans>
        </h2>
        <p className="mb-4 text-[12px] text-ink-secondary">
          <Trans>
            Cochez les DDL bloqués par appui. Les rotations libres laissent la flexion passer
            (rotule).
          </Trans>
        </p>
        <table className="w-full max-w-xl text-[13px]">
          <thead className="text-left text-[11px] uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="py-1">
                <Trans>Noeud</Trans>
              </th>
              {DOF_LABELS.map((d) => (
                <th key={d} className="font-data">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => {
              const locked = lockedFor(n.id);
              return (
                <tr key={n.id} className="border-t border-hairline">
                  <td className="font-data py-1.5">{n.id}</td>
                  {DOF_LABELS.map((d, i) => (
                    <td key={d}>
                      <input
                        type="checkbox"
                        aria-label={`dof ${d} node ${n.id}`}
                        checked={locked[i] ?? false}
                        onChange={(e) => {
                          const next = [...locked];
                          next[i] = e.currentTarget.checked;
                          setSupport(n.id, next);
                        }}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
