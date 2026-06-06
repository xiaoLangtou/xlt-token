import { AuthResult, HttpContext, XltMode, XltTokenConfig, XltTokenContext } from "@xlt-token/core";
import * as express from "express";
import { ErrorRequestHandler, Request, RequestHandler, Response } from "express";

//#region src/context.d.ts
interface ExpressLikeRequest {
  _xltState?: Record<string, unknown>;
}
interface ExpressLikeResponse {
  setHeader(name: string, value: string): void;
  cookie(name: string, value: string, options?: unknown): void;
}
/**
 * 将 Express `req` / `res` 适配为 core 的 `HttpContext`。
 *
 * `state` 复用挂在 `req._xltState` 上的请求级共享对象，使同一请求多次调用拿到同一引用。
 */
declare function createExpressContext(req: Request, res: Response): HttpContext;
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
interface XltMiddlewareOptions {
  /** 快捷白名单，会被转换为 { match, ignore: true } */
  ignore?: AuthMatcher[];
  /** 路由级鉴权策略。xltMiddleware 会在鉴权前解析这些规则。 */
  policies?: RouteAuthPolicy[];
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
//#region src/middleware/xlt-middleware.d.ts
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
declare function xltMiddleware(xlt: XltTokenContext, options?: XltMiddlewareOptions): RequestHandler;
//#endregion
//#region src/middleware/ignore-auth.d.ts
/**
 * 路由级 helper：标记当前路由忽略登录校验（黑名单模式下放行）。
 *
 * 仅写入 `req._xltRouteMeta`，因此必须在同一条 route chain 中位于 `xltMiddleware` 之前才有效。
 * 推荐主路径仍是 `xltMiddleware` 的 `ignore` / `policies` 选项。
 */
declare function ignoreAuth(): RequestHandler;
//#endregion
//#region src/middleware/require-login.d.ts
/**
 * 路由级 helper：标记当前路由需要登录（白名单模式下开启校验）。
 *
 * 仅写入 `req._xltRouteMeta`，必须位于 `xltMiddleware` 之前才生效。
 */
declare function requireLogin(): RequestHandler;
//#endregion
//#region src/middleware/check-permission.d.ts
/**
 * 路由级 helper：声明当前路由所需权限。
 *
 * 仅写入 `req._xltRouteMeta.permissions`，必须位于 `xltMiddleware` 之前才生效。
 */
declare function checkPermission(permission: string | string[], mode?: XltMode): RequestHandler;
//#endregion
//#region src/middleware/check-role.d.ts
/**
 * 路由级 helper：声明当前路由所需角色。
 *
 * 仅写入 `req._xltRouteMeta.roles`，必须位于 `xltMiddleware` 之前才生效。
 */
declare function checkRole(role: string | string[], mode?: XltMode): RequestHandler;
//#endregion
//#region src/middleware/check-safe.d.ts
/**
 * 路由级 helper：声明当前路由需要二级认证安全窗口。
 *
 * 仅写入 `req._xltRouteMeta.safeBusiness`，必须位于 `xltMiddleware` 之前才生效。
 */
declare function checkSafe(business: string): RequestHandler;
//#endregion
//#region src/error/xlt-error-handler.d.ts
/**
 * 四参数 Express 错误中间件，挂在路由链末尾，将 core 鉴权异常转为 401/403 JSON。
 * 非 xlt-token 异常透传给下一个错误处理器。
 *
 * @example
 * app.use(xltErrorHandler());
 */
declare function xltErrorHandler(): ErrorRequestHandler;
//#endregion
//#region src/auth/run-auth.d.ts
/**
 * 编排登录 + 权限 + 角色 + 二级认证校验。
 *
 * 与 `XltTokenGuard.canActivate` 中的权限块逻辑等价：
 * `checkLogin` 失败时抛出 `NotLoginException`，权限/角色/safe 校验失败时分别抛出对应异常。
 */
declare function runAuth(xlt: XltTokenContext, httpCtx: HttpContext, req: Request): Promise<AuthResult>;
//#endregion
//#region src/auth/should-check-login.d.ts
/**
 * 是否需要对当前请求执行登录校验。
 *
 * 与 NestJS `XltTokenGuard.requiresLogin` 行为一致：
 * - 黑名单模式（`defaultCheck === true`）：除被 `ignore` 标记的路由外全部校验
 * - 白名单模式（`defaultCheck === false`）：仅校验被 `requireLogin` 标记的路由
 *
 * 路由元数据由 `resolveRouteAuthMeta` 提前写入 `req._xltRouteMeta`。
 */
declare function shouldCheckLogin(req: Request, config: XltTokenConfig): boolean;
//#endregion
//#region src/auth/resolve-route-auth-meta.d.ts
/**
 * 解析当前请求命中的路由鉴权元数据。
 *
 * 在 `shouldCheckLogin` 和 `runAuth` 之前调用，使用 `req.originalUrl` 作为匹配目标，
 * 避免 Router 嵌套时 `req.path` 丢失挂载前缀。
 *
 * 当多条策略同时命中时，后声明的策略覆盖前者的简单字段，并合并权限/角色列表，
 * 因此用户可先声明 `/api` 默认策略，再声明 `/api/public` 例外。
 */
declare function resolveRouteAuthMeta(req: Request, options?: XltMiddlewareOptions): RouteAuthMeta;
//#endregion
//#region src/sync-state.d.ts
/**
 * 将鉴权成功后写入 `ctx.state` 的登录态同步到 Express `req` 上。
 *
 * core 在 `_resolveLoginId` 中写入 `ctx.state.stpLoginId` / `ctx.state.stpToken`，
 * 这里对应同步到 `req.stpLoginId` / `req.stpToken`（与 NestJS Guard 字段命名一致）。
 */
declare function syncExpressAuthState(req: Request, ctx: HttpContext): void;
//#endregion
export { type AuthMatcher, type ExpressLikeRequest, type ExpressLikeResponse, type RouteAuthMeta, type RouteAuthPolicy, type XltMiddlewareOptions, checkPermission, checkRole, checkSafe, createExpressContext, ignoreAuth, requireLogin, resolveRouteAuthMeta, runAuth, shouldCheckLogin, syncExpressAuthState, xltErrorHandler, xltMiddleware };
//# sourceMappingURL=index.d.mts.map