import type { XltMode } from "@xlt-token/core";

export interface RouteAuthMeta {
  ignore?: boolean;
  requireLogin?: boolean;
  permissions?: { list: string[]; mode: XltMode };
  roles?: { list: string[]; mode: XltMode };
  safeBusiness?: string;
}

export type AuthMatcher = string | RegExp | ((req: import("express").Request) => boolean);

export interface RouteAuthPolicy extends RouteAuthMeta {
  match: AuthMatcher | AuthMatcher[];
  methods?: string[];
}

export interface XltMiddlewareOptions {
  /** 快捷白名单，会被转换为 { match, ignore: true } */
  ignore?: AuthMatcher[];
  /** 路由级鉴权策略。xltMiddleware 会在鉴权前解析这些规则。 */
  policies?: RouteAuthPolicy[];
}

export interface ExpressRequest {
  _xltState?: Record<string, unknown>;
  _xltRouteMeta?: RouteAuthMeta;
  stpLoginId?: string;
  stpToken?: string;
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
}
