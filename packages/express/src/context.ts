import type { Request, Response } from 'express';
import type { HttpContext } from '@xlt-token/core';

export interface ExpressLikeRequest {
  _xltState?: Record<string, unknown>;
}

export interface ExpressLikeResponse {
  setHeader(name: string, value: string): void;
  cookie(name: string, value: string, options?: unknown): void;
}

/**
 * 将 Express `req` / `res` 适配为 core 的 `HttpContext`。
 *
 * `state` 复用挂在 `req._xltState` 上的请求级共享对象，使同一请求多次调用拿到同一引用。
 */
export function createExpressContext(req: Request, res: Response): HttpContext {
  const state = (req._xltState ??= {});

  return {
    headers: {
      get: (name) => (req.headers[name.toLowerCase()] as string) ?? null,
    },

    cookies: {
      get: (name) => (req.cookies?.[name] as string) ?? null,
    },

    query: {
      get: (name) => (req.query[name] as string) ?? null,
    },

    state,

    setHeader: (name, value) => {
      res.setHeader(name, value);
    },

    setCookie: (name, value, options) => {
      if (options) {
        res.cookie(name, value, options);
      } else {
        res.cookie(name, value);
      }
    },

    raw: <T = unknown>() => req as unknown as T,
  };
}
