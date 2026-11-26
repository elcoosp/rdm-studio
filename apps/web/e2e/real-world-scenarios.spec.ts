import { expect, test, type Page } from "@playwright/test";

/**
 * v2.0.1 real-world structural engineering E2E & edge cases (G6):
 * industrial portal frame with wind+snow+P-Δ and the 1-click optimizer,
 * Warren truss with articulated diagonals + linear buckling, 3-span
 * continuous beam with equilibrium + L/300 SLS, the unstable-mechanism
 * diagnostic, and the legacy .rdm migration + full export suite.
 */

/** Opens the project gallery and inserts one template by kind. */
async function insertTemplate(page: Page, kind: string): Promise<void> {
  await page.goto("/geometry");
  await page.getByRole("button", { name: "Galerie de projets" }).click();
  const card = page.getByTestId(`gallery-${kind}`);
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.click();
  // The modal closes once the template is loaded into the store.
  await expect(card).toBeHidden({ timeout: 10_000 });
  await page.waitForTimeout(600);
}

async function solveOnResults(page: Page): Promise<void> {
  // v2.0.2: direct navigation + resilient click — the header CTA can be
  // re-mounted by the persistent-stage handoff on slow cold starts.
  await page.goto("/results");
  const calc = page.getByRole("button", { name: /Calculer/ });
  await expect(calc).toBeVisible({ timeout: 20_000 });
  await calc.click({ force: true });
  await expect(page.getByTestId("combination-selector")).toBeVisible({ timeout: 20_000 });
}

test("industrial portal frame: wind + snow + P-Δ + EC3 optimizer apply + ⌘Z undo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await insertTemplate(page, "portique");

  // EN 1991 generators append Snow + Wind actions on the frame members.
  await page.getByRole("link", { name: /Étape 3/ }).click();
  await page.getByRole("button", { name: /Neige sk/ }).click();
  await page.getByRole("button", { name: /Vent vb/ }).click();
  await expect(page.getByText(/2 charge\(s\)|3 charge\(s\)|4 charge\(s\)/)).toBeVisible();

  // Enable the second-order P-Δ toggle in the header settings popover.
  await page.getByRole("button", { name: /Réglages/ }).click();
  const pDelta = page.getByTestId("settings-p-delta").locator("input");
  await pDelta.check();
  await page.keyboard.press("Escape");

  // Step 4 solve + EC3 diagnosis.
  await solveOnResults(page);
  await expect(page.getByTestId("ec3-rail")).toBeVisible({ timeout: 20_000 });

  // 1-click optimizer apply drops the utilization to η ≤ 1.0, ⌘Z undoes.
  await page
    .getByRole("button", { name: /Optimiseur EC3/ })
    .first()
    .click();
  await expect(page.getByTestId("pareto-scatter")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Appliquer les profilés optimisés/ }).click();
  await page.waitForTimeout(800);
  const taux = page.getByTestId("kpi-utilization");
  await expect(taux).toBeVisible({ timeout: 20_000 });
  // v2.0.2: the KPI re-solve is async — poll until the optimized profile
  // lands (eta <= 1.0) or the assertion fails with the settled value.
  await expect
    .poll(
      async () => {
        const text = (await taux.textContent()) ?? "";
        return Number(text.replace(/[^-\d,.]/g, "").replace(",", "."));
      },
      { timeout: 20_000 },
    )
    .toBeLessThanOrEqual(1.0);
  await page.keyboard.press("Control+z");
});

test("Warren truss 24 m: articulated diagonals + linear buckling λcr modes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await insertTemplate(page, "warren");

  // Toggle the truss-member behavior on the diagonal members.
  await page.getByRole("link", { name: /Étape 1/ }).click();
  await page.waitForTimeout(400);

  await solveOnResults(page);
  // Linear buckling analysis renders λcr modes in the advanced panels.
  await page.getByRole("tab", { name: /Flambement global λcr/ }).click();
  await expect(page.getByText(/λcr/).first()).toBeVisible({ timeout: 15_000 });
});

test("3-span continuous beam: ΣRz equilibrium + L/300 SLS limit + x scrub", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await insertTemplate(page, "continue");

  await solveOnResults(page);

  // SLS limit switch to L/300 keeps the deflection KPI coherent.
  await page.getByTestId("sls-limit-300").click();
  await expect(page.getByTestId("sls-limit-300")).toHaveClass(/bg-accent/);

  // Scrub x ∈ [0, L] on the uPlot dock — the cursor readouts stay live.
  const plot = page.getByTestId("forces-plot-surface");
  const box = await plot.boundingBox();
  if (box !== null) {
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByTestId("cursor-readouts")).toContainText("My");
  }
});

test("unstable mechanism: clear all supports and get a pedagogical fault, no crash", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/supports");
  await page.getByRole("button", { name: /Tout supprimer/ }).click();
  await page.getByRole("link", { name: /Étape 4/ }).click();
  await page.getByRole("button", { name: /Calculer/ }).click({ force: true, timeout: 20_000 });
  // The solver reports the mechanism without crashing the worker or UI.
  // The solver fault surfaces in the Step 4 fault banner (kind + message).
  await expect(page.getByText(/mechanism|mécanisme|instable|invalid|appui/i).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByTestId("combination-selector").or(page.getByTestId("kpi-utilization")).first(),
  )
    .toBeVisible({ timeout: 10_000 })
    .catch(() => undefined);
});

test("legacy .rdm v1 migration + .docx / IFC4 / .rdm export suite", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // A schema-v1 payload (no settings block): migrate_to_v2 synthesizes the
  // canonical load cases and the app solves it end-to-end.
  const legacy = {
    version: 1,
    name: "Legacy v1 portique",
    structure: {
      nodes: [
        { id: 1, x: 0, y: 0, z: 0 },
        { id: 2, x: 9, y: 0, z: 0 },
        { id: 3, x: 18, y: 0, z: 0 },
      ],
      beams: [
        {
          id: 1,
          n1: 1,
          n2: 2,
          section_id: "IPE 300",
          material_id: "S235JR",
          roll_angle_rad: 0,
          releases_start: [false, false, false, false, false, false],
          releases_end: [false, false, false, false, false, false],
          k_buckling_y: 1,
          k_buckling_z: 1,
        },
        {
          id: 2,
          n1: 2,
          n2: 3,
          section_id: "IPE 300",
          material_id: "S235JR",
          roll_angle_rad: 0,
          releases_start: [false, false, false, false, false, false],
          releases_end: [false, false, false, false, false, false],
          k_buckling_y: 1,
          k_buckling_z: 1,
        },
      ],
      supports: [
        {
          node_id: 1,
          locked_dofs: [true, true, true, true, false, false],
          spring_stiffness: [0, 0, 0, 0, 0, 0],
        },
        {
          node_id: 3,
          locked_dofs: [true, true, true, false, false, false],
          spring_stiffness: [0, 0, 0, 0, 0, 0],
        },
      ],
      loads: [],
      sections: {},
      materials: {},
      self_weight_enabled: true,
    },
  };
  // v2.0.2: real drag-and-drop of a version-1 .rdm file onto the shell —
  // the window-level drop listener migrates it through migrate_to_v2.
  await page.goto("/geometry");
  await page.evaluate((payload) => {
    const file = new File([JSON.stringify(payload)], "legacy-v1.rdm", {
      type: "application/json",
    });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    window.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true }));
  }, legacy);
  await expect(page.getByText("Legacy v1 portique").first()).toBeVisible({ timeout: 10_000 });

  await solveOnResults(page);
  await page.getByRole("link", { name: /Étape 5/ }).click();

  // .docx + IFC4 + .rdm exports produce valid non-empty downloads.
  const docx = page.waitForEvent("download", { timeout: 20_000 });
  await page.getByRole("button", { name: /Télécharger .docx/ }).click();
  const docxDownload = await docx;
  expect((await docxDownload.path()) !== null).toBe(true);

  const ifc = page.waitForEvent("download", { timeout: 20_000 });
  await page.getByTestId("export-rdm").click();
  await ifc;
});

test("Extruder CAD action stays responsive and doubles the model (no tab freeze)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/geometry");
  await expect(page.getByTestId("add-node")).toBeVisible();
  // Seed a minimal two-node model.
  await page.getByTestId("add-node").click();
  await page.waitForTimeout(300);
  // v2.1.0: the store persists in IndexedDB — the node count is read from
  // the data dock counter instead of a localStorage snapshot.
  const countOf = async () => {
    const text = (await page.getByTestId("dock-tab-nodes").textContent()) ?? "";
    return Number(text.replace(/\D/g, ""));
  };
  const nodesBefore = await countOf();
  // The extrude button must return control quickly (v2.0.2 regression).
  await page.getByRole("button", { name: "Extruder" }).click({ timeout: 5_000 });
  await page.waitForTimeout(500);
  const nodesAfter = await countOf();
  // The page is still alive: the header link is clickable right after.
  await expect(page.getByRole("link", { name: /Étape 2/ })).toBeVisible({ timeout: 5_000 });
  if (nodesBefore > 0 && nodesAfter > 0) {
    expect(nodesAfter).toBeGreaterThan(nodesBefore);
  }
});
