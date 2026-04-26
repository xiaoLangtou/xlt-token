// 核心引擎
import { Request } from 'express';
import { Inject, Injectable } from '@nestjs/common';
import { isNull, isUndefined } from 'es-toolkit';
import { XLT_TOKEN_CONFIG, XLT_TOKEN_STORE, XLT_TOKEN_STRATEGY, type XltTokenConfig } from '../core/xlt-token-config';
import type { XltTokenStore } from '../store/xlt-token-store.interface';
import type { TokenStrategy } from '../token/token-strategy.interface';
import { NotLoginType } from '../const';
import { NotLoginException } from '../exceptions/not-login.exception';
import { XltSession } from '../session/xlt-session';

@Injectable()
export class StpLogic {
  constructor(
    @Inject(XLT_TOKEN_CONFIG) private config: XltTokenConfig,
    @Inject(XLT_TOKEN_STORE) private store: XltTokenStore,
    @Inject(XLT_TOKEN_STRATEGY) private strategy: TokenStrategy,
  ) {
  }

  /**
   * 登录
   * @param loginId
   * @param options
   */
  async login(
    loginId: string | number,
    options: { timeout?: number; device?: string; token?: string } = {},
  ): Promise<string> {
    if (isNull(loginId) || isUndefined(loginId) || loginId === '') throw new Error('invalid loginId');

    const _loginId = String(loginId);

    if (_loginId.includes(':')) {
      throw new Error('invalid loginId');
    }

    const timeout = options.timeout ?? this.config.timeout;

    const oldToken = await this.store.get(this.sessionKey(_loginId));

    let token: string;

    if (!this.config.isConcurrent) {
      if (oldToken) await this.replaced(_loginId);
      token = options.token ?? this.strategy.createToken(_loginId, this.config);
    } else if (this.config.isShare) {
      token = oldToken ? oldToken : (options.token ?? this.strategy.createToken(_loginId, this.config));
    } else {
      token = options.token ?? this.strategy.createToken(_loginId, this.config);
    }

    await this.store.set(this.tokenKey(token), _loginId, timeout);
    await this.store.set(this.sessionKey(_loginId), token, timeout);

    if (this.config.activeTimeout && this.config.activeTimeout > 0) {
      await this.store.set(this.lastActiveKey(token), String(Date.now()), timeout);
    }

    // 返回纯 token，客户端请求时自行拼接前缀（如 "Bearer "）
    return token;
  }

  /**
   * 获取 token 值
   * @param req
   */
  async getTokenValue(req: Request): Promise<string | null> {
    if (this.config.isReadHeader) {
      const raw = req.headers[this.config.tokenName.toLowerCase()];
      if (raw) {
        let _raw = Array.isArray(raw) ? raw[0] : String(raw);
        if (this.config.tokenPrefix && _raw.startsWith(this.config.tokenPrefix)) {
          _raw = _raw.slice(this.config.tokenPrefix.length);
        }
        return _raw.trim();
      }
    }
    if (this.config.isReadCookie) {
      return req.cookies && req.cookies[this.config.tokenName];
    }

    if (this.config.isReadQuery) {
      return req.query && (req.query[this.config.tokenName] as string | null);
    }

    return null;
  }

  /**
   * 是否登录
   * @param req
   */
  async isLogin(req: Request): Promise<boolean> {
    const result = await this._resolveLoginId(req);
    return result.ok;
  }

  /**
   * 检查登录
   * @param req
   */
  async checkLogin(req: Request): Promise<{ ok: boolean; loginId?: string; token?: string; reason?: NotLoginType }> {
    const result = await this._resolveLoginId(req);

    if (!result.ok) {
      throw new NotLoginException(result.reason ?? NotLoginType.NOT_TOKEN);
    }

    return { ok: result.ok, loginId: result.loginId, token: result.token };
  }

  /**
   * 登出
   * @param token
   */
  async logout(token: string): Promise<boolean | null> {
    if (!token) return null;

    const loginId = await this.store.get(this.tokenKey(token));
    if (!loginId) return null;

    await this.store.delete(this.tokenKey(token));
    await this.store.delete(this.lastActiveKey(token));
    await this.store.delete(this.sessionKey(loginId));
    await this.store.delete(this.sessionDataKey(loginId));

    return true;
  }

  /**
   * 根据登录id登出
   * @param loginId
   */
  async logoutByLoginId(loginId: string): Promise<boolean | null> {
    if (!loginId) return null;

    const token = await this.store.get(this.sessionKey(loginId));
    if (!token) return null;
    await this.store.delete(this.sessionKey(loginId));
    await this.store.delete(this.tokenKey(token));
    await this.store.delete(this.lastActiveKey(token));
    await this.store.delete(this.sessionDataKey(loginId));
    return true;
  }

  /**
   * 踢人下线
   * @param loginId
   */
  async kickout(loginId: string): Promise<boolean | null> {
    if (!loginId) return null;
    const sessionKey = this.sessionKey(loginId);
    const token = await this.store.get(sessionKey);
    if (!token) return null;

    await this.store.update(this.tokenKey(token), NotLoginType.KICK_OUT);
    await this.store.delete(sessionKey);
    await this.store.delete(this.sessionDataKey(loginId));
    this.writeOfflineRecord(token, NotLoginType.KICK_OUT);
    return true;
  }

  /**
   * 刷新 token 过期时间
   * @param token
   * @param timeout
   */
  async renewTimeout(token: string, timeout: number): Promise<boolean | null> {
    if (!token) return null;

    const loginId = await this.store.get(this.tokenKey(token));

    if (!loginId) return null;

    await this.store.updateTimeout(this.tokenKey(token), timeout);
    await this.store.updateTimeout(this.sessionKey(loginId), timeout);

    if (this.config.activeTimeout > 0) {
      await this.store.updateTimeout(this.lastActiveKey(token), timeout);
    }

    return true;
  }

  /**
   * 获取 session
   * @param loginId
   */
  getSession(loginId: string) {
    const key = this.sessionDataKey(loginId);
    return new XltSession(loginId, this.store, key, this.config.timeout);
  }


  /**
   * 获取下线记录
   * @param token
   */
  async getOfflineRecords(token: string): Promise<{ reason: string; time: number } | null> {
    if (!token) return null;
    if (!this.config.offlineRecordEnabled) return null;

    const key = this.offlineRecordKey(token);

    const raw = await this.store.get(key);

    return raw ? JSON.parse(raw) : null as { reason: string; time: number } | null;
  }


  /**
   * 解析登录id
   * @param req
   * @private
   */
  private async _resolveLoginId(
    req: Request,
  ): Promise<{ ok: boolean; loginId?: string; token?: string; reason?: NotLoginType }> {
    const token = await this.getTokenValue(req);
    if (!token) return { ok: false, reason: NotLoginType.NOT_TOKEN };

    const loginId = await this.store.get(this.tokenKey(token));
    if (!loginId) return { ok: false, reason: NotLoginType.INVALID_TOKEN, token };

    if (loginId === NotLoginType.BE_REPLACED) return { ok: false, reason: NotLoginType.BE_REPLACED, token };
    if (loginId === NotLoginType.KICK_OUT) return { ok: false, reason: NotLoginType.KICK_OUT, token };

    if (this.config.activeTimeout > 0) {
      const lastStr = await this.store.get(this.lastActiveKey(token));
      if (!lastStr) return { ok: false, reason: NotLoginType.TOKEN_FREEZE, token };

      const idle = (Date.now() - Number(lastStr)) / 1000;
      if (idle > this.config.activeTimeout) return { ok: false, reason: NotLoginType.TOKEN_TIMEOUT, token };

      await this.store.update(this.lastActiveKey(token), String(Date.now()));
    }

    return { ok: true, loginId, token };
  }

  /**
   * 生成token key
   * @param token
   * @private
   */
  private tokenKey(token: string): string {
    return `${this.config.tokenName}:login:token:${token}`;
  }

  /**
   * 生成session key
   * @param loginId
   * @private
   */

  private sessionKey(loginId: string): string {
    return `${this.config.tokenName}:login:session:${loginId}`;
  }

  /**
   * 生成sessionData key
   * @param loginId
   * @private
   */
  private sessionDataKey(loginId: string): string {
    return `${this.config.tokenName}:login:session-data:${loginId}`;
  }

  private offlineRecordKey(token: string): string {
    return `${this.config.tokenName}:login:offline:${token}`;
  }

  /**
   * 生成lastActive
   * @param token
   * @private
   */
  private lastActiveKey(token: string): string {
    return `${this.config.tokenName}:login:lastActive:${token}`;
  }

  /**
   * 处理被顶下线
   * @param loginId
   * @private
   */
  private async replaced(loginId: string) {
    const oldToken = await this.store.get(this.sessionKey(loginId));
    if (oldToken) {
      await this.store.update(this.tokenKey(oldToken), NotLoginType.BE_REPLACED);
      await this.store.delete(this.sessionKey(String(loginId)));
      this.writeOfflineRecord(oldToken, NotLoginType.BE_REPLACED);
    }

  }

  private async writeOfflineRecord(token: string, reason: string): Promise<void> {
    if (!this.config.offlineRecordEnabled) return;

    const key = this.offlineRecordKey(token);
    const record = JSON.stringify({ token, reason, time: Date.now() });
    await this.store.set(key, record, this.config.offlineRecordTimeout ?? 3600);
  }


}
