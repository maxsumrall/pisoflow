import { mkdirSync, mkdtempSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

export const STATUS_CATALOG = Object.freeze({
  observed: { label: "Observed", color: "#0F766E" },
  inferred: { label: "Inferred", color: "#7C3AED" },
  proposed: { label: "Proposed", color: "#2563EB" },
  legacy: { label: "Legacy", color: "#B45309" },
  unused: { label: "Unused", color: "#64748B" },
  unknown: { label: "Unknown", color: "#BE123C" },
});

export const EDGE_KIND_CATALOG = Object.freeze({
  request: { label: "Request", color: "#6D28D9", style: "DASHED", width: 4 },
  event: { label: "Event", color: "#0077B6", style: "DOTTED", width: 5 },
  data: { label: "Data", color: "#2D6A4F", style: "DASHED", width: 5 },
  control: { label: "Control", color: "#B45309", style: "DOTTED", width: 4 },
  result: { label: "Result", color: "#047857", style: "SOLID", width: 7 },
});

export const ICONS = Object.freeze(["desktop", "server", "storage", "queue", "function-module", "document", "block"]);

const id = z.string().min(1).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const text = z.string().min(1);
const status = z.enum(Object.keys(STATUS_CATALOG));
const edgeKind = z.enum(Object.keys(EDGE_KIND_CATALOG));
const evidence = z.object({ source: text, detail: text.optional() }).strict();
const node = z.object({
  id,
  name: text,
  icon: z.enum(ICONS),
  summary: text,
  details: text.optional(),
  status,
  evidence: z.array(evidence),
}).strict();
const group = z.object({ id, name: text, nodes: z.array(id).min(1) }).strict();
const edge = z.object({
  id,
  from: id,
  to: id,
  kind: edgeKind,
  label: text,
  contract: text.optional(),
  status,
  evidence: z.array(evidence),
}).strict();
const view = z.object({
  id,
  name: text,
  question: text,
  description: text,
  groups: z.array(group).min(1),
  edges: z.array(edge),
}).strict();
const diagramSchema = z.object({
  title: text,
  description: text,
  question: text,
  audience: text,
  scope: text,
  nodes: z.array(node).min(1),
  views: z.array(view).min(1),
}).strict().superRefine((diagram, context) => {
  const reportDuplicates = (values, path, kind) => {
    const seen = new Set();
    for (const value of values) {
      if (seen.has(value)) context.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate ${kind} ID: ${value}`, path });
      seen.add(value);
    }
  };
  const nodeIds = diagram.nodes.map((value) => value.id);
  const knownNodes = new Set(nodeIds);
  reportDuplicates(nodeIds, ["nodes"], "node");
  reportDuplicates(diagram.views.map((value) => value.id), ["views"], "view");
  diagram.nodes.forEach((value, nodeIndex) => {
    if (value.status !== "unknown" && value.evidence.length === 0) context.addIssue({ code: z.ZodIssueCode.custom, message: "Evidence is required unless status is unknown", path: ["nodes", nodeIndex, "evidence"] });
  });
  diagram.views.forEach((value, viewIndex) => {
    reportDuplicates(value.groups.map((entry) => entry.id), ["views", viewIndex, "groups"], "group");
    reportDuplicates(value.edges.map((entry) => entry.id), ["views", viewIndex, "edges"], "edge");
    const membership = value.groups.flatMap((entry) => entry.nodes);
    reportDuplicates(membership, ["views", viewIndex, "groups"], "view node");
    const viewNodes = new Set(membership);
    value.groups.forEach((entry, groupIndex) => entry.nodes.forEach((nodeId, nodeIndex) => {
      if (!knownNodes.has(nodeId)) context.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown node: ${nodeId}`, path: ["views", viewIndex, "groups", groupIndex, "nodes", nodeIndex] });
    }));
    value.edges.forEach((entry, edgeIndex) => {
      if (entry.status !== "unknown" && entry.evidence.length === 0) context.addIssue({ code: z.ZodIssueCode.custom, message: "Evidence is required unless status is unknown", path: ["views", viewIndex, "edges", edgeIndex, "evidence"] });
      for (const endpoint of ["from", "to"]) {
        if (!knownNodes.has(entry[endpoint])) context.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown edge node: ${entry[endpoint]}`, path: ["views", viewIndex, "edges", edgeIndex, endpoint] });
        else if (!viewNodes.has(entry[endpoint])) context.addIssue({ code: z.ZodIssueCode.custom, message: `Edge node is not in view: ${entry[endpoint]}`, path: ["views", viewIndex, "edges", edgeIndex, endpoint] });
      }
    });
  });
  const visibleNodes = new Set(diagram.views.flatMap((value) => value.groups.flatMap((entry) => entry.nodes)));
  nodeIds.forEach((nodeId, nodeIndex) => {
    if (!visibleNodes.has(nodeId)) context.addIssue({ code: z.ZodIssueCode.custom, message: `Node is not in any view: ${nodeId}`, path: ["nodes", nodeIndex, "id"] });
  });
});

const GROUP_COLORS = ["#EDE9FE", "#DBEAFE", "#DCFCE7", "#FEF3C7", "#FFE4E6", "#E0F2FE"];
const escapeHtml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const generatedId = (kind, ...parts) => `${kind}-${parts.map((part) => `${part.length}-${part}`).join("-")}`;

function stronglyConnectedComponents(nodeIds, edges) {
  const adjacency = new Map(nodeIds.map((nodeId) => [nodeId, []]));
  edges.forEach((entry) => adjacency.get(entry.from)?.push(entry.to));
  const order = new Map(nodeIds.map((nodeId, index) => [nodeId, index]));
  adjacency.forEach((targets) => targets.sort((left, right) => order.get(left) - order.get(right)));
  const stack = [];
  const onStack = new Set();
  const indices = new Map();
  const low = new Map();
  const components = [];
  let index = 0;
  const visit = (nodeId) => {
    indices.set(nodeId, index);
    low.set(nodeId, index);
    index += 1;
    stack.push(nodeId);
    onStack.add(nodeId);
    for (const target of adjacency.get(nodeId)) {
      if (!indices.has(target)) {
        visit(target);
        low.set(nodeId, Math.min(low.get(nodeId), low.get(target)));
      } else if (onStack.has(target)) low.set(nodeId, Math.min(low.get(nodeId), indices.get(target)));
    }
    if (low.get(nodeId) !== indices.get(nodeId)) return;
    const component = [];
    let current;
    do {
      current = stack.pop();
      onStack.delete(current);
      component.push(current);
    } while (current !== nodeId);
    component.sort((left, right) => order.get(left) - order.get(right));
    components.push(component);
  };
  nodeIds.forEach((nodeId) => {
    if (!indices.has(nodeId)) visit(nodeId);
  });
  return components;
}

function deriveLayout(viewValue) {
  const nodeIds = viewValue.groups.flatMap((entry) => entry.nodes);
  const components = stronglyConnectedComponents(nodeIds, viewValue.edges);
  const componentByNode = new Map();
  components.forEach((component, index) => component.forEach((nodeId) => componentByNode.set(nodeId, index)));
  const componentEdges = new Set();
  viewValue.edges.forEach((entry) => {
    const from = componentByNode.get(entry.from);
    const to = componentByNode.get(entry.to);
    if (from !== to) componentEdges.add(`${from}:${to}`);
  });
  const depths = Array(components.length).fill(0);
  for (let iteration = 0; iteration < components.length; iteration += 1) {
    let changed = false;
    for (const value of componentEdges) {
      const [from, to] = value.split(":").map(Number);
      if (depths[to] < depths[from] + 1) {
        depths[to] = depths[from] + 1;
        changed = true;
      }
    }
    if (!changed) break;
  }
  const nodeDepths = new Map(nodeIds.map((nodeId) => [nodeId, depths[componentByNode.get(nodeId)]]));
  const maxDepth = Math.max(...nodeDepths.values(), 0);
  const groupLayouts = viewValue.groups.map((groupValue) => {
    const buckets = new Map();
    groupValue.nodes.forEach((nodeId) => {
      const depth = nodeDepths.get(nodeId);
      if (!buckets.has(depth)) buckets.set(depth, []);
      buckets.get(depth).push(nodeId);
    });
    return { buckets, halfSpan: Math.max(...[...buckets.values()].map((bucket) => bucket.length - 1), 0) };
  });
  const centers = [];
  groupLayouts.forEach((layout, index) => {
    if (index === 0) centers.push(0);
    else centers.push(centers[index - 1] + groupLayouts[index - 1].halfSpan + layout.halfSpan + 3);
  });
  const minimum = -groupLayouts[0].halfSpan - 1;
  const maximum = centers.at(-1) + groupLayouts.at(-1).halfSpan + 1;
  const centerOffset = Math.floor((minimum + maximum) / 2);
  const positions = new Map();
  groupLayouts.forEach((layout, groupIndex) => layout.buckets.forEach((bucket) => bucket.forEach((nodeId, bucketIndex) => {
    positions.set(nodeId, {
      x: nodeDepths.get(nodeId) * 3 - Math.floor(maxDepth * 1.5),
      y: centers[groupIndex] - centerOffset + (bucketIndex * 2 - (bucket.length - 1)),
    });
  })));
  return positions;
}

function legendFor(edges) {
  const kinds = new Set(edges.map((entry) => entry.kind));
  return Object.entries(EDGE_KIND_CATALOG)
    .filter(([key]) => kinds.has(key))
    .map(([idValue, value]) => ({ id: `kind-${idValue}`, type: "edge-kind", ...value }));
}

export function compileDiagram(input) {
  const parsed = diagramSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid diagram:\n${parsed.error.issues.map((issue) => `${issue.path.join(".") || "diagram"}: ${issue.message}`).join("\n")}`);
  const source = parsed.data;
  const colors = [
    ...Object.entries(EDGE_KIND_CATALOG).map(([key, value]) => ({ id: `kind-${key}`, value: value.color })),
    ...source.views.flatMap((value) => value.groups.map((entry, index) => ({ id: generatedId("group-color", value.id, entry.id), value: GROUP_COLORS[index % GROUP_COLORS.length] }))),
  ];
  const nodeById = new Map(source.nodes.map((value) => [value.id, value]));
  const presentationViews = [];
  const isoflowViews = source.views.map((viewValue) => {
    const positions = deriveLayout(viewValue);
    const viewPrefix = generatedId("view", viewValue.id);
    const groups = viewValue.groups.map((groupValue) => {
      const points = groupValue.nodes.map((nodeId) => positions.get(nodeId));
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return {
        ...groupValue,
        rectangle: { id: generatedId(`${viewPrefix}-group`, groupValue.id), color: generatedId("group-color", viewValue.id, groupValue.id), from: { x: minX - 1, y: maxY + 1 }, to: { x: maxX + 1, y: minY - 1 } },
        heading: { id: generatedId(`${viewPrefix}-heading`, groupValue.id), tile: { x: minX - 1, y: maxY + 1 }, content: groupValue.name, fontSize: 0.6, orientation: "X" },
      };
    });
    presentationViews.push({ ...viewValue, groups, legend: legendFor(viewValue.edges) });
    return {
      id: viewValue.id,
      name: viewValue.name,
      description: escapeHtml(viewValue.description),
      items: viewValue.groups.flatMap((entry) => entry.nodes).map((nodeId) => ({ id: nodeId, tile: positions.get(nodeId), labelHeight: 72 })),
      connectors: viewValue.edges.map((entry) => {
        const visual = EDGE_KIND_CATALOG[entry.kind];
        const connectorId = generatedId(`${viewPrefix}-edge`, entry.id);
        const statusPrefix = entry.status === "observed" ? "" : `[${STATUS_CATALOG[entry.status].label}] `;
        return {
          id: connectorId,
          description: escapeHtml(`${statusPrefix}${entry.label}`),
          color: `kind-${entry.kind}`,
          width: visual.width ?? 4,
          style: visual.style,
          anchors: [
            { id: `${connectorId}-anchor-from`, ref: { item: entry.from } },
            { id: `${connectorId}-anchor-to`, ref: { item: entry.to } },
          ],
        };
      }),
      rectangles: groups.map((entry) => entry.rectangle),
      textBoxes: groups.map((entry) => entry.heading),
    };
  });
  return {
    version: "2",
    metadata: { title: source.title, description: source.description, question: source.question, audience: source.audience, scope: source.scope },
    catalogs: { statuses: STATUS_CATALOG, edgeKinds: EDGE_KIND_CATALOG },
    nodes: source.nodes,
    views: presentationViews,
    isoflow: {
      version: "1",
      title: source.title,
      description: escapeHtml(source.description),
      colors,
      items: source.nodes.map((value) => ({ id: value.id, name: value.name, description: escapeHtml(`${STATUS_CATALOG[value.status].label} — ${value.summary}`), icon: value.icon })),
      views: isoflowViews,
      fitToView: true,
    },
  };
}

export function createOutputDirectory(name, home = homedir()) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error("Output name must contain only lowercase letters, numbers, and single hyphens");
  const base = join(home, ".agent", "diagrams", "pisoflow");
  mkdirSync(base, { recursive: true });
  return mkdtempSync(join(base, `${name}-`));
}

export function slugify(value) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) throw new Error("Diagram title must contain a letter or number");
  return slug;
}
