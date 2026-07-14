import path from "node:path";
import { fileURLToPath } from "node:url";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

export default defineConfig({
  resolve: {
    alias: {
      "@xlt-token/nestjs": path.resolve(packageRoot, "src/index.ts"),
      "@xlt-token/core": path.resolve(packageRoot, "../core/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.e2e-spec.ts"],
    testTimeout: 15000,
    hookTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage-e2e",
      include: [
        "src/decorators/**",
        "src/guards/**",
        "src/xlt-token.module.ts",
        "../core/src/auth/stp-util.ts",
      ],
      exclude: ["**/*.spec.ts", "**/*.d.ts", "**/*.interface.ts"],
    },
  },
  plugins: [
    swc.vite({
      module: { type: "es6" },
    }),
  ],
});
