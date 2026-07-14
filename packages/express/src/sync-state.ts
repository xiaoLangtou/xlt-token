import type { Request } from "express";
import type { HttpContext } from "@xlt-token/core";

/**
 * 将鉴权成功后写入 `ctx.state` 的登录态同步到 Express `req` 上。
 *
 * core 在 `_resolveLoginId` 中写入 `ctx.state.stpLoginId` / `ctx.state.stpToken`，
 * 这里对应同步到 `req.stpLoginId` / `req.stpToken`（与 NestJS Guard 字段命名一致）。
 */
export function syncExpressAuthState(req: Request, ctx: HttpContext): void {
  const loginId = ctx.state.stpLoginId;
  const token = ctx.state.stpToken;

  if (loginId != null) {
    req.stpLoginId = String(loginId);
  }

  if (token != null) {
    req.stpToken = String(token);
  }
}
