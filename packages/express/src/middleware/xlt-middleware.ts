import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { XltTokenContext } from "@xlt-token/core";
import type { XltMiddlewareOptions } from "../types.js";
import { createExpressContext } from "../context.js";
import { resolveRouteAuthMeta } from "../auth/resolve-route-auth-meta.js";
import { shouldCheckLogin } from "../auth/should-check-login.js";
import { runAuth } from "../auth/run-auth.js";
import { syncExpressAuthState } from "../sync-state.js";

export type { XltMiddlewareOptions } from "../types.js";

/**
 * 全局登录校验中间件。
 *
 * 执行流程：
 * 1. `createExpressContext(req, res)`
 * 2. `resolveRouteAuthMeta` → 写入 `req._xltRouteMeta`
 * 3. `shouldCheckLogin` 判断是否需要校验，不需要则直接放行
 * 4. `runAuth`（登录 + 权限 + 角色 + safe），成功后 `syncExpressAuthState`
 * 5. 任意异常通过 `next(err)` 交给 `xltErrorHandler`
 */
export function xltMiddleware(
  xlt: XltTokenContext,
  options: XltMiddlewareOptions = {},
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const httpCtx = createExpressContext(req, res);

      req._xltRouteMeta = {
        ...req._xltRouteMeta,
        ...resolveRouteAuthMeta(req, options),
      };

      if (!shouldCheckLogin(req, xlt.config)) return next();

      await runAuth(xlt, httpCtx, req);
      syncExpressAuthState(req, httpCtx);
      next();
    } catch (err) {
      next(err);
    }
  };
}
