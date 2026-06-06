import type { RequestHandler } from 'express';
import { XltMode } from '@xlt-token/core';

/**
 * 路由级 helper：声明当前路由所需角色。
 *
 * 仅写入 `req._xltRouteMeta.roles`，必须位于 `xltMiddleware` 之前才生效。
 */
export function checkRole(role: string | string[], mode: XltMode = XltMode.AND): RequestHandler {
  return (req, _res, next) => {
    const list = Array.isArray(role) ? role : [role];
    req._xltRouteMeta = {
      ...req._xltRouteMeta,
      roles: { list, mode },
    };
    next();
  };
}
