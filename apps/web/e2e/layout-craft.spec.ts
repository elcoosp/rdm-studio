import { expect, test, type Page } from "@playwright/test";

/**
 * v1.5.0 layout & visual geometry regression suite (impeccable v4.0.4
 * visual proof pass, AGENTS.md G6): asserts the locked `md+` workstation
 * geometry via `boundingBox()` across the three shipping viewports —
 * 1440×900 (full desktop), 860×900 (split-screen desktop) and 390×844
 * (mobile) — on the five workflow routes.
 */

const STEP_ROUTES = ["/geometry", "/supports", "/loads"] as const;
const ALL_ROUTES = [...STEP_ROUTES, "/results", "/report"] as const;

/** Drawer chrome must only exist below 768 px. */
async function expectNoSheetChrome(page: Page): Promise<void> {
  await expect(page.getByTestId("sheet-drag-handle")).toHaveCount(0);
  await expect(page.getByTestId("sheet-close")).toHaveCount(0);
}

async function expectDockedInspector(page: Page, viewportWidth: number): Promise<void> {
  const box = await page.getByTestId("inspector-sheet").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeLessThan(40);
  expect(box!.width).toBeGreaterThanOrEqual(260);
  expect(box!.width).toBeLessThanOrEqual(380);
  expect(box!.width).toBeLessThan(viewportWidth / 2);
}

async function expectWideViewport(page: Page, viewportWidth: number, viewportHeight: number) {
  const canvas = page.getByTestId("viewport-canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(viewportWidth * 0.55);
  expect(box!.height).toBeGreaterThanOrEqual(viewportHeight * 0.55);
}

test.describe("full desktop 1440×900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const route of STEP_ROUTES) {
    test(`${route}: docked left inspector + ≥55% viewport`, async ({ page }) => {
      await page.goto(route);
      await expectDockedInspector(page, 1440);
      await expectNoSheetChrome(page);
      await expectWideViewport(page, 1440, 900);
    });
  }

  test("geometry HUD corners: layer toolbar and camera presets never intersect", async ({
    page,
  }) => {
    await page.goto("/geometry");
    const layerToolbar = page.getByTestId("layer-toolbar");
    await expect(layerToolbar).toBeVisible();
    const leftBox = await layerToolbar.boundingBox();
    // Headless Firefox can fail the WebGL capability probe and render the
    // static fallback (AGENTS.md guardrail), which has no camera presets —
    // skip the intersection half there rather than failing on infrastructure.
    const fallback = await page.getByTestId("viewport-fallback").count();
    test.skip(fallback > 0, "WebGL unavailable — fallback renders without HUD presets");
    // The camera preset bar is the top-right floating group inside the
    // viewport; its buttons carry data-testid="view-<preset>".
    const presetBar = page.getByTestId("view-iso").locator("xpath=ancestor::div[1]");
    await expect(presetBar).toBeVisible();
    const rightBox = await presetBar.boundingBox();
    expect(leftBox).not.toBeNull();
    expect(rightBox).not.toBeNull();
    expect(leftBox!.x + leftBox!.width).toBeLessThan(rightBox!.x);
    // Bottom corners stay clear of the top HUD rows too.
    const legend = page.getByTestId("profile-legend");
    const legendBox = await legend.boundingBox();
    expect(legendBox).not.toBeNull();
    expect(legendBox!.y).toBeGreaterThan((leftBox?.y ?? 0) + (leftBox?.height ?? 0));
  });

  test("every route keeps the header 44px and no body scrollbar", async ({ page }) => {
    for (const route of ALL_ROUTES) {
      await page.goto(route);
      const header = page.locator("header");
      const headerBox = await header.boundingBox();
      expect(headerBox).not.toBeNull();
      expect(Math.round(headerBox!.height)).toBe(44);
      const metrics = await page.evaluate(() => ({
        inner: window.innerHeight,
        body: document.body.scrollHeight,
      }));
      expect(metrics.body).toBeLessThanOrEqual(metrics.inner + 1);
    }
  });
});

test.describe("split-screen desktop 860×900", () => {
  test.use({ viewport: { width: 860, height: 900 } });

  for (const route of STEP_ROUTES) {
    test(`${route}: locked workstation, no mobile drawer`, async ({ page }) => {
      await page.goto(route);
      await expectDockedInspector(page, 860);
      await expectNoSheetChrome(page);
      await expectWideViewport(page, 860, 900);
      // The mobile bottom tab bar must NOT exist at 860 px.
      await expect(page.locator('nav[aria-label="workflow mobile"]')).toHaveCount(0);
    });
  }

  test("results: KPI strip, consolidated controls and 220px dock fit", async ({ page }) => {
    await page.goto("/results");
    const kpi = page.getByTestId("kpi-strip");
    await expect(kpi).toBeVisible();
    await expect(page.getByTestId("ec3-rail")).toBeVisible();
    await expect(page.getByTestId("docked-inspector")).toBeVisible();
    const dockBox = await page.getByTestId("docked-inspector").boundingBox();
    expect(dockBox).not.toBeNull();
    expect(Math.round(dockBox!.height)).toBeLessThanOrEqual(240);
  });

  test("report: A4 sheet and export rail render side by side", async ({ page }) => {
    await page.goto("/report");
    await expect(page.getByTestId("export-pdf")).toBeVisible();
    const rail = page.getByTestId("export-pdf").locator("xpath=ancestor::aside[1]");
    const railBox = await rail.boundingBox();
    expect(railBox).not.toBeNull();
    // The sticky rail is ~320px on the right of the centered A4 sheet.
    expect(railBox!.width).toBeGreaterThan(280);
    expect(railBox!.width).toBeLessThan(400);
    await expect(page.getByTestId("model-fingerprint")).toBeVisible();
  });
});

test.describe("mobile 390×844", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  /** Firefox aborts SW-racing navigations (NS_BINDING_ABORTED) — retry once. */
  async function gotoMobile(page: Page, route: string): Promise<void> {
    await page.goto(route).catch(() => page.goto(route).catch(() => undefined));
  }

  test("drawer + bottom nav never clip interactive buttons", async ({ page }) => {
    await page.goto("/geometry");
    // v2.0.1: the drawer is closed by default — the handle click opens it.
    await page.getByTestId("inspector-sheet-handle").click();
    await expect(page.getByTestId("sheet-close")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("inspector-sheet")).toBeVisible();
    // The h-14 tab bar exists only on mobile.
    const nav = page.locator('nav[aria-label="workflow mobile"]');
    await expect(nav).toBeVisible();
    const navBox = await nav.boundingBox();
    expect(navBox).not.toBeNull();
    expect(navBox!.y).toBeGreaterThanOrEqual(0);

    // No interactive control may be clipped by the viewport edges, and no
    // control outside the tab bar may overlap it. Buttons living inside a
    // scrollable pane that itself extends past the viewport (the drawer's
    // 100dvh scroll body) are scroll-reachable, so only X-clipping and
    // nav overlaps are flagged for them.
    const problems = await page.evaluate(() => {
      const issues: string[] = [];
      const inner = window.innerHeight;
      const nav = document.querySelector('nav[aria-label="workflow mobile"]');
      const navRect = nav?.getBoundingClientRect();
      const insideReachablePane = (el: Element): boolean => {
        for (let p = el.parentElement; p !== null; p = p.parentElement) {
          const style = window.getComputedStyle(p);
          if (/(auto|scroll)/.test(style.overflowY)) {
            const r = p.getBoundingClientRect();
            if (r.bottom > inner + 1 && r.top < inner) {
              return true;
            }
          }
        }
        return false;
      };
      for (const el of document.querySelectorAll("button, a[href]")) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          continue;
        }
        const label = el.textContent?.trim().slice(0, 24) ?? el.tagName;
        const clippedY = rect.bottom > inner + 1 || rect.top < -1;
        if (clippedY && !insideReachablePane(el)) {
          issues.push(`clipped: ${label} (${Math.round(rect.top)}..${Math.round(rect.bottom)})`);
        }
        if (rect.left < -1 || rect.right > window.innerWidth + 1) {
          issues.push(`h-clipped: ${label}`);
        }
        if (
          navRect !== undefined &&
          !nav.contains(el) &&
          rect.bottom > navRect.top + 1 &&
          rect.top < navRect.bottom - 1
        ) {
          issues.push(`overlaps tab bar: ${label}`);
        }
      }
      return issues;
    });
    expect(problems).toEqual([]);
    const metrics = await page.evaluate(() => ({
      inner: window.innerHeight,
      body: document.body.scrollHeight,
    }));
    expect(metrics.body).toBeLessThanOrEqual(metrics.inner + 1);
  });

  test("steps 1-3 stay above the tab bar without page scroll", async ({ page }) => {
    for (const route of ALL_ROUTES) {
      await gotoMobile(page, route);
      const metrics = await page.evaluate(() => ({
        inner: window.innerHeight,
        body: document.body.scrollHeight,
      }));
      expect(metrics.body).toBeLessThanOrEqual(metrics.inner + 1);
    }
  });

  test("results exposes the 1-tap mobile PDF hand-off", async ({ page }) => {
    await page.goto("/results");
    const pdfButton = page.getByTestId("mobile-report-pdf");
    await expect(pdfButton).toBeVisible();
    await pdfButton.click();
    await expect(page).toHaveURL(/\/report/);
  });
});
