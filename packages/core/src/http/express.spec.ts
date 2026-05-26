import { describe, expect, it } from 'vitest';
import { createExpressContext } from './express.js';

describe('createExpressContext', () => {
  it('读取 header / cookie / query（大小写不敏感）', () => {
    const req = {
      headers: { authorization: 'Bearer t1' },
      cookies: { sid: 'c1' },
      query: { token: 'q1' },
    };
    const res = { setHeader: () => {}, cookie: () => {} };
    const ctx = createExpressContext(req, res);

    expect(ctx.headers.get('Authorization')).toBe('Bearer t1');
    expect(ctx.cookies.get('sid')).toBe('c1');
    expect(ctx.query.get('token')).toBe('q1');
  });

  it('同一 req 多次创建共享 state', () => {
    const req = { headers: {} };
    const res = { setHeader: () => {}, cookie: () => {} };

    const ctx1 = createExpressContext(req, res);
    const ctx2 = createExpressContext(req, res);

    ctx1.state.stpLoginId = '1001';
    expect(ctx2.state.stpLoginId).toBe('1001');
  });

  it('setHeader / setCookie 委托到 response', () => {
    const headers: Record<string, string> = {};
    const cookies: Array<{ name: string; value: string; options?: unknown }> = [];
    const req = { headers: {} };
    const res = {
      setHeader(name: string, value: string) {
        headers[name] = value;
      },
      cookie(name: string, value: string, options?: unknown) {
        cookies.push({ name, value, options });
      },
    };

    const ctx = createExpressContext(req, res);
    ctx.setHeader('X-Test', '1');
    ctx.setCookie('sid', 'v', { httpOnly: true });

    expect(headers['X-Test']).toBe('1');
    expect(cookies).toEqual([{ name: 'sid', value: 'v', options: { httpOnly: true } }]);
  });

  it('raw() 返回原始 request', () => {
    const req = { headers: { a: '1' } };
    const res = { setHeader: () => {}, cookie: () => {} };
    expect(createExpressContext(req, res).raw()).toBe(req);
  });
});
