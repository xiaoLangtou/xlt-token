import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  NotLoginException as CoreNotLoginException,
  NotLoginType,
  StpLogic,
  XLT_CHECK_LOGIN_KEY,
  XLT_IGNORE_KEY,
  XLT_TOKEN_CONFIG,
  type XltTokenConfig,
} from '@xlt-token/core';
import { NotLoginException } from '../exceptions/not-login.exception.js';
import { createNestHttpContext } from '../http/nest-bridge.js';

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
    const response = ctx.switchToHttp().getResponse();

    let result: { ok: boolean; loginId?: string; token?: string; reason?: NotLoginType };
    try {
      result = await this.stpLogic.checkLogin(createNestHttpContext(request, response));
    } catch (err) {
      if (err instanceof CoreNotLoginException) {
        await this.onAuthFail?.({ ok: false, reason: err.type, token: err.token }, request);
        throw new NotLoginException(err.type, err.token);
      }
      throw err;
    }

    request.stpLoginId = result.loginId;
    request.stpToken = result.token;
    await this.onAuthSuccess?.(result, request);
    return true;
  }

  protected requiresLogin(ctx: ExecutionContext): boolean {
    const isIgnored = this.reflector.getAllAndOverride<boolean>(XLT_IGNORE_KEY, [ctx.getHandler(), ctx.getClass()]);

    if (this.config.defaultCheck) return !isIgnored;

    return this.reflector.getAllAndOverride<boolean>(XLT_CHECK_LOGIN_KEY, [ctx.getHandler(), ctx.getClass()]) ?? false;
  }

  protected onAuthSuccess?(
    result: {
      ok: boolean;
      loginId?: string | undefined;
      token?: string | undefined;
      reason?: NotLoginType | undefined;
    },
    request: any,
  ): void | Promise<void>;

  protected onAuthFail?(
    result: {
      ok: boolean;
      loginId?: string | undefined;
      token?: string | undefined;
      reason?: NotLoginType | undefined;
    },
    request: any,
  ): void | Promise<void>;

  protected onPermissionDenied?(
    result: {
      ok: boolean;
      loginId?: string | undefined;
      token?: string | undefined;
      reason?: NotLoginType | undefined;
    },
    request: any,
  ): void | Promise<void>;
}
