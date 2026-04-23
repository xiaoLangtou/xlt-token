import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { XLT_TOKEN_CONFIG, XltTokenConfig } from '../core/xlt-token-config';
import { StpLogic } from '../auth/stp-logic';
import { NotLoginException } from '../exceptions/not-login.exception';
import { NotLoginType, XLT_CHECK_LOGIN_KEY, XLT_IGNORE_KEY } from '../const';


@Injectable()
export abstract class XltAbstractLoginGuard implements CanActivate {
  protected constructor(
    protected readonly reflector: Reflector,
    @Inject(XLT_TOKEN_CONFIG) protected readonly config: XltTokenConfig,
    protected readonly stpLogic: StpLogic,
  ) {}


  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!this.requiresLogin(ctx)) return true;


    const request = ctx.switchToHttp().getRequest();
    const result = await this.stpLogic.checkLogin(request);

    if (!result.ok) {
      await this.onAuthFail?.(result, request);
      throw new NotLoginException(result.reason ?? NotLoginType.NOT_TOKEN);
    }

    request.stpLoginId = result.loginId;
    request.stpToken = result.token;
    // 钩子：业务层加载用户、填 request.user
    await this.onAuthSuccess?.(result, request);
    return true;
  }

  protected requiresLogin(ctx: ExecutionContext): boolean {
    const isIgnored = this.reflector.getAllAndOverride<boolean>(XLT_IGNORE_KEY, [ctx.getHandler(), ctx.getClass()]);

    if (this.config.defaultCheck) return !isIgnored;

    return this.reflector.getAllAndOverride<boolean>(XLT_CHECK_LOGIN_KEY, [ctx.getHandler(), ctx.getClass()]) ?? false;
  }


  /** 校验通过后回调。业务层在此注入 user 信息、记日志等 */
  protected onAuthSuccess?(
    result: {
      ok: boolean;
      loginId?: string | undefined;
      token?: string | undefined;
      reason?: NotLoginType | undefined;
    },
    request: any,
  ): void | Promise<void>;

  /** 校验失败后回调（抛异常前），可记录日志等 */
  protected onAuthFail?(
    result: {
      ok: boolean;
      loginId?: string | undefined;
      token?: string | undefined;
      reason?: NotLoginType | undefined;
    },
    request: any,
  ): void | Promise<void>;

}
