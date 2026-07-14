import type { RequestHandler } from "express";
import { XltMode } from "@xlt-token/core";

/**
 * 路由级 helper：声明当前路由所需权限。
 *
 * 仅写入 `req._xltRouteMeta.permissions`，必须位于 `xltMiddleware` 之前才生效。
 */
export function checkPermission(
  permission: string | string[],
  mode: XltMode = XltMode.AND,
): RequestHandler {
  return (req, _res, next) => {
    const list = Array.isArray(permission) ? permission : [permission];
    req._xltRouteMeta = {
      ...req._xltRouteMeta,
      permissions: { list, mode },
    };
    next();
  };
}
