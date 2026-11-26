import { i as mergeHead, n as head, s as render } from "./render-DUr1BSSx.js";
import { i as update, r as mount, t as hydrate } from "./hydrate-eYqo6XeQ.js";
import { makeRealAdapter } from "@oxide-fw/core/server/real-ssr";
// src/hydrate-island-real.ts
/** Narrow an unknown island module export to a React function component.
*
* The FrameworkAdapter.hydrateIsland contract types `mod` as `unknown` — the
* framework cannot know the module's shape ahead of time. This helper is the
* honest runtime-guard-then-assert pattern: the body checks
* `typeof v === 'function'` (what a React function component IS at runtime,
* no amount of type machinery changes that), and TS uses that guard to narrow
* `unknown` to `FunctionComponent<Record<string, unknown>>` in the caller —
* without an `as` cast. A class component (rare in island code, and not what
* the SSR path emits) would also pass the runtime check; the signature just
* tells TS what to call it.
*/
function assertFunctionComponent(v) {
	if (typeof v !== "function") throw new TypeError("island module must export a React function component");
}
let cachedClient;
let cachedReact;
async function loadReact() {
	if (cachedClient && cachedReact) return {
		client: cachedClient,
		react: cachedReact
	};
	try {
		const [reactMod, clientMod] = await Promise.all([import("react"), import("react-dom/client")]);
		cachedReact = reactMod;
		cachedClient = clientMod;
		return {
			client: cachedClient,
			react: cachedReact
		};
	} catch (e) {
		console.error?.("[oxide] island hydration deferred: runtime not loadable", e);
		throw new Error("island runtime unavailable");
	}
}
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
async function reactHydrateIsland(host, mod, props, _opts = {}) {
	const candidate = mod.default ?? mod;
	assertFunctionComponent(candidate);
	const component = candidate;
	const { client, react } = await loadReact();
	const element = react.createElement(component, props ?? {});
	const root = client.hydrateRoot(host, element);
	return () => root.unmount();
}
// src/real-ssr.ts
/** Return the module's `default` export when an interop wrapper provides
* one; otherwise the module itself. React is CJS-origin, so bundlers may
* wrap it as `{ default: React }`; some configs expose it flat. Both shapes
* reach us at runtime — this helper narrows them to one candidate without
* a cast. */
function pickInteropDefault(mod) {
	if (mod !== null && typeof mod === "object" && "default" in mod) {
		const d = mod.default;
		if (d !== void 0) return d;
	}
	return mod;
}
/** Runtime type guard: `v` has `createElement` (React's functional runtime
* marker). */
function isReactLike(v) {
	if (v === null || typeof v !== "object") return false;
	return typeof Reflect.get(v, "createElement") === "function";
}
/** Runtime type guard: `v` has `renderToString` (react-dom/server's server
* runtime marker). */
function isReactDomServerLike(v) {
	if (v === null || typeof v !== "object") return false;
	return typeof Reflect.get(v, "renderToString") === "function";
}
let cached;
let attempted = false;
let lastLoadError;
function getLastLoadError() {
	return lastLoadError;
}
async function load() {
	if (cached) return cached;
	if (attempted) return void 0;
	attempted = true;
	try {
		const reactMod = await import("react");
		const serverMod = await import("react-dom/server");
		const reactCandidate = pickInteropDefault(reactMod);
		const serverCandidate = pickInteropDefault(serverMod);
		if (!isReactLike(reactCandidate)) {
			lastLoadError = "react imported but createElement is not a function";
			return;
		}
		if (!isReactDomServerLike(serverCandidate)) {
			lastLoadError = "react-dom/server imported but renderToString is not a function";
			return;
		}
		cached = {
			react: reactCandidate,
			server: serverCandidate
		};
		return cached;
	} catch (e) {
		lastLoadError = "import threw: " + (e?.message ?? String(e));
		return;
	}
}
/** True when `react` + `react-dom/server` are resolvable at runtime. */
async function isReactAvailable() {
	return await load() !== void 0;
}
function isChildDescriptor(v) {
	return typeof v === "object" && v !== null && "Component" in v && "props" in v && typeof v.Component !== "undefined";
}
function expandDescriptor(react, descriptor) {
	const props = { ...descriptor.props };
	if (isChildDescriptor(props.children)) props.children = expandDescriptor(react, props.children);
	return react.createElement(descriptor.Component, props);
}
/**
* Render a React component to its HTML string via `react-dom/server`'s
* `renderToString`. Descriptor children (`{ Component, props }`) are expanded
* to real React elements before the outer `createElement` call — see
* `expandDescriptor`.
*
* Throws when React is not installed — callers should check
* `isReactAvailable()` first, or fall back to the IR renderer in
* ./render.ts.
*/
async function renderReactToString(Component, props = {}) {
	const deps = await load();
	if (!deps) throw new Error("@oxide/react: real SSR requires `react` and `react-dom/server` to be installed");
	const expanded = { ...props };
	if (isChildDescriptor(expanded.children)) expanded.children = expandDescriptor(deps.react, expanded.children);
	const element = deps.react.createElement(Component, expanded);
	return deps.server.renderToString(element);
}
/**
* Stream a React component's HTML via `renderToReadableStream` (React 19).
* The returned stream yields the shell immediately and boundary content as
* it resolves — the TTFB property streaming exists for. The shell-first
* chunking is preserved end-to-end: the worker emits each chunk as a raw
* binary frame, and the pipeline's `render_stream_with_recovery` passes them
* straight to the client (only splicing the recovery boundary if a mid-stream
* error occurs).
*
* Falls back to `[renderReactToString]`'s single-chunk result when the
* runtime has no streaming API — a caller that drains the stream still gets
* the same HTML, just as one chunk.
*/
async function renderReactToStream(Component, props = {}) {
	const deps = await load();
	if (!deps) throw new Error("@oxide/react: real SSR requires `react` and `react-dom/server` to be installed");
	const expanded = { ...props };
	if (isChildDescriptor(expanded.children)) expanded.children = expandDescriptor(deps.react, expanded.children);
	const element = deps.react.createElement(Component, expanded);
	if (typeof deps.server.renderToReadableStream === "function") return deps.server.renderToReadableStream(element, { onError: (e) => {
		const detail = e instanceof Error ? e.stack || e.message : String(e);
		console.error?.("oxide: React streaming SSR error", detail);
	} });
	const html = deps.server.renderToString(element);
	const bytes = new TextEncoder().encode(html);
	return new ReadableStream({ start(controller) {
		controller.enqueue(bytes);
		controller.close();
	} });
}
// src/real-adapter.ts
/** The adapter's own layout head (mirrors LAYOUT_HEAD in ./render.ts). */
const LAYOUT_HEAD = {
	title: void 0,
	titleTemplate: "%s · Atlas",
	meta: [{ charset: "utf-8" }, {
		name: "viewport",
		content: "width=device-width, initial-scale=1"
	}],
	link: [],
	style: [],
	script: []
};
/**
* Compose the final HeadTags for a RenderInput. Merge order matches the IR
* renderer: outer = adapter layout head, then the pipeline-supplied
* `input.head` (route/loader head), then the adapter's `head(ctx)` model
* (which the IR path derives from the same data via head(ctx)).
*/
function buildHead(input) {
	const ctx = {
		route: input.route,
		url: input.url,
		params: input.params,
		data: input.data,
		locals: input.locals
	};
	return mergeHead(mergeHead(LAYOUT_HEAD, input.head), head(ctx));
}
/**
* Build a react adapter. Components are resolved by the runtime
* (`RenderInput.resolve`, §6.4) from the generated SSR entry; an explicit
* `componentFor` option overrides it. When `ssr` is 'auto' (default), a
* missing component or missing `react`/`react-dom` deps falls back to the
* neutral-IR renderer; when 'real', a missing page component is the §10.2
* OX-500 diagnostic (never a silent blank body).
*/
function createRealAdapter(opts) {
	return makeRealAdapter({
		name: "react",
		extensions: [".tsx"],
		jsxImportSource: "react",
		capabilities: {
			suspense: "native",
			islands: true,
			hmr: "refresh"
		},
		plugins: () => [{
			name: "oxide:react-jsx",
			enforce: "pre",
			transform: "jsx",
			jsxImportSource: "react"
		}, {
			name: "oxide:react-refresh",
			enforce: "post",
			hmr: "refresh"
		}],
		irRender: render,
		buildHead,
		isAvailable: isReactAvailable,
		lastError: getLastLoadError,
		renderBody: renderReactToString,
		renderStream: renderReactToStream,
		rootAttrs: " id=\"root\" data-reactroot=\"\"",
		hydrate,
		hydrateIsland: reactHydrateIsland,
		mount,
		update,
		opts
	});
}
export { reactHydrateIsland as n, createRealAdapter as t };

//# sourceMappingURL=real-adapter-DnfyAZaJ.js.map