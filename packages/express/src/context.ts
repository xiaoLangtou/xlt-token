import type { Request, Response } from 'express';
import type { HttpContext } from '@xlt-token/core';

export interface ExpressLikeRequest {
  _xltState?: Record<string, any>;
  loginId?: string;
  token?: string;
}

export interface ExpressLikeResponse {

}

export function createExpressContext(req: Request, res: Response): HttpContext {
  const state = ((req as ExpressLikeRequest)._xltState ??= {});

  return {
    headers: {
      get: (name) => (req.headers[name.toLowerCase()] as string) ?? null,
    },

    cookies: {
      get: (name) => (req as ExpressLikeRequest).cookies?.[name] ?? null,
    },

    query: {
      get: (name) => (req.query[name] as string) ?? null,
    },
    state,
    setHeader: (name: string, value: string) => {
      return res.setHeader(name, value);
    },
    setCookie: (name: string, value: string, options?: any) => {
      return res.cookie(name, value, options);
    },
    raw: () => req as unknown as ExpressLikeResponse,
  };
}
