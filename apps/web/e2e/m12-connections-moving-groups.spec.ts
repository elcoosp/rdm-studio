import { expect, test } from "@playwright/test";

/**
 * M12 — Steel Connections EC3-1-8, Moving Loads & Influence Lines,
 * Member Groups & Storey Drift, Inclined Supports & Custom Materials,
 * Bidirectional BIM import. Runs on chromium + firefox.
 */

test("M12.1 connection studio opens from Step 4 with SVG drawing and utilization badge", async ({
  page,
}) => {
  await page.goto("/results?beam=1");
  await expect(page.getByTestId("combination-selector")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("open-connection-studio").click();
  const svg = page.getByTestId("connection-svg");
  await expect(svg).toBeVisible();
  // Bolt-grid drawing: clearance holes + plate outline + force arrows.
  await expect(svg.locator("circle").first()).toBeAttached({ timeout: 20_000 });
  await expect(svg.locator("rect").first()).toBeAttached();
  // Clause-by-clause EN 1993-1-8 trace with the η badge.
  const badge = page.getByTestId("connection-utilization");
  await expect(badge).toContainText("η = ", { timeout: 20_000 });
  await expect(page.getByTestId("connection-trace")).toContainText("Table 3.4");
  // Switching the bolt grade recomputes the check (10.9 has fub = 1000 MPa).
  await page.getByTestId("connection-grade-10_9").click();
  await expect(page.getByTestId("connection-trace")).toContainText("Interaction");
});

test("M12.2 EN 1991-2 LM1 train envelope and influence line plot in Step 3", async ({ page }) => {
  await page.goto("/loads");
  const panel = page.getByTestId("moving-load-panel");
  await expect(panel).toBeVisible();
  // The 25-station influence line solves in the engine and plots with uPlot.
  await expect(page.getByTestId("influence-line-plot").locator("canvas").first()).toBeVisible({
    timeout: 30_000,
  });
  // Governing envelope readout of the LM1 tandem crossing.
  await expect(page.getByTestId("moving-envelope")).toContainText("M max");
  await expect(page.getByTestId("moving-envelope")).toContainText("kN");
  // Play/Pause animation + preset switch to the overhead crane.
  await page.getByTestId("train-play").click();
  await page.getByTestId("train-preset-pont_roulant").click();
  await expect(page.getByTestId("train-wheel-kn")).toBeVisible();
  await page.getByTestId("train-play").click();
  // The Step 4 advanced rail exposes the same panel.
  await page.goto("/results");
  await expect(page.getByTestId("combination-selector")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("rail-tab-advanced").click();
  await expect(page.getByTestId("moving-load-panel").first()).toBeVisible();
});

test("M12.3 member group Poteaux drives the grouped EC3 optimizer", async ({ page }) => {
  await page.goto("/geometry");
  await page.getByTestId("member-group-select-all").click();
  await page.getByTestId("member-group-name").fill("Poteaux");
  await page.getByTestId("member-group-create").click();
  await expect(page.getByTestId("member-groups-panel")).toContainText("Poteaux");
  // Grouped optimization: the modal shows ONE uniform-profile row per group.
  await page.goto("/results?modal=optim");
  const modal = page.getByTestId("optimizer-modal");
  await expect(modal).toBeVisible({ timeout: 20_000 });
  await expect(modal).toContainText("Poteaux", { timeout: 30_000 });
  await page.getByRole("button", { name: /Appliquer les profilés optimisés/ }).click();
  await expect(page.getByTestId("optimizer-modal")).toHaveCount(0);
});

test("M12.4 inclined roller α = 30° and custom material E = 200 GPa persist", async ({ page }) => {
  await page.goto("/supports?node=1");
  // The glissant-z preset lives inside the collapsed RDM 7 library.
  await page.getByText(/Bibliothèque RDM 7/).click();
  await page.getByTestId("preset-glissant-z").click();
  // ExpandablePanel opens on click (defaultOpen = false).
  await page.getByTestId("support-incline-panel").click();
  const angle = page.getByTestId("support-incline-angle");
  await expect(angle).toBeVisible();
  await angle.fill("30");
  await page.getByTestId("support-incline-apply").click();
  // Unit normal (sin 30° ; 0 ; cos 30°) echoed in the readout.
  await expect(page.getByTestId(`incline-fields-1`)).toContainText("0,500");
  await expect(page.getByTestId(`incline-fields-1`)).toContainText("0,866");
  // Custom material dialog: name + E = 200 GPa persisted in the project.
  await page.goto("/geometry");
  await page.getByTestId("open-custom-material").click();
  await page.getByTestId("custom-material-name").fill("AcierE200");
  await page.getByTestId("custom-material-e").fill("200");
  await page.getByTestId("custom-material-save").click();
  await expect(page.getByText(/ajouté à la table du projet/)).toBeVisible({ timeout: 10_000 });
});

test("M12.5 .ifc export round-trips through the CAD import dialog", async ({ page }) => {
  await page.goto("/report");
  await expect(page.getByTestId("report-cover")).toBeVisible({ timeout: 20_000 });
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-bim-ifc4").click();
  const download = await downloadPromise;
  const ifcPath = await download.path();
  expect(ifcPath).not.toBeNull();
  // Re-import the exported file: the dialog accepts .ifc / .saf.json.
  await page.goto("/geometry");
  await page.getByTestId("open-cad-import").click();
  const fileChooser = page.waitForEvent("filechooser");
  await page.getByTestId("cad-choose").click();
  const chooser = await fileChooser;
  await chooser.setFiles(ifcPath as string);
  await expect(page.getByText(/Import réussi/)).toBeVisible({ timeout: 30_000 });
});
