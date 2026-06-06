import type { Request } from 'express';
import type { AuthResult, HttpContext, XltTokenContext } from '@xlt-token/core';

/**
 * 编排登录 + 权限 + 角色 + 二级认证校验。
 *
 * 与 `XltTokenGuard.canActivate` 中的权限块逻辑等价：
 * `checkLogin` 失败时抛出 `NotLoginException`，权限/角色/safe 校验失败时分别抛出对应异常。
 */
export async function runAuth(
  xlt: XltTokenContext,
  httpCtx: HttpContext,
  req: Request,
): Promise<AuthResult> {
  const result = await xlt.stpLogic.checkLogin(httpCtx);

  const meta = req._xltRouteMeta;

  if (meta?.permissions && xlt.stpPermLogic) {
    await xlt.stpPermLogic.checkPermission(
      result.loginId!,
      meta.permissions.list,
      meta.permissions.mode,
    );
  }

  if (meta?.roles && xlt.stpPermLogic) {
    await xlt.stpPermLogic.checkRole(result.loginId!, meta.roles.list, meta.roles.mode);
  }

  if (meta?.safeBusiness) {
    await xlt.stpLogic.checkSafe(result.token!, meta.safeBusiness);
  }

  return result;
}
