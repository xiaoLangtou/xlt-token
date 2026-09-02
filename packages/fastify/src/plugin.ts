import fastifyPlugin from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { HttpContext, XltInstance } from "@xlt-token/core";
import { createFastifyContext } from "./context.js";
import { mapXltError } from "./map-xlt-error.js";
import {
  mergeRouteAuthMeta,
  resolveRouteAuthMeta,
  resolveRouteConfigMeta,
  shouldCheckLogin,
} from "./resolve-auth-meta.js";
import { runAuth } from "./run-auth.js";
import type { XltFastifyOptions } from "./types.js";

const MISSING_INSTANCE_ERROR =
  "xltFastifyPlugin requires an explicit XltInstance. Create one with createXltInstance() and pass it via register options: fastify.register(xltFastifyPlugin, { instance }).";

const COOKIE_PLUGIN_MISSING_ERROR =
  "xlt-token: config.isReadCookie is enabled but the @fastify/cookie plugin is not registered. Register @fastify/cookie before this plugin to enable Cookie token source.";

/**
 * 将鉴权成功后的登录态同步到 Fastify request。
 *
 * core 在 `_resolveLoginId` 中写入 `ctx.state.stpLoginId` / `ctx.state.stpToken`，
 * 这里同步到 `request.stpLoginId` / `request.stpToken`（与 Express / NestJS 字段命名一致），
 * 并挂载懒加载的 `request.stpSession`。
 */
function syncFastifyAuthState(
  request: FastifyRequest,
  ctx: HttpContext,
  instance: XltInstance,
): void {
  const loginId = ctx.state.stpLoginId;
  const token = ctx.state.stpToken;

  if (loginId != null) {
    request.stpLoginId = String(loginId);
    request.stpSession = instance.stpLogic.getSession(request.stpLoginId);
  }

  if (token != null) {
    request.stpToken = String(token);
  }
}

async function xltFastify(fastify: FastifyInstance, options: XltFastifyOptions) {
  const instance = options?.instance;
  if (!instance || !instance.stpLogic || !instance.stpPermLogic) {
    throw new Error(MISSING_INSTANCE_ERROR);
  }

  // Cookie 契约：isReadCookie 依赖 @fastify/cookie 的同步 request.cookies。
  // 在 onReady（所有插件已执行、开始服务流量前）校验，注册顺序在前后都能正确检测。
  if (instance.config.isReadCookie) {
    fastify.addHook("onReady", async () => {
      if (!fastify.hasPlugin("@fastify/cookie") && !fastify.hasRequestDecorator("cookies")) {
        throw new Error(COOKIE_PLUGIN_MISSING_ERROR);
      }
    });
  }

  fastify.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    const httpCtx = createFastifyContext(request, reply);

    // 插件级策略为基准，路由 config.xlt（最贴近路由的声明）覆盖简单字段并合并权限/角色
    const meta = mergeRouteAuthMeta(
      resolveRouteAuthMeta(request, options),
      resolveRouteConfigMeta(request),
    );

    if (!shouldCheckLogin(meta, instance.config.defaultCheck)) return;

    try {
      await runAuth(instance, httpCtx, meta);
      syncFastifyAuthState(request, httpCtx, instance);
    } catch (err) {
      if (options?.propagateAuthErrors) throw err;

      const mapped = mapXltError(err);
      if (mapped) {
        reply.code(mapped.status).send(mapped.body);
        return;
      }
      throw err;
    }
  });
}

/**
 * xlt-token 的 Fastify 插件。
 *
 * 通过 `preHandler` Hook 完成登录 / 权限 / 角色 / 二级认证校验，
 * 只接收显式 `XltInstance`，不读取默认实例或 `StpUtil`。
 *
 * @example
 * ```ts
 * import Fastify from "fastify";
 * import { createXltInstance } from "@xlt-token/core";
 * import { xltFastifyPlugin } from "@xlt-token/fastify";
 *
 * const instance = createXltInstance();
 * const app = Fastify();
 * await app.register(xltFastifyPlugin, { instance });
 * app.get("/me", async (request) => ({ id: request.stpLoginId }));
 * ```
 */
export const xltFastifyPlugin = fastifyPlugin(xltFastify, {
  name: "@xlt-token/fastify",
});

/**
 * Fastify error handler：将 core 鉴权异常转为 401 / 403 JSON，其余透传默认处理。
 * 配合 `propagateAuthErrors: true` 使用（插件抛出异常时由它统一回复）。
 *
 * @example
 * ```ts
 * app.setErrorHandler(xltFastifyErrorHandler());
 * await app.register(xltFastifyPlugin, { instance, propagateAuthErrors: true });
 * ```
 */
export function xltFastifyErrorHandler() {
  return (error: unknown, _request: FastifyRequest, reply: FastifyReply) => {
    const mapped = mapXltError(error);
    if (mapped) {
      reply.code(mapped.status).send(mapped.body);
      return;
    }
    reply.send(error);
  };
}
