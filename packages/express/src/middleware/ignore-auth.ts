import type { RequestHandler } from 'express';

/**
 * 路由级 helper：标记当前路由忽略登录校验（黑名单模式下放行）。
 *
 * 仅写入 `req._xltRouteMeta`，因此必须在同一条 route chain 中位于 `xltMiddleware` 之前才有效。
 * 推荐主路径仍是 `xltMiddleware` 的 `ignore` / `policies` 选项。
 */
export function ignoreAuth(): RequestHandler {
  return (req, _res, next) => {
    req._xltRouteMeta = { ...req._xltRouteMeta, ignore: true };
    next();
  };
}
