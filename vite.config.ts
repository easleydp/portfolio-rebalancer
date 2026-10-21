import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

// base './' lets the built site work from any GitHub Pages path.
export default defineConfig({
  base: "./",
  plugins: [vue()],
  test: { environment: "node" },
});
