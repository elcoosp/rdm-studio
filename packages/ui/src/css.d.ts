/**
 * CSS module declaration — lets `export * from "./tokens.css"` in
 * `index.ts` (and any `import "./*.css"`) typecheck. The CSS itself is
 * bundled by tsdown (@tsdown/css) into `dist/style.css`, exposed to
 * consumers as `@rdm-studio/ui/tokens.css` (see `package.json` exports).
 * The `export *` re-exports no named bindings; it exists so the bundler
 * includes the stylesheet in the build.
 */
declare module "*.css" {
  const content: string;
  export default content;
}
