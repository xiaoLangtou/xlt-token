import { randomBytes, randomUUID } from "node:crypto";
import { isNull, isUndefined } from "es-toolkit";
import ms from "ms";

//#region src/const/index.ts
/**
* 登录状态
*/
const NotLoginType = {
	NOT_TOKEN: "NOT_TOKEN",
	INVALID_TOKEN: "INVALID_TOKEN",
	TOKEN_TIMEOUT: "TOKEN_TIMEOUT",
	TOKEN_FREEZE: "TOKEN_FREEZE",
	BE_REPLACED: "BE_REPLACED",
	KICK_OUT: "KICK_OUT"
};
const XLT_IGNORE_KEY = "XltIgnore";
const XLT_CHECK_LOGIN_KEY = "XltCheckLogin";
/**
* 权限检查模式
*/
const XltMode = {
	AND: "AND",
	OR: "OR"
};
const XLT_PERMISSION_KEY = "XltCheckPermission";
const XLT_ROLE_KEY = "xltCheckRole";

//#endregion
//#region src/config/xlt-token-config.ts
const DEFAULT_XLT_TOKEN_CONFIG = {
	tokenName: "authorization",
	timeout: 2592e3,
	activeTimeout: -1,
	isConcurrent: true,
	isShare: true,
	tokenStyle: "uuid",
	isReadHeader: true,
	isReadCookie: false,
	isReadQuery: false,
	tokenPrefix: "Bearer ",
	defaultCheck: true,
	permCacheTimeout: 0,
	offlineRecordEnabled: false,
	offlineRecordTimeout: 3600,
	deviceConcurrent: true
};
const XLT_TOKEN_CONFIG = "XLT_TOKEN_CONFIG";
const XLT_TOKEN_STORE = "XLT_TOKEN_STORE";
const XLT_TOKEN_STRATEGY = "XLT_TOKEN_STRATEGY";

//#endregion
//#region src/config/xlt-token-keys.ts
var XltTokenKeys = class {
	constructor(tokenName) {
		this.tokenName = tokenName;
	}
	/**
	* 生成token key
	* @param token
	* @
	*/
	tokenKey(token) {
		return `${this.tokenName}:login:token:${token}`;
	}
	/**
	* 生成session key
	* @param loginId
	* @
	*/
	sessionKey(loginId, device = "default") {
		return `${this.tokenName}:login:session:${loginId}:${device}`;
	}
	sessionListKey(loginId) {
		return `${this.tokenName}:login:session-list:${loginId}`;
	}
	jwtBlacklistKey(jti) {
		return `${this.tokenName}:jwt-blacklist:${jti}`;
	}
	/**
	* 生成sessionData key
	* @param loginId
	* @
	*/
	sessionDataKey(loginId) {
		return `${this.tokenName}:login:session-data:${loginId}`;
	}
	offlineRecordKey(token) {
		return `${this.tokenName}:login:offline:${token}`;
	}
	/**
	* 生成lastActive
	* @param token
	* @
	*/
	lastActiveKey(token) {
		return `${this.tokenName}:login:lastActive:${token}`;
	}
	/**
	* 生成二级认证key
	* @param token  用户token
	* @param business 业务标识
	* @returns 二级认证key
	*/
	safeKey(token, business) {
		return `${this.tokenName}:safe:${token}:${business}`;
	}
	/**
	* 生成临时token key
	* @param tempToken  临时token字符串
	* @returns 临时token key
	*/
	tempTokenKey(tempToken) {
		return `${this.tokenName}:temp-token:${tempToken}`;
	}
	permCacheKey(loginId) {
		return `${this.tokenName}:perm-cache:perm:${loginId}`;
	}
	roleCacheKey(loginId) {
		return `${this.tokenName}:perm-cache:role:${loginId}`;
	}
};

//#endregion
//#region src/store/memory-store.ts
var MemoryStore = class MemoryStore {
	constructor() {
		this.store = /* @__PURE__ */ new Map();
	}
	static {
		this.MAX_TIMER_DELAY_MS = 2 ** 31 - 1;
	}
	async get(key) {
		const entry = this.peek(key);
		return entry ? entry.value : null;
	}
	async set(key, value, timeoutSec) {
		this.clearTimer(key);
		const entry = {
			value,
			expireAt: timeoutSec === -1 ? -1 : Date.now() + timeoutSec * 1e3,
			timer: null
		};
		this.scheduleExpire(key, entry, timeoutSec);
		this.store.set(key, entry);
	}
	async delete(key) {
		this.clearTimer(key);
		this.store.delete(key);
	}
	async has(key) {
		return this.peek(key) !== null;
	}
	async update(key, value) {
		const entry = this.peek(key);
		if (!entry) throw new Error(`key not found: ${key}`);
		entry.value = value;
	}
	async updateTimeout(key, timeoutSec) {
		const entry = this.peek(key);
		if (!entry) throw new Error(`key not found: ${key}`);
		this.clearTimer(key);
		entry.expireAt = timeoutSec === -1 ? -1 : Date.now() + timeoutSec * 1e3;
		this.scheduleExpire(key, entry, timeoutSec);
	}
	async getTimeout(key) {
		const entry = this.peek(key);
		if (!entry) return -2;
		if (entry.expireAt === -1) return -1;
		const remainMs = entry.expireAt - Date.now();
		return remainMs <= 0 ? -2 : Math.floor(remainMs / 1e3);
	}
	async keys(pattern) {
		const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
		const result = [];
		for (const [key] of this.store) if (key.startsWith(prefix) && this.peek(key)) result.push(key);
		return result;
	}
	peek(key) {
		const entry = this.store.get(key);
		if (!entry) return null;
		if (entry.expireAt !== -1 && entry.expireAt <= Date.now()) {
			this.clearTimer(key);
			this.store.delete(key);
			return null;
		}
		return entry;
	}
	clearTimer(key) {
		const entry = this.store.get(key);
		if (entry?.timer) {
			clearTimeout(entry.timer);
			entry.timer = null;
		}
	}
	scheduleExpire(key, entry, timeoutSec) {
		if (timeoutSec === -1) return;
		const delayMs = timeoutSec * 1e3;
		if (delayMs > MemoryStore.MAX_TIMER_DELAY_MS) return;
		entry.timer = setTimeout(() => {
			this.store.delete(key);
		}, delayMs);
		entry.timer.unref?.();
	}
};

//#endregion
//#region src/token/uuid-strategy.ts
var UuidStrategy = class {
	generateToken(_payload) {
		return randomUUID();
	}
	verifyToken(token) {
		return token;
	}
	createToken(_loginId, config, _options) {
		return this.buildRaw(config.tokenStyle);
	}
	buildRaw(style) {
		switch (style) {
			case "uuid": return randomUUID();
			case "simple-uuid": return randomUUID().replace(/-/g, "");
			default: return randomBytes(16).toString("hex");
		}
	}
};

//#endregion
//#region src/hooks/xlt-hooks.interface.ts
/**
* 钩子注入 token
*/
const XLT_TOKEN_HOOKS = "XLT_TOKEN_HOOKS";

//#endregion
//#region src/perm/stp-interface.ts
const XLT_STP_INTERFACE = "XLT_STP_INTERFACE";

//#endregion
//#region src/perm/perm-pattern-match.ts
/**
* 通配符匹配，支持*通配符
* @param pattern 匹配模式
* @param target 目标字符串
*/
function matchPermission(pattern, target) {
	if (pattern === "*") return true;
	if (pattern === target) return true;
	const patternSegments = pattern.split(":");
	const targetSegments = target.split(":");
	for (let i = 0; i < patternSegments.length; i++) {
		if (patternSegments[i] === "*") return true;
		if (patternSegments[i] !== targetSegments[i]) return false;
	}
	return patternSegments.length === targetSegments.length;
}

//#endregion
//#region src/http/express.ts
function createExpressContext(req, res) {
	req._xltState ??= {};
	return {
		headers: { get: (n) => req.headers[n.toLowerCase()] ?? null },
		cookies: { get: (n) => req.cookies?.[n] ?? null },
		query: { get: (n) => req.query?.[n] ?? null },
		state: req._xltState,
		setHeader: (n, v) => {
			res.setHeader(n, v);
		},
		setCookie: (n, v, o) => {
			res.cookie(n, v, o);
		},
		raw: () => req
	};
}

//#endregion
//#region src/http/testing.ts
function createMockHttpContext(options = {}) {
	return {
		headers: { get(name) {
			const value = options.headers?.[name.toLowerCase()];
			if (value == null) return null;
			return Array.isArray(value) ? value[0] ?? null : value;
		} },
		cookies: { get(name) {
			return options.cookies?.[name] ?? null;
		} },
		query: { get(name) {
			return options.query?.[name] ?? null;
		} },
		state: options.state ?? {},
		setHeader() {},
		setCookie() {},
		raw: () => options
	};
}

//#endregion
//#region src/exceptions/xlt-error.ts
var XltError = class extends Error {
	constructor(message, code, status) {
		super(message);
		this.name = new.target.name;
		this.code = code;
		this.status = status;
	}
};

//#endregion
//#region src/exceptions/not-login.exception.ts
var NotLoginException = class NotLoginException extends XltError {
	constructor(type, token) {
		super(NotLoginException.describeType(type), "NOT_LOGIN", 401);
		this.status = 401;
		this.type = type;
		this.token = token;
	}
	static describeType(type) {
		return {
			[NotLoginType.NOT_TOKEN]: "未提供 Token",
			[NotLoginType.INVALID_TOKEN]: "Token 无效",
			[NotLoginType.TOKEN_TIMEOUT]: "Token 已过期",
			[NotLoginType.TOKEN_FREEZE]: "Token 已被冻结",
			[NotLoginType.BE_REPLACED]: "已被顶下线",
			[NotLoginType.KICK_OUT]: "已被踢下线"
		}[type] ?? "未登录";
	}
};

//#endregion
//#region src/exceptions/not-permission.exception.ts
var NotPermissionException = class extends XltError {
	constructor(permission, mode) {
		super(`缺少权限: ${Array.isArray(permission) ? permission.join(", ") : permission}`, "NOT_PERMISSION", 403);
		this.status = 403;
		this.permission = permission;
		this.mode = mode;
	}
};

//#endregion
//#region src/exceptions/not-role.exception.ts
var NotRoleException = class extends XltError {
	constructor(role, mode) {
		super(`缺少角色: ${Array.isArray(role) ? role.join(", ") : role}`, "NOT_ROLE", 403);
		this.status = 403;
		this.role = role;
		this.mode = mode;
	}
};

//#endregion
//#region src/exceptions/not-safe.exception.ts
var NotSafeException = class extends XltError {
	constructor(business) {
		super(`二级认证未开启：${business}`, "NOT_SAFE", 403);
		this.status = 403;
		this.business = business;
	}
};

//#endregion
//#region src/session/xlt-session.ts
var XltSession = class {
	constructor(loginId, store, storeKey, timeout) {
		this.loginId = loginId;
		this.store = store;
		this.storeKey = storeKey;
		this.timeout = timeout;
		this.data = null;
	}
	/**
	* 获取会话数据
	* @returns The session data.
	*/
	async get(key) {
		const data = await this.load();
		return data ? data[key] ?? null : null;
	}
	/**
	* 设置会话数据
	* @param key The key of the session data.
	* @param value The value of the session data.
	*/
	async set(key, value) {
		const data = await this.load();
		if (data) data[key] = value;
		this.data = data;
		await this.save();
	}
	/**
	* 判断会话数据是否存在
	* @param key The key of the session data.
	* @returns A boolean indicating whether the session data exists.
	*/
	async has(key) {
		const data = await this.load();
		return data ? key in data : false;
	}
	/**
	* 删除会话数据
	* @param key The key of the session data.
	*/
	async remove(key) {
		const data = await this.load();
		if (data) delete data[key];
		this.data = data;
		await this.save();
	}
	/**
	* 清空会话数据
	*/
	async clear() {
		this.data = null;
		await this.store.delete(this.storeKey);
	}
	async keys() {
		const data = await this.load();
		return data ? Object.keys(data) : [];
	}
	/**
	* 加载会话数据
	* @returns The session data.
	*/
	async load() {
		if (this.data !== null) return this.data;
		const raw = await this.store.get(this.storeKey);
		this.data = raw ? JSON.parse(raw) : {};
		return this.data;
	}
	/**
	* 保存会话数据
	*/
	async save() {
		await this.store.set(this.storeKey, JSON.stringify(this.data), this.timeout);
	}
};

//#endregion
//#region src/time/duration.ts
const DURATION_PATTERN = /^\d+(?:\.\d+)?[smhdw]$/;
function normalizeDuration(value, options) {
	const invalid = () => {
		throw new TypeError(`Invalid duration for "${options.field}": expected integer seconds or a duration such as "30m", received ${JSON.stringify(value)}`);
	};
	if (typeof value === "number") {
		if (!Number.isFinite(value) || !Number.isInteger(value)) invalid();
		if (value === 0) return options.allowZero ? 0 : invalid();
		if (value === -1) return options.allowNever ? -1 : invalid();
		if (value < 0) invalid();
		return value;
	}
	if (!DURATION_PATTERN.test(value)) invalid();
	const seconds = ms(value) / 1e3;
	if (!Number.isFinite(seconds) || !Number.isInteger(seconds) || seconds <= 0) invalid();
	return seconds;
}
/**
* 规范化 XltToken 配置
*/
function normalizeXltTokenConfig(input) {
	const config = {
		...DEFAULT_XLT_TOKEN_CONFIG,
		...input,
		timeout: input?.timeout ?? DEFAULT_XLT_TOKEN_CONFIG.timeout,
		activeTimeout: input?.activeTimeout ?? DEFAULT_XLT_TOKEN_CONFIG.activeTimeout,
		permCacheTimeout: input?.permCacheTimeout ?? DEFAULT_XLT_TOKEN_CONFIG.permCacheTimeout,
		offlineRecordTimeout: input?.offlineRecordTimeout ?? DEFAULT_XLT_TOKEN_CONFIG.offlineRecordTimeout
	};
	return {
		...config,
		timeout: normalizeDuration(config.timeout, {
			field: "timeout",
			allowZero: true,
			allowNever: true
		}),
		activeTimeout: normalizeDuration(config.activeTimeout, {
			field: "activeTimeout",
			allowZero: true,
			allowNever: true
		}),
		permCacheTimeout: normalizeDuration(config.permCacheTimeout, {
			field: "permCacheTimeout",
			allowZero: true,
			allowNever: true
		}),
		offlineRecordTimeout: normalizeDuration(config.offlineRecordTimeout, {
			field: "offlineRecordTimeout",
			allowZero: true,
			allowNever: true
		})
	};
}

//#endregion
//#region src/auth/stp-logic.ts
var StpLogic = class {
	constructor(config, store, strategy, hooks = {}) {
		this.config = config;
		this.store = store;
		this.strategy = strategy;
		this.hooks = hooks;
		this.keys = new XltTokenKeys(this.config.tokenName);
	}
	/**
	* 登录
	* @param loginId
	* @param options
	*/
	async login(loginId, options = {}) {
		if (isNull(loginId) || isUndefined(loginId) || loginId === "") throw new Error("invalid loginId");
		const _loginId = String(loginId);
		if (_loginId.includes(":")) throw new Error("invalid loginId");
		const device = options.device ?? "default";
		const timeout = normalizeDuration(options.timeout ?? this.config.timeout, {
			field: "timeout",
			allowZero: true,
			allowNever: true
		});
		const sessionKey = this.keys.sessionKey(_loginId, device);
		const oldToken = await this.store.get(sessionKey);
		let replacedOldFullToken;
		let token;
		if (!this.config.deviceConcurrent) {
			await this._kickoutAllDevices(_loginId);
			token = options.token ?? this.strategy.createToken(_loginId, this.config, { timeout });
		} else if (!this.config.isConcurrent) {
			if (oldToken) {
				replacedOldFullToken = await this._resolveHookToken(_loginId, device, oldToken);
				await this._replacedToken(_loginId, oldToken, device);
			}
			token = options.token ?? this.strategy.createToken(_loginId, this.config, { timeout });
		} else if (this.config.isShare && oldToken) if (this._isJwtMode()) token = (await this.getDeviceList(_loginId)).find((d) => d.device === device)?.token ?? options.token ?? this.strategy.createToken(_loginId, this.config, { timeout });
		else token = oldToken;
		else token = options.token ?? this.strategy.createToken(_loginId, this.config, { timeout });
		if (this._isJwtMode()) {
			const { jti } = this.strategy.verifyToken(token);
			await this.store.set(sessionKey, jti, timeout);
			if (this.config.activeTimeout > 0) await this.store.set(this.keys.lastActiveKey(jti), String(Date.now()), timeout);
		} else {
			await this.store.set(this.keys.tokenKey(token), _loginId, timeout);
			await this.store.set(sessionKey, token, timeout);
			if (this.config.activeTimeout > 0) await this.store.set(this.keys.lastActiveKey(token), String(Date.now()), timeout);
		}
		await this._addToSessionList(_loginId, {
			device,
			token,
			loginTime: Date.now()
		}, timeout);
		this.callHook("onLogin", _loginId, token, device);
		if (replacedOldFullToken) this.callHook("onReplaced", _loginId, replacedOldFullToken, token);
		return token;
	}
	/**
	* 添加到 session-list
	* @param loginId
	* @param info
	* @param timeout
	*/
	async _addToSessionList(loginId, info, timeout) {
		const key = this.keys.sessionListKey(loginId);
		const raw = await this.store.get(key);
		const list = raw ? JSON.parse(raw) : [];
		const idx = list.findIndex((d) => d.device === info.device);
		if (idx >= 0) list.splice(idx, 1);
		list.push(info);
		await this.store.set(key, JSON.stringify(list), normalizeDuration(timeout, {
			field: "timeout",
			allowZero: true,
			allowNever: true
		}));
	}
	/**
	* 踢掉所有设备
	* @param loginId
	* @returns
	*/
	async _kickoutAllDevices(loginId) {
		const key = this.keys.sessionListKey(loginId);
		const raw = await this.store.get(key);
		if (!raw) return;
		const list = JSON.parse(raw);
		for (const deviceInfo of list) if (this._isJwtMode()) {
			const { jti } = this.strategy.verifyToken(deviceInfo.token);
			await this.store.set(this.keys.jwtBlacklistKey(jti), NotLoginType.KICK_OUT, this.config.timeout);
		} else await this.store.update(this.keys.tokenKey(deviceInfo.token), NotLoginType.KICK_OUT);
	}
	/**
	* 被顶下线
	* @param loginId
	* @param token
	*/
	async _replacedToken(loginId, oldSessionValue, device = "default") {
		if (this._isJwtMode()) await this.store.set(this.keys.jwtBlacklistKey(oldSessionValue), NotLoginType.BE_REPLACED, this.config.timeout);
		else await this.store.update(this.keys.tokenKey(oldSessionValue), NotLoginType.BE_REPLACED);
		await this.store.delete(this.keys.sessionKey(loginId, device));
		this.writeOfflineRecord(oldSessionValue, NotLoginType.BE_REPLACED);
	}
	/**
	* 打开二级认证窗口
	* @param token  用户token
	* @param business  业务标识
	* @param timeout 有效期（秒）
	*/
	async openSafe(token, business, timeout) {
		const safeKey = this.keys.safeKey(token, business);
		await this.store.set(safeKey, String(Date.now()), normalizeDuration(timeout, { field: "timeout" }));
	}
	/**
	* 检查二级认证是否有效
	* @param token 用户token
	* @param business 业务标识
	* @returns 是否有效
	*/
	async checkSafe(token, business) {
		if (!await this.store.has(this.keys.safeKey(token, business))) throw new NotSafeException(business);
	}
	/**
	* 主动关闭二级认证
	* @param token
	* @param business
	*/
	async closeSafe(token, business) {
		await this.store.delete(this.keys.safeKey(token, business));
	}
	/**
	* 创建临时token
	* @param value  要关联的业务数据
	* @param timeout 有效期（秒）
	* @returns 临时token字符串
	*/
	async createTempToken(value, timeout) {
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
	async parseTempToken(tempToken) {
		return this.store.get(this.keys.tempTokenKey(tempToken));
	}
	/**
	* 销毁临时token
	* @param tempToken  临时token字符串
	*/
	async deleteTempToken(tempToken) {
		await this.store.delete(this.keys.tempTokenKey(tempToken));
	}
	/**
	* 获取 token 值
	* @param req
	*/
	async getTokenValue(ctx) {
		if (this.config.isReadHeader) {
			const raw = ctx.headers.get(this.config.tokenName.toLowerCase());
			if (raw) {
				let value = raw;
				if (this.config.tokenPrefix && value.startsWith(this.config.tokenPrefix)) value = value.slice(this.config.tokenPrefix.length);
				return value.trim();
			}
		}
		if (this.config.isReadCookie) {
			const cookie = ctx.cookies.get(this.config.tokenName);
			if (cookie) return cookie;
		}
		if (this.config.isReadQuery) return ctx.query.get(this.config.tokenName);
		return null;
	}
	/**
	* 是否登录
	* @param req
	*/
	async isLogin(ctx) {
		return (await this._resolveLoginId(ctx)).ok;
	}
	/**
	* 检查登录
	* @param ctx
	*/
	async checkLogin(ctx) {
		const result = await this._resolveLoginId(ctx);
		if (!result.ok) throw new NotLoginException(result.reason ?? NotLoginType.NOT_TOKEN, result.token);
		return {
			ok: result.ok,
			loginId: result.loginId,
			token: result.token
		};
	}
	/**
	* 登出
	* @param token
	*/
	async logout(token) {
		if (!token) return null;
		const loginId = await this.store.get(this.keys.tokenKey(token));
		if (!loginId) return null;
		await this.store.delete(this.keys.tokenKey(token));
		await this.store.delete(this.keys.lastActiveKey(token));
		await this.store.delete(this.keys.sessionKey(loginId));
		await this.store.delete(this.keys.sessionDataKey(loginId));
		const info = (await this.getDeviceList(loginId)).find((d) => d.token === token);
		if (info) await this._removeFromSessionList(loginId, info.device);
		this.callHook("onLogout", loginId, token, "LOGOUT");
		return true;
	}
	/**
	* 根据登录id登出
	* @param loginId
	*/
	async logoutByLoginId(loginId) {
		if (!loginId) return null;
		const token = await this.store.get(this.keys.sessionKey(loginId));
		if (!token) return null;
		await this.store.delete(this.keys.sessionKey(loginId));
		await this.store.delete(this.keys.tokenKey(token));
		await this.store.delete(this.keys.lastActiveKey(token));
		await this.store.delete(this.keys.sessionDataKey(loginId));
		this.callHook("onLogout", loginId, token, "LOGOUT_BY_LOGIN_ID");
		return true;
	}
	/**
	* 踢人下线
	* @param loginId
	*/
	async kickout(loginId, device = "default") {
		if (!loginId) return null;
		const sessionKey = this.keys.sessionKey(loginId, device);
		const sessionValue = await this.store.get(sessionKey);
		if (!sessionValue) return null;
		const fullToken = (await this.getDeviceList(loginId)).find((d) => d.device === device)?.token ?? sessionValue;
		if (this._isJwtMode()) await this.store.set(this.keys.jwtBlacklistKey(sessionValue), NotLoginType.KICK_OUT, this.config.timeout);
		else await this.store.update(this.keys.tokenKey(sessionValue), NotLoginType.KICK_OUT);
		await this.store.delete(sessionKey);
		await this.store.delete(this.keys.sessionDataKey(loginId));
		this.writeOfflineRecord(fullToken, NotLoginType.KICK_OUT);
		this.callHook("onKickout", loginId, fullToken);
		return true;
	}
	/**
	* 刷新 token 过期时间
	* @param token
	* @param timeout
	*/
	async renewTimeout(token, timeout) {
		if (!token) return null;
		const loginId = await this.store.get(this.keys.tokenKey(token));
		if (!loginId) return null;
		await this.store.updateTimeout(this.keys.tokenKey(token), normalizeDuration(timeout, {
			field: "timeout",
			allowZero: true,
			allowNever: true
		}));
		await this.store.updateTimeout(this.keys.sessionKey(loginId), normalizeDuration(timeout, {
			field: "timeout",
			allowZero: true,
			allowNever: true
		}));
		if (this.config.activeTimeout > 0) await this.store.updateTimeout(this.keys.lastActiveKey(token), normalizeDuration(timeout, {
			field: "activeTimeout",
			allowZero: true,
			allowNever: true
		}));
		return true;
	}
	/**
	* 获取 session
	* @param loginId
	*/
	getSession(loginId) {
		const key = this.keys.sessionDataKey(loginId);
		return new XltSession(loginId, this.store, key, this.config.timeout);
	}
	/**
	* 获取下线记录
	* @param token
	*/
	async getOfflineRecords(token) {
		if (!token) return null;
		if (!this.config.offlineRecordEnabled) return null;
		const key = this.keys.offlineRecordKey(token);
		const raw = await this.store.get(key);
		return raw ? JSON.parse(raw) : null;
	}
	/**
	* 查询某账号所有在线设备
	* @param loginId
	* @returns
	*/
	async getDeviceList(loginId) {
		const sessionListKey = this.keys.sessionListKey(loginId);
		const raw = await this.store.get(sessionListKey);
		return raw ? JSON.parse(raw) : [];
	}
	/**
	* 踢掉指定设备
	*/
	async kickoutByDevice(loginId, device) {
		const sessionValue = await this.store.get(this.keys.sessionKey(loginId, device));
		if (!sessionValue) return null;
		const fullToken = (await this.getDeviceList(loginId)).find((d) => d.device === device)?.token ?? sessionValue;
		if (this._isJwtMode()) await this.store.set(this.keys.jwtBlacklistKey(sessionValue), NotLoginType.KICK_OUT, this.config.timeout);
		else await this.store.update(this.keys.tokenKey(sessionValue), NotLoginType.KICK_OUT);
		await this.store.delete(this.keys.sessionKey(loginId, device));
		await this._removeFromSessionList(loginId, device);
		this.writeOfflineRecord(fullToken, NotLoginType.KICK_OUT);
		this.callHook("onKickout", loginId, fullToken);
		return true;
	}
	/**
	* 踢掉指定 token
	*/
	async kickoutByToken(token) {
		if (this._isJwtMode()) {
			let loginId;
			let jti;
			try {
				const payload = this.strategy.verifyToken(token);
				loginId = payload.sub;
				jti = payload.jti;
				if (!loginId || !jti) return null;
			} catch {
				return null;
			}
			await this.store.set(this.keys.jwtBlacklistKey(jti), NotLoginType.KICK_OUT, this.config.timeout);
			const info = (await this.getDeviceList(loginId)).find((d) => d.token === token);
			if (info) {
				await this.store.delete(this.keys.sessionKey(loginId, info.device));
				await this._removeFromSessionList(loginId, info.device);
			}
			this.writeOfflineRecord(token, NotLoginType.KICK_OUT);
			this.callHook("onKickout", loginId, token);
			return true;
		}
		const loginId = await this.store.get(this.keys.tokenKey(token));
		if (!loginId || [NotLoginType.KICK_OUT, NotLoginType.BE_REPLACED].includes(loginId)) return null;
		await this.store.update(this.keys.tokenKey(token), NotLoginType.KICK_OUT);
		const info = (await this.getDeviceList(loginId)).find((d) => d.token === token);
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
	async getOnlineLoginIds(opts = {}) {
		const { page = 0, pageSize = 100 } = opts;
		const pattern = `${this.config.tokenName}:login:session-list:*`;
		const keys = await this.store.keys(pattern);
		const prefix = `${this.config.tokenName}:login:session-list:`;
		const start = page * pageSize;
		return keys.slice(start, start + pageSize).map((k) => k.slice(prefix.length));
	}
	/**
	* 在线用户数
	*/
	async getOnlineCount() {
		const pattern = `${this.config.tokenName}:login:session-list:*`;
		return (await this.store.keys(pattern)).length;
	}
	/**
	* 强制某账号所有设备下线
	*/
	async forceLogout(loginId) {
		const list = await this.getDeviceList(loginId);
		for (const { device } of list) await this.kickoutByDevice(loginId, device);
		return true;
	}
	/**
	* 解析登录id
	* @param req
	* @private
	*/
	async _resolveLoginId(ctx) {
		const token = await this.getTokenValue(ctx);
		if (!token) return {
			ok: false,
			reason: NotLoginType.NOT_TOKEN
		};
		if (this._isJwtMode()) return this._resolveLoginIdJwt(token);
		const loginId = await this.store.get(this.keys.tokenKey(token));
		if (!loginId) return {
			ok: false,
			reason: NotLoginType.INVALID_TOKEN,
			token
		};
		if (loginId === NotLoginType.BE_REPLACED) return {
			ok: false,
			reason: NotLoginType.BE_REPLACED,
			token
		};
		if (loginId === NotLoginType.KICK_OUT) return {
			ok: false,
			reason: NotLoginType.KICK_OUT,
			token
		};
		if (this.config.activeTimeout > 0) {
			const lastStr = await this.store.get(this.keys.lastActiveKey(token));
			if (!lastStr) return {
				ok: false,
				reason: NotLoginType.TOKEN_FREEZE,
				token
			};
			if ((Date.now() - Number(lastStr)) / 1e3 > this.config.activeTimeout) return {
				ok: false,
				reason: NotLoginType.TOKEN_TIMEOUT,
				token
			};
			await this.store.update(this.keys.lastActiveKey(token), String(Date.now()));
		}
		ctx.state.stpLoginId = loginId;
		ctx.state.stpToken = token;
		return {
			ok: true,
			loginId,
			token
		};
	}
	async _resolveLoginIdJwt(token) {
		try {
			const { sub: loginId, jti } = this.strategy.verifyToken(token);
			if (!loginId || !jti) return {
				ok: false,
				reason: NotLoginType.INVALID_TOKEN,
				token
			};
			const jwtBlacklistKey = this.keys.jwtBlacklistKey(jti);
			const blacklisted = await this.store.get(jwtBlacklistKey);
			if (blacklisted === NotLoginType.KICK_OUT) return {
				ok: false,
				reason: NotLoginType.KICK_OUT,
				token
			};
			if (blacklisted === NotLoginType.BE_REPLACED) return {
				ok: false,
				reason: NotLoginType.BE_REPLACED,
				token
			};
			if (this.config.activeTimeout > 0) {
				const lastActiveKey = this.keys.lastActiveKey(jti);
				const lastStr = await this.store.get(lastActiveKey);
				if (!lastStr) return {
					ok: false,
					reason: NotLoginType.TOKEN_FREEZE,
					token
				};
				if ((Date.now() - Number(lastStr)) / 1e3 > this.config.activeTimeout) return {
					ok: false,
					reason: NotLoginType.TOKEN_TIMEOUT,
					token
				};
				await this.store.update(lastActiveKey, String(Date.now()));
			}
			return {
				ok: true,
				loginId,
				token
			};
		} catch (error) {
			return {
				ok: false,
				reason: NotLoginType.INVALID_TOKEN,
				token
			};
		}
	}
	/**
	* 处理被顶下线
	* @param loginId
	* @private
	*/
	async replaced(loginId, device = "default") {
		const sessionKey = this.keys.sessionKey(loginId, device);
		const oldToken = await this.store.get(sessionKey);
		if (oldToken) {
			if (this._isJwtMode()) {
				const jti = await this.store.get(sessionKey);
				if (jti) await this.store.set(this.keys.jwtBlacklistKey(jti), NotLoginType.BE_REPLACED, this.config.timeout);
			} else await this.store.update(this.keys.tokenKey(oldToken), NotLoginType.BE_REPLACED);
			await this.store.delete(sessionKey);
			this.writeOfflineRecord(oldToken, NotLoginType.BE_REPLACED);
		}
	}
	async writeOfflineRecord(token, reason) {
		if (!this.config.offlineRecordEnabled) return;
		const key = this.keys.offlineRecordKey(token);
		const record = JSON.stringify({
			token,
			reason,
			time: Date.now()
		});
		await this.store.set(key, record, this.config.offlineRecordTimeout ?? 3600);
	}
	async _removeFromSessionList(loginId, device) {
		const key = this.keys.sessionListKey(loginId);
		const raw = await this.store.get(key);
		if (!raw) return;
		const filtered = JSON.parse(raw).filter((d) => d.device !== device);
		if (filtered.length === 0) await this.store.delete(key);
		else await this.store.set(key, JSON.stringify(filtered), -1);
	}
	/**
	* 是否为JWT模式
	* @returns 是否为JWT模式
	*/
	_isJwtMode() {
		return !!(this.config.jwt?.secret && typeof this.strategy.verifyToken === "function");
	}
	/** 钩子回调用完整 token（JWT 模式下 session 存的是 jti） */
	async _resolveHookToken(loginId, device, sessionValue) {
		if (!this._isJwtMode()) return sessionValue;
		return (await this.getDeviceList(loginId)).find((d) => d.device === device)?.token ?? sessionValue;
	}
	callHook(event, ...args) {
		if (!this.hooks?.[event]) return;
		try {
			const result = this.hooks[event](...args);
			if (result instanceof Promise) result.catch((err) => console.error(`[xlt-token] hook ${event} error:`, err));
		} catch (err) {
			console.error(`[xlt-token] hook ${event} error:`, err);
		}
	}
};

//#endregion
//#region src/auth/stp-perm-logic.ts
var StpPermLogic = class {
	constructor(stpInterface, tokenStore, tokenConfig) {
		this.stpInterface = stpInterface;
		this.tokenStore = tokenStore;
		this.tokenConfig = tokenConfig;
		this.keys = new XltTokenKeys(this.tokenConfig.tokenName);
	}
	permCacheTimeoutSec() {
		return this.tokenConfig.permCacheTimeout ?? 0;
	}
	async getPermissionList(loginId) {
		const timeout = this.permCacheTimeoutSec();
		if (timeout === 0) return this.stpInterface.getPermissionList(loginId);
		const key = this.keys.permCacheKey(loginId);
		const cached = await this.tokenStore.get(key);
		if (cached !== null) return JSON.parse(cached);
		const list = await this.stpInterface.getPermissionList(loginId);
		await this.tokenStore.set(key, JSON.stringify(list), timeout);
		return list;
	}
	async getRoleList(loginId) {
		const timeout = this.permCacheTimeoutSec();
		if (timeout === 0) return this.stpInterface.getRoleList(loginId);
		const key = this.keys.roleCacheKey(loginId);
		const cached = await this.tokenStore.get(key);
		if (cached !== null) return JSON.parse(cached);
		const list = await this.stpInterface.getRoleList(loginId);
		await this.tokenStore.set(key, JSON.stringify(list), timeout);
		return list;
	}
	async hasPermission(loginId, permission) {
		if (!loginId || !permission) return false;
		const permissionList = await this.getPermissionList(loginId);
		if (!permissionList || permissionList.length <= 0) return false;
		return permissionList.some((p) => matchPermission(p, permission));
	}
	async checkPermission(loginId, permissions, mode) {
		if (!loginId || !permissions) throw new NotPermissionException(permissions, mode);
		if (mode === XltMode.AND) {
			if (!(await Promise.all(permissions.map(async (p) => await this.hasPermission(loginId, p)))).every((p) => p)) throw new NotPermissionException(permissions, mode);
		} else if (!(await Promise.all(permissions.map(async (p) => await this.hasPermission(loginId, p)))).some((p) => p)) throw new NotPermissionException(permissions, mode);
	}
	async hasRole(loginId, role) {
		if (!loginId || !role) return false;
		const roles = await this.getRoleList(loginId);
		if (!roles || roles.length <= 0) return false;
		return roles.includes(role);
	}
	async checkRole(loginId, role, mode) {
		if (!loginId || !role) throw new NotRoleException(role, mode);
		if (mode === XltMode.AND) {
			if (!(await Promise.all(role.map(async (r) => await this.hasRole(loginId, r)))).every((r) => r)) throw new NotRoleException(role, mode);
		} else if (!(await Promise.all(role.map(async (r) => await this.hasRole(loginId, r)))).some((r) => r)) throw new NotRoleException(role, mode);
	}
};

//#endregion
//#region src/auth/stp-util.ts
const noopResponse = {
	setHeader: () => {},
	cookie: () => {}
};
function toHttpContext(req) {
	if (typeof req.headers?.get === "function") return req;
	return createExpressContext(req, noopResponse);
}
let _stpLogic = null;
let _stpPermLogic = null;
function setStpLogic(stpLogic) {
	_stpLogic = stpLogic;
}
function setStpPermLogic(stpPermLogic) {
	_stpPermLogic = stpPermLogic;
}
function getStpLogic() {
	if (!_stpLogic) throw new Error("StpLogic not initialized. Please ensure XltTokenModule is imported correctly.");
	return _stpLogic;
}
function getStpPermLogic() {
	if (!_stpPermLogic) throw new Error("StpPermLogic not initialized. Please ensure XltTokenModule is imported with stpInterface.");
	return _stpPermLogic;
}
var StpUtil = class {
	static async login(loginId, options = {}) {
		return getStpLogic().login(loginId, options);
	}
	static async logout(token) {
		return getStpLogic().logout(token);
	}
	static async logoutByLoginId(loginId) {
		return getStpLogic().logoutByLoginId(loginId);
	}
	static async kickout(loginId, device) {
		return getStpLogic().kickout(loginId, device);
	}
	static async kickoutByDevice(loginId, device) {
		return getStpLogic().kickoutByDevice(loginId, device);
	}
	static async kickoutByToken(token) {
		return getStpLogic().kickoutByToken(token);
	}
	static async renewTimeout(token, timeout) {
		return getStpLogic().renewTimeout(token, timeout);
	}
	static async isLogin(req) {
		return getStpLogic().isLogin(toHttpContext(req));
	}
	static async checkLogin(req) {
		return getStpLogic().checkLogin(toHttpContext(req));
	}
	static async getLoginId(req) {
		return (await getStpLogic().checkLogin(toHttpContext(req))).loginId || null;
	}
	static async getTokenValue(req) {
		return getStpLogic().getTokenValue(toHttpContext(req));
	}
	static async openSafe(token, business, timeout) {
		return getStpLogic().openSafe(token, business, timeout);
	}
	static async checkSafe(token, business) {
		return getStpLogic().checkSafe(token, business);
	}
	static async closeSafe(token, business) {
		return getStpLogic().closeSafe(token, business);
	}
	static async createTempToken(value, timeout) {
		return getStpLogic().createTempToken(value, timeout);
	}
	static async parseTempToken(tempToken) {
		return getStpLogic().parseTempToken(tempToken);
	}
	static async deleteTempToken(tempToken) {
		return getStpLogic().deleteTempToken(tempToken);
	}
	static async getDeviceList(loginId) {
		return getStpLogic().getDeviceList(loginId);
	}
	static async forceLogout(loginId) {
		return getStpLogic().forceLogout(loginId);
	}
	static async getOnlineLoginIds(opts) {
		return getStpLogic().getOnlineLoginIds(opts);
	}
	static async getOnlineCount() {
		return getStpLogic().getOnlineCount();
	}
	static async hasPermission(loginId, permission) {
		return getStpPermLogic().hasPermission(loginId, permission);
	}
	static async checkPermission(loginId, permissions, mode) {
		return getStpPermLogic().checkPermission(loginId, permissions, mode);
	}
	static async hasRole(loginId, role) {
		return getStpPermLogic().hasRole(loginId, role);
	}
	static async checkRole(loginId, roles, mode) {
		return getStpPermLogic().checkRole(loginId, roles, mode);
	}
	static getSession(loginId) {
		return getStpLogic().getSession(loginId);
	}
	static async getOfflineReason(token) {
		return getStpLogic().getOfflineRecords(token);
	}
};

//#endregion
//#region src/factory.ts
const defaultStpInterface = {
	getPermissionList: () => {
		throw new Error("StpInterface not registered: getPermissionList");
	},
	getRoleList: () => {
		throw new Error("StpInterface not registered: getRoleList");
	}
};
function createXltToken(options = {}) {
	const config = normalizeXltTokenConfig(options.config);
	const store = options.store ?? new MemoryStore();
	const strategy = options.strategy ?? new UuidStrategy();
	const stpInterface = options.stpInterface ?? defaultStpInterface;
	const stpLogic = new StpLogic(config, store, strategy, options.hooks ?? {});
	const stpPermLogic = new StpPermLogic(stpInterface, store, config);
	setStpLogic(stpLogic);
	setStpPermLogic(stpPermLogic);
	return {
		config,
		store,
		strategy,
		stpLogic,
		stpPermLogic,
		stpUtil: StpUtil
	};
}

//#endregion
export { DEFAULT_XLT_TOKEN_CONFIG, MemoryStore, NormalizeDurationOptions, NotLoginException, NotLoginType, NotPermissionException, NotRoleException, NotSafeException, StpLogic, StpPermLogic, StpUtil, UuidStrategy, XLT_CHECK_LOGIN_KEY, XLT_IGNORE_KEY, XLT_PERMISSION_KEY, XLT_ROLE_KEY, XLT_STP_INTERFACE, XLT_TOKEN_CONFIG, XLT_TOKEN_HOOKS, XLT_TOKEN_STORE, XLT_TOKEN_STRATEGY, XltError, XltMode, XltSession, XltTokenKeys, createExpressContext, createMockHttpContext, createXltToken, matchPermission, normalizeDuration, normalizeXltTokenConfig, setStpLogic, setStpPermLogic };
//# sourceMappingURL=index.mjs.map