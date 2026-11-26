// index.ts
/** Create the Tailwind plugin descriptor for `oxide.config.ts`. */
function tailwind(options = {}) {
	return {
		name: "@oxide-fw/tailwind",
		engine: "tailwind",
		options: { content: options.content ?? ["src/**/*.{ts,tsx,js,jsx,vue,svelte,html}"] }
	};
}
export { tailwind };

//# sourceMappingURL=index.js.map