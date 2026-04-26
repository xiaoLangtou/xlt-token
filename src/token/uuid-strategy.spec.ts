import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UuidStrategy } from './uuid-strategy';
import { DEFAULT_XLT_TOKEN_CONFIG, XltTokenConfig } from '../core/xlt-token-config';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SIMPLE_UUID_REGEX = /^[0-9a-f]{32}$/;
const RANDOM_32_REGEX = /^[0-9a-f]{32}$/;

const makeConfig = (overrides: Partial<XltTokenConfig> = {}): XltTokenConfig => ({
  ...DEFAULT_XLT_TOKEN_CONFIG,
  ...overrides,
});

describe('UuidStrategy', () => {
  let strategy: UuidStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UuidStrategy],
    }).compile();
    strategy = module.get<UuidStrategy>(UuidStrategy);
  });

  describe('generateToken', () => {
    it('返回合法的 UUID v4 格式', () => {
      const token = strategy.generateToken({});
      expect(token).toMatch(UUID_REGEX);
    });

    it('多次调用返回不同值', () => {
      const set = new Set(Array.from({ length: 100 }, () => strategy.generateToken(null)));
      expect(set.size).toBe(100);
    });
  });

  describe('verifyToken', () => {
    it('直接返回原 token', () => {
      expect(strategy.verifyToken('abc')).toBe('abc');
    });
  });

  describe('createToken', () => {
    it('tokenStyle = uuid 生成标准 UUID', () => {
      const token = strategy.createToken('1', makeConfig({ tokenStyle: 'uuid' }));
      expect(token).toMatch(UUID_REGEX);
    });

    it('tokenStyle = simple-uuid 生成无分隔符的 UUID', () => {
      const token = strategy.createToken('1', makeConfig({ tokenStyle: 'simple-uuid' }));
      expect(token).toMatch(SIMPLE_UUID_REGEX);
    });

    it('tokenStyle = random-32 生成 32 位十六进制', () => {
      const token = strategy.createToken('1', makeConfig({ tokenStyle: 'random-32' }));
      expect(token).toMatch(RANDOM_32_REGEX);
    });

    it('createToken 不拼接 tokenPrefix（前缀由 StpLogic 处理）', () => {
      const token = strategy.createToken('1', makeConfig({ tokenStyle: 'uuid', tokenPrefix: 'Bearer ' }));
      expect(token.startsWith('Bearer ')).toBe(false);
      expect(token).toMatch(UUID_REGEX);
    });

    it('多次调用生成不重复的 token', () => {
      const cfg = makeConfig({ tokenStyle: 'uuid' });
      const set = new Set(Array.from({ length: 100 }, () => strategy.createToken('1', cfg)));
      expect(set.size).toBe(100);
    });

    it('未知 tokenStyle 回退到 random-32', () => {
      const token = strategy.createToken('1', makeConfig({ tokenStyle: 'unknown' as any }));
      expect(token).toMatch(RANDOM_32_REGEX);
    });
  });
});
