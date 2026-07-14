// 核心引擎
import { isNull, isUndefined } from "es-toolkit";
import type { DeviceInfo, DurationInput, XltTokenConfig } from "../config/xlt-token-config.js";
import { NotLoginType } from "../const/index.js";
import { XltTokenKeys } from "../config/xlt-token-keys.js";
import { NotLoginException } from "../exceptions/not-login.exception.js";
import { NotSafeException } from "../exceptions/not-safe.exception.js";
import type { XltHooks } from "../hooks/xlt-hooks.interface.js";
import type { HttpContext } from "../http/context.js";
import { XltSession } from "../session/xlt-session.js";
import type { XltTokenStore } from "../store/xlt-token-store.interface.js";
import type { TokenStrategy } from "../token/token-strategy.interface.js";
import { normalizeDuration } from "../time/duration.js";

export interface AuthResult {
  ok: boolean;
  loginId?: string;
  token?: string;
  reason?: NotLoginType;
}

export class StpLogic {
  constructor(
    private config: XltTokenConfig,
    private store: XltTokenStore,
    private strategy: TokenStrategy,
    private hooks: XltHooks = {},
  ) {
    this.keys = new XltTokenKeys(this.config.tokenName);
  }

  private readonly keys: XltTokenKeys;

  /**
   * 登录
   * @param loginId
   * @param options
   */
  async login(
    loginId: string | number,
    options: { timeout?: DurationInput; device?: string; token?: string } = {},
  ): Promise<string> {
    if (isNull(loginId) || isUndefined(loginId) || loginId === "")
      throw new Error("invalid loginId");

    const _loginId = String(loginId);

    if (_loginId.includes(":")) {
      throw new Error("invalid loginId");
    }

    const device = options.device ?? "default";
    const timeout = normalizeDuration(options.timeout ?? this.config.timeout, {
      field: "timeout",
      allowZero: true,
      allowNever: true,
    });

    const sessionKey = this.keys.sessionKey(_loginId, device);
    const oldToken = await this.store.get(sessionKey);

    let replacedOldFullToken: string | undefined;

    let token: string;
    if (!this.config.deviceConcurrent) {
      // 任意新登录踢掉所有设备（等价于 1.0 isConcurrent=false 的全局版）
      await this._kickoutAllDevices(_loginId);
      token = options.token ?? this.strategy.createToken(_loginId, this.config, { timeout });
    } else if (!this.config.isConcurrent) {
      // 同设备互踢
      if (oldToken) {
        replacedOldFullToken = await this._resolveHookToken(_loginId, device, oldToken);
        await this._replacedToken(_loginId, oldToken, device);
      }
      token = options.token ?? this.strategy.createToken(_loginId, this.config, { timeout });
    } else if (this.config.isShare && oldToken) {
      if (this._isJwtMode()) {
        const list = await this.getDeviceList(_loginId);
        const info = list.find((d) => d.device === device);
        token =
          info?.token ??
          options.token ??
          this.strategy.createToken(_loginId, this.config, { timeout });
      } else {
        token = oldToken;
      }
    } else {
      token = options.token ?? this.strategy.createToken(_loginId, this.config, { timeout });
    }

    if (this._isJwtMode()) {
      const { jti } = this.strategy.verifyToken(token);
      await this.store.set(sessionKey, jti, timeout);
      if (this.config.activeTimeout > 0) {
        await this.store.set(this.keys.lastActiveKey(jti), String(Date.now()), timeout);
      }
    } else {
      await this.store.set(this.keys.tokenKey(token), _loginId, timeout);
      await this.store.set(sessionKey, token, timeout);
      if (this.config.activeTimeout > 0) {
        await this.store.set(this.keys.lastActiveKey(token), String(Date.now()), timeout);
      }
    }

    // 更新全设备索引
    await this._addToSessionList(_loginId, { device, token, loginTime: Date.now() }, timeout);

    // ── 触发钩子 ──
    this.callHook("onLogin", _loginId, token, device);
    if (replacedOldFullToken) {
      this.callHook("onReplaced", _loginId, replacedOldFullToken, token);
    }
    // 返回纯 token，客户端请求时自行拼接前缀（如 "Bearer "）
    return token;
  }

  /**
   * 添加到 session-list
   * @param loginId
   * @param info
   * @param timeout
   */
  async _addToSessionList(
    loginId: string,
    info: DeviceInfo,
    timeout: DurationInput,
  ): Promise<void> {
    const key = this.keys.sessionListKey(loginId);
    const raw = await this.store.get(key);
    const list: DeviceInfo[] = raw ? JSON.parse(raw) : [];
    // 同 device 去重
    const idx = list.findIndex((d) => d.device === info.device);
    if (idx >= 0) list.splice(idx, 1);
    list.push(info);
    await this.store.set(
      key,
      JSON.stringify(list),
      normalizeDuration(timeout, { field: "timeout", allowZero: true, allowNever: true }),
    );
  }

  /**
   * 踢掉所有设备
   * @param loginId
   * @returns
   */
  async _kickoutAllDevices(loginId: string): Promise<void> {
    const key = this.keys.sessionListKey(loginId);
    const raw = await this.store.get(key);
    if (!raw) return;
    const list: DeviceInfo[] = JSON.parse(raw);
    for (const deviceInfo of list) {
      if (this._isJwtMode()) {
        const { jti } = this.strategy.verifyToken(deviceInfo.token);
        await this.store.set(
          this.keys.jwtBlacklistKey(jti),
          NotLoginType.KICK_OUT,
          this.config.timeout,
        );
      } else {
        await this.store.update(this.keys.tokenKey(deviceInfo.token), NotLoginType.KICK_OUT);
      }
    }
  }

  /**
   * 被顶下线
   * @param loginId
   * @param token
   */
  async _replacedToken(
    loginId: string,
    oldSessionValue: string,
    device = "default",
  ): Promise<void> {
    if (this._isJwtMode()) {
      await this.store.set(
        this.keys.jwtBlacklistKey(oldSessionValue),
        NotLoginType.BE_REPLACED,
        this.config.timeout,
      );
    } else {
      await this.store.update(this.keys.tokenKey(oldSessionValue), NotLoginType.BE_REPLACED);
    }
    await this.store.delete(this.keys.sessionKey(loginId, device));
    this.writeOfflineRecord(oldSessionValue, NotLoginType.BE_REPLACED);
  }

  /**
   * 打开二级认证窗口
   * @param token  用户token
   * @param business  业务标识
   * @param timeout 有效期（秒）
   */
  async openSafe(token: string, business: string, timeout: DurationInput): Promise<void> {
    const safeKey = this.keys.safeKey(token, business);
    await this.store.set(
      safeKey,
      String(Date.now()),
      normalizeDuration(timeout, { field: "timeout" }),
    );
  }

  /**
   * 检查二级认证是否有效
   * @param token 用户token
   * @param business 业务标识
   * @returns 是否有效
   */
  async checkSafe(token: string, business: string): Promise<void> {
    const exists = await this.store.has(this.keys.safeKey(token, business));

    if (!exists) throw new NotSafeException(business);
  }

  /**
   * 主动关闭二级认证
   * @param token
   * @param business
   */
  async closeSafe(token: string, business: string): Promise<void> {
    await this.store.delete(this.keys.safeKey(token, business));
  }

  /**
   * 创建临时token
   * @param value  要关联的业务数据
   * @param timeout 有效期（秒）
   * @returns 临时token字符串
   */
  async createTempToken(value: string, timeout: DurationInput): Promise<string> {
    const tempToken = this.strategy.createToken("__temp__", this.config, { timeout });
    const tempTokenKey = this.keys.tempTokenKey(tempToken);
    await this.store.set(tempTokenKey, value, normalizeDuration(timeout, { field: "timeout" }));
    return tempToken;
  }

  /**
   * 解析临时token
   * @param tempToken  临时token字符串
   * @returns 要关联的业务数据
   */
  async parseTempToken(tempToken: string): Promise<string | null> {
    return this.store.get(this.keys.tempTokenKey(tempToken));
  }

  /**
   * 销毁临时token
   * @param tempToken  临时token字符串
   */
  async deleteTempToken(tempToken: string): Promise<void> {
    await this.store.delete(this.keys.tempTokenKey(tempToken));
  }

  /**
   * 获取 token 值
   * @param req
   */
  async getTokenValue(ctx: HttpContext): Promise<string | null> {
    if (this.config.isReadHeader) {
      const raw = ctx.headers.get(this.config.tokenName.toLowerCase());
      if (raw) {
        let value = raw;
        if (this.config.tokenPrefix && value.startsWith(this.config.tokenPrefix)) {
          value = value.slice(this.config.tokenPrefix.length);
        }
        return value.trim();
      }
    }
    if (this.config.isReadCookie) {
      const cookie = ctx.cookies.get(this.config.tokenName);
      if (cookie) return cookie;
    }

    if (this.config.isReadQuery) {
      return ctx.query.get(this.config.tokenName);
    }

    return null;
  }

  /**
   * 是否登录
   * @param req
   */
  async isLogin(ctx: HttpContext): Promise<boolean> {
    const result = await this._resolveLoginId(ctx);
    return result.ok;
  }

  /**
   * 检查登录
   * @param ctx
   */
  async checkLogin(ctx: HttpContext): Promise<AuthResult> {
    const result = await this._resolveLoginId(ctx);

    if (!result.ok) {
      throw new NotLoginException(result.reason ?? NotLoginType.NOT_TOKEN, result.token);
    }

    return { ok: result.ok, loginId: result.loginId, token: result.token };
  }

  /**
   * 登出
   * @param token
   */
  async logout(token: string): Promise<boolean | null> {
    if (!token) return null;

    if (this._isJwtMode()) {
      try {
        const payload = this.strategy.verifyToken(token);
        const { sub: loginId, jti } = payload;
        if (!loginId || !jti) return null;

        await this.store.set(
          this.keys.jwtBlacklistKey(jti),
          NotLoginType.INVALID_TOKEN,
          this.config.timeout,
        );

        const list = await this.getDeviceList(loginId);
        const info = list.find((d) => d.token === token);
        if (info) {
          await this.store.delete(this.keys.sessionKey(loginId, info.device));
          await this._removeFromSessionList(loginId, info.device);
        }

        if (this.config.activeTimeout > 0) {
          await this.store.delete(this.keys.lastActiveKey(jti));
        }

        this.writeOfflineRecord(token, "LOGOUT");
        this.callHook("onLogout", loginId, token, "LOGOUT");
        return true;
      } catch {
        return null;
      }
    }

    const loginId = await this.store.get(this.keys.tokenKey(token));
    if (!loginId) return null;

    await this.store.delete(this.keys.tokenKey(token));
    await this.store.delete(this.keys.lastActiveKey(token));
    await this.store.delete(this.keys.sessionKey(loginId));
    await this.store.delete(this.keys.sessionDataKey(loginId));
    const list = await this.getDeviceList(loginId);
    const info = list.find((d) => d.token === token);
    if (info) await this._removeFromSessionList(loginId, info.device);

    this.callHook("onLogout", loginId, token, "LOGOUT");
    return true;
  }

  /**
   * 根据登录id登出
   * @param loginId
   */
  async logoutByLoginId(loginId: string): Promise<boolean | null> {
    if (!loginId) return null;

    const list = await this.getDeviceList(loginId);
    if (list.length === 0) return null;

    for (const { device, token } of list) {
      if (this._isJwtMode()) {
        try {
          const { jti } = this.strategy.verifyToken(token);
          await this.store.set(
            this.keys.jwtBlacklistKey(jti),
            NotLoginType.INVALID_TOKEN,
            this.config.timeout,
          );
          if (this.config.activeTimeout > 0) {
            await this.store.delete(this.keys.lastActiveKey(jti));
          }
        } catch {
          continue;
        }
      } else {
        await this.store.delete(this.keys.tokenKey(token));
        if (this.config.activeTimeout > 0) {
          await this.store.delete(this.keys.lastActiveKey(token));
        }
      }
      await this.store.delete(this.keys.sessionKey(loginId, device));
      this.callHook("onLogout", loginId, token, "LOGOUT_BY_LOGIN_ID");
    }

    await this.store.delete(this.keys.sessionListKey(loginId));
    await this.store.delete(this.keys.sessionDataKey(loginId));

    return true;
  }

  /**
   * 踢人下线
   * @param loginId
   */
  async kickout(loginId: string, device: string = "default"): Promise<boolean | null> {
    if (!loginId) return null;
    const sessionKey = this.keys.sessionKey(loginId, device);
    const sessionValue = await this.store.get(sessionKey);
    if (!sessionValue) return null;

    const list = await this.getDeviceList(loginId);
    const info = list.find((d) => d.device === device);
    const fullToken = info?.token ?? sessionValue;

    if (this._isJwtMode()) {
      await this.store.set(
        this.keys.jwtBlacklistKey(sessionValue),
        NotLoginType.KICK_OUT,
        this.config.timeout,
      );
    } else {
      await this.store.update(this.keys.tokenKey(sessionValue), NotLoginType.KICK_OUT);
    }

    await this.store.delete(sessionKey);
    await this.store.delete(this.keys.sessionDataKey(loginId));
    this.writeOfflineRecord(fullToken, NotLoginType.KICK_OUT);
    this.callHook("onKickout", loginId, fullToken);
    return true;
  }

  /**
   * 刷新 token（仅 JWT 模式）：签发新 JWT，旧 jti 加入黑名单
   * @param token 当前 JWT
   * @param timeout 新 token 过期时间，默认沿用配置
   * @returns 新 JWT，失败返回 null
   */
  async refreshToken(token: string, timeout?: DurationInput): Promise<string | null> {
    if (!token) return null;
    if (!this._isJwtMode()) return null;

    try {
      const payload = this.strategy.verifyToken(token);
      const { sub: loginId, jti } = payload;
      if (!loginId || !jti) return null;

      // 已加入黑名单的 token 不可刷新
      const blacklisted = await this.store.get(this.keys.jwtBlacklistKey(jti));
      if (blacklisted) return null;

      const resolvedTimeout = normalizeDuration(timeout ?? this.config.timeout, {
        field: "timeout",
        allowZero: true,
        allowNever: true,
      });

      // 旧 jti 加入黑名单
      await this.store.set(this.keys.jwtBlacklistKey(jti), "REFRESHED", this.config.timeout);

      // 签发新 JWT
      const newToken = this.strategy.createToken(loginId, this.config, {
        timeout: resolvedTimeout,
      });
      const { jti: newJti } = this.strategy.verifyToken(newToken);

      // 在 session-list 中找到对应设备，更新 sessionKey
      const list = await this.getDeviceList(loginId);
      const info = list.find((d) => d.token === token);
      const device = info?.device ?? "default";

      await this.store.set(this.keys.sessionKey(loginId, device), newJti, resolvedTimeout);
      await this._addToSessionList(
        loginId,
        { device, token: newToken, loginTime: Date.now() },
        resolvedTimeout,
      );

      // 清理旧 jti 的活跃记录
      if (this.config.activeTimeout > 0) {
        await this.store.delete(this.keys.lastActiveKey(jti));
        await this.store.set(this.keys.lastActiveKey(newJti), String(Date.now()), resolvedTimeout);
      }

      this.callHook("onLogin", loginId, newToken, device);
      return newToken;
    } catch {
      return null;
    }
  }

  /**
   * 刷新 token 过期时间
   * @param token
   * @param timeout
   */
  async renewTimeout(token: string, timeout: DurationInput): Promise<boolean | null> {
    if (!token) return null;

    const timeoutSec = normalizeDuration(timeout, {
      field: "timeout",
      allowZero: true,
      allowNever: true,
    });

    if (this._isJwtMode()) {
      try {
        const payload = this.strategy.verifyToken(token);
        const { sub: loginId, jti } = payload;
        if (!loginId || !jti) return null;

        const blacklisted = await this.store.get(this.keys.jwtBlacklistKey(jti));
        if (blacklisted) return null;

        const list = await this.getDeviceList(loginId);
        const info = list.find((d) => d.token === token);
        const device = info?.device ?? "default";

        await this.store.updateTimeout(this.keys.sessionKey(loginId, device), timeoutSec);

        if (this.config.activeTimeout > 0) {
          await this.store.updateTimeout(this.keys.lastActiveKey(jti), timeoutSec);
        }

        return true;
      } catch {
        return null;
      }
    }

    const loginId = await this.store.get(this.keys.tokenKey(token));

    if (!loginId) return null;

    await this.store.updateTimeout(this.keys.tokenKey(token), timeoutSec);
    await this.store.updateTimeout(this.keys.sessionKey(loginId), timeoutSec);

    if (this.config.activeTimeout > 0) {
      await this.store.updateTimeout(this.keys.lastActiveKey(token), timeoutSec);
    }

    return true;
  }

  /**
   * 获取 session
   * @param loginId
   */
  getSession(loginId: string) {
    const key = this.keys.sessionDataKey(loginId);
    return new XltSession(loginId, this.store, key, this.config.timeout);
  }

  /**
   * 获取下线记录
   * @param token
   */
  async getOfflineRecords(token: string): Promise<{ reason: string; time: number } | null> {
    if (!token) return null;
    if (!this.config.offlineRecordEnabled) return null;

    const key = this.keys.offlineRecordKey(token);

    const raw = await this.store.get(key);

    return raw ? JSON.parse(raw) : (null as { reason: string; time: number } | null);
  }

  /**
   * 查询某账号所有在线设备
   * @param loginId
   * @returns
   */
  async getDeviceList(loginId: string): Promise<DeviceInfo[]> {
    const sessionListKey = this.keys.sessionListKey(loginId);
    const raw = await this.store.get(sessionListKey);

    return raw ? JSON.parse(raw) : [];
  }

  /**
   * 登出指定设备（自愿登出，非强制踢下线）
   */
  async logoutByDevice(loginId: string, device: string): Promise<boolean | null> {
    const sessionValue = await this.store.get(this.keys.sessionKey(loginId, device));
    if (!sessionValue) return null;

    const list = await this.getDeviceList(loginId);
    const info = list.find((d) => d.device === device);
    const fullToken = info?.token ?? sessionValue;

    if (this._isJwtMode()) {
      await this.store.set(
        this.keys.jwtBlacklistKey(sessionValue),
        NotLoginType.INVALID_TOKEN,
        this.config.timeout,
      );
    } else {
      await this.store.delete(this.keys.tokenKey(sessionValue));
    }
    await this.store.delete(this.keys.sessionKey(loginId, device));
    await this._removeFromSessionList(loginId, device);
    this.writeOfflineRecord(fullToken, "LOGOUT");
    this.callHook("onLogout", loginId, fullToken, "LOGOUT_BY_DEVICE");
    return true;
  }

  /**
   * 踢掉指定设备
   */
  async kickoutByDevice(loginId: string, device: string): Promise<boolean | null> {
    const sessionValue = await this.store.get(this.keys.sessionKey(loginId, device));
    if (!sessionValue) return null;

    const list = await this.getDeviceList(loginId);
    const info = list.find((d) => d.device === device);
    const fullToken = info?.token ?? sessionValue;

    if (this._isJwtMode()) {
      await this.store.set(
        this.keys.jwtBlacklistKey(sessionValue),
        NotLoginType.KICK_OUT,
        this.config.timeout,
      );
    } else {
      await this.store.update(this.keys.tokenKey(sessionValue), NotLoginType.KICK_OUT);
    }
    await this.store.delete(this.keys.sessionKey(loginId, device));
    await this._removeFromSessionList(loginId, device);
    this.writeOfflineRecord(fullToken, NotLoginType.KICK_OUT);
    this.callHook("onKickout", loginId, fullToken);
    return true;
  }

  /**
   * 踢掉指定 token
   */
  async kickoutByToken(token: string): Promise<boolean | null> {
    if (this._isJwtMode()) {
      let loginId: string;
      let jti: string;
      try {
        const payload = this.strategy.verifyToken(token);
        loginId = payload.sub;
        jti = payload.jti;
        if (!loginId || !jti) return null;
      } catch {
        return null;
      }

      await this.store.set(
        this.keys.jwtBlacklistKey(jti),
        NotLoginType.KICK_OUT,
        this.config.timeout,
      );
      const list = await this.getDeviceList(loginId);
      const info = list.find((d) => d.token === token);
      if (info) {
        await this.store.delete(this.keys.sessionKey(loginId, info.device));
        await this._removeFromSessionList(loginId, info.device);
      }
      this.writeOfflineRecord(token, NotLoginType.KICK_OUT);
      this.callHook("onKickout", loginId, token);
      return true;
    }

    const loginId = await this.store.get(this.keys.tokenKey(token));
    if (!loginId || [NotLoginType.KICK_OUT, NotLoginType.BE_REPLACED].includes(loginId as any)) {
      return null;
    }

    await this.store.update(this.keys.tokenKey(token), NotLoginType.KICK_OUT);
    const list = await this.getDeviceList(loginId);
    const info = list.find((d) => d.token === token);
    if (info) {
      await this.store.delete(this.keys.sessionKey(loginId, info.device));
      await this._removeFromSessionList(loginId, info.device);
    }
    this.writeOfflineRecord(token, NotLoginType.KICK_OUT);
    this.callHook("onKickout", loginId, token);
    return true;
  }

  /**
   * 查询所有在线loginIds
   */
  async getOnlineLoginIds(opts: { page?: number; pageSize?: number } = {}): Promise<string[]> {
    const { page = 0, pageSize = 100 } = opts;

    const pattern = `${this.config.tokenName}:login:session-list:*`;
    const keys = await this.store.keys(pattern);
    const prefix = `${this.config.tokenName}:login:session-list:`;
    const start = page * pageSize;
    return keys.slice(start, start + pageSize).map((k) => k.slice(prefix.length)) as string[];
  }

  /**
   * 在线用户数
   */
  async getOnlineCount(): Promise<number> {
    const pattern = `${this.config.tokenName}:login:session-list:*`;
    const keys = await this.store.keys(pattern);
    return keys.length;
  }

  /**
   * 强制某账号所有设备下线
   */
  async forceLogout(loginId: string): Promise<boolean> {
    const list = await this.getDeviceList(loginId);
    for (const { device } of list) {
      await this.kickoutByDevice(loginId, device);
    }
    return true;
  }

  /**
   * 解析登录id
   * @param req
   * @private
   */
  private async _resolveLoginId(ctx: HttpContext): Promise<AuthResult> {
    const token = await this.getTokenValue(ctx);
    if (!token) return { ok: false, reason: NotLoginType.NOT_TOKEN };

    if (this._isJwtMode()) {
      return this._resolveLoginIdJwt(token);
    }

    const loginId = await this.store.get(this.keys.tokenKey(token));
    if (!loginId) return { ok: false, reason: NotLoginType.INVALID_TOKEN, token };

    if (loginId === NotLoginType.BE_REPLACED)
      return { ok: false, reason: NotLoginType.BE_REPLACED, token };
    if (loginId === NotLoginType.KICK_OUT)
      return { ok: false, reason: NotLoginType.KICK_OUT, token };

    if (this.config.activeTimeout > 0) {
      const lastStr = await this.store.get(this.keys.lastActiveKey(token));
      if (!lastStr) return { ok: false, reason: NotLoginType.TOKEN_FREEZE, token };

      const idle = (Date.now() - Number(lastStr)) / 1000;
      if (idle > this.config.activeTimeout)
        return { ok: false, reason: NotLoginType.TOKEN_TIMEOUT, token };

      await this.store.update(this.keys.lastActiveKey(token), String(Date.now()));
    }

    ctx.state.stpLoginId = loginId;
    ctx.state.stpToken = token;
    return { ok: true, loginId, token };
  }

  private async _resolveLoginIdJwt(token: string) {
    try {
      const payload = this.strategy.verifyToken(token);
      const { sub: loginId, jti } = payload;

      if (!loginId || !jti) return { ok: false, reason: NotLoginType.INVALID_TOKEN, token };

      const jwtBlacklistKey = this.keys.jwtBlacklistKey(jti);
      const blacklisted = await this.store.get(jwtBlacklistKey);

      if (blacklisted === NotLoginType.KICK_OUT)
        return { ok: false, reason: NotLoginType.KICK_OUT, token };
      if (blacklisted === NotLoginType.BE_REPLACED)
        return { ok: false, reason: NotLoginType.BE_REPLACED, token };
      if (blacklisted) return { ok: false, reason: NotLoginType.INVALID_TOKEN, token };

      if (this.config.activeTimeout > 0) {
        const lastActiveKey = this.keys.lastActiveKey(jti);
        const lastStr = await this.store.get(lastActiveKey);

        if (!lastStr) return { ok: false, reason: NotLoginType.TOKEN_FREEZE, token };

        const idle = (Date.now() - Number(lastStr)) / 1000;
        if (idle > this.config.activeTimeout)
          return { ok: false, reason: NotLoginType.TOKEN_TIMEOUT, token };

        await this.store.update(lastActiveKey, String(Date.now()));
      }

      return { ok: true, loginId, token };
    } catch (error: unknown) {
      // 只捕获 JWT 校验相关异常，意外错误往上抛
      if (
        error instanceof Error &&
        (error.name === "JsonWebTokenError" ||
          error.name === "TokenExpiredError" ||
          error.name === "NotBeforeError")
      ) {
        return { ok: false, reason: NotLoginType.INVALID_TOKEN, token };
      }
      throw error;
    }
  }

  /**
   * 处理被顶下线
   * @param loginId
   * @private
   */
  private async replaced(loginId: string, device: string = "default") {
    const sessionKey = this.keys.sessionKey(loginId, device);
    const oldToken = await this.store.get(sessionKey);
    if (oldToken) {
      if (this._isJwtMode()) {
        const jti = await this.store.get(sessionKey);
        if (jti)
          await this.store.set(
            this.keys.jwtBlacklistKey(jti),
            NotLoginType.BE_REPLACED,
            this.config.timeout,
          );
      } else {
        await this.store.update(this.keys.tokenKey(oldToken), NotLoginType.BE_REPLACED);
      }

      await this.store.delete(sessionKey);
      this.writeOfflineRecord(oldToken, NotLoginType.BE_REPLACED);
    }
  }

  private async writeOfflineRecord(token: string, reason: string): Promise<void> {
    if (!this.config.offlineRecordEnabled) return;

    const key = this.keys.offlineRecordKey(token);
    const record = JSON.stringify({ token, reason, time: Date.now() });
    await this.store.set(key, record, this.config.offlineRecordTimeout ?? 3600);
  }

  private async _removeFromSessionList(loginId: string, device: string): Promise<void> {
    const key = this.keys.sessionListKey(loginId);
    const raw = await this.store.get(key);
    if (!raw) return;
    const list: DeviceInfo[] = JSON.parse(raw);
    const filtered = list.filter((d) => d.device !== device);
    if (filtered.length === 0) {
      await this.store.delete(key);
    } else {
      await this.store.set(key, JSON.stringify(filtered), -1); // 继承原 TTL 不变
    }
  }

  /**
   * 是否为JWT模式
   * @returns 是否为JWT模式
   */
  private _isJwtMode(): boolean {
    return !!(this.config.jwt?.secret && typeof (this.strategy as any).verifyToken === "function");
  }

  /** 钩子回调用完整 token（JWT 模式下 session 存的是 jti） */
  private async _resolveHookToken(
    loginId: string,
    device: string,
    sessionValue: string,
  ): Promise<string> {
    if (!this._isJwtMode()) return sessionValue;
    const list = await this.getDeviceList(loginId);
    const info = list.find((d) => d.device === device);
    return info?.token ?? sessionValue;
  }

  private callHook<K extends keyof XltHooks>(
    event: K,
    ...args: Parameters<NonNullable<XltHooks[K]>>
  ): void {
    if (!this.hooks?.[event]) return;
    try {
      const result = (this.hooks[event] as any)(...args);
      if (result instanceof Promise) {
        result.catch((err) => console.error(`[xlt-token] hook ${event} error:`, err));
      }
    } catch (err) {
      console.error(`[xlt-token] hook ${event} error:`, err);
    }
  }
}
