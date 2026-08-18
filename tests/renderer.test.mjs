import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { compileDiagram, createOutputDirectory } from "../skills/pisoflow/scripts/lib.mjs";

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const renderer = join(root, "skills", "pisoflow", "scripts", "render.mjs");
const example = join(root, "examples", "order-processing.json");
const outputPath = (stdout) => stdout.trim().split("\n").at(-1);

const validDiagram = {
  title: "Valid diagram",
  nodes: [
    { id: "client", name: "Client", icon: "desktop" },
    { id: "service", name: "Service", icon: "server" },
  ],
  views: [{
    id: "overview",
    name: "Overview",
    nodes: [{ id: "client", x: -2, y: 0 }, { id: "service", x: 2, y: 0 }],
    edges: [{ id: "request", from: "client", to: "service", color: "service" }],
  }],
};

test("compiles the example", () => {
  const result = compileDiagram(JSON.parse(readFileSync(example, "utf8")));
  assert.equal(result.views.length, 2);
  assert.equal(result.items.length, 7);
});

test("adds connector defaults", () => {
  const result = compileDiagram(validDiagram);
  assert.equal(result.views[0].connectors[0].style, "DASHED");
  assert.equal(result.views[0].connectors[0].width, 4);
});

test("escapes description HTML before it enters Isoflow", () => {
  const diagram = structuredClone(validDiagram);
  diagram.nodes[0].description = '<img src=x onerror="alert(1)">';
  const result = compileDiagram(diagram);
  assert.equal(result.items[0].description, "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

test("rejects unknown edge nodes", () => {
  const invalid = structuredClone(validDiagram);
  invalid.views[0].edges[0].from = "missing";
  assert.throws(() => compileDiagram(invalid), /Unknown edge node: missing/);
});

test("rejects duplicate edge IDs", () => {
  const invalid = structuredClone(validDiagram);
  invalid.views.push({
    id: "second",
    name: "Second",
    nodes: [{ id: "client", x: 0, y: 0 }, { id: "service", x: 2, y: 0 }],
    edges: [{ id: "request", from: "client", to: "service" }],
  });
  assert.throws(() => compileDiagram(invalid), /Duplicate edge ID: request/);
});

test("creates unique output directories below the Pisoflow base", async () => {
  const home = await mkdtemp(join(tmpdir(), "pisoflow-output-"));
  try {
    const first = createOutputDirectory("safe-name", home);
    const second = createOutputDirectory("safe-name", home);
    assert.ok(first.startsWith(join(home, ".agent", "diagrams", "pisoflow", "safe-name-")));
    assert.ok(second.startsWith(join(home, ".agent", "diagrams", "pisoflow", "safe-name-")));
    assert.notEqual(first, second);
    assert.throws(() => createOutputDirectory("../../unsafe", home), /Output name/);
    assert.throws(() => createOutputDirectory("unsafe--name", home), /Output name/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("renders a licensed self-contained HTML file", async () => {
  const home = await mkdtemp(join(tmpdir(), "pisoflow-test-"));
  try {
    const result = await run(process.execPath, [renderer, example, "--output=smoke"], {
      cwd: root,
      env: { ...process.env, HOME: home },
    });
    const output = outputPath(result.stdout);
    const html = await readFile(output, "utf8");
    assert.ok(output.startsWith(join(home, ".agent", "diagrams", "pisoflow", "smoke-")));
    assert.ok(html.length > 100_000);
    assert.match(html, /Order processing architecture/);
    assert.match(html, /Copyright \(c\) 2025 Mark Mankarious/);
    assert.match(html, /GSAP Software License Agreement/);
    assert.match(html, /Copyright \(c\) 2014, Jason Chen/);
    assert.equal(existsSync(join(dirname(output), "assets")), false);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("isolates concurrent diagram builds", async () => {
  const home = await mkdtemp(join(tmpdir(), "pisoflow-concurrent-"));
  const first = join(home, "first.json");
  const second = join(home, "second.json");
  writeFileSync(first, JSON.stringify({ ...validDiagram, title: "First concurrent diagram" }));
  writeFileSync(second, JSON.stringify({ ...validDiagram, title: "Second concurrent diagram" }));
  try {
    const [firstResult, secondResult] = await Promise.all([
      run(process.execPath, [renderer, first, "--output=diagram"], { cwd: root, env: { ...process.env, HOME: home } }),
      run(process.execPath, [renderer, second, "--output=diagram"], { cwd: root, env: { ...process.env, HOME: home } }),
    ]);
    const firstOutput = outputPath(firstResult.stdout);
    const secondOutput = outputPath(secondResult.stdout);
    assert.notEqual(firstOutput, secondOutput);
    assert.match(readFileSync(firstOutput, "utf8"), /First concurrent diagram/);
    assert.match(readFileSync(secondOutput, "utf8"), /Second concurrent diagram/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("does not depend on mixed-license icon packs", () => {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(manifest.dependencies["@isoflow/isopacks"], undefined);
});
