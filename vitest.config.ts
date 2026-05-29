import { defineConfig } from 'vitest/config';

/** @deprecated 请使用 `pnpm --filter @xlt-token/nestjs test` */
export default defineConfig({
  test: {
    include: ['packages/nestjs/src/**/*.spec.ts'],
  },
});
