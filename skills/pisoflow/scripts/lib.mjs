import { mkdirSync, mkdtempSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const DEFAULT_COLORS = [
  { id: "context", value: "#0077B6" },
  { id: "fact", value: "#2D6A4F" },
  { id: "source", value: "#B45309" },
  { id: "service", value: "#6D28D9" },
  { id: "output", value: "#047857" },
  { id: "unused", value: "#4B5563" },
  { id: "warning", value: "#B91C1C" },
  { id: "context-region", value: "#D9F0FA" },
  { id: "fact-region", value: "#DDF2E5" },
  { id: "source-region", value: "#FFF0D5" },
  { id: "service-region", value: "#EEE5FF" },
  { id: "output-region", value: "#DDF7ED" },
  { id: "warning-region", value: "#FDE2E2" },
];

const id = z.string().min(1).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const coordinate = z.number().finite().int();
const tile = z.object({ x: coordinate, y: coordinate }).strict();
const color = z.object({ id, value: z.string().min(1) }).strict();
const node = z.object({
  id,
  name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().min(1).optional(),
}).strict();
const viewNode = z.object({
  id,
  x: coordinate,
  y: coordinate,
  labelHeight: z.number().finite().positive().optional(),
}).strict();
const edge = z.object({
  id,
  from: id,
  to: id,
  description: z.string().optional(),
  color: id.optional(),
  width: z.number().finite().positive().optional(),
  style: z.enum(["SOLID", "DOTTED", "DASHED"]).optional(),
  via: z.array(tile).optional(),
}).strict();
const region = z.object({
  id,
  color: id.optional(),
  from: tile,
  to: tile,
}).strict();
const label = z.object({
  id,
  tile,
  content: z.string().min(1),
  fontSize: z.number().finite().positive().optional(),
  orientation: z.enum(["X", "Y"]).optional(),
}).strict();
const view = z.object({
  id,
  name: z.string().min(1),
  description: z.string().optional(),
  nodes: z.array(viewNode).min(1),
  edges: z.array(edge).optional(),
  regions: z.array(region).optional(),
  labels: z.array(label).optional(),
}).strict();
const diagramSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  colors: z.array(color).optional(),
  nodes: z.array(node).min(1),
  views: z.array(view).min(1),
}).strict().superRefine((diagram, context) => {
  const reportDuplicates = (values, path, kind) => {
    const seen = new Set();
    for (const value of values) {
      if (seen.has(value)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate ${kind} ID: ${value}`, path });
      }
      seen.add(value);
    }
  };

  const nodeIds = diagram.nodes.map((value) => value.id);
  const knownNodes = new Set(nodeIds);
  const defaultColorIds = DEFAULT_COLORS.map((value) => value.id);
  const customColorIds = (diagram.colors ?? []).map((value) => value.id);
  const knownColors = new Set([...defaultColorIds, ...customColorIds]);
  reportDuplicates(nodeIds, ["nodes"], "node");
  reportDuplicates(diagram.views.map((value) => value.id), ["views"], "view");
  reportDuplicates(customColorIds, ["colors"], "custom color");
  for (const colorId of customColorIds) {
    if (defaultColorIds.includes(colorId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Custom color overrides reserved color: ${colorId}`, path: ["colors"] });
    }
  }

  const edgeIds = [];
  const regionIds = [];
  const labelIds = [];
  diagram.views.forEach((value, viewIndex) => {
    reportDuplicates(value.nodes.map((entry) => entry.id), ["views", viewIndex, "nodes"], "view node");
    value.nodes.forEach((entry, nodeIndex) => {
      if (!knownNodes.has(entry.id)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown node: ${entry.id}`, path: ["views", viewIndex, "nodes", nodeIndex, "id"] });
      }
    });
    (value.edges ?? []).forEach((entry, edgeIndex) => {
      edgeIds.push(entry.id);
      for (const endpoint of ["from", "to"]) {
        if (!knownNodes.has(entry[endpoint])) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown edge node: ${entry[endpoint]}`, path: ["views", viewIndex, "edges", edgeIndex, endpoint] });
        }
      }
      if (entry.color && !knownColors.has(entry.color)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown edge color: ${entry.color}`, path: ["views", viewIndex, "edges", edgeIndex, "color"] });
      }
    });
    (value.regions ?? []).forEach((entry, regionIndex) => {
      regionIds.push(entry.id);
      if (entry.color && !knownColors.has(entry.color)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown region color: ${entry.color}`, path: ["views", viewIndex, "regions", regionIndex, "color"] });
      }
    });
    (value.labels ?? []).forEach((entry) => labelIds.push(entry.id));
  });
  reportDuplicates(edgeIds, ["views"], "edge");
  reportDuplicates(regionIds, ["views"], "region");
  reportDuplicates(labelIds, ["views"], "label");
});

const escapeHtml = (value) => value?.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

const edgeDefaults = {
  context: { style: "SOLID", width: 6 },
  fact: { style: "DASHED", width: 5 },
  source: { style: "DOTTED", width: 5 },
  service: { style: "DASHED", width: 4 },
  output: { style: "SOLID", width: 8 },
  unused: { style: "DOTTED", width: 4 },
  warning: { style: "DASHED", width: 5 },
};

export function compileDiagram(input) {
  const parsed = diagramSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid diagram:\n${parsed.error.issues.map((issue) => `${issue.path.join(".") || "diagram"}: ${issue.message}`).join("\n")}`);
  }
  const source = parsed.data;
  return {
    version: "1",
    title: source.title,
    description: source.description,
    colors: [...DEFAULT_COLORS, ...(source.colors ?? [])],
    items: source.nodes.map((value) => ({
      id: value.id,
      name: value.name,
      description: escapeHtml(value.description),
      icon: value.icon ?? "function-module",
    })),
    views: source.views.map((value) => ({
      id: value.id,
      name: value.name,
      description: escapeHtml(value.description),
      items: value.nodes.map((entry) => ({
        id: entry.id,
        tile: { x: entry.x, y: entry.y },
        labelHeight: entry.labelHeight ?? 100,
      })),
      connectors: (value.edges ?? []).map((entry) => {
        const defaults = edgeDefaults[entry.color] ?? { style: "SOLID", width: 4 };
        return {
          id: entry.id,
          description: escapeHtml(entry.description) ?? "",
          color: entry.color,
          width: entry.width ?? defaults.width,
          style: entry.style ?? defaults.style,
          anchors: [
            { id: `${entry.id}-from`, ref: { item: entry.from } },
            ...(entry.via ?? []).map((point, index) => ({ id: `${entry.id}-via-${index}`, ref: { tile: point } })),
            { id: `${entry.id}-to`, ref: { item: entry.to } },
          ],
        };
      }),
      rectangles: value.regions ?? [],
      textBoxes: value.labels ?? [],
    })),
    fitToView: true,
  };
}

export function createOutputDirectory(name, home = homedir()) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error("Output name must contain only lowercase letters, numbers, and single hyphens");
  }
  const base = join(home, ".agent", "diagrams", "pisoflow");
  mkdirSync(base, { recursive: true });
  return mkdtempSync(join(base, `${name}-`));
}

export function slugify(value) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) {
    throw new Error("Diagram title must contain a letter or number");
  }
  return slug;
}
