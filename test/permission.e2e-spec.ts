import { describe, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { StpLogic } from '../src';
import { buildTestApp } from './fixtures/test-app.module';

describe('Permission & Role (e2e)', () => {
  let app: INestApplication;
  let adminToken: string; // 1001: admin + user:read/write/delete
  let userToken: string; // 1002: user + user:read

  beforeAll(async () => {
    const { app: a, moduleRef } = await buildTestApp();
    app = a;
    const stp = moduleRef.get(StpLogic);
    adminToken = await stp.login('1001');
    userToken = await stp.login('1002');
  });

  afterAll(() => app.close());

  describe('@XltCheckPermission', () => {
    it('admin 访问 read → 200', () =>
      request(app.getHttpServer())
        .get('/api/read')
        .set('authorization', adminToken)
        .expect(200));

    it('user 访问 read → 200（拥有 user:read）', () =>
      request(app.getHttpServer())
        .get('/api/read')
        .set('authorization', userToken)
        .expect(200));

    it('AND 模式：user 缺 user:delete → 403', () =>
      request(app.getHttpServer())
        .get('/api/delete')
        .set('authorization', userToken)
        .expect(403));

    it('AND 模式：admin 齐全 → 200', () =>
      request(app.getHttpServer())
        .get('/api/delete')
        .set('authorization', adminToken)
        .expect(200));

    it('通配符匹配：admin 的 order:* 覆盖 order:create', () =>
      request(app.getHttpServer())
        .get('/api/wildcard')
        .set('authorization', adminToken)
        .expect(200));
  });

  describe('@XltCheckRole', () => {
    it('admin 角色 → 200', () =>
      request(app.getHttpServer())
        .get('/api/admin')
        .set('authorization', adminToken)
        .expect(200));

    it('user 角色 → 403', () =>
      request(app.getHttpServer())
        .get('/api/admin')
        .set('authorization', userToken)
        .expect(403));

    it('数组形式 + OR 模式：admin 命中其一 → 200', () =>
      request(app.getHttpServer())
        .get('/api/admin-or')
        .set('authorization', adminToken)
        .expect(200));
  });
});
