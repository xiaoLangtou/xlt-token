// 全局守卫

import { CanActivate, ExecutionContext, Inject, Injectable, Optional } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  type AuthResult,
  StpLogic,
  StpPermLogic,
  XLT_CHECK_LOGIN_KEY,
  XLT_IGNORE_KEY,
  XLT_PERMISSION_KEY,
  XLT_ROLE_KEY,
  XLT_TOKEN_CONFIG,
  type XltTokenConfig,
} from "@xlt-token/core";
import { XLT_CHECK_SAFE_KEY } from "../decorators/xlt-check-safe.decorator.js";
import { createNestHttpContext, rethrowCoreAuthException } from "../http/nest-bridge.js";

@Injectable()
export class XltTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(XLT_TOKEN_CONFIG) private readonly config: XltTokenConfig,
    private readonly stpLogic: StpLogic,
    @Optional() private readonly stpPermLogic?: StpPermLogic,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.requiresLogin(context)) return true;

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    let result: AuthResult;
    try {
      result = await this.stpLogic.checkLogin(createNestHttpContext(request, response));
    } catch (error) {
      rethrowCoreAuthException(error);
    }

    const business = this.getBusiness(context);
    request.stpLoginId = result.loginId;
    request.stpToken = result.token;

    try {
      if (this.stpPermLogic) {
        const handler = context.getHandler();
        const cls = context.getClass();

        const permMeta = this.reflector.getAllAndOverride(XLT_PERMISSION_KEY, [handler, cls]);
        if (permMeta) {
          await this.stpPermLogic.checkPermission(
            result.loginId!,
            permMeta.permissions,
            permMeta.mode,
          );
        }

        const roleMeta = this.reflector.getAllAndOverride(XLT_ROLE_KEY, [handler, cls]);
        if (roleMeta) {
          await this.stpPermLogic.checkRole(result.loginId!, roleMeta.roles, roleMeta.mode);
        }
      }

      if (business) {
        await this.stpLogic.checkSafe(result.token!, business);
      }
    } catch (error) {
      rethrowCoreAuthException(error);
    }

    return true;
  }

  private requiresLogin(context: ExecutionContext): boolean {
    const isIgnored = this.reflector.getAllAndOverride<boolean>(XLT_IGNORE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (this.config.defaultCheck) {
      return !isIgnored;
    }

    const shouldCheck = this.reflector.getAllAndOverride<boolean>(XLT_CHECK_LOGIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return shouldCheck ?? false;
  }

  private getBusiness(context: ExecutionContext): string {
    return this.reflector.getAllAndOverride<string>(XLT_CHECK_SAFE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  }
}
