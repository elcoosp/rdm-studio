import { deferPromise, deferred, el, escapeAttr, escapeScript, escapeText, frag, hash6, island, raw, t } from "./ir.js";
import { encodePropsB64 } from "@oxide-fw/core/odf-encode";
import { resolveDeferredPlaceholders } from "@oxide-fw/core/server/deferred";
// src/protocol.ts
/** Placeholder attribute: `<template data-ox-b='ID'>` + fallback (§7.1). */
const BOUNDARY_FALLBACK_ATTR = "data-ox-b";
/** Resolution attribute: `<template data-ox-c='ID'>` + swapper (§7.1). */
const BOUNDARY_CONTENT_ATTR = "data-ox-c";
/**
* The swapper logic — byte-identical to `render::SWAPPER_SRC`. Finds
* `template[data-ox-c='<id>']`, moves its content over the matching
* `template[data-ox-b='<id>']` placeholder via replaceWith, then dispatches
* the `ox:swap` CustomEvent (detail: {id}) that triggers adapter hydration.
*/
const SWAPPER_SRC = "function(id){var t=document.querySelector(\"[data-ox-c='\"+id+\"']\"),p=document.querySelector(\"[data-ox-b='\"+id+\"']\");if(t&&p){var d=document.createElement(\"div\"),W=window.__oxide_tt;d.innerHTML=W?W.createHTML(t.innerHTML):t.innerHTML;p.replaceWith.apply(p,d.childNodes);document.dispatchEvent(new CustomEvent(\"ox:swap\",{detail:{id:id,value:t.innerHTML}}))}}";
/** Streamed boundary placeholder — render::boundary_fallback. */
function boundaryFallback(id, fallbackHtml) {
	return `<template ${BOUNDARY_FALLBACK_ATTR}='${id}'>${fallbackHtml}</template>`;
}
/**
* Streamed boundary resolution — render::boundary_content. The content
* template plus a self-contained swapper IIFE with `id` baked in. `nonce`
* follows the render crate: omitted when empty (Rust injects CSP nonces in
* production, §10.2 step 4).
*/
function boundaryContent(id, html, nonce = "") {
	const n = nonce ? ` nonce='${escapeAttr(nonce)}'` : "";
	return `<template ${BOUNDARY_CONTENT_ATTR}='${id}'>${html}</template><script${n}>(${escapeScript(SWAPPER_SRC)})('${id}')<\/script>`;
}
/**
* Islands host markup (§10.3) — render::island_element byte shape:
* `<ox-island data-ox-island='C' data-ox-chunk='K' data-ox-strategy='S'
* data-ox-props='P'>SSR</ox-island>`.
*/
function islandElement(directive, ssrHtml) {
	return `<ox-island data-ox-island='${escapeAttr(directive.component)}' data-ox-chunk='${escapeAttr(directive.chunk)}' data-ox-strategy='${escapeAttr(directive.strategy)}' data-ox-props='${escapeAttr(directive.propsB64)}'>${ssrHtml}</ox-island>`;
}
/** Error boundary markup — render crate streamed-error shape (lib.rs ~L692). */
function errorBoundary(code, message) {
	return `<div class='ox-error' data-ox-error='${escapeAttr(code)}'>${escapeAttr(code)}: ${escapeText(message)}</div>`;
}
/**
* Hydration bootstrap (§9.5) — render::hydration_bootstrap shape: the base64
* ODF payload script plus the `window.__oxide` router bootstrap. Emitted when
* RenderInput.odf carries serialized data; Rust injects CSP nonces later.
*/
function hydrationBootstrap(odfB64, routeId) {
	return `<script type='application/oxide-data'>${odfB64}<\/script><script>window.__oxide={route:"${sanitizeRouteId(routeId)}",data:document.currentScript.previousElementSibling.textContent}<\/script>`;
}
/** Percent-encode every byte outside the route-id alphabet `[a-z0-9-/]`. */
function sanitizeRouteId(routeId) {
	let out = "";
	for (const byte of new TextEncoder().encode(routeId)) {
		const c = String.fromCharCode(byte);
		out += /^[a-z0-9\-/]$/.test(c) ? c : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
	}
	return out;
}
// src/render.ts
const FLAVOR_SKIP = /* @__PURE__ */ new Set([
	"html",
	"head",
	"title",
	"meta",
	"link",
	"base",
	"body"
]);
/**
* Framework flavor, applied per element (excluding the document skeleton).
* react: no per-element markers — SSR adds none; the root container carries
* `data-reactroot` (set by the layout below).
*/
function flavor(tag, attrs, _state) {
	return attrs;
}
const VOID_TAGS = /* @__PURE__ */ new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr"
]);
function isHandlerProp(key, value) {
	return /^on[A-Z]/.test(key) && typeof value === "function";
}
function eventOf(key) {
	return key.slice(2).toLowerCase();
}
/** Render one element's static attributes (handlers become protocol markers). */
function renderAttrs(node, state, flavorAttrs) {
	const attrs = {};
	for (const [key, value] of Object.entries(node.props)) {
		if (key === "key" || key === "ref") continue;
		if (isHandlerProp(key, value)) {
			const id = `${state.islandScope ? "h" : "p"}${state.handlers.length}`;
			state.handlers.push({
				id,
				event: eventOf(key),
				handler: value
			});
			attrs["data-ox-on"] = eventOf(key);
			attrs["data-ox-id"] = id;
			continue;
		}
		if (value === true) attrs[key] = "";
		else if (value === false || value === void 0 || value === null) continue;
		else attrs[key] = String(value);
	}
	const final = flavorAttrs ? flavor(node.tag, attrs, state) : attrs;
	return Object.entries(final).map(([k, v]) => v === "" ? ` ${k}` : ` ${k}="${escapeAttr(v)}"`).join("");
}
/**
* Walk the IR into HTML. `<head>` wrappers are extracted, never rendered into
* the body. Component nodes are called recursively (depth-capped).
*/
function walk(node, state, depth, flavorAttrs) {
	if (depth > 64) throw new Error("render: component tree deeper than 64 (infinite recursion?)");
	switch (node.kind) {
		case "fragment": {
			const children = node.children.map((c) => walk(c, state, depth + 1, flavorAttrs));
			return {
				html: children.map((c) => c.html).join(""),
				head: children.flatMap((c) => c.head)
			};
		}
		case "text": return {
			html: escapeText(node.value),
			head: []
		};
		case "raw": return {
			html: node.html,
			head: []
		};
		case "defer": {
			const id = state.nextBoundaryId++;
			state.defers.push({
				id,
				value: node.value,
				render: node.render
			});
			return {
				html: boundaryFallback(id, walk(node.fallback, state, depth + 1, flavorAttrs).html),
				head: []
			};
		}
		case "island": {
			const islandState = {
				...state,
				nextElementId: 0,
				handlers: [],
				islandScope: true
			};
			const ssr = walk(node.children, islandState, depth + 1, flavorAttrs).html;
			return {
				html: islandElement({
					component: node.component,
					chunk: node.chunk,
					strategy: node.strategy,
					propsB64: encodePropsB64(node.props ?? {})
				}, ssr),
				head: []
			};
		}
		case "element": {
			if (typeof node.tag === "function") return walk(node.tag({
				...node.props,
				children: node.children
			}), state, depth + 1, flavorAttrs);
			const tag = node.tag;
			if (tag === "head") return {
				html: "",
				head: node.children
			};
			const attrsHtml = renderAttrs(node, state, flavorAttrs && !FLAVOR_SKIP.has(tag));
			if (VOID_TAGS.has(tag)) return {
				html: `<${tag}${attrsHtml}>`,
				head: []
			};
			const children = node.children.map((c) => walk(c, state, depth + 1, flavorAttrs));
			return {
				html: `<${tag}${attrsHtml}>${children.map((c) => c.html).join("")}</${tag}>`,
				head: children.flatMap((c) => c.head)
			};
		}
	}
}
const metaKey = (m) => m.name ?? m.property ?? m.charset ?? m.httpEquiv ?? "";
/**
* Merge two neutral head models — a tiny replica of render::HeadTags::merge:
* the inner (page/route) title wins but keeps the outer (layout) position;
* titleTemplate comes from the layout; other lists append in inner order with
* meta entries overriding on their identifying key (name/property/…).
*/
function mergeHead(outer, inner) {
	const meta = outer.meta.map((m) => ({ ...m }));
	const seen = new Set(meta.map(metaKey).filter(Boolean));
	for (const m of inner.meta ?? []) {
		const key = metaKey(m);
		const existing = key ? meta.findIndex((x) => metaKey(x) === key) : -1;
		if (existing >= 0) meta[existing] = {
			...meta[existing],
			...m
		};
		else meta.push({ ...m });
		if (key) seen.add(key);
	}
	return {
		title: inner.title ?? outer.title,
		titleTemplate: inner.titleTemplate ?? (outer.title?.includes("%s") ? outer.title : outer.titleTemplate),
		base: inner.base ?? outer.base,
		meta,
		link: [...outer.link, ...inner.link ?? []].map((l) => ({ ...l })),
		style: [...outer.style, ...inner.style ?? []].map((s) => ({ ...s })),
		script: [...outer.script, ...inner.script ?? []].map((s) => ({ ...s })),
		jsonLd: [...outer.jsonLd ?? [], ...inner.jsonLd ?? []]
	};
}
/** Apply a `%s` title template ("Head Test" + "%s · Atlas" → "Head Test · Atlas"). */
function applyTitleTemplate(head) {
	if (!head.title) return void 0;
	if (head.titleTemplate && head.titleTemplate.includes("%s")) return head.titleTemplate.replace("%s", head.title);
	return head.titleTemplate ?? head.title;
}
function renderHeadHtml(head) {
	const parts = [];
	const title = applyTitleTemplate(head);
	if (title !== void 0) parts.push(`<title>${escapeText(title)}</title>`);
	if (head.base) parts.push(`<base href="${escapeAttr(head.base.href)}"${head.base.target ? ` target="${escapeAttr(head.base.target)}"` : ""}>`);
	for (const m of head.meta) {
		const attrs = Object.entries(m).map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join("");
		parts.push(`<meta${attrs}>`);
	}
	for (const l of head.link) {
		const attrs = Object.entries(l).map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join("");
		parts.push(`<link${attrs}>`);
	}
	for (const s of head.style) parts.push(`<style${s.nonce ? ` nonce="${escapeAttr(s.nonce)}"` : ""}>${s.content}</style>`);
	for (const s of head.script) {
		const attrs = [
			s.src ? ` src="${escapeAttr(s.src)}"` : "",
			s.type ? ` type="${escapeAttr(s.type)}"` : "",
			s.nonce ? ` nonce="${escapeAttr(s.nonce)}"` : "",
			s.defer ? " defer" : ""
		].join("");
		parts.push(`<script${attrs}>${s.content ? escapeScript(s.content) : ""}<\/script>`);
	}
	for (const json of head.jsonLd ?? []) parts.push(`<script type="application/ld+json">${escapeScript(JSON.stringify(json))}<\/script>`);
	return parts.join("");
}
function isString(v) {
	return typeof v === "string";
}
function isObject(v) {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isNode(v) {
	if (!isObject(v)) return false;
	const kind = v.kind;
	return kind === "fragment" || kind === "element" || kind === "text" || kind === "raw" || kind === "defer" || kind === "island";
}
function isNodeArray(v) {
	return Array.isArray(v) && v.every(isNode);
}
function isParamsRecord(v) {
	if (!isObject(v)) return false;
	for (const k of Object.keys(v)) {
		const val = v[k];
		if (typeof val === "string") continue;
		if (Array.isArray(val) && val.every((x) => typeof x === "string")) continue;
		return false;
	}
	return true;
}
function parseClientHooks(v) {
	if (!isObject(v)) throw new TypeError("oxide: page props.client must be an object");
	const update = v.update;
	const navigate = v.navigate;
	if (typeof update !== "function") throw new TypeError("oxide: page props.client.update must be a function");
	if (typeof navigate !== "function") throw new TypeError("oxide: page props.client.navigate must be a function");
	return {
		update: (patch) => {
			update(patch);
		},
		navigate: (href) => {
			navigate(href);
		}
	};
}
function parsePageProps(raw) {
	const route = raw.route;
	const url = raw.url;
	const params = raw.params;
	const data = raw.data;
	if (!isString(route)) throw new TypeError("oxide: page props.route must be a string");
	if (!isString(url)) throw new TypeError("oxide: page props.url must be a string");
	if (!isParamsRecord(params)) throw new TypeError("oxide: page props.params must be a Record<string, string | string[]>");
	if (!isObject(data)) throw new TypeError("oxide: page props.data must be a Record<string, unknown>");
	const client = raw.client;
	return {
		route,
		url,
		params,
		data,
		client: client === void 0 ? void 0 : parseClientHooks(client)
	};
}
function HomePage(input) {
	const props = parsePageProps(input);
	return el("section", { class: "home" }, el("h1", {}, t("Hello Atlas")), el("p", { class: "intro" }, t(`Serving ${String(props.data.framework ?? "every framework")} from one core.`)), el("a", {
		href: "/blog",
		class: "link",
		onClick: (ev) => {
			props.client?.navigate("/blog");
		}
	}, t("Read the blog")), el("head", {}, el("meta", {
		name: "ox-page",
		content: "atlas-home"
	})));
}
function BlogPage(input) {
	const props = parsePageProps(input);
	const comments = props.data.comments;
	return el("article", { class: "post" }, el("h1", {}, t(String(props.data.title ?? "Untitled"))), el("p", { class: "byline" }, t(`By ${String(props.data.author ?? "Anonymous")} · ${String(props.params.slug ?? "")}`)), el("div", { class: "body" }, t(String(props.data.body ?? ""))), comments ? el("ul", { class: "comments" }, comments.map((c) => el("li", { class: "comment" }, el("strong", {}, t(c.author)), t(` ${c.body}`)))) : null, el("head", {}, el("meta", {
		name: "author",
		content: String(props.data.author ?? "Atlas")
	})));
}
function StreamingPage(input) {
	const props = parsePageProps(input);
	return el("section", { class: "stream" }, el("h1", {}, t("Streaming Atlas")), deferred(props.data.comments, el("p", { class: "fallback" }, t("Loading comments…")), (resolved) => {
		return el("ul", { class: "comments" }, (resolved ?? []).map((c) => el("li", { class: "comment" }, el("strong", {}, t(c.author)), t(` ${c.body}`))));
	}), deferred(props.data.meta, el("p", { class: "fallback" }, t("Loading meta…")), (resolved) => el("span", { class: "meta" }, t(String(resolved ?? "")))));
}
function ErrorPage() {
	throw new Error("Atlas render failure: the data module exploded");
}
function NotFoundPage() {
	return el("section", {
		class: "notfound",
		"data-ox-not-found": ""
	}, el("h1", {}, t("404")), el("p", {}, t("This Atlas route does not exist.")));
}
function CounterIsland(input) {
	const initialCount = typeof input.initialCount === "number" ? input.initialCount : 0;
	const rawClient = input.client;
	const client = rawClient === void 0 ? void 0 : parseClientHooks(rawClient);
	return el("div", { class: "counter" }, el("span", { class: "count" }, t(String(initialCount))), el("button", {
		class: "inc",
		onClick: () => client?.update({ initialCount: initialCount + 1 })
	}, t("Increment")));
}
function IslandsPage(input) {
	const props = parsePageProps(input);
	return el("section", { class: "islands" }, el("h1", {}, t("Islands Atlas")), island({
		component: "Counter",
		chunk: "/islands/counter.ts",
		strategy: "load",
		props: { initialCount: Number(props.data.count ?? 0) }
	}, el(CounterIsland, { initialCount: Number(props.data.count ?? 0) })));
}
function ActionsPage(input) {
	const form = parsePageProps(input).data.form;
	return el("section", { class: "actions" }, el("h1", {}, t("Actions Atlas")), el("form", {
		method: "POST",
		action: "/actions",
		class: "form"
	}, el("input", {
		name: "name",
		value: form?.name ?? "",
		class: "input"
	}), el("button", {
		type: "submit",
		class: "submit"
	}, t("Say hello"))), form?.name ? el("p", { class: "form-result" }, t(`Hello ${form.name}`)) : raw("<!--form-result-pending-->"));
}
function CachedPage(input) {
	const posts = parsePageProps(input).data.posts ?? [];
	return el("section", { class: "cached" }, el("h1", {}, t("Cache Atlas")), el("ul", { class: "posts" }, posts.map((p) => el("li", { class: "post-item" }, t(p)))));
}
function HeadPage() {
	return el("section", { class: "head-check" }, el("p", {}, t("Head check")), el("head", {}, el("meta", {
		name: "ox-page",
		content: "page-head-extracted"
	})));
}
/** The build-generated route → page registry (spec §8.1 page conventions). */
const PAGES = {
	"routes/index": { component: HomePage },
	"routes/blog/[slug]": { component: BlogPage },
	"routes/streaming": { component: StreamingPage },
	"routes/error": { component: ErrorPage },
	"routes/not-found": { component: NotFoundPage },
	"routes/islands": { component: IslandsPage },
	"routes/actions": { component: ActionsPage },
	"routes/cached": { component: CachedPage },
	"routes/head": { component: HeadPage }
};
/** Look up a registered page component (client hydration reuses the registry). */
function pageComponent(route) {
	return (PAGES[route] ?? { component: NotFoundPage }).component;
}
/** Test/build helper: the island chunk map (§10.3 "each island is its own chunk"). */
const islandModules = { "/islands/counter.ts": { default: CounterIsland } };
/** Test/build helper: pages that throw at render (error-boundary conformance). */
const throwsAtRender = /* @__PURE__ */ new Set(["routes/error"]);
/**
* The root layout (spec §8.1 layout.*): a fragment of layout head + the page
* — the SHELL owns the document skeleton (`<!doctype html><html><head>` +
* `<body>`) and the framework root container below.
*/
function AtlasLayout(input) {
	parsePageProps(input);
	const rawPage = input.page;
	if (!isNode(rawPage)) throw new TypeError("oxide: AtlasLayout requires page to be a Node");
	const page = rawPage;
	return frag(el("head", {}, el("title", {}, t("%s · Atlas")), el("meta", { charset: "utf-8" }), el("meta", {
		name: "viewport",
		content: "width=device-width, initial-scale=1"
	})), page);
}
function NestedLayout(input) {
	parsePageProps(input);
	const rawChildren = input.children;
	const rawPage = input.page;
	const children = isNodeArray(rawChildren) ? rawChildren : [];
	const page = isNode(rawPage) ? rawPage : void 0;
	const inner = children && children.length > 0 ? children : page ? [page] : [];
	return el("div", { "data-oxide-layout": "nested" }, ...inner);
}
const LAYOUTS = {
	"routes/layout": { component: AtlasLayout },
	"routes/nested/layout": { component: NestedLayout }
};
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
function buildTree(input) {
	const page = PAGES[input.route] ?? { component: NotFoundPage };
	const pageProps = {
		route: input.route,
		url: input.url,
		params: input.params,
		data: input.data
	};
	let node = el(page.component, pageProps);
	let wrapped = 0;
	for (const id of [...input.layouts ?? []].reverse()) {
		const layout = LAYOUTS[id];
		if (!layout) continue;
		node = el(layout.component, {
			...pageProps,
			page: node
		}, node);
		wrapped++;
	}
	if (wrapped === 0) node = el(AtlasLayout, {
		...pageProps,
		page: node
	});
	return node;
}
/** Convert head elements extracted from the page tree into the neutral model.
* A layout title containing `%s` IS the title template (§16.3 convention). */
function headNodesToTags(nodes) {
	const tags = {
		meta: [],
		link: [],
		style: [],
		script: []
	};
	for (const node of nodes) {
		if (node.kind !== "element" || typeof node.tag !== "string") continue;
		if (node.tag === "title") {
			const title = node.children.map((c) => c.kind === "text" ? c.value : "").join("");
			if (title.includes("%s")) tags.titleTemplate = title;
			else tags.title = title;
		} else if (node.tag === "meta") tags.meta.push({ ...node.props });
		else if (node.tag === "link") tags.link.push({ ...node.props });
		else if (node.tag === "style") tags.style.push({ content: node.children.map((c) => c.kind === "text" ? c.value : "").join("") });
		else if (node.tag === "base") tags.base = { href: String(node.props.href ?? "/") };
	}
	return tags;
}
/**
* The framework root container: React marks its hydration root with
* `data-reactroot` (per-framework flavor lives here).
*/
const ROOT_ATTRS = {
	id: "root",
	"data-reactroot": ""
};
/**
* Build the shell: merged head (layout ⊕ loader ⊕ extracted page head) + the
* document body with `template[data-ox-b]` placeholders for every deferred
* boundary. Merge order mirrors render::HeadTags::merge: outer = layout,
* then the loader/route head (RenderInput.head), then page-extracted head
* (inner-most wins on conflicts, appended in inner order).
*/
function buildShell(input, state) {
	const walked = walk(el("div", { ...ROOT_ATTRS }, buildTree(input)), state, 1, true);
	const merged = mergeHead(mergeHead(LAYOUT_HEAD, input.head), headNodesToTags(walked.head));
	const dataScript = input.odf ? hydrationBootstrap(Buffer.from(input.odf).toString("base64"), input.route) : "";
	return {
		headHtml: `<!doctype html>\n<html lang="${input.locale && /^[A-Za-z0-9_-]+$/.test(input.locale) ? input.locale : "en"}"><head>${renderHeadHtml(merged)}</head>`,
		bodyHtml: `<body>${walked.html}${dataScript}</body></html>`,
		defers: state.defers
	};
}
/** Error shell (§10.2 step 5): the core error boundary replaces the tree. */
function errorShell(input, err) {
	const message = err instanceof Error ? err.message : String(err);
	const errorComponent = input.errorRoute ? PAGES[input.errorRoute] : void 0;
	if (errorComponent) {
		const state = newRenderState(`${input.route}#error`);
		try {
			const walked = walk(el(errorComponent.component, {
				route: input.route,
				url: input.url,
				params: input.params,
				data: input.data,
				error: {
					message,
					route: input.route,
					status: 500
				}
			}), state, 1, true);
			const head = mergeHead(LAYOUT_HEAD, input.head);
			return {
				headHtml: `<!doctype html>\n<html lang="${input.locale && /^[A-Za-z0-9_-]+$/.test(input.locale) ? input.locale : "en"}"><head>${renderHeadHtml(head)}</head>`,
				bodyHtml: `<body>${walked.html}</body></html>`,
				defers: state.defers
			};
		} catch {}
	}
	const head = mergeHead(LAYOUT_HEAD, {
		title: "Error",
		meta: [],
		link: [],
		style: [],
		script: []
	});
	return {
		headHtml: `<!doctype html>\n<html lang="${input.locale && /^[A-Za-z0-9_-]+$/.test(input.locale) ? input.locale : "en"}"><head>${renderHeadHtml(head)}</head>`,
		bodyHtml: `<body>${errorBoundary("OX-500", message)}</body></html>`,
		defers: []
	};
}
function newRenderState(route) {
	return {
		defers: [],
		nextBoundaryId: 0,
		nextElementId: 0,
		scope: hash6(route),
		handlers: []
	};
}
/** Render one standalone IR node (island hydration uses this path). */
function renderNode(node, state) {
	return walk(node, state, 1, true);
}
/** Render one standalone IR node to a string with a fresh route-scoped state. */
function renderNodeToString(node, state) {
	return renderNode(node, state).html;
}
/**
* Rebuild the deterministic handler bindings for a tree: render it into a
* fresh state and return the collected data-ox-on / data-ox-id bindings in
* marker order. The client binds these onto the live DOM (src/hydrate.ts).
*/
function walkTreeForHandlers(tree, islandScope = false) {
	const state = islandScope ? {
		...newRenderState(""),
		islandScope: true
	} : newRenderState("");
	walk(tree, state, 1, true);
	return state.handlers;
}
/**
* Streaming render (§7 `render(input) → ReadableStream<Uint8Array>`).
* Pull-driven (backpressure): the next chunk is produced only on pull.
* Chunk plan: [head] [body shell] then one chunk per deferred resolution
* (`template[data-ox-c]` + swapper, §7.1). A rejecting boundary streams the
* error boundary content instead (§10.2 step 5).
*/
function render(rawInput) {
	const input = {
		...rawInput,
		data: resolveDeferredPlaceholders(rawInput.data, rawInput.deferred)
	};
	const encoder = new TextEncoder();
	let state;
	let shell;
	try {
		state = newRenderState(input.route);
		shell = buildShell(input, state);
	} catch (err) {
		state = newRenderState(input.route);
		shell = errorShell(input, err);
	}
	const it = (async function* () {
		yield encoder.encode(shell.headHtml);
		yield encoder.encode(shell.bodyHtml);
		const resolved = [];
		let wakeup;
		const wake = () => {
			const w = wakeup;
			wakeup = void 0;
			w?.();
		};
		for (const d of shell.defers) (async () => {
			let html;
			try {
				html = walk(d.render(await deferPromise(d.value)), newRenderState(input.route), 1, true).html;
			} catch (err) {
				html = errorBoundary("OX-500", err instanceof Error ? err.message : String(err));
			}
			resolved.push({
				id: d.id,
				html
			});
			wake();
		})();
		const total = shell.defers.length;
		for (let i = 0; i < total; i++) {
			while (resolved.length === 0) await new Promise((r) => {
				wakeup = r;
			});
			const r = resolved.shift();
			yield encoder.encode(boundaryContent(r.id, r.html, input.nonce ?? ""));
		}
	})();
	return new ReadableStream({ async pull(controller) {
		try {
			const { value, done } = await it.next();
			if (done) controller.close();
			else controller.enqueue(value);
		} catch (err) {
			controller.error(err);
		}
	} });
}
/** Drain the stream into one HTML string (shell + every resolution). */
async function renderToString(input) {
	const parts = [];
	for await (const chunk of render(input)) parts.push(new TextDecoder().decode(chunk));
	return parts.join("");
}
/**
* Shell-only render (sync): placeholders stay unresolved. The client uses
* this for update()/mount() — streamed slots are owned by the server stream
* and the ox:swap glue, not by client re-renders.
*/
function renderShellToString(input) {
	const state = newRenderState(input.route);
	let shell;
	try {
		shell = buildShell(input, state);
	} catch (err) {
		shell = errorShell(input, err);
	}
	return shell.headHtml + shell.bodyHtml;
}
/**
* `head(ctx)`: builds the React-flavored head model from the render context
* and merges it into the neutral HeadTags model (packages/oxide types.ts).
* Route-level head tags may be passed through `ctx.locals['oxide:head']`
* (the pipeline registers loader meta there); they override the defaults,
* and the layout title template applies at emit time.
*/
function head(ctx) {
	const data = ctx.data ?? {};
	return mergeHead({
		title: typeof data.title === "string" ? data.title : void 0,
		titleTemplate: "%s · Atlas",
		meta: [
			{ charset: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			...typeof data.description === "string" ? [{
				name: "description",
				content: data.description
			}] : []
		],
		link: [],
		style: [],
		script: []
	}, ctx.locals?.["oxide:head"] ?? {});
}
export { errorBoundary as _, newRenderState as a, renderNode as c, renderToString as d, throwsAtRender as f, boundaryFallback as g, boundaryContent as h, mergeHead as i, renderNodeToString as l, SWAPPER_SRC as m, head as n, pageComponent as o, walkTreeForHandlers as p, islandModules as r, render as s, applyTitleTemplate as t, renderShellToString as u, hydrationBootstrap as v, islandElement as y };

//# sourceMappingURL=render-DUr1BSSx.js.map