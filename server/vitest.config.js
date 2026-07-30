import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: [
        "src/db/migrations/**",
        "src/db/migrate.js",
        "src/seed/**",
        "scripts/**",
        "tests/**",
        "src/index.js",
      ],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 60,
      },
    },
  },
});
