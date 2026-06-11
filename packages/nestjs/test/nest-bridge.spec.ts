import { describe, expect, it } from 'vitest';
import { createNestHttpContext } from '../src/http/nest-bridge.js';

describe('createNestHttpContext (跨平台 response 适配)', () => {
  it('读取 header / cookie / query（与平台无关）', () => {
    const req = {
      headers: { authorization: 'Bearer t1' },
      cookies: { sid: 'c1' },
      query: { token: 'q1' },
    };
    const ctx = createNestHttpContext(req, { setHeader() {}, cookie() {} });

    expect(ctx.headers.get('Authorization')).toBe('Bearer t1');
    expect(ctx.cookies.get('sid')).toBe('c1');
    expect(ctx.query.get('token')).toBe('q1');
  });

  it('Express 形态：写回委托到 setHeader / cookie', () => {
    const headers: Record<string, string> = {};
    const cookies: Array<{ name: string; value: string; options?: unknown }> = [];
    const res = {
      setHeader(name: string, value: string) {
        headers[name] = value;
      },
      cookie(name: string, value: string, options?: unknown) {
        cookies.push({ name, value, options });
      },
    };

    const ctx = createNestHttpContext({ headers: {} }, res);
    ctx.setHeader('X-Test', '1');
    ctx.setCookie('sid', 'v', { httpOnly: true });

    expect(headers['X-Test']).toBe('1');
    expect(cookies).toEqual([{ name: 'sid', value: 'v', options: { httpOnly: true } }]);
  });

  it('Fastify 形态：写回映射到 header / setCookie', () => {
    const headers: Record<string, string> = {};
    const cookies: Array<{ name: string; value: string; options?: unknown }> = [];
    // Fastify reply：只有 header() 和 setCookie()（后者由 @fastify/cookie 提供）
    const reply = {
      header(name: string, value: string) {
        headers[name] = value;
      },
      setCookie(name: string, value: string, options?: unknown) {
        cookies.push({ name, value, options });
      },
    };

    const ctx = createNestHttpContext({ headers: {} }, reply);
    ctx.setHeader('X-Test', '1');
    ctx.setCookie('sid', 'v', { httpOnly: true });

    expect(headers['X-Test']).toBe('1');
    expect(cookies).toEqual([{ name: 'sid', value: 'v', options: { httpOnly: true } }]);
  });

  it('Fastify 未注册 @fastify/cookie 时，写 cookie 抛出清晰错误', () => {
    // 只有 header()，没有 setCookie()/cookie()
    const reply = { header() {} };
    const ctx = createNestHttpContext({ headers: {} }, reply);

    expect(() => ctx.setCookie('sid', 'v')).toThrowError(/@fastify\/cookie/);
  });

  it('response 完全不支持写 header 时抛出错误', () => {
    const ctx = createNestHttpContext({ headers: {} }, {});
    expect(() => ctx.setHeader('X', '1')).toThrowError(/header/);
  });
});
