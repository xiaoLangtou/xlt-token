import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { StpLogic } from '@xlt-token/nestjs';
import { buildFastifyTestApp } from './fixtures/fastify-app.module';

describe('Fastify 适配 (e2e)', () => {
  it('忽略路由无需 token', async () => {
    const { app } = await buildFastifyTestApp();

    const res = await request(app.getHttpServer()).get('/api/public').expect(200);
    expect(res.body.ok).toBe(true);

    await app.close();
  });

  it('Header 模式：携带 token 通过守卫', async () => {
    const { app, moduleRef } = await buildFastifyTestApp();
    const stp = moduleRef.get(StpLogic);
    const token = await stp.login('9001');

    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', token)
      .expect(200);

    expect(res.body.id).toBe('9001');
    expect(res.body.token).toBe(token);

    await app.close();
  });

  it('Header 模式：缺少 token → 401', async () => {
    const { app } = await buildFastifyTestApp();

    await request(app.getHttpServer()).get('/api/me').expect(401);

    await app.close();
  });

  it('Cookie 模式：注册 @fastify/cookie 后从 cookie 读取 token', async () => {
    const { app, moduleRef } = await buildFastifyTestApp({
      withCookie: true,
      config: { isReadHeader: false, isReadCookie: true },
    });
    const stp = moduleRef.get(StpLogic);
    const token = await stp.login('9002');

    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('Cookie', `authorization=${token}`)
      .expect(200);

    expect(res.body.id).toBe('9002');

    await app.close();
  });

  it('Query 模式：从 query 读取 token', async () => {
    const { app, moduleRef } = await buildFastifyTestApp({
      config: { isReadHeader: false, isReadQuery: true },
    });
    const stp = moduleRef.get(StpLogic);
    const token = await stp.login('9003');

    const res = await request(app.getHttpServer())
      .get('/api/me')
      .query({ authorization: token })
      .expect(200);

    expect(res.body.id).toBe('9003');

    await app.close();
  });
});
