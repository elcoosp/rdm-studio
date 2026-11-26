import { r as DeferSource, s as Node, t as ComponentFn } from "./ir-BlKLvQXv.js";
import { HeadTags, RenderCtx, RenderInput } from "@oxide-fw/core/types";
interface RenderState {
  /** Deferred boundaries collected during the shell walk (§7.1). */
  defers: Array<{
    id: number;
    value: DeferSource;
    render: (resolved: unknown) => Node;
  }>;
  nextBoundaryId: number;
  /** Element counter for solid-style hydration keys (per-framework flavor). */
  nextElementId: number;
  /** Deterministic scope id (route-derived) for framework flavors. */
  scope: string;
  /** True while walking an island subtree: handler markers restart at `h0`
   *  so a standalone hydrateIsland() replay is byte-identical to the SSR
   *  island markup. Page-level markers use `p0…` instead — both scopes start
   *  their counters at 0, and without the prefix a page rebind resolving
   *  `[data-ox-id="h0"]` from the document root could bind a page handler
   *  onto an island's element (or vice versa) whenever the island precedes
   *  the page's own marker in document order. */
  islandScope?: boolean;
  /** Client handler bindings collected during the walk (hydration contract). */
  handlers: Array<HandlerBinding>;
}
/** One client handler the server marked with data-ox-on / data-ox-id. */
export interface HandlerBinding {
  /** The deterministic marker id (`p0`, `p1`, … page scope; `h0`, `h1`, …
   *  island scope) emitted as data-ox-id. */
  id: string;
  /** DOM event name (lowercased `on` prop, e.g. `click`). */
  event: string;
  /** The client handler; closes over the component's client hooks. */
  handler: (ev: unknown) => void;
}
/**
 * Merge two neutral head models — a tiny replica of render::HeadTags::merge:
 * the inner (page/route) title wins but keeps the outer (layout) position;
 * titleTemplate comes from the layout; other lists append in inner order with
 * meta entries overriding on their identifying key (name/property/…).
 */
export declare function mergeHead(outer: HeadTags, inner: Partial<HeadTags>): HeadTags;
/** Apply a `%s` title template ("Head Test" + "%s · Atlas" → "Head Test · Atlas"). */
export declare function applyTitleTemplate(head: HeadTags): string | undefined;
/** Client hooks the hydration layer injects (§7 hydrate/update contract). */
export interface ClientHooks {
  /** Re-render the current route tree with patched data (adapter.update). */
  update(patch: Record<string, unknown>): void;
  /** Client navigation hook (the core router intercepts links first). */
  navigate(href: string): void;
}
/** Look up a registered page component (client hydration reuses the registry). */
export declare function pageComponent(route: string): ComponentFn;
/** Test/build helper: the island chunk map (§10.3 "each island is its own chunk"). */
export declare const islandModules: Record<string, {
  default: ComponentFn;
}>;
/** Test/build helper: pages that throw at render (error-boundary conformance). */
export declare const throwsAtRender: Set<string>;
export declare function newRenderState(route: string): RenderState;
/** Render one standalone IR node (island hydration uses this path). */
export declare function renderNode(node: Node, state: RenderState): {
  html: string;
  head: Node[];
};
/** Render one standalone IR node to a string with a fresh route-scoped state. */
export declare function renderNodeToString(node: Node, state: RenderState): string;
/**
 * Rebuild the deterministic handler bindings for a tree: render it into a
 * fresh state and return the collected data-ox-on / data-ox-id bindings in
 * marker order. The client binds these onto the live DOM (src/hydrate.ts).
 */
export declare function walkTreeForHandlers(tree: Node, islandScope?: boolean): HandlerBinding[];
/**
 * Streaming render (§7 `render(input) → ReadableStream<Uint8Array>`).
 * Pull-driven (backpressure): the next chunk is produced only on pull.
 * Chunk plan: [head] [body shell] then one chunk per deferred resolution
 * (`template[data-ox-c]` + swapper, §7.1). A rejecting boundary streams the
 * error boundary content instead (§10.2 step 5).
 */
export declare function render(rawInput: RenderInput): ReadableStream<Uint8Array>;
/** Drain the stream into one HTML string (shell + every resolution). */
export declare function renderToString(input: RenderInput): Promise<string>;
/**
 * Shell-only render (sync): placeholders stay unresolved. The client uses
 * this for update()/mount() — streamed slots are owned by the server stream
 * and the ox:swap glue, not by client re-renders.
 */
export declare function renderShellToString(input: RenderInput): string;
/**
 * `head(ctx)`: builds the React-flavored head model from the render context
 * and merges it into the neutral HeadTags model (packages/oxide types.ts).
 * Route-level head tags may be passed through `ctx.locals['oxide:head']`
 * (the pipeline registers loader meta there); they override the defaults,
 * and the layout title template applies at emit time.
 */
export declare function head(ctx: RenderCtx): HeadTags;
export {};
//# sourceMappingURL=render.d.ts.map