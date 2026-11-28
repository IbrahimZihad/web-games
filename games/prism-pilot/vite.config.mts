import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const gameRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: gameRoot,
  base: "./",
  worker: { format: "iife" },
  build: {
    outDir: fileURLToPath(new URL("../../public/uploads/games/prism-pilot/", import.meta.url)),
    emptyOutDir: true,
    target: "es2020",
  },
});
