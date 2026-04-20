import { StpLogic } from './stp-logic';
import { MemoryStore } from '../store/memory-store';
import { UuidStrategy } from '../token/uuid-strategy';
import { DEFAULT_XLT_TOKEN_CONFIG, XltTokenConfig } from '../core/xlt-token-config';

const makeConfig = (overrides: Partial<XltTokenConfig> = {}): XltTokenConfig => ({
  ...DEFAULT_XLT_TOKEN_CONFIG,
  ...overrides,
});

const tokenKey = (cfg: XltTokenConfig, token: string) => `${cfg.tokenName}:login:token:${token}`;
const sessionKey = (cfg: XltTokenConfig, loginId: string) => `${cfg.tokenName}:login:session:${loginId}`;
const lastActiveKey = (cfg: XltTokenConfig, token: string) => `${cfg.tokenName}:login:lastActive:${token}`;

describe('StpLogic', () => {
  let store: MemoryStore;
  let strategy: UuidStrategy;

  beforeEach(() => {
    store = new MemoryStore();
    strategy = new UuidStrategy();
  });

  const build = (config: XltTokenConfig) => new StpLogic(config, store, strategy);

  describe('login - 入参校验', () => {
    it.each([null, undefined, ''])('loginId 为 %p 时抛出异常', async (invalid) => {
      const logic = build(makeConfig());
      await expect(logic.login(invalid as any)).rejects.toThrow('invalid loginId');
    });

    it('loginId 包含 : 时抛出异常', async () => {
      const logic = build(makeConfig());
      await expect(logic.login('a:b')).rejects.toThrow('invalid loginId');
    });

    it('number 类型的 loginId 能成功登录', async () => {
      const logic = build(makeConfig());
      const token = await logic.login(123);
      expect(token).toBeTruthy();
      await expect(store.get(tokenKey(makeConfig(), token))).resolves.toBe('123');
    });
  });

  describe('login - 写入 Store', () => {
    it('写入 tokenKey -> loginId 和 sessionKey -> token 两条记录', async () => {
      const config = makeConfig();
      const logic = build(config);
      const token = await logic.login('u1');

      await expect(store.get(tokenKey(config, token))).resolves.toBe('u1');
      await expect(store.get(sessionKey(config, 'u1'))).resolves.toBe(token);
    });

    it('options.timeout 优先于 config.timeout', async () => {
      const config = makeConfig({ timeout: 1000 });
      const logic = build(config);
      const token = await logic.login('u1', { timeout: 50 });
      const ttl = await store.getTimeout(tokenKey(config, token));
      expect(ttl).toBeGreaterThan(45);
      expect(ttl).toBeLessThanOrEqual(50);
    });

    it('activeTimeout > 0 时会写入 lastActiveKey', async () => {
      const config = makeConfig({ activeTimeout: 60 });
      const logic = build(config);
      const token = await logic.login('u1');
      const lastActive = await store.get(lastActiveKey(config, token));
      expect(lastActive).not.toBeNull();
      expect(Number(lastActive)).toBeGreaterThan(0);
    });

    it('activeTimeout <= 0 时不会写入 lastActiveKey', async () => {
      const config = makeConfig({ activeTimeout: -1 });
      const logic = build(config);
      const token = await logic.login('u1');
      await expect(store.get(lastActiveKey(config, token))).resolves.toBeNull();
    });

    it('options.token 优先使用外部传入的 token', async () => {
      const config = makeConfig();
      const logic = build(config);
      const token = await logic.login('u1', { token: 'custom-token' });
      expect(token).toBe('custom-token');
      await expect(store.get(tokenKey(config, 'custom-token'))).resolves.toBe('u1');
    });
  });

  describe('login - isConcurrent / isShare 策略', () => {
    it('isConcurrent=true & isShare=true: 二次登录复用旧 token', async () => {
      const config = makeConfig({ isConcurrent: true, isShare: true });
      const logic = build(config);
      const t1 = await logic.login('u1');
      const t2 = await logic.login('u1');
      expect(t2).toBe(t1);
    });

    it('isConcurrent=true & isShare=false: 二次登录生成新 token', async () => {
      const config = makeConfig({ isConcurrent: true, isShare: false });
      const logic = build(config);
      const t1 = await logic.login('u1');
      const t2 = await logic.login('u1');
      expect(t2).not.toBe(t1);
    });

    it('isConcurrent=false: 二次登录会顶替旧 token', async () => {
      const config = makeConfig({ isConcurrent: false });
      const logic = build(config);
      const t1 = await logic.login('u1');
      const t2 = await logic.login('u1');

      // 新 token 与旧 token 不同
      expect(t2).not.toBe(t1);
      // 旧 token 对应的登录态被标记为 BE_REPLACED
      await expect(store.get(tokenKey(config, t1))).resolves.toBe('BE_REPLACED');
      // 新 token 正常映射到 loginId
      await expect(store.get(tokenKey(config, t2))).resolves.toBe('u1');
      // sessionKey 指向新 token
      await expect(store.get(sessionKey(config, 'u1'))).resolves.toBe(t2);
    });
  });

  describe('getTokenValue', () => {
    it('从 header 读取 token', async () => {
      const config = makeConfig({ isReadHeader: true });
      const logic = build(config);
      const token = await logic.login('u1');
      const req = { headers: { st: token } } as any;
      await expect(logic.getTokenValue(req)).resolves.toBe(token);
    });

    it('从 cookie 读取 token', async () => {
      const config = makeConfig({ isReadCookie: true, isReadHeader: false });
      const logic = build(config);
      const token = await logic.login('u1');
      const req = { cookies: { st: token } } as any;
      await expect(logic.getTokenValue(req)).resolves.toBe(token);
    });

    it('从 query 读取 token', async () => {
      const config = makeConfig({ isReadQuery: true, isReadHeader: false });
      const logic = build(config);
      const token = await logic.login('u1');
      const req = { query: { st: token } } as any;
      await expect(logic.getTokenValue(req)).resolves.toBe(token);
    });

    it('header token 裁剪 prefix', async () => {
      const config = makeConfig({ tokenPrefix: 'Bearer ' });
      const logic = build(config);
      const token = await logic.login('u1');
      const req = { headers: { st: `Bearer ${token}` } } as any;
      await expect(logic.getTokenValue(req)).resolves.toBe(token);
    });

    it('header 为空时返回 null', async () => {
      const config = makeConfig();
      const logic = build(config);
      const req = { headers: {} } as any;
      await expect(logic.getTokenValue(req)).resolves.toBeNull();
    });
  });

  describe('isLogin / checkLogin', () => {
    it('有效 token 返回 true', async () => {
      const config = makeConfig();
      const logic = build(config);
      const token = await logic.login('u1');
      const req = { headers: { st: token } } as any;
      await expect(logic.isLogin(req)).resolves.toBe(true);
      await expect(logic.checkLogin(req)).resolves.toEqual({ ok: true, loginId: 'u1', token });
    });

    it('无 token 返回 false', async () => {
      const config = makeConfig();
      const logic = build(config);
      const req = { headers: {} } as any;
      await expect(logic.isLogin(req)).resolves.toBe(false);
      await expect(logic.checkLogin(req)).rejects.toThrow('NOT_TOKEN');
    });

    it('无效 token 返回 false', async () => {
      const config = makeConfig();
      const logic = build(config);
      const req = { headers: { st: 'invalid-token' } } as any;
      await expect(logic.isLogin(req)).resolves.toBe(false);
      await expect(logic.checkLogin(req)).rejects.toThrow('INVALID_TOKEN');
    });

    it('被顶号的 token 返回 false', async () => {
      const config = makeConfig({ isConcurrent: false });
      const logic = build(config);
      const t1 = await logic.login('u1');
      await logic.login('u1'); // 顶号
      const req = { headers: { st: t1 } } as any;
      await expect(logic.isLogin(req)).resolves.toBe(false);
      await expect(logic.checkLogin(req)).rejects.toThrow('BE_REPLACED');
    });

    it('被踢出的 token 返回 false', async () => {
      const config = makeConfig();
      const logic = build(config);
      const token = await logic.login('u1');
      await logic.kickout('u1');
      const req = { headers: { st: token } } as any;
      await expect(logic.isLogin(req)).resolves.toBe(false);
      await expect(logic.checkLogin(req)).rejects.toThrow('KICK_OUT');
    });
  });

  describe('activeTimeout 冻结逻辑', () => {
    it('activeTimeout > 0 时超时不操作会冻结', async () => {
      const config = makeConfig({ activeTimeout: 1 });
      const logic = build(config);
      const token = await logic.login('u1');
      const req = { headers: { st: token } } as any;

      // 立即检查应该通过
      await expect(logic.isLogin(req)).resolves.toBe(true);

      // 等待 1.1 秒（超过 activeTimeout）
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // 再次检查应该被冻结
      await expect(logic.isLogin(req)).resolves.toBe(false);
      await expect(logic.checkLogin(req)).rejects.toThrow('TOKEN_TIMEOUT');
    });

    it('activeTimeout <= 0 时不做冻结检查', async () => {
      const config = makeConfig({ activeTimeout: -1 });
      const logic = build(config);
      const token = await logic.login('u1');
      const req = { headers: { st: token } } as any;

      // 等待一段时间
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // 仍然应该通过
      await expect(logic.isLogin(req)).resolves.toBe(true);
    });
  });

  describe('logout', () => {
    it('logout 后 isLogin 返回 false', async () => {
      const config = makeConfig();
      const logic = build(config);
      const token = await logic.login('u1');
      await expect(logic.logout(token)).resolves.toBe(true);

      const req = { headers: { st: token } } as any;
      await expect(logic.isLogin(req)).resolves.toBe(false);
    });

    it('logout 不存在的 token 返回 null', async () => {
      const config = makeConfig();
      const logic = build(config);
      await expect(logic.logout('invalid')).resolves.toBeNull();
    });

    it('logout 空字符串返回 null', async () => {
      const config = makeConfig();
      const logic = build(config);
      await expect(logic.logout('')).resolves.toBeNull();
    });
  });

  describe('logoutByLoginId', () => {
    it('按 loginId 全端登出', async () => {
      const config = makeConfig();
      const logic = build(config);
      const token = await logic.login('u1');
      await expect(logic.logoutByLoginId('u1')).resolves.toBe(true);

      const req = { headers: { st: token } } as any;
      await expect(logic.isLogin(req)).resolves.toBe(false);
    });

    it('logoutByLoginId 不存在的账号返回 null', async () => {
      const config = makeConfig();
      const logic = build(config);
      await expect(logic.logoutByLoginId('not-exist')).resolves.toBeNull();
    });
  });

  describe('kickout', () => {
    it('kickout 后 token 被标记为 KICK_OUT', async () => {
      const config = makeConfig();
      const logic = build(config);
      const token = await logic.login('u1');
      await expect(logic.kickout('u1')).resolves.toBe(true);

      await expect(store.get(tokenKey(config, token))).resolves.toBe('KICK_OUT');
    });

    it('kickout 后 checkLogin 抛 KICK_OUT', async () => {
      const config = makeConfig();
      const logic = build(config);
      const token = await logic.login('u1');
      await logic.kickout('u1');

      const req = { headers: { st: token } } as any;
      await expect(logic.checkLogin(req)).rejects.toThrow('KICK_OUT');
    });

    it('kickout 不存在的账号返回 null', async () => {
      const config = makeConfig();
      const logic = build(config);
      await expect(logic.kickout('not-exist')).resolves.toBeNull();
    });
  });

  describe('renewTimeout', () => {
    it('续签成功延长过期时间', async () => {
      const config = makeConfig({ timeout: 100 });
      const logic = build(config);
      const token = await logic.login('u1');

      // 续签到 200 秒
      await expect(logic.renewTimeout(token, 200)).resolves.toBe(true);

      const ttl = await store.getTimeout(tokenKey(config, token));
      expect(ttl).toBeGreaterThan(190);
      expect(ttl).toBeLessThanOrEqual(200);
    });

    it('续签不存在的 token 返回 null', async () => {
      const config = makeConfig();
      const logic = build(config);
      await expect(logic.renewTimeout('invalid', 100)).resolves.toBeNull();
    });

    it('activeTimeout 启用时续签也会更新 lastActiveKey', async () => {
      const config = makeConfig({ activeTimeout: 60 });
      const logic = build(config);
      const token = await logic.login('u1');

      await logic.renewTimeout(token, 200);

      const ttl = await store.getTimeout(lastActiveKey(config, token));
      expect(ttl).toBeGreaterThan(190);
      expect(ttl).toBeLessThanOrEqual(200);
    });
  });
});
