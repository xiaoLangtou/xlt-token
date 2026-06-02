import * as express from "express";
import { Request as Request$1, Response } from "express";
import { HttpContext, XltMode } from "@xlt-token/core";

//#region src/context.d.ts
interface ExpressLikeRequest {
  _xltState?: Record<string, any>;
  loginId?: string;
  token?: string;
}
interface ExpressLikeResponse {}
declare function createExpressContext(req: Request$1, res: Response): HttpContext;
//#endregion
//#region src/middleware/xlt-middleware.d.ts
type XltMiddlewareOptions = any;
declare class xltMiddleware {}
//#endregion
//#region src/middleware/ignore-auth.d.ts
declare const ignoreAuth: () => void;
//#endregion
//#region src/middleware/require-login.d.ts
declare const requireLogin: () => void;
//#endregion
//#region src/middleware/check-permission.d.ts
declare const checkPermission: () => void;
//#endregion
//#region src/middleware/check-role.d.ts
declare const checkRole: () => void;
//#endregion
//#region src/middleware/check-safe.d.ts
declare const checkSafe: () => void;
//#endregion
//#region src/error/xlt-error-handler.d.ts
declare class xltErrorHandler {}
//#endregion
//#region src/auth/run-auth.d.ts
declare const runAuth: (token: string) => any;
//#endregion
//#region src/auth/should-check-login.d.ts
declare const shouldCheckLogin: () => void;
//#endregion
//#region src/auth/resolve-route-auth-meta.d.ts
declare const resolveRouteAuthMeta: () => void;
//#endregion
//#region src/sync-state.d.ts
declare function syncExpressAuthState(req: Request, ctx: HttpContext): void;
//#endregion
//#region src/types.d.ts
interface RouteAuthMeta {
  ignore?: boolean;
  requireLogin?: boolean;
  permissions?: {
    list: string[];
    mode: XltMode;
  };
  roles?: {
    list: string[];
    mode: XltMode;
  };
  safeBusiness?: string;
}
type AuthMatcher = string | RegExp | ((req: express.Request) => boolean);
interface RouteAuthPolicy extends RouteAuthMeta {
  match: AuthMatcher | AuthMatcher[];
  methods?: string[];
}
declare global {
  namespace Express {
    interface Request {
      _xltState?: Record<string, unknown>;
      _xltRouteMeta?: RouteAuthMeta;
      stpLoginId?: string;
      stpToken?: string;
    }
  }
} //# sourceMappingURL=types.d.ts.map
//#endregion
export { type AuthMatcher, type ExpressLikeRequest, type ExpressLikeResponse, type RouteAuthMeta, type RouteAuthPolicy, type XltMiddlewareOptions, checkPermission, checkRole, checkSafe, createExpressContext, ignoreAuth, requireLogin, resolveRouteAuthMeta, runAuth, shouldCheckLogin, syncExpressAuthState, xltErrorHandler, xltMiddleware };
//# sourceMappingURL=index.d.mts.map