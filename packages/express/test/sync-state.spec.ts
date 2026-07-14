import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { createMockHttpContext } from "@xlt-token/core";
import { syncExpressAuthState } from "../src/sync-state.js";

function mockReq(): Request {
  return {} as unknown as Request;
}

describe("syncExpressAuthState", () => {
  it("将 ctx.state 的 stpLoginId / stpToken 同步到 req", () => {
    const ctx = createMockHttpContext({ state: { stpLoginId: "1001", stpToken: "tok" } });
    const req = mockReq();
    syncExpressAuthState(req, ctx);

    expect(req.stpLoginId).toBe("1001");
    expect(req.stpToken).toBe("tok");
  });

  it("state 为空时不写入字段", () => {
    const ctx = createMockHttpContext();
    const req = mockReq();
    syncExpressAuthState(req, ctx);

    expect(req.stpLoginId).toBeUndefined();
    expect(req.stpToken).toBeUndefined();
  });

  it("数值型 loginId 会被转为字符串", () => {
    const ctx = createMockHttpContext({ state: { stpLoginId: 1001 } });
    const req = mockReq();
    syncExpressAuthState(req, ctx);

    expect(req.stpLoginId).toBe("1001");
  });
});
