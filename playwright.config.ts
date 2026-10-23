import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2eTests",
  webServer: {
    command: "npm run dev",
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:5173",
  },
});
