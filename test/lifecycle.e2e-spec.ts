import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { StpLogic } from '../src';
import { buildTestApp } from './fixtures/test-app.module';

describe('Token 生命周期 (e2e)', () => {
  let app: INestApplication;
  let stp: StpLogic;

  beforeAll(async () => {
    const { app: a, moduleRef } = await buildTestApp();
    app = a;
    stp = moduleRef.get(StpLogic);
  });

  afterAll(() => app.close());

  it('logout 后旧 token → 401 INVALID_TOKEN', async () => {
    const token = await stp.login('3003');
    await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', token)
      .expect(200);

    await stp.logout(token);

    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', token)
      .expect(401);
    expect(res.body.type).toBe('INVALID_TOKEN');
  });

  it('kickout 后旧 token → 401 KICK_OUT', async () => {
    const token = await stp.login('4004');
    await stp.kickout('4004');

    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', token)
      .expect(401);
    expect(res.body.type).toBe('KICK_OUT');
  });

  it('被顶号后旧 token → 401 BE_REPLACED（真实顶号路径）', async () => {
    // 单独构建一个不允许并发登录的 app
    const { app: app2, moduleRef } = await buildTestApp({
      config: { isConcurrent: false, isShare: false },
    });
    const stp2 = moduleRef.get(StpLogic);

    const t1 = await stp2.login('5005');
    // 同账号再次登录 → 旧 token 被顶
    await stp2.login('5005');

    const res = await request(app2.getHttpServer())
      .get('/api/me')
      .set('authorization', t1)
      .expect(401);
    expect(res.body.type).toBe('BE_REPLACED');

    await app2.close();
  });
});
