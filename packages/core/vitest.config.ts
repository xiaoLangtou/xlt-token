import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
        'src/index.ts',
        'src/**/*.interface.ts',
        'src/http/context.ts',
        'src/perm/stp-interface.ts',
        'src/test/**',
        'src/token/test-jwt-strategy.ts',
      ],
    },
  },
});
