import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { StpLogic } from './stp-logic';
import { MemoryStore } from '../store/memory-store';
import { UuidStrategy } from '../token/uuid-strategy';
import {
  DEFAULT_XLT_TOKEN_CONFIG,
  XLT_TOKEN_CONFIG,
  XLT_TOKEN_STORE,
  XLT_TOKEN_STRATEGY,
  XltTokenConfig,
} from '../core/xlt-token-config';

const makeConfig = (overrides: Partial<XltTokenConfig> = {}): XltTokenConfig => ({
  ...DEFAULT_XLT_TOKEN_CONFIG,
  ...overrides,
});

const tokenKey = (cfg: XltTokenConfig, token: string) => `${cfg.tokenName}:login:token:${token}`;
const sessionKey = (cfg: XltTokenConfig, loginId: string) => `${cfg.tokenName}:login:session:${loginId}`;
const lastActiveKey = (cfg: XltTokenConfig, token: string) => `${cfg.tokenName}:login:lastActive:${token}`;

/** 构造请求对象，header key 使用 config.tokenName */
const makeReq = (cfg: XltTokenConfig, token?: string, prefix?: string) => {
  const headers: Record<string, string> = {};
  if (token) {
    headers[cfg.tokenName.toLowerCase()] = prefix ? `${prefix}${token}` : token;
  }
  return { headers } as any;
};

describe('StpLogic', () => {
  let store: MemoryStore;
  let logic: StpLogic;
  let config: XltTokenConfig;

  const buildModule = async (cfg: XltTokenConfig) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: XLT_TOKEN_CONFIG, useValue: cfg },
        { provide: XLT_TOKEN_STORE, useClass: MemoryStore },
        { provide: XLT_TOKEN_STRATEGY, useClass: UuidStrategy },
        StpLogic,
      ],
    }).compile();

    logic = module.get<StpLogic>(StpLogic);
    store = module.get<MemoryStore>(XLT_TOKEN_STORE);
    config = cfg;
  };

  beforeEach(async () => {
    await buildModule(makeConfig());
  });

  describe('login - 入参校验', () => {
    it.each([null, undefined, ''])('loginId 为 %p 时抛出异常', async (invalid) => {
      await expect(logic.login(invalid as any)).rejects.toThrow('invalid loginId');
    });

    it('loginId 包含 : 时抛出异常', async () => {
      await expect(logic.login('a:b')).rejects.toThrow('invalid loginId');
    });

    it('number 类型的 loginId 能成功登录', async () => {
      const token = await logic.login(123);
      expect(token).toBeTruthy();
      await expect(store.get(tokenKey(config, token))).resolves.toBe('123');
    });
  });

  describe('login - 写入 Store', () => {
    it('写入 tokenKey -> loginId 和 sessionKey -> token', async () => {
      const token = await logic.login('u1');
      await expect(store.get(tokenKey(config, token))).resolves.toBe('u1');
      await expect(store.get(sessionKey(config, 'u1'))).resolves.toBe(token);
    });

    it('options.timeout 优先于 config.timeout', async () => {
      await buildModule(makeConfig({ timeout: 1000 }));
      const token = await logic.login('u1', { timeout: 50 });
      const ttl = await store.getTimeout(tokenKey(config, token));
      expect(ttl).toBeGreaterThan(45);
      expect(ttl).toBeLessThanOrEqual(50);
    });

    it('activeTimeout > 0 时会写入 lastActiveKey', async () => {
      await buildModule(makeConfig({ activeTimeout: 60 }));
      const token = await logic.login('u1');
      const lastActive = await store.get(lastActiveKey(config, token));
      expect(lastActive).not.toBeNull();
      expect(Number(lastActive)).toBeGreaterThan(0);
    });

    it('activeTimeout <= 0 时不会写入 lastActiveKey', async () => {
      const token = await logic.login('u1');
      await expect(store.get(lastActiveKey(config, token))).resolves.toBeNull();
    });

    it('options.token 优先使用外部传入的 token', async () => {
      const token = await logic.login('u1', { token: 'custom-token' });
      expect(token).toBe('custom-token');
      await expect(store.get(tokenKey(config, 'custom-token'))).resolves.toBe('u1');
    });
  });

  describe('login - isConcurrent / isShare 策略', () => {
    it('isConcurrent=true & isShare=true: 二次登录复用旧 token', async () => {
      const t1 = await logic.login('u1');
      const t2 = await logic.login('u1');
      expect(t2).toBe(t1);
    });

    it('isConcurrent=true & isShare=false: 二次登录生成新 token', async () => {
      await buildModule(makeConfig({ isConcurrent: true, isShare: false }));
      const t1 = await logic.login('u1');
      const t2 = await logic.login('u1');
      expect(t2).not.toBe(t1);
    });

    it('isConcurrent=false: 二次登录会顶替旧 token', async () => {
      await buildModule(makeConfig({ isConcurrent: false }));
      const t1 = await logic.login('u1');
      const t2 = await logic.login('u1');
      expect(t2).not.toBe(t1);
      await expect(store.get(tokenKey(config, t1))).resolves.toBe('BE_REPLACED');
      await expect(store.get(tokenKey(config, t2))).resolves.toBe('u1');
      await expect(store.get(sessionKey(config, 'u1'))).resolves.toBe(t2);
    });
  });

  describe('getTokenValue', () => {
    it('从 header 读取 token', async () => {
      const token = await logic.login('u1');
      const req = makeReq(config, token);
      await expect(logic.getTokenValue(req)).resolves.toBe(token);
    });

    it('从 cookie 读取 token', async () => {
      await buildModule(makeConfig({ isReadCookie: true, isReadHeader: false }));
      const token = await logic.login('u1');
      const req = { cookies: { [config.tokenName]: token } } as any;
      await expect(logic.getTokenValue(req)).resolves.toBe(token);
    });

    it('从 query 读取 token', async () => {
      await buildModule(makeConfig({ isReadQuery: true, isReadHeader: false }));
      const token = await logic.login('u1');
      const req = { query: { [config.tokenName]: token } } as any;
      await expect(logic.getTokenValue(req)).resolves.toBe(token);
    });

    it('header token 裁剪 prefix', async () => {
      const token = await logic.login('u1');
      const req = makeReq(config, token, config.tokenPrefix);
      await expect(logic.getTokenValue(req)).resolves.toBe(token);
    });

    it('header 为空时返回 null', async () => {
      const req = { headers: {} } as any;
      await expect(logic.getTokenValue(req)).resolves.toBeNull();
    });
  });

  describe('isLogin / checkLogin', () => {
    it('有效 token 返回 true', async () => {
      const token = await logic.login('u1');
      const req = makeReq(config, token);
      await expect(logic.isLogin(req)).resolves.toBe(true);
      await expect(logic.checkLogin(req)).resolves.toEqual({ ok: true, loginId: 'u1', token });
    });

    it('无 token 返回 false 并抛 NotLoginException', async () => {
      const req = makeReq(config);
      await expect(logic.isLogin(req)).resolves.toBe(false);
      await expect(logic.checkLogin(req)).rejects.toThrow('未提供 Token');
    });

    it('无效 token 返回 false', async () => {
      const req = makeReq(config, 'invalid-token');
      await expect(logic.isLogin(req)).resolves.toBe(false);
      await expect(logic.checkLogin(req)).rejects.toThrow('Token 无效');
    });

    it('被顶号的 token 返回 false', async () => {
      await buildModule(makeConfig({ isConcurrent: false }));
      const t1 = await logic.login('u1');
      await logic.login('u1');
      const req = makeReq(config, t1);
      await expect(logic.isLogin(req)).resolves.toBe(false);
      await expect(logic.checkLogin(req)).rejects.toThrow('已被顶下线');
    });

    it('被踢出的 token 返回 false', async () => {
      const token = await logic.login('u1');
      await logic.kickout('u1');
      const req = makeReq(config, token);
      await expect(logic.isLogin(req)).resolves.toBe(false);
      await expect(logic.checkLogin(req)).rejects.toThrow('已被踢下线');
    });
  });

  describe('activeTimeout 冻结逻辑', () => {
    it('activeTimeout > 0 时超时不操作会冻结', async () => {
      await buildModule(makeConfig({ activeTimeout: 1 }));
      const token = await logic.login('u1');
      const req = makeReq(config, token);
      await expect(logic.isLogin(req)).resolves.toBe(true);
      await new Promise((r) => setTimeout(r, 1100));
      await expect(logic.isLogin(req)).resolves.toBe(false);
    });

    it('activeTimeout <= 0 时不做冻结检查', async () => {
      const token = await logic.login('u1');
      const req = makeReq(config, token);
      await new Promise((r) => setTimeout(r, 1100));
      await expect(logic.isLogin(req)).resolves.toBe(true);
    });
  });

  describe('logout', () => {
    it('logout 后 isLogin 返回 false', async () => {
      const token = await logic.login('u1');
      await expect(logic.logout(token)).resolves.toBe(true);
      const req = makeReq(config, token);
      await expect(logic.isLogin(req)).resolves.toBe(false);
    });

    it('logout 不存在的 token 返回 null', async () => {
      await expect(logic.logout('invalid')).resolves.toBeNull();
    });

    it('logout 空字符串返回 null', async () => {
      await expect(logic.logout('')).resolves.toBeNull();
    });
  });

  describe('logoutByLoginId', () => {
    it('按 loginId 全端登出', async () => {
      const token = await logic.login('u1');
      await expect(logic.logoutByLoginId('u1')).resolves.toBe(true);
      const req = makeReq(config, token);
      await expect(logic.isLogin(req)).resolves.toBe(false);
    });

    it('logoutByLoginId 不存在的账号返回 null', async () => {
      await expect(logic.logoutByLoginId('not-exist')).resolves.toBeNull();
    });
  });

  describe('kickout', () => {
    it('kickout 后 token 被标记为 KICK_OUT', async () => {
      const token = await logic.login('u1');
      await expect(logic.kickout('u1')).resolves.toBe(true);
      await expect(store.get(tokenKey(config, token))).resolves.toBe('KICK_OUT');
    });

    it('kickout 后 checkLogin 抛异常', async () => {
      const token = await logic.login('u1');
      await logic.kickout('u1');
      const req = makeReq(config, token);
      await expect(logic.checkLogin(req)).rejects.toThrow('已被踢下线');
    });

    it('kickout 不存在的账号返回 null', async () => {
      await expect(logic.kickout('not-exist')).resolves.toBeNull();
    });
  });

  describe('renewTimeout', () => {
    it('续签成功延长过期时间', async () => {
      await buildModule(makeConfig({ timeout: 100 }));
      const token = await logic.login('u1');
      await expect(logic.renewTimeout(token, 200)).resolves.toBe(true);
      const ttl = await store.getTimeout(tokenKey(config, token));
      expect(ttl).toBeGreaterThan(190);
      expect(ttl).toBeLessThanOrEqual(200);
    });

    it('续签不存在的 token 返回 null', async () => {
      await expect(logic.renewTimeout('invalid', 100)).resolves.toBeNull();
    });

    it('activeTimeout 启用时续签也会更新 lastActiveKey', async () => {
      await buildModule(makeConfig({ activeTimeout: 60 }));
      const token = await logic.login('u1');
      await logic.renewTimeout(token, 200);
      const ttl = await store.getTimeout(lastActiveKey(config, token));
      expect(ttl).toBeGreaterThan(190);
      expect(ttl).toBeLessThanOrEqual(200);
    });
  });

  describe('getSession', () => {
    it('返回 XltSession 实例，可读写', async () => {
      const token = await logic.login('u1');
      const session = logic.getSession('u1');
      await session.set('name', 'Alice');
      expect(await session.get('name')).toBe('Alice');
    });

    it('logout 后 session-data 被清理', async () => {
      const token = await logic.login('u1');
      const session = logic.getSession('u1');
      await session.set('name', 'Alice');
      await logic.logout(token);
      const session2 = logic.getSession('u1');
      expect(await session2.get('name')).toBeNull();
    });
  });

  describe('下线记录', () => {
    it('offlineRecordEnabled=true 时 kickout 写入下线记录', async () => {
      await buildModule(makeConfig({ offlineRecordEnabled: true }));
      const token = await logic.login('u1');
      await logic.kickout('u1');
      const record = await logic.getOfflineRecords(token);
      expect(record).not.toBeNull();
      expect(record!.reason).toBe('KICK_OUT');
      expect(record!.time).toBeGreaterThan(0);
    });

    it('offlineRecordEnabled=false 时不写入下线记录', async () => {
      const token = await logic.login('u1');
      await logic.kickout('u1');
      const record = await logic.getOfflineRecords(token);
      expect(record).toBeNull();
    });
  });
});
