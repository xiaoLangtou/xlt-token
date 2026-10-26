import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { StpLogic } from "@xlt-token/nestjs";
import { buildTestApp } from "./fixtures/test-app.module";

describe("多端登录 (e2e)", () => {
  it("不同设备 token 均可通过 Guard 访问", async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);

    const pcToken = await stp.login("7001", { device: "pc" });
    const appToken = await stp.login("7001", { device: "app" });

    await request(app.getHttpServer())
      .get("/api/me")
      .set("authorization", pcToken)
      .expect(200, { id: "7001", token: pcToken });

    await request(app.getHttpServer())
      .get("/api/me")
      .set("authorization", appToken)
      .expect(200, { id: "7001", token: appToken });

    await app.close();
  });

  it("kickoutByDevice 只使被踢设备 token 失效", async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);

    const pcToken = await stp.login("7002", { device: "pc" });
    const appToken = await stp.login("7002", { device: "app" });

    await stp.kickoutByDevice("7002", "pc");

    const kicked = await request(app.getHttpServer())
      .get("/api/me")
      .set("authorization", pcToken)
      .expect(401);
    expect(kicked.body.type).toBe("KICK_OUT");

    await request(app.getHttpServer())
      .get("/api/me")
      .set("authorization", appToken)
      .expect(200, { id: "7002", token: appToken });

    await app.close();
  });

  it("kickoutByToken 精确踢下线", async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);

    const pcToken = await stp.login("7003", { device: "pc" });
    const appToken = await stp.login("7003", { device: "app" });

    await stp.kickoutByToken(pcToken);

    await request(app.getHttpServer()).get("/api/me").set("authorization", pcToken).expect(401);

    await request(app.getHttpServer()).get("/api/me").set("authorization", appToken).expect(200);

    await app.close();
  });

  it("isConcurrent=false 同设备顶号后旧 token → 401 BE_REPLACED", async () => {
    const { app, moduleRef } = await buildTestApp({
      config: { isConcurrent: false, isShare: false },
    });
    const stp = moduleRef.get(StpLogic);

    const t1 = await stp.login("7004", { device: "pc" });
    await stp.login("7004", { device: "pc" });

    const res = await request(app.getHttpServer())
      .get("/api/me")
      .set("authorization", t1)
      .expect(401);
    expect(res.body.type).toBe("BE_REPLACED");

    await app.close();
  });

  it("isConcurrent=false 不同设备不受影响", async () => {
    const { app, moduleRef } = await buildTestApp({
      config: { isConcurrent: false, isShare: false },
    });
    const stp = moduleRef.get(StpLogic);

    const pcToken = await stp.login("7005", { device: "pc" });
    const appToken = await stp.login("7005", { device: "app" });
    await stp.login("7005", { device: "pc" });

    await request(app.getHttpServer()).get("/api/me").set("authorization", pcToken).expect(401);

    await request(app.getHttpServer())
      .get("/api/me")
      .set("authorization", appToken)
      .expect(200, { id: "7005", token: appToken });

    await app.close();
  });

  it("deviceConcurrent=false 新登录踢掉所有设备", async () => {
    const { app, moduleRef } = await buildTestApp({
      config: { deviceConcurrent: false, isShare: false },
    });
    const stp = moduleRef.get(StpLogic);

    const pcToken = await stp.login("7006", { device: "pc" });
    const appToken = await stp.login("7006", { device: "app" });

    await request(app.getHttpServer()).get("/api/me").set("authorization", pcToken).expect(401);

    await request(app.getHttpServer()).get("/api/me").set("authorization", appToken).expect(200);

    await app.close();
  });

  it("getDeviceList 在 Nest 上下文中返回正确列表", async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);

    await stp.login("7007", { device: "pc" });
    await stp.login("7007", { device: "app" });

    const list = await stp.getDeviceList("7007");
    expect(list).toHaveLength(2);
    expect(list.map((d) => d.device).toSorted()).toEqual(["app", "pc"]);

    await app.close();
  });
});

describe("logoutByDevice (e2e)", () => {
  it("logoutByDevice 只使目标设备 token 失效", async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);

    const pcToken = await stp.login("7101", { device: "pc" });
    const appToken = await stp.login("7101", { device: "app" });

    await stp.logoutByDevice("7101", "pc");

    await request(app.getHttpServer()).get("/api/me").set("authorization", pcToken).expect(401);

    await request(app.getHttpServer())
      .get("/api/me")
      .set("authorization", appToken)
      .expect(200, { id: "7101", token: appToken });

    await app.close();
  });

  it("logoutByDevice 另一设备不受影响", async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);

    const pcToken = await stp.login("7102", { device: "pc" });
    const appToken = await stp.login("7102", { device: "app" });

    await stp.logoutByDevice("7102", "app");

    await request(app.getHttpServer())
      .get("/api/me")
      .set("authorization", pcToken)
      .expect(200, { id: "7102", token: pcToken });

    await request(app.getHttpServer()).get("/api/me").set("authorization", appToken).expect(401);

    await app.close();
  });
});

describe("观测性 API (e2e)", () => {
  it("getOnlineCount / getOnlineLoginIds 统计在线用户", async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);

    await stp.login("8001");
    await stp.login("8002");
    await stp.login("8003");

    expect(await stp.getOnlineCount()).toBe(3);

    const page0 = await stp.getOnlineLoginIds({ page: 0, pageSize: 2 });
    expect(page0).toHaveLength(2);

    const page1 = await stp.getOnlineLoginIds({ page: 1, pageSize: 2 });
    expect(page1).toHaveLength(1);

    await app.close();
  });

  it("logout 后用户不在在线列表", async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);

    const token = await stp.login("8004");
    expect(await stp.getOnlineCount()).toBe(1);

    await stp.logout(token);
    expect(await stp.getOnlineCount()).toBe(0);
    expect(await stp.getOnlineLoginIds()).toEqual([]);

    await app.close();
  });

  it("forceLogout 清空所有设备且 HTTP 请求全部 401", async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);

    const pcToken = await stp.login("8005", { device: "pc" });
    const appToken = await stp.login("8005", { device: "app" });

    await stp.forceLogout("8005");

    expect(await stp.getDeviceList("8005")).toEqual([]);

    await request(app.getHttpServer()).get("/api/me").set("authorization", pcToken).expect(401);

    await request(app.getHttpServer()).get("/api/me").set("authorization", appToken).expect(401);

    await app.close();
  });
});

describe("Audit events (e2e)", () => {
  it("forRoot eventSink 在登录时触发 token.logged_in", async () => {
    const emit = vi.fn();
    const { app, moduleRef } = await buildTestApp({ eventSink: { emit } });
    const stp = moduleRef.get(StpLogic);

    const token = await stp.login("9001", { device: "pc" });
    expect(JSON.stringify(emit.mock.calls)).not.toContain(token);
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "token.logged_in", loginId: "9001", device: "pc" }),
    );

    await app.close();
  });

  it("forRoot eventSink 在 kickoutByDevice 时触发 token.kicked_out", async () => {
    const emit = vi.fn();
    const { app, moduleRef } = await buildTestApp({ eventSink: { emit } });
    const stp = moduleRef.get(StpLogic);

    const token = await stp.login("9002", { device: "pc" });
    await stp.kickoutByDevice("9002", "pc");
    expect(JSON.stringify(emit.mock.calls)).not.toContain(token);
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "token.kicked_out", loginId: "9002", device: "pc" }),
    );

    await app.close();
  });

  it("事件投递异常不影响登录主流程", async () => {
    const emit = vi.fn(() => {
      throw new Error("event failed");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { app, moduleRef } = await buildTestApp({ eventSink: { emit } });
    const stp = moduleRef.get(StpLogic);

    const token = await stp.login("9003");
    expect(token).toBeTruthy();

    await request(app.getHttpServer()).get("/api/me").set("authorization", token).expect(200);

    consoleSpy.mockRestore();
    await app.close();
  });
});

describe("会话管理增强 (e2e)", () => {
  it("getSessionList 返回脱敏会话且分页正确", async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);

    const pcToken = await stp.login("9101", { device: "pc", ip: "10.0.0.1" });
    const appToken = await stp.login("9101", { device: "app", ip: "10.0.0.2" });

    const page = await stp.getSessionList("9101", { page: 0, pageSize: 1 });
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);
    expect(JSON.stringify(page)).not.toContain(pcToken);
    expect(JSON.stringify(page)).not.toContain(appToken);
    expect(page.items[0]).toMatchObject({
      device: expect.any(String),
      loginTime: expect.any(Number),
      tokenFingerprint: expect.stringMatching(/^[0-9a-f]{16}$/),
    });

    await app.close();
  });

  it("getSessionList 支持按设备、IP、时间过滤与排序", async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);

    await stp.login("9102", { device: "pc", ip: "10.0.0.1" });
    await stp.login("9102", { device: "app", ip: "10.0.0.2" });
    await stp.login("9102", { device: "h5", ip: "10.0.0.3" });

    const byIp = await stp.getSessionList("9102", { ip: "10.0.0.2" });
    expect(byIp.total).toBe(1);
    expect(byIp.items[0].device).toBe("app");

    const byDevices = await stp.getSessionList("9102", { device: ["pc", "h5"] });
    expect(byDevices.total).toBe(2);

    const sorted = await stp.getSessionList("9102", { sortBy: "device", sortOrder: "asc" });
    expect(sorted.items.map((s) => s.device)).toEqual(["app", "h5", "pc"]);

    await app.close();
  });

  it("kickoutByDevices 批量踢下线且 HTTP 请求 401", async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);

    const pcToken = await stp.login("9103", { device: "pc" });
    const appToken = await stp.login("9103", { device: "app" });
    const h5Token = await stp.login("9103", { device: "h5" });

    await expect(stp.kickoutByDevices("9103", ["pc", "app", "missing"])).resolves.toBe(2);

    await request(app.getHttpServer()).get("/api/me").set("authorization", pcToken).expect(401);
    await request(app.getHttpServer()).get("/api/me").set("authorization", appToken).expect(401);
    await request(app.getHttpServer())
      .get("/api/me")
      .set("authorization", h5Token)
      .expect(200, { id: "9103", token: h5Token });

    await app.close();
  });

  it("logoutByDevices 批量登出且 HTTP 请求 401", async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);

    const pcToken = await stp.login("9104", { device: "pc" });
    const appToken = await stp.login("9104", { device: "app" });

    await expect(stp.logoutByDevices("9104", ["pc", "app"])).resolves.toBe(2);

    await request(app.getHttpServer()).get("/api/me").set("authorization", pcToken).expect(401);
    await request(app.getHttpServer()).get("/api/me").set("authorization", appToken).expect(401);

    await app.close();
  });

  it("kickoutByLoginIds / logoutByLoginIds 批量处理多账号", async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);

    const t1 = await stp.login("9105", { device: "pc" });
    const t2 = await stp.login("9106", { device: "pc" });
    const t3 = await stp.login("9107", { device: "pc" });

    await expect(stp.kickoutByLoginIds(["9105", "9106", "no-such-user"])).resolves.toBe(2);
    await expect(stp.logoutByLoginIds(["9107"])).resolves.toBe(1);

    await request(app.getHttpServer()).get("/api/me").set("authorization", t1).expect(401);
    await request(app.getHttpServer()).get("/api/me").set("authorization", t2).expect(401);
    await request(app.getHttpServer()).get("/api/me").set("authorization", t3).expect(401);

    await app.close();
  });

  it("批量下线触发审计事件", async () => {
    const emit = vi.fn();
    const { app, moduleRef } = await buildTestApp({ eventSink: { emit } });
    const stp = moduleRef.get(StpLogic);

    await stp.login("9108", { device: "pc" });
    await stp.login("9108", { device: "app" });

    await stp.kickoutByDevices("9108", ["pc", "app"]);

    expect(emit.mock.calls.filter(([e]) => e.type === "token.kicked_out")).toHaveLength(2);

    await app.close();
  });
});
