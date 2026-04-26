import { describe, it, expect } from 'vitest';
import { Controller, Get, Inject, Injectable, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  LoginId,
  StpLogic,
  XltTokenGuard,
  XltTokenModule,
} from '../src';
import { MockStpInterface } from './fixtures/mock-stp-interface';

/** 模拟项目里的 ConfigService */
@Injectable()
class FakeConfigService {
  get(key: string) {
    const map: Record<string, unknown> = {
      TOKEN_NAME: 'authorization',
      TOKEN_PREFIX: '',
      TOKEN_TIMEOUT: 3600,
      DEFAULT_CHECK: true,
    };
    return map[key];
  }
}

@Module({ providers: [FakeConfigService], exports: [FakeConfigService] })
class FakeConfigModule {}

@Controller('api')
class DemoController {
  @Get('me')
  me(@LoginId() id: string) {
    return { id };
  }
}

describe('XltTokenModule.forRootAsync (e2e)', () => {
  it('通过 useFactory + inject 异步加载配置', async () => {
    @Module({
      imports: [
        XltTokenModule.forRootAsync({
          imports: [FakeConfigModule],
          inject: [FakeConfigService],
          stpInterface: MockStpInterface,
          useFactory: (cfg: FakeConfigService) => ({
            config: {
              tokenName: cfg.get('TOKEN_NAME') as string,
              tokenPrefix: cfg.get('TOKEN_PREFIX') as string,
              timeout: cfg.get('TOKEN_TIMEOUT') as number,
              defaultCheck: cfg.get('DEFAULT_CHECK') as boolean,
            },
          }),
        }),
      ],
      controllers: [DemoController],
      providers: [{ provide: APP_GUARD, useClass: XltTokenGuard }],
    })
    class TestAsyncModule {}

    const moduleRef = await Test.createTestingModule({ imports: [TestAsyncModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const stp = moduleRef.get(StpLogic);
    const token = await stp.login('9001');

    // 异步配置生效：tokenName/prefix 被 ConfigService 提供
    await request(app.getHttpServer()).get('/api/me').expect(401);

    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', token)
      .expect(200);
    expect(res.body.id).toBe('9001');

    await app.close();
  });

  it('useFactory 返回 Promise 也能正确解析', async () => {
    @Module({
      imports: [
        XltTokenModule.forRootAsync({
          stpInterface: MockStpInterface,
          useFactory: async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return {
              config: {
                tokenName: 'authorization',
                tokenPrefix: '',
                defaultCheck: true,
              },
            };
          },
        }),
      ],
      controllers: [DemoController],
      providers: [{ provide: APP_GUARD, useClass: XltTokenGuard }],
    })
    class TestAsyncPromiseModule {}

    const moduleRef = await Test.createTestingModule({ imports: [TestAsyncPromiseModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const token = await moduleRef.get(StpLogic).login('9002');
    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', token)
      .expect(200);
    expect(res.body.id).toBe('9002');

    await app.close();
  });
});
