import fs from "node:fs";
import path from "node:path";
import { RELEASE_CATALOG } from "./releases.ts";
import { renderReleaseBanner } from "./compositor.ts";
import { REPO_ROOT } from "./tokens.ts";
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, "docs/releases");
const DEFAULT_ILL_DIR = path.join(REPO_ROOT, "docs/releases/illustrations");
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] ?? "render";
  if (cmd === "prompts") {
    console.log("# Pure Illustration-Only Prompts for Google Stitch (1:1 or 4:3, #FFFFFF background, ZERO text/logo)\n");
    for (const rel of RELEASE_CATALOG) {
      console.log(`## ${rel.version} — Save raw Stitch PNG as: docs/releases/illustrations/${rel.version}.png`);
      console.log(`${rel.stitchIllustrationPrompt}\n`);
    }
    return;
  }
  let targetVersion = "all";
  let outDir = DEFAULT_OUT_DIR;
  let illDir = DEFAULT_ILL_DIR;
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === "--version" && args[i + 1]) targetVersion = args[++i]!;
    else if (a === "--out" && args[i + 1]) outDir = path.resolve(args[++i]!);
    else if (a === "--illustrations" && args[i + 1]) illDir = path.resolve(args[++i]!);
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(illDir, { recursive: true });
  const selected =
  targetVersion === "all"
  ? RELEASE_CATALOG
  : RELEASE_CATALOG.filter((r) => r.version === targetVersion);
  if (selected.length === 0) {
    console.error(`Unknown version: ${targetVersion}`);
    process.exit(1);
  }
  for (const spec of selected) {
    const illCandidate = path.join(illDir, `${spec.version}.png`);
    const outFile = path.join(outDir, `banner-${spec.version}.png`);
    const buf = await renderReleaseBanner({
        spec,
        illustrationPath: fs.existsSync(illCandidate) ? illCandidate : undefined,
        format: "png",
    });
    fs.writeFileSync(outFile, buf);
    const mode = fs.existsSync(illCandidate) ? "with Stitch illustration" : "layout frame (drop illustration PNG to composite)";
    console.log(`✅ Rendered ${path.relative(REPO_ROOT, outFile)} (${mode})`);
  }
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
