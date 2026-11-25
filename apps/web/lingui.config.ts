import { defineConfig } from "@lingui/cli";
import { formatter } from "@lingui/format-po";

// Lingui 6 requires formatter objects instead of the legacy `format: "po"`
// string; the catalog layout is exactly ARCHITECTURE.md section 19.2.
export default defineConfig({
  sourceLocale: "fr",
  locales: ["fr", "en"],
  catalogs: [
    {
      path: "<rootDir>/src/i18n/locales/{locale}",
      include: ["src"],
      exclude: ["src/wasm-pkg/**", "src/routeTree.gen.ts", "src/**/*.test.ts"],
    },
  ],
  format: formatter({ lineNumbers: false }),
});
