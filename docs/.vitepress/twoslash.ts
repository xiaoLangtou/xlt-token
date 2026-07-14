/**
 * Twoslash 虚拟 import 片段
 * @see https://github.com/vueuse/vueuse/blob/main/packages/.vitepress/twoslash.ts
 *
 * 在代码块中通过 `// @include: imports` 注入，配合 `// ---cut---` 隐藏样板 import。
 */
export const FILE_IMPORTS = `import type {
  StpInterface,
  TokenStrategy,
  XltHooks,
  XltTokenConfig,
  XltTokenStore,
} from '@xlt-token/core'
import type {
  XltTokenModuleAsyncOptions,
  XltTokenModuleOptions,
} from '@xlt-token/nestjs'
import {
  DEFAULT_XLT_TOKEN_CONFIG,
  MemoryStore,
  StpLogic,
  StpUtil,
  XltMode,
} from '@xlt-token/core'
import {
  JwtStrategy,
  LoginId,
  RedisStore,
  TokenValue,
  XLT_REDIS_CLIENT,
  XltAbstractLoginGuard,
  XltCheckLogin,
  XltCheckPermission,
  XltCheckRole,
  XltCheckSafe,
  XltIgnore,
  XltTokenGuard,
  XltTokenModule,
  NotLoginException,
  NotPermissionException,
  NotRoleException,
} from '@xlt-token/nestjs'
import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Post,
  Req,
} from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { Reflector } from '@nestjs/core'`;
