import { describe, expect, it } from "vitest";
import type { Request } from "express";
import type { XltTokenConfig } from "@xlt-token/core";
import type { RouteAuthMeta } from "../src/types.js";
import { shouldCheckLogin } from "../src/auth/should-check-login.js";

function mockReq(meta?: RouteAuthMeta): Request {
  return { _xltRouteMeta: meta } as unknown as Request;
}

function config(defaultCheck: boolean): XltTokenConfig {
  return { defaultCheck } as XltTokenConfig;
}

describe("shouldCheckLogin", () => {
  describe("黑名单模式（defaultCheck = true）", () => {
    it("无元数据时需要校验", () => {
      expect(shouldCheckLogin(mockReq(), config(true))).toBe(true);
    });

    it("标记 ignore 时放行", () => {
      expect(shouldCheckLogin(mockReq({ ignore: true }), config(true))).toBe(false);
    });

    it("未标记 ignore 时需要校验", () => {
      expect(shouldCheckLogin(mockReq({ requireLogin: true }), config(true))).toBe(true);
    });
  });

  describe("白名单模式（defaultCheck = false）", () => {
    it("无元数据时放行", () => {
      expect(shouldCheckLogin(mockReq(), config(false))).toBe(false);
    });

    it("标记 requireLogin 时需要校验", () => {
      expect(shouldCheckLogin(mockReq({ requireLogin: true }), config(false))).toBe(true);
    });

    it("仅声明权限、角色或二级认证时也需要校验", () => {
      expect(
        shouldCheckLogin(
          mockReq({ permissions: { list: ["user:read"], mode: "and" as never } }),
          config(false),
        ),
      ).toBe(true);
      expect(
        shouldCheckLogin(
          mockReq({ roles: { list: ["admin"], mode: "and" as never } }),
          config(false),
        ),
      ).toBe(true);
      expect(shouldCheckLogin(mockReq({ safeBusiness: "pay" }), config(false))).toBe(true);
    });

    it("仅标记 ignore 时仍放行", () => {
      expect(shouldCheckLogin(mockReq({ ignore: true }), config(false))).toBe(false);
    });
  });
});
