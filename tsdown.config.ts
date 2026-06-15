import { defineConfig } from 'tsdown'
import { dualPackageExports } from './build/dual-package-exports.ts'

export default defineConfig({
  entry: 'src/index.ts',
  format: ['esm', 'cjs'],
  dts: true,
  exports: {
    customExports: dualPackageExports,
  },
  clean: true,
  platform: 'node',
  external: [
    '@xlt-token/core',
    '@xlt-token/nestjs',
    '@nestjs/common',
    '@nestjs/core',
    'reflect-metadata',
    'rxjs',
    'express',
    'jsonwebtoken',
    'uuid',
  ],
})
