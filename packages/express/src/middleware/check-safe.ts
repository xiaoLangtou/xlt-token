import type { RequestHandler } from "express";

/**
 * 路由级 helper：声明当前路由需要二级认证安全窗口。
 *
 * 仅写入 `req._xltRouteMeta.safeBusiness`，必须位于 `xltMiddleware` 之前才生效。
 */
export function checkSafe(business: string): RequestHandler {
  return (req, _res, next) => {
    req._xltRouteMeta = { ...req._xltRouteMeta, safeBusiness: business };
    next();
  };
}
