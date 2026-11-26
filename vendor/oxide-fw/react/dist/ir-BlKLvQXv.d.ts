import { fromBase64, toBase64 } from "@oxide-fw/core/bytes";
/** A component: a plain function from props to a Node (§7 component model).
 *
 * `props` is `never` (not `any`) because the IR layer holds a heterogeneous
 * component registry (`PAGES`, `LAYOUTS`, `islandModules`) where each entry
 * declares its own props interface (`PageProps`,
 * `PageProps & { initialCount?: number }`, etc.). TypeScript parameter
 * contravariance makes `(props: PageProps) => Node` unassignable to
 * `(props: Record<string, unknown>) => Node`, so `Record<string, unknown>`
 * cannot represent the registry. `never` is contravariant bottom: every
 * concrete component is assignable to `(props: never) => Node`. The IR
 * walker widens at the callsite (see `callComponent` in render.ts) — the
 * single documented existential-to-universal boundary. Same construction as
 * the heterogeneous fn registry in packages/core/src/server/index.ts
 * (`(...args: never[]) => unknown`). */
type ComponentFn = (props: Record<string, unknown>) => Node;
/** The tree kinds: fragment / element / text / raw / defer / island. */
type Node = FragmentNode | ElementNode | TextNode | RawNode | DeferNode | IslandNode;
/** A fragment: children rendered without a wrapper (React `<></>` analog). */
interface FragmentNode {
  kind: 'fragment';
  children: Node[];
}
interface ElementNode {
  kind: 'element';
  /** HTML tag name, or a component function (rendered recursively). */
  tag: string | ComponentFn;
  /** Literal attribute names (attribute names are NOT JSX-magified). */
  props: Record<string, unknown>;
  children: Node[];
}
interface TextNode {
  kind: 'text';
  value: string;
}
/** Pre-escaped HTML inserted verbatim (protocol templates, JSON-LD). */
interface RawNode {
  kind: 'raw';
  html: string;
}
/**
 * A deferred boundary (§7.1). `value` is the promise-like from the load data
 * (RenderInput data may carry promise-likes per packages/oxide types.ts).
 * The shell renders `fallback`; when `value` resolves the adapter streams a
 * `template[data-ox-c]` resolution + swapper (see src/protocol.ts).
 * `render` maps the resolved value into the boundary's final tree.
 */
interface DeferNode {
  kind: 'defer';
  value: DeferSource;
  fallback: Node;
  render: (resolved: unknown) => Node;
}
type DeferSource = PromiseLike<unknown> | {
  __oxide_defer: true;
  promise: PromiseLike<unknown>;
};
/** Islands mode host (§10.3): <ox-island> with props + chunk reference. */
interface IslandNode {
  kind: 'island';
  component: string;
  chunk: string;
  strategy: 'load' | 'idle' | 'visible' | `media(${string})`;
  props: unknown;
  children: Node;
}
/** Element or component node. `el(Component, props, ...children)` renders the
 * component recursively; `el('div', props, ...children)` is a plain element. */
declare function el(tag: string | ComponentFn, props?: Record<string, unknown> | null, ...children: Array<Node | Node[] | null | undefined | false | ''>): Node;
/** Fragment node: children render unwrapped (layouts compose via fragments). */
declare function frag(...children: Array<Node | Node[] | null | undefined | false | ''>): Node;
/** Text node — stringified and escaped at render time. */
declare function t(value: unknown): Node;
/** Pre-escaped HTML (use only for trusted/protocol strings). */
declare function raw(html: string): Node;
/** Deferred boundary (§7.1). Accepts a promise or the runtime `defer()` marker. */
declare function deferred(value: DeferSource, fallback: Node, render: (resolved: unknown) => Node): Node;
/** Islands host node (§10.3); rendered with the exact render-crate shape. */
declare function island(opts: {
  component: string;
  chunk: string;
  strategy: IslandNode['strategy'];
  props: unknown;
}, children: Node): Node;
/** Unwrap the runtime `defer()` marker to its promise. */
declare function deferPromise(source: DeferSource): PromiseLike<unknown>;
/** Escape element text (`& < >`). */
declare function escapeText(s: string): string;
/** Escape attribute values (`& " < > '`). */
declare function escapeAttr(s: string): string;
/** `\\u003c` escaping inside script payloads (parity with render crate). */
declare function escapeScript(s: string): string;
/**
 * Deterministic 6-hex FNV-1a — scope/hash ids for framework flavors
 * (vue `data-v-<scope>`, svelte `svelte-<hash>`, solid hydration keys).
 * Derived from stable inputs (route ids) so markup is deterministic
 * (§7.2 "deterministic hydration markup").
 */
declare function hash6(input: string): string;
export { toBase64 as S, fromBase64 as _, FragmentNode as a, raw as b, RawNode as c, deferred as d, el as f, frag as g, escapeText as h, ElementNode as i, TextNode as l, escapeScript as m, DeferNode as n, IslandNode as o, escapeAttr as p, DeferSource as r, Node as s, ComponentFn as t, deferPromise as u, hash6 as v, t as x, island as y };
//# sourceMappingURL=ir-BlKLvQXv.d.ts.map