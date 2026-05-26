import { describe, expect, it } from 'vitest';
import { createMockHttpContext } from './testing.js';

describe('createMockHttpContext', () => {
  it('支持 headers / cookies / query / state', () => {
    const ctx = createMockHttpContext({
      headers: { authorization: 'Bearer t' },
      cookies: { sid: 'c' },
      query: { token: 'q' },
      state: { stpLoginId: '1001' },
    });

    expect(ctx.headers.get('authorization')).toBe('Bearer t');
    expect(ctx.cookies.get('sid')).toBe('c');
    expect(ctx.query.get('token')).toBe('q');
    expect(ctx.state.stpLoginId).toBe('1001');
  });

  it('header 数组取第一个值', () => {
    const ctx = createMockHttpContext({
      headers: { 'x-forwarded-for': ['1.1.1.1', '2.2.2.2'] },
    });
    expect(ctx.headers.get('x-forwarded-for')).toBe('1.1.1.1');
  });

  it('缺失字段返回 null', () => {
    const ctx = createMockHttpContext();
    expect(ctx.headers.get('missing')).toBeNull();
    expect(ctx.cookies.get('missing')).toBeNull();
    expect(ctx.query.get('missing')).toBeNull();
  });

  it('raw() 返回 options', () => {
    const options = { headers: { a: '1' } };
    expect(createMockHttpContext(options).raw()).toBe(options);
  });
});
