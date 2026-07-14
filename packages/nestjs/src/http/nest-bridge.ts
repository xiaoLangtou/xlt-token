import {
  createExpressContext,
  type CookieOptions,
  type ExpressLikeResponse,
  NotLoginException as CoreNotLoginException,
  NotPermissionException as CoreNotPermissionException,
  NotRoleException as CoreNotRoleException,
  NotSafeException as CoreNotSafeException,
} from "@xlt-token/core";
import { NotLoginException } from "../exceptions/not-login.exception.js";
import { NotPermissionException } from "../exceptions/not-permission.exception.js";
import { NotRoleException } from "../exceptions/not-role.exception.js";
import { NotSafeException } from "../exceptions/not-safe.exception.js";

/**
 * Fastify reply 的写回 API 与 Express response 不同：
 * - 写 header：Express 用 `res.setHeader(n, v)`，Fastify 用 `reply.header(n, v)`
 * - 写 cookie：Express 用 `res.cookie(n, v, o)`，Fastify 用 `reply.setCookie(n, v, o)`
 *
 * 这里把任意一种 response 归一化成 core 期望的 {@link ExpressLikeResponse} 形态，
 * 让核心层无需感知底层 HTTP 平台。读取侧（headers/cookies/query）两个平台形态一致，
 * 直接复用 core 的 createExpressContext。
 */
function normalizeResponse(res: any): ExpressLikeResponse {
  return {
    setHeader(name: string, value: string): void {
      if (typeof res?.setHeader === "function") {
        // Express response / 原生 Node 响应
        res.setHeader(name, value);
      } else if (typeof res?.header === "function") {
        // Fastify reply
        res.header(name, value);
      } else {
        throw new Error(
          "xlt-token: 当前 response 不支持写入 header（既无 setHeader 也无 header 方法）",
        );
      }
    },
    cookie(name: string, value: string, options?: CookieOptions): void {
      if (typeof res?.cookie === "function") {
        // Express response（或已注册 @fastify/cookie 暴露的 cookie 别名）
        res.cookie(name, value, options);
      } else if (typeof res?.setCookie === "function") {
        // Fastify reply + @fastify/cookie 插件
        res.setCookie(name, value, options);
      } else {
        throw new Error(
          "xlt-token: 当前 response 不支持写入 cookie。" +
            "若使用 Fastify，请先注册 @fastify/cookie 插件。",
        );
      }
    },
  };
}

export function createNestHttpContext(req: any, res: any) {
  return createExpressContext(req, normalizeResponse(res));
}

export function rethrowCoreAuthException(error: unknown): never {
  if (error instanceof CoreNotLoginException) {
    throw new NotLoginException(error.type, error.token);
  }
  if (error instanceof CoreNotPermissionException) {
    throw new NotPermissionException(error.permission, error.mode);
  }
  if (error instanceof CoreNotRoleException) {
    throw new NotRoleException(error.role, error.mode);
  }
  if (error instanceof CoreNotSafeException) {
    throw new NotSafeException(error.business);
  }
  throw error;
}
