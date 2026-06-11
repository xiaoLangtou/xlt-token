import { XltTokenStore as XltTokenStore$1 } from "@xlt-token/core";

//#region src/const/index.d.ts
/**
 * 登录状态
 */
declare const NotLoginType: {
  readonly NOT_TOKEN: "NOT_TOKEN";
  readonly INVALID_TOKEN: "INVALID_TOKEN";
  readonly TOKEN_TIMEOUT: "TOKEN_TIMEOUT";
  readonly TOKEN_FREEZE: "TOKEN_FREEZE";
  readonly BE_REPLACED: "BE_REPLACED";
  readonly KICK_OUT: "KICK_OUT";
};
type NotLoginType = (typeof NotLoginType)[keyof typeof NotLoginType];
declare const XLT_IGNORE_KEY = "XltIgnore";
declare const XLT_CHECK_LOGIN_KEY = "XltCheckLogin";
/**
 * 权限检查模式
 */
declare const XltMode: {
  readonly AND: "AND";
  readonly OR: "OR";
};
type XltMode = typeof XltMode[keyof typeof XltMode];
declare const XLT_PERMISSION_KEY = "XltCheckPermission";
declare const XLT_ROLE_KEY = "xltCheckRole";
//#endregion
//#region src/config/xlt-token-config.d.ts
type DurationUnit = 's' | 'm' | 'h' | 'd' | 'w';
type DurationString = `${number}${DurationUnit}`;
type DurationInput = number | DurationString;
interface JwtConfig {
  secret: string;
  algorithm?: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
  issuer?: string;
  audience?: string;
}
interface DeviceInfo {
  device: string;
  token: string;
  loginTime: number;
}
interface XltTokenConfig {
  tokenName: string;
  timeout: number;
  activeTimeout: number;
  isConcurrent: boolean;
  isShare: boolean;
  tokenStyle: 'uuid' | 'simple-uuid' | 'random-32';
  isReadHeader: boolean;
  isReadCookie: boolean;
  isReadQuery: boolean;
  tokenPrefix: string;
  defaultCheck: boolean;
  permCacheTimeout?: number;
  offlineRecordEnabled?: boolean;
  offlineRecordTimeout?: number;
  deviceConcurrent?: boolean;
  jwt?: JwtConfig;
}
interface XltTokenConfigInput extends Omit<XltTokenConfig, 'timeout' | 'activeTimeout' | 'permCacheTimeout' | 'offlineRecordTimeout'> {
  timeout: DurationInput;
  activeTimeout: DurationInput;
  permCacheTimeout?: DurationInput;
  offlineRecordTimeout?: DurationInput;
}
declare const DEFAULT_XLT_TOKEN_CONFIG: XltTokenConfig;
declare const XLT_TOKEN_CONFIG = "XLT_TOKEN_CONFIG";
declare const XLT_TOKEN_STORE = "XLT_TOKEN_STORE";
declare const XLT_TOKEN_STRATEGY = "XLT_TOKEN_STRATEGY";
//#endregion
//#region src/config/xlt-token-keys.d.ts
declare class XltTokenKeys {
  readonly tokenName: string;
  constructor(tokenName: string);
  /**
   * 生成token key
   * @param token
   * @
   */
  tokenKey(token: string): string;
  /**
   * 生成session key
   * @param loginId
   * @
   */
  sessionKey(loginId: string, device?: string): string;
  sessionListKey(loginId: string): string;
  jwtBlacklistKey(jti: string): string;
  /**
   * 生成sessionData key
   * @param loginId
   * @
   */
  sessionDataKey(loginId: string): string;
  offlineRecordKey(token: string): string;
  /**
   * 生成lastActive
   * @param token
   * @
   */
  lastActiveKey(token: string): string;
  /**
   * 生成二级认证key
   * @param token  用户token
   * @param business 业务标识
   * @returns 二级认证key
   */
  safeKey(token: string, business: string): string;
  /**
   * 生成临时token key
   * @param tempToken  临时token字符串
   * @returns 临时token key
   */
  tempTokenKey(tempToken: string): string;
  permCacheKey(loginId: string): string;
  roleCacheKey(loginId: string): string;
}
//#endregion
//#region src/store/xlt-token-store.interface.d.ts
interface XltTokenStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, timeoutSec: number): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  update(key: string, value: string): Promise<void>;
  updateTimeout(key: string, timeoutSec: number): Promise<void>;
  getTimeout(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}
//#endregion
//#region src/store/memory-store.d.ts
declare class MemoryStore implements XltTokenStore {
  private static readonly MAX_TIMER_DELAY_MS;
  private readonly store;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, timeoutSec: number): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  update(key: string, value: string): Promise<void>;
  updateTimeout(key: string, timeoutSec: number): Promise<void>;
  getTimeout(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  private peek;
  private clearTimer;
  private scheduleExpire;
}
//#endregion
//#region src/token/token-strategy.interface.d.ts
interface TokenStrategy {
  generateToken(payload: any): string;
  verifyToken(token: string): any;
  createToken(loginId: string, config: XltTokenConfig, options?: {
    timeout?: DurationInput;
  }): string;
}
//#endregion
//#region src/token/uuid-strategy.d.ts
declare class UuidStrategy implements TokenStrategy {
  generateToken(_payload: unknown): string;
  verifyToken(token: string): unknown;
  createToken(_loginId: string, config: XltTokenConfig, _options?: {
    timeout?: DurationInput;
  }): string;
  private buildRaw;
}
//#endregion
//#region src/hooks/xlt-hooks.interface.d.ts
interface XltHooks {
  /**
   * 登录成功后触发
   * @param loginId 登录ID
   * @param token 令牌
   * @param device 设备
   */
  onLogin?: (loginId: string, token: string, device: string) => void | Promise<void>;
  /**
   * 登出后触发
   * @param loginId 登录ID
   * @param token 令牌
   * @param reason 登出原因
   */
  onLogout?: (loginId: string, token: string, reason: string) => void | Promise<void>;
  /**
   * 踢出后触发
   * @param loginId 登录ID
   * @param token 令牌
   */
  onKickout?: (loginId: string, token: string) => void | Promise<void>;
  /**
   * 替换后触发
   * @param loginId 登录ID
   * @param oldToken 旧令牌
   * @param newToken 新令牌
   */
  onReplaced?: (loginId: string, oldToken: string, newToken: string) => void | Promise<void>;
}
/**
 * 钩子注入 token
 */
declare const XLT_TOKEN_HOOKS = "XLT_TOKEN_HOOKS";
//#endregion
//#region src/perm/stp-interface.d.ts
interface StpInterface {
  /**
   * 根据登录ID获取权限列表
   * @param loginId 登录ID
   * @example ['user:add', 'user:delete']
   * @returns 权限列表
   */
  getPermissionList(loginId: string): Promise<string[]> | string[];
  /**
   * 根据登录ID获取角色列表
   * @param loginId 登录ID
   * @example ['admin', 'user']
   * @returns 角色列表
   */
  getRoleList(loginId: string): Promise<string[]> | string[];
}
declare const XLT_STP_INTERFACE = "XLT_STP_INTERFACE";
//#endregion
//#region src/perm/perm-pattern-match.d.ts
/**
 * 通配符匹配，支持*通配符
 * @param pattern 匹配模式
 * @param target 目标字符串
 */
declare function matchPermission(pattern: string, target: string): boolean;
//#endregion
//#region src/http/context.d.ts
interface CookieOptions {
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: boolean | 'lax' | 'strict' | 'none';
  signed?: boolean;
}
interface HttpHeaders {
  get(name: string): string | null;
}
interface HttpCookies {
  get(name: string): string | null;
}
interface HttpQuery {
  get(name: string): string | null;
}
interface HttpContext {
  readonly headers: HttpHeaders;
  readonly cookies: HttpCookies;
  readonly query: HttpQuery;
  /**
   * 请求级别的共享状态，由核心层写入，由各框架集成层映射到框架习惯位置。
   * 生命周期：与单次请求绑定，每次 createXxxContext() 调用持有同一引用。
   */
  state: Record<string, unknown>;
  setHeader(name: string, value: string): void;
  setCookie(name: string, value: string, options?: CookieOptions): void;
  /** 逃生口：访问框架原始对象 */
  raw<T = unknown>(): T;
}
//#endregion
//#region src/http/express.d.ts
interface ExpressLikeRequest {
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
  query?: Record<string, unknown>;
  _xltState?: Record<string, unknown>;
}
interface ExpressLikeResponse {
  setHeader(name: string, value: string): void;
  cookie(name: string, value: string, options?: CookieOptions): void;
}
declare function createExpressContext(req: ExpressLikeRequest, res: ExpressLikeResponse): HttpContext;
//#endregion
//#region src/http/testing.d.ts
interface MockHttpContextOptions {
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
  query?: Record<string, string>;
  state?: Record<string, unknown>;
}
declare function createMockHttpContext(options?: MockHttpContextOptions): HttpContext;
//#endregion
//#region src/exceptions/xlt-error.d.ts
declare class XltError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code: string, status: number);
}
//#endregion
//#region src/exceptions/not-login.exception.d.ts
declare class NotLoginException extends XltError {
  readonly status = 401;
  readonly type: NotLoginType;
  readonly token?: string;
  constructor(type: NotLoginType, token?: string);
  private static describeType;
}
//#endregion
//#region src/exceptions/not-permission.exception.d.ts
declare class NotPermissionException extends XltError {
  readonly status = 403;
  readonly permission: string | string[];
  readonly mode: XltMode;
  constructor(permission: string | string[], mode: XltMode);
}
//#endregion
//#region src/exceptions/not-role.exception.d.ts
declare class NotRoleException extends XltError {
  readonly status = 403;
  readonly role: string | string[];
  readonly mode: XltMode;
  constructor(role: string | string[], mode: XltMode);
}
//#endregion
//#region src/exceptions/not-safe.exception.d.ts
declare class NotSafeException extends XltError {
  readonly status = 403;
  readonly business: string;
  constructor(business: string);
}
//#endregion
//#region src/session/xlt-session.d.ts
declare class XltSession {
  private loginId;
  private store;
  private storeKey;
  private timeout;
  private data;
  constructor(loginId: string, store: XltTokenStore$1, storeKey: string, timeout: number);
  /**
   * 获取会话数据
   * @returns The session data.
   */
  get<T = unknown>(key: string): Promise<T | null>;
  /**
   * 设置会话数据
   * @param key The key of the session data.
   * @param value The value of the session data.
   */
  set(key: string, value: unknown): Promise<void>;
  /**
   * 判断会话数据是否存在
   * @param key The key of the session data.
   * @returns A boolean indicating whether the session data exists.
   */
  has(key: string): Promise<boolean>;
  /**
   * 删除会话数据
   * @param key The key of the session data.
   */
  remove(key: string): Promise<void>;
  /**
   * 清空会话数据
   */
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  /**
   * 加载会话数据
   * @returns The session data.
   */
  private load;
  /**
   * 保存会话数据
   */
  private save;
}
//#endregion
//#region src/auth/stp-logic.d.ts
interface AuthResult {
  ok: boolean;
  loginId?: string;
  token?: string;
  reason?: NotLoginType;
}
declare class StpLogic {
  private config;
  private store;
  private strategy;
  private hooks;
  constructor(config: XltTokenConfig, store: XltTokenStore, strategy: TokenStrategy, hooks?: XltHooks);
  private readonly keys;
  /**
   * 登录
   * @param loginId
   * @param options
   */
  login(loginId: string | number, options?: {
    timeout?: DurationInput;
    device?: string;
    token?: string;
  }): Promise<string>;
  /**
   * 添加到 session-list
   * @param loginId
   * @param info
   * @param timeout
   */
  _addToSessionList(loginId: string, info: DeviceInfo, timeout: DurationInput): Promise<void>;
  /**
   * 踢掉所有设备
   * @param loginId
   * @returns
   */
  _kickoutAllDevices(loginId: string): Promise<void>;
  /**
   * 被顶下线
   * @param loginId
   * @param token
   */
  _replacedToken(loginId: string, oldSessionValue: string, device?: string): Promise<void>;
  /**
   * 打开二级认证窗口
   * @param token  用户token
   * @param business  业务标识
   * @param timeout 有效期（秒）
   */
  openSafe(token: string, business: string, timeout: DurationInput): Promise<void>;
  /**
   * 检查二级认证是否有效
   * @param token 用户token
   * @param business 业务标识
   * @returns 是否有效
   */
  checkSafe(token: string, business: string): Promise<void>;
  /**
   * 主动关闭二级认证
   * @param token
   * @param business
   */
  closeSafe(token: string, business: string): Promise<void>;
  /**
   * 创建临时token
   * @param value  要关联的业务数据
   * @param timeout 有效期（秒）
   * @returns 临时token字符串
   */
  createTempToken(value: string, timeout: DurationInput): Promise<string>;
  /**
   * 解析临时token
   * @param tempToken  临时token字符串
   * @returns 要关联的业务数据
   */
  parseTempToken(tempToken: string): Promise<string | null>;
  /**
   * 销毁临时token
   * @param tempToken  临时token字符串
   */
  deleteTempToken(tempToken: string): Promise<void>;
  /**
   * 获取 token 值
   * @param req
   */
  getTokenValue(ctx: HttpContext): Promise<string | null>;
  /**
   * 是否登录
   * @param req
   */
  isLogin(ctx: HttpContext): Promise<boolean>;
  /**
   * 检查登录
   * @param ctx
   */
  checkLogin(ctx: HttpContext): Promise<AuthResult>;
  /**
   * 登出
   * @param token
   */
  logout(token: string): Promise<boolean | null>;
  /**
   * 根据登录id登出
   * @param loginId
   */
  logoutByLoginId(loginId: string): Promise<boolean | null>;
  /**
   * 踢人下线
   * @param loginId
   */
  kickout(loginId: string, device?: string): Promise<boolean | null>;
  /**
   * 刷新 token 过期时间
   * @param token
   * @param timeout
   */
  renewTimeout(token: string, timeout: DurationInput): Promise<boolean | null>;
  /**
   * 获取 session
   * @param loginId
   */
  getSession(loginId: string): XltSession;
  /**
   * 获取下线记录
   * @param token
   */
  getOfflineRecords(token: string): Promise<{
    reason: string;
    time: number;
  } | null>;
  /**
   * 查询某账号所有在线设备
   * @param loginId
   * @returns
   */
  getDeviceList(loginId: string): Promise<DeviceInfo[]>;
  /**
   * 踢掉指定设备
   */
  kickoutByDevice(loginId: string, device: string): Promise<boolean | null>;
  /**
   * 踢掉指定 token
   */
  kickoutByToken(token: string): Promise<boolean | null>;
  /**
   * 查询所有在线loginIds
   */
  getOnlineLoginIds(opts?: {
    page?: number;
    pageSize?: number;
  }): Promise<string[]>;
  /**
   * 在线用户数
   */
  getOnlineCount(): Promise<number>;
  /**
   * 强制某账号所有设备下线
   */
  forceLogout(loginId: string): Promise<boolean>;
  /**
   * 解析登录id
   * @param req
   * @private
   */
  private _resolveLoginId;
  private _resolveLoginIdJwt;
  /**
   * 处理被顶下线
   * @param loginId
   * @private
   */
  private replaced;
  private writeOfflineRecord;
  private _removeFromSessionList;
  /**
   * 是否为JWT模式
   * @returns 是否为JWT模式
   */
  private _isJwtMode;
  /** 钩子回调用完整 token（JWT 模式下 session 存的是 jti） */
  private _resolveHookToken;
  private callHook;
}
//#endregion
//#region src/auth/stp-perm-logic.d.ts
declare class StpPermLogic {
  private readonly stpInterface;
  private readonly tokenStore;
  private readonly tokenConfig;
  private readonly keys;
  constructor(stpInterface: StpInterface, tokenStore: XltTokenStore, tokenConfig: XltTokenConfig);
  private permCacheTimeoutSec;
  private getPermissionList;
  private getRoleList;
  hasPermission(loginId: string, permission: string): Promise<boolean>;
  checkPermission(loginId: string, permissions: string[], mode: XltMode): Promise<void>;
  hasRole(loginId: string, role: string): Promise<boolean>;
  checkRole(loginId: string, role: string[], mode: XltMode): Promise<void>;
}
//#endregion
//#region src/auth/stp-util.d.ts
declare function setStpLogic(stpLogic: StpLogic): void;
declare function setStpPermLogic(stpPermLogic: StpPermLogic): void;
declare class StpUtil {
  static login(loginId: string | number, options?: {
    timeout?: number;
    device?: string;
    token?: string;
  }): Promise<string>;
  static logout(token: string): Promise<boolean | null>;
  static logoutByLoginId(loginId: string): Promise<boolean | null>;
  static kickout(loginId: string, device?: string): Promise<boolean | null>;
  static kickoutByDevice(loginId: string, device: string): Promise<boolean | null>;
  static kickoutByToken(token: string): Promise<boolean | null>;
  static renewTimeout(token: string, timeout: number): Promise<boolean | null>;
  static isLogin(req: HttpContext | ExpressLikeRequest): Promise<boolean>;
  static checkLogin(req: HttpContext | ExpressLikeRequest): Promise<AuthResult>;
  static getLoginId(req: HttpContext | ExpressLikeRequest): Promise<string | null>;
  static getTokenValue(req: HttpContext | ExpressLikeRequest): Promise<string | null>;
  static openSafe(token: string, business: string, timeout: number): Promise<void>;
  static checkSafe(token: string, business: string): Promise<void>;
  static closeSafe(token: string, business: string): Promise<void>;
  static createTempToken(value: string, timeout: number): Promise<string>;
  static parseTempToken(tempToken: string): Promise<string | null>;
  static deleteTempToken(tempToken: string): Promise<void>;
  static getDeviceList(loginId: string): Promise<DeviceInfo[]>;
  static forceLogout(loginId: string): Promise<boolean>;
  static getOnlineLoginIds(opts?: {
    page?: number;
    pageSize?: number;
  }): Promise<string[]>;
  static getOnlineCount(): Promise<number>;
  static hasPermission(loginId: string, permission: string): Promise<boolean>;
  static checkPermission(loginId: string, permissions: string[], mode: XltMode): Promise<void>;
  static hasRole(loginId: string, role: string): Promise<boolean>;
  static checkRole(loginId: string, roles: string[], mode: XltMode): Promise<void>;
  static getSession(loginId: string): XltSession;
  static getOfflineReason(token: string): Promise<{
    reason: string;
    time: number;
  } | null>;
}
//#endregion
//#region src/factory.d.ts
interface CreateOptions {
  config?: Partial<XltTokenConfigInput>;
  store?: XltTokenStore;
  strategy?: TokenStrategy;
  stpInterface?: StpInterface;
  hooks?: XltHooks;
}
interface XltTokenContext {
  config: XltTokenConfig;
  store: XltTokenStore;
  strategy: TokenStrategy;
  stpLogic: StpLogic;
  stpPermLogic: StpPermLogic;
  stpUtil: typeof StpUtil;
}
declare function createXltToken(options?: CreateOptions): XltTokenContext;
//#endregion
//#region src/time/duration.d.ts
/**
 * 规范化时长选项
 */
interface NormalizeDurationOptions {
  field: string;
  allowZero?: boolean;
  allowNever?: boolean;
}
declare function normalizeDuration(value: DurationInput, options: NormalizeDurationOptions): number;
/**
 * 规范化 XltToken 配置
 */
declare function normalizeXltTokenConfig(input?: Partial<XltTokenConfigInput>): XltTokenConfig;
//#endregion
export { type AuthResult, type CookieOptions, type CreateOptions, DEFAULT_XLT_TOKEN_CONFIG, type DeviceInfo, type DurationInput, type DurationString, type DurationUnit, type ExpressLikeRequest, type ExpressLikeResponse, type HttpContext, type HttpCookies, type HttpHeaders, type HttpQuery, type JwtConfig, MemoryStore, type MockHttpContextOptions, NormalizeDurationOptions, NotLoginException, NotLoginType, NotPermissionException, NotRoleException, NotSafeException, type StpInterface, StpLogic, StpPermLogic, StpUtil, type TokenStrategy, UuidStrategy, XLT_CHECK_LOGIN_KEY, XLT_IGNORE_KEY, XLT_PERMISSION_KEY, XLT_ROLE_KEY, XLT_STP_INTERFACE, XLT_TOKEN_CONFIG, XLT_TOKEN_HOOKS, XLT_TOKEN_STORE, XLT_TOKEN_STRATEGY, XltError, type XltHooks, XltMode, XltSession, type XltTokenConfig, type XltTokenConfigInput, type XltTokenContext, XltTokenKeys, type XltTokenStore, createExpressContext, createMockHttpContext, createXltToken, matchPermission, normalizeDuration, normalizeXltTokenConfig, setStpLogic, setStpPermLogic };
//# sourceMappingURL=index.d.mts.map