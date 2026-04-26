import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { StpLogic } from '../src';
import { buildTestApp } from './fixtures/test-app.module';

describe('XltSession (e2e)', () => {
  it('跨请求保持会话数据', async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);
    const token = await stp.login('5005');

    // 写入 session
    const session = stp.getSession('5005');
    await session.set('nickname', 'xlt');
    await session.set('ext', { role: 'vip' });

    // 发起请求验证 token 仍有效
    await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', token)
      .expect(200);

    // 重新获取 session 实例，验证数据持久化
    const reloaded = stp.getSession('5005');
    expect(await reloaded.get('nickname')).toBe('xlt');
    expect(await reloaded.get('ext')).toEqual({ role: 'vip' });

    await app.close();
  });

  it('logout 后 session 数据被清理', async () => {
    const { app, moduleRef } = await buildTestApp();
    const stp = moduleRef.get(StpLogic);
    const token = await stp.login('6006');

    const session = stp.getSession('6006');
    await session.set('data', 'important');

    await stp.logout(token);

    const reloaded = stp.getSession('6006');
    expect(await reloaded.get('data')).toBeNull();

    await app.close();
  });
});
