import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: 'src/index.ts',
  format: ['esm', 'cjs'],
  dts: true,
  exports: true,
  clean: true,
  platform: 'node',
  external: [
    '@xlt-token/core',
    'express',
  ],
})
