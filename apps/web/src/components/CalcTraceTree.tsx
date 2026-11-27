import { Suspense, useEffect, useState, type ReactElement } from "react";
import { t } from "@lingui/core/macro";
import type { CalcTraceNodeDto } from "../wasmBridge/workerClient";

/**
 * Lazy-loaded KaTeX renderer — the ~340 kB bundle only loads when a
 * trace is actually displayed (route-level lazy loading budget).
 */
/** Loads the KaTeX CSS alongside the module (vite handles both). */
async function loadKatex(): Promise<typeof import("katex")> {
  const [module] = await Promise.all([import("katex"), import("katex/dist/katex.min.css")]);
  return module;
}

/** Recursive hand-checkable trace: clause → formula → numbers → verdict. */
export function CalcTraceTree({
  nodes,
  katex,
  depth = 0,
}: {
  nodes: CalcTraceNodeDto[];
  katex: typeof import("katex") | null;
  depth?: number;
}): ReactElement {
  return (
    <ul className="space-y-3">
      {nodes.map((node, index) => (
        <li key={`${node.clause}-${index}`} className="rounded-[8px] border border-hairline p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted">{node.clause}</span>
            <span
              className={`text-xs font-bold ${node.passed ? "text-emerald-600" : "text-rose-600"}`}
            >
              {node.value.toFixed(3)} / {node.limit.toFixed(2)} {node.unit}{" "}
              {node.passed ? t`OK` : t`DÉPASSÉ`}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium">{node.title}</p>
          {katex !== null && depth < 8 ? (
            <div
              className="mt-1 text-sm"
              // KaTeX MathML output is generated from the engine's own
              // clause strings, never user input — `trust: false` keeps
              // the renderer strictly read-only regardless (v2.1.2 audit).
              dangerouslySetInnerHTML={{
                __html: katex.renderToString(node.formula_latex, {
                  throwOnError: false,
                  output: "mathml",
                  trust: false,
                  strict: false,
                }),
              }}
            />
          ) : (
            <code className="mt-1 block text-xs">{node.formula_latex}</code>
          )}
          <p className="mt-1 text-xs text-ink-secondary ">{node.substituted}</p>
          {node.children.length > 0 ? (
            <div className="mt-2 border-l-2 border-hairline pl-3 ">
              <CalcTraceTree nodes={node.children} katex={katex} depth={depth + 1} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Loads KaTeX lazily then renders the trace tree. */
export function CalcTrace({ nodes }: { nodes: CalcTraceNodeDto[] | null }): ReactElement {
  const [katex, setKatex] = useState<typeof import("katex") | null>(null);
  useEffect(() => {
    let alive = true;
    void loadKatex().then((module) => {
      if (alive) {
        setKatex(module);
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  if (nodes === null || nodes.length === 0) {
    return (
      <p className="text-sm text-ink-muted">{t`Lancer une vérification pour afficher la trace.`}</p>
    );
  }
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">{t`Chargement de KaTeX…`}</p>}>
      <CalcTraceTree nodes={nodes} katex={katex} />
    </Suspense>
  );
}
