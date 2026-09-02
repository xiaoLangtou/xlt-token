import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import { createXltInstance, MemoryStore, XltMode } from "@xlt-token/core";
import type { StpInterface, XltInstance, XltTokenConfig } from "@xlt-token/core";
import { xltFastifyPlugin } from "../../src/index.js";

/**
 * 权限/角色数据源：
 * - 1001：拥有 user:read、order:*（含 order:read）与 admin 角色
 * - 其他：无任何权限/角色
 */
const stpInterface: StpInterface = {
  getPermissionList: async (loginId) => (loginId === "1001" ? ["user:read", "order:*"] : []),
  getRoleList: async (loginId) => (loginId === "1001" ? ["admin"] : []),
};

export interface TestApp {
  app: FastifyInstance;
  instance: XltInstance;
}

export interface TestAppOptions {
  config?: Partial<XltTokenConfig>;
  store?: TestApp["instance"]["store"];
  strategy?: TestApp["instance"]["strategy"];
  /** 是否注册 @fastify/cookie（默认 true，Cookie 场景可显式关闭做配置级测试） */
  withCookiePlugin?: boolean;
  /** 是否注册 @fastify/cookie，默认跟随 withCookiePlugin */
  propagateAuthErrors?: boolean;
}

/**
 * 构建与文档「Plugin + policies」最佳实践一致的 Fastify 应用。
 * 路由（默认黑名单模式）：
 * - POST /api/auth/login  公开，签发 token
 * - GET  /api/public      公开（ignore）
 * - GET  /api/publicity   普通受保护路由，用于防止 /api/public 前缀误匹配
 * - GET  /api/me           需登录，回显 stpLoginId / stpToken
 * - GET  /api/admin        需权限 admin:write（policies）
 * - GET  /api/order        需权限 order:read（policies）
 * - GET  /api/role-admin   需角色 admin（policies）
 * - POST /api/pay          需二级认证 safe(pay)（policies）
 * - GET  /api/cfg/me       需登录（路由 config.xlt.requireLogin）
 * - GET  /api/cfg/order    需权限 order:read（路由 config.xlt.permissions）
 * - GET  /api/cfg/role-admin 需角色 admin（路由 config.xlt.roles）
 * - POST /api/cfg/pay      需 safe pay（路由 config.xlt.safeBusiness）
 * - GET  /api/cfg/open     公开（路由 config.xlt.ignore）
 */
export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const instance = createXltInstance({
    config: { tokenPrefix: "", ...options.config },
    store: options.store ?? new MemoryStore(),
    strategy: options.strategy,
    stpInterface,
  });

  const app = Fastify();
  if (options.withCookiePlugin !== false) {
    await app.register(cookie);
  }

  await app.register(xltFastifyPlugin, {
    instance,
    propagateAuthErrors: options.propagateAuthErrors,
    ignore: ["/api/auth/login", "/api/public"],
    policies: [
      { match: "/api/admin", permissions: { list: ["admin:write"], mode: XltMode.AND } },
      { match: "/api/order", permissions: { list: ["order:read"], mode: XltMode.AND } },
      { match: "/api/role-admin", roles: { list: ["admin"], mode: XltMode.AND } },
      { match: "/api/pay", safeBusiness: "pay" },
    ],
  });

  app.post("/api/auth/login", async (request) => {
    const { userId = "1001", device } = (request.body ?? {}) as {
      userId?: string;
      device?: string;
    };
    const token = await instance.stpLogic.login(userId, device ? { device } : {});
    return { token };
  });

  app.get("/api/public", async () => ({ ok: true }));
  app.get("/api/publicity", async () => ({ ok: true }));

  app.get("/api/me", async (request) => ({
    id: request.stpLoginId,
    token: request.stpToken,
    hasSession: request.stpSession != null,
  }));

  app.get("/api/admin", async () => ({ ok: true }));
  app.get("/api/order", async () => ({ ok: true }));
  app.get("/api/role-admin", async () => ({ ok: true }));
  app.post("/api/pay", async () => ({ ok: true }));

  // 路由 config.xlt 声明风格
  app.get("/api/cfg/me", { config: { xlt: { requireLogin: true } } }, async (request) => ({
    id: request.stpLoginId,
    token: request.stpToken,
  }));
  app.get(
    "/api/cfg/order",
    { config: { xlt: { permissions: { list: ["order:read"], mode: XltMode.AND } } } },
    async () => ({ ok: true }),
  );
  app.get(
    "/api/cfg/role-admin",
    { config: { xlt: { roles: { list: ["admin"], mode: XltMode.AND } } } },
    async () => ({ ok: true }),
  );
  app.post("/api/cfg/pay", { config: { xlt: { safeBusiness: "pay" } } }, async () => ({
    ok: true,
  }));
  app.get("/api/cfg/open", { config: { xlt: { ignore: true } } }, async () => ({ ok: true }));

  return { app, instance };
}

/**
 * 构建白名单模式（defaultCheck: false）的应用：
 * 默认全部放行，只有显式声明 requireLogin 的路由才校验。
 */
export async function createWhitelistApp(): Promise<TestApp> {
  const instance = createXltInstance({
    config: { tokenPrefix: "", defaultCheck: false },
    store: new MemoryStore(),
    stpInterface,
  });

  const app = Fastify();
  await app.register(xltFastifyPlugin, { instance });

  app.post("/api/auth/login", async (request) => {
    const { userId = "1001" } = (request.body ?? {}) as { userId?: string };
    return { token: await instance.stpLogic.login(userId) };
  });

  app.get("/api/open", async () => ({ ok: true }));
  app.get("/api/required", { config: { xlt: { requireLogin: true } } }, async (request) => ({
    id: request.stpLoginId,
    token: request.stpToken,
  }));

  return { app, instance };
}
