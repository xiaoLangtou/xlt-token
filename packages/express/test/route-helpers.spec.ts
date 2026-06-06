import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { XltMode } from '@xlt-token/core';
import { ignoreAuth } from '../src/middleware/ignore-auth.js';
import { requireLogin } from '../src/middleware/require-login.js';
import { checkPermission } from '../src/middleware/check-permission.js';
import { checkRole } from '../src/middleware/check-role.js';
import { checkSafe } from '../src/middleware/check-safe.js';

function run(handler: ReturnType<typeof ignoreAuth>, req: Request): void {
  const next = vi.fn() as unknown as NextFunction;
  handler(req, {} as Response, next);
  expect(next).toHaveBeenCalledWith();
}

function mockReq(init: Partial<Request> = {}): Request {
  return { ...init } as unknown as Request;
}

describe('route helpers', () => {
  it('ignoreAuth 写入 ignore: true', () => {
    const req = mockReq();
    run(ignoreAuth(), req);
    expect(req._xltRouteMeta).toEqual({ ignore: true });
  });

  it('requireLogin 写入 requireLogin: true', () => {
    const req = mockReq();
    run(requireLogin(), req);
    expect(req._xltRouteMeta).toEqual({ requireLogin: true });
  });

  it('checkPermission 默认 AND，字符串归一为数组', () => {
    const req = mockReq();
    run(checkPermission('user:read'), req);
    expect(req._xltRouteMeta).toEqual({ permissions: { list: ['user:read'], mode: XltMode.AND } });
  });

  it('checkPermission 支持数组与显式 mode', () => {
    const req = mockReq();
    run(checkPermission(['a', 'b'], XltMode.OR), req);
    expect(req._xltRouteMeta).toEqual({ permissions: { list: ['a', 'b'], mode: XltMode.OR } });
  });

  it('checkRole 写入 roles', () => {
    const req = mockReq();
    run(checkRole('admin'), req);
    expect(req._xltRouteMeta).toEqual({ roles: { list: ['admin'], mode: XltMode.AND } });
  });

  it('checkRole 支持数组与显式 mode', () => {
    const req = mockReq();
    run(checkRole(['admin', 'ops'], XltMode.OR), req);
    expect(req._xltRouteMeta).toEqual({ roles: { list: ['admin', 'ops'], mode: XltMode.OR } });
  });

  it('checkSafe 写入 safeBusiness', () => {
    const req = mockReq();
    run(checkSafe('pay'), req);
    expect(req._xltRouteMeta).toEqual({ safeBusiness: 'pay' });
  });

  it('在已有元数据上合并而非覆盖', () => {
    const req = mockReq({ _xltRouteMeta: { ignore: true } });
    run(checkSafe('pay'), req);
    expect(req._xltRouteMeta).toEqual({ ignore: true, safeBusiness: 'pay' });
  });
});
