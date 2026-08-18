import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileDiagram, createOutputDirectory, slugify } from "./lib.mjs";

export const TEMPLATE_MARKER = "__PISOFLOW_DATA_BASE64__";

export function injectDiagram(template, diagram) {
  const matches = template.split(TEMPLATE_MARKER).length - 1;
  if (matches !== 1) throw new Error(`Invalid Pisoflow template: expected one ${TEMPLATE_MARKER} marker, found ${matches}`);
  const encoded = Buffer.from(JSON.stringify(diagram), "utf8").toString("base64");
  return template.replace(TEMPLATE_MARKER, encoded);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const args = process.argv.slice(2);
  const inputArg = args.find((arg) => !arg.startsWith("--"));
  if (!inputArg) throw new Error("Usage: render.mjs <diagram.json> [--output=<name>] [--open]");
  const input = JSON.parse(readFileSync(resolve(process.cwd(), inputArg), "utf8"));
  const diagram = compileDiagram(input);
  const outputArg = args.find((arg) => arg.startsWith("--output="));
  const outputName = outputArg?.slice("--output=".length) ?? slugify(input.title);
  const template = readFileSync(resolve(scriptDir, "../assets/template.html"), "utf8");
  const html = injectDiagram(template, diagram);
  const outputDir = createOutputDirectory(outputName);
  const outputFile = join(outputDir, "index.html");
  writeFileSync(outputFile, html);
  console.log(outputFile);
  if (args.includes("--open")) {
    try {
      if (process.platform === "darwin") execFileSync("open", [outputFile], { stdio: "ignore" });
      else if (process.platform === "win32") execFileSync("explorer.exe", [outputFile], { stdio: "ignore", windowsHide: true });
      else execFileSync("xdg-open", [outputFile], { stdio: "ignore" });
    } catch (error) {
      console.warn(`Could not open the diagram: ${error.message}`);
    }
  }
}
