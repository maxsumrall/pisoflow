import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileDiagram, createOutputDirectory, slugify } from "./lib.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, "../../..");
const args = process.argv.slice(2);
const inputArg = args.find((arg) => !arg.startsWith("--"));

if (!inputArg) {
  throw new Error("Usage: render.mjs <diagram.json> [--output=<name>] [--open]");
}

const inputPath = resolve(process.cwd(), inputArg);
const input = JSON.parse(readFileSync(inputPath, "utf8"));
const diagram = compileDiagram(input);
const outputArg = args.find((arg) => arg.startsWith("--output="));
const outputName = outputArg?.slice("--output=".length) ?? slugify(input.title);
const outputDir = createOutputDirectory(outputName);
const outputFile = join(outputDir, "index.html");
const buildDir = mkdtempSync(join(tmpdir(), "pisoflow-"));
const dataFile = join(buildDir, "diagram.json");
writeFileSync(dataFile, JSON.stringify(diagram, null, 2));
let complete = false;

try {
  execFileSync("npm", ["run", "build"], {
    cwd: packageRoot,
    env: {
      ...process.env,
      ISOFLOW_DATA_FILE: dataFile,
      ISOFLOW_OUT_DIR: outputDir,
    },
    stdio: "inherit",
  });
  complete = true;
} finally {
  rmSync(buildDir, { recursive: true, force: true });
  if (!complete) {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

if (args.includes("--open")) {
  if (process.platform === "darwin") {
    execFileSync("open", [outputFile]);
  } else if (process.platform === "win32") {
    execFileSync("cmd", ["/c", "start", "", outputFile]);
  } else {
    execFileSync("xdg-open", [outputFile]);
  }
}
console.log(outputFile);
