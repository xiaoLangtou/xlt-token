import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import {
  createXltToken,
  NotLoginException,
  type StpInterface,
  type XltTokenContext,
} from '@xlt-token/core';
import { xltMiddleware } from '../src/middleware/xlt-middleware.js';

const stpInterface: StpInterface = {
  getPermissionList: async () => ['user:read'],
  getRoleList: async () => ['admin'],
};

let xlt: XltTokenContext;

beforeEach(() => {
  xlt = createXltToken({ config: { tokenPrefix: '' }, stpInterface });
});

function mockReq(init: Partial<Record<string, unknown>> = {}): Request {
  return {
    method: 'GET',
    originalUrl: '/',
    headers: {},
    query: {},
    ...init,
  } as unknown as Request;
}

function mockRes(): Response {
  return { setHeader: vi.fn(), cookie: vi.fn() } as unknown as Response;
}

describe('xltMiddleware', () => {
  it('无 token 时通过 next(err) 传递 NotLoginException', async () => {
    const next = vi.fn() as unknown as NextFunction;
    await xltMiddleware(xlt)(mockReq(), mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((next as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBeInstanceOf(NotLoginException);
  });

  it('命中 ignore 策略时直接放行，不做鉴权', async () => {
    const next = vi.fn() as unknown as NextFunction;
    const req = mockReq({ originalUrl: '/health' });
    await xltMiddleware(xlt, { ignore: ['/health'] })(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.stpLoginId).toBeUndefined();
  });

  it('有效 token 时将 loginId / token 同步到 req 并放行', async () => {
    const token = await xlt.stpLogic.login('1001');
    const next = vi.fn() as unknown as NextFunction;
    const req = mockReq({ originalUrl: '/me', headers: { authorization: token } });

    await xltMiddleware(xlt)(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.stpLoginId).toBe('1001');
    expect(req.stpToken).toBe(token);
  });

  it('白名单模式下未标记 requireLogin 的路由直接放行', async () => {
    const wlXlt = createXltToken({ config: { tokenPrefix: '', defaultCheck: false }, stpInterface });
    const next = vi.fn() as unknown as NextFunction;
    const req = mockReq({ originalUrl: '/open' });

    await xltMiddleware(wlXlt)(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.stpLoginId).toBeUndefined();
  });

  it('权限不足时通过 next(err) 传递异常', async () => {
    const token = await xlt.stpLogic.login('1001');
    const next = vi.fn() as unknown as NextFunction;
    const req = mockReq({ originalUrl: '/admin', headers: { authorization: token } });

    await xltMiddleware(xlt, {
      policies: [{ match: '/admin', permissions: { list: ['admin:delete'], mode: 'AND' } }],
    })(req, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((next as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBeDefined();
  });
});
