import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: 'packages/nestjs/src/index.ts',
  format: ['esm', 'cjs'],
  dts: true,
  exports: true,
  clean: true,
  platform: 'node',
  external: [
    '@nestjs/common',
    '@nestjs/core',
    '@xlt-token/core',
    '@xlt-token/nestjs',
    'reflect-metadata',
    'rxjs',
    'express',
  ],
})
