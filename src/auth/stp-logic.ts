// 核心引擎
import { Request } from 'express';
import { Inject, Injectable } from '@nestjs/common';
import { isNull, isUndefined } from 'es-toolkit';
import { XLT_TOKEN_CONFIG, XLT_TOKEN_STORE, XLT_TOKEN_STRATEGY, type XltTokenConfig } from '../core/xlt-token-config';
import type { XltTokenStore } from '../store/xlt-token-store.interface';
import type { TokenStrategy } from '../token/token-strategy.interface';
import { DeviceInfo, NotLoginType } from '../const';
import { NotLoginException } from '../exceptions/not-login.exception';
import { XltSession } from '../session/xlt-session';
import { XLT_TOKEN_HOOKS, XltHooks } from '../hooks/xlt-hooks.interface';
import { NotSafeException } from '../exceptions/not-safe.exception';

@Injectable()
export class StpLogic {
  constructor(
    @Inject(XLT_TOKEN_CONFIG) private config: XltTokenConfig,
    @Inject(XLT_TOKEN_STORE) private store: XltTokenStore,
    @Inject(XLT_TOKEN_STRATEGY) private strategy: TokenStrategy,
    @Inject(XLT_TOKEN_HOOKS) private hooks: XltHooks,
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


    const device = options.device ?? 'default';
    const timeout = options.timeout ?? this.config.timeout;

    const sessionKey = this.sessionKey(_loginId, device);
    const oldToken = await this.store.get(sessionKey);



    let token: string;
    if (!this.config.deviceConcurrent) {
      // 任意新登录踢掉所有设备（等价于 1.0 isConcurrent=false 的全局版）
      await this._kickoutAllDevices(_loginId);
      token = options.token ?? this.strategy.createToken(_loginId, this.config);
    } else if (!this.config.isConcurrent) {
      // 同设备互踢
      if (oldToken) await this._replacedToken(_loginId, oldToken);
      token = options.token ?? this.strategy.createToken(_loginId, this.config);
    } else if (this.config.isShare && oldToken) {
      token = oldToken;
    } else {
      token = options.token ?? this.strategy.createToken(_loginId, this.config);
    }

    await this.store.set(this.tokenKey(token), _loginId, timeout);
    await this.store.set(sessionKey, token, timeout);

    // 更新全设备索引
    await this._addToSessionList(_loginId, { device, token, loginTime: Date.now() }, timeout);

    if (this.config.activeTimeout && this.config.activeTimeout > 0) {
      await this.store.set(this.lastActiveKey(token), String(Date.now()), timeout);
    }


    // ── 触发钩子 ──
    this.callHook('onLogin', _loginId, token, device);
    // 返回纯 token，客户端请求时自行拼接前缀（如 "Bearer "）
    return token;
  }


  /**
   * 添加到 session-list
   * @param loginId 
   * @param info 
   * @param timeout 
   */
  async _addToSessionList(loginId: string, info: DeviceInfo, timeout: number): Promise<void> {
    const key = this.sessionListKey(loginId);
    const raw = await this.store.get(key);
    const list: DeviceInfo[] = raw ? JSON.parse(raw) : [];
    // 同 device 去重
    const idx = list.findIndex(d => d.device === info.device);
    if (idx >= 0) list.splice(idx, 1);
    list.push(info);
    await this.store.set(key, JSON.stringify(list), timeout);
  }

  /**
   * 踢掉所有设备
   * @param loginId 
   * @returns 
   */
  async _kickoutAllDevices(loginId: string): Promise<void> {
    const key = this.sessionListKey(loginId);
    const raw = await this.store.get(key);
    if (!raw) return;
    const list: DeviceInfo[] = JSON.parse(raw);
    for (const device of list) {
      await this.store.update(this.tokenKey(device.token), NotLoginType.KICK_OUT);
    }
  }

  /**
   * 被顶下线
   * @param loginId 
   * @param token 
   */
  async _replacedToken(loginId: string, token: string): Promise<void> {
    await this.store.update(this.tokenKey(token), NotLoginType.BE_REPLACED);
    await this.store.delete(this.sessionKey(loginId));
    this.writeOfflineRecord(token, NotLoginType.BE_REPLACED);
  }


  /**
   * 打开二级认证窗口
   * @param token  用户token
   * @param business  业务标识
   * @param timeout 有效期（秒）
   */
  async openSafe(token: string, business: string, timeout: number): Promise<void> {
    const safeKey = this.safeKey(token, business);
    await this.store.set(safeKey, String(Date.now()), timeout);
  }

  /**
   * 检查二级认证是否有效
   * @param token 用户token
   * @param business 业务标识
   * @returns 是否有效
   */
  async checkSafe(token: string, business: string): Promise<void> {

    const exists = await this.store.has(this.safeKey(token, business));

    if (!exists) throw new NotSafeException(business);
  }


  /**
   * 主动关闭二级认证
   * @param token 
   * @param business 
   */
  async closeSafe(token: string, business: string): Promise<void> {
    await this.store.delete(this.safeKey(token, business));
  }




  /**
   * 创建临时token
   * @param value  要关联的业务数据
   * @param timeout 有效期（秒）
   * @returns 临时token字符串
   */
  async createTempToken(value: string, timeout: number): Promise<string> {
    const tempToken = this.strategy.createToken('__temp__', this.config);
    const tempTokenKey = this.tempTokenKey(tempToken);
    await this.store.set(tempTokenKey, value, timeout);
    return tempToken;
  }

  /**
   * 解析临时token
   * @param tempToken  临时token字符串
   * @returns 要关联的业务数据
   */
  async parseTempToken(tempToken: string): Promise<string | null> {
    return this.store.get(this.tempTokenKey(tempToken));
  }

  /**
   * 销毁临时token
   * @param tempToken  临时token字符串
   */
  async deleteTempToken(tempToken: string): Promise<void> {
    await this.store.delete(this.tempTokenKey(tempToken));
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
    const list = await this.getDeviceList(loginId);
    const info = list.find(d => d.token === token);
    if (info) await this._removeFromSessionList(loginId, info.device);

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

  private sessionKey(loginId: string, device = 'default'): string {
    return `${this.config.tokenName}:login:session:${loginId}:${device}`;
  }


  private sessionListKey(loginId: string): string {
    return `${this.config.tokenName}:login:session-list:${loginId}`;
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
   * 生成二级认证key
   * @param token  用户token
   * @param business 业务标识
   * @returns 二级认证key
   */
  private safeKey(token: string, business: string): string {
    return `${this.config.tokenName}:safe:${token}:${business}`;
  }


  /**
   * 生成临时token key
   * @param tempToken  临时token字符串
   * @returns 临时token key
   */
  private tempTokenKey(tempToken: string): string {
    return `${this.config.tokenName}:temp-token:${tempToken}`;
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


  private async _removeFromSessionList(loginId: string, device: string): Promise<void> {
    const key = this.sessionListKey(loginId);
    const raw = await this.store.get(key);
    if (!raw) return;
    const list: DeviceInfo[] = JSON.parse(raw);
    const filtered = list.filter(d => d.device !== device);
    if (filtered.length === 0) {
      await this.store.delete(key);
    } else {
      await this.store.set(key, JSON.stringify(filtered), -1); // 继承原 TTL 不变
    }
  }


  /**
   * 查询某账号所有在线设备
   * @param loginId 
   * @returns 
   */
  async getDeviceList(loginId: string): Promise<DeviceInfo[]> {

    const sessionListKey = this.sessionListKey(loginId);
    const raw = await this.store.get(sessionListKey);

    return raw ? JSON.parse(raw) : [];

  }



  /**
 * 踢掉指定设备
 */
  async kickoutByDevice(loginId: string, device: string): Promise<boolean | null> {
    const token = await this.store.get(this.sessionKey(loginId, device));
    if (!token) return null;

    await this.store.update(this.tokenKey(token), NotLoginType.KICK_OUT);
    await this.store.delete(this.sessionKey(loginId, device));
    await this._removeFromSessionList(loginId, device);
    this.writeOfflineRecord(token, NotLoginType.KICK_OUT);
    this.callHook('onKickout', loginId, token);
    return true;
  }

  /**
   * 踢掉指定 token
   */
  async kickoutByToken(token: string): Promise<boolean | null> {
    const loginId = await this.store.get(this.tokenKey(token));
    if (!loginId || [NotLoginType.KICK_OUT, NotLoginType.BE_REPLACED].includes(loginId as any)) {
      return null;
    }

    await this.store.update(this.tokenKey(token), NotLoginType.KICK_OUT);
    // 从 session-list 中找到对应 device 并删除
    const list = await this.getDeviceList(loginId);
    const info = list.find(d => d.token === token);
    if (info) {
      await this.store.delete(this.sessionKey(loginId, info.device));
      await this._removeFromSessionList(loginId, info.device);
    }
    this.writeOfflineRecord(token, NotLoginType.KICK_OUT);
    this.callHook('onKickout', loginId, token);
    return true;
  }


  private callHook<K extends keyof XltHooks>(event: K, ...args: Parameters<NonNullable<XltHooks[K]>>): void {
    if (!this.hooks?.[event]) return;
    try {
      const result = (this.hooks[event] as any)(...args);
      if (result instanceof Promise) {
        result.catch(err => console.error(`[xlt-token] hook ${event} error:`, err));
      }
    } catch (err) {
      console.error(`[xlt-token] hook ${event} error:`, err);
    }
  }


  /**
   * 查询所有在线loginIds
   */
  async getOnlineLoginIds(opts: { page?: number, pageSize?: number } = {}): Promise<string[]> {
    const { page = 0, pageSize = 100 } = opts;

    const pattern = `${this.config.tokenName}:login:session-list:*`;
    const keys = await this.store.keys(pattern);
    const prefix = `${this.config.tokenName}:login:session-list:`;
    const start = page * pageSize;
    return keys.slice(start, start + pageSize).map(k => k.slice(prefix.length)) as string[];

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
}
