import { describe, expect, it } from "vitest";
import { NotLoginType, XltMode } from "../../src/const/index.js";
import { NotLoginException } from "../../src/exceptions/not-login.exception.js";
import { NotPermissionException } from "../../src/exceptions/not-permission.exception.js";
import { NotRoleException } from "../../src/exceptions/not-role.exception.js";
import { NotSafeException } from "../../src/exceptions/not-safe.exception.js";
import { XltError } from "../../src/exceptions/xlt-error.js";

describe("core exceptions", () => {
  it("NotLoginException 携带 type / token / status", () => {
    const err = new NotLoginException(NotLoginType.INVALID_TOKEN, "t1");
    expect(err).toBeInstanceOf(XltError);
    expect(err.status).toBe(401);
    expect(err.type).toBe(NotLoginType.INVALID_TOKEN);
    expect(err.token).toBe("t1");
    expect(err.message).toContain("Token 无效");
  });

  it("NotLoginException 未知 type 回退默认文案", () => {
    const err = new NotLoginException("UNKNOWN" as NotLoginType);
    expect(err.message).toBe("未登录");
  });

  it("NotPermissionException / NotRoleException", () => {
    const perm = new NotPermissionException("user:read", XltMode.AND);
    expect(perm.status).toBe(403);
    expect(perm.permission).toBe("user:read");
    expect(perm.mode).toBe(XltMode.AND);

    const role = new NotRoleException(["admin"], XltMode.OR);
    expect(role.status).toBe(403);
    expect(role.role).toEqual(["admin"]);
    expect(role.mode).toBe(XltMode.OR);
  });

  it("NotSafeException", () => {
    const err = new NotSafeException("pay");
    expect(err.status).toBe(403);
    expect(err.business).toBe("pay");
  });
});
