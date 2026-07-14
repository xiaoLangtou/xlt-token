import { beforeEach, describe, expect, it, vi } from "vitest";
import { setStpLogic, setStpPermLogic, StpUtil } from "../../src/auth/stp-util.js";
import { XltMode } from "../../src/const/index.js";

/**
 * StpUtil 是静态门面，内部通过模块初始化时调用的 setStpLogic / setStpPermLogic
 * 注入实例。这里直接 mock 这两个实例，验证每个静态方法都正确委托到对应实例的方法。
 */

function createMockStpLogic() {
  return {
    login: vi.fn().mockResolvedValue("token-xxx"),
    logout: vi.fn().mockResolvedValue(true),
    logoutByLoginId: vi.fn().mockResolvedValue(true),
    kickout: vi.fn().mockResolvedValue(true),
    kickoutByDevice: vi.fn().mockResolvedValue(true),
    kickoutByToken: vi.fn().mockResolvedValue(true),
    renewTimeout: vi.fn().mockResolvedValue(true),
    isLogin: vi.fn().mockResolvedValue(true),
    checkLogin: vi.fn().mockResolvedValue({ ok: true, loginId: "1001", token: "t" }),
    getTokenValue: vi.fn().mockResolvedValue("t"),
    openSafe: vi.fn().mockResolvedValue(undefined),
    checkSafe: vi.fn().mockResolvedValue(undefined),
    closeSafe: vi.fn().mockResolvedValue(undefined),
    createTempToken: vi.fn().mockResolvedValue("temp-xxx"),
    parseTempToken: vi.fn().mockResolvedValue("data"),
    deleteTempToken: vi.fn().mockResolvedValue(undefined),
    getDeviceList: vi.fn().mockResolvedValue([]),
    forceLogout: vi.fn().mockResolvedValue(true),
    getOnlineLoginIds: vi.fn().mockResolvedValue(["1001"]),
    getOnlineCount: vi.fn().mockResolvedValue(1),
    getSession: vi.fn().mockReturnValue({ id: "session" }),
    getOfflineRecords: vi.fn().mockResolvedValue({ reason: "KICK_OUT", time: 123 }),
  };
}

function createMockStpPermLogic() {
  return {
    hasPermission: vi.fn().mockResolvedValue(true),
    checkPermission: vi.fn().mockResolvedValue(undefined),
    hasRole: vi.fn().mockResolvedValue(true),
    checkRole: vi.fn().mockResolvedValue(undefined),
  };
}

describe("StpUtil 静态门面", () => {
  let mockLogic: ReturnType<typeof createMockStpLogic>;
  let mockPerm: ReturnType<typeof createMockStpPermLogic>;

  beforeEach(() => {
    mockLogic = createMockStpLogic();
    mockPerm = createMockStpPermLogic();
    // @ts-ignore
    setStpLogic(mockLogic);
    // @ts-ignore
    setStpPermLogic(mockPerm);
  });

  describe("登录 / 登出 / 踢人", () => {
    it("login 委托到 stpLogic.login 并透传参数", async () => {
      const token = await StpUtil.login("1001", { timeout: 3600 });
      expect(token).toBe("token-xxx");
      expect(mockLogic.login).toHaveBeenCalledWith("1001", { timeout: 3600 });
    });

    it("login 默认 options 为空对象", async () => {
      await StpUtil.login("1001");
      expect(mockLogic.login).toHaveBeenCalledWith("1001", {});
    });

    it("logout 通过 token", async () => {
      await StpUtil.logout("t");
      expect(mockLogic.logout).toHaveBeenCalledWith("t");
    });

    it("logoutByLoginId 通过 loginId", async () => {
      await StpUtil.logoutByLoginId("1001");
      expect(mockLogic.logoutByLoginId).toHaveBeenCalledWith("1001");
    });

    it("kickout 踢人下线", async () => {
      await StpUtil.kickout("1001");
      expect(mockLogic.kickout).toHaveBeenCalledWith("1001", undefined);
    });

    it("renewTimeout 续签", async () => {
      await StpUtil.renewTimeout("t", 7200);
      expect(mockLogic.renewTimeout).toHaveBeenCalledWith("t", 7200);
    });
  });

  describe("登录态查询", () => {
    it("isLogin", async () => {
      const result = await StpUtil.isLogin({} as any);
      expect(result).toBe(true);
      expect(mockLogic.isLogin).toHaveBeenCalled();
    });

    it("checkLogin", async () => {
      const result = await StpUtil.checkLogin({} as any);
      expect(result).toEqual({ ok: true, loginId: "1001", token: "t" });
      expect(mockLogic.checkLogin).toHaveBeenCalled();
    });

    it("getLoginId 返回 loginId", async () => {
      const id = await StpUtil.getLoginId({} as any);
      expect(id).toBe("1001");
    });

    it("getLoginId 在无 loginId 时返回 null", async () => {
      mockLogic.checkLogin.mockResolvedValueOnce({ ok: true });
      const id = await StpUtil.getLoginId({} as any);
      expect(id).toBeNull();
    });

    it("getTokenValue", async () => {
      const t = await StpUtil.getTokenValue({} as any);
      expect(t).toBe("t");
    });
  });

  describe("权限 / 角色", () => {
    it("hasPermission", async () => {
      const ok = await StpUtil.hasPermission("1001", "user:read");
      expect(ok).toBe(true);
      expect(mockPerm.hasPermission).toHaveBeenCalledWith("1001", "user:read");
    });

    it("checkPermission", async () => {
      await StpUtil.checkPermission("1001", ["user:read"], XltMode.AND);
      expect(mockPerm.checkPermission).toHaveBeenCalledWith("1001", ["user:read"], XltMode.AND);
    });

    it("hasRole", async () => {
      const ok = await StpUtil.hasRole("1001", "admin");
      expect(ok).toBe(true);
      expect(mockPerm.hasRole).toHaveBeenCalledWith("1001", "admin");
    });

    it("checkRole", async () => {
      await StpUtil.checkRole("1001", ["admin"], XltMode.OR);
      expect(mockPerm.checkRole).toHaveBeenCalledWith("1001", ["admin"], XltMode.OR);
    });
  });

  describe("二级认证 / 临时 token / 多端 / 观测", () => {
    it("openSafe", async () => {
      await StpUtil.openSafe("t", "pay", 300);
      expect(mockLogic.openSafe).toHaveBeenCalledWith("t", "pay", 300);
    });

    it("checkSafe", async () => {
      await StpUtil.checkSafe("t", "pay");
      expect(mockLogic.checkSafe).toHaveBeenCalledWith("t", "pay");
    });

    it("closeSafe", async () => {
      await StpUtil.closeSafe("t", "pay");
      expect(mockLogic.closeSafe).toHaveBeenCalledWith("t", "pay");
    });

    it("createTempToken", async () => {
      const t = await StpUtil.createTempToken("payload", 600);
      expect(t).toBe("temp-xxx");
      expect(mockLogic.createTempToken).toHaveBeenCalledWith("payload", 600);
    });

    it("parseTempToken", async () => {
      await StpUtil.parseTempToken("temp-xxx");
      expect(mockLogic.parseTempToken).toHaveBeenCalledWith("temp-xxx");
    });

    it("deleteTempToken", async () => {
      await StpUtil.deleteTempToken("temp-xxx");
      expect(mockLogic.deleteTempToken).toHaveBeenCalledWith("temp-xxx");
    });

    it("getDeviceList", async () => {
      await StpUtil.getDeviceList("1001");
      expect(mockLogic.getDeviceList).toHaveBeenCalledWith("1001");
    });

    it("kickoutByDevice", async () => {
      await StpUtil.kickoutByDevice("1001", "pc");
      expect(mockLogic.kickoutByDevice).toHaveBeenCalledWith("1001", "pc");
    });

    it("kickoutByToken", async () => {
      await StpUtil.kickoutByToken("t");
      expect(mockLogic.kickoutByToken).toHaveBeenCalledWith("t");
    });

    it("forceLogout", async () => {
      await StpUtil.forceLogout("1001");
      expect(mockLogic.forceLogout).toHaveBeenCalledWith("1001");
    });

    it("getOnlineLoginIds", async () => {
      const ids = await StpUtil.getOnlineLoginIds({ page: 0 });
      expect(ids).toEqual(["1001"]);
      expect(mockLogic.getOnlineLoginIds).toHaveBeenCalledWith({ page: 0 });
    });

    it("getOnlineCount", async () => {
      expect(await StpUtil.getOnlineCount()).toBe(1);
    });
  });

  describe("会话 / 下线记录", () => {
    it("getSession", () => {
      const s = StpUtil.getSession("1001");
      expect(s).toEqual({ id: "session" });
      expect(mockLogic.getSession).toHaveBeenCalledWith("1001");
    });

    it("getOfflineReason", async () => {
      const r = await StpUtil.getOfflineReason("t");
      expect(r).toEqual({ reason: "KICK_OUT", time: 123 });
      expect(mockLogic.getOfflineRecords).toHaveBeenCalledWith("t");
    });
  });

  describe("未初始化时抛错", () => {
    it("未注入 StpLogic 调用方法 → 抛错", async () => {
      // @ts-ignore
      setStpLogic(null);
      await expect(StpUtil.login("1001")).rejects.toThrow(/StpLogic not initialized/);
    });

    it("未注入 StpPermLogic 调用权限方法 → 抛错", async () => {
      // @ts-ignore
      setStpPermLogic(null);
      await expect(StpUtil.hasPermission("1001", "p")).rejects.toThrow(
        /StpPermLogic not initialized/,
      );
    });
  });
});
