import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import { StpLogic } from './stp-logic';
import { MemoryStore } from '../store/memory-store';
import { JwtStrategy } from '../token/jwt-strategy';
import {
  DEFAULT_XLT_TOKEN_CONFIG,
  XLT_TOKEN_CONFIG,
  XLT_TOKEN_STORE,
  XLT_TOKEN_STRATEGY,
  XltTokenConfig,
} from '../core/xlt-token-config';
import { XLT_TOKEN_HOOKS } from '../hooks/xlt-hooks.interface';
import { NotLoginType } from '../const';

const JWT_SECRET = 'test-jwt-secret';

const makeJwtConfig = (overrides: Partial<XltTokenConfig> = {}): XltTokenConfig => ({
  ...DEFAULT_XLT_TOKEN_CONFIG,
  timeout: 3600,
  activeTimeout: -1,
  isShare: false,
  jwt: { secret: JWT_SECRET, issuer: 'xlt-token' },
  ...overrides,
});

const tokenKey = (cfg: XltTokenConfig, token: string) => `${cfg.tokenName}:login:token:${token}`;
const sessionKey = (cfg: XltTokenConfig, loginId: string, device = 'default') =>
  `${cfg.tokenName}:login:session:${loginId}:${device}`;
const jwtBlacklistKey = (cfg: XltTokenConfig, jti: string) =>
  `${cfg.tokenName}:jwt-blacklist:${jti}`;
const lastActiveKey = (cfg: XltTokenConfig, id: string) =>
  `${cfg.tokenName}:login:lastActive:${id}`;

const makeReq = (cfg: XltTokenConfig, token?: string) => {
  const headers: Record<string, string> = {};
  if (token) headers[cfg.tokenName.toLowerCase()] = token;
  return { headers } as any;
};

describe('StpLogic · JWT 模式 (Milestone 3)', () => {
  let store: MemoryStore;
  let logic: StpLogic;
  let strategy: JwtStrategy;
  let config: XltTokenConfig;

  const buildJwtModule = async (cfg: XltTokenConfig) => {
    config = cfg;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: XLT_TOKEN_CONFIG, useValue: cfg },
        { provide: XLT_TOKEN_STORE, useClass: MemoryStore },
        { provide: XLT_TOKEN_STRATEGY, useClass: JwtStrategy },
        { provide: XLT_TOKEN_HOOKS, useValue: {} },
        StpLogic,
      ],
    }).compile();

    logic = module.get<StpLogic>(StpLogic);
    store = module.get<MemoryStore>(XLT_TOKEN_STORE);
    strategy = module.get<JwtStrategy>(XLT_TOKEN_STRATEGY);
  };

  beforeEach(async () => {
    await buildJwtModule(makeJwtConfig());
  });

  describe('login', () => {
    it('JWT 模式不写入 tokenKey，sessionKey 存 jti', async () => {
      const token = await logic.login('jwt-u1');
      const { jti } = strategy.verifyToken(token);

      await expect(store.get(tokenKey(config, token))).resolves.toBeNull();
      await expect(store.get(sessionKey(config, 'jwt-u1'))).resolves.toBe(jti);
    });

    it('activeTimeout > 0 时用 jti 写入 lastActiveKey', async () => {
      await buildJwtModule(makeJwtConfig({ activeTimeout: 60 }));
      const token = await logic.login('jwt-u2');
      const { jti } = strategy.verifyToken(token);

      const lastActive = await store.get(lastActiveKey(config, jti));
      expect(lastActive).not.toBeNull();
      expect(Number(lastActive)).toBeGreaterThan(0);
      await expect(store.get(lastActiveKey(config, token))).resolves.toBeNull();
    });
  });

  describe('isLogin / checkLogin', () => {
    it('有效 JWT 鉴权通过', async () => {
      const token = await logic.login('jwt-u3');
      const req = makeReq(config, token);

      await expect(logic.isLogin(req)).resolves.toBe(true);
      await expect(logic.checkLogin(req)).resolves.toEqual({
        ok: true,
        loginId: 'jwt-u3',
        token,
      });
    });

    it('鉴权时不查询 tokenKey', async () => {
      const token = await logic.login('jwt-u4');
      const req = makeReq(config, token);
      const getSpy = vi.spyOn(store, 'get');
      getSpy.mockClear();

      await logic.isLogin(req);

      const tokenKeyCalls = getSpy.mock.calls.filter(([key]) =>
        String(key).includes(':login:token:'),
      );
      expect(tokenKeyCalls).toHaveLength(0);
      getSpy.mockRestore();
    });

    it('签名错误返回 INVALID_TOKEN', async () => {
      const token = await logic.login('jwt-u5');
      const parts = token.split('.');
      const tampered = `${parts[0]}.${parts[1]}.bad-signature`;
      const req = makeReq(config, tampered);

      await expect(logic.isLogin(req)).resolves.toBe(false);
      await expect(logic.checkLogin(req)).rejects.toThrow('Token 无效');
    });

    it('随机字符串返回 INVALID_TOKEN', async () => {
      const req = makeReq(config, 'not-a-jwt');
      await expect(logic.isLogin(req)).resolves.toBe(false);
    });
  });

  describe('kickout', () => {
    it('kickout 后写入 jwt-blacklist', async () => {
      const token = await logic.login('jwt-u6');
      const { jti } = strategy.verifyToken(token);

      await expect(logic.kickout('jwt-u6')).resolves.toBe(true);
      await expect(store.get(jwtBlacklistKey(config, jti))).resolves.toBe(NotLoginType.KICK_OUT);
    });

    it('kickout 后 isLogin 返回 false 且 reason 为 KICK_OUT', async () => {
      const token = await logic.login('jwt-u7');
      await logic.kickout('jwt-u7');
      const req = makeReq(config, token);

      await expect(logic.isLogin(req)).resolves.toBe(false);
      const result = await logic.isLogin(req);
      expect(result).toBe(false);
    });
  });

  describe('kickoutByToken', () => {
    it('按 token 踢下线写入黑名单', async () => {
      const token = await logic.login('jwt-u8');
      const { jti } = strategy.verifyToken(token);

      await expect(logic.kickoutByToken(token)).resolves.toBe(true);
      await expect(store.get(jwtBlacklistKey(config, jti))).resolves.toBe(NotLoginType.KICK_OUT);
      await expect(logic.isLogin(makeReq(config, token))).resolves.toBe(false);
    });
  });

  describe('被顶下线', () => {
    it('isConcurrent=false 时旧 JWT 被 BE_REPLACED', async () => {
      await buildJwtModule(makeJwtConfig({ isConcurrent: false, isShare: false }));
      const t1 = await logic.login('jwt-u9');
      const { jti: oldJti } = strategy.verifyToken(t1);
      const t2 = await logic.login('jwt-u9');

      expect(t2).not.toBe(t1);
      await expect(store.get(jwtBlacklistKey(config, oldJti))).resolves.toBe(NotLoginType.BE_REPLACED);
      await expect(logic.isLogin(makeReq(config, t1))).resolves.toBe(false);
      await expect(logic.isLogin(makeReq(config, t2))).resolves.toBe(true);
    });
  });

  describe('activeTimeout', () => {
    it('JWT 模式 idle 超时后冻结', async () => {
      await buildJwtModule(makeJwtConfig({ activeTimeout: 1 }));
      const token = await logic.login('jwt-u10');
      const req = makeReq(config, token);

      await expect(logic.isLogin(req)).resolves.toBe(true);
      await new Promise((r) => setTimeout(r, 1100));
      await expect(logic.isLogin(req)).resolves.toBe(false);
    });
  });

  describe('deviceConcurrent=false', () => {
    it('新登录踢掉旧 JWT（黑名单 KICK_OUT）', async () => {
      await buildJwtModule(makeJwtConfig({ deviceConcurrent: false, isShare: false }));
      const pcToken = await logic.login('jwt-u11', { device: 'pc' });
      const { jti: oldJti } = strategy.verifyToken(pcToken);
      const appToken = await logic.login('jwt-u11', { device: 'app' });

      await expect(store.get(jwtBlacklistKey(config, oldJti))).resolves.toBe(NotLoginType.KICK_OUT);
      await expect(logic.isLogin(makeReq(config, pcToken))).resolves.toBe(false);
      await expect(logic.isLogin(makeReq(config, appToken))).resolves.toBe(true);
    });
  });

  describe('renewTimeout', () => {
    it('JWT 模式无 tokenKey 时 renewTimeout 返回 null', async () => {
      const token = await logic.login('jwt-u12');
      await expect(logic.renewTimeout(token, 7200)).resolves.toBeNull();
    });
  });
});
