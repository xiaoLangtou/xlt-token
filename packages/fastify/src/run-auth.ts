import type { AuthResult, HttpContext, XltInstance } from "@xlt-token/core";
import type { XltRouteAuthMeta } from "./types.js";

/**
 * 编排登录 + 权限 + 角色 + 二级认证校验。
 *
 * 与 Express `runAuth` / NestJS `XltTokenGuard.canActivate` 的权限块逻辑等价：
 * `checkLogin` 失败抛 `NotLoginException`，权限 / 角色 / safe 校验失败分别抛对应异常。
 */
export async function runAuth(
  instance: XltInstance,
  httpCtx: HttpContext,
  meta: XltRouteAuthMeta,
): Promise<AuthResult> {
  const result = await instance.stpLogic.checkLogin(httpCtx);

  if (meta.permissions) {
    await instance.stpPermLogic.checkPermission(
      result.loginId!,
      meta.permissions.list,
      meta.permissions.mode,
    );
  }

  if (meta.roles) {
    await instance.stpPermLogic.checkRole(result.loginId!, meta.roles.list, meta.roles.mode);
  }

  if (meta.safeBusiness) {
    await instance.stpLogic.checkSafe(result.token!, meta.safeBusiness);
  }

  return result;
}
