// 核心引擎
import { isNull, isUndefined } from "es-toolkit";
import { createHash } from "node:crypto";
import type { DeviceInfo, DurationInput, XltTokenConfig } from "../config/xlt-token-config.js";
import { NotLoginType } from "../const/index.js";
import { XltTokenKeys } from "../config/xlt-token-keys.js";
import type { XltAuditEvent, XltAuditEventType } from "../events/xlt-audit-event.js";
import type { XltEventSink } from "../events/xlt-event-sink.js";
import { NotLoginException } from "../exceptions/not-login.exception.js";
import { NotSafeException } from "../exceptions/not-safe.exception.js";
import type { HttpContext } from "../http/context.js";
import {
  normalizeTokenLifecycleConfig,
  type NormalizedTokenLifecycleConfig,
} from "../lifecycle/token-lifecycle.js";
import type {
  RefreshResult,
  RevokeResult,
  RevokeScope,
  TokenFamilyState,
} from "../lifecycle/token-state.js";
import { XltSession } from "../session/xlt-session.js";
import { finiteTtl, type XltTokenStore } from "../store/xlt-token-store.interface.js";
import {
  getStoreValue,
  hasStoreValue,
  replaceStoreValueKeepingTtl,
  scanStoreKeys,
  setStoreValue,
  touchStoreValue,
} from "../store/store-helpers.js";
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
    private eventSink: XltEventSink = {},
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
    const oldToken = await getStoreValue(this.store, sessionKey);

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
      await setStoreValue(this.store, sessionKey, jti, timeout);
      if (this.config.activeTimeout > 0) {
        await setStoreValue(this.store, this.keys.lastActiveKey(jti), String(Date.now()), timeout);
      }
    } else {
      await setStoreValue(this.store, this.keys.tokenKey(token), _loginId, timeout);
      await setStoreValue(this.store, sessionKey, token, timeout);
      if (this.config.activeTimeout > 0) {
        await setStoreValue(
          this.store,
          this.keys.lastActiveKey(token),
          String(Date.now()),
          timeout,
        );
      }
    }

    // 更新全设备索引
    await this._addToSessionList(_loginId, { device, token, loginTime: Date.now() }, timeout);
    await this.createTokenFamily(_loginId, device, token);

    this.emitAuditEvent("token.logged_in", {
      loginId: _loginId,
      device,
      tokenFingerprint: fingerprintToken(token),
    });
    if (replacedOldFullToken) {
      this.emitAuditEvent("token.replaced", {
        loginId: _loginId,
        device,
        previousTokenFingerprint: fingerprintToken(replacedOldFullToken),
        nextTokenFingerprint: fingerprintToken(token),
      });
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
    const raw = await getStoreValue(this.store, key);
    const list: DeviceInfo[] = raw ? JSON.parse(raw) : [];
    // 同 device 去重
    const idx = list.findIndex((d) => d.device === info.device);
    if (idx >= 0) list.splice(idx, 1);
    list.push(info);
    await setStoreValue(
      this.store,
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
    const raw = await getStoreValue(this.store, key);
    if (!raw) return;
    const list: DeviceInfo[] = JSON.parse(raw);
    for (const deviceInfo of list) {
      if (this._isJwtMode()) {
        const { jti } = this.strategy.verifyToken(deviceInfo.token);
        await setStoreValue(
          this.store,
          this.keys.jwtBlacklistKey(jti),
          NotLoginType.KICK_OUT,
          this.config.timeout,
        );
      } else {
        await replaceStoreValueKeepingTtl(
          this.store,
          this.keys.tokenKey(deviceInfo.token),
          NotLoginType.KICK_OUT,
        );
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
      await setStoreValue(
        this.store,
        this.keys.jwtBlacklistKey(oldSessionValue),
        NotLoginType.BE_REPLACED,
        this.config.timeout,
      );
    } else {
      await replaceStoreValueKeepingTtl(
        this.store,
        this.keys.tokenKey(oldSessionValue),
        NotLoginType.BE_REPLACED,
      );
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
    await setStoreValue(
      this.store,
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
    const exists = await hasStoreValue(this.store, this.keys.safeKey(token, business));

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
    await setStoreValue(
      this.store,
      tempTokenKey,
      value,
      normalizeDuration(timeout, { field: "timeout" }),
    );
    return tempToken;
  }

  /**
   * 解析临时token
   * @param tempToken  临时token字符串
   * @returns 要关联的业务数据
   */
  async parseTempToken(tempToken: string): Promise<string | null> {
    return getStoreValue(this.store, this.keys.tempTokenKey(tempToken));
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

        await setStoreValue(
          this.store,
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
        this.emitAuditEvent("token.logged_out", {
          loginId,
          reason: "LOGOUT",
          tokenFingerprint: fingerprintToken(token),
        });
        return true;
      } catch {
        return null;
      }
    }

    const loginId = await getStoreValue(this.store, this.keys.tokenKey(token));
    if (!loginId) return null;

    await this.store.delete(this.keys.tokenKey(token));
    await this.store.delete(this.keys.lastActiveKey(token));
    await this.store.delete(this.keys.sessionKey(loginId));
    await this.store.delete(this.keys.sessionDataKey(loginId));
    const list = await this.getDeviceList(loginId);
    const info = list.find((d) => d.token === token);
    if (info) await this._removeFromSessionList(loginId, info.device);

    this.emitAuditEvent("token.logged_out", {
      loginId,
      reason: "LOGOUT",
      tokenFingerprint: fingerprintToken(token),
    });
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
          await setStoreValue(
            this.store,
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
      this.emitAuditEvent("token.logged_out", {
        loginId,
        device,
        reason: "LOGOUT_BY_LOGIN_ID",
        tokenFingerprint: fingerprintToken(token),
      });
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
    const sessionValue = await getStoreValue(this.store, sessionKey);
    if (!sessionValue) return null;

    const list = await this.getDeviceList(loginId);
    const info = list.find((d) => d.device === device);
    const fullToken = info?.token ?? sessionValue;

    if (this._isJwtMode()) {
      await setStoreValue(
        this.store,
        this.keys.jwtBlacklistKey(sessionValue),
        NotLoginType.KICK_OUT,
        this.config.timeout,
      );
    } else {
      await replaceStoreValueKeepingTtl(
        this.store,
        this.keys.tokenKey(sessionValue),
        NotLoginType.KICK_OUT,
      );
    }

    await this.store.delete(sessionKey);
    await this.store.delete(this.keys.sessionDataKey(loginId));
    this.writeOfflineRecord(fullToken, NotLoginType.KICK_OUT);
    this.emitAuditEvent("token.kicked_out", {
      loginId,
      device,
      tokenFingerprint: fingerprintToken(fullToken),
    });
    return true;
  }

  async refreshToken(token: string, timeout?: DurationInput): Promise<RefreshResult> {
    const lifecycle = this.getLifecycleConfig();
    if (!token || !lifecycle?.refresh.enabled) return { ok: false, code: "TOKEN_INVALID" };

    const stateKey = this.keys.tokenFamilyStateKey(token);
    const raw = await getStoreValue(this.store, stateKey);
    if (!raw) return { ok: false, code: "TOKEN_INVALID" };

    const state = JSON.parse(raw) as TokenFamilyState;
    if (state.status === "revoked") return { ok: false, code: "TOKEN_REVOKED" };
    if (state.status !== "active") return { ok: false, code: "TOKEN_REPLAYED" };
    if (state.refreshExpiresAt <= Date.now()) return { ok: false, code: "TOKEN_EXPIRED" };

    const resolvedTimeout = normalizeDuration(timeout ?? lifecycle.expiration.ttl, {
      field: "timeout",
      allowZero: true,
      allowNever: true,
    });
    const nextToken = this.strategy.createToken(state.loginId, this.config, {
      timeout: resolvedTimeout,
    });
    const now = Date.now();
    const nextState: TokenFamilyState = {
      ...state,
      generation: state.generation + 1,
      accessExpiresAt: now + resolvedTimeout * 1000,
      refreshExpiresAt: now + lifecycle.refresh.ttl * 1000,
    };
    const nextRaw = JSON.stringify(nextState);

    const advanced = await this.store.compareAndSet(
      stateKey,
      raw,
      nextRaw,
      finiteTtl(lifecycle.refresh.ttl),
    );
    if (!advanced) {
      await this.revokeFamilyAfterReplay(stateKey);
      return { ok: false, code: "TOKEN_REPLAYED" };
    }

    await setStoreValue(this.store, this.keys.tokenKey(nextToken), state.loginId, resolvedTimeout);
    await setStoreValue(
      this.store,
      this.keys.sessionKey(state.loginId, state.device),
      nextToken,
      resolvedTimeout,
    );
    await replaceStoreValueKeepingTtl(this.store, this.keys.tokenKey(token), NotLoginType.KICK_OUT);
    await this._addToSessionList(
      state.loginId,
      { device: state.device, token: nextToken, loginTime: now },
      resolvedTimeout,
    );

    this.emitAuditEvent("token.refreshed", {
      loginId: state.loginId,
      device: state.device,
      previousTokenFingerprint: fingerprintToken(token),
      nextTokenFingerprint: fingerprintToken(nextToken),
    });
    return { ok: true, accessToken: nextToken, family: nextState };
  }

  async revoke(target: string, scope: RevokeScope): Promise<RevokeResult> {
    if (scope !== "family") {
      return { ok: true, alreadyRevoked: false, scope };
    }

    const stateKey = this.keys.tokenFamilyStateKey(target);
    const raw = await getStoreValue(this.store, stateKey);
    if (!raw) return { ok: true, alreadyRevoked: true, scope };

    const state = JSON.parse(raw) as TokenFamilyState;
    if (state.status === "revoked") {
      return { ok: true, alreadyRevoked: true, scope };
    }

    const revoked: TokenFamilyState = { ...state, status: "revoked" };
    const changed = await this.store.compareAndSet(
      stateKey,
      raw,
      JSON.stringify(revoked),
      finiteTtl(1),
    );

    return { ok: true, alreadyRevoked: !changed, scope };
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

        const blacklisted = await getStoreValue(this.store, this.keys.jwtBlacklistKey(jti));
        if (blacklisted) return null;

        const list = await this.getDeviceList(loginId);
        const info = list.find((d) => d.token === token);
        const device = info?.device ?? "default";

        await touchStoreValue(this.store, this.keys.sessionKey(loginId, device), timeoutSec);

        if (this.config.activeTimeout > 0) {
          await touchStoreValue(this.store, this.keys.lastActiveKey(jti), timeoutSec);
        }

        return true;
      } catch {
        return null;
      }
    }

    const loginId = await getStoreValue(this.store, this.keys.tokenKey(token));

    if (!loginId) return null;

    await touchStoreValue(this.store, this.keys.tokenKey(token), timeoutSec);
    await touchStoreValue(this.store, this.keys.sessionKey(loginId), timeoutSec);

    if (this.config.activeTimeout > 0) {
      await touchStoreValue(this.store, this.keys.lastActiveKey(token), timeoutSec);
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

    const raw = await getStoreValue(this.store, key);

    return raw ? JSON.parse(raw) : (null as { reason: string; time: number } | null);
  }

  /**
   * 查询某账号所有在线设备
   * @param loginId
   * @returns
   */
  async getDeviceList(loginId: string): Promise<DeviceInfo[]> {
    const sessionListKey = this.keys.sessionListKey(loginId);
    const raw = await getStoreValue(this.store, sessionListKey);

    return raw ? JSON.parse(raw) : [];
  }

  /**
   * 登出指定设备（自愿登出，非强制踢下线）
   */
  async logoutByDevice(loginId: string, device: string): Promise<boolean | null> {
    const sessionValue = await getStoreValue(this.store, this.keys.sessionKey(loginId, device));
    if (!sessionValue) return null;

    const list = await this.getDeviceList(loginId);
    const info = list.find((d) => d.device === device);
    const fullToken = info?.token ?? sessionValue;

    if (this._isJwtMode()) {
      await setStoreValue(
        this.store,
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
    this.emitAuditEvent("token.logged_out", {
      loginId,
      device,
      reason: "LOGOUT_BY_DEVICE",
      tokenFingerprint: fingerprintToken(fullToken),
    });
    return true;
  }

  /**
   * 踢掉指定设备
   */
  async kickoutByDevice(loginId: string, device: string): Promise<boolean | null> {
    const sessionValue = await getStoreValue(this.store, this.keys.sessionKey(loginId, device));
    if (!sessionValue) return null;

    const list = await this.getDeviceList(loginId);
    const info = list.find((d) => d.device === device);
    const fullToken = info?.token ?? sessionValue;

    if (this._isJwtMode()) {
      await setStoreValue(
        this.store,
        this.keys.jwtBlacklistKey(sessionValue),
        NotLoginType.KICK_OUT,
        this.config.timeout,
      );
    } else {
      await replaceStoreValueKeepingTtl(
        this.store,
        this.keys.tokenKey(sessionValue),
        NotLoginType.KICK_OUT,
      );
    }
    await this.store.delete(this.keys.sessionKey(loginId, device));
    await this._removeFromSessionList(loginId, device);
    this.writeOfflineRecord(fullToken, NotLoginType.KICK_OUT);
    this.emitAuditEvent("token.kicked_out", {
      loginId,
      device,
      tokenFingerprint: fingerprintToken(fullToken),
    });
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

      await setStoreValue(
        this.store,
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
      this.emitAuditEvent("token.kicked_out", {
        loginId,
        tokenFingerprint: fingerprintToken(token),
      });
      return true;
    }

    const loginId = await getStoreValue(this.store, this.keys.tokenKey(token));
    if (!loginId || [NotLoginType.KICK_OUT, NotLoginType.BE_REPLACED].includes(loginId as any)) {
      return null;
    }

    await replaceStoreValueKeepingTtl(this.store, this.keys.tokenKey(token), NotLoginType.KICK_OUT);
    const list = await this.getDeviceList(loginId);
    const info = list.find((d) => d.token === token);
    if (info) {
      await this.store.delete(this.keys.sessionKey(loginId, info.device));
      await this._removeFromSessionList(loginId, info.device);
    }
    this.writeOfflineRecord(token, NotLoginType.KICK_OUT);
    this.emitAuditEvent("token.kicked_out", {
      loginId,
      tokenFingerprint: fingerprintToken(token),
    });
    return true;
  }

  /**
   * 查询所有在线loginIds
   */
  async getOnlineLoginIds(opts: { page?: number; pageSize?: number } = {}): Promise<string[]> {
    const { page = 0, pageSize = 100 } = opts;

    const pattern = `${this.config.tokenName}:login:session-list:*`;
    const keys = await scanStoreKeys(this.store, pattern);
    const prefix = `${this.config.tokenName}:login:session-list:`;
    const start = page * pageSize;
    return keys.slice(start, start + pageSize).map((k) => k.slice(prefix.length)) as string[];
  }

  /**
   * 在线用户数
   */
  async getOnlineCount(): Promise<number> {
    const pattern = `${this.config.tokenName}:login:session-list:*`;
    const keys = await scanStoreKeys(this.store, pattern);
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

    const loginId = await getStoreValue(this.store, this.keys.tokenKey(token));
    if (!loginId) return { ok: false, reason: NotLoginType.INVALID_TOKEN, token };

    if (loginId === NotLoginType.BE_REPLACED)
      return { ok: false, reason: NotLoginType.BE_REPLACED, token };
    if (loginId === NotLoginType.KICK_OUT)
      return { ok: false, reason: NotLoginType.KICK_OUT, token };

    if (this.config.activeTimeout > 0) {
      const lastStr = await getStoreValue(this.store, this.keys.lastActiveKey(token));
      if (!lastStr) return { ok: false, reason: NotLoginType.TOKEN_FREEZE, token };

      const idle = (Date.now() - Number(lastStr)) / 1000;
      if (idle > this.config.activeTimeout)
        return { ok: false, reason: NotLoginType.TOKEN_TIMEOUT, token };

      await replaceStoreValueKeepingTtl(
        this.store,
        this.keys.lastActiveKey(token),
        String(Date.now()),
      );
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
      const blacklisted = await getStoreValue(this.store, jwtBlacklistKey);

      if (blacklisted === NotLoginType.KICK_OUT)
        return { ok: false, reason: NotLoginType.KICK_OUT, token };
      if (blacklisted === NotLoginType.BE_REPLACED)
        return { ok: false, reason: NotLoginType.BE_REPLACED, token };
      if (blacklisted) return { ok: false, reason: NotLoginType.INVALID_TOKEN, token };

      if (this.config.activeTimeout > 0) {
        const lastActiveKey = this.keys.lastActiveKey(jti);
        const lastStr = await getStoreValue(this.store, lastActiveKey);

        if (!lastStr) return { ok: false, reason: NotLoginType.TOKEN_FREEZE, token };

        const idle = (Date.now() - Number(lastStr)) / 1000;
        if (idle > this.config.activeTimeout)
          return { ok: false, reason: NotLoginType.TOKEN_TIMEOUT, token };

        await replaceStoreValueKeepingTtl(this.store, lastActiveKey, String(Date.now()));
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
    const oldToken = await getStoreValue(this.store, sessionKey);
    if (oldToken) {
      if (this._isJwtMode()) {
        const jti = await getStoreValue(this.store, sessionKey);
        if (jti)
          await setStoreValue(
            this.store,
            this.keys.jwtBlacklistKey(jti),
            NotLoginType.BE_REPLACED,
            this.config.timeout,
          );
      } else {
        await replaceStoreValueKeepingTtl(
          this.store,
          this.keys.tokenKey(oldToken),
          NotLoginType.BE_REPLACED,
        );
      }

      await this.store.delete(sessionKey);
      this.writeOfflineRecord(oldToken, NotLoginType.BE_REPLACED);
    }
  }

  private async writeOfflineRecord(token: string, reason: string): Promise<void> {
    if (!this.config.offlineRecordEnabled) return;

    const key = this.keys.offlineRecordKey(token);
    const record = JSON.stringify({ token, reason, time: Date.now() });
    await setStoreValue(this.store, key, record, this.config.offlineRecordTimeout ?? 3600);
  }

  private async _removeFromSessionList(loginId: string, device: string): Promise<void> {
    const key = this.keys.sessionListKey(loginId);
    const raw = await getStoreValue(this.store, key);
    if (!raw) return;
    const list: DeviceInfo[] = JSON.parse(raw);
    const filtered = list.filter((d) => d.device !== device);
    if (filtered.length === 0) {
      await this.store.delete(key);
    } else {
      await setStoreValue(this.store, key, JSON.stringify(filtered), -1); // 继承原 TTL 不变
    }
  }

  private async createTokenFamily(loginId: string, device: string, token: string): Promise<void> {
    const lifecycle = this.getLifecycleConfig();
    if (!lifecycle?.refresh.enabled) return;

    const now = Date.now();
    const state: TokenFamilyState = {
      familyId: token,
      loginId,
      device,
      generation: 0,
      status: "active",
      accessExpiresAt: now + lifecycle.expiration.ttl * 1000,
      refreshExpiresAt: now + lifecycle.refresh.ttl * 1000,
    };

    await setStoreValue(
      this.store,
      this.keys.tokenFamilyStateKey(state.familyId),
      JSON.stringify(state),
      lifecycle.refresh.ttl,
    );
    await setStoreValue(
      this.store,
      this.keys.tokenFamilyGenerationKey(state.familyId, state.generation),
      token,
      lifecycle.refresh.ttl,
    );
  }

  private getLifecycleConfig(): NormalizedTokenLifecycleConfig | undefined {
    const lifecycle = this.config.lifecycle;
    if (!lifecycle) return undefined;
    if (typeof lifecycle.expiration.ttl === "number" && typeof lifecycle.refresh.ttl === "number") {
      return lifecycle as NormalizedTokenLifecycleConfig;
    }
    return normalizeTokenLifecycleConfig(lifecycle as any);
  }

  private async revokeFamilyAfterReplay(stateKey: string): Promise<void> {
    const current = await getStoreValue(this.store, stateKey);
    if (!current) return;
    const state = JSON.parse(current) as TokenFamilyState;
    const revoked: TokenFamilyState = { ...state, status: "revoked" };
    await this.store.compareAndSet(stateKey, current, JSON.stringify(revoked), finiteTtl(1));
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

  private emitAuditEvent(
    type: XltAuditEventType,
    event: Omit<XltAuditEvent, "schemaVersion" | "type" | "occurredAt">,
  ): void {
    if (!this.eventSink?.emit) return;
    const payload: XltAuditEvent = {
      schemaVersion: 1,
      type,
      occurredAt: Date.now(),
      ...event,
    };
    try {
      const result = this.eventSink.emit(payload);
      if (result instanceof Promise) {
        result.catch((err) => console.error(`[xlt-token] event ${type} error:`, err));
      }
    } catch (err) {
      console.error(`[xlt-token] event ${type} error:`, err);
    }
  }
}

function fingerprintToken(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}
