import type { HttpContext } from "../http/context.js";
import {
  createExpressContext,
  type ExpressLikeRequest,
  type ExpressLikeResponse,
} from "../http/express.js";
import type { DeviceInfo } from "../config/xlt-token-config.js";
import type { XltMode } from "../const/index.js";
import type { XltSession } from "../session/xlt-session.js";
import type { StpLogic } from "./stp-logic.js";
import type { StpPermLogic } from "./stp-perm-logic.js";

const noopResponse: ExpressLikeResponse = {
  setHeader: () => {},
  cookie: () => {},
};

function toHttpContext(req: HttpContext | ExpressLikeRequest): HttpContext {
  if (typeof (req as HttpContext).headers?.get === "function") {
    return req as HttpContext;
  }
  return createExpressContext(req as ExpressLikeRequest, noopResponse);
}

let _stpLogic: StpLogic | null = null;
let _stpPermLogic: StpPermLogic | null = null;

export function setStpLogic(stpLogic: StpLogic) {
  _stpLogic = stpLogic;
}

export function setStpPermLogic(stpPermLogic: StpPermLogic) {
  _stpPermLogic = stpPermLogic;
}

/**
 * 读取默认实例的 `StpLogic`；未初始化时抛出与既有语义一致的错误。
 * 供实例 API（`getDefaultXltInstance`）复用同一存储。
 */
export function getStpLogic(): StpLogic {
  if (!_stpLogic) {
    throw new Error(
      "StpLogic not initialized. Please ensure XltTokenModule is imported correctly.",
    );
  }
  return _stpLogic;
}

/**
 * 读取默认实例的 `StpPermLogic`；未初始化时抛出与既有语义一致的错误。
 * 供实例 API（`getDefaultXltInstance`）复用同一存储。
 */
export function getStpPermLogic(): StpPermLogic {
  if (!_stpPermLogic) {
    throw new Error(
      "StpPermLogic not initialized. Please ensure XltTokenModule is imported with stpInterface.",
    );
  }
  return _stpPermLogic;
}

export class StpUtil {
  static async login(
    loginId: string | number,
    options: { timeout?: number; device?: string; token?: string } = {},
  ): Promise<string> {
    return getStpLogic().login(loginId, options);
  }

  static async logout(token: string): Promise<boolean | null> {
    return getStpLogic().logout(token);
  }

  static async logoutByLoginId(loginId: string): Promise<boolean | null> {
    return getStpLogic().logoutByLoginId(loginId);
  }

  static async kickout(loginId: string, device?: string): Promise<boolean | null> {
    return getStpLogic().kickout(loginId, device);
  }

  static async kickoutByDevice(loginId: string, device: string): Promise<boolean | null> {
    return getStpLogic().kickoutByDevice(loginId, device);
  }

  static async kickoutByToken(token: string): Promise<boolean | null> {
    return getStpLogic().kickoutByToken(token);
  }

  static async renewTimeout(token: string, timeout: number): Promise<boolean | null> {
    return getStpLogic().renewTimeout(token, timeout);
  }

  static async isLogin(req: HttpContext | ExpressLikeRequest): Promise<boolean> {
    return getStpLogic().isLogin(toHttpContext(req));
  }

  static async checkLogin(req: HttpContext | ExpressLikeRequest) {
    return getStpLogic().checkLogin(toHttpContext(req));
  }

  static async getLoginId(req: HttpContext | ExpressLikeRequest): Promise<string | null> {
    const result = await getStpLogic().checkLogin(toHttpContext(req));
    return result.loginId || null;
  }

  static async getTokenValue(req: HttpContext | ExpressLikeRequest): Promise<string | null> {
    return getStpLogic().getTokenValue(toHttpContext(req));
  }

  static async openSafe(token: string, business: string, timeout: number): Promise<void> {
    return getStpLogic().openSafe(token, business, timeout);
  }

  static async checkSafe(token: string, business: string): Promise<void> {
    return getStpLogic().checkSafe(token, business);
  }

  static async closeSafe(token: string, business: string): Promise<void> {
    return getStpLogic().closeSafe(token, business);
  }

  static async createTempToken(value: string, timeout: number): Promise<string> {
    return getStpLogic().createTempToken(value, timeout);
  }

  static async parseTempToken(tempToken: string): Promise<string | null> {
    return getStpLogic().parseTempToken(tempToken);
  }

  static async consumeTempToken(tempToken: string): Promise<string | null> {
    return getStpLogic().consumeTempToken(tempToken);
  }

  static async deleteTempToken(tempToken: string): Promise<void> {
    return getStpLogic().deleteTempToken(tempToken);
  }

  static async getDeviceList(loginId: string): Promise<DeviceInfo[]> {
    return getStpLogic().getDeviceList(loginId);
  }

  static async forceLogout(loginId: string): Promise<boolean> {
    return getStpLogic().forceLogout(loginId);
  }

  static async getOnlineLoginIds(opts?: { page?: number; pageSize?: number }): Promise<string[]> {
    return getStpLogic().getOnlineLoginIds(opts);
  }

  static async getOnlineCount(): Promise<number> {
    return getStpLogic().getOnlineCount();
  }

  static async hasPermission(loginId: string, permission: string): Promise<boolean> {
    return getStpPermLogic().hasPermission(loginId, permission);
  }

  static async checkPermission(
    loginId: string,
    permissions: string[],
    mode: XltMode,
  ): Promise<void> {
    return getStpPermLogic().checkPermission(loginId, permissions, mode);
  }

  static async hasRole(loginId: string, role: string): Promise<boolean> {
    return getStpPermLogic().hasRole(loginId, role);
  }

  static async checkRole(loginId: string, roles: string[], mode: XltMode): Promise<void> {
    return getStpPermLogic().checkRole(loginId, roles, mode);
  }

  static getSession(loginId: string): XltSession {
    return getStpLogic().getSession(loginId);
  }

  static async getOfflineReason(token: string): Promise<{ reason: string; time: number } | null> {
    return getStpLogic().getOfflineRecords(token);
  }
}
