import { deferred, el, escapeAttr, escapeText, frag, hash6, island, raw, t } from "./ir.js";
import { _ as errorBoundary, d as renderToString, g as boundaryFallback, h as boundaryContent, i as mergeHead, m as SWAPPER_SRC, n as head, o as pageComponent, r as islandModules, s as render, t as applyTitleTemplate, u as renderShellToString, v as hydrationBootstrap, y as islandElement } from "./render-DUr1BSSx.js";
import { i as update, n as hydrateIsland, r as mount, t as hydrate } from "./hydrate-eYqo6XeQ.js";
import { n as reactHydrateIsland, t as createRealAdapter } from "./real-adapter-DnfyAZaJ.js";
import { Image } from "./image.js";
import { encodePropsB64 } from "@oxide-fw/core/odf-encode";
import { createElement } from "react";
import { goto, hrefFor, hrefFor as href, parseSearch } from "@oxide-fw/core/client";
// src/render-loading.ts
/** Narrow an unknown loading component to a React function component. Same
* pattern as hydrate-island-real's helper — runtime guard in the body,
* narrowing without a cast at the callsite. */
function assertFunctionComponent(v) {
	if (typeof v !== "function") throw new TypeError("reactRenderLoading: Component must be a React function component");
}
let cachedRoot;
let cachedReact;
async function loadReactRuntime() {
	if (cachedRoot && cachedReact) return {
		root: cachedRoot,
		react: cachedReact
	};
	const [reactMod, clientMod] = await Promise.all([import("react"), import("react-dom/client")]);
	cachedReact = reactMod;
	cachedRoot = clientMod;
	return {
		root: cachedRoot,
		react: cachedReact
	};
}
/**
* Render a loading component into `overlay` with React's own client runtime.
*
* `createRoot(...)` mounts fresh (no SSR markup to hydrate — the overlay is
* empty), so the loading component renders normally. The returned disposer
* unmounts; callers should invoke it synchronously before the tree swaps so
* the overlay is gone when the new page paints.
*
* **Important:** this is async internally (dynamic imports). The router's
* `onNavigateStart` is synchronous. We mount into the overlay only after the
* runtime loads; the overlay div exists immediately, so there is no visual
* gap. Callers that need to synchronously dispose (e.g. navigation
* superseded) get a disposer that safely no-ops if the mount has not
* finished yet.
*/
function reactRenderLoading(overlay, _input, Component) {
	let root;
	let cancelled = false;
	loadReactRuntime().then(({ root: rdc, react }) => {
		if (cancelled) return;
		root = rdc.createRoot(overlay);
		assertFunctionComponent(Component);
		root.render(react.createElement(Component, {}));
	}).catch((e) => {
		console.error?.("oxide: renderLoading (react) failed", e);
	});
	return () => {
		cancelled = true;
		try {
			root?.unmount();
		} catch {}
		root = void 0;
	};
}
function strategyAttr(s) {
	if (typeof s === "string") return s;
	return `media(${s.media.startsWith("(") && s.media.endsWith(")") ? s.media.slice(1, -1) : s.media})`;
}
function Island({ component, chunk, strategy = "load", props = {}, framework, children }) {
	const propsB64 = encodePropsB64(props);
	if (framework !== void 0 && framework !== "react") return createElement("ox-island", {
		suppressHydrationWarning: true,
		"data-ox-island": component,
		"data-ox-fw": framework,
		"data-ox-pending": "1",
		"data-ox-props": propsB64
	});
	return createElement("ox-island", {
		suppressHydrationWarning: true,
		"data-ox-island": component,
		"data-ox-chunk": chunk,
		"data-ox-strategy": strategyAttr(strategy),
		"data-ox-props": propsB64
	}, children);
}
// src/link.ts
function Link({ route, params, opts, anchorProps, children }) {
	return createElement("a", {
		href: hrefFor(route, params, opts),
		"data-ox-link": true,
		...anchorProps
	}, children);
}
// src/index.ts
const adapter = {
	contract: 1,
	name: "react",
	extensions: [".tsx"],
	jsxImportSource: "react",
	capabilities: {
		suspense: "native",
		islands: true,
		hmr: "refresh"
	},
	plugins(opts) {
		return [{
			name: "oxide:react-jsx",
			enforce: "pre",
			transform: "jsx",
			jsxImportSource: "react"
		}, {
			name: "oxide:react-refresh",
			enforce: "post",
			hmr: "refresh"
		}];
	},
	render,
	head,
	hydrate,
	hydrateIsland,
	mount,
	update
};
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
const clientAdapter = {
	...adapter,
	hydrateIsland: reactHydrateIsland,
	renderLoading: reactRenderLoading
};
/**
* Build a {@link FrameworkAdapter} (§7). Real upstream SSR is selected by
* `ssr: 'real'` (or `'auto'` with an explicit `componentFor` override); the
* route components themselves are supplied by the runtime resolver built
* from the generated `dist/server/ssr/index.js` (§6.4). A config therefore
* needs no component imports — `framework: react({ ssr: 'real' })`.
*/
function createAdapter(opts = {}) {
	if (opts.ssr !== "ir") return createRealAdapter({
		ssr: opts.ssr ?? "auto",
		...typeof opts.componentFor === "function" ? { componentFor: opts.componentFor } : {},
		layoutFor: opts.layoutFor
	});
	return adapter;
}
/**
* The default export is a callable factory so `oxide.config.ts` reads
* naturally: `framework: react({ ssr: 'real' })`. Named
* exports (`adapter`, `createAdapter`, `createRealAdapter`) remain
* available for tests and internal use.
*/
function reactFactory(opts) {
	return createAdapter(opts ?? {});
}
export { Image, Island, Link, SWAPPER_SRC, adapter, applyTitleTemplate, boundaryContent, boundaryFallback, clientAdapter, createAdapter, reactFactory as default, deferred, el, errorBoundary, escapeAttr, escapeText, frag, goto, hash6, head, href, hydrate, hydrationBootstrap, hydrateIsland as irHydrateIsland, island, islandElement, islandModules, mergeHead, mount, pageComponent, parseSearch, raw, reactHydrateIsland, render, renderShellToString, renderToString, t, update };

//# sourceMappingURL=index.js.map