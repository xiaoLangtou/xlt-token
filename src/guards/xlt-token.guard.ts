// 全局守卫

import { CanActivate, ExecutionContext, Inject, Injectable, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { XLT_TOKEN_CONFIG, type XltTokenConfig } from '../core/xlt-token-config';
import { StpLogic } from '../auth/stp-logic';
import { XLT_CHECK_LOGIN_KEY, XLT_IGNORE_KEY, XLT_PERMISSION_KEY, XLT_ROLE_KEY } from '../const';
import { StpPermLogic } from '../perm/stp-perm-logic';

@Injectable()
export class XltTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(XLT_TOKEN_CONFIG) private readonly config: XltTokenConfig,
    private readonly stpLogic: StpLogic,
    @Optional() private readonly stpPermLogic?: StpPermLogic,
  ) {
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.requiresLogin(context)) return true;

    const request = context.switchToHttp().getRequest();
    const result = await this.stpLogic.checkLogin(request);

    request.stpLoginId = result.loginId;
    request.stpToken = result.token;


    if (this.stpPermLogic) {


      const handler = context.getHandler();
      const cls = context.getClass();

      const permMeta = this.reflector.getAllAndOverride(XLT_PERMISSION_KEY, [handler, cls]);
      if (permMeta) {
        await this.stpPermLogic.checkPermission(result.loginId!, permMeta.permissions, permMeta.mode);
      }

      const roleMeta = this.reflector.getAllAndOverride(XLT_ROLE_KEY, [handler, cls]);
      if (roleMeta) {
        await this.stpPermLogic.checkRole(result.loginId!, roleMeta.roles, roleMeta.mode);
      }
    }

    return true;
  }

  private requiresLogin(context: ExecutionContext): boolean {
    const isIgnored = this.reflector.getAllAndOverride<boolean>(XLT_IGNORE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // defaultCheck=true 模式：默认需要登录，@XltIgnore 跳过
    if (this.config.defaultCheck) {
      return !isIgnored;
    }

    // defaultCheck=false 模式：默认不需要登录，@XltCheckLogin 开启
    const shouldCheck = this.reflector.getAllAndOverride<boolean>(XLT_CHECK_LOGIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return shouldCheck ?? false;
  }
}
