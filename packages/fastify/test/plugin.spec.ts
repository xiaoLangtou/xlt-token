import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  createXltInstance,
  NotLoginException,
  NotPermissionException,
  XltMode,
  type StpInterface,
  type XltInstance,
} from "@xlt-token/core";
import { xltFastifyErrorHandler, xltFastifyPlugin } from "../src/plugin.js";

const stpInterface: StpInterface = {
  getPermissionList: async (loginId) => (loginId === "1001" ? ["user:read", "order:*"] : []),
  getRoleList: async (loginId) => (loginId === "1001" ? ["admin"] : []),
};

type HookName = "onReady" | "preHandler";
type HookCallback = (...args: never[]) => unknown | Promise<unknown>;

interface MockFastify {
  addHook: (name: HookName, cb: HookCallback) => void;
  hasPlugin: (name: string) => boolean;
  hasRequestDecorator: (name: string) => boolean;
  hooks: Record<HookName, HookCallback[]>;
}

function mockFastify(decorators: { cookies?: boolean; cookiePlugin?: boolean } = {}): MockFastify {
  const hooks: Record<HookName, HookCallback[]> = { onReady: [], preHandler: [] };
  return {
    hooks,
    addHook: (name, cb) => {
      hooks[name].push(cb);
    },
    hasPlugin: (name) => Boolean(decorators.cookiePlugin) && name === "@fastify/cookie",
    hasRequestDecorator: (name) => (decorators.cookies ? name === "cookies" : false),
  };
}

interface MockRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  routeOptions?: { config?: { xlt?: Record<string, unknown> } };
}

function mockRequest(overrides: Partial<MockRequest> = {}): FastifyRequest {
  return {
    method: "GET",
    url: "/api/me",
    headers: {},
    query: {},
    ...overrides,
  } as unknown as FastifyRequest;
}

function mockReply(): FastifyReply & { _code: number; _body: unknown } {
  const reply = {
    _code: 0,
    _body: undefined,
    code(status: number) {
      reply._code = status;
      return reply;
    },
    send(body: unknown) {
      reply._body = body;
      return reply;
    },
  } as unknown as FastifyReply & { _code: number; _body: unknown };
  return reply;
}

let instance: XltInstance;

beforeEach(() => {
  instance = createXltInstance({ config: { tokenPrefix: "" }, stpInterface });
});

async function registerPlugin(fastify: MockFastify, options: Record<string, unknown> = {}) {
  await (xltFastifyPlugin as unknown as (inst: unknown, opts: unknown) => Promise<void>)(fastify, {
    instance,
    ...options,
  });
}

async function callPreHandler(
  fastify: MockFastify,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<unknown> {
  const cb = fastify.hooks.preHandler[0];
  expect(cb).toBeDefined();
  return cb(request as never, reply as never);
}

describe("xltFastifyPlugin 注册", () => {
  it("缺失 instance 时在注册阶段抛错", async () => {
    const fastify = mockFastify();
    await expect(
      (xltFastifyPlugin as unknown as (inst: unknown, opts: unknown) => Promise<void>)(fastify, {}),
    ).rejects.toThrow(/requires an explicit XltInstance/);
  });

  it("instance 缺少 stpLogic 时在注册阶段抛错", async () => {
    const fastify = mockFastify();
    await expect(
      (xltFastifyPlugin as unknown as (inst: unknown, opts: unknown) => Promise<void>)(fastify, {
        instance: { stpPermLogic: {} },
      }),
    ).rejects.toThrow(/requires an explicit XltInstance/);
  });

  it("注册 preHandler Hook", async () => {
    const fastify = mockFastify();
    await registerPlugin(fastify);
    expect(fastify.hooks.preHandler).toHaveLength(1);
  });

  it("isReadCookie 开启时注册 onReady 校验；插件就绪时不报错", async () => {
    const cookieInstance = createXltInstance({
      config: { isReadCookie: true, tokenPrefix: "" },
      stpInterface,
    });
    const fastify = mockFastify({ cookies: true, cookiePlugin: true });
    await (xltFastifyPlugin as unknown as (inst: unknown, opts: unknown) => Promise<void>)(
      fastify,
      { instance: cookieInstance },
    );
    expect(fastify.hooks.onReady).toHaveLength(1);
    await expect(fastify.hooks.onReady[0]()).resolves.toBeUndefined();
  });

  it("isReadCookie 开启且未注册 @fastify/cookie 时 onReady 报错", async () => {
    const cookieInstance = createXltInstance({
      config: { isReadCookie: true, tokenPrefix: "" },
      stpInterface,
    });
    const fastify = mockFastify();
    await (xltFastifyPlugin as unknown as (inst: unknown, opts: unknown) => Promise<void>)(
      fastify,
      { instance: cookieInstance },
    );
    await expect(fastify.hooks.onReady[0]()).rejects.toThrow(/@fastify\/cookie/);
  });
});

describe("preHandler 行为", () => {
  it("ignore 策略命中的请求直接跳过校验", async () => {
    const fastify = mockFastify();
    await registerPlugin(fastify, { ignore: ["/api/public"] });
    const request = mockRequest({ url: "/api/public" });
    const reply = mockReply();
    await expect(callPreHandler(fastify, request, reply)).resolves.toBeUndefined();
    expect(reply._code).toBe(0);
    expect(request.stpLoginId).toBeUndefined();
  });

  it("鉴权成功后同步 stpLoginId / stpToken / stpSession 到 request", async () => {
    const fastify = mockFastify();
    await registerPlugin(fastify);
    const token = await instance.stpLogic.login("1001");
    const request = mockRequest({ headers: { authorization: token } });
    const reply = mockReply();

    await callPreHandler(fastify, request, reply);

    expect(request.stpLoginId).toBe("1001");
    expect(request.stpToken).toBe(token);
    expect(request.stpSession).toBeDefined();
    expect(reply._code).toBe(0);
  });

  it("未携带 token 时回复 401 JSON（默认不抛错）", async () => {
    const fastify = mockFastify();
    await registerPlugin(fastify);
    const reply = mockReply();

    await callPreHandler(fastify, mockRequest(), reply);

    expect(reply._code).toBe(401);
    expect(reply._body).toMatchObject({ statusCode: 401, code: "TOKEN_MISSING" });
  });

  it("权限不足时回复 403 JSON", async () => {
    const fastify = mockFastify();
    await registerPlugin(fastify, {
      policies: [{ match: "/api/me", permissions: { list: ["admin:delete"], mode: XltMode.AND } }],
    });
    const token = await instance.stpLogic.login("1001");
    const request = mockRequest({ headers: { authorization: token } });
    const reply = mockReply();

    await callPreHandler(fastify, request, reply);

    expect(reply._code).toBe(403);
    expect(reply._body).toMatchObject({ statusCode: 403, code: "PERMISSION_DENIED" });
  });

  it("propagateAuthErrors: true 时把异常抛给上层 error handler", async () => {
    const fastify = mockFastify();
    await registerPlugin(fastify, { propagateAuthErrors: true });
    const reply = mockReply();

    await expect(callPreHandler(fastify, mockRequest(), reply)).rejects.toBeInstanceOf(
      NotLoginException,
    );
    expect(reply._code).toBe(0);
  });

  it("路由 config.xlt 与插件策略合并生效", async () => {
    const fastify = mockFastify();
    await registerPlugin(fastify, {
      policies: [{ match: "/api/me", requireLogin: true }],
    });
    const token = await instance.stpLogic.login("2002"); // 无 user:read 权限
    const request = mockRequest({
      headers: { authorization: token },
      routeOptions: {
        config: { xlt: { permissions: { list: ["user:read"], mode: XltMode.AND } } },
      },
    });
    const reply = mockReply();

    await callPreHandler(fastify, request, reply);

    expect(reply._code).toBe(403);
    expect(reply._body).toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("鉴权通过但策略声明的权限满足时放行", async () => {
    const fastify = mockFastify();
    await registerPlugin(fastify, {
      policies: [{ match: "/api/me", permissions: { list: ["user:read"], mode: XltMode.AND } }],
    });
    const token = await instance.stpLogic.login("1001");
    const request = mockRequest({ headers: { authorization: token } });
    const reply = mockReply();

    await callPreHandler(fastify, request, reply);

    expect(reply._code).toBe(0);
    expect(request.stpLoginId).toBe("1001");
  });
});

describe("xltFastifyErrorHandler", () => {
  it("core 鉴权异常 → 401 JSON", () => {
    const reply = mockReply();
    xltFastifyErrorHandler()(new NotLoginException("NOT_TOKEN" as never), mockRequest(), reply);
    expect(reply._code).toBe(401);
    expect(reply._body).toMatchObject({ code: "TOKEN_MISSING" });
  });

  it("非 xlt-token 异常透传给默认处理", () => {
    const reply = mockReply();
    const error = new Error("boom");
    xltFastifyErrorHandler()(error, mockRequest(), reply);
    expect(reply._body).toBe(error);
  });

  it("权限异常 → 403 JSON（与 preHandler 直接回复一致）", () => {
    const reply = mockReply();
    xltFastifyErrorHandler()(
      new NotPermissionException("admin:write", XltMode.AND),
      mockRequest(),
      reply,
    );
    expect(reply._code).toBe(403);
    expect(reply._body).toMatchObject({ code: "PERMISSION_DENIED" });
  });
});
