import { defineConfig } from "@lingui/cli";
import { formatter } from "@lingui/format-po";

// Lingui 6 requires formatter objects instead of the legacy `format: "po"`
// string; the catalog layout mirrors apps/web (ARCHITECTURE.md §19.2),
// scoped to the site's two locales (fr source, en translation).
export default defineConfig({
  sourceLocale: "fr",
  locales: ["fr", "en"],
  catalogs: [
    {
      path: "<rootDir>/src/i18n/locales/{locale}",
      include: ["src"],
      exclude: ["src/**/*.test.ts"],
    },
  ],
  format: formatter({ lineNumbers: false }),
});
