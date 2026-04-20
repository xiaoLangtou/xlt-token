import { UuidStrategy } from './uuid-strategy';
import { DEFAULT_XLT_TOKEN_CONFIG, XltTokenConfig } from '../core/xlt-token-config';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SIMPLE_UUID_REGEX = /^[0-9a-f]{32}$/;
const RANDOM_32_REGEX = /^[0-9a-f]{32}$/;

describe('UuidStrategy', () => {
  let strategy: UuidStrategy;

  beforeEach(() => {
    strategy = new UuidStrategy();
  });

  const makeConfig = (overrides: Partial<XltTokenConfig> = {}): XltTokenConfig => ({
    ...DEFAULT_XLT_TOKEN_CONFIG,
    ...overrides,
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
      const token = strategy.createToken('1', makeConfig({ tokenStyle: 'uuid', tokenPrefix: '' }));
      expect(token).toMatch(UUID_REGEX);
    });

    it('tokenStyle = simple-uuid 生成无分隔符的 UUID', () => {
      const token = strategy.createToken('1', makeConfig({ tokenStyle: 'simple-uuid', tokenPrefix: '' }));
      expect(token).toMatch(SIMPLE_UUID_REGEX);
    });

    it('tokenStyle = random-32 生成 32 位十六进制', () => {
      const token = strategy.createToken('1', makeConfig({ tokenStyle: 'random-32', tokenPrefix: '' }));
      expect(token).toMatch(RANDOM_32_REGEX);
    });

    it('tokenPrefix 会拼到生成的 token 前面', () => {
      const token = strategy.createToken('1', makeConfig({ tokenStyle: 'uuid', tokenPrefix: 'Bearer_' }));
      expect(token.startsWith('Bearer_')).toBe(true);
      expect(token.slice('Bearer_'.length)).toMatch(UUID_REGEX);
    });

    it('多次调用生成不重复的 token', () => {
      const config = makeConfig({ tokenStyle: 'uuid', tokenPrefix: '' });
      const set = new Set(Array.from({ length: 100 }, () => strategy.createToken('1', config)));
      expect(set.size).toBe(100);
    });

    it('未知 tokenStyle 回退到标准 UUID', () => {
      const token = strategy.createToken(
        '1',
        makeConfig({ tokenStyle: 'unknown' as any, tokenPrefix: '' }),
      );
      expect(token).toMatch(UUID_REGEX);
    });
  });
});
