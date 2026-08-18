import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const toolingRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(toolingRoot, "..");
const outputDir = mkdtempSync(join(tmpdir(), "pisoflow-template-"));
const marker = "__PISOFLOW_DATA_BASE64__";

try {
  await build({
    root: toolingRoot,
    base: "./",
    plugins: [react(), viteSingleFile()],
    build: { outDir: outputDir, emptyOutDir: true },
  });
  const built = join(outputDir, "index.html");
  const html = readFileSync(built, "utf8");
  const markerCount = html.split(marker).length - 1;
  if (markerCount !== 1) throw new Error(`Invalid built template: expected one marker, found ${markerCount}`);
  if (/<script[^>]+src=|<link[^>]+rel=["']stylesheet/i.test(html)) throw new Error("Invalid built template: external scripts or styles remain");
  const assetDirectory = join(projectRoot, "skills", "pisoflow", "assets");
  mkdirSync(assetDirectory, { recursive: true });
  cpSync(built, join(assetDirectory, "template.html"));
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
