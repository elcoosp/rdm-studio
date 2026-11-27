import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "icons/EngineeringIcons": "src/icons/EngineeringIcons.tsx",
    "primitives/index": "src/primitives/index.ts",
    "interior/index": "src/interior/index.ts",
    "templates/index": "src/templates/index.ts",
    "deeplinks/index": "src/deeplinks/index.ts",
    "viewport/index": "src/viewport/index.ts",
    "lib/cn": "src/lib/cn.ts",
  },
  platform: "neutral",
  format: "esm",
  dts: true,
  deps: { neverBundle: [
    "@lingui/core",
    "@lingui/react",
    "@number-flow/react",
    "@tanstack/react-router",
    "@tanstack/react-table",
    "lucide-react",
    "motion",
    "react",
    "react-dom",
    "sonner",
    "uplot",
    "valibot",
  ] },
});