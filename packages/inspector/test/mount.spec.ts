import { describe, expect, it } from "vitest";
import { createXltInstance, MemoryStore } from "@xlt-token/core";
import {
  createEventBufferSink,
  createInspectorBridge,
  mountInspectorOnExpress,
  mountInspectorOnFastify,
} from "../src/index.js";
import type { IncomingRequestLike } from "../src/index.js";

function createBridge() {
  const buffer = createEventBufferSink();
  const instance = createXltInstance({ store: new MemoryStore() });
  const bridge = createInspectorBridge({
    instance,
    buffer,
    auth: (request, context) => context.bearerToken === "admin-token",
    allowMutations: true,
  });
  return { bridge, buffer, instance };
}

interface RecordedRoute {
  method: "GET" | "POST";
  route: string;
  handler: (request: IncomingRequestLike, reply: unknown) => unknown;
}

function createRecorder() {
  const routes: RecordedRoute[] = [];
  const registry = {
    get(route: string, handler: RecordedRoute["handler"]) {
      routes.push({ method: "GET", route, handler });
    },
    post(route: string, handler: RecordedRoute["handler"]) {
      routes.push({ method: "POST", route, handler });
    },
  };
  return { routes, registry };
}

function createJsonReply() {
  const reply = {
    statusCode: 0,
    body: undefined as unknown,
    contentType: "",
    status(code: number) {
      reply.statusCode = code;
      return reply;
    },
    type(value: string) {
      reply.contentType = value;
      return reply;
    },
    send(body: unknown) {
      reply.body = body;
      return reply;
    },
  };
  return reply;
}

async function call(route: RecordedRoute | undefined, request: IncomingRequestLike) {
  const reply = createJsonReply();
  await route?.handler(request, reply);
  return reply;
}

describe.each([
  ["fastify", mountInspectorOnFastify],
  ["express", mountInspectorOnExpress],
] as const)("%s mount glue", (_name, mount) => {
  it("registers the page plus all bridge routes under the prefix", async () => {
    const { bridge } = createBridge();
    const { routes, registry } = createRecorder();
    mount(registry as any, bridge, { prefix: "/ops" });

    expect(routes.map((route) => route.method + " " + route.route)).toEqual([
      "GET /ops",
      "GET /ops/api/overview",
      "GET /ops/api/events",
      "GET /ops/api/metrics",
      "GET /ops/api/sessions",
      "GET /ops/api/session-devices",
      "POST /ops/api/actions/kickout",
      "POST /ops/api/actions/logout",
    ]);

    const page = await call(
      routes.find((route) => route.route === "/ops"),
      {},
    );
    expect(page.statusCode).toBe(0);
    expect(page.contentType).toBe("text/html; charset=utf-8");
    expect(String(page.body)).toContain("xlt-token");
    // 页面 API 调用基于 location.pathname 推导前缀（与挂载前缀对齐）
    expect(String(page.body)).toContain("location.pathname");
    expect(String(page.body)).toContain('api("/api/events');
  });

  it("uses the default /inspector prefix and forwards query/body/headers to the bridge", async () => {
    const { bridge, buffer, instance } = createBridge();
    const { routes, registry } = createRecorder();
    mount(registry as any, bridge);

    buffer.sink.emit?.({ schemaVersion: 1, type: "token.logged_in", occurredAt: 1 });
    await instance.stpLogic.login("u1", { device: "pc" });

    const denied = await call(
      routes.find((route) => route.route === "/inspector/api/overview"),
      { method: "GET", headers: { authorization: "Bearer wrong" } },
    );
    expect(denied.statusCode).toBe(403);

    const ok = await call(
      routes.find((route) => route.route === "/inspector/api/overview"),
      { method: "GET", headers: { authorization: "Bearer admin-token" } },
    );
    expect(ok.statusCode).toBe(200);
    expect((ok.body as any).onlineCount).toBe(1);

    const devices = await call(
      routes.find((route) => route.route === "/inspector/api/session-devices"),
      {
        method: "GET",
        query: { loginId: "u1" },
        headers: { authorization: "Bearer admin-token" },
      },
    );
    expect((devices.body as any).devices[0].device).toBe("pc");

    const kicked = await call(
      routes.find((route) => route.route === "/inspector/api/actions/kickout"),
      {
        method: "POST",
        body: { loginId: "u1", device: "pc" },
        headers: { authorization: "Bearer admin-token" },
      },
    );
    expect(kicked.statusCode).toBe(200);
    expect((kicked.body as any).ok).toBe(true);
  });

  it("normalizes exotic query values and default methods", async () => {
    const { bridge, buffer } = createBridge();
    const { routes, registry } = createRecorder();
    mount(registry as any, bridge);

    buffer.sink.emit?.({ schemaVersion: 1, type: "token.logged_in", occurredAt: 1 });
    buffer.sink.emit?.({ schemaVersion: 1, type: "token.refreshed", occurredAt: 2 });

    const events = await call(
      routes.find((route) => route.route === "/inspector/api/events"),
      {
        // method 省略时默认 GET；数字 query 会被字符串化
        query: { after: 0, limit: 1 },
        headers: { authorization: "Bearer admin-token" },
      },
    );
    expect(events.statusCode).toBe(200);
    expect((events.body as any).events).toHaveLength(1);
    expect((events.body as any).events[0].seq).toBe(2);

    const anonymous = await call(
      routes.find((route) => route.route === "/inspector/api/events"),
      {
        query: { after: 0 },
      },
    );
    expect(anonymous.statusCode).toBe(403);
  });
});

it("express glue falls back to setHeader when the reply has no type()", async () => {
  const { bridge } = createBridge();
  const { routes, registry } = createRecorder();
  mountInspectorOnExpress(registry as any, bridge, { prefix: "/plain" });

  const reply = {
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      reply.headers[name] = value;
    },
    send(body: unknown) {
      reply.body = body;
    },
  };

  await routes.find((route) => route.route === "/plain")?.handler({}, reply);
  expect(reply.headers["Content-Type"]).toBe("text/html; charset=utf-8");
  expect(String(reply.body)).toContain("xlt-token");
});
