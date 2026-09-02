import { describe, expect, it } from "vitest";
import {
  NotLoginException,
  NotLoginType,
  NotPermissionException,
  NotRoleException,
  NotSafeException,
  XltMode,
} from "@xlt-token/core";
import { mapXltError } from "../src/map-xlt-error.js";

describe("mapXltError", () => {
  it("NotLoginException → 401 + TOKEN_MISSING，且不回显原始 token", () => {
    const mapped = mapXltError(new NotLoginException(NotLoginType.NOT_TOKEN, "secret-token"));
    expect(mapped?.status).toBe(401);
    expect(mapped?.body).toMatchObject({
      statusCode: 401,
      code: "TOKEN_MISSING",
      type: NotLoginType.NOT_TOKEN,
    });
    expect(mapped?.body).not.toHaveProperty("token");
  });

  it("NotLoginException（INVALID_TOKEN）→ 401 + TOKEN_INVALID", () => {
    const mapped = mapXltError(new NotLoginException(NotLoginType.INVALID_TOKEN));
    expect(mapped?.status).toBe(401);
    expect(mapped?.body).toMatchObject({ code: "TOKEN_INVALID", type: NotLoginType.INVALID_TOKEN });
  });

  it("NotPermissionException → 403 + PERMISSION_DENIED", () => {
    const mapped = mapXltError(new NotPermissionException("admin:write", XltMode.AND));
    expect(mapped?.status).toBe(403);
    expect(mapped?.body).toMatchObject({
      statusCode: 403,
      code: "PERMISSION_DENIED",
      message: expect.stringContaining("admin:write"),
    });
  });

  it("NotRoleException → 403 + ROLE_DENIED", () => {
    const mapped = mapXltError(new NotRoleException(["admin"], XltMode.OR));
    expect(mapped?.status).toBe(403);
    expect(mapped?.body).toMatchObject({ statusCode: 403, code: "ROLE_DENIED" });
  });

  it("NotSafeException → 403 + SAFE_REQUIRED（含 business 明细）", () => {
    const mapped = mapXltError(new NotSafeException("pay"));
    expect(mapped?.status).toBe(403);
    expect(mapped?.body).toMatchObject({ statusCode: 403, code: "SAFE_REQUIRED", business: "pay" });
  });

  it("非 xlt-token 异常返回 null（交由调用方透传）", () => {
    expect(mapXltError(new Error("boom"))).toBeNull();
    expect(mapXltError(null)).toBeNull();
    expect(mapXltError(undefined)).toBeNull();
  });
});
