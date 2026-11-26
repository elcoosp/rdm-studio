import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { docsHref, studioHref } from "../lib/env";

/**
 * Shared building blocks for the 4 programmatic Eurocode SEO landing pages:
 * a "HowTo"-style method with mono formula blocks, a worked-example table
 * computed from the engine's own EN 10365 / EN 10025 catalogs, a static FAQ
 * (crawlable HTML) and the studio CTA deep-link.
 */

export function SeoCta({ template, label }: { template?: string; label?: string }) {
  const href = studioHref(template !== undefined ? `/geometry?template=${template}` : "/geometry");
  return (
    <div className="my-8 flex flex-wrap items-center gap-3 rounded-[8px] border border-accent bg-accent-tint p-4">
      <p className="min-w-0 flex-1 text-[13px] leading-5 text-ink-secondary">
        {label ?? "Reproduisez ce modèle dans l'atelier : profilés EN 10365, combinaisons EN 1990 et vérification EC3 6.61/6.62 prêts à calculer, 100 % sur votre poste."}
      </p>
      <a
        href={href}
        data-testid="seo-cta"
        className="flex shrink-0 items-center gap-1.5 rounded bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-strong"
      >
        Ouvrir dans l'atelier 3D
        <ArrowRight size={14} strokeWidth={1.5} aria-hidden />
      </a>
    </div>
  );
}

/** A normative formula line — JetBrains Mono, hairline chip. */
export function Formula({ children }: { children: ReactNode }) {
  return (
    <p className="font-data my-2 rounded-[4px] border border-hairline bg-canvas px-3 py-1.5 text-[12px] text-accent">
      {children}
    </p>
  );
}

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <dl className="mt-4 space-y-4">
      {items.map((item) => (
        <div key={item.q} className="max-w-[72ch]">
          <dt className="text-[14px] font-semibold text-ink-primary">{item.q}</dt>
          <dd className="mt-1 text-[13px] leading-6 text-ink-secondary">{item.a}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Breadcrumb({ page }: { page: string }) {
  return (
    <nav aria-label="fil d'ariane" className="font-data mb-4 text-[11px] text-ink-muted">
      <a href="/" className="hover:text-accent">
        Accueil
      </a>
      <span aria-hidden> / </span>
      <span className="text-ink-secondary">{page}</span>
    </nav>
  );
}

export function DocsHandoff({ path }: { path: string }) {
  return (
    <p className="mt-6 text-[13px] text-ink-secondary">
      Méthode complète, hypothèses et limites normatives dans la documentation :{" "}
      <a
        href={docsHref(path)}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-accent hover:underline"
      >
        RDM Studio Docs <span aria-hidden>↗</span>
      </a>
    </p>
  );
}
