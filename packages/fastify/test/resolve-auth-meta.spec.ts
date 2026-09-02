import { describe, expect, it } from "vitest";
import type { FastifyRequest } from "fastify";
import { XltMode } from "@xlt-token/core";
import {
  matchPolicy,
  mergeRouteAuthMeta,
  resolveRouteAuthMeta,
  resolveRouteConfigMeta,
  shouldCheckLogin,
} from "../src/resolve-auth-meta.js";
import type { XltRoutePolicy } from "../src/types.js";

function mockRequest(url: string, method = "GET"): FastifyRequest {
  return { url, method } as unknown as FastifyRequest;
}

describe("matchPolicy", () => {
  it("字符串匹配：前缀命中（含 / 结界，不误伤近似前缀）", () => {
    expect(matchPolicy(mockRequest("/api/order"), { match: "/api" })).toBe(true);
    expect(matchPolicy(mockRequest("/api/order?x=1"), { match: "/api" })).toBe(true);
    expect(matchPolicy(mockRequest("/api"), { match: "/api" })).toBe(true);
    expect(matchPolicy(mockRequest("/api/publicity"), { match: "/api/public" })).toBe(false);
    expect(matchPolicy(mockRequest("/apiannya"), { match: "/api" })).toBe(false);
  });

  it("根路径 / 匹配所有路由", () => {
    expect(matchPolicy(mockRequest("/anything"), { match: "/" })).toBe(true);
  });

  it("正则与函数匹配器", () => {
    expect(matchPolicy(mockRequest("/api/v1/me"), { match: /^\/api\/v1\// })).toBe(true);
    expect(matchPolicy(mockRequest("/api/v2/me"), { match: /^\/api\/v1\// })).toBe(false);
    expect(matchPolicy(mockRequest("/x"), { match: (req) => req.url === "/x" })).toBe(true);
    expect(matchPolicy(mockRequest("/y"), { match: (req) => req.url === "/x" })).toBe(false);
  });

  it("match 数组：任一匹配器命中即生效", () => {
    const policy: XltRoutePolicy = { match: ["/a", "/b", /^\/c\//] };
    expect(matchPolicy(mockRequest("/a"), policy)).toBe(true);
    expect(matchPolicy(mockRequest("/b/x"), policy)).toBe(true);
    expect(matchPolicy(mockRequest("/c/d"), policy)).toBe(true);
    expect(matchPolicy(mockRequest("/d"), policy)).toBe(false);
  });

  it("methods 过滤：请求方法不在列表内不命中", () => {
    const policy: XltRoutePolicy = { match: "/api/pay", methods: ["POST"], safeBusiness: "pay" };
    expect(matchPolicy(mockRequest("/api/pay", "POST"), policy)).toBe(true);
    expect(matchPolicy(mockRequest("/api/pay", "GET"), policy)).toBe(false);
    expect(matchPolicy(mockRequest("/api/pay", "post"), policy)).toBe(true);
  });
});

describe("mergeRouteAuthMeta", () => {
  it("简单字段后者覆盖前者", () => {
    const merged = mergeRouteAuthMeta({ safeBusiness: "pay" }, { ignore: true });
    expect(merged.ignore).toBe(true);
    expect(merged.safeBusiness).toBe("pay");
  });

  it("permissions 都存在时合并列表，mode 取后者", () => {
    const merged = mergeRouteAuthMeta(
      { permissions: { list: ["a:read"], mode: XltMode.AND } },
      { permissions: { list: ["b:read"], mode: XltMode.OR } },
    );
    expect(merged.permissions).toEqual({ list: ["a:read", "b:read"], mode: XltMode.OR });
  });

  it("roles 都存在时合并列表，mode 取后者", () => {
    const merged = mergeRouteAuthMeta(
      { roles: { list: ["admin"], mode: XltMode.OR } },
      { roles: { list: ["ops"], mode: XltMode.AND } },
    );
    expect(merged.roles).toEqual({ list: ["admin", "ops"], mode: XltMode.AND });
  });

  it("仅一侧存在 permissions / roles 时保留该侧声明", () => {
    const merged = mergeRouteAuthMeta(
      { permissions: { list: ["a:read"], mode: XltMode.AND } },
      { requireLogin: true },
    );
    expect(merged.permissions).toEqual({ list: ["a:read"], mode: XltMode.AND });
  });
});

describe("resolveRouteAuthMeta", () => {
  it("ignore 快捷白名单生成 ignore 策略", () => {
    expect(resolveRouteAuthMeta(mockRequest("/api/public"), { ignore: ["/api/public"] })).toEqual({
      ignore: true,
    });
    expect(resolveRouteAuthMeta(mockRequest("/api/me"), { ignore: ["/api/public"] })).toEqual({});
  });

  it("多条策略命中时后者覆盖前者（可先声明默认再声明例外）", () => {
    const meta = resolveRouteAuthMeta(mockRequest("/api/public"), {
      policies: [
        { match: "/api", requireLogin: true },
        { match: "/api/public", ignore: true },
      ],
    });
    expect(meta.ignore).toBe(true);
    expect(meta.requireLogin).toBe(true);
  });

  it("未命中任何策略时返回空元数据", () => {
    expect(resolveRouteAuthMeta(mockRequest("/health"), { policies: [{ match: "/api" }] })).toEqual(
      {},
    );
  });
});

describe("resolveRouteConfigMeta", () => {
  it("读取路由 config.xlt 声明", () => {
    const request = {
      routeOptions: { config: { xlt: { requireLogin: true } } },
    } as unknown as FastifyRequest;
    expect(resolveRouteConfigMeta(request)).toEqual({ requireLogin: true });
  });

  it("未声明时返回空元数据", () => {
    expect(resolveRouteConfigMeta({} as FastifyRequest)).toEqual({});
    expect(
      resolveRouteConfigMeta({ routeOptions: { config: {} } } as unknown as FastifyRequest),
    ).toEqual({});
  });
});

describe("shouldCheckLogin", () => {
  it("黑名单模式（defaultCheck = true）：默认校验，ignore 放行", () => {
    expect(shouldCheckLogin({}, true)).toBe(true);
    expect(shouldCheckLogin({ ignore: true }, true)).toBe(false);
  });

  it("白名单模式（defaultCheck = false）：默认放行，requireLogin 校验", () => {
    expect(shouldCheckLogin({}, false)).toBe(false);
    expect(shouldCheckLogin({ requireLogin: true }, false)).toBe(true);
    expect(shouldCheckLogin({ ignore: true }, false)).toBe(false);
  });
});
