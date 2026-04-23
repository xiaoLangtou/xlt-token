// 全局守卫

import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { XLT_TOKEN_CONFIG, XltTokenConfig } from '../core/xlt-token-config';
import { StpLogic } from '../auth/stp-logic';
import { XLT_CHECK_LOGIN_KEY, XLT_IGNORE_KEY } from '../const';

@Injectable()
export class XltTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(XLT_TOKEN_CONFIG) private readonly config: XltTokenConfig,
    private readonly stpLogic: StpLogic,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.requiresLogin(context)) return true;

    const request = context.switchToHttp().getRequest();
    const result = await this.stpLogic.checkLogin(request);

    request.stpLoginId = result.loginId;
    request.stpToken = result.token;
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
