import { Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  StpLogic,
  XLT_TOKEN_CONFIG,
  XltAbstractLoginGuard,
  type XltTokenConfig,
} from "@xlt-token/nestjs";
import { DEMO_USERS } from "../stp/demo-stp-interface";

/** 内存用户缓存，演示 onAuthSuccess 加载 request.user */
const userCache = new Map<string, { id: string; username: string }>();

export function cacheUserOnLogin(loginId: string, username: string) {
  userCache.set(loginId, { id: loginId, username });
}

@Injectable()
export class BusinessLoginGuard extends XltAbstractLoginGuard {
  constructor(
    reflector: Reflector,
    @Inject(XLT_TOKEN_CONFIG) config: XltTokenConfig,
    stpLogic: StpLogic,
  ) {
    super(reflector, config, stpLogic);
  }

  protected async onAuthSuccess(result: { loginId?: string }, request: any) {
    const loginId = result.loginId!;
    const cached = userCache.get(loginId);
    const username =
      cached?.username ??
      (loginId === DEMO_USERS.admin.loginId
        ? "admin"
        : loginId === DEMO_USERS.user.loginId
          ? "user"
          : loginId);

    request.user = {
      id: loginId,
      username,
      loadedBy: "BusinessLoginGuard",
    };
  }

  protected async onAuthFail(result: { reason?: string }, request: any) {
    console.warn("[auth.fail]", { reason: result.reason, path: request.url });
  }
}
