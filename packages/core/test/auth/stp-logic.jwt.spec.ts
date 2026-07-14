import { describe, it, expect, beforeEach, vi } from "vitest";
import { TestJwtStrategy } from "../helpers/test-jwt-strategy.js";
import {
  DEFAULT_XLT_TOKEN_CONFIG,
  type XltTokenConfig,
} from "../../src/config/xlt-token-config.js";
import { NotLoginType } from "../../src/const/index.js";
import { createMockHttpContext } from "../../src/http/testing.js";
import { createStpLogic } from "../helpers/setup-stp-logic.js";
import type { MemoryStore } from "../../src/store/memory-store.js";
import type { StpLogic } from "../../src/auth/stp-logic.js";

const JWT_SECRET = "test-jwt-secret";

const makeJwtConfig = (overrides: Partial<XltTokenConfig> = {}): XltTokenConfig => ({
  ...DEFAULT_XLT_TOKEN_CONFIG,
  timeout: 3600,
  activeTimeout: -1,
  isShare: false,
  jwt: { secret: JWT_SECRET, issuer: "xlt-token" },
  ...overrides,
});

const tokenKey = (cfg: XltTokenConfig, token: string) => `${cfg.tokenName}:login:token:${token}`;
const sessionKey = (cfg: XltTokenConfig, loginId: string, device = "default") =>
  `${cfg.tokenName}:login:session:${loginId}:${device}`;
const jwtBlacklistKey = (cfg: XltTokenConfig, jti: string) =>
  `${cfg.tokenName}:jwt-blacklist:${jti}`;
const lastActiveKey = (cfg: XltTokenConfig, id: string) =>
  `${cfg.tokenName}:login:lastActive:${id}`;
const sessionListKey = (cfg: XltTokenConfig, loginId: string) =>
  `${cfg.tokenName}:login:session-list:${loginId}`;

const makeReq = (cfg: XltTokenConfig, token?: string) => {
  const headers: Record<string, string> = {};
  if (token) headers[cfg.tokenName.toLowerCase()] = token;
  return createMockHttpContext({ headers });
};

describe("StpLogic · JWT 模式 (Milestone 3)", () => {
  let store: MemoryStore;
  let logic: StpLogic;
  let strategy: TestJwtStrategy;
  let config: XltTokenConfig;

  const buildJwtModule = async (cfg: XltTokenConfig) => {
    config = cfg;
    strategy = new TestJwtStrategy(cfg);
    ({ logic, store } = createStpLogic({ config: cfg, strategy }));
  };

  beforeEach(async () => {
    await buildJwtModule(makeJwtConfig());
  });

  describe("login", () => {
    it("JWT 模式不写入 tokenKey，sessionKey 存 jti", async () => {
      const token = await logic.login("jwt-u1");
      const { jti } = strategy.verifyToken(token);

      await expect(store.get(tokenKey(config, token))).resolves.toBeNull();
      await expect(store.get(sessionKey(config, "jwt-u1"))).resolves.toBe(jti);
    });

    it("activeTimeout > 0 时用 jti 写入 lastActiveKey", async () => {
      await buildJwtModule(makeJwtConfig({ activeTimeout: 60 }));
      const token = await logic.login("jwt-u2");
      const { jti } = strategy.verifyToken(token);

      const lastActive = await store.get(lastActiveKey(config, jti));
      expect(lastActive).not.toBeNull();
      expect(Number(lastActive)).toBeGreaterThan(0);
      await expect(store.get(lastActiveKey(config, token))).resolves.toBeNull();
    });
  });

  describe("isLogin / checkLogin", () => {
    it("有效 JWT 鉴权通过", async () => {
      const token = await logic.login("jwt-u3");
      const req = makeReq(config, token);

      await expect(logic.isLogin(req)).resolves.toBe(true);
      await expect(logic.checkLogin(req)).resolves.toEqual({
        ok: true,
        loginId: "jwt-u3",
        token,
      });
    });

    it("鉴权时不查询 tokenKey", async () => {
      const token = await logic.login("jwt-u4");
      const req = makeReq(config, token);
      const getSpy = vi.spyOn(store, "get");
      getSpy.mockClear();

      await logic.isLogin(req);

      const tokenKeyCalls = getSpy.mock.calls.filter(([key]) =>
        String(key).includes(":login:token:"),
      );
      expect(tokenKeyCalls).toHaveLength(0);
      getSpy.mockRestore();
    });

    it("签名错误返回 INVALID_TOKEN", async () => {
      const token = await logic.login("jwt-u5");
      const parts = token.split(".");
      const tampered = `${parts[0]}.${parts[1]}.bad-signature`;
      const req = makeReq(config, tampered);

      await expect(logic.isLogin(req)).resolves.toBe(false);
      await expect(logic.checkLogin(req)).rejects.toThrow("Token 无效");
    });

    it("随机字符串返回 INVALID_TOKEN", async () => {
      const req = makeReq(config, "not-a-jwt");
      await expect(logic.isLogin(req)).resolves.toBe(false);
    });
  });

  describe("kickout", () => {
    it("kickout 后写入 jwt-blacklist", async () => {
      const token = await logic.login("jwt-u6");
      const { jti } = strategy.verifyToken(token);

      await expect(logic.kickout("jwt-u6")).resolves.toBe(true);
      await expect(store.get(jwtBlacklistKey(config, jti))).resolves.toBe(NotLoginType.KICK_OUT);
    });

    it("kickout 后 isLogin 返回 false 且 reason 为 KICK_OUT", async () => {
      const token = await logic.login("jwt-u7");
      await logic.kickout("jwt-u7");
      const req = makeReq(config, token);

      await expect(logic.isLogin(req)).resolves.toBe(false);
      const result = await logic.isLogin(req);
      expect(result).toBe(false);
    });
  });

  describe("kickoutByToken", () => {
    it("按 token 踢下线写入黑名单", async () => {
      const token = await logic.login("jwt-u8");
      const { jti } = strategy.verifyToken(token);

      await expect(logic.kickoutByToken(token)).resolves.toBe(true);
      await expect(store.get(jwtBlacklistKey(config, jti))).resolves.toBe(NotLoginType.KICK_OUT);
      await expect(logic.isLogin(makeReq(config, token))).resolves.toBe(false);
    });
  });

  describe("被顶下线", () => {
    it("isConcurrent=false 时旧 JWT 被 BE_REPLACED", async () => {
      await buildJwtModule(makeJwtConfig({ isConcurrent: false, isShare: false }));
      const t1 = await logic.login("jwt-u9");
      const { jti: oldJti } = strategy.verifyToken(t1);
      const t2 = await logic.login("jwt-u9");

      expect(t2).not.toBe(t1);
      await expect(store.get(jwtBlacklistKey(config, oldJti))).resolves.toBe(
        NotLoginType.BE_REPLACED,
      );
      await expect(logic.isLogin(makeReq(config, t1))).resolves.toBe(false);
      await expect(logic.isLogin(makeReq(config, t2))).resolves.toBe(true);
    });
  });

  describe("activeTimeout", () => {
    it("JWT 模式 idle 超时后冻结", async () => {
      await buildJwtModule(makeJwtConfig({ activeTimeout: 1 }));
      const token = await logic.login("jwt-u10");
      const req = makeReq(config, token);

      await expect(logic.isLogin(req)).resolves.toBe(true);
      await new Promise((r) => setTimeout(r, 1100));
      await expect(logic.isLogin(req)).resolves.toBe(false);
    });
  });

  describe("deviceConcurrent=false", () => {
    it("新登录踢掉旧 JWT（黑名单 KICK_OUT）", async () => {
      await buildJwtModule(makeJwtConfig({ deviceConcurrent: false, isShare: false }));
      const pcToken = await logic.login("jwt-u11", { device: "pc" });
      const { jti: oldJti } = strategy.verifyToken(pcToken);
      const appToken = await logic.login("jwt-u11", { device: "app" });

      await expect(store.get(jwtBlacklistKey(config, oldJti))).resolves.toBe(NotLoginType.KICK_OUT);
      await expect(logic.isLogin(makeReq(config, pcToken))).resolves.toBe(false);
      await expect(logic.isLogin(makeReq(config, appToken))).resolves.toBe(true);
    });
  });

  describe("logout", () => {
    it("JWT 模式 logout 写入黑名单并清理 session", async () => {
      const token = await logic.login("jwt-u12");
      const { jti } = strategy.verifyToken(token);

      await expect(logic.logout(token)).resolves.toBe(true);
      await expect(store.get(jwtBlacklistKey(config, jti))).resolves.toBe(
        NotLoginType.INVALID_TOKEN,
      );
      await expect(logic.isLogin(makeReq(config, token))).resolves.toBe(false);
    });

    it("JWT 模式 logout 后在线列表不包含该用户", async () => {
      const token = await logic.login("jwt-u13");
      await expect(logic.getOnlineCount()).resolves.toBe(1);

      await logic.logout(token);
      await expect(logic.getOnlineCount()).resolves.toBe(0);
    });
  });

  describe("logoutByLoginId", () => {
    it("JWT 模式 logoutByLoginId 清除所有设备", async () => {
      const pcToken = await logic.login("jwt-u14", { device: "pc" });
      const appToken = await logic.login("jwt-u14", { device: "app" });
      const { jti: pcJti } = strategy.verifyToken(pcToken);
      const { jti: appJti } = strategy.verifyToken(appToken);

      await expect(logic.logoutByLoginId("jwt-u14")).resolves.toBe(true);

      await expect(store.get(jwtBlacklistKey(config, pcJti))).resolves.toBe(
        NotLoginType.INVALID_TOKEN,
      );
      await expect(store.get(jwtBlacklistKey(config, appJti))).resolves.toBe(
        NotLoginType.INVALID_TOKEN,
      );
      await expect(logic.isLogin(makeReq(config, pcToken))).resolves.toBe(false);
      await expect(logic.isLogin(makeReq(config, appToken))).resolves.toBe(false);
      await expect(store.get(sessionListKey(config, "jwt-u14"))).resolves.toBeNull();
    });

    it("未知 loginId 返回 null", async () => {
      await expect(logic.logoutByLoginId("nonexistent")).resolves.toBeNull();
    });
  });

  describe("logoutByDevice", () => {
    it("JWT 模式 logoutByDevice 黑名单指定设备", async () => {
      const pcToken = await logic.login("jwt-u15", { device: "pc" });
      const appToken = await logic.login("jwt-u15", { device: "app" });
      const { jti: pcJti } = strategy.verifyToken(pcToken);
      const { jti: appJti } = strategy.verifyToken(appToken);

      await expect(logic.logoutByDevice("jwt-u15", "pc")).resolves.toBe(true);

      await expect(store.get(jwtBlacklistKey(config, pcJti))).resolves.toBe(
        NotLoginType.INVALID_TOKEN,
      );
      await expect(store.get(jwtBlacklistKey(config, appJti))).resolves.toBeNull();
      await expect(logic.isLogin(makeReq(config, pcToken))).resolves.toBe(false);
      await expect(logic.isLogin(makeReq(config, appToken))).resolves.toBe(true);
    });

    it("未知设备返回 null", async () => {
      await expect(logic.logoutByDevice("jwt-u15", "unknown")).resolves.toBeNull();
    });
  });

  describe("refreshToken", () => {
    it("成功刷新 JWT，旧 token 失效", async () => {
      const token = await logic.login("jwt-u16");
      const { jti: oldJti } = strategy.verifyToken(token);

      const newToken = await logic.refreshToken(token);
      expect(newToken).not.toBeNull();
      expect(newToken).not.toBe(token);

      const { jti: newJti } = strategy.verifyToken(newToken!);
      expect(newJti).not.toBe(oldJti);

      // 旧 token 应在黑名单中
      await expect(store.get(jwtBlacklistKey(config, oldJti))).resolves.toBe("REFRESHED");
      // 旧 token 不可用
      await expect(logic.isLogin(makeReq(config, token))).resolves.toBe(false);
      // 新 token 可用
      await expect(logic.isLogin(makeReq(config, newToken!))).resolves.toBe(true);
    });

    it("已黑名单 token 不可刷新", async () => {
      const token = await logic.login("jwt-u17");
      await logic.kickout("jwt-u17");

      await expect(logic.refreshToken(token)).resolves.toBeNull();
    });

    it("过期 JWT 返回 null", async () => {
      const expired = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJleHBpcmVkIn0.invalid";
      await expect(logic.refreshToken(expired)).resolves.toBeNull();
    });

    it("非 JWT 模式返回 null", async () => {
      const { logic: uuidLogic } = createStpLogic({});
      const result = await uuidLogic.refreshToken("some-random-token");
      expect(result).toBeNull();
    });

    it("自定义 timeout 刷新", async () => {
      const token = await logic.login("jwt-u18");
      const newToken = await logic.refreshToken(token, 7200);
      expect(newToken).not.toBeNull();
      await expect(logic.isLogin(makeReq(config, newToken!))).resolves.toBe(true);
    });
  });

  describe("renewTimeout", () => {
    it("JWT 模式 renewTimeout 延长 session TTL", async () => {
      const token = await logic.login("jwt-u19");
      await expect(logic.renewTimeout(token, 7200)).resolves.toBe(true);

      // 验证 sessionKey TTL 已延长
      const sessionKeyStr = sessionKey(config, "jwt-u19");
      const ttl = await store.getTimeout(sessionKeyStr);
      expect(ttl).toBeGreaterThan(3500); // 7200s, 允许一定延迟
    });

    it("已黑名单 JWT 的 renewTimeout 返回 null", async () => {
      const token = await logic.login("jwt-u20");
      await logic.kickout("jwt-u20");
      await expect(logic.renewTimeout(token, 7200)).resolves.toBeNull();
    });
  });
});
