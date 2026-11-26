import { b as raw, d as deferred, f as el, g as frag, h as escapeText, p as escapeAttr, r as DeferSource, s as Node, t as ComponentFn, v as hash6, x as t, y as island } from "./ir-BlKLvQXv.js";
import { applyTitleTemplate, head, islandModules, mergeHead, pageComponent, render, renderShellToString, renderToString } from "./render.js";
import { ClientOptions, hydrate, hydrateIsland, mount, update } from "./hydrate.js";
import { Image, ImageProps, ImageVariantModule } from "./image.js";
import { RealAdapterOptions } from "./real-adapter.js";
import { ReactNode } from "react";
import { GotoOpts, HrefOpts, HrefOpts as HrefOpts$1, HrefParam, SearchParseResult, goto, hrefFor as href, parseSearch } from "@oxide-fw/core/client";
import { Disposer, FrameworkAdapter } from "@oxide-fw/core/types";
/**
 * Hydrate a single `<ox-island>` host with React's own client runtime.
 *
 * `mod` is the dynamic-import result of the island chunk; its `default`
 * export is the React component the server rendered. React's hydration
 * preserves the SSR'd markup and only attaches event listeners, so the
 * initial state the server produced stays put until the user interacts.
 *
 * Resolves to a disposer that unmounts the React root; `hydrateIslands`
 * stores it and calls it on page teardown.
 */
export declare function reactHydrateIsland(host: Element, mod: unknown, props: unknown, _opts?: ClientOptions): Promise<Disposer>;
/** Hydration timing (§10.3): `load` (immediate), `idle`, `visible`, or
 *  `{ media: '(...)' }` for a CSS media query. */
type IslandStrategy = 'load' | 'idle' | 'visible' | {
  media: string;
};
interface IslandProps {
  /** Stable name — must match a key in `config.islands` so the build can
   *  resolve the emitted chunk. Also the value written to `data-ox-island`
   *  (used by the client to look up the module and by the dev inspector). */
  component: string;
  /** Logical chunk id (`/islands/counter.js` or `Counter`). The build
   *  rewrites this to the hashed URL emitted to `dist/client/`; the dev
   *  server resolves it live. A foreign island (see `framework`) carries
   *  none — its chunk belongs to its own adapter's build. */
  chunk?: string;
  /** Hydration timing; default `'load'`. */
  strategy?: IslandStrategy;
  /** Props forwarded to the client island. Serialized as base64-encoded
   *  JSON into `data-ox-props`; the client boot script decodes it. */
  props?: Record<string, unknown>;
  /** The island's own framework (§V2-F01). When set and different from this
   *  adapter's framework, the component emits the SELF-CONTAINED pending
   *  placeholder — `<ox-island data-ox-island data-ox-fw data-ox-pending='1'
   *  data-ox-props>` with no rendered children — that the worker's
   *  `island:render` op + the core `resolveForeign` stream transform resolve
   *  with the island's own adapter. Children are ignored in that case (a
   *  foreign framework's children cannot be SSR'd here). */
  framework?: string;
  /** Optional island placeholder markup. Omitted when the island has no
   *  fallback content — `createElement(Island, props, child)` fills it via
   *  React's trailing-children mechanism, which requires the prop to be
   *  optional for TS overload resolution (TS2769 otherwise). */
  children?: ReactNode;
}
export declare function Island({ component, chunk, strategy, props, framework, children }: IslandProps): ReactNode;
interface LinkProps {
  /** The route pattern the generated overloads type (`/blog/[slug]`). */
  route: string;
  /** The route's params — dynamic segments fill, leftovers ride the query. */
  params?: Record<string, HrefParam>;
  /** The typed search object, hash, and i18n locale (the href opts). */
  opts?: HrefOpts$1;
  /** Anchor attributes spread verbatim (`className`, `aria-*`, …). */
  anchorProps?: Record<string, string | number | boolean>;
  /** The link's children — the visible label. */
  children?: ReactNode;
}
export declare function Link({ route, params, opts, anchorProps, children }: LinkProps): ReactNode;
/**
 * The swapper logic — byte-identical to `render::SWAPPER_SRC`. Finds
 * `template[data-ox-c='<id>']`, moves its content over the matching
 * `template[data-ox-b='<id>']` placeholder via replaceWith, then dispatches
 * the `ox:swap` CustomEvent (detail: {id}) that triggers adapter hydration.
 */
export declare const SWAPPER_SRC: string;
/** Streamed boundary placeholder — render::boundary_fallback. */
export declare function boundaryFallback(id: number, fallbackHtml: string): string;
/**
 * Streamed boundary resolution — render::boundary_content. The content
 * template plus a self-contained swapper IIFE with `id` baked in. `nonce`
 * follows the render crate: omitted when empty (Rust injects CSP nonces in
 * production, §10.2 step 4).
 */
export declare function boundaryContent(id: number, html: string, nonce?: string): string;
/**
 * Islands host markup (§10.3) — render::island_element byte shape:
 * `<ox-island data-ox-island='C' data-ox-chunk='K' data-ox-strategy='S'
 * data-ox-props='P'>SSR</ox-island>`.
 */
export declare function islandElement(directive: {
  component: string;
  chunk: string;
  strategy: string;
  propsB64: string;
}, ssrHtml: string): string;
/** Error boundary markup — render crate streamed-error shape (lib.rs ~L692). */
export declare function errorBoundary(code: string, message: string): string;
/**
 * Hydration bootstrap (§9.5) — render::hydration_bootstrap shape: the base64
 * ODF payload script plus the `window.__oxide` router bootstrap. Emitted when
 * RenderInput.odf carries serialized data; Rust injects CSP nonces later.
 */
export declare function hydrationBootstrap(odfB64: string, routeId: string): string;
export declare const adapter: FrameworkAdapter;
/**
 * `clientAdapter` — the browser-side adapter for the island boot entry.
 *
 * Same manifest as the named `adapter`, but `hydrateIsland` is React's own
 * `hydrateRoot` so `useState`, event handlers and refs work. The generated
 * boot entry (`<out_dir>/.oxide/island-boot.mjs`) imports this, not the
 * neutral-IR `adapter`, so the two have distinct, well-named roles:
 *
 *   * `adapter`      → tests, conformance, environments without React
 *   * `clientAdapter` → production browser hydration
 *
 * `react-dom/client` is code-split inside `reactHydrateIsland`, so a page
 * with no islands never fetches it.
 */
export declare const clientAdapter: FrameworkAdapter;
/** Options accepted by the adapter factory from oxide.config.ts. */
export interface AdapterOptions extends Omit<Partial<RealAdapterOptions>, 'ssr'> {
  /**
   * §14.1: the default is real SSR. \`ssr: 'real'\` requires it; \`'auto'\`
   * (the internal strategy value) prefers it and falls back to the IR
   * renderer when the framework deps are unavailable; \`'ir'\` is the
   * explicit escape hatch — the pre-§14.1 behavior, useful when an app
   * ships no framework runtime and only needs the meta-framework's IR
   * placeholders.
   */
  ssr?: 'real' | 'auto' | 'ir';
  /** Reserved: build-time compiler flags (currently informational). */
  compiler?: boolean | Record<string, unknown>;
}
/**
 * Build a {@link FrameworkAdapter} (§7). Real upstream SSR is selected by
 * `ssr: 'real'` (or `'auto'` with an explicit `componentFor` override); the
 * route components themselves are supplied by the runtime resolver built
 * from the generated `dist/server/ssr/index.js` (§6.4). A config therefore
 * needs no component imports — `framework: react({ ssr: 'real' })`.
 */
export declare function createAdapter(opts?: AdapterOptions): FrameworkAdapter;
/**
 * The default export is a callable factory so `oxide.config.ts` reads
 * naturally: `framework: react({ ssr: 'real' })`. Named
 * exports (`adapter`, `createAdapter`, `createRealAdapter`) remain
 * available for tests and internal use.
 */
declare function reactFactory(opts?: AdapterOptions): FrameworkAdapter;
export { type ClientOptions, type ComponentFn, type DeferSource, type GotoOpts, type HrefOpts, Image, type ImageProps, type ImageVariantModule, type IslandProps, type IslandStrategy, type LinkProps, type Node, type SearchParseResult, applyTitleTemplate, reactFactory as default, deferred, el, escapeAttr, escapeText, frag, goto, hash6, head, href, hydrate, hydrateIsland as irHydrateIsland, island, islandModules, mergeHead, mount, pageComponent, parseSearch, raw, render, renderShellToString, renderToString, t, update };
//# sourceMappingURL=index.d.ts.map