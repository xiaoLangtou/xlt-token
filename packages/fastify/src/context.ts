import type { CookieOptions, HttpContext } from "@xlt-token/core";
import type { FastifyReply, FastifyRequest } from "fastify";

interface XltStateCarrier {
  _xltState?: Record<string, unknown>;
}

interface CookieCarrier {
  cookies?: Record<string, string>;
}

interface CookieReply {
  setCookie?: (name: string, value: string, options?: unknown) => void;
}

/**
 * 将 Fastify `request` / `reply` 适配为 core 的 `HttpContext`。
 *
 * - Header / Query 读取直接映射 Fastify 原生对象
 * - Cookie 读取依赖 `@fastify/cookie` 提供的同步 `request.cookies`（未注册时读取恒为 null）
 * - 写回 header 使用 `reply.header`，写回 cookie 使用 `reply.setCookie`
 *
 * `state` 挂在 `request._xltState` 上，保证同一请求多次桥接拿到同一引用
 * （与 Express 桥接的字段命名一致）。
 */
export function createFastifyContext(request: FastifyRequest, reply: FastifyReply): HttpContext {
  const state = ((request as unknown as XltStateCarrier)._xltState ??= {});

  return {
    headers: {
      get: (name) => {
        const raw = request.headers[name.toLowerCase()];
        if (raw == null) return null;
        return Array.isArray(raw) ? (raw[0] ?? null) : raw;
      },
    },

    cookies: {
      get: (name) => {
        const cookies = (request as unknown as CookieCarrier).cookies;
        const value = cookies?.[name];
        return typeof value === "string" ? value : null;
      },
    },

    query: {
      get: (name) => {
        const raw = (request.query as Record<string, unknown>)[name];
        if (raw == null) return null;
        return Array.isArray(raw) ? String(raw[0] ?? "") : String(raw);
      },
    },

    state,

    setHeader: (name, value) => {
      reply.header(name, value);
    },

    setCookie: (name, value, options) => {
      const target = reply as unknown as CookieReply;
      if (typeof target.setCookie !== "function") {
        throw new Error(
          "xlt-token: writing cookies requires the @fastify/cookie plugin. Register it before writing token cookies.",
        );
      }
      target.setCookie(name, value, options ? toFastifyCookieOptions(options) : undefined);
    },

    raw: <T = unknown>() => request as unknown as T,
  };
}

/**
 * core 的 CookieOptions 字段名与 `@fastify/cookie` 的 setCookie 选项一致
 * （maxAge 单位均为秒）。Express 特有的 `signed` 透传后由插件忽略。
 */
function toFastifyCookieOptions(options: CookieOptions): Record<string, unknown> {
  return { ...options };
}
