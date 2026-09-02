import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { createXltInstance } from "@xlt-token/core";
import { JwtStrategy, createJwtStrategyConfig } from "@xlt-token/jwt";
import { RedisStore } from "@xlt-token/store-redis";
import { xltFastifyPlugin, xltFastifyErrorHandler } from "../src/index.js";
import { createTestApp, createWhitelistApp, type TestApp } from "./fixtures/create-app.js";
import { createFastifyContext } from "../src/index.js";

const stpInterface = {
  getPermissionList: async (loginId: string) =>
    loginId === "1001" ? ["user:read", "order:*"] : [],
  getRoleList: async (loginId: string) => (loginId === "1001" ? ["admin"] : []),
};

async function login(app: TestApp["app"], userId = "1001"): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { userId } });
  expect(res.statusCode).toBe(200);
  return res.json().token as string;
}

describe("Fastify 适配 (e2e)", () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe("配置级校验", () => {
    it("缺失显式 instance 在注册阶段报错", async () => {
      const app = Fastify();
      await expect(app.register(xltFastifyPlugin as never, {})).rejects.toThrow(
        /requires an explicit XltInstance/,
      );
      await app.close();
    });

    it("isReadCookie 未注册 @fastify/cookie 时在启动阶段报错", async () => {
      const app = Fastify();
      const instance = createXltInstance({ config: { isReadCookie: true } });
      await app.register(xltFastifyPlugin, { instance });
      await expect(app.ready()).rejects.toThrow(/@fastify\/cookie/);
      await app.close();
    });
  });

  describe("公开路由 / 忽略策略", () => {
    it("ignore 策略：无 token 访问 /api/public → 200", async () => {
      const res = await ctx.app.inject({ method: "GET", url: "/api/public" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
    });

    it("ignore 策略：带 query 的公开路由仍放行", async () => {
      const res = await ctx.app.inject({ method: "GET", url: "/api/public?from=e2e" });
      expect(res.statusCode).toBe(200);
    });

    it("近似前缀 /api/publicity 不应被 /api/public 放行", async () => {
      const res = await ctx.app.inject({ method: "GET", url: "/api/publicity" });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ code: "TOKEN_MISSING", type: "NOT_TOKEN" });
    });

    it("登录接口公开：无 token 即可签发 token", async () => {
      const res = await ctx.app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { userId: "1001" },
      });
      expect(res.statusCode).toBe(200);
      expect(typeof res.json().token).toBe("string");
    });
  });

  describe("Header Token 来源", () => {
    it("无 token 访问 /api/me → 401 NOT_TOKEN", async () => {
      const res = await ctx.app.inject({ method: "GET", url: "/api/me" });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({
        statusCode: 401,
        code: "TOKEN_MISSING",
        type: "NOT_TOKEN",
      });
    });

    it("无效 token → 401 INVALID_TOKEN", async () => {
      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/me",
        headers: { authorization: "garbage" },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().type).toBe("INVALID_TOKEN");
    });

    it("有效 token → 200 且同步 loginId / token / session 到 request", async () => {
      const token = await login(ctx.app, "1001");
      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/me",
        headers: { authorization: token },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ id: "1001", token, hasSession: true });
    });

    it("logout 后旧 token → 401 INVALID_TOKEN", async () => {
      const token = await login(ctx.app, "1001");
      await ctx.app.inject({ method: "GET", url: "/api/me", headers: { authorization: token } });
      await ctx.instance.stpLogic.logout(token);
      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/me",
        headers: { authorization: token },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().type).toBe("INVALID_TOKEN");
    });
  });

  describe("权限校验（Header 场景下）", () => {
    it("有权限（order:* 命中 order:read）→ 200", async () => {
      const token = await login(ctx.app, "1001");
      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/order",
        headers: { authorization: token },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
    });

    it("无权限访问 /api/admin → 403 NOT_PERMISSION", async () => {
      const token = await login(ctx.app, "1001");
      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/admin",
        headers: { authorization: token },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toMatchObject({ statusCode: 403, code: "PERMISSION_DENIED" });
      expect(res.json().permission).toContain("admin:write");
    });

    it("普通用户无 order:read → 403", async () => {
      const token = await login(ctx.app, "2002");
      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/order",
        headers: { authorization: token },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe("角色校验", () => {
    it("admin 角色访问 /api/role-admin → 200", async () => {
      const token = await login(ctx.app, "1001");
      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/role-admin",
        headers: { authorization: token },
      });
      expect(res.statusCode).toBe(200);
    });

    it("无角色 → 403 NOT_ROLE", async () => {
      const token = await login(ctx.app, "2002");
      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/role-admin",
        headers: { authorization: token },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe("ROLE_DENIED");
    });
  });

  describe("二级认证（safe）", () => {
    it("未开启安全窗口 → 403 NOT_SAFE", async () => {
      const token = await login(ctx.app, "1001");
      const res = await ctx.app.inject({
        method: "POST",
        url: "/api/pay",
        headers: { authorization: token },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toMatchObject({ code: "SAFE_REQUIRED", business: "pay" });
    });

    it("开启安全窗口后 → 200", async () => {
      const token = await login(ctx.app, "1001");
      await ctx.instance.stpLogic.openSafe(token, "pay", 300);
      const res = await ctx.app.inject({
        method: "POST",
        url: "/api/pay",
        headers: { authorization: token },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
    });
  });

  describe("下线场景", () => {
    it("kickout 后旧 token → 401 KICK_OUT", async () => {
      const token = await login(ctx.app, "3003");
      await ctx.instance.stpLogic.kickout("3003");
      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/me",
        headers: { authorization: token },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().type).toBe("KICK_OUT");
    });

    it("被顶号后旧 token → 401 BE_REPLACED（isConcurrent=false）", async () => {
      const { app, instance } = await createTestApp({ config: { isConcurrent: false } });
      const t1 = await login(app, "5005");
      await login(app, "5005"); // 同账号再次登录顶掉旧 token
      const res = await app.inject({
        method: "GET",
        url: "/api/me",
        headers: { authorization: t1 },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().type).toBe("BE_REPLACED");
      await app.close();
      void instance;
    });
  });

  describe("路由 config.xlt 声明风格", () => {
    it("requireLogin 路由：有效 token → 200 回显登录态", async () => {
      const token = await login(ctx.app, "1001");
      const res = await ctx.app.inject({
        method: "GET",
        url: "/api/cfg/me",
        headers: { authorization: token },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ id: "1001", token });
    });

    it("permissions 路由：有权限 → 200，无权限 → 403", async () => {
      const token = await login(ctx.app, "1001");
      const ok = await ctx.app.inject({
        method: "GET",
        url: "/api/cfg/order",
        headers: { authorization: token },
      });
      expect(ok.statusCode).toBe(200);

      const denied = await ctx.app.inject({
        method: "GET",
        url: "/api/cfg/order",
        headers: { authorization: await login(ctx.app, "2002") },
      });
      expect(denied.statusCode).toBe(403);
    });

    it("roles 路由：admin → 200，无角色 → 403", async () => {
      const token = await login(ctx.app, "1001");
      const ok = await ctx.app.inject({
        method: "GET",
        url: "/api/cfg/role-admin",
        headers: { authorization: token },
      });
      expect(ok.statusCode).toBe(200);

      const denied = await ctx.app.inject({
        method: "GET",
        url: "/api/cfg/role-admin",
        headers: { authorization: await login(ctx.app, "2002") },
      });
      expect(denied.statusCode).toBe(403);
    });

    it("safeBusiness 路由：未开启窗口 → 403，开启后 → 200", async () => {
      // 使用独立账号：默认 isShare 下同账号 login 会复用已开窗的共享 token
      const token = await login(ctx.app, "4004");
      const denied = await ctx.app.inject({
        method: "POST",
        url: "/api/cfg/pay",
        headers: { authorization: token },
      });
      expect(denied.statusCode).toBe(403);
      expect(denied.json().code).toBe("SAFE_REQUIRED");

      await ctx.instance.stpLogic.openSafe(token, "pay", 300);
      const ok = await ctx.app.inject({
        method: "POST",
        url: "/api/cfg/pay",
        headers: { authorization: token },
      });
      expect(ok.statusCode).toBe(200);
    });

    it("ignore 路由：黑名单模式下无 token 放行", async () => {
      const res = await ctx.app.inject({ method: "GET", url: "/api/cfg/open" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
    });

    it("config.xlt 覆盖插件级 policies：policies 标记 safe，路由声明 ignore → 放行", async () => {
      const instance = createXltInstance({ stpInterface });
      const app = Fastify();
      await app.register(xltFastifyPlugin, {
        instance,
        policies: [{ match: "/api/policy-safe", safeBusiness: "pay" }],
      });
      app.get("/api/policy-safe", { config: { xlt: { ignore: true } } }, async () => ({
        ok: true,
      }));
      const res = await app.inject({ method: "GET", url: "/api/policy-safe" });
      expect(res.statusCode).toBe(200);
      await app.close();
    });
  });

  describe("白名单模式（defaultCheck: false）", () => {
    it("未声明 requireLogin 的路由默认放行", async () => {
      const { app } = await createWhitelistApp();
      const res = await app.inject({ method: "GET", url: "/api/open" });
      expect(res.statusCode).toBe(200);
      await app.close();
    });

    it("requireLogin 路由仍需 token", async () => {
      const { app } = await createWhitelistApp();
      const denied = await app.inject({ method: "GET", url: "/api/required" });
      expect(denied.statusCode).toBe(401);

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { userId: "1001" },
      });
      const token = loginRes.json().token as string;
      const ok = await app.inject({
        method: "GET",
        url: "/api/required",
        headers: { authorization: token },
      });
      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toEqual({ id: "1001", token });
      await app.close();
    });
  });

  describe("propagateAuthErrors + xltFastifyErrorHandler", () => {
    it("鉴权异常抛给自定义 error handler 统一回复", async () => {
      const { app } = await createTestApp({ propagateAuthErrors: true });
      app.setErrorHandler(xltFastifyErrorHandler());
      const res = await app.inject({ method: "GET", url: "/api/me" });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ code: "TOKEN_MISSING", type: "NOT_TOKEN" });
      await app.close();
    });
  });

  describe("多实例隔离", () => {
    it("两个实例在同一进程内互不串扰（KR3）", async () => {
      const instanceA = createXltInstance({
        config: { tokenName: "a-token", tokenPrefix: "" },
        stpInterface,
      });
      const instanceB = createXltInstance({
        config: { tokenName: "b-token", tokenPrefix: "" },
        stpInterface,
      });

      const app = Fastify();
      await app.register(
        async (scope) => {
          await scope.register(xltFastifyPlugin, { instance: instanceA });
          scope.get("/me", async (request) => ({ id: request.stpLoginId }));
        },
        { prefix: "/a" },
      );
      await app.register(
        async (scope) => {
          await scope.register(xltFastifyPlugin, { instance: instanceB });
          scope.get("/me", async (request) => ({ id: request.stpLoginId }));
        },
        { prefix: "/b" },
      );
      await app.ready();

      const tokenA = await instanceA.stpLogic.login("1001");
      const tokenB = await instanceB.stpLogic.login("2002");

      const resA = await app.inject({
        method: "GET",
        url: "/a/me",
        headers: { "a-token": tokenA },
      });
      const resB = await app.inject({
        method: "GET",
        url: "/b/me",
        headers: { "b-token": tokenB },
      });
      const crossB = await app.inject({
        method: "GET",
        url: "/b/me",
        headers: { "b-token": tokenA }, // A 实例的 token 在 B 实例中无效
      });

      expect(resA.statusCode).toBe(200);
      expect(resA.json()).toEqual({ id: "1001" });
      expect(resB.statusCode).toBe(200);
      expect(resB.json()).toEqual({ id: "2002" });
      expect(crossB.statusCode).toBe(401);
      await app.close();
    });
  });
});

describe("Query Token 来源 (e2e)", () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp({ config: { isReadQuery: true } });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("query 中的 token 可通过校验", async () => {
    const token = await login(ctx.app, "1001");
    const res = await ctx.app.inject({ method: "GET", url: `/api/me?authorization=${token}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: "1001", token, hasSession: true });
  });

  it("无效 query token → 401", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/me?authorization=garbage" });
    expect(res.statusCode).toBe(401);
    expect(res.json().type).toBe("INVALID_TOKEN");
  });
});

describe("Cookie Token 来源 (e2e)", () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp({ config: { isReadCookie: true, isReadHeader: false } });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("cookie 中的 token 可通过校验", async () => {
    const token = await login(ctx.app, "1001");
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/me",
      cookies: { authorization: token },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: "1001", token, hasSession: true });
  });

  it("无 cookie → 401 NOT_TOKEN", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/me" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: "TOKEN_MISSING", type: "NOT_TOKEN" });
  });

  it("登录响应可写回 cookie（setCookie 桥接）", async () => {
    const instance = createXltInstance({
      config: { isReadCookie: true },
      stpInterface,
    });
    const app = Fastify();
    await app.register(cookie);
    await app.register(xltFastifyPlugin, { instance, ignore: ["/login"] });
    app.post("/login", async (request, reply) => {
      const token = await instance.stpLogic.login("1001");
      // 通过 core 的 setCookie 桥接写回（Fastify reply.setCookie）
      const httpCtx = createFastifyContext(request, reply);
      httpCtx.setCookie("authorization", token, { httpOnly: true, path: "/" });
      return { ok: true };
    });
    const res = await app.inject({ method: "POST", url: "/login" });
    expect(res.statusCode).toBe(200);
    // light-my-request 返回字符串、真实 Fastify 返回数组，两种形态都兼容
    const rawSetCookie = res.headers["set-cookie"];
    const setCookie = (Array.isArray(rawSetCookie) ? rawSetCookie[0] : rawSetCookie) ?? "";
    expect(setCookie).toContain("authorization=");
    expect(setCookie).toContain("HttpOnly");
    await app.close();
  });

  it("未注册 @fastify/cookie 时写 cookie 抛出明确错误", async () => {
    const instance = createXltInstance({ stpInterface });
    const app = Fastify();
    await app.register(xltFastifyPlugin, { instance, ignore: ["/login"] });
    app.post("/login", async (request, reply) => {
      const httpCtx = createFastifyContext(request, reply);
      expect(() => httpCtx.setCookie("authorization", "t")).toThrow(/@fastify\/cookie/);
      return { ok: true };
    });
    const res = await app.inject({ method: "POST", url: "/login" });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

describe("JWT Token 场景 (e2e)", () => {
  let ctx: TestApp;

  beforeAll(async () => {
    const strategy = new JwtStrategy(
      createJwtStrategyConfig({
        activeKid: "k1",
        keys: [
          { kid: "k1", algorithm: "HS256", secret: "e2e-jwt-secret-0123456789abcdef0123456789" },
        ],
      }),
    );
    ctx = await createTestApp({ strategy });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("JWT 登录 + Header 校验 + logout 黑名单", async () => {
    const token = await login(ctx.app, "1001");
    expect(String(token).split(".")).toHaveLength(3); // 是 JWT

    const ok = await ctx.app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: token },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ id: "1001", token, hasSession: true });

    await ctx.instance.stpLogic.logout(token);
    const denied = await ctx.app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: token },
    });
    expect(denied.statusCode).toBe(401);
    expect(denied.json().type).toBe("INVALID_TOKEN");
  });

  it("伪造 JWT → 401 INVALID_TOKEN", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: "fake.jwt.token" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().type).toBe("INVALID_TOKEN");
  });
});

describe("Redis Store 场景 (e2e)", () => {
  it("实例绑定 RedisStore 后登录态读写正常", async () => {
    const { createFakeRedisClient } = await import("./fixtures/fake-redis-client.js");
    const store = new RedisStore(createFakeRedisClient());
    const ctx = await createTestApp({ store });
    try {
      const token = await login(ctx.app, "1001");

      const ok = await ctx.app.inject({
        method: "GET",
        url: "/api/me",
        headers: { authorization: token },
      });
      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toEqual({ id: "1001", token, hasSession: true });

      // 权限 / 角色链路在 Redis Store 下同样工作
      const order = await ctx.app.inject({
        method: "GET",
        url: "/api/order",
        headers: { authorization: token },
      });
      expect(order.statusCode).toBe(200);

      // logout（Store 原子删除）后失效
      await ctx.instance.stpLogic.logout(token);
      const denied = await ctx.app.inject({
        method: "GET",
        url: "/api/me",
        headers: { authorization: token },
      });
      expect(denied.statusCode).toBe(401);
      expect(denied.json().type).toBe("INVALID_TOKEN");
    } finally {
      await ctx.app.close();
    }
  });
});
