import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const run = promisify(execFile);
const toolingRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(toolingRoot, "..");
const renderer = join(root, "skills", "pisoflow", "scripts", "render.mjs");
const example = join(root, "examples", "order-processing.json");
const results = join(toolingRoot, "test-results");
const layoutSnapshot = JSON.parse(await readFile(join(toolingRoot, "tests", "fixtures", "layout-snapshot.json"), "utf8"));
const outputPath = (stdout) => stdout.trim().split("\n").at(-1);
const zoomPercent = async (page) => Number((await page.locator(".canvas").getByText(/^\d+%$/).textContent()).replace("%", ""));
const layoutBox = async (locator) => {
  const box = await locator.boundingBox();
  assert.ok(box);
  return { x: box.x, width: box.width, height: box.height };
};
const assertLayout = (actual, expected) => {
  assert.ok(actual.zoom >= expected.zoom.minimum && actual.zoom <= expected.zoom.maximum, `Expected zoom ${actual.zoom}% within ${expected.zoom.minimum}-${expected.zoom.maximum}%`);
  for (const [name, box] of Object.entries(expected.boxes)) {
    for (const [property, value] of Object.entries(box)) assert.ok(Math.abs(actual.boxes[name][property] - value) <= layoutSnapshot.tolerance, `${name}.${property} was ${actual.boxes[name][property]}, expected ${value} ± ${layoutSnapshot.tolerance}`);
  }
};

test("generated file provides accessible desktop and mobile user flows", async () => {
  const home = await mkdtemp(join(tmpdir(), "pisoflow-browser-"));
  await mkdir(results, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const rendered = await run(process.execPath, [renderer, example, "--output=browser"], { cwd: root, env: { ...process.env, HOME: home, PATH: "" } });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
    await page.goto(pathToFileURL(outputPath(rendered.stdout)).href, { waitUntil: "load" });
    await page.getByRole("heading", { name: "Order processing architecture", level: 1 }).waitFor();
    assert.equal(await page.getByRole("tab").count(), 2);
    const firstTab = page.getByRole("tab", { name: "Current synchronous flow" });
    const legend = page.getByRole("list", { name: "Active view flow legend" });
    assert.equal(await legend.getByText("Event flow").count(), 0);
    assert.equal(await legend.getByText(/status/).count(), 0);
    const desktopLayout = {
      zoom: await zoomPercent(page),
      boxes: {
        tabs: await layoutBox(page.locator(".view-tabs")),
        canvas: await layoutBox(page.locator(".canvas")),
        inspector: await layoutBox(page.locator(".inspector")),
      },
    };
    assertLayout(desktopLayout, layoutSnapshot.desktop);
    await firstTab.focus();
    await page.keyboard.press("ArrowRight");
    const proposedTab = page.getByRole("tab", { name: "Proposed event-driven flow" });
    assert.equal(await proposedTab.getAttribute("aria-selected"), "true");
    assert.equal(await proposedTab.evaluate((element) => element === document.activeElement), true);
    await legend.getByText("Event flow").waitFor();
    await page.locator(".component-controls").getByRole("button", { name: "Payment service" }).click();
    await page.locator("#component-details").getByRole("heading", { name: "Payment service" }).waitFor();
    const search = page.getByRole("searchbox", { name: "Search the complete architecture" });
    await search.fill("OrderCreated");
    await page.getByText("OrderCreated { orderId, customerId, amount }").waitFor();
    await search.fill("Proposed event boundary");
    await page.locator(".model-list summary").filter({ hasText: "Order events" }).waitFor();
    await search.fill("");
    const canvasControls = page.locator(".canvas button");
    assert.equal(await canvasControls.count(), 3);
    for (const name of ["Zoom out", "Zoom in", "Fit to screen"]) {
      const control = page.locator(".canvas").getByRole("button", { name });
      await control.focus();
      assert.equal(await control.evaluate((element) => element === document.activeElement), true);
    }
    const accessibility = await new AxeBuilder({ page }).exclude(".canvas img").analyze();
    const serious = accessibility.violations.filter((violation) => ["serious", "critical"].includes(violation.impact));
    assert.deepEqual(serious.map((violation) => `${violation.id}: ${violation.help}`), []);
    const desktopBounds = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: window.innerWidth }));
    assert.ok(desktopBounds.scrollWidth <= desktopBounds.width);
    await page.screenshot({ path: join(results, "pisoflow-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload({ waitUntil: "load" });
    const mobileBounds = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: window.innerWidth }));
    assert.ok(mobileBounds.scrollWidth <= mobileBounds.width);
    const mobileLayout = {
      zoom: await zoomPercent(page),
      boxes: {
        tabs: await layoutBox(page.locator(".view-tabs")),
        canvas: await layoutBox(page.locator(".canvas")),
        inspector: await layoutBox(page.locator(".inspector")),
      },
    };
    assertLayout(mobileLayout, layoutSnapshot.mobile);
    const tabsBox = await page.locator(".view-tabs").boundingBox();
    const inspectorBox = await page.locator(".inspector").boundingBox();
    assert.ok(tabsBox && tabsBox.x >= 0 && tabsBox.x + tabsBox.width <= 375);
    assert.ok(inspectorBox && inspectorBox.x >= 0 && inspectorBox.x + inspectorBox.width <= 375);
    await page.screenshot({ path: join(results, "pisoflow-mobile.png"), fullPage: true });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await rm(home, { recursive: true, force: true });
  }
});
