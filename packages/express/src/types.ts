import type { XltMode } from '@xlt-token/core';

export interface RouteAuthMeta {
  ignore?: boolean;
  requireLogin?: boolean;
  permissions?: { list: string[]; mode: XltMode };
  roles?: { list: string[]; mode: XltMode };
  safeBusiness?: string;
}

export type AuthMatcher =
  | string
  | RegExp
  | ((req: import('express').Request) => boolean);

export interface RouteAuthPolicy extends RouteAuthMeta {
  match: AuthMatcher | AuthMatcher[];
  methods?: string[];
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
