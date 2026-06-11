import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { StpLogic, XLT_TOKEN_STORE } from '@xlt-token/nestjs';
import type { XltTokenStore } from '@xlt-token/nestjs';
import { buildTestApp } from './fixtures/test-app.module';

describe('相对时间 DurationInput (e2e)', () => {
  let app: INestApplication;
  let stp: StpLogic;
  let store: XltTokenStore;

  beforeAll(async () => {
    const { app: a, moduleRef } = await buildTestApp();
    app = a;
    stp = moduleRef.get(StpLogic);
    store = moduleRef.get(XLT_TOKEN_STORE);
  });

  afterAll(() => app.close());

  it('options.timeout 为 DurationInput 字符串时正确设置 TTL', async () => {
    const token = await stp.login('8001', { timeout: '30s' });
    const ttl = await store.getTimeout(`authorization:login:token:${token}`);
    expect(ttl).toBeGreaterThan(25);
    expect(ttl).toBeLessThanOrEqual(30);
  });

  it('options.timeout 为 -1 时永不过期', async () => {
    const token = await stp.login('8002', { timeout: -1 });
    const ttl = await store.getTimeout(`authorization:login:token:${token}`);
    expect(ttl).toBe(-1);

    // HTTP 请求也应正常
    await request(app.getHttpServer())
      .get('/api/me')
      .set('authorization', token)
      .expect(200);
  });

  it('options.timeout 为 0 时 Store 立即过期', async () => {
    const token = await stp.login('8003', { timeout: 0 });
    const ttl = await store.getTimeout(`authorization:login:token:${token}`);
    expect(ttl).toBe(-2);
  });

  it('不同 DurationInput 单位均正确解析', async () => {
    const t1 = await stp.login('8011', { timeout: '10s' });
    const ttl1 = await store.getTimeout(`authorization:login:token:${t1}`);
    expect(ttl1).toBeGreaterThan(5);
    expect(ttl1).toBeLessThanOrEqual(10);

    const t2 = await stp.login('8012', { timeout: '1m' });
    const ttl2 = await store.getTimeout(`authorization:login:token:${t2}`);
    expect(ttl2).toBeGreaterThan(55);
    expect(ttl2).toBeLessThanOrEqual(60);

    const t3 = await stp.login('8013', { timeout: '5m' });
    const ttl3 = await store.getTimeout(`authorization:login:token:${t3}`);
    expect(ttl3).toBeGreaterThan(295);
    expect(ttl3).toBeLessThanOrEqual(300);
  });
});
