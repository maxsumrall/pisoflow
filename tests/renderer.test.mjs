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
import { injectDiagram, TEMPLATE_MARKER } from "../skills/pisoflow/scripts/render.mjs";

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const renderer = join(root, "skills", "pisoflow", "scripts", "render.mjs");
const example = join(root, "examples", "order-processing.json");
const template = join(root, "skills", "pisoflow", "assets", "template.html");
const outputPath = (stdout) => stdout.trim().split("\n").at(-1);
const evidence = [{ source: "src/example.js:1", detail: "Observed in test" }];
const validDiagram = {
  title: "Valid diagram",
  description: "A focused architecture explanation.",
  question: "How does the request complete?",
  audience: "Engineers",
  scope: "Client and service",
  nodes: [
    { id: "client", name: "Client", icon: "desktop", summary: "Starts the request.", status: "observed", evidence },
    { id: "service", name: "Service", icon: "server", summary: "Completes the request.", status: "observed", evidence },
  ],
  views: [{
    id: "overview",
    name: "Overview",
    question: "What is the main flow?",
    description: "The client calls the service.",
    groups: [{ id: "runtime", name: "Runtime", nodes: ["client", "service"] }],
    edges: [{ id: "request", from: "client", to: "service", kind: "request", label: "Send request", contract: "GET /result", status: "observed", evidence }],
  }],
};

const payloadFromHtml = (html) => {
  const encoded = html.match(/<script id="pisoflow-data" type="application\/octet-stream">([^<]+)<\/script>/)?.[1];
  assert.ok(encoded);
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
};

test("compiles the semantic example", () => {
  const result = compileDiagram(JSON.parse(readFileSync(example, "utf8")));
  assert.equal(result.version, "2");
  assert.equal(result.views.length, 2);
  assert.equal(result.nodes.length, 7);
  assert.equal(result.isoflow.views.length, 2);
  assert.equal("legend" in result, false);
  assert.equal("nodeIds" in result.views[0], false);
  assert.equal("effectiveLegendId" in result.views[0].edges[0], false);
  assert.match(result.isoflow.items.find((item) => item.id === "api").description, /Observed/);
});

test("rejects geometric legacy input", () => {
  assert.throws(() => compileDiagram({ title: "Legacy", nodes: [], views: [] }), /description: Required/);
});

test("rejects edge endpoints that are absent from the view", () => {
  const invalid = structuredClone(validDiagram);
  invalid.views[0].groups[0].nodes = ["client"];
  assert.throws(() => compileDiagram(invalid), /Edge node is not in view: service/);
});

test("requires evidence for known statuses", () => {
  const nodeWithoutEvidence = structuredClone(validDiagram);
  nodeWithoutEvidence.nodes[0].evidence = [];
  assert.throws(() => compileDiagram(nodeWithoutEvidence), /Evidence is required unless status is unknown/);
  const unknownWithoutEvidence = structuredClone(validDiagram);
  unknownWithoutEvidence.nodes[0].status = "unknown";
  unknownWithoutEvidence.nodes[0].evidence = [];
  assert.doesNotThrow(() => compileDiagram(unknownWithoutEvidence));
});

test("rejects duplicate, unknown, and invisible group membership", () => {
  const duplicate = structuredClone(validDiagram);
  duplicate.views[0].groups.push({ id: "second", name: "Second", nodes: ["client"] });
  assert.throws(() => compileDiagram(duplicate), /Duplicate view node ID: client/);
  const unknown = structuredClone(validDiagram);
  unknown.views[0].groups[0].nodes[0] = "missing";
  assert.throws(() => compileDiagram(unknown), /Unknown node: missing/);
  const invisible = structuredClone(validDiagram);
  invisible.nodes.push({ id: "orphan", name: "Orphan", icon: "block", summary: "Not shown.", status: "unknown", evidence: [] });
  assert.throws(() => compileDiagram(invisible), /Node is not in any view: orphan/);
});

test("rejects duplicate node, view, group, and edge IDs", () => {
  const cases = [
    [() => { const value = structuredClone(validDiagram); value.nodes.push(structuredClone(value.nodes[0])); return value; }, /Duplicate node ID/],
    [() => { const value = structuredClone(validDiagram); value.views.push(structuredClone(value.views[0])); return value; }, /Duplicate view ID/],
    [() => { const value = structuredClone(validDiagram); value.views[0].groups.push(structuredClone(value.views[0].groups[0])); return value; }, /Duplicate group ID/],
    [() => { const value = structuredClone(validDiagram); value.views[0].edges.push(structuredClone(value.views[0].edges[0])); return value; }, /Duplicate edge ID/],
  ];
  for (const [create, expected] of cases) assert.throws(() => compileDiagram(create()), expected);
});

test("derives deterministic layout for cycles", () => {
  const cyclic = structuredClone(validDiagram);
  cyclic.views[0].edges.push({ id: "reply", from: "service", to: "client", kind: "result", label: "Reply", status: "observed", evidence });
  const first = compileDiagram(cyclic);
  const second = compileDiagram(cyclic);
  assert.deepEqual(first.isoflow.views[0].items, second.isoflow.views[0].items);
  assert.notDeepEqual(first.isoflow.views[0].items[0].tile, first.isoflow.views[0].items[1].tile);
  assert.ok(first.isoflow.views[0].items.every((item) => Number.isInteger(item.tile.x) && Number.isInteger(item.tile.y)));
  assert.ok(first.isoflow.views[0].connectors.every((connector) => connector.id.startsWith("view-8-overview-edge-")));
});

test("keeps dense group lanes on unique non-overlapping tiles", () => {
  const dense = structuredClone(validDiagram);
  dense.nodes = Array.from({ length: 8 }, (_, index) => ({
    id: `node-${index + 1}`,
    name: `Node ${index + 1}`,
    icon: "block",
    summary: "Disconnected node.",
    status: "observed",
    evidence,
  }));
  dense.views[0].groups = [
    { id: "first", name: "First group", nodes: dense.nodes.slice(0, 4).map((node) => node.id) },
    { id: "second", name: "Second group", nodes: dense.nodes.slice(4).map((node) => node.id) },
  ];
  dense.views[0].edges = [];
  const first = compileDiagram(dense);
  const second = compileDiagram(dense);
  const view = first.isoflow.views[0];
  const tileKeys = view.items.map((item) => `${item.tile.x}:${item.tile.y}`);
  assert.equal(new Set(tileKeys).size, tileKeys.length);
  assert.ok(view.items.every((item) => Number.isInteger(item.tile.x) && Number.isInteger(item.tile.y)));
  assert.deepEqual(view.items, second.isoflow.views[0].items);
  const intervals = view.rectangles.map((rectangle) => ({
    minimum: Math.min(rectangle.from.y, rectangle.to.y),
    maximum: Math.max(rectangle.from.y, rectangle.to.y),
  }));
  assert.ok(intervals[0].maximum < intervals[1].minimum || intervals[1].maximum < intervals[0].minimum);
});

test("injects Unicode and hostile script text as Base64", () => {
  const diagram = { title: "Café 雪 </script><script>alert(1)</script>" };
  const html = injectDiagram(`<script>${TEMPLATE_MARKER}</script>`, diagram);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  const encoded = html.match(/<script>([^<]+)<\/script>/)[1];
  assert.deepEqual(JSON.parse(Buffer.from(encoded, "base64").toString("utf8")), diagram);
});

test("rejects missing and duplicate template markers", () => {
  assert.throws(() => injectDiagram("missing", validDiagram), /Invalid Pisoflow template/);
  assert.throws(() => injectDiagram(`${TEMPLATE_MARKER}${TEMPLATE_MARKER}`, validDiagram), /Invalid Pisoflow template/);
});

test("committed template is self-contained and has one marker", () => {
  const html = readFileSync(template, "utf8");
  assert.equal(html.split(TEMPLATE_MARKER).length - 1, 1);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+rel=["']stylesheet/i);
  assert.match(html, /Copyright \(c\) 2025 Mark Mankarious/);
});

test("creates unique safe output directories", async () => {
  const home = await mkdtemp(join(tmpdir(), "pisoflow-output-"));
  try {
    const first = createOutputDirectory("safe-name", home);
    const second = createOutputDirectory("safe-name", home);
    assert.ok(first.startsWith(join(home, ".agent", "diagrams", "pisoflow", "safe-name-")));
    assert.notEqual(first, second);
    assert.throws(() => createOutputDirectory("../../unsafe", home), /Output name/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("renders without npm on PATH", async () => {
  const home = await mkdtemp(join(tmpdir(), "pisoflow-no-npm-"));
  try {
    const result = await run(process.execPath, [renderer, example, "--output=no-npm", "--open"], { cwd: root, env: { ...process.env, HOME: home, PATH: "" } });
    const output = outputPath(result.stdout);
    const html = await readFile(output, "utf8");
    const payload = payloadFromHtml(html);
    assert.equal(payload.metadata.title, "Order processing architecture");
    assert.ok(html.length > 100_000 && html.length < 1_500_000);
    assert.equal(existsSync(join(dirname(output), "assets")), false);
    assert.match(html, /GSAP Software License Agreement/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("isolates concurrent renders", async () => {
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
    assert.equal(payloadFromHtml(readFileSync(firstOutput, "utf8")).metadata.title, "First concurrent diagram");
    assert.equal(payloadFromHtml(readFileSync(secondOutput, "utf8")).metadata.title, "Second concurrent diagram");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("root runtime dependency is only zod", () => {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.deepEqual(Object.keys(manifest.dependencies), ["zod"]);
  assert.equal(manifest.devDependencies, undefined);
});
