import { expect, test, type Page } from "@playwright/test";

/**
 * v2.1.1 polish E2E (G6): the named workflow stepper with the Cobalt
 * active pill, the marketing hash navigation from /legal, the
 * StrictMode-safe Validation modal with French benchmark titles, the
 * icon-led ⌘K palette, the zero-overflow Step 1/Step 4 cockpits (uPlot
 * timestamp bug gone, thermal legend clear of the XYZ gizmo) and the
 * FR → EN translations of the v2.1.1 surfaces.
 */

/** Named steps rendered in the desktop header (md+). */
const NAMED_STEPS = [
  "1. Géométrie",
  "2. Liaisons",
  "3. Charges",
  "4. Résultats",
  "5. Rapport",
] as const;

async function openPalette(page: Page): Promise<void> {
  await page.keyboard.press("Control+k");
  await expect(page.getByTestId("command-palette")).toBeVisible();
}

test("clicking Fonctionnalités from /legal navigates to /#fonctionnalites and scrolls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/legal");
  await page.getByRole("link", { name: "Fonctionnalités" }).first().click();
  await expect(page).toHaveURL(/\/#fonctionnalites/);
  // The landing section actually scrolled into view (not just the hash).
  await expect
    .poll(async () => page.evaluate(() => window.scrollY), { timeout: 10_000 })
    .toBeGreaterThan(50);
  await expect(
    page.getByText("Un bureau d'études complet, du modèle à la note de calcul."),
  ).toBeVisible();
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 860, height: 900 },
]) {
  test(`studio header shows the named steps, active pill and FR|EN at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/geometry");
    const nav = page.locator("#rdm-steps");
    for (const label of NAMED_STEPS) {
      await expect(nav.getByText(label, { exact: true })).toBeVisible();
    }
    // Active step: Cobalt pill highlight + aria-current="page".
    const active = nav.locator('a[aria-current="page"]');
    await expect(active).toHaveCount(1);
    // v2.1.2: the active step is a crisp white card + Cobalt text on the
    // segmented rail (2px underline glides via layoutId).
    await expect(active).toHaveClass(/bg-panel/);
    await expect(active).toHaveClass(/text-accent/);
    // Zero horizontal overflow on the stepper and FR | EN visible.
    const overflow = await page.evaluate(() => {
      const el = document.getElementById("rdm-steps");
      if (el === null) return null;
      return el.scrollWidth - el.clientWidth;
    });
    expect(overflow).not.toBeNull();
    expect(overflow as number).toBeLessThanOrEqual(1);
    await expect(page.getByRole("radio", { name: "FR", exact: true })).toBeVisible();
    await expect(page.getByRole("radio", { name: "EN", exact: true })).toBeVisible();
    const bodyOverflow = await page.evaluate(
      () => document.body.scrollWidth - document.body.clientWidth,
    );
    expect(bodyOverflow).toBeLessThanOrEqual(0);
  });
}

test("Validation modal under FR shows 41/41 with French titles and no in-flight fault", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/geometry");
  await page.getByRole("button", { name: /Validation — 41 benchmarks/ }).click();
  const dialog = page.getByTestId('validation-modal');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/41\/41 benchmarks passent/)).toBeVisible({
    timeout: 15_000,
  });
  // French engineering titles for the benchmark rows (StrictMode-safe
  // coalescing — the modal never shows "validation in flight").
  await expect(
    dialog.getByText("Poutre isostatique P à mi-travée — réaction P/2").first(),
  ).toBeVisible();
  await expect(dialog.getByText("Coefficient γG de la recette ELU 6.10").first()).toBeVisible();
  const body = await page.evaluate(() => document.body.textContent ?? "");
  expect(body).not.toContain("validation in flight");
});

test("⌘K palette renders icons + Kbd chips and executes CAD, modal and locale commands", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/geometry");
  await expect(page.getByTestId("dock-tab-beams")).toBeVisible();
  await openPalette(page);
  // Icons + <Kbd> shortcut chips render across the 5 groups.
  await expect(page.getByTestId("command-palette").locator("svg").first()).toBeVisible();
  await expect(page.getByTestId("command-palette").locator("kbd").first()).toBeVisible();
  await expect(page.getByText("Analyses & Normes")).toBeVisible();
  await expect(page.getByText("Modèles & Exports")).toBeVisible();
  await expect(page.getByText("Préférences & Aide")).toBeVisible();

  // CAD command: Extruder executes in the Step 1 toolbar (feedback row).
  await page.getByTestId("command-palette").getByText("Extruder", { exact: true }).click();
  await expect(page.getByTestId("cad-feedback")).toContainText(/Extrusion|Extruder/, {
    timeout: 10_000,
  });

  // Modal command: the Validation suite opens through the palette.
  await openPalette(page);
  await page
    .getByTestId("command-palette")
    .getByText("Validation — 41 benchmarks analytiques", { exact: true })
    .click();
  await expect(page.getByTestId("validation-modal")).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Fermer" }).click();
  await expect(page.getByTestId("validation-modal")).toBeHidden();

  // Locale command: Basculer FR / EN flips the active catalog in place.
  await openPalette(page);
  await page.getByTestId("command-palette").getByText("Basculer FR / EN", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "EN", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
    {
      timeout: 10_000,
    },
  );
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
  // Restore FR for the remaining assertions.
  await page.getByRole("radio", { name: "FR", exact: true }).click();
  await expect(page.getByRole("radio", { name: "FR", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("Step 1 Importer CAO is unclipped and Step 4 cockpit stays 100dvh with a clean uPlot", async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/geometry");
  const cao = page.getByTestId("open-cad-import");
  await expect(cao).toBeVisible();
  const clipped = await cao.evaluate((el) => ({
    scroll: el.scrollWidth,
    client: el.clientWidth,
  }));
  expect(clipped.scroll).toBeLessThanOrEqual(clipped.client);

  // Step 4: no page scroll (100dvh cockpit), no uPlot timestamp artifacts,
  // thermal legend clear of the bottom-right XYZ gizmo.
  await page.goto("/results");
  await expect(page.getByTestId("docked-inspector")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("combination-selector")).toBeVisible({ timeout: 20_000 });
  const pageHeight = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);
  expect(pageHeight).toBeLessThanOrEqual(1);

  // The WebGL canvas contract is a chromium assertion (AGENTS.md §4);
  // the timestamp + overflow checks below run on BOTH browsers.
  const bodyText = await page.evaluate(() => document.body.textContent ?? "");
  expect(bodyText).not.toContain(":00.000");
  expect(bodyText).not.toContain("1/1/70");
  expect(bodyText).not.toContain("1/1/70, ");

  const boxes = await page.evaluate(() => {
    const legend = document.querySelector('[data-testid="fea-legend"]');
    const stage = document.querySelector('[data-testid="results-stage-slot"]');
    if (legend === null || stage === null) return null;
    const l = legend.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    return { legendRight: l.right, stageLeft: s.left, stageWidth: s.width };
  });
  expect(boxes).not.toBeNull();
  if (boxes !== null) {
    // The legend lives in the LEFT third of the stage — the XYZ gizmo
    // (bottom-right quadrant) can never overlap it.
    expect(boxes.legendRight).toBeLessThanOrEqual(boxes.stageLeft + boxes.stageWidth * 0.5);
  }
  void browserName;
});

test("switching FR → EN translates header Settings, Step 4 advanced tab and Step 5 report", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/geometry");
  await page.getByRole("radio", { name: "EN", exact: true }).click();
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible({
    timeout: 10_000,
  });

  await page.goto("/results");
  await expect(page.getByTestId("ec3-rail")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("radio", { name: "Advanced analyses" })).toBeVisible();

  await page.goto("/report");
  await expect(page.getByText("RDM Studio — Calculation report").first()).toBeVisible({
    timeout: 15_000,
  });
});
