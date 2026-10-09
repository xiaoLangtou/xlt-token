import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import { XltMode } from "@xlt-token/core";
import { xltFastifyPlugin } from "@xlt-token/fastify";
import { createInspectorBridge, mountInspectorOnFastify } from "@xlt-token/inspector";
import type { XltInstance } from "@xlt-token/core";
import { createExampleInstance, inspectorEventBuffer } from "./config";

/**
 * 路由布局（默认黑名单模式：除 ignore 外全部需要登录）：
 * - POST /api/auth/login   公开，签发 token（Cookie 模式同时写入 Cookie）
 * - POST /api/auth/logout  需登录，登出当前设备
 * - GET  /api/user/me      需登录，回显认证上下文
 * - GET  /api/admin/stats  需角色 admin（policies）
 * - GET  /api/order        需权限 order:read（policies）
 * - POST /api/safe/pay        需二级认证 safe(pay)（policies + methods）
 * - POST /api/safe/open-pay   需登录，开启二级认证窗口（命名避开 /api/safe/pay 前缀）
 * - GET  /api/public/health 公开（ignore）
 * - GET  /inspector       官方监控台页面 + /inspector/api/* 数据接口
 *                           （路由走 ignore，鉴权由 bridge 的 auth 回调执行：
 *                            Bearer token → getLoginIdByToken → admin 角色）
 * - GET  /api/cfg/me       路由级 config.xlt.requireLogin 演示
 * - GET  /api/cfg/role-any 需角色 admin 或 ops（config.xlt + OR 模式）
 */
export async function createApp(): Promise<{ app: FastifyInstance; instance: XltInstance }> {
  const instance = await createExampleInstance();
  const app = Fastify({ logger: false });

  // Cookie 契约：isReadCookie 依赖 @fastify/cookie 的同步 request.cookies。
  // 未注册该插件时，xltFastifyPlugin 会在注册阶段直接报错。
  await app.register(cookie);
  await app.register(xltFastifyPlugin, {
    instance,
    ignore: ["/api/auth/login", "/api/public", "/inspector"],
    policies: [
      { match: "/api/admin", roles: { list: ["admin"], mode: XltMode.AND } },
      { match: "/api/order", permissions: { list: ["order:read"], mode: XltMode.AND } },
      { match: "/api/safe/pay", methods: ["POST"], safeBusiness: "pay" },
    ],
  });

  // 官方监控台：鉴权由 bridge auth 回调完成（admin 角色），演示开放踢人动作
  mountInspectorOnFastify(
    app,
    createInspectorBridge({
      instance,
      buffer: inspectorEventBuffer,
      auth: async (_request, context) => {
        if (!context.bearerToken) return false;
        const loginId = await instance.stpLogic.getLoginIdByToken(context.bearerToken);
        if (loginId == null) return false;
        return instance.stpPermLogic.hasRole(String(loginId), "admin");
      },
      allowMutations: true,
    }),
  );

  const tokenName = instance.config.tokenName;

  app.post("/api/auth/login", async (request, reply) => {
    const { userId = "1001", device } = (request.body ?? {}) as {
      userId?: string;
      device?: string;
    };
    const token = await instance.stpLogic.login(userId, device ? { device } : {});

    if (instance.config.isReadCookie) {
      void reply.setCookie(tokenName, token, { path: "/", httpOnly: true });
    }
    return { token, userId };
  });

  app.post("/api/auth/logout", async (request) => {
    await instance.stpLogic.logout(request.stpToken as string);
    return { ok: true };
  });

  app.get("/api/user/me", async (request) => ({
    loginId: request.stpLoginId,
    hasSession: Boolean(request.stpSession),
  }));

  app.get("/api/admin/stats", async () => ({
    users: 42,
    onlineSessions: await instance.stpLogic.getOnlineCount(),
  }));

  app.get("/api/order", async () => ({ orders: ["order-1001", "order-1002"] }));

  app.post("/api/safe/pay", async (request) => ({
    ok: true,
    body: request.body ?? null,
  }));

  app.post("/api/safe/open-pay", async (request) => {
    await instance.stpLogic.openSafe(request.stpToken as string, "pay", "10m");
    return { ok: true, business: "pay" };
  });

  app.get("/api/public/health", async () => ({ status: "up" }));

  app.get("/api/cfg/me", { config: { xlt: { requireLogin: true } } }, async (request) => ({
    loginId: request.stpLoginId,
  }));

  app.get(
    "/api/cfg/role-any",
    {
      config: {
        xlt: { roles: { list: ["admin", "ops"], mode: XltMode.OR } },
      },
    },
    async (request) => ({ loginId: request.stpLoginId }),
  );

  return { app, instance };
}
