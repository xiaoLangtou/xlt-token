import type { CookieOptions, HttpContext } from './context.js';

export interface ExpressLikeRequest {
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
  query?: Record<string, unknown>;
  _xltState?: Record<string, unknown>;
}

export interface ExpressLikeResponse {
  setHeader(name: string, value: string): void;
  cookie(name: string, value: string, options?: CookieOptions): void;
}

export function createExpressContext(
  req: ExpressLikeRequest,
  res: ExpressLikeResponse,
): HttpContext {
  req._xltState ??= {};


  return {
    headers: { get: (n) => (req.headers[n.toLowerCase()] as string) ?? null },
    cookies: { get: (n) => req.cookies?.[n] ?? null },
    query: { get: (n) => (req.query?.[n] as string) ?? null },
    state: req._xltState,
    setHeader: (n, v) => { res.setHeader(n, v); },
    setCookie: (n, v, o) => { res.cookie(n, v, o); },
    // @ts-ignore
    raw: () => req ,
  };
}
