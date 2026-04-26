import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  XltAbstractLoginGuard,
  XLT_TOKEN_CONFIG,
  type XltTokenConfig,
  StpLogic,
} from '../../src';

/** Shared counters accessible from test code */
export const guardCounters = { success: 0, fail: 0 };

@Injectable()
export class CustomLoginGuard extends XltAbstractLoginGuard {
  constructor(
    reflector: Reflector,
    @Inject(XLT_TOKEN_CONFIG) config: XltTokenConfig,
    stpLogic: StpLogic,
  ) {
    super(reflector, config, stpLogic);
  }

  protected async onAuthSuccess(result: any, req: any) {
    guardCounters.success++;
    req.user = { id: result.loginId, role: 'mocked' };
  }

  protected async onAuthFail() {
    guardCounters.fail++;
  }
}
