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

describe("Hooks (e2e)", () => {
  it("forRoot hooks.onLogin 在登录时触发", async () => {
    const onLogin = vi.fn();
    const { app, moduleRef } = await buildTestApp({ hooks: { onLogin } });
    const stp = moduleRef.get(StpLogic);

    const token = await stp.login("9001", { device: "pc" });
    expect(onLogin).toHaveBeenCalledWith("9001", token, "pc");

    await app.close();
  });

  it("forRoot hooks.onKickout 在 kickoutByDevice 时触发", async () => {
    const onKickout = vi.fn();
    const { app, moduleRef } = await buildTestApp({ hooks: { onKickout } });
    const stp = moduleRef.get(StpLogic);

    const token = await stp.login("9002", { device: "pc" });
    await stp.kickoutByDevice("9002", "pc");
    expect(onKickout).toHaveBeenCalledWith("9002", token);

    await app.close();
  });

  it("钩子异常不影响登录主流程", async () => {
    const onLogin = vi.fn(() => {
      throw new Error("hook failed");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { app, moduleRef } = await buildTestApp({ hooks: { onLogin } });
    const stp = moduleRef.get(StpLogic);

    const token = await stp.login("9003");
    expect(token).toBeTruthy();

    await request(app.getHttpServer()).get("/api/me").set("authorization", token).expect(200);

    consoleSpy.mockRestore();
    await app.close();
  });
});
