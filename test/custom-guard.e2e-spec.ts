import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { StpLogic } from '../src';
import { buildTestApp } from './fixtures/test-app.module';
import { CustomLoginGuard, guardCounters } from './fixtures/custom-login-guard';

describe('XltAbstractLoginGuard 钩子 (e2e)', () => {
  it('onAuthSuccess 在校验通过时触发', async () => {
    guardCounters.success = 0;
    guardCounters.fail = 0;

    const { app, moduleRef } = await buildTestApp({ guardClass: CustomLoginGuard });
    const token = await moduleRef.get(StpLogic).login('1001');

    await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', token)
      .expect(200);

    expect(guardCounters.success).toBe(1);
    expect(guardCounters.fail).toBe(0);

    await app.close();
  });

  it('白名单模式：无 @XltCheckLogin 装饰器 → 直接放行（不调钩子）', async () => {
    guardCounters.success = 0;
    guardCounters.fail = 0;

    const { app } = await buildTestApp({
      guardClass: CustomLoginGuard,
      defaultCheck: false,
    });

    // /api/me 没有 @XltCheckLogin → requiresLogin 走 fallback 返回 false
    await request(app.getHttpServer()).get('/api/me').expect(200);

    expect(guardCounters.success).toBe(0);
    expect(guardCounters.fail).toBe(0);

    await app.close();
  });

  it('onAuthFail 在校验失败时触发（抛异常前）', async () => {
    guardCounters.success = 0;
    guardCounters.fail = 0;

    const { app } = await buildTestApp({ guardClass: CustomLoginGuard });

    // 无 token → NOT_TOKEN
    await request(app.getHttpServer()).get('/api/me').expect(401);
    expect(guardCounters.fail).toBe(1);

    // 无效 token → INVALID_TOKEN
    await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', 'garbage')
      .expect(401);
    expect(guardCounters.fail).toBe(2);
    expect(guardCounters.success).toBe(0);

    await app.close();
  });
});
