import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    watch: {
      // Tauri's Rust build outputs Windows binaries under `src-tauri/target/**` that can be locked
      // during compilation, which can crash Vite's watcher with EBUSY on Windows.
      ignored: ["**/src-tauri/target/**"],
    },
  },
});
