import { describe, expect, it } from "vitest";
import { createXltInstance, MemoryStore } from "@xlt-token/core";
import { createEventBufferSink, createInspectorBridge } from "../src/index.js";
import type { InspectorRequest } from "../src/index.js";

const GET = (path: string, query?: InspectorRequest["query"]): InspectorRequest => ({
  method: "GET",
  path,
  query,
});

const POST = (
  path: string,
  body?: unknown,
  headers?: Record<string, unknown>,
): InspectorRequest => ({
  method: "POST",
  path,
  body,
  headers,
});

function setup(overrides: { allowMutations?: boolean; auth?: any; instance?: any } = {}) {
  const buffer = createEventBufferSink();
  const instance = overrides.instance ?? createXltInstance({ store: new MemoryStore() });
  const bridge = createInspectorBridge({
    instance,
    buffer,
    auth: overrides.auth ?? (async () => true),
    allowMutations: overrides.allowMutations ?? false,
  });
  return { bridge, buffer, instance };
}

describe("createInspectorBridge", () => {
  it("rejects creation without an auth function", () => {
    expect(() =>
      createInspectorBridge({
        instance: createXltInstance(),
        buffer: createEventBufferSink(),
        auth: undefined as any,
      }),
    ).toThrow(/auth/);
  });

  it("returns 403 for every route when auth denies", async () => {
    const { bridge, buffer } = setup({ auth: () => false });
    buffer.sink.emit?.({ schemaVersion: 1, type: "token.logged_in", occurredAt: 1 });

    await expect(bridge.handle(GET("/overview"))).resolves.toMatchObject({
      status: 403,
      body: { error: "forbidden" },
    });
    await expect(bridge.handle(GET("/events"))).resolves.toMatchObject({ status: 403 });
    await expect(bridge.handle(GET("/sessions"))).resolves.toMatchObject({ status: 403 });
  });

  it("passes the bearer token from Authorization headers to the auth context", async () => {
    const seen: string[] = [];
    const { bridge } = setup({
      auth: (_request, context) => {
        seen.push(context.bearerToken ?? "");
        return true;
      },
    });

    await bridge.handle(
      POST("/actions/kickout", { loginId: "u1" }, { authorization: "Bearer tok-1" }),
    );
    await bridge.handle(
      POST("/actions/kickout", { loginId: "u1" }, { authorization: ["Bearer tok-2"] }),
    );
    await bridge.handle(
      POST("/actions/kickout", { loginId: "u1" }, { authorization: "Basic xyz" }),
    );

    expect(seen).toEqual(["tok-1", "tok-2", ""]);
  });

  it("exposes instance overview with allowMutations and buffer stats", async () => {
    const { bridge, buffer } = setup({ allowMutations: true });
    buffer.sink.emit?.({ schemaVersion: 1, type: "token.logged_in", occurredAt: 1 });

    const response = await bridge.handle(GET("/overview"));
    expect(response.status).toBe(200);
    const body = response.body as any;
    expect(body.allowMutations).toBe(true);
    expect(body.onlineCount).toBe(0);
    expect(body.buffer).toMatchObject({ tracked: 1, latest: 1 });
    expect(body.instance).toMatchObject({
      strategy: "UuidStrategy",
      store: "MemoryStore",
      tokenName: "authorization",
      isReadHeader: true,
    });
  });

  it("supports lazy instance resolvers", async () => {
    const buffer = createEventBufferSink();
    const bridge = createInspectorBridge({
      instance: () => createXltInstance({ store: new MemoryStore() }),
      buffer,
      auth: () => true,
    });
    await expect(bridge.handle(GET("/overview"))).resolves.toMatchObject({ status: 200 });
  });

  it("returns incremental events with cursor semantics", async () => {
    const { bridge, buffer } = setup();
    buffer.sink.emit?.({ schemaVersion: 1, type: "token.logged_in", occurredAt: 1 });
    buffer.sink.emit?.({ schemaVersion: 1, type: "token.refreshed", occurredAt: 2 });

    const first = (await bridge.handle(GET("/events"))).body as any;
    expect(first.events).toHaveLength(2);
    expect(first.latest).toBe(2);

    buffer.sink.emit?.({ schemaVersion: 1, type: "token.logged_out", occurredAt: 3 });
    const second = (await bridge.handle(GET("/events", { after: "2" }))).body as any;
    expect(second.events.map((entry: any) => entry.type)).toEqual(["token.logged_out"]);
  });

  it("derives metric counters from the buffer", async () => {
    const { bridge, buffer } = setup();
    for (const type of [
      "token.logged_in",
      "token.logged_in",
      "token.refreshed",
      "token.logged_out",
      "token.kicked_out",
      "token.replaced",
      "token.family_revoked",
    ] as const) {
      buffer.sink.emit?.({ schemaVersion: 1, type, occurredAt: 1 });
    }

    const body = (await bridge.handle(GET("/metrics"))).body as any;
    expect(body).toMatchObject({
      loginCount: 2,
      refreshCount: 1,
      logoutCount: 1,
      anomalyCount: 3,
      window: { tracked: 7 },
    });
  });

  it("lists paginated online sessions from the real store", async () => {
    const { bridge, instance } = setup();
    await instance.stpLogic.login("u1");
    await instance.stpLogic.login("u2");
    await instance.stpLogic.login("u3");

    const page0 = (await bridge.handle(GET("/sessions", { page: "0", pageSize: "2" }))).body as any;
    expect(page0.loginIds).toHaveLength(2);
    expect(page0.total).toBe(3);

    const page1 = (await bridge.handle(GET("/sessions", { page: "1", pageSize: "2" }))).body as any;
    expect(page1.loginIds).toHaveLength(1);
  });

  it("sessions fall back to default paging when query is missing or invalid", async () => {
    const { bridge, instance } = setup();
    for (const id of ["u1", "u2", "u3"]) await instance.stpLogic.login(id);

    const body = (await bridge.handle(GET("/sessions"))).body as any;
    expect(body).toMatchObject({ page: 0, pageSize: 20, total: 3 });

    const clamped = (await bridge.handle(GET("/sessions", { page: "abc", pageSize: "xyz" })))
      .body as any;
    expect(clamped).toMatchObject({ page: 0, pageSize: 20 });
  });

  it("treats missing mutation bodies as invalid payloads", async () => {
    const { bridge } = setup({ allowMutations: true });
    await expect(bridge.handle(POST("/actions/kickout"))).resolves.toMatchObject({
      status: 400,
      body: { error: "loginId is required" },
    });
    await expect(bridge.handle(POST("/actions/logout"))).resolves.toMatchObject({ status: 400 });
  });

  it("sanitizes device tokens to fingerprints (raw token never leaves the bridge)", async () => {
    const { bridge, instance } = setup();
    const token = await instance.stpLogic.login("u1", { device: "pc" });

    const body = (await bridge.handle(GET("/session-devices", { loginId: "u1" }))).body as any;
    expect(body.devices).toHaveLength(1);
    expect(body.devices[0]).toMatchObject({ device: "pc" });
    expect(body.devices[0].tokenFingerprint).not.toBe(token);
    expect(body.devices[0]).not.toHaveProperty("token");
    expect(JSON.stringify(body)).not.toContain(token);
  });

  it("rejects session-devices without loginId", async () => {
    const { bridge } = setup();
    await expect(bridge.handle(GET("/session-devices"))).resolves.toMatchObject({
      status: 400,
      body: { error: "loginId is required" },
    });
  });

  it("blocks mutation actions by default and executes them when enabled", async () => {
    const denied = setup();
    const token = await denied.instance.stpLogic.login("u1");
    await expect(
      denied.bridge.handle(POST("/actions/kickout", { loginId: "u1" })),
    ).resolves.toMatchObject({
      status: 403,
    });
    await expect(denied.instance.stpLogic.getLoginIdByToken(token)).resolves.toBe("u1");

    const allowed = setup({ allowMutations: true });
    const token2 = await allowed.instance.stpLogic.login("u2");
    await expect(
      allowed.bridge.handle(POST("/actions/kickout", { loginId: "u2" })),
    ).resolves.toMatchObject({ status: 200, body: { ok: true } });
    await expect(allowed.instance.stpLogic.getLoginIdByToken(token2)).resolves.toBeNull();

    await allowed.instance.stpLogic.login("u3");
    await expect(
      allowed.bridge.handle(POST("/actions/logout", { loginId: "u3" })),
    ).resolves.toMatchObject({ status: 200, body: { ok: true } });
    await expect(allowed.instance.stpLogic.getOnlineCount()).resolves.toBe(0);
  });

  it("validates mutation payloads", async () => {
    const { bridge } = setup({ allowMutations: true });
    await expect(bridge.handle(POST("/actions/kickout", {}))).resolves.toMatchObject({
      status: 400,
      body: { error: "loginId is required" },
    });
    await expect(bridge.handle(POST("/actions/logout", {}))).resolves.toMatchObject({
      status: 400,
    });
  });

  it("kickout accepts an explicit device and falls back to default", async () => {
    const { bridge, instance } = setup({ allowMutations: true });
    const pc = await instance.stpLogic.login("u1", { device: "pc" });
    const def = await instance.stpLogic.login("u2");

    await expect(
      bridge.handle(POST("/actions/kickout", { loginId: "u1", device: "pc" })),
    ).resolves.toMatchObject({ status: 200, body: { ok: true } });
    await expect(instance.stpLogic.getLoginIdByToken(pc)).resolves.toBeNull();

    await expect(bridge.handle(POST("/actions/kickout", { loginId: "u2" }))).resolves.toMatchObject(
      {
        status: 200,
        body: { ok: true },
      },
    );
    await expect(instance.stpLogic.getLoginIdByToken(def)).resolves.toBeNull();
  });

  it("reads query values from arrays and falls back to the first entry", async () => {
    const { bridge, buffer } = setup();
    buffer.sink.emit?.({ schemaVersion: 1, type: "token.logged_in", occurredAt: 1 });
    buffer.sink.emit?.({ schemaVersion: 1, type: "token.refreshed", occurredAt: 2 });

    const body = (await bridge.handle(GET("/events", { after: ["1"], limit: ["5"] }))).body as any;
    expect(body.events.map((entry: any) => entry.seq)).toEqual([2]);
  });

  it("stringifies non-error rejections into 500 responses", async () => {
    const broken = createInspectorBridge({
      instance: {
        config: { tokenName: "authorization" },
        strategy: {},
        store: {},
        stpLogic: {
          getOnlineCount: () => {
            throw "boom-string";
          },
        },
      } as any,
      buffer: createEventBufferSink(),
      auth: () => true,
    });
    await expect(broken.handle(GET("/overview"))).resolves.toMatchObject({
      status: 500,
      body: { error: "boom-string" },
    });
  });

  it("returns 404 for unknown routes and 500 when handlers throw", async () => {
    const { bridge } = setup();
    await expect(bridge.handle(GET("/nope"))).resolves.toMatchObject({ status: 404 });

    const broken = createInspectorBridge({
      instance: {
        config: { tokenName: "authorization" },
        strategy: { constructor: { name: "MockStrategy" } },
        store: { constructor: { name: "MockStore" } },
        stpLogic: {
          getOnlineCount: () => {
            throw new Error("store down");
          },
        },
      } as any,
      buffer: createEventBufferSink(),
      auth: () => true,
    });
    await expect(broken.handle(GET("/overview"))).resolves.toMatchObject({
      status: 500,
      body: { error: "store down" },
    });
  });
});
