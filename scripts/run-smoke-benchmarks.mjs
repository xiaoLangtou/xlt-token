import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const coreDist = resolve(root, "packages/core/dist/index.mjs");

if (!existsSync(coreDist)) {
  console.error(
    "packages/core/dist/index.mjs is missing. Run pnpm --filter @xlt-token/core build first.",
  );
  process.exit(1);
}

const { createExpressContext, createXltToken, MemoryStore } = await import(pathToFileURL(coreDist));
const auth = createXltToken({
  store: new MemoryStore(),
  config: {
    timeout: 3600,
    activeTimeout: -1,
  },
});

const iterations = 500;
const start = performance.now();

for (let i = 0; i < iterations; i += 1) {
  const token = await auth.stpLogic.login(`bench-${i}`, { device: "bench" });
  const ctx = createExpressContext({
    headers: { authorization: `Bearer ${token}` },
  });
  const result = await auth.stpLogic.checkLogin(ctx);
  if (result.loginId !== `bench-${i}`) {
    console.error(`Benchmark auth check returned unexpected loginId for iteration ${i}.`);
    process.exit(1);
  }
}

const elapsedMs = performance.now() - start;
const opsPerSecond = Math.round((iterations * 2 * 1000) / elapsedMs);

if (elapsedMs > 5000) {
  console.error(
    `Smoke benchmark too slow: ${elapsedMs.toFixed(1)}ms for ${iterations} login/check cycles.`,
  );
  process.exit(1);
}

console.log(
  `Smoke benchmark passed: ${iterations} login/check cycles in ${elapsedMs.toFixed(1)}ms (~${opsPerSecond} ops/s).`,
);
