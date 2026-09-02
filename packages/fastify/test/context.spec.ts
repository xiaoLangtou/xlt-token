import { describe, expect, it, vi } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createFastifyContext } from "../src/context.js";

interface MockRequest {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
  cookies?: Record<string, string>;
  _xltState?: Record<string, unknown>;
}

function mockRequest(overrides: Partial<MockRequest> = {}): FastifyRequest {
  return {
    headers: {},
    query: {},
    ...overrides,
  } as unknown as FastifyRequest;
}

function mockReply(): FastifyReply & { _headers: Record<string, unknown> } {
  const store: Record<string, unknown> = {};
  const reply = {
    _headers: store,
    header: vi.fn((name: string, value: unknown) => {
      store[name] = value;
      return reply;
    }),
  } as unknown as FastifyReply & { _headers: Record<string, unknown> };
  return reply;
}

describe("createFastifyContext", () => {
  describe("headers.get", () => {
    it("读取单值 / 数组首值 / 不存在返回 null", () => {
      const ctx = createFastifyContext(
        mockRequest({ headers: { authorization: "tok", "x-multi": ["a", "b"] } }),
        mockReply(),
      );
      expect(ctx.headers.get("authorization")).toBe("tok");
      expect(ctx.headers.get("AUTHORIZATION")).toBe("tok");
      expect(ctx.headers.get("x-multi")).toBe("a");
      expect(ctx.headers.get("missing")).toBeNull();
    });
  });

  describe("query.get", () => {
    it("读取字符串与数组首值", () => {
      const ctx = createFastifyContext(
        mockRequest({ query: { token: "abc", multi: ["1", "2"], num: 3 } }),
        mockReply(),
      );
      expect(ctx.query.get("token")).toBe("abc");
      expect(ctx.query.get("multi")).toBe("1");
      expect(ctx.query.get("num")).toBe("3");
      expect(ctx.query.get("missing")).toBeNull();
    });
  });

  describe("cookies.get", () => {
    it("注册 @fastify/cookie 后读取 request.cookies", () => {
      const ctx = createFastifyContext(
        mockRequest({ cookies: { authorization: "tok" } }),
        mockReply(),
      );
      expect(ctx.cookies.get("authorization")).toBe("tok");
      expect(ctx.cookies.get("missing")).toBeNull();
    });

    it("未注册插件时读取恒为 null（不抛错）", () => {
      const ctx = createFastifyContext(mockRequest(), mockReply());
      expect(ctx.cookies.get("authorization")).toBeNull();
    });
  });

  describe("state", () => {
    it("同一请求多次桥接共享同一 state 引用", () => {
      const request = mockRequest();
      const ctx1 = createFastifyContext(request, mockReply());
      const ctx2 = createFastifyContext(request, mockReply());
      expect(ctx2.state).toBe(ctx1.state);

      ctx1.state.stpLoginId = "1001";
      expect(ctx2.state.stpLoginId).toBe("1001");
      expect(request._xltState?.stpLoginId).toBe("1001");
    });
  });

  describe("setHeader", () => {
    it("写入 Fastify reply.header", () => {
      const reply = mockReply();
      const ctx = createFastifyContext(mockRequest(), reply);
      ctx.setHeader("x-custom", "value");
      expect(reply._headers["x-custom"]).toBe("value");
    });
  });

  describe("setCookie", () => {
    it("未注册 @fastify/cookie 时抛出明确错误", () => {
      const ctx = createFastifyContext(mockRequest(), mockReply());
      expect(() => ctx.setCookie("authorization", "tok")).toThrow(/@fastify\/cookie/);
    });

    it("透传 CookieOptions 到 reply.setCookie", () => {
      const setCookie = vi.fn();
      const reply = { setCookie } as unknown as FastifyReply;
      const ctx = createFastifyContext(mockRequest(), reply);
      ctx.setCookie("authorization", "tok", { httpOnly: true, path: "/", maxAge: 3600 });
      expect(setCookie).toHaveBeenCalledWith("authorization", "tok", {
        httpOnly: true,
        path: "/",
        maxAge: 3600,
      });
    });
  });
});
