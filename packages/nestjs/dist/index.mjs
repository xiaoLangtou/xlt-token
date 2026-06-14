import { createRequire } from "node:module";
import { ForbiddenException, Inject, Injectable, Module, Optional, SetMetadata, UnauthorizedException, createParamDecorator } from "@nestjs/common";
import { DEFAULT_XLT_TOKEN_CONFIG, MemoryStore, MemoryStore as MemoryStore$1, NotLoginException as NotLoginException$1, NotLoginType, NotLoginType as NotLoginType$1, NotPermissionException as NotPermissionException$1, NotRoleException as NotRoleException$1, NotSafeException as NotSafeException$1, StpLogic, StpLogic as StpLogic$1, StpPermLogic, StpPermLogic as StpPermLogic$1, StpUtil, UuidStrategy, UuidStrategy as UuidStrategy$1, XLT_CHECK_LOGIN_KEY, XLT_IGNORE_KEY, XLT_PERMISSION_KEY, XLT_ROLE_KEY, XLT_STP_INTERFACE, XLT_STP_INTERFACE as XLT_STP_INTERFACE$1, XLT_TOKEN_CONFIG, XLT_TOKEN_CONFIG as XLT_TOKEN_CONFIG$1, XLT_TOKEN_HOOKS, XLT_TOKEN_HOOKS as XLT_TOKEN_HOOKS$1, XLT_TOKEN_STORE, XLT_TOKEN_STORE as XLT_TOKEN_STORE$1, XLT_TOKEN_STRATEGY, XLT_TOKEN_STRATEGY as XLT_TOKEN_STRATEGY$1, XltMode, XltMode as XltMode$1, XltSession, createExpressContext, createExpressContext as createExpressContext$1, createMockHttpContext, createXltToken, matchPermission, normalizeXltTokenConfig, setStpLogic, setStpLogic as setStpLogic$1, setStpPermLogic, setStpPermLogic as setStpPermLogic$1 } from "@xlt-token/core";
import { randomUUID } from "node:crypto";
import { Reflector } from "@nestjs/core";

//#region \0@oxc-project+runtime@0.112.0/helpers/decorate.js
function __decorate(decorators, target, key, desc) {
	var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
	if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
	else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
	return c > 3 && r && Object.defineProperty(target, key, r), r;
}

//#endregion
//#region src/xlt-token.module.ts
var _XltTokenModule;
let XltTokenModule = class XltTokenModule {
	static {
		_XltTokenModule = this;
	}
	static {
		this.stpLogicProvider = {
			provide: StpLogic$1,
			useFactory: (config, store, strategy, hooks) => new StpLogic$1(config, store, strategy, hooks),
			inject: [
				XLT_TOKEN_CONFIG$1,
				XLT_TOKEN_STORE$1,
				XLT_TOKEN_STRATEGY$1,
				XLT_TOKEN_HOOKS$1
			]
		};
	}
	static {
		this.stpPermLogicProvider = {
			provide: StpPermLogic$1,
			useFactory: (stpInterface, store, config) => new StpPermLogic$1(stpInterface, store, config),
			inject: [
				XLT_STP_INTERFACE$1,
				XLT_TOKEN_STORE$1,
				XLT_TOKEN_CONFIG$1
			]
		};
	}
	static {
		this.initProvider = {
			provide: "XLT_TOKEN_INIT",
			useFactory: (stpLogic, stpPermLogic) => {
				setStpLogic$1(stpLogic);
				setStpPermLogic$1(stpPermLogic);
				return true;
			},
			inject: [StpLogic$1, StpPermLogic$1]
		};
	}
	static {
		this.moduleExports = [
			XLT_TOKEN_CONFIG$1,
			XLT_TOKEN_STORE$1,
			XLT_TOKEN_STRATEGY$1,
			StpLogic$1,
			StpPermLogic$1
		];
	}
	static forRoot(options = {}) {
		const { config: userConfig, store, strategy, isGlobal = false, providers = [], stpInterface } = options;
		return {
			module: _XltTokenModule,
			providers: [
				{
					provide: XLT_TOKEN_CONFIG$1,
					useValue: normalizeXltTokenConfig(userConfig)
				},
				_XltTokenModule.createStoreProvider(store),
				_XltTokenModule.createStrategyProvider(strategy),
				_XltTokenModule.createStpInterfaceProvider(stpInterface),
				_XltTokenModule.createHooksProvider(options.hooks),
				_XltTokenModule.stpLogicProvider,
				_XltTokenModule.stpPermLogicProvider,
				_XltTokenModule.initProvider,
				...providers
			],
			exports: _XltTokenModule.moduleExports,
			global: isGlobal
		};
	}
	static forRootAsync(options) {
		const { useFactory, inject = [], imports = [], store, strategy, isGlobal = false, providers = [], stpInterface } = options;
		return {
			module: _XltTokenModule,
			imports,
			providers: [
				{
					provide: XLT_TOKEN_CONFIG$1,
					useFactory: async (...args) => {
						const { config = {} } = await useFactory(...args);
						return normalizeXltTokenConfig(config);
					},
					inject
				},
				_XltTokenModule.createStoreProvider(store),
				_XltTokenModule.createStrategyProvider(strategy),
				_XltTokenModule.createStpInterfaceProvider(stpInterface),
				_XltTokenModule.createHooksProvider(options.hooks),
				_XltTokenModule.stpLogicProvider,
				_XltTokenModule.stpPermLogicProvider,
				_XltTokenModule.initProvider,
				...providers
			],
			exports: _XltTokenModule.moduleExports,
			global: isGlobal
		};
	}
	static createStoreProvider(store) {
		if (!store) return {
			provide: XLT_TOKEN_STORE$1,
			useClass: MemoryStore$1
		};
		return "useClass" in store ? {
			provide: XLT_TOKEN_STORE$1,
			useClass: store.useClass
		} : {
			provide: XLT_TOKEN_STORE$1,
			useValue: store.useValue
		};
	}
	static createStrategyProvider(strategy) {
		return strategy?.useClass ? {
			provide: XLT_TOKEN_STRATEGY$1,
			useClass: strategy.useClass
		} : {
			provide: XLT_TOKEN_STRATEGY$1,
			useClass: UuidStrategy$1
		};
	}
	static createStpInterfaceProvider(stpInterface) {
		if (stpInterface) return {
			provide: XLT_STP_INTERFACE$1,
			useClass: stpInterface
		};
		return {
			provide: XLT_STP_INTERFACE$1,
			useValue: {
				getPermissionList: () => {
					throw new Error("StpInterface not registered: getPermissionList");
				},
				getRoleList: () => {
					throw new Error("StpInterface not registered: getRoleList");
				}
			}
		};
	}
	static createHooksProvider(hooks) {
		return {
			provide: XLT_TOKEN_HOOKS$1,
			useValue: hooks ?? {}
		};
	}
};
XltTokenModule = _XltTokenModule = __decorate([Module({})], XltTokenModule);

//#endregion
//#region \0@oxc-project+runtime@0.112.0/helpers/decorateMetadata.js
function __decorateMetadata(k, v) {
	if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}

//#endregion
//#region \0@oxc-project+runtime@0.112.0/helpers/decorateParam.js
function __decorateParam(paramIndex, decorator) {
	return function(target, key) {
		decorator(target, key, paramIndex);
	};
}

//#endregion
//#region src/store/redis-store.ts
const XLT_REDIS_CLIENT = "XLT_REDIS_CLIENT";
let RedisStore = class RedisStore {
	constructor(redisClient) {
		this.redisClient = redisClient;
	}
	async get(key) {
		return this.redisClient.get(key);
	}
	async set(key, value, timeoutSec) {
		if (timeoutSec === -1) await this.redisClient.set(key, value);
		else await this.redisClient.set(key, value, { EX: timeoutSec });
	}
	async delete(key) {
		await this.redisClient.del(key);
	}
	async update(key, value) {
		if (await this.redisClient.set(key, value, {
			XX: true,
			KEEPTTL: true
		}) === null) throw new Error(`Key not found: ${key}`);
	}
	async has(key) {
		return await this.redisClient.exists(key) === 1;
	}
	async updateTimeout(key, timeoutSec) {
		if (!await this.redisClient.exists(key)) throw new Error(`Key not found: ${key}`);
		if (timeoutSec === -1) await this.redisClient.persist(key);
		else await this.redisClient.expire(key, timeoutSec);
	}
	async getTimeout(key) {
		return await this.redisClient.ttl(key);
	}
	async keys(pattern) {
		const result = [];
		let cursor = "0";
		do {
			const reply = await this.redisClient.scan(cursor, {
				MATCH: pattern,
				COUNT: 100
			});
			cursor = String(reply.cursor);
			result.push(...reply.keys);
		} while (cursor !== "0");
		return result;
	}
};
RedisStore = __decorate([
	Injectable(),
	__decorateParam(0, Inject(XLT_REDIS_CLIENT)),
	__decorateMetadata("design:paramtypes", [Object])
], RedisStore);

//#endregion
//#region src/token/jwt-strategy.ts
const require = createRequire(import.meta.url);
let jsonwebtoken;
function getJsonwebtoken() {
	try {
		jsonwebtoken ??= require("jsonwebtoken");
		return jsonwebtoken;
	} catch (error) {
		if (error.code === "MODULE_NOT_FOUND") throw new Error("JwtStrategy requires the optional peer dependency \"jsonwebtoken\". Install it in your application with \"pnpm add jsonwebtoken\".");
		throw error;
	}
}
let JwtStrategy = class JwtStrategy {
	constructor(config) {
		this.config = config;
	}
	ensureJwtConfig(config) {
		const jwt = (config ?? this.config).jwt;
		if (!jwt || !jwt.secret) throw new Error("JwtStrategy requires jwt config with a secret. Provide { jwt: { secret: \"your-secret\" } } in the module config.");
		return jwt;
	}
	createToken(loginId, config, options) {
		const { sign } = getJsonwebtoken();
		const jwt = this.ensureJwtConfig(config);
		const jti = randomUUID();
		const resolvedTimeout = options?.timeout ?? config.timeout;
		const hasExpiry = typeof resolvedTimeout === "number" ? resolvedTimeout > 0 : true;
		return sign({
			sub: loginId,
			jti
		}, jwt.secret, {
			algorithm: jwt.algorithm ?? "HS256",
			...jwt.issuer && { issuer: jwt.issuer },
			...jwt.audience && { audience: jwt.audience },
			...hasExpiry && { expiresIn: resolvedTimeout }
		});
	}
	generateToken(payload) {
		const { sign } = getJsonwebtoken();
		return sign(payload, this.ensureJwtConfig().secret);
	}
	verifyToken(token) {
		const { verify } = getJsonwebtoken();
		return verify(token, this.ensureJwtConfig().secret);
	}
};
JwtStrategy = __decorate([
	Injectable(),
	__decorateParam(0, Inject(XLT_TOKEN_CONFIG$1)),
	__decorateMetadata("design:paramtypes", [Object])
], JwtStrategy);

//#endregion
//#region src/decorators/xlt-check-login.decorator.ts
/**
* 登录校验装饰器
* @constructor
*/
const XltCheckLogin = () => SetMetadata(XLT_CHECK_LOGIN_KEY, true);

//#endregion
//#region src/decorators/xlt-ignore.decorator.ts
const XltIgnore = () => SetMetadata(XLT_IGNORE_KEY, true);

//#endregion
//#region src/decorators/login-id.decorator.ts
/**
* 注入当前用户 ID
* @constructor
*/
const LoginId = createParamDecorator((data, ctx) => {
	return ctx.switchToHttp().getRequest().stpLoginId;
});

//#endregion
//#region src/decorators/token-value.decorator.ts
/**
* 注入当前 Token
* @constructor
*/
const TokenValue = createParamDecorator((data, ctx) => {
	return ctx.switchToHttp().getRequest().stpToken;
});

//#endregion
//#region src/decorators/xlt-check-permission.decorator.ts
/**
* 权限检查装饰器
* @param {string | string[]} permissions 权限列表
* @param {Object} [options] 模式选项
* @param {XltMode} [options.mode] 模式选项
* @constructor
*/
const XltCheckPermission = (permissions, options) => {
	return SetMetadata(XLT_PERMISSION_KEY, {
		permissions: Array.isArray(permissions) ? permissions : [permissions],
		mode: options?.mode ?? XltMode$1.AND
	});
};

//#endregion
//#region src/decorators/xlt-check-role.decorator.ts
/**
* 角色检查装饰器
* @param {string | string[]} roles 角色列表
* @param {Object} [options] 模式选项
* @param {XltMode} [options.mode] 模式选项
* @constructor
*/
const XltCheckRole = (roles, options) => {
	return SetMetadata(XLT_ROLE_KEY, {
		roles: Array.isArray(roles) ? roles : [roles],
		mode: options?.mode ?? XltMode$1.AND
	});
};

//#endregion
//#region src/decorators/xlt-check-safe.decorator.ts
const XLT_CHECK_SAFE_KEY = "XLT_CHECK_SAFE";
const XltCheckSafe = (business) => {
	return SetMetadata(XLT_CHECK_SAFE_KEY, business);
};

//#endregion
//#region src/exceptions/not-login.exception.ts
var NotLoginException = class NotLoginException extends UnauthorizedException {
	constructor(type, token) {
		super({
			statusCode: 401,
			type,
			message: NotLoginException.describeType(type)
		});
		this.type = type;
		this.token = token;
	}
	static describeType(type) {
		return {
			[NotLoginType$1.NOT_TOKEN]: "未提供 Token",
			[NotLoginType$1.INVALID_TOKEN]: "Token 无效",
			[NotLoginType$1.TOKEN_TIMEOUT]: "Token 已过期",
			[NotLoginType$1.TOKEN_FREEZE]: "Token 已被冻结",
			[NotLoginType$1.BE_REPLACED]: "已被顶下线",
			[NotLoginType$1.KICK_OUT]: "已被踢下线"
		}[type] ?? "未登录";
	}
};

//#endregion
//#region src/exceptions/not-permission.exception.ts
var NotPermissionException = class extends ForbiddenException {
	constructor(permission, mode) {
		super({
			statusCode: 403,
			type: "NOT_PERMISSION",
			message: `缺少权限: ${Array.isArray(permission) ? permission.join(", ") : permission}`
		});
		this.permission = permission;
		this.mode = mode;
	}
};

//#endregion
//#region src/exceptions/not-role.exception.ts
var NotRoleException = class extends ForbiddenException {
	constructor(role, mode) {
		super({
			statusCode: 403,
			type: "NOT_ROLE",
			message: `缺少角色: ${Array.isArray(role) ? role.join(", ") : role}`
		});
		this.role = role;
		this.mode = mode;
	}
};

//#endregion
//#region src/exceptions/not-safe.exception.ts
var NotSafeException = class extends ForbiddenException {
	constructor(business) {
		super({
			statusCode: 403,
			type: "NOT_SAFE",
			message: `二级认证未开启：${business}`
		});
		this.business = business;
	}
};

//#endregion
//#region src/http/nest-bridge.ts
/**
* Fastify reply 的写回 API 与 Express response 不同：
* - 写 header：Express 用 `res.setHeader(n, v)`，Fastify 用 `reply.header(n, v)`
* - 写 cookie：Express 用 `res.cookie(n, v, o)`，Fastify 用 `reply.setCookie(n, v, o)`
*
* 这里把任意一种 response 归一化成 core 期望的 {@link ExpressLikeResponse} 形态，
* 让核心层无需感知底层 HTTP 平台。读取侧（headers/cookies/query）两个平台形态一致，
* 直接复用 core 的 createExpressContext。
*/
function normalizeResponse(res) {
	return {
		setHeader(name, value) {
			if (typeof res?.setHeader === "function") res.setHeader(name, value);
			else if (typeof res?.header === "function") res.header(name, value);
			else throw new Error("xlt-token: 当前 response 不支持写入 header（既无 setHeader 也无 header 方法）");
		},
		cookie(name, value, options) {
			if (typeof res?.cookie === "function") res.cookie(name, value, options);
			else if (typeof res?.setCookie === "function") res.setCookie(name, value, options);
			else throw new Error("xlt-token: 当前 response 不支持写入 cookie。若使用 Fastify，请先注册 @fastify/cookie 插件。");
		}
	};
}
function createNestHttpContext(req, res) {
	return createExpressContext$1(req, normalizeResponse(res));
}
function rethrowCoreAuthException(error) {
	if (error instanceof NotLoginException$1) throw new NotLoginException(error.type, error.token);
	if (error instanceof NotPermissionException$1) throw new NotPermissionException(error.permission, error.mode);
	if (error instanceof NotRoleException$1) throw new NotRoleException(error.role, error.mode);
	if (error instanceof NotSafeException$1) throw new NotSafeException(error.business);
	throw error;
}

//#endregion
//#region src/guards/xlt-token.guard.ts
var _ref$1, _ref2$1, _ref3;
let XltTokenGuard = class XltTokenGuard {
	constructor(reflector, config, stpLogic, stpPermLogic) {
		this.reflector = reflector;
		this.config = config;
		this.stpLogic = stpLogic;
		this.stpPermLogic = stpPermLogic;
	}
	async canActivate(context) {
		if (!this.requiresLogin(context)) return true;
		const request = context.switchToHttp().getRequest();
		const response = context.switchToHttp().getResponse();
		let result;
		try {
			result = await this.stpLogic.checkLogin(createNestHttpContext(request, response));
		} catch (error) {
			rethrowCoreAuthException(error);
		}
		const business = this.getBusiness(context);
		request.stpLoginId = result.loginId;
		request.stpToken = result.token;
		try {
			if (this.stpPermLogic) {
				const handler = context.getHandler();
				const cls = context.getClass();
				const permMeta = this.reflector.getAllAndOverride(XLT_PERMISSION_KEY, [handler, cls]);
				if (permMeta) await this.stpPermLogic.checkPermission(result.loginId, permMeta.permissions, permMeta.mode);
				const roleMeta = this.reflector.getAllAndOverride(XLT_ROLE_KEY, [handler, cls]);
				if (roleMeta) await this.stpPermLogic.checkRole(result.loginId, roleMeta.roles, roleMeta.mode);
			}
			if (business) await this.stpLogic.checkSafe(result.token, business);
		} catch (error) {
			rethrowCoreAuthException(error);
		}
		return true;
	}
	requiresLogin(context) {
		const isIgnored = this.reflector.getAllAndOverride(XLT_IGNORE_KEY, [context.getHandler(), context.getClass()]);
		if (this.config.defaultCheck) return !isIgnored;
		return this.reflector.getAllAndOverride(XLT_CHECK_LOGIN_KEY, [context.getHandler(), context.getClass()]) ?? false;
	}
	getBusiness(context) {
		return this.reflector.getAllAndOverride(XLT_CHECK_SAFE_KEY, [context.getHandler(), context.getClass()]);
	}
};
XltTokenGuard = __decorate([
	Injectable(),
	__decorateParam(1, Inject(XLT_TOKEN_CONFIG$1)),
	__decorateParam(3, Optional()),
	__decorateMetadata("design:paramtypes", [
		typeof (_ref$1 = typeof Reflector !== "undefined" && Reflector) === "function" ? _ref$1 : Object,
		Object,
		typeof (_ref2$1 = typeof StpLogic$1 !== "undefined" && StpLogic$1) === "function" ? _ref2$1 : Object,
		typeof (_ref3 = typeof StpPermLogic$1 !== "undefined" && StpPermLogic$1) === "function" ? _ref3 : Object
	])
], XltTokenGuard);

//#endregion
//#region src/guards/xlt-abstract-login.guard.ts
var _ref, _ref2;
let XltAbstractLoginGuard = class XltAbstractLoginGuard {
	constructor(reflector, config, stpLogic) {
		this.reflector = reflector;
		this.config = config;
		this.stpLogic = stpLogic;
	}
	async canActivate(ctx) {
		if (!this.requiresLogin(ctx)) return true;
		const request = ctx.switchToHttp().getRequest();
		const response = ctx.switchToHttp().getResponse();
		let result;
		try {
			result = await this.stpLogic.checkLogin(createNestHttpContext(request, response));
		} catch (err) {
			if (err instanceof NotLoginException$1) {
				await this.onAuthFail?.({
					ok: false,
					reason: err.type,
					token: err.token
				}, request);
				throw new NotLoginException(err.type, err.token);
			}
			throw err;
		}
		request.stpLoginId = result.loginId;
		request.stpToken = result.token;
		await this.onAuthSuccess?.(result, request);
		return true;
	}
	requiresLogin(ctx) {
		const isIgnored = this.reflector.getAllAndOverride(XLT_IGNORE_KEY, [ctx.getHandler(), ctx.getClass()]);
		if (this.config.defaultCheck) return !isIgnored;
		return this.reflector.getAllAndOverride(XLT_CHECK_LOGIN_KEY, [ctx.getHandler(), ctx.getClass()]) ?? false;
	}
};
XltAbstractLoginGuard = __decorate([
	Injectable(),
	__decorateParam(1, Inject(XLT_TOKEN_CONFIG$1)),
	__decorateMetadata("design:paramtypes", [
		typeof (_ref = typeof Reflector !== "undefined" && Reflector) === "function" ? _ref : Object,
		Object,
		typeof (_ref2 = typeof StpLogic$1 !== "undefined" && StpLogic$1) === "function" ? _ref2 : Object
	])
], XltAbstractLoginGuard);

//#endregion
export { DEFAULT_XLT_TOKEN_CONFIG, JwtStrategy, LoginId, MemoryStore, NotLoginException, NotLoginType, NotPermissionException, NotRoleException, NotSafeException, RedisStore, StpLogic, StpPermLogic, StpUtil, TokenValue, UuidStrategy, XLT_CHECK_SAFE_KEY, XLT_REDIS_CLIENT, XLT_STP_INTERFACE, XLT_TOKEN_CONFIG, XLT_TOKEN_HOOKS, XLT_TOKEN_STORE, XLT_TOKEN_STRATEGY, XltAbstractLoginGuard, XltCheckLogin, XltCheckPermission, XltCheckRole, XltCheckSafe, XltIgnore, XltMode, XltSession, XltTokenGuard, XltTokenModule, createExpressContext, createMockHttpContext, createXltToken, matchPermission, setStpLogic, setStpPermLogic };
//# sourceMappingURL=index.mjs.map