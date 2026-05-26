import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import { JwtStrategy } from './jwt-strategy';
import {
  DEFAULT_XLT_TOKEN_CONFIG,
  XLT_TOKEN_CONFIG,
  XltTokenConfig,
} from '../core/xlt-token-config';

const JWT_SECRET = 'test-jwt-secret';

const makeConfig = (overrides: Partial<XltTokenConfig> = {}): XltTokenConfig => ({
  ...DEFAULT_XLT_TOKEN_CONFIG,
  timeout: 3600,
  jwt: { secret: JWT_SECRET, issuer: 'xlt-token', audience: 'xlt-aud' },
  ...overrides,
});

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let config: XltTokenConfig;

  beforeEach(async () => {
    config = makeConfig();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: XLT_TOKEN_CONFIG, useValue: config },
        JwtStrategy,
      ],
    }).compile();
    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  describe('createToken', () => {
    it('签发 JWT 且 payload 含 sub 与 jti', () => {
      const token = strategy.createToken('1001', config);
      const payload = strategy.verifyToken(token);

      expect(payload.sub).toBe('1001');
      expect(payload.jti).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('多次调用生成不同 token', () => {
      const tokens = Array.from({ length: 10 }, () => strategy.createToken('1001', config));
      expect(new Set(tokens).size).toBe(10);
    });

    it('config.timeout > 0 时 JWT 带 exp', () => {
      const token = strategy.createToken('1001', makeConfig({ timeout: 60 }));
      const payload = strategy.verifyToken(token);
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('issuer / audience 写入 JWT', () => {
      const token = strategy.createToken('1001', config);
      const payload = strategy.verifyToken(token);
      expect(payload.iss).toBe('xlt-token');
      expect(payload.aud).toBe('xlt-aud');
    });
  });

  describe('verifyToken', () => {
    it('签名错误时抛出异常', () => {
      const token = strategy.createToken('1001', config);
      const parts = token.split('.');
      const tampered = `${parts[0]}.${parts[1]}.invalid-signature`;
      expect(() => strategy.verifyToken(tampered)).toThrow();
    });

    it('过期 token 抛出异常', () => {
      const expired = sign({ sub: '1001', jti: 'expired-jti' }, JWT_SECRET, { expiresIn: -1 });
      expect(() => strategy.verifyToken(expired)).toThrow();
    });
  });

  describe('generateToken', () => {
    it('自定义 payload 可签发', () => {
      const token = strategy.generateToken({ sub: 'custom', foo: 'bar' });
      const payload = strategy.verifyToken(token);
      expect(payload.sub).toBe('custom');
      expect((payload as any).foo).toBe('bar');
    });
  });
});
