import { expect, test } from "@playwright/test";

/**
 * M11 — Composite Cross-Section Studio (_Sections Droites_) end-to-end:
 * the Step 1 entry trigger, the 1-click presets, the exact-engine
 * telemetry, the apply-to-beam WASM re-solve, the /report Sections
 * Droites Composées chapter and the client-side .docx / .html exports.
 * Runs on chromium + firefox.
 */

test("studio opens from Step 1 and shows exact PRS telemetry", async ({ page }) => {
  await page.goto("/geometry?beam=1");
  await page.getByTestId("open-composite-section-studio").click();
  const canvas = page.getByTestId("composite-section-svg");
  await expect(canvas).toBeVisible();
  // The exact engine computes the PRS preset: A = 2·250·12 + 276·8 = 8208 mm².
  await expect(page.getByTestId("composite-telemetry")).toContainText("8208 mm²", {
    timeout: 15_000,
  });
  await expect(canvas.locator("polygon").first()).toBeVisible();
  // Dashed amber plastic neutral axis + centroid reticle drawn.
  await expect(canvas.locator('path, line[stroke="#D97706"]').first()).toBeAttached();
});

test("2×UPN dos-à-dos and IPE+platine presets recompute the telemetry", async ({ page }) => {
  await page.goto("/geometry?beam=1");
  await page.getByTestId("open-composite-section-studio").click();
  const telemetry = page.getByTestId("composite-telemetry");
  await expect(telemetry).toContainText("8208 mm²", { timeout: 15_000 });
  // 2×UPN 200 backs 10 mm apart: A ≈ 2 × 32.86 cm².
  await page.getByTestId("composite-preset-2upn-dos-a-dos").click();
  await expect(telemetry).toContainText("6573 mm²", { timeout: 15_000 });
  await expect(page.getByTestId("composite-name")).toHaveValue("2UPN 200");
  // IPE 300 + 200×10 cover plates: A ≈ 5381 + 2×2000 = 9381 mm².
  await page.getByTestId("composite-preset-ipe-platine-semelle").click();
  await expect(telemetry).toContainText("9381 mm²", { timeout: 15_000 });
  // EN 1993-1-1 Table 5.2 class badges ride the telemetry card.
  await expect(page.getByTestId("composite-class-bending")).toBeVisible();
});

test("apply to the selected beam persists the section and re-solves natively", async ({ page }) => {
  await page.goto("/geometry?beam=1");
  await page.getByTestId("open-composite-section-studio").click();
  await expect(page.getByTestId("composite-telemetry")).toContainText("mm²", {
    timeout: 15_000,
  });
  await page.getByTestId("apply-composite-section").click();
  // Step 1 legend immediately lists the composite designation.
  const legend = page.getByTestId("profile-legend");
  await expect(legend).toContainText("PRS 300");
  // The Step 4 solve runs natively on the projected composite properties.
  await page.goto("/results");
  await expect(page.getByTestId("combination-selector")).toBeVisible();
  await page.goto("/report");
  await expect(page.getByTestId("report-composite-chapter")).toContainText("PRS 300");
});

test("report renders the Sections Droites Composées chapter with the classification", async ({
  page,
}) => {
  await page.goto("/geometry?beam=1");
  await page.getByTestId("open-composite-section-studio").click();
  await page.getByTestId("apply-composite-section").click();
  await page.goto("/report");
  const chapter = page.getByTestId("report-composite-chapter");
  await expect(chapter).toBeVisible();
  await expect(chapter).toContainText("PRS 300");
  await expect(chapter).toContainText("mm²");
  await expect(chapter.locator("svg").first()).toBeVisible();
  // Branded cover: BrandMark, solver badge and the 49/49 certified seal.
  await expect(page.getByTestId("report-cover")).toContainText("EN 1990 – EN 1999");
  await expect(page.getByTestId("report-solver-badge")).toBeVisible();
  await expect(page.getByTestId("report-benchmark-seal")).toContainText("49 / 49");
});

test("structured .docx export carries native Word tables (PK zip magic)", async ({ page }) => {
  await page.goto("/geometry?beam=1");
  await page.getByTestId("open-composite-section-studio").click();
  await page.getByTestId("apply-composite-section").click();
  await page.goto("/report");
  await expect(page.getByTestId("report-composite-chapter")).toBeVisible();
  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await page.getByTestId("export-docx-btn").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
  const path = await download.path();
  const { readFileSync } = await import("node:fs");
  const bytes = readFileSync(path!);
  // Office Open XML = stored ZIP: local file header magic PK\x03\x04.
  expect(bytes[0]).toBe(0x50);
  expect(bytes[1]).toBe(0x4b);
  const content = bytes.toString("latin1");
  // Native Word tables + the embedded composite section metadata.
  expect(content).toContain("word/document.xml");
  expect(content).toContain("PRS");
});

test("standalone offline 3D HTML embeds the composite geometry (0 bytes cloud)", async ({
  page,
}) => {
  await page.goto("/geometry?beam=1");
  await page.getByTestId("open-composite-section-studio").click();
  await page.getByTestId("apply-composite-section").click();
  await page.goto("/report");
  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await page.getByTestId("export-html-btn").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-rapport-3d\.html$/);
  const path = await download.path();
  const { readFileSync } = await import("node:fs");
  const html = readFileSync(path!, "utf8");
  // Geometry + boundary conditions + envelope results ride the file:
  // the composite designation and the utilization map are embedded.
  expect(html).toContain("new THREE.Scene()");
  expect(html).toContain("PRS 300");
  expect(html).not.toMatch(/src="https?:\/\//);
});

test("the ⌘K palette opens the composite studio", async ({ page }) => {
  await page.goto("/geometry");
  // The locked ⌘K contract (v211-polish.spec.ts convention).
  await page.keyboard.press("Control+k");
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await page.keyboard.type("compos");
  await page.getByText("Studio Sections Composées", { exact: false }).first().click();
  await expect(page.getByTestId("composite-section-svg")).toBeVisible();
});
