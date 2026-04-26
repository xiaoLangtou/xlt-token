import { describe, it, expect } from 'vitest';
import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  LoginId,
  MemoryStore,
  StpLogic,
  StpPermLogic,
  UuidStrategy,
  XltCheckLogin,
  XltTokenGuard,
  XltTokenModule,
} from '../src';

@Controller('opt')
class OptController {
  @XltCheckLogin()
  @Get('me')
  me(@LoginId() id: string) {
    return { id };
  }
}

/**
 * 覆盖 XltTokenModule 中下列分支：
 * - createStoreProvider: useValue 分支
 * - createStrategyProvider: 用户传入 useClass 分支
 * - createStpInterfaceProvider: 未传 stpInterface → fallback throw
 */
describe('XltTokenModule 配置分支 (e2e)', () => {
  it('store 用 useValue 提供单例', async () => {
    const sharedStore = new MemoryStore();

    @Module({
      imports: [
        XltTokenModule.forRoot({
          isGlobal: true,
          config: { tokenName: 'authorization', tokenPrefix: '', defaultCheck: false },
          store: { useValue: sharedStore },
        }),
      ],
      controllers: [OptController],
      providers: [{ provide: APP_GUARD, useClass: XltTokenGuard }],
    })
    class M {}

    const moduleRef = await Test.createTestingModule({ imports: [M] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const stp = moduleRef.get(StpLogic);
    const token = await stp.login('100');

    // 直接用 sharedStore 验证 token 存在（确认 useValue 注入生效）
    const stored = await sharedStore.get(`authorization:login:token:${token}`);
    expect(stored).toBe('100');

    const res = await request(app.getHttpServer())
      .get('/opt/me')
      .set('authorization', token)
      .expect(200);
    expect(res.body.id).toBe('100');

    await app.close();
  });

  it('strategy 用 useClass 自定义 token 生成', async () => {
    @Module({
      imports: [
        XltTokenModule.forRoot({
          isGlobal: true,
          config: { tokenName: 'authorization', tokenPrefix: '', defaultCheck: false },
          strategy: { useClass: UuidStrategy }, // 显式传入命中 strategy?.useClass 分支
        }),
      ],
      controllers: [OptController],
      providers: [{ provide: APP_GUARD, useClass: XltTokenGuard }],
    })
    class M {}

    const moduleRef = await Test.createTestingModule({ imports: [M] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const token = await moduleRef.get(StpLogic).login('200');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);

    await app.close();
  });

  it('未传 stpInterface → 调用权限/角色方法时抛错', async () => {
    @Module({
      imports: [
        XltTokenModule.forRoot({
          isGlobal: true,
          config: { tokenName: 'authorization', tokenPrefix: '', defaultCheck: false },
          // 故意不传 stpInterface
        }),
      ],
      controllers: [OptController],
      providers: [{ provide: APP_GUARD, useClass: XltTokenGuard }],
    })
    class M {}

    const moduleRef = await Test.createTestingModule({ imports: [M] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const permLogic = moduleRef.get(StpPermLogic);

    await expect(permLogic.hasPermission('100', 'user:read')).rejects.toThrow(
      /StpInterface not registered/,
    );
    await expect(permLogic.hasRole('100', 'admin')).rejects.toThrow(
      /StpInterface not registered/,
    );

    await app.close();
  });

  it('forRootAsync 也支持 useValue store + 不传 stpInterface', async () => {
    const sharedStore = new MemoryStore();

    @Module({
      imports: [
        XltTokenModule.forRootAsync({
          store: { useValue: sharedStore },
          useFactory: () => ({
            config: { tokenName: 'authorization', tokenPrefix: '', defaultCheck: false },
          }),
        }),
      ],
      controllers: [OptController],
      providers: [{ provide: APP_GUARD, useClass: XltTokenGuard }],
    })
    class M {}

    const moduleRef = await Test.createTestingModule({ imports: [M] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const token = await moduleRef.get(StpLogic).login('300');
    const res = await request(app.getHttpServer())
      .get('/opt/me')
      .set('authorization', token)
      .expect(200);
    expect(res.body.id).toBe('300');

    await app.close();
  });
});
