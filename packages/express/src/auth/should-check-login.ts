import type { Request } from 'express';
import type { XltTokenConfig } from '@xlt-token/core';

/**
 * 是否需要对当前请求执行登录校验。
 *
 * 与 NestJS `XltTokenGuard.requiresLogin` 行为一致：
 * - 黑名单模式（`defaultCheck === true`）：除被 `ignore` 标记的路由外全部校验
 * - 白名单模式（`defaultCheck === false`）：仅校验被 `requireLogin` 标记的路由
 *
 * 路由元数据由 `resolveRouteAuthMeta` 提前写入 `req._xltRouteMeta`。
 */
export function shouldCheckLogin(req: Request, config: XltTokenConfig): boolean {
  const meta = req._xltRouteMeta;

  if (config.defaultCheck) {
    return !meta?.ignore;
  }

  return meta?.requireLogin ?? false;
}
