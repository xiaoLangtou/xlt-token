import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage-e2e',
      include: [
        'src/decorators/**',
        'src/guards/**',
        'src/xlt-token.module.ts',
        'src/auth/stp-util.ts',
      ],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
        'src/**/*.interface.ts',
      ],
      // E2E 覆盖率仅作补充视图（HTTP 链路验证），不强制阈值
      // 严格阈值由单元测试 vitest.config.ts 保证
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
