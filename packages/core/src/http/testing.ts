import type { HttpContext } from './context.js';

export interface MockHttpContextOptions {
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
  query?: Record<string, string>;
  state?: Record<string, unknown>;
}

export function createMockHttpContext(options: MockHttpContextOptions = {}): HttpContext {
  const state = options.state ?? {};

  return {
    headers: {
      get(name: string) {
        const value = options.headers?.[name.toLowerCase()];
        if (value == null) return null;
        return Array.isArray(value) ? value[0] ?? null : value;
      },
    },
    cookies: {
      get(name: string) {
        return options.cookies?.[name] ?? null;
      },
    },
    query: {
      get(name: string) {
        return options.query?.[name] ?? null;
      },
    },
    state,
    setHeader() {},
    setCookie() {},
    raw: () => options,
  };
}
