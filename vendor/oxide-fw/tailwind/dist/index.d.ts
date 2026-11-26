/** Options for the Tailwind plugin.
 *
 * All fields are optional — defaults target a standard Oxide project layout. */
export interface TailwindOptions {
  /** Glob sources for the content scanner, relative to the project root.
   *
   * Default: `['src/**\/*.{ts,tsx,js,jsx,vue,svelte,html}']`.
   *
   * In the future, Oxide's graph can supply these automatically (spec §6.6),
   * making this override unnecessary. For now, explicit is honest. */
  content?: string[];
}
/** The plugin descriptor the CLI recognizes via `engine: 'tailwind'`.
 *
 * This is a value, not a class — the plugin is entirely config; the runtime
 * lives in `runtime.mjs`. There's no "plugin instance" to construct. */
export interface TailwindPluginEntry {
  /** Discriminator — the CLI checks `entry.name === '@oxide-fw/tailwind'`
   *  (or `entry.engine === 'tailwind'`) to activate the pipeline. */
  name: '@oxide-fw/tailwind';
  engine: 'tailwind';
  options: Required<TailwindOptions>;
}
/** Create the Tailwind plugin descriptor for `oxide.config.ts`. */
export declare function tailwind(options?: TailwindOptions): TailwindPluginEntry;
//# sourceMappingURL=index.d.ts.map