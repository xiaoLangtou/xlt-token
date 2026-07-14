import { defineConfig } from "tsdown";
import { dualPackageExports } from "../../build/dual-package-exports.ts";

export default defineConfig({
  entry: "src/index.ts",
  format: ["esm", "cjs"],
  dts: true,
  exports: {
    customExports: dualPackageExports,
  },
  clean: true,
  platform: "node",
  external: [
    "@nestjs/common",
    "@nestjs/core",
    "@xlt-token/core",
    "@xlt-token/store-redis",
    "reflect-metadata",
    "rxjs",
    "express",
    "jsonwebtoken",
    "uuid",
  ],
});
