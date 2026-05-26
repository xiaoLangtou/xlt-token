import { Controller, Get, type Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  LoginId,
  TokenValue,
  XltCheckLogin,
  XltCheckPermission,
  XltCheckRole,
  XltCheckSafe,
  XltIgnore,
  XltMode,
  type XltTokenConfig,
  XltTokenGuard,
  XltTokenModule,
} from '@xlt-token/nestjs';
import type { TokenStrategy, XltHooks } from '@xlt-token/core';
import { MockStpInterface } from './mock-stp-interface';

@Controller('api')
export class DemoController {
  @XltIgnore()
  @Get('public')
  pub() {
    return { ok: true };
  }

  @Get('me')
  me(@LoginId() id: string, @TokenValue() token: string) {
    return { id, token };
  }

  @XltCheckPermission('user:read')
  @Get('read')
  read() {
    return { action: 'read' };
  }

  @XltCheckPermission(['user:read', 'user:delete'], { mode: XltMode.AND })
  @Get('delete')
  del() {
    return { action: 'delete' };
  }

  @XltCheckPermission('order:create')
  @Get('wildcard')
  wild() {
    return { action: 'wild' };
  }

  @XltCheckRole('admin')
  @Get('admin')
  admin() {
    return { action: 'admin' };
  }

  @XltCheckRole(['admin', 'super'], { mode: XltMode.OR })
  @Get('admin-or')
  adminOr() {
    return { action: 'admin-or' };
  }

  @XltCheckLogin()
  @Get('whitelisted')
  whitelisted(@LoginId() id: string) {
    return { id };
  }

  @XltCheckSafe('pay')
  @Get('safe/pay')
  safePay() {
    return { action: 'pay' };
  }
}

export interface BuildOpts {
  defaultCheck?: boolean;
  extraProviders?: Provider[];
  guardClass?: any;
  /** 额外的配置覆盖（如 isConcurrent / isShare / activeTimeout 等） */
  config?: Partial<XltTokenConfig>;
  hooks?: XltHooks;
  /** Token 策略，如 JwtStrategy */
  strategy?: { useClass: new (...args: any[]) => TokenStrategy };
}

export async function buildTestApp(opts: BuildOpts = {}) {
  const guardClass = opts.guardClass ?? XltTokenGuard;

  const moduleRef = await Test.createTestingModule({
    imports: [
      XltTokenModule.forRoot({
        isGlobal: true,
        strategy: opts.strategy,
        config: {
          tokenName: 'authorization',
          tokenPrefix: '',
          defaultCheck: opts.defaultCheck ?? true,
          ...opts.config,
        },
        stpInterface: MockStpInterface,
        hooks: opts.hooks,
      }),
    ],
    controllers: [DemoController],
    providers: [
      { provide: APP_GUARD, useClass: guardClass },
      ...(opts.extraProviders ?? []),
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return { app, moduleRef };
}
