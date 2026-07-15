import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/index.ts",
        "src/**/*.interface.ts",
        "src/http/context.ts",
        "src/perm/stp-interface.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 90,
        branches: 80,
        statements: 80,
      },
    },
  },
});
