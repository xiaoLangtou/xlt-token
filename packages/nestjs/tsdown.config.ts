import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: 'src/index.ts',
  format: ['esm', 'cjs'],
  dts: true,
  exports: true,
  clean: true,
  platform: 'node',
  external: [
    '@nestjs/common',
    '@nestjs/core',
    '@xlt-token/core',
    'reflect-metadata',
    'rxjs',
    'express',
    'redis',
    'jsonwebtoken',
    'uuid',
  ],
});
