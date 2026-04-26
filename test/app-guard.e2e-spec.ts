import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { StpLogic } from '../src';
import { buildTestApp } from './fixtures/test-app.module';

describe('XltTokenGuard 黑名单模式 (e2e)', () => {
  let app: INestApplication;
  let stpLogic: StpLogic;
  let token1001: string;

  beforeAll(async () => {
    const { app: a, moduleRef } = await buildTestApp();
    app = a;
    stpLogic = moduleRef.get(StpLogic);
    token1001 = await stpLogic.login('1001');
  });

  afterAll(() => app.close());

  it('@XltIgnore 路由无 token 放行', () =>
    request(app.getHttpServer()).get('/api/public').expect(200, { ok: true }));

  it('默认校验：无 token → 401 + NOT_TOKEN', async () => {
    const res = await request(app.getHttpServer()).get('/api/me').expect(401);
    expect(res.body.type).toBe('NOT_TOKEN');
  });

  it('有效 token → 200 且 @LoginId/@TokenValue 注入', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', token1001)
      .expect(200);
    expect(res.body).toEqual({ id: '1001', token: token1001 });
  });

  it('无效 token → 401 + INVALID_TOKEN', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', 'garbage')
      .expect(401);
    expect(res.body.type).toBe('INVALID_TOKEN');
  });
});

describe('XltTokenGuard 白名单模式 (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const { app: a, moduleRef } = await buildTestApp({ defaultCheck: false });
    app = a;
    token = await moduleRef.get(StpLogic).login('1001');
  });

  afterAll(() => app.close());

  it('默认不校验：/api/me 无 token 放行', () =>
    request(app.getHttpServer()).get('/api/me').expect(200));

  it('@XltCheckLogin 强制校验：无 token → 401', () =>
    request(app.getHttpServer()).get('/api/whitelisted').expect(401));

  it('@XltCheckLogin + token → 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/whitelisted')
      .set('authorization', token)
      .expect(200);
    expect(res.body.id).toBe('1001');
  });
});
