import { beforeEach, describe, expect, it } from "vitest";
import {
  createMockHttpContext,
  createXltInstance,
  NotLoginException,
  NotPermissionException,
  NotRoleException,
  NotSafeException,
  XltMode,
  type StpInterface,
  type XltInstance,
} from "@xlt-token/core";
import { runAuth } from "../src/run-auth.js";

const stpInterface: StpInterface = {
  getPermissionList: async (loginId) => (loginId === "1001" ? ["user:read", "order:*"] : []),
  getRoleList: async (loginId) => (loginId === "1001" ? ["admin"] : []),
};

let instance: XltInstance;

beforeEach(() => {
  instance = createXltInstance({ config: { tokenPrefix: "" }, stpInterface });
});

function ctxWithToken(token: string) {
  return createMockHttpContext({ headers: { authorization: token } });
}

describe("runAuth", () => {
  it("未携带 token 时抛出 NotLoginException", async () => {
    await expect(runAuth(instance, createMockHttpContext(), {})).rejects.toBeInstanceOf(
      NotLoginException,
    );
  });

  it("有效 token 且无附加元数据时返回登录结果", async () => {
    const token = await instance.stpLogic.login("1001");
    const result = await runAuth(instance, ctxWithToken(token), {});
    expect(result.ok).toBe(true);
    expect(result.loginId).toBe("1001");
    expect(result.token).toBe(token);
  });

  it("权限满足时通过", async () => {
    const token = await instance.stpLogic.login("1001");
    await expect(
      runAuth(instance, ctxWithToken(token), {
        permissions: { list: ["user:read"], mode: XltMode.AND },
      }),
    ).resolves.toMatchObject({ ok: true });
  });

  it("权限不足时抛出 NotPermissionException", async () => {
    const token = await instance.stpLogic.login("1001");
    await expect(
      runAuth(instance, ctxWithToken(token), {
        permissions: { list: ["admin:delete"], mode: XltMode.AND },
      }),
    ).rejects.toBeInstanceOf(NotPermissionException);
  });

  it("角色不足时抛出 NotRoleException", async () => {
    const token = await instance.stpLogic.login("1001");
    await expect(
      runAuth(instance, ctxWithToken(token), { roles: { list: ["super"], mode: XltMode.AND } }),
    ).rejects.toBeInstanceOf(NotRoleException);
  });

  it("未开启安全窗口时抛出 NotSafeException", async () => {
    const token = await instance.stpLogic.login("1001");
    await expect(
      runAuth(instance, ctxWithToken(token), { safeBusiness: "pay" }),
    ).rejects.toBeInstanceOf(NotSafeException);
  });

  it("已开启安全窗口时通过", async () => {
    const token = await instance.stpLogic.login("1001");
    await instance.stpLogic.openSafe(token, "pay", 300);
    await expect(
      runAuth(instance, ctxWithToken(token), { safeBusiness: "pay" }),
    ).resolves.toMatchObject({ ok: true });
  });
});
