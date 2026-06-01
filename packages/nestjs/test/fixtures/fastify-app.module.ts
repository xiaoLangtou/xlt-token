import { Controller, Get, type Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  LoginId,
  TokenValue,
  XltIgnore,
  type XltTokenConfig,
  XltTokenGuard,
  XltTokenModule,
} from '@xlt-token/nestjs';
import { MockStpInterface } from './mock-stp-interface';

@Controller('api')
export class FastifyDemoController {
  @XltIgnore()
  @Get('public')
  pub() {
    return { ok: true };
  }

  @Get('me')
  me(@LoginId() id: string, @TokenValue() token: string) {
    return { id, token };
  }
}

export interface FastifyBuildOpts {
  config?: Partial<XltTokenConfig>;
  extraProviders?: Provider[];
  /** 是否注册 @fastify/cookie 插件 */
  withCookie?: boolean;
}

export async function buildFastifyTestApp(opts: FastifyBuildOpts = {}) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      XltTokenModule.forRoot({
        isGlobal: true,
        config: {
          tokenName: 'authorization',
          tokenPrefix: '',
          defaultCheck: true,
          ...opts.config,
        },
        stpInterface: MockStpInterface,
      }),
    ],
    controllers: [FastifyDemoController],
    providers: [
      { provide: APP_GUARD, useClass: XltTokenGuard },
      ...(opts.extraProviders ?? []),
    ],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );

  if (opts.withCookie) {
    const cookie = await import('@fastify/cookie');
    await app.register(cookie.default ?? cookie);
  }

  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return { app, moduleRef };
}
