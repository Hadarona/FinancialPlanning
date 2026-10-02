import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    maxWorkers: 2,
    testTimeout: 15000,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      exclude: [
        "src/db/migrations/**",
        "src/db/migrate.js",
        "src/seed/**",
        "scripts/**",
        "tests/**",
        "src/index.js",
        "vitest.config.js",
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
});
