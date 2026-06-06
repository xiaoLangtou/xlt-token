import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    exclude: ['test/**/*.e2e-spec.ts', 'node_modules', 'dist'],
    globals: true,
  },
})
