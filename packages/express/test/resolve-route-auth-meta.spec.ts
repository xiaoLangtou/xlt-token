import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { XltMode } from '@xlt-token/core';
import type { RouteAuthPolicy } from '../src/types.js';
import {
  matchPolicy,
  mergeRouteAuthMeta,
  resolveRouteAuthMeta,
} from '../src/auth/resolve-route-auth-meta.js';

function mockReq(originalUrl: string, method = 'GET'): Request {
  return { originalUrl, method } as unknown as Request;
}

describe('matchPolicy', () => {
  it('字符串：精确匹配', () => {
    expect(matchPolicy(mockReq('/api/login'), { match: '/api/login' })).toBe(true);
  });

  it('字符串：前缀匹配', () => {
    expect(matchPolicy(mockReq('/api/public/docs'), { match: '/api/public' })).toBe(true);
    expect(matchPolicy(mockReq('/api/public?from=unit'), { match: '/api/public' })).toBe(true);
    expect(matchPolicy(mockReq('/api/private'), { match: '/api/public' })).toBe(false);
    expect(matchPolicy(mockReq('/api/publicity'), { match: '/api/public' })).toBe(false);
  });

  it('正则匹配', () => {
    expect(matchPolicy(mockReq('/api/v1/health'), { match: /\/health$/ })).toBe(true);
  });

  it('函数匹配', () => {
    const policy: RouteAuthPolicy = { match: (req) => req.originalUrl.includes('skip') };
    expect(matchPolicy(mockReq('/skip/me'), policy)).toBe(true);
    expect(matchPolicy(mockReq('/keep'), policy)).toBe(false);
  });

  it('数组 match：任一命中即可', () => {
    expect(matchPolicy(mockReq('/b'), { match: ['/a', '/b'] })).toBe(true);
  });

  it('method 过滤（大小写不敏感）', () => {
    const policy: RouteAuthPolicy = { match: '/api', methods: ['post'] };
    expect(matchPolicy(mockReq('/api', 'POST'), policy)).toBe(true);
    expect(matchPolicy(mockReq('/api', 'GET'), policy)).toBe(false);
  });
});

describe('mergeRouteAuthMeta', () => {
  it('简单字段后者覆盖前者', () => {
    const merged = mergeRouteAuthMeta({ ignore: true }, { ignore: false, requireLogin: true });
    expect(merged).toEqual({ ignore: false, requireLogin: true });
  });

  it('两者都有 permissions 时合并列表，mode 取后者', () => {
    const merged = mergeRouteAuthMeta(
      { permissions: { list: ['a'], mode: XltMode.AND } },
      { permissions: { list: ['b'], mode: XltMode.OR } },
    );
    expect(merged.permissions).toEqual({ list: ['a', 'b'], mode: XltMode.OR });
  });

  it('仅一方有 roles 时保留该方', () => {
    const merged = mergeRouteAuthMeta({}, { roles: { list: ['admin'], mode: XltMode.AND } });
    expect(merged.roles).toEqual({ list: ['admin'], mode: XltMode.AND });
  });

  it('两者都有 roles 时合并列表，mode 取后者', () => {
    const merged = mergeRouteAuthMeta(
      { roles: { list: ['admin'], mode: XltMode.AND } },
      { roles: { list: ['ops'], mode: XltMode.OR } },
    );
    expect(merged.roles).toEqual({ list: ['admin', 'ops'], mode: XltMode.OR });
  });
});

describe('resolveRouteAuthMeta', () => {
  it('无命中策略返回空元数据', () => {
    expect(resolveRouteAuthMeta(mockReq('/api/me'))).toEqual({});
  });

  it('ignore 快捷白名单转换为 { ignore: true }', () => {
    const meta = resolveRouteAuthMeta(mockReq('/health'), { ignore: ['/health'] });
    expect(meta).toEqual({ ignore: true });
  });

  it('后声明策略覆盖前者（默认策略 + 例外）', () => {
    const meta = resolveRouteAuthMeta(mockReq('/api/public'), {
      policies: [
        { match: '/api', requireLogin: true },
        { match: '/api/public', ignore: true, requireLogin: false },
      ],
    });
    expect(meta.ignore).toBe(true);
    expect(meta.requireLogin).toBe(false);
  });

  it('多条命中策略合并权限列表', () => {
    const meta = resolveRouteAuthMeta(mockReq('/api/order'), {
      policies: [
        { match: '/api', permissions: { list: ['user:read'], mode: XltMode.AND } },
        { match: '/api/order', permissions: { list: ['order:read'], mode: XltMode.AND } },
      ],
    });
    expect(meta.permissions).toEqual({ list: ['user:read', 'order:read'], mode: XltMode.AND });
  });

  it('ignore 选项先于 policies 解析', () => {
    const meta = resolveRouteAuthMeta(mockReq('/api/public'), {
      ignore: ['/api/public'],
      policies: [{ match: '/api/public', requireLogin: true }],
    });
    // policies 后声明，覆盖 ignore 设置的简单字段
    expect(meta.requireLogin).toBe(true);
    expect(meta.ignore).toBe(true);
  });
});
