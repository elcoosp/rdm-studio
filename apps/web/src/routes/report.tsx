import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { encodeProject } from "@/lib/urlShare";
import { useProjectStore } from "@/state/projectStore";

export const Route = createFileRoute("/report")({
  component: ReportPage,
});

function ReportPage() {
  const project = useProjectStore((s) => s.project);
  const [copied, setCopied] = useState(false);
  const shareUrl = useMemo(() => {
    const encoded = encodeProject(project);
    return `${window.location.origin}/report?p=${encoded}`;
  }, [project]);

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
      <section className="rounded-panel border border-hairline bg-panel p-4">
        <h2 className="mb-3 text-[15px] font-semibold">
          <Trans>Rapport de model</Trans>
        </h2>
        <dl className="text-[13px]">
          <dt className="text-ink-muted">
            <Trans>Nom du projet</Trans>
          </dt>
          <dd className="font-data">{project.name}</dd>
          <dt className="mt-2 text-ink-muted">
            <Trans>Noeuds / Poutres / Appuis / Charges</Trans>
          </dt>
          <dd className="font-data">
            {project.structure.nodes.length} / {project.structure.beams.length} /{" "}
            {project.structure.supports.length} / {project.structure.loads.length}
          </dd>
          <dt className="mt-2 text-ink-muted">
            <Trans>Poids propre automatique</Trans>
          </dt>
          <dd className="font-data">{project.structure.self_weight_enabled ? "oui" : "non"}</dd>
        </dl>
        <h3 className="mt-4 mb-2 text-[13px] font-semibold text-ink-secondary">
          <Trans>Profils utilises</Trans>
        </h3>
        <ul className="font-data list-disc pl-5 text-[13px]">
          {[
            ...new Set(project.structure.beams.map((b) => `${b.section_id} (${b.material_id})`)),
          ].map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </section>
      <aside className="rounded-panel border border-hairline bg-panel p-4">
        <h2 className="mb-3 text-[15px] font-semibold">
          <Trans>Partage par URL</Trans>
        </h2>
        <p className="text-[12px] text-ink-secondary">
          <Trans>
            Le modele .rdm est compresse (lz-string) dans l'URL et valide par Valibot a la
            relecture.
          </Trans>
        </p>
        <textarea
          readOnly
          className="font-data mt-2 h-24 w-full rounded border border-hairline p-2 text-[11px]"
          value={shareUrl}
        />
        <button
          type="button"
          className="mt-2 w-full rounded border border-accent px-2 py-1.5 text-[13px] text-accent"
          onClick={() => {
            void navigator.clipboard.writeText(shareUrl).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? <Trans>Copie !</Trans> : <Trans>Copier l'URL de partage</Trans>}
        </button>
      </aside>
    </div>
  );
}
