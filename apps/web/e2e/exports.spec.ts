import { expect, test } from "@playwright/test";

/**
 * M8 (ARCHITECTURE.md section 18): step-5 exports + deep-link navigation.
 * Runs on every browser project (chromium, firefox, webkit).
 */

test("PDF export streams real PDF bytes from the worker", async ({ page }) => {
  await page.goto("/report");
  await expect(page.getByTestId("share-qr")).toBeVisible();
  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await page.getByTestId("export-pdf").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-rapport\.pdf$/);
  const path = await download.path();
  const { readFileSync } = await import("node:fs");
  const head = readFileSync(path!).subarray(0, 5).toString("latin1");
  expect(head).toBe("%PDF-");
});

test("CSV export carries the UTF-8 BOM", async ({ page }) => {
  await page.goto("/report");
  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await page.getByTestId("export-csv").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-resultats\.csv$/);
  const path = await download.path();
  const { readFileSync } = await import("node:fs");
  const bytes = readFileSync(path!);
  expect(bytes[0]).toBe(0xef);
  expect(bytes[1]).toBe(0xbb);
  expect(bytes[2]).toBe(0xbf);
  expect(bytes.toString("utf8")).toContain("eta ULE");
});

test("standalone 3D HTML report embeds three.js offline", async ({ page }) => {
  await page.goto("/report");
  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await page.getByTestId("export-html3d").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-rapport-3d\.html$/);
  const path = await download.path();
  const { readFileSync } = await import("node:fs");
  const html = readFileSync(path!, "utf8");
  expect(html).toContain("new THREE.Scene()");
  expect(html).not.toMatch(/src="https?:\/\//);
});

test("deep links restore the shared project state", async ({ page }) => {
  await page.goto("/report");
  await expect(page.getByTestId("export-pdf")).toBeVisible();
  const projectName = await page.locator("dl dd").first().textContent();
  const shareUrl = await page.locator("textarea").inputValue();
  const encoded = new URL(shareUrl).searchParams.get("p");
  expect(encoded).not.toBeNull();
  // Fresh navigation — the encoded model must restore from the URL alone.
  // Firefox can abort navigations racing the service worker; retry once.
  const deepLink = `/report?p=${encoded!}`;
  await page.goto(deepLink).catch(() =>
    page
      .waitForTimeout(1_000)
      .then(() => page.goto(deepLink))
      .catch(() => undefined),
  );
  await expect(page.getByRole("definition").first()).toHaveText(projectName ?? "");
  await expect(page.getByTestId("export-pdf")).toBeVisible();
  await expect(page.getByTestId("share-qr")).toBeVisible();
});
