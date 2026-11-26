import { el } from "./ir.js";
import { a as newRenderState, l as renderNodeToString, o as pageComponent, p as walkTreeForHandlers, u as renderShellToString } from "./render-DUr1BSSx.js";
import { attachDeferGlue } from "@oxide-fw/core/client/defer-glue";
import { componentFor, getRouteComponentSource, routeIdFor } from "@oxide-fw/core/client/route-manifest";
// src/real-client.ts
let cached;
let attempted = false;
async function load() {
	if (cached) return cached;
	if (attempted) return void 0;
	attempted = true;
	try {
		const [reactMod, clientMod] = await Promise.all([import("react"), import("react-dom/client")]);
		const react = reactMod.default ?? reactMod;
		const client = clientMod.default ?? clientMod;
		if (typeof react.createElement !== "function") return void 0;
		if (typeof client.createRoot !== "function" && typeof client.hydrateRoot !== "function") return;
		cached = {
			react,
			client
		};
		return cached;
	} catch {
		return;
	} finally {
		if (!cached) attempted = false;
	}
}
/**
* Mount (or hydrate) a REAL page component into the page container with
* React's own client runtime.
*
* - `hydrate: true` → `hydrateRoot` attaches to the server-rendered markup
*   in `container` (§10.3 hydration). On IR-replayed markup React reports a
*   recoverable mismatch and client-renders the real tree — the correct
*   end state either way.
* - `hydrate: false` → `createRoot` + `render` for an empty container
*   (SPA mount, or a post-navigation fresh paint).
*
* Returns `undefined` when React is not installed — callers fall back to
* the IR renderer. The returned {@link RealPageRoot} re-renders on
* navigation via `root.render` (a React root updates in place) and unmounts
* on dispose.
*/
/**
* §8.2 / §16.3: wrap a page component in its layout chain.
*
* The swap logic shared by the initial mount, hydration, and navigation
* update. The outermost layout is applied last (loops from
* `layouts.length - 1` down to 0), so `layouts[0]` ends up outermost —
* the exact tree the SSR adapter emits.
*
* Exported for L6(b): the swap logic is what the Playwright navigation
* spec asserts at the DOM level, but the tree assembly is worth pinning
* at the unit level — a layout order regression would render
* Inner(Outer(Page)) which is valid React but wrong markup, and no
* Playwright assertion today covers that.
*/
function nestLayouts(react, Component, props, layouts) {
	let node = react.createElement(Component, props);
	for (let i = layouts.length - 1; i >= 0; i--) {
		const layout = layouts[i];
		if (layout === void 0) continue;
		node = react.createElement(layout.Component, { children: node });
	}
	return node;
}
async function mountReactPageRoot(container, Component, props, opts = {}) {
	const rt = await load();
	if (!rt) return void 0;
	const layouts = opts.layouts ?? [];
	let root;
	if (opts.hydrate) root = rt.client.hydrateRoot(container, nestLayouts(rt.react, Component, props, layouts));
	else {
		root = rt.client.createRoot(container);
		root.render(nestLayouts(rt.react, Component, props, layouts));
	}
	return {
		update(C, next) {
			root.render(nestLayouts(rt.react, C, next, layouts));
		},
		dispose() {
			try {
				root.unmount();
			} catch {}
		}
	};
}
// src/hydrate.ts
function pageTreeFor(input, client) {
	const page = pageComponent(input.route);
	const props = {
		route: input.route,
		url: input.url,
		params: input.params,
		data: input.data,
		client
	};
	return el(page, props);
}
function pageRenderInput(input) {
	return {
		route: input.route,
		url: input.url,
		params: input.params,
		data: input.data,
		head: {
			meta: [],
			link: [],
			style: [],
			script: []
		}
	};
}
/** Find the element carrying `data-ox-id='<id>'` under `scope` (or itself). */
function findMarked(scope, id) {
	if (scope.getAttribute("data-ox-id") === id) return scope;
	return scope.querySelector?.(`[data-ox-id="${id}"]`) ?? null;
}
/** Bind a rebuilt tree's handler markers onto the live DOM. */
function bindAll(scope, tree, bound, islandScope = false) {
	for (const binding of walkTreeForHandlers(tree, islandScope)) {
		const target = findMarked(scope, binding.id);
		if (!target) continue;
		target.addEventListener(binding.event, binding.handler);
		bound.push({
			el: target,
			type: binding.event,
			fn: binding.handler
		});
	}
}
/**
* Client-side singleton: the contract's `update(input)` has no root parameter,
* so the last hydrate()/mount() target is tracked here. Client-only state —
* the server keeps NO module-global request state (§7.2).
*/
let active;
/**
* §8.4 / §10.3: true when the registered client manifest resolves this route
* to a client chunk — the real-render path owns the page then (the caller
* skips the IR paint and lets the async manifest render land). The manifest
* source is registered by `bootWithRouter` from `/client/client.manifest.json`.
*/
function manifestRouteExists(route) {
	const src = getRouteComponentSource();
	return src !== void 0 && routeIdFor(route, src.manifest) !== void 0;
}
/** Narrow an `OxElement` to a real DOM `Element`.
*
* `OxElement` is a structural subset of the DOM `Element` interface — the
* minimum a fake DOM in tests must implement. Real framework runtime calls
* (`createRoot`, `createSSRApp().mount`, etc.) require the full `Element`.
* This helper is a *runtime assertion*, not a cast: `instanceof Element`
* succeeds in a real browser, throws a clear TypeError otherwise. In the
* test environment the real-adapter path is never reached (the framework
* isn't installed → `mountXxxPageRoot` returns undefined before this runs).
*/
function asDomElement(v, where) {
	if (typeof Element !== "undefined" && v instanceof Element) return v;
	throw new TypeError(`oxide: ${where} requires a live DOM Element`);
}
function createClientRoot(root, input, doc, opts) {
	let current = input;
	let glue;
	let disposed = false;
	let realRoot;
	let currentLayoutChainKey = "";
	let renderSeq = 0;
	let realChain = Promise.resolve();
	const bound = [];
	const client = {
		update(patch) {
			update({
				...current,
				data: {
					...current.data,
					...patch
				}
			});
		},
		navigate(href) {
			if (opts.navigate) opts.navigate(href);
			else doc.dispatchEvent?.({
				type: "ox:navigate",
				detail: { href }
			});
		}
	};
	function unbind() {
		for (const b of bound) b.el.removeEventListener(b.type, b.fn);
		bound.length = 0;
	}
	function rebind() {
		unbind();
		bindAll(root, pageTreeFor(current, client), bound);
	}
	function render(inp) {
		root.innerHTML = renderShellToString(pageRenderInput(inp));
	}
	/** The props a REAL page component receives — the same shape the server's
	* real SSR path (`makeRealAdapter`) renders with, so hydration matches. */
	function realProps(inp) {
		return {
			route: inp.route,
			url: inp.url,
			params: inp.params,
			data: inp.data,
			layouts: inp.layouts ?? []
		};
	}
	/** Synchronous IR fallback paint (also the real path's failure mode). */
	function renderIr() {
		render(current);
		rebind();
	}
	/**
	* §8.4 + §10.3: the manifest-driven real render. Resolves the route's page
	* component from the client manifest (`componentFor` → dynamic import of
	* the route's `entry_chunk`), then renders/hydrates it with React's own
	* runtime via `mountReactPageRoot`. Returns `false` immediately when no
	* manifest source is registered or the route isn't in it — the caller
	* then takes the IR fallback synchronously. When it returns `true` the
	* async chain owns the root; a missing component, a broken chunk or an
	* absent React falls back to the IR paint inside the chain (sequence-
	* guarded, so a superseded navigation never paints).
	*/
	function tryRealRender(seq, inp, allowHydrate) {
		const src = getRouteComponentSource();
		if (!src) {
			console.warn?.("[oxide-diag] real-render skipped: no manifest registered (route=" + JSON.stringify(inp.route) + ")");
			return false;
		}
		const key = routeIdFor(inp.route, src.manifest);
		if (key === void 0) {
			console.warn?.("[oxide-diag] real-render skipped: route " + JSON.stringify(inp.route) + " not matched in manifest (routes: " + Object.keys(src.manifest.routes).join(",") + ")");
			return false;
		}
		if (seq !== renderSeq) return true;
		glue?.wire(current.data);
		realChain = realChain.then(async () => {
			if (disposed || seq !== renderSeq) return;
			const Component = await componentFor(inp.route);
			if (disposed || seq !== renderSeq) return;
			if (Component === void 0 || Component === null) {
				console.warn?.("[oxide-diag] real-render: componentFor(" + JSON.stringify(inp.route) + ") returned undefined; falling back to IR. manifest key=" + JSON.stringify(key) + " entry_chunk=" + JSON.stringify(src.manifest.routes[key]?.entry_chunk));
				renderIr();
				return;
			}
			try {
				let declaredLayouts = inp.layouts ?? [];
				if (declaredLayouts.length === 0) {
					const manifestEntry = src.manifest.routes[key];
					if (manifestEntry && Array.isArray(manifestEntry.layout_chain)) {
						declaredLayouts = manifestEntry.layout_chain;
						console.log("[oxide-diag] tryRealRender: inp.layouts empty — using manifest layout_chain", {
							route: inp.route,
							chain: declaredLayouts,
							manifestKey: key
						});
					}
				}
				const newChainKey = declaredLayouts.join("|");
				if (realRoot) {
					if (newChainKey === currentLayoutChainKey) {
						realRoot.update(Component, realProps(inp));
						return;
					}
					console.log("[oxide-diag] tryRealRender: layout chain changed — remount", {
						from: currentLayoutChainKey,
						to: newChainKey,
						route: inp.route
					});
					realRoot.dispose();
					realRoot = void 0;
				}
				const layoutComponents = [];
				for (const lid of declaredLayouts) {
					const lc = await componentFor(lid);
					if (lc) layoutComponents.push({
						id: lid,
						Component: lc
					});
				}
				console.log("[oxide-diag] tryRealRender: layout resolution", {
					route: inp.route,
					declaredLayouts,
					resolved: layoutComponents.map((l) => l.id)
				});
				if (disposed || seq !== renderSeq) return;
				const canHydrate = allowHydrate && declaredLayouts.length === layoutComponents.length && (root.innerHTML ?? "") !== "";
				const mounted = await mountReactPageRoot(asDomElement(root, "real framework mount"), Component, realProps(inp), {
					hydrate: canHydrate,
					layouts: layoutComponents
				});
				if (disposed || seq !== renderSeq) {
					mounted?.dispose();
					return;
				}
				if (!mounted) {
					renderIr();
					return;
				}
				realRoot = mounted;
				currentLayoutChainKey = newChainKey;
			} catch (e) {
				console.warn?.("oxide: real page render failed; falling back to IR", e);
				if (!disposed && seq === renderSeq) renderIr();
			}
		});
		return true;
	}
	function update(inp) {
		current = inp;
		if (tryRealRender(++renderSeq, inp, false)) return;
		glue?.wire(inp.data);
		if (inp.deferred) glue?.resolveAll(inp.deferred);
		render(inp);
		rebind();
	}
	glue = attachDeferGlue({
		doc,
		onSwap: (d) => opts.onSwap?.(d)
	});
	if (!tryRealRender(++renderSeq, current, true)) {
		if (root.innerHTML === "") render(current);
		rebind();
		glue.wire(current.data);
	}
	const handle = {
		update,
		dispose() {
			if (disposed) return;
			disposed = true;
			unbind();
			realRoot?.dispose();
			realRoot = void 0;
			glue?.dispose();
			glue = void 0;
			if (active === handle) active = void 0;
		}
	};
	return handle;
}
/**
* Hydrate server-rendered markup: binds handlers + the core defer glue while
* preserving the server HTML byte-for-byte (no mismatch, §7.2).
*/
function hydrate(root, input, opts = {}) {
	const doc = opts.doc ?? root.ownerDocument;
	if (!doc) throw new TypeError("hydrate: no document (pass opts.doc in non-browser tests)");
	const handle = createClientRoot(root, input, doc, opts);
	active = handle;
	return handle.dispose;
}
/** SPA mode (§10.1 `spa`): render the shell into an empty root, then bind.
* When a manifest route exists the real page component paints instead —
* `createClientRoot` skips the IR shell for that route (§8.4/§10.3). */
function mount(root, input, opts = {}) {
	const doc = opts.doc ?? root.ownerDocument;
	if (!doc) throw new TypeError("mount: no document (pass opts.doc in non-browser tests)");
	if (!manifestRouteExists(input.route)) root.innerHTML = renderShellToString(pageRenderInput(input));
	const handle = createClientRoot(root, input, doc, opts);
	active = handle;
	return handle.dispose;
}
/**
* Client navigation (§7 update): swap the route tree in the active root.
* No-op when no client root is mounted (e.g. update fires before mount).
*/
function update(input) {
	active?.update(input);
}
/**
* Islands hydration (§10.3): the core loader schedules by strategy and calls
* this with the loaded chunk module. The module's default component renders
* into the host (deterministic markup) and its handlers bind to the
* data-ox-id markers — one rendering path shared with full-page hydration.
*/
function hydrateIsland(host, mod, props, opts = {}) {
	const component = mod.default ?? mod;
	if (typeof component !== "function") throw new TypeError("hydrateIsland: island module must export a default component");
	const bound = [];
	const client = {
		update(patch) {
			const nextProps = {
				...props,
				...patch,
				client
			};
			const tree = component(nextProps);
			host.innerHTML = renderNodeToString(tree, islandRenderState());
			for (const b of bound) b.el.removeEventListener(b.type, b.fn);
			bound.length = 0;
			bindAll(host, tree, bound, true);
		},
		navigate(href) {
			opts.navigate?.(href);
		}
	};
	const tree = component({
		...props,
		client
	});
	host.innerHTML = renderNodeToString(tree, islandRenderState());
	bindAll(host, tree, bound, true);
	return () => {
		for (const b of bound) b.el.removeEventListener(b.type, b.fn);
		bound.length = 0;
	};
}
function islandRenderState() {
	return {
		...newRenderState("routes/islands"),
		islandScope: true
	};
}
export { update as i, hydrateIsland as n, mount as r, hydrate as t };

//# sourceMappingURL=hydrate-eYqo6XeQ.js.map