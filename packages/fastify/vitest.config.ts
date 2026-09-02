import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.spec.ts"],
    exclude: ["test/**/*.e2e-spec.ts", "node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/types.ts", "**/*.d.ts"],
      thresholds: {
        lines: 95,
        functions: 75,
        branches: 90,
        statements: 95,
      },
    },
  },
});
