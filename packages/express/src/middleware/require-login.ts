import type { RequestHandler } from 'express';

/**
 * 路由级 helper：标记当前路由需要登录（白名单模式下开启校验）。
 *
 * 仅写入 `req._xltRouteMeta`，必须位于 `xltMiddleware` 之前才生效。
 */
export function requireLogin(): RequestHandler {
  return (req, _res, next) => {
    req._xltRouteMeta = { ...req._xltRouteMeta, requireLogin: true };
    next();
  };
}
