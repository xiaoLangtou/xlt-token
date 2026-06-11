import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_XLT_TOKEN_CONFIG, type XltTokenConfig } from '../../src/config/xlt-token-config.js';
import type { XltHooks } from '../../src/hooks/xlt-hooks.interface.js';
import { NotSafeException } from '../../src/exceptions/not-safe.exception.js';
import { NotLoginException } from '../../src/exceptions/not-login.exception.js';
import { createMockHttpContext } from '../../src/http/testing.js';
import { createStpLogic } from '../helpers/setup-stp-logic.js';
import type { MemoryStore } from '../../src/store/memory-store.js';
import type { StpLogic } from '../../src/auth/stp-logic.js';

const makeConfig = (overrides: Partial<XltTokenConfig> = {}): XltTokenConfig => ({
  ...DEFAULT_XLT_TOKEN_CONFIG,
  ...overrides,
});

const tokenKey = (cfg: XltTokenConfig, token: string) => `${cfg.tokenName}:login:token:${token}`;
const sessionKey = (cfg: XltTokenConfig, loginId: string, device = 'default') =>
  `${cfg.tokenName}:login:session:${loginId}:${device}`;
const sessionListKey = (cfg: XltTokenConfig, loginId: string) =>
  `${cfg.tokenName}:login:session-list:${loginId}`;
const lastActiveKey = (cfg: XltTokenConfig, token: string) => `${cfg.tokenName}:login:lastActive:${token}`;
const safeKey = (cfg: XltTokenConfig, token: string, business: string) =>
  `${cfg.tokenName}:safe:${token}:${business}`;
const tempTokenKey = (cfg: XltTokenConfig, tempToken: string) =>
  `${cfg.tokenName}:temp-token:${tempToken}`;

/** 构造请求对象，header key 使用 config.tokenName */
const makeReq = (cfg: XltTokenConfig, token?: string, prefix?: string) => {
  const headers: Record<string, string> = {};
  if (token) {
    headers[cfg.tokenName.toLowerCase()] = prefix ? `${prefix}${token}` : token;
  }
  return createMockHttpContext({ headers });
};

describe('StpLogic', () => {
  let store: MemoryStore;
  let logic: StpLogic;
  let config: XltTokenConfig;
  let hooks: XltHooks;

  const buildModule = async (cfg: XltTokenConfig, hookOverrides: XltHooks = {}) => {
    hooks = hookOverrides;
    ({ logic, store, config } = createStpLogic({ config: cfg, hooks: hookOverrides }));
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
    it('写入 tokenKey -> loginId 和 sessionKey -> token（含 device 后缀）', async () => {
      const token = await logic.login('u1');
      await expect(store.get(tokenKey(config, token))).resolves.toBe('u1');
      await expect(store.get(sessionKey(config, 'u1', 'default'))).resolves.toBe(token);
    });

    it('登录后写入 session-list 索引', async () => {
      const token = await logic.login('u1', { device: 'pc' });
      const raw = await store.get(sessionListKey(config, 'u1'));
      expect(raw).not.toBeNull();
      const list = JSON.parse(raw!);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ device: 'pc', token });
      expect(list[0].loginTime).toBeGreaterThan(0);
    });

    it('options.timeout 优先于 config.timeout', async () => {
      await buildModule(makeConfig({ timeout: 1000 }));
      const token = await logic.login('u1', { timeout: 50 });
      const ttl = await store.getTimeout(tokenKey(config, token));
      expect(ttl).toBeGreaterThan(45);
      expect(ttl).toBeLessThanOrEqual(50);
    });

    it('options.timeout 支持 DurationInput 字符串', async () => {
      await buildModule(makeConfig({ timeout: 1000 }));
      const token = await logic.login('u1', { timeout: '30s' });
      const ttl = await store.getTimeout(tokenKey(config, token));
      expect(ttl).toBeGreaterThan(25);
      expect(ttl).toBeLessThanOrEqual(30);
    });

    it('options.timeout 为 0 时 store 立即过期', async () => {
      await buildModule(makeConfig({ timeout: 1000 }));
      const token = await logic.login('u1', { timeout: 0 });
      const ttl = await store.getTimeout(tokenKey(config, token));
      // 0 表示立即过期，getTimeout 返回 -2
      expect(ttl).toBe(-2);
    });

    it('options.timeout 为 -1 时永不过期', async () => {
      await buildModule(makeConfig({ timeout: 1000 }));
      const token = await logic.login('u1', { timeout: -1 });
      const ttl = await store.getTimeout(tokenKey(config, token));
      expect(ttl).toBe(-1);
    });

    it('config.timeout 也支持 DurationInput', async () => {
      await buildModule(makeConfig({ timeout: '30s' as any }));
      const token = await logic.login('u1');
      const ttl = await store.getTimeout(tokenKey(config, token));
      expect(ttl).toBeGreaterThan(25);
      expect(ttl).toBeLessThanOrEqual(30);
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
      await expect(store.get(sessionKey(config, 'u1', 'default'))).resolves.toBe(t2);
    });
  });

  describe('多端登录 (Milestone 1)', () => {
    it('不同设备登录后 token 互不影响', async () => {
      const pcToken = await logic.login('u1', { device: 'pc' });
      const appToken = await logic.login('u1', { device: 'app' });
      expect(pcToken).not.toBe(appToken);
      await expect(logic.isLogin(makeReq(config, pcToken))).resolves.toBe(true);
      await expect(logic.isLogin(makeReq(config, appToken))).resolves.toBe(true);
    });

    it('isConcurrent=false 时同设备二次登录顶替旧 token', async () => {
      await buildModule(makeConfig({ isConcurrent: false, isShare: false }));
      const t1 = await logic.login('u1', { device: 'pc' });
      const t2 = await logic.login('u1', { device: 'pc' });
      expect(t2).not.toBe(t1);
      await expect(store.get(tokenKey(config, t1))).resolves.toBe('BE_REPLACED');
      await expect(logic.isLogin(makeReq(config, t1))).resolves.toBe(false);
      await expect(logic.isLogin(makeReq(config, t2))).resolves.toBe(true);
    });

    it('isConcurrent=false 时不同设备 token 不受影响', async () => {
      await buildModule(makeConfig({ isConcurrent: false, isShare: false }));
      const pcToken = await logic.login('u1', { device: 'pc' });
      const appToken = await logic.login('u1', { device: 'app' });
      await logic.login('u1', { device: 'pc' });
      await expect(logic.isLogin(makeReq(config, appToken))).resolves.toBe(true);
      await expect(logic.isLogin(makeReq(config, pcToken))).resolves.toBe(false);
    });

    it('deviceConcurrent=false 时新登录踢掉所有设备', async () => {
      await buildModule(makeConfig({ deviceConcurrent: false, isShare: false }));
      const pcToken = await logic.login('u1', { device: 'pc' });
      const appToken = await logic.login('u1', { device: 'app' });
      await expect(store.get(tokenKey(config, pcToken))).resolves.toBe('KICK_OUT');
      await expect(logic.isLogin(makeReq(config, pcToken))).resolves.toBe(false);
      await expect(logic.isLogin(makeReq(config, appToken))).resolves.toBe(true);
    });

    it('getDeviceList 返回所有在线设备', async () => {
      await logic.login('u1', { device: 'pc' });
      await logic.login('u1', { device: 'app' });
      const list = await logic.getDeviceList('u1');
      expect(list).toHaveLength(2);
      expect(list.map(d => d.device).sort()).toEqual(['app', 'pc']);
    });

    it('kickoutByDevice 只踢指定设备', async () => {
      const pcToken = await logic.login('u1', { device: 'pc' });
      const appToken = await logic.login('u1', { device: 'app' });
      await expect(logic.kickoutByDevice('u1', 'pc')).resolves.toBe(true);
      await expect(store.get(tokenKey(config, pcToken))).resolves.toBe('KICK_OUT');
      await expect(logic.isLogin(makeReq(config, pcToken))).resolves.toBe(false);
      await expect(logic.isLogin(makeReq(config, appToken))).resolves.toBe(true);
      const list = await logic.getDeviceList('u1');
      expect(list).toHaveLength(1);
      expect(list[0].device).toBe('app');
    });

    it('kickoutByDevice 设备不存在时返回 null', async () => {
      await expect(logic.kickoutByDevice('u1', 'missing')).resolves.toBeNull();
    });

    it('kickoutByToken 按 token 踢下线', async () => {
      const pcToken = await logic.login('u1', { device: 'pc' });
      const appToken = await logic.login('u1', { device: 'app' });
      await expect(logic.kickoutByToken(pcToken)).resolves.toBe(true);
      await expect(logic.isLogin(makeReq(config, pcToken))).resolves.toBe(false);
      await expect(logic.isLogin(makeReq(config, appToken))).resolves.toBe(true);
    });

    it('kickoutByToken 无效 token 返回 null', async () => {
      await expect(logic.kickoutByToken('invalid')).resolves.toBeNull();
    });

    it('logout 后从 session-list 移除对应设备', async () => {
      const pcToken = await logic.login('u1', { device: 'pc' });
      await logic.login('u1', { device: 'app' });
      await logic.logout(pcToken);
      const list = await logic.getDeviceList('u1');
      expect(list).toHaveLength(1);
      expect(list[0].device).toBe('app');
    });
  });

  describe('观测性 API (Milestone 1)', () => {
    it('getOnlineCount 返回在线用户数', async () => {
      await logic.login('u1');
      await logic.login('u2');
      await expect(logic.getOnlineCount()).resolves.toBe(2);
    });

    it('logout 后用户不在在线列表', async () => {
      const token = await logic.login('u1');
      await logic.logout(token);
      await expect(logic.getOnlineCount()).resolves.toBe(0);
      await expect(logic.getOnlineLoginIds()).resolves.toEqual([]);
    });

    it('getOnlineLoginIds 支持分页', async () => {
      await logic.login('u1');
      await logic.login('u2');
      await logic.login('u3');
      const page0 = await logic.getOnlineLoginIds({ page: 0, pageSize: 2 });
      expect(page0).toHaveLength(2);
      const page1 = await logic.getOnlineLoginIds({ page: 1, pageSize: 2 });
      expect(page1).toHaveLength(1);
    });

    it('forceLogout 清空所有设备', async () => {
      const pcToken = await logic.login('u1', { device: 'pc' });
      const appToken = await logic.login('u1', { device: 'app' });
      await logic.forceLogout('u1');
      await expect(logic.isLogin(makeReq(config, pcToken))).resolves.toBe(false);
      await expect(logic.isLogin(makeReq(config, appToken))).resolves.toBe(false);
      await expect(logic.getDeviceList('u1')).resolves.toEqual([]);
    });
  });

  describe('Hooks (Milestone 1)', () => {
    it('onLogin 登录成功后触发', async () => {
      const onLogin = vi.fn();
      await buildModule(makeConfig(), { onLogin });
      const token = await logic.login('u1', { device: 'pc' });
      expect(onLogin).toHaveBeenCalledWith('u1', token, 'pc');
    });

    it('onKickout kickoutByDevice 时触发', async () => {
      const onKickout = vi.fn();
      await buildModule(makeConfig(), { onKickout });
      const token = await logic.login('u1', { device: 'pc' });
      await logic.kickoutByDevice('u1', 'pc');
      expect(onKickout).toHaveBeenCalledWith('u1', token);
    });

    it('onKickout kickoutByToken 时触发', async () => {
      const onKickout = vi.fn();
      await buildModule(makeConfig(), { onKickout });
      const token = await logic.login('u1', { device: 'pc' });
      await logic.kickoutByToken(token);
      expect(onKickout).toHaveBeenCalledWith('u1', token);
    });

    it('onKickout kickout(loginId) 时触发', async () => {
      const onKickout = vi.fn();
      await buildModule(makeConfig(), { onKickout });
      const token = await logic.login('u1', { device: 'default' });
      await logic.kickout('u1');
      expect(onKickout).toHaveBeenCalledWith('u1', token);
    });

    it('onLogout logout 成功后触发', async () => {
      const onLogout = vi.fn();
      await buildModule(makeConfig(), { onLogout });
      const token = await logic.login('u1');
      await logic.logout(token);
      expect(onLogout).toHaveBeenCalledWith('u1', token, 'LOGOUT');
    });

    it('onReplaced 同设备顶号时触发', async () => {
      const onReplaced = vi.fn();
      await buildModule(makeConfig({ isConcurrent: false }), { onReplaced });
      const oldToken = await logic.login('u1', { device: 'pc' });
      const newToken = await logic.login('u1', { device: 'pc' });
      expect(onReplaced).toHaveBeenCalledWith('u1', oldToken, newToken);
    });

    it('钩子同步抛异常不影响主流程', async () => {
      const onLogin = vi.fn(() => { throw new Error('hook failed'); });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await buildModule(makeConfig(), { onLogin });
      const token = await logic.login('u1');
      expect(token).toBeTruthy();
      expect(onLogin).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('钩子异步 reject 不影响主流程', async () => {
      const onLogin = vi.fn().mockRejectedValue(new Error('async hook failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await buildModule(makeConfig(), { onLogin });
      const token = await logic.login('u1');
      expect(token).toBeTruthy();
      await new Promise((r) => setTimeout(r, 10));
      expect(onLogin).toHaveBeenCalled();
      consoleSpy.mockRestore();
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
      const req = createMockHttpContext({ cookies: { [config.tokenName]: token } });
      await expect(logic.getTokenValue(req)).resolves.toBe(token);
    });

    it('从 query 读取 token', async () => {
      await buildModule(makeConfig({ isReadQuery: true, isReadHeader: false }));
      const token = await logic.login('u1');
      const req = createMockHttpContext({ query: { [config.tokenName]: token } });
      await expect(logic.getTokenValue(req)).resolves.toBe(token);
    });

    it('header token 裁剪 prefix', async () => {
      const token = await logic.login('u1');
      const req = makeReq(config, token, config.tokenPrefix);
      await expect(logic.getTokenValue(req)).resolves.toBe(token);
    });

    it('header 为空时返回 null', async () => {
      const req = createMockHttpContext({ headers: {} });
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

  describe('二级认证 (Milestone 2)', () => {
    it('openSafe 后 checkSafe 通过', async () => {
      const token = await logic.login('u1');
      await logic.openSafe(token, 'pay', 300);
      await expect(logic.checkSafe(token, 'pay')).resolves.toBeUndefined();
    });

    it('未 openSafe 时 checkSafe 抛 NotSafeException', async () => {
      const token = await logic.login('u1');
      await expect(logic.checkSafe(token, 'pay')).rejects.toThrow(NotSafeException);
      await expect(logic.checkSafe(token, 'pay')).rejects.toMatchObject({ business: 'pay' });
    });

    it('超时后 checkSafe 抛 NotSafeException', async () => {
      const token = await logic.login('u1');
      await logic.openSafe(token, 'pay', 1);
      await new Promise((r) => setTimeout(r, 1100));
      await expect(logic.checkSafe(token, 'pay')).rejects.toThrow(NotSafeException);
    });

    it('closeSafe 后 checkSafe 抛 NotSafeException', async () => {
      const token = await logic.login('u1');
      await logic.openSafe(token, 'pay', 300);
      await logic.closeSafe(token, 'pay');
      await expect(logic.checkSafe(token, 'pay')).rejects.toThrow(NotSafeException);
    });

    it('不同 business 互不影响', async () => {
      const token = await logic.login('u1');
      await logic.openSafe(token, 'pay', 300);
      await expect(logic.checkSafe(token, 'pay')).resolves.toBeUndefined();
      await expect(logic.checkSafe(token, 'deleteAccount')).rejects.toThrow(NotSafeException);
    });

    it('openSafe 写入 safeKey 并记录打开时间', async () => {
      const token = await logic.login('u1');
      const before = Date.now();
      await logic.openSafe(token, 'pay', 300);
      const raw = await store.get(safeKey(config, token, 'pay'));
      expect(raw).not.toBeNull();
      expect(Number(raw)).toBeGreaterThanOrEqual(before);
    });
  });

  describe('临时 Token (Milestone 2)', () => {
    it('createTempToken 返回 token 且 parseTempToken 读取正确', async () => {
      const tempToken = await logic.createTempToken('resetPwd:1001', 600);
      expect(tempToken).toBeTruthy();
      await expect(logic.parseTempToken(tempToken)).resolves.toBe('resetPwd:1001');
      await expect(store.get(tempTokenKey(config, tempToken))).resolves.toBe('resetPwd:1001');
    });

    it('超时后 parseTempToken 返回 null', async () => {
      const tempToken = await logic.createTempToken('resetPwd:1001', 1);
      await new Promise((r) => setTimeout(r, 1100));
      await expect(logic.parseTempToken(tempToken)).resolves.toBeNull();
    });

    it('deleteTempToken 后不可再读', async () => {
      const tempToken = await logic.createTempToken('resetPwd:1001', 600);
      await logic.deleteTempToken(tempToken);
      await expect(logic.parseTempToken(tempToken)).resolves.toBeNull();
      await expect(store.has(tempTokenKey(config, tempToken))).resolves.toBe(false);
    });

    it('不同 tempToken 互不影响', async () => {
      const t1 = await logic.createTempToken('action:a', 600);
      const t2 = await logic.createTempToken('action:b', 600);
      await expect(logic.parseTempToken(t1)).resolves.toBe('action:a');
      await expect(logic.parseTempToken(t2)).resolves.toBe('action:b');
      await logic.deleteTempToken(t1);
      await expect(logic.parseTempToken(t1)).resolves.toBeNull();
      await expect(logic.parseTempToken(t2)).resolves.toBe('action:b');
    });
  });
});
