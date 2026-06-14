import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { sign } from 'jsonwebtoken';
import { JwtStrategy, StpLogic, NotLoginType } from '@xlt-token/nestjs';
import { buildTestApp } from './fixtures/test-app.module';

const JWT_SECRET = 'e2e-jwt-secret';

const jwtAppOpts = {
  strategy: { useClass: JwtStrategy },
  config: {
    jwt: { secret: JWT_SECRET, issuer: 'xlt-token' },
    isConcurrent: false,
    isShare: false,
    timeout: 3600,
  },
} as const;

describe('JWT Strategy (e2e)', () => {
  it('登录后 JWT 可访问受保护路由', async () => {
    const { app, moduleRef } = await buildTestApp(jwtAppOpts);
    const stp = moduleRef.get(StpLogic);
    const token = await stp.login('7001');

    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', token)
      .expect(200);

    expect(res.body.id).toBe('7001');
    expect(res.body.token).toBe(token);

    await app.close();
  });

  it('kickout 后旧 JWT → 401 KICK_OUT', async () => {
    const { app, moduleRef } = await buildTestApp(jwtAppOpts);
    const stp = moduleRef.get(StpLogic);
    const token = await stp.login('7002');
    await stp.kickout('7002');

    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', token)
      .expect(401);

    expect(res.body.type).toBe('KICK_OUT');

    await app.close();
  });

  it('被顶号后旧 JWT → 401 BE_REPLACED', async () => {
    const { app, moduleRef } = await buildTestApp(jwtAppOpts);
    const stp = moduleRef.get(StpLogic);
    const t1 = await stp.login('7003');
    await stp.login('7003');

    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', t1)
      .expect(401);

    expect(res.body.type).toBe('BE_REPLACED');

    await app.close();
  });

  it('签名错误的 JWT → 401 INVALID_TOKEN', async () => {
    const { app, moduleRef } = await buildTestApp(jwtAppOpts);
    const stp = moduleRef.get(StpLogic);
    const token = await stp.login('7004');
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.invalid-signature`;

    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', tampered)
      .expect(401);

    expect(res.body.type).toBe('INVALID_TOKEN');

    await app.close();
  });

  it('过期 JWT → 401 INVALID_TOKEN', async () => {
    const { app } = await buildTestApp(jwtAppOpts);
    const expired = sign({ sub: '7005', jti: 'expired-jti' }, JWT_SECRET, { expiresIn: -1 });

    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', expired)
      .expect(401);

    expect(res.body.type).toBe('INVALID_TOKEN');

    await app.close();
  });

  it('kickoutByToken 后 JWT 失效', async () => {
    const { app, moduleRef } = await buildTestApp(jwtAppOpts);
    const stp = moduleRef.get(StpLogic);
    const token = await stp.login('7006');
    await stp.kickoutByToken(token);

    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', token)
      .expect(401);

    expect(res.body.type).toBe('KICK_OUT');

    await app.close();
  });

  it('logout 后旧 JWT → 401', async () => {
    const { app, moduleRef } = await buildTestApp(jwtAppOpts);
    const stp = moduleRef.get(StpLogic);
    const token = await stp.login('7007');
    await stp.logout(token);

    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', token)
      .expect(401);

    await app.close();
  });

  it('logoutByLoginId 使所有设备 JWT 失效', async () => {
    const { app, moduleRef } = await buildTestApp(jwtAppOpts);
    const stp = moduleRef.get(StpLogic);
    const pcToken = await stp.login('7008', { device: 'pc' });
    const appToken = await stp.login('7008', { device: 'app' });

    await stp.logoutByLoginId('7008');

    await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', pcToken)
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', appToken)
      .expect(401);

    await app.close();
  });

  describe('refreshToken (e2e)', () => {
    it('刷新 JWT 后新 token 可访问，旧 token 失效', async () => {
      const { app, moduleRef } = await buildTestApp(jwtAppOpts);
      const stp = moduleRef.get(StpLogic);
      const token = await stp.login('7009');

      const newToken = await stp.refreshToken(token);
      expect(newToken).not.toBeNull();
      expect(newToken).not.toBe(token);

      const res = await request(app.getHttpServer())
        .get('/api/me')
        .set('authorization', newToken!)
        .expect(200);
      expect(res.body.id).toBe('7009');

      await request(app.getHttpServer())
        .get('/api/me')
        .set('authorization', token)
        .expect(401);

      await app.close();
    });

    it('已踢出的 JWT 不可刷新', async () => {
      const { app, moduleRef } = await buildTestApp(jwtAppOpts);
      const stp = moduleRef.get(StpLogic);
      const token = await stp.login('7010');
      await stp.kickout('7010');

      await expect(stp.refreshToken(token)).resolves.toBeNull();

      await app.close();
    });

    it('logoutByDevice 后另一个设备 JWT 仍可刷新', async () => {
      const { app, moduleRef } = await buildTestApp(jwtAppOpts);
      const stp = moduleRef.get(StpLogic);
      const pcToken = await stp.login('7011', { device: 'pc' });
      const appToken = await stp.login('7011', { device: 'app' });

      await stp.logoutByDevice('7011', 'pc');

      // app 设备的 token 仍然可刷新
      const newAppToken = await stp.refreshToken(appToken);
      expect(newAppToken).not.toBeNull();

      await request(app.getHttpServer())
        .get('/api/me')
        .set('authorization', newAppToken!)
        .expect(200);

      await app.close();
    });
  });
});
