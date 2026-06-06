import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { matchIgnore } from '../src/auth/match-ignore.js';

function mockReq(originalUrl: string): Request {
  return { originalUrl } as unknown as Request;
}

describe('matchIgnore', () => {
  it('无规则返回 false', () => {
    expect(matchIgnore(mockReq('/a'))).toBe(false);
    expect(matchIgnore(mockReq('/a'), [])).toBe(false);
  });

  it('字符串精确与前缀匹配', () => {
    expect(matchIgnore(mockReq('/login'), ['/login'])).toBe(true);
    expect(matchIgnore(mockReq('/public/x'), ['/public'])).toBe(true);
    expect(matchIgnore(mockReq('/public?from=unit'), ['/public'])).toBe(true);
    expect(matchIgnore(mockReq('/private'), ['/public'])).toBe(false);
    expect(matchIgnore(mockReq('/publicity'), ['/public'])).toBe(false);
  });

  it('正则与函数规则', () => {
    expect(matchIgnore(mockReq('/v1/health'), [/health/])).toBe(true);
    expect(matchIgnore(mockReq('/skip'), [(req) => req.originalUrl === '/skip'])).toBe(true);
  });

  it('大小写敏感：不应对路径做小写化', () => {
    expect(matchIgnore(mockReq('/API/Public'), ['/API/Public'])).toBe(true);
    expect(matchIgnore(mockReq('/API/Public'), ['/api/public'])).toBe(false);
  });
});
