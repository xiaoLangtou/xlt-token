import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { StpLogic } from '@xlt-token/nestjs';
import { buildTestApp } from './fixtures/test-app.module';

describe('二级认证 (e2e)', () => {
  it('@XltCheckSafe 未开启时 → 403 + NOT_SAFE', async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);
    const token = await stp.login('6001');

    const res = await request(app.getHttpServer())
      .get('/api/safe/pay')
      .set('authorization', token)
      .expect(403);

    expect(res.body.type).toBe('NOT_SAFE');
    expect(res.body.message).toContain('pay');

    await app.close();
  });

  it('openSafe 后 @XltCheckSafe 路由放行', async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);
    const token = await stp.login('6002');

    await stp.openSafe(token, 'pay', 300);

    await request(app.getHttpServer())
      .get('/api/safe/pay')
      .set('authorization', token)
      .expect(200, { action: 'pay' });

    await app.close();
  });

  it('closeSafe 后 @XltCheckSafe 路由再次 403', async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);
    const token = await stp.login('6003');

    await stp.openSafe(token, 'pay', 300);
    await stp.closeSafe(token, 'pay');

    const res = await request(app.getHttpServer())
      .get('/api/safe/pay')
      .set('authorization', token)
      .expect(403);

    expect(res.body.type).toBe('NOT_SAFE');

    await app.close();
  });

  it('openSafe 超时后 @XltCheckSafe 路由 403', async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);
    const token = await stp.login('6004');

    await stp.openSafe(token, 'pay', 1);
    await new Promise((r) => setTimeout(r, 1100));

    const res = await request(app.getHttpServer())
      .get('/api/safe/pay')
      .set('authorization', token)
      .expect(403);

    expect(res.body.type).toBe('NOT_SAFE');

    await app.close();
  });
});

describe('临时 Token (e2e)', () => {
  it('createTempToken / parseTempToken 在 Nest 上下文中可用', async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);

    const tempToken = await stp.createTempToken('resetPwd:1001', 600);
    expect(tempToken).toBeTruthy();
    expect(await stp.parseTempToken(tempToken)).toBe('resetPwd:1001');

    await app.close();
  });

  it('deleteTempToken 后 parseTempToken 返回 null', async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);

    const tempToken = await stp.createTempToken('resetPwd:1002', 600);
    await stp.deleteTempToken(tempToken);
    expect(await stp.parseTempToken(tempToken)).toBeNull();

    await app.close();
  });

  it('超时后 parseTempToken 返回 null', async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);

    const tempToken = await stp.createTempToken('resetPwd:1003', 1);
    await new Promise((r) => setTimeout(r, 1100));
    expect(await stp.parseTempToken(tempToken)).toBeNull();

    await app.close();
  });
});
