import { fromBase64, toBase64 } from "@oxide-fw/core/bytes";
// src/ir.ts
/** Element or component node. `el(Component, props, ...children)` renders the
* component recursively; `el('div', props, ...children)` is a plain element. */
function el(tag, props, ...children) {
	return {
		kind: "element",
		tag,
		props: props ?? {},
		children: children.flat().filter((c) => Boolean(c))
	};
}
/** Fragment node: children render unwrapped (layouts compose via fragments). */
function frag(...children) {
	return {
		kind: "fragment",
		children: children.flat().filter((c) => Boolean(c))
	};
}
/** Text node — stringified and escaped at render time. */
function t(value) {
	return {
		kind: "text",
		value: String(value)
	};
}
/** Pre-escaped HTML (use only for trusted/protocol strings). */
function raw(html) {
	return {
		kind: "raw",
		html
	};
}
/** Deferred boundary (§7.1). Accepts a promise or the runtime `defer()` marker. */
function deferred(value, fallback, render) {
	return {
		kind: "defer",
		value,
		fallback,
		render
	};
}
/** Islands host node (§10.3); rendered with the exact render-crate shape. */
function island(opts, children) {
	return {
		kind: "island",
		...opts,
		children
	};
}
/** Unwrap the runtime `defer()` marker to its promise. */
function deferPromise(source) {
	if (source && typeof source === "object" && source.__oxide_defer === true) return source.promise;
	return source;
}
const TEXT_ESCAPES = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;"
};
const ATTR_ESCAPES = {
	"&": "&amp;",
	"\"": "&quot;",
	"<": "&lt;",
	">": "&gt;",
	"'": "&#39;"
};
/** Escape element text (`& < >`). */
function escapeText(s) {
	return s.replace(/[&<>]/g, (c) => TEXT_ESCAPES[c]);
}
/** Escape attribute values (`& " < > '`). */
function escapeAttr(s) {
	return s.replace(/[&"'<>]/g, (c) => ATTR_ESCAPES[c]);
}
/** `\\u003c` escaping inside script payloads (parity with render crate). */
function escapeScript(s) {
	return s.replace(/</g, "\\u003c");
}
/**
* Deterministic 6-hex FNV-1a — scope/hash ids for framework flavors
* (vue `data-v-<scope>`, svelte `svelte-<hash>`, solid hydration keys).
* Derived from stable inputs (route ids) so markup is deterministic
* (§7.2 "deterministic hydration markup").
*/
function hash6(input) {
	let h = 2166136261;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619) >>> 0;
	}
	return h.toString(16).padStart(8, "0").slice(0, 6);
}
export { deferPromise, deferred, el, escapeAttr, escapeScript, escapeText, frag, fromBase64, hash6, island, raw, t, toBase64 };

//# sourceMappingURL=ir.js.map