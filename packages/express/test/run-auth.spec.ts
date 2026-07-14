import { beforeEach, describe, expect, it } from "vitest";
import type { Request } from "express";
import {
  createMockHttpContext,
  createXltToken,
  NotLoginException,
  NotPermissionException,
  NotRoleException,
  NotSafeException,
  XltMode,
  type StpInterface,
  type XltTokenContext,
} from "@xlt-token/core";
import type { RouteAuthMeta } from "../src/types.js";
import { runAuth } from "../src/auth/run-auth.js";

const stpInterface: StpInterface = {
  getPermissionList: async (loginId) => (loginId === "1001" ? ["user:read", "order:*"] : []),
  getRoleList: async (loginId) => (loginId === "1001" ? ["admin"] : []),
};

let xlt: XltTokenContext;

beforeEach(() => {
  // tokenPrefix 置空，便于直接把 token 放进 header
  xlt = createXltToken({ config: { tokenPrefix: "" }, stpInterface });
});

function reqWithMeta(meta?: RouteAuthMeta): Request {
  return { _xltRouteMeta: meta } as unknown as Request;
}

function ctxWithToken(token: string) {
  return createMockHttpContext({ headers: { authorization: token } });
}

describe("runAuth", () => {
  it("未携带 token 时抛出 NotLoginException", async () => {
    await expect(runAuth(xlt, createMockHttpContext(), reqWithMeta())).rejects.toBeInstanceOf(
      NotLoginException,
    );
  });

  it("有效 token 且无附加元数据时返回登录结果", async () => {
    const token = await xlt.stpLogic.login("1001");
    const result = await runAuth(xlt, ctxWithToken(token), reqWithMeta());
    expect(result.ok).toBe(true);
    expect(result.loginId).toBe("1001");
    expect(result.token).toBe(token);
  });

  it("权限满足时通过", async () => {
    const token = await xlt.stpLogic.login("1001");
    await expect(
      runAuth(
        xlt,
        ctxWithToken(token),
        reqWithMeta({ permissions: { list: ["user:read"], mode: XltMode.AND } }),
      ),
    ).resolves.toMatchObject({ ok: true });
  });

  it("权限不足时抛出 NotPermissionException", async () => {
    const token = await xlt.stpLogic.login("1001");
    await expect(
      runAuth(
        xlt,
        ctxWithToken(token),
        reqWithMeta({ permissions: { list: ["admin:delete"], mode: XltMode.AND } }),
      ),
    ).rejects.toBeInstanceOf(NotPermissionException);
  });

  it("角色不足时抛出 NotRoleException", async () => {
    const token = await xlt.stpLogic.login("1001");
    await expect(
      runAuth(
        xlt,
        ctxWithToken(token),
        reqWithMeta({ roles: { list: ["super"], mode: XltMode.AND } }),
      ),
    ).rejects.toBeInstanceOf(NotRoleException);
  });

  it("未开启安全窗口时抛出 NotSafeException", async () => {
    const token = await xlt.stpLogic.login("1001");
    await expect(
      runAuth(xlt, ctxWithToken(token), reqWithMeta({ safeBusiness: "pay" })),
    ).rejects.toBeInstanceOf(NotSafeException);
  });

  it("已开启安全窗口时通过", async () => {
    const token = await xlt.stpLogic.login("1001");
    await xlt.stpLogic.openSafe(token, "pay", 300);
    await expect(
      runAuth(xlt, ctxWithToken(token), reqWithMeta({ safeBusiness: "pay" })),
    ).resolves.toMatchObject({ ok: true });
  });
});
