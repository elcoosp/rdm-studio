import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import { lingui } from "@lingui/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Vite 8 resolves tsconfig paths natively (replaces vite-tsconfig-paths).
  resolve: { tsconfigPaths: true },
  plugins: [
    // TanStack Router plugin MUST come before react()
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
      autoCodeSplitting: true,
    }),
    react({
      plugins: [["@lingui/swc-plugin", {}]],
    }),
    lingui(),
    tailwindcss(),
    wasm(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["logo-rdm-studio.svg"],
      manifest: {
        name: "RDM Studio",
        short_name: "RDM",
        description: "3D Structural Engineering Workstation",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        theme_color: "#1D4ED8",
        background_color: "#F8FAFC",
        display: "standalone",
        file_handlers: [
          {
            action: "/",
            accept: {
              "application/x-rdm": [".rdm"],
              "application/dxf": [".dxf"],
              "application/step": [".step", ".stp"],
            },
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // Obligatoire pour occt-import-js & takumi .wasm
        globPatterns: ["**/*.{js,css,html,wasm,svg,woff2,ttf}"],
        runtimeCaching: [
          {
            urlPattern: /\.rdm$/,
            handler: "CacheFirst",
          },
        ],
      },
    }),
  ],
  // Top-level await is native in Vite 8 ESM output (ES2022 target); the
  // legacy vite-plugin-top-level-await shim is no longer needed.
  worker: {
    format: "es",
    plugins: () => [wasm()],
  },
  optimizeDeps: {
    exclude: ["rdm-wasm", "occt-import-js", "@takumi-rs/wasm"],
  },
});
