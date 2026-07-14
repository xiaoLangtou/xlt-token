import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createTestApp, type TestApp } from "./fixtures/create-app.js";

async function login(app: Express, userId = "1001", device?: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ userId, device }).expect(200);
  return res.body.token as string;
}

describe("Express adapter (e2e)", () => {
  let ctx: TestApp;
  let app: Express;

  beforeAll(() => {
    ctx = createTestApp();
    app = ctx.app;
  });

  describe("忽略策略 / 公开路由", () => {
    it("ignore 策略：无 token 访问 /api/public → 200", () =>
      request(app).get("/api/public").expect(200, { ok: true }));

    it("ignore 策略：带 query 的公开路由仍放行", () =>
      request(app).get("/api/public?from=e2e").expect(200, { ok: true }));

    it("ignore 策略：近似前缀 /api/publicity 不应被 /api/public 放行", async () => {
      const res = await request(app).get("/api/publicity").expect(401);
      expect(res.body).toMatchObject({ code: "NOT_LOGIN", type: "NOT_TOKEN" });
    });

    it("登录接口公开：无 token 即可签发 token", async () => {
      const res = await request(app).post("/api/auth/login").send({ userId: "1001" }).expect(200);
      expect(typeof res.body.token).toBe("string");
      expect(res.body.token.length).toBeGreaterThan(0);
    });
  });

  describe("登录校验", () => {
    it("无 token 访问 /api/me → 401 NOT_TOKEN", async () => {
      const res = await request(app).get("/api/me").expect(401);
      expect(res.body).toMatchObject({ statusCode: 401, code: "NOT_LOGIN", type: "NOT_TOKEN" });
    });

    it("无效 token → 401 INVALID_TOKEN", async () => {
      const res = await request(app).get("/api/me").set("authorization", "garbage").expect(401);
      expect(res.body.type).toBe("INVALID_TOKEN");
    });

    it("有效 token → 200 且同步 loginId / token 到 req", async () => {
      const token = await login(app, "1001");
      const res = await request(app).get("/api/me").set("authorization", token).expect(200);
      expect(res.body).toEqual({ id: "1001", token });
    });

    it("logout 后旧 token → 401 INVALID_TOKEN", async () => {
      const token = await login(app, "1001");
      await request(app).get("/api/me").set("authorization", token).expect(200);
      await ctx.xlt.stpLogic.logout(token);
      const res = await request(app).get("/api/me").set("authorization", token).expect(401);
      expect(res.body.type).toBe("INVALID_TOKEN");
    });
  });

  describe("权限校验", () => {
    it("有权限（order:* 命中 order:read）→ 200", async () => {
      const token = await login(app, "1001");
      await request(app).get("/api/order").set("authorization", token).expect(200, { ok: true });
    });

    it("无权限访问 /api/admin → 403 NOT_PERMISSION", async () => {
      const token = await login(app, "1001");
      const res = await request(app).get("/api/admin").set("authorization", token).expect(403);
      expect(res.body).toMatchObject({ statusCode: 403, code: "NOT_PERMISSION" });
      expect(res.body.permission).toContain("admin:write");
    });

    it("普通用户无 order:read → 403", async () => {
      const token = await login(app, "2002");
      await request(app).get("/api/order").set("authorization", token).expect(403);
    });
  });

  describe("角色校验", () => {
    it("admin 角色访问 /api/role-admin → 200", async () => {
      const token = await login(app, "1001");
      await request(app).get("/api/role-admin").set("authorization", token).expect(200);
    });

    it("无角色 → 403 NOT_ROLE", async () => {
      const token = await login(app, "2002");
      const res = await request(app).get("/api/role-admin").set("authorization", token).expect(403);
      expect(res.body.code).toBe("NOT_ROLE");
    });
  });

  describe("二级认证（safe）", () => {
    it("未开启安全窗口 → 403 NOT_SAFE", async () => {
      const token = await login(app, "1001");
      const res = await request(app).post("/api/pay").set("authorization", token).expect(403);
      expect(res.body.code).toBe("NOT_SAFE");
      expect(res.body.business).toBe("pay");
    });

    it("开启安全窗口后 → 200", async () => {
      const token = await login(app, "1001");
      await ctx.xlt.stpLogic.openSafe(token, "pay", 300);
      await request(app).post("/api/pay").set("authorization", token).expect(200, { ok: true });
    });
  });

  describe("下线场景", () => {
    it("kickout 后旧 token → 401 KICK_OUT", async () => {
      const token = await login(app, "3003");
      await ctx.xlt.stpLogic.kickout("3003");
      const res = await request(app).get("/api/me").set("authorization", token).expect(401);
      expect(res.body.type).toBe("KICK_OUT");
    });

    it("被顶号后旧 token → 401 BE_REPLACED（isConcurrent=false）", async () => {
      const { app: app2, xlt } = createTestApp({ isConcurrent: false, isShare: false });
      const t1 = await login(app2, "5005");
      await login(app2, "5005"); // 同账号再次登录顶掉旧 token
      const res = await request(app2).get("/api/me").set("authorization", t1).expect(401);
      expect(res.body.type).toBe("BE_REPLACED");
      void xlt;
    });
  });

  describe("白名单模式", () => {
    it("defaultCheck=false 时未标记 requireLogin 的路由放行", async () => {
      const { app: wlApp } = createTestApp({ defaultCheck: false });
      await request(wlApp).get("/api/me").expect(200);
    });
  });

  describe("路由级 helper", () => {
    it("ignoreAuth 在真实 route chain 中放行无 token 请求", () =>
      request(app).get("/helper/public").expect(200, { ok: true }));

    it("requireLogin 在白名单模式中要求登录", async () => {
      const { app: wlApp } = createTestApp({ defaultCheck: false });
      const res = await request(wlApp).get("/helper/required").expect(401);
      expect(res.body).toMatchObject({ code: "NOT_LOGIN", type: "NOT_TOKEN" });

      const token = await login(wlApp, "1001");
      await request(wlApp)
        .get("/helper/required")
        .set("authorization", token)
        .expect(200, { id: "1001", token });
    });

    it("checkPermission 在真实 route chain 中执行权限校验", async () => {
      const adminToken = await login(app, "1001");
      await request(app)
        .get("/helper/order")
        .set("authorization", adminToken)
        .expect(200, { ok: true });

      const userToken = await login(app, "2002");
      const res = await request(app)
        .get("/helper/order")
        .set("authorization", userToken)
        .expect(403);
      expect(res.body.code).toBe("NOT_PERMISSION");
    });

    it("checkRole 在真实 route chain 中执行角色校验", async () => {
      const adminToken = await login(app, "1001");
      await request(app)
        .get("/helper/role-admin")
        .set("authorization", adminToken)
        .expect(200, { ok: true });

      const userToken = await login(app, "2002");
      const res = await request(app)
        .get("/helper/role-admin")
        .set("authorization", userToken)
        .expect(403);
      expect(res.body.code).toBe("NOT_ROLE");
    });

    it("checkSafe 在真实 route chain 中执行二级认证校验", async () => {
      const token = await login(app, "7007");
      const res = await request(app).post("/helper/pay").set("authorization", token).expect(403);
      expect(res.body).toMatchObject({ code: "NOT_SAFE", business: "pay" });

      await ctx.xlt.stpLogic.openSafe(token, "pay", 300);
      await request(app).post("/helper/pay").set("authorization", token).expect(200, { ok: true });
    });
  });
});
