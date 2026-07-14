import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.spec.ts"],
  },
});
