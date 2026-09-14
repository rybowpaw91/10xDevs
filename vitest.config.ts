import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Playwright E2E specs live under tests/e2e/ and use @playwright/test's own test runner —
    // exclude them here so Vitest doesn't try (and fail) to execute them as unit tests.
    exclude: ["**/node_modules/**", "tests/e2e/**"],
  },
});
