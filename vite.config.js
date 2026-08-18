import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      "@diagram": process.env.ISOFLOW_DATA_FILE || resolve("generated-data.json"),
    },
  },
  build: {
    outDir: process.env.ISOFLOW_OUT_DIR || "dist",
    emptyOutDir: true,
  },
});
