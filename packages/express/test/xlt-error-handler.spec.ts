import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import {
  NotLoginException,
  NotLoginType,
  NotPermissionException,
  NotRoleException,
  NotSafeException,
  XltMode,
} from '@xlt-token/core';
import { xltErrorHandler } from '../src/error/xlt-error-handler.js';

interface CapturedRes extends Response {
  _status: number;
  _body: Record<string, unknown>;
}

function mockRes(): CapturedRes {
  const res = {
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: Record<string, unknown>) {
      res._body = body;
      return res;
    },
  } as unknown as CapturedRes;
  return res;
}

const req = {} as Request;

describe('xltErrorHandler', () => {
  it('NotLoginException → 401', () => {
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    xltErrorHandler()(
      new NotLoginException(NotLoginType.INVALID_TOKEN, 'tok'),
      req,
      res,
      next,
    );

    expect(res._status).toBe(401);
    expect(res._body).toMatchObject({
      statusCode: 401,
      code: 'NOT_LOGIN',
      type: NotLoginType.INVALID_TOKEN,
      token: 'tok',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('NotPermissionException → 403', () => {
    const res = mockRes();
    xltErrorHandler()(
      new NotPermissionException(['admin:*'], XltMode.AND),
      req,
      res,
      vi.fn() as unknown as NextFunction,
    );
    expect(res._status).toBe(403);
    expect(res._body).toMatchObject({ code: 'NOT_PERMISSION', permission: ['admin:*'], mode: XltMode.AND });
  });

  it('NotRoleException → 403', () => {
    const res = mockRes();
    xltErrorHandler()(
      new NotRoleException('admin', XltMode.OR),
      req,
      res,
      vi.fn() as unknown as NextFunction,
    );
    expect(res._status).toBe(403);
    expect(res._body).toMatchObject({ code: 'NOT_ROLE', role: 'admin', mode: XltMode.OR });
  });

  it('NotSafeException → 403', () => {
    const res = mockRes();
    xltErrorHandler()(new NotSafeException('pay'), req, res, vi.fn() as unknown as NextFunction);
    expect(res._status).toBe(403);
    expect(res._body).toMatchObject({ code: 'NOT_SAFE', business: 'pay' });
  });

  it('非 xlt-token 异常透传给 next(err)', () => {
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    const err = new Error('boom');
    xltErrorHandler()(err, req, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res._status).toBeUndefined();
  });
});
