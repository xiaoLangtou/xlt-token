import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Controller, Get, Module, Param, Post, Req } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  StpLogic,
  StpUtil,
  XltCheckLogin,
  XltIgnore,
  XltMode,
  XltTokenGuard,
  XltTokenModule,
} from '../src';
import { MockStpInterface } from './fixtures/mock-stp-interface';

/**
 * 通过 HTTP 路由调用 StpUtil，验证静态门面在真实 Nest 上下文中的所有方法。
 * 目的：提升 stp-util.ts 在 E2E 视图下的 Funcs 覆盖率。
 */
@Controller('facade')
class FacadeController {
  @XltIgnore()
  @Post('login/:id')
  async login(@Param('id') id: string) {
    const token = await StpUtil.login(id);
    return { token };
  }

  @XltCheckLogin()
  @Get('is-login')
  async isLogin(@Req() req: any) {
    return { result: await StpUtil.isLogin(req) };
  }

  @XltCheckLogin()
  @Get('check-login')
  async checkLogin(@Req() req: any) {
    return StpUtil.checkLogin(req);
  }

  @XltCheckLogin()
  @Get('login-id')
  async loginId(@Req() req: any) {
    const id = await StpUtil.getLoginId(req);
    return { id };
  }

  @XltCheckLogin()
  @Get('token-value')
  async tokenValue(@Req() req: any) {
    const t = await StpUtil.getTokenValue(req);
    return { token: t };
  }

  @XltIgnore()
  @Post('logout/:token')
  async logout(@Param('token') token: string) {
    return { ok: await StpUtil.logout(token) };
  }

  @XltIgnore()
  @Post('logout-by-id/:id')
  async logoutById(@Param('id') id: string) {
    return { ok: await StpUtil.logoutByLoginId(id) };
  }

  @XltIgnore()
  @Post('kickout/:id')
  async kickout(@Param('id') id: string) {
    return { ok: await StpUtil.kickout(id) };
  }

  @XltIgnore()
  @Post('renew/:token/:timeout')
  async renew(@Param('token') token: string, @Param('timeout') timeout: string) {
    return { ok: await StpUtil.renewTimeout(token, Number(timeout)) };
  }

  @XltIgnore()
  @Get('has-perm/:id/:p')
  async hasPerm(@Param('id') id: string, @Param('p') p: string) {
    return { ok: await StpUtil.hasPermission(id, p) };
  }

  @XltIgnore()
  @Get('check-perm/:id')
  async checkPerm(@Param('id') id: string) {
    await StpUtil.checkPermission(id, ['user:read'], XltMode.AND);
    return { ok: true };
  }

  @XltIgnore()
  @Get('has-role/:id/:r')
  async hasRole(@Param('id') id: string, @Param('r') r: string) {
    return { ok: await StpUtil.hasRole(id, r) };
  }

  @XltIgnore()
  @Get('check-role/:id')
  async checkRole(@Param('id') id: string) {
    await StpUtil.checkRole(id, ['admin'], XltMode.OR);
    return { ok: true };
  }

  @XltIgnore()
  @Get('session/:id')
  async session(@Param('id') id: string) {
    const s = StpUtil.getSession(id);
    await s.set('hello', 'world');
    return { val: await s.get('hello') };
  }

  @XltIgnore()
  @Get('offline/:token')
  async offline(@Param('token') token: string) {
    return { record: await StpUtil.getOfflineReason(token) };
  }
}

@Module({
  imports: [
    XltTokenModule.forRoot({
      isGlobal: true,
      config: {
        tokenName: 'authorization',
        tokenPrefix: '',
        defaultCheck: false,
      },
      stpInterface: MockStpInterface,
    }),
  ],
  controllers: [FacadeController],
  providers: [{ provide: APP_GUARD, useClass: XltTokenGuard }],
})
class FacadeAppModule {}

describe('StpUtil 静态门面 (e2e)', () => {
  let app: any;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FacadeAppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('login → token', async () => {
    const res = await request(app.getHttpServer()).post('/facade/login/1001').expect(201);
    expect(res.body.token).toBeTruthy();
  });

  it('isLogin / checkLogin / getLoginId / getTokenValue', async () => {
    const { body } = await request(app.getHttpServer()).post('/facade/login/1001');
    const token = body.token;

    await request(app.getHttpServer())
      .get('/facade/is-login')
      .set('authorization', token)
      .expect(200, { result: true });

    await request(app.getHttpServer())
      .get('/facade/check-login')
      .set('authorization', token)
      .expect(200);

    const idRes = await request(app.getHttpServer())
      .get('/facade/login-id')
      .set('authorization', token)
      .expect(200);
    expect(idRes.body.id).toBe('1001');

    const tvRes = await request(app.getHttpServer())
      .get('/facade/token-value')
      .set('authorization', token)
      .expect(200);
    expect(tvRes.body.token).toBe(token);
  });

  it('logout / logoutByLoginId', async () => {
    const { body } = await request(app.getHttpServer()).post('/facade/login/2002');
    await request(app.getHttpServer()).post(`/facade/logout/${body.token}`).expect(201);

    await request(app.getHttpServer()).post('/facade/login/2002');
    await request(app.getHttpServer()).post('/facade/logout-by-id/2002').expect(201);
  });

  it('kickout / renewTimeout', async () => {
    const { body } = await request(app.getHttpServer()).post('/facade/login/3003');
    await request(app.getHttpServer()).post(`/facade/renew/${body.token}/7200`).expect(201);
    await request(app.getHttpServer()).post('/facade/kickout/3003').expect(201);
  });

  it('hasPermission / checkPermission', async () => {
    await request(app.getHttpServer())
      .get('/facade/has-perm/1001/user:read')
      .expect(200, { ok: true });

    await request(app.getHttpServer()).get('/facade/check-perm/1001').expect(200, { ok: true });
  });

  it('hasRole / checkRole', async () => {
    await request(app.getHttpServer())
      .get('/facade/has-role/1001/admin')
      .expect(200, { ok: true });

    await request(app.getHttpServer()).get('/facade/check-role/1001').expect(200, { ok: true });
  });

  it('getSession 跨请求保持', async () => {
    const res = await request(app.getHttpServer()).get('/facade/session/4004').expect(200);
    expect(res.body.val).toBe('world');
  });

  it('getOfflineReason 在踢人后能查到', async () => {
    const { body } = await request(app.getHttpServer()).post('/facade/login/5005');
    await request(app.getHttpServer()).post('/facade/kickout/5005').expect(201);

    const res = await request(app.getHttpServer()).get(`/facade/offline/${body.token}`).expect(200);
    expect(res.body.record).toBeDefined();
  });
});
