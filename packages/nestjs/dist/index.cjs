Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
let _nestjs_common = require("@nestjs/common");
let _xlt_token_core = require("@xlt-token/core");
let node_module = require("node:module");
let _nestjs_core = require("@nestjs/core");

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
	static createStoreProvider(store) {
		if (!store) return {
			provide: _xlt_token_core.XLT_TOKEN_STORE,
			useClass: _xlt_token_core.MemoryStore
		};
		return "useClass" in store ? {
			provide: _xlt_token_core.XLT_TOKEN_STORE,
			useClass: store.useClass
		} : {
			provide: _xlt_token_core.XLT_TOKEN_STORE,
			useValue: store.useValue
		};
	}
	static createStrategyProvider(strategy) {
		return strategy?.useClass ? {
			provide: _xlt_token_core.XLT_TOKEN_STRATEGY,
			useClass: strategy.useClass
		} : {
			provide: _xlt_token_core.XLT_TOKEN_STRATEGY,
			useClass: _xlt_token_core.UuidStrategy
		};
	}
	static createStpInterfaceProvider(stpInterface) {
		if (stpInterface) return {
			provide: _xlt_token_core.XLT_STP_INTERFACE,
			useClass: stpInterface
		};
		return {
			provide: _xlt_token_core.XLT_STP_INTERFACE,
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
			provide: _xlt_token_core.XLT_TOKEN_HOOKS,
			useValue: hooks ?? {}
		};
	}
	static {
		this.stpLogicProvider = {
			provide: _xlt_token_core.StpLogic,
			useFactory: (config, store, strategy, hooks) => new _xlt_token_core.StpLogic(config, store, strategy, hooks),
			inject: [
				_xlt_token_core.XLT_TOKEN_CONFIG,
				_xlt_token_core.XLT_TOKEN_STORE,
				_xlt_token_core.XLT_TOKEN_STRATEGY,
				_xlt_token_core.XLT_TOKEN_HOOKS
			]
		};
	}
	static {
		this.stpPermLogicProvider = {
			provide: _xlt_token_core.StpPermLogic,
			useFactory: (stpInterface, store, config) => new _xlt_token_core.StpPermLogic(stpInterface, store, config),
			inject: [
				_xlt_token_core.XLT_STP_INTERFACE,
				_xlt_token_core.XLT_TOKEN_STORE,
				_xlt_token_core.XLT_TOKEN_CONFIG
			]
		};
	}
	static {
		this.initProvider = {
			provide: "XLT_TOKEN_INIT",
			useFactory: (stpLogic, stpPermLogic) => {
				(0, _xlt_token_core.setStpLogic)(stpLogic);
				(0, _xlt_token_core.setStpPermLogic)(stpPermLogic);
				return true;
			},
			inject: [_xlt_token_core.StpLogic, _xlt_token_core.StpPermLogic]
		};
	}
	static {
		this.moduleExports = [
			_xlt_token_core.XLT_TOKEN_CONFIG,
			_xlt_token_core.XLT_TOKEN_STORE,
			_xlt_token_core.XLT_TOKEN_STRATEGY,
			_xlt_token_core.StpLogic,
			_xlt_token_core.StpPermLogic
		];
	}
	static forRoot(options = {}) {
		const { config: userConfig, store, strategy, isGlobal = false, providers = [], stpInterface } = options;
		return {
			module: _XltTokenModule,
			providers: [
				{
					provide: _xlt_token_core.XLT_TOKEN_CONFIG,
					useValue: {
						..._xlt_token_core.DEFAULT_XLT_TOKEN_CONFIG,
						...userConfig
					}
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
					provide: _xlt_token_core.XLT_TOKEN_CONFIG,
					useFactory: async (...args) => {
						const { config = {} } = await useFactory(...args);
						return {
							..._xlt_token_core.DEFAULT_XLT_TOKEN_CONFIG,
							...config
						};
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
};
XltTokenModule = _XltTokenModule = __decorate([(0, _nestjs_common.Module)({})], XltTokenModule);

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
		let cursor = 0;
		do {
			const reply = await this.redisClient.scan(cursor, {
				MATCH: pattern,
				COUNT: 100
			});
			cursor = reply.cursor;
			result.push(...reply.keys);
		} while (cursor !== 0);
		return result;
	}
};
RedisStore = __decorate([
	(0, _nestjs_common.Injectable)(),
	__decorateParam(0, (0, _nestjs_common.Inject)(XLT_REDIS_CLIENT)),
	__decorateMetadata("design:paramtypes", [Object])
], RedisStore);

//#endregion
//#region src/token/jwt-strategy.ts
const require$1 = (0, node_module.createRequire)(require("url").pathToFileURL(__filename).href);
let jsonwebtoken;
function getJsonwebtoken() {
	try {
		jsonwebtoken ??= require$1("jsonwebtoken");
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
	createToken(loginId, config) {
		const { sign } = getJsonwebtoken();
		const jwt = config.jwt;
		return sign({
			sub: loginId,
			jti: crypto.randomUUID()
		}, jwt.secret, {
			algorithm: jwt.algorithm ?? "HS256",
			...jwt.issuer && { issuer: jwt.issuer },
			...jwt.audience && { audience: jwt.audience },
			...config.timeout > 0 && { expiresIn: config.timeout }
		});
	}
	generateToken(payload) {
		const { sign } = getJsonwebtoken();
		return sign(payload, this.config.jwt.secret);
	}
	verifyToken(token) {
		const { verify } = getJsonwebtoken();
		return verify(token, this.config.jwt.secret);
	}
};
JwtStrategy = __decorate([
	(0, _nestjs_common.Injectable)(),
	__decorateParam(0, (0, _nestjs_common.Inject)(_xlt_token_core.XLT_TOKEN_CONFIG)),
	__decorateMetadata("design:paramtypes", [Object])
], JwtStrategy);

//#endregion
//#region src/decorators/xlt-check-login.decorator.ts
/**
* 登录校验装饰器
* @constructor
*/
const XltCheckLogin = () => (0, _nestjs_common.SetMetadata)(_xlt_token_core.XLT_CHECK_LOGIN_KEY, true);

//#endregion
//#region src/decorators/xlt-ignore.decorator.ts
const XltIgnore = () => (0, _nestjs_common.SetMetadata)(_xlt_token_core.XLT_IGNORE_KEY, true);

//#endregion
//#region src/decorators/login-id.decorator.ts
/**
* 注入当前用户 ID
* @constructor
*/
const LoginId = (0, _nestjs_common.createParamDecorator)((data, ctx) => {
	return ctx.switchToHttp().getRequest().stpLoginId;
});

//#endregion
//#region src/decorators/token-value.decorator.ts
/**
* 注入当前 Token
* @constructor
*/
const TokenValue = (0, _nestjs_common.createParamDecorator)((data, ctx) => {
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
	return (0, _nestjs_common.SetMetadata)(_xlt_token_core.XLT_PERMISSION_KEY, {
		permissions: Array.isArray(permissions) ? permissions : [permissions],
		mode: options?.mode ?? _xlt_token_core.XltMode.AND
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
	return (0, _nestjs_common.SetMetadata)(_xlt_token_core.XLT_ROLE_KEY, {
		roles: Array.isArray(roles) ? roles : [roles],
		mode: options?.mode ?? _xlt_token_core.XltMode.AND
	});
};

//#endregion
//#region src/decorators/xlt-check-safe.decorator.ts
const XLT_CHECK_SAFE_KEY = "XLT_CHECK_SAFE";
const XltCheckSafe = (business) => {
	return (0, _nestjs_common.SetMetadata)(XLT_CHECK_SAFE_KEY, business);
};

//#endregion
//#region src/exceptions/not-login.exception.ts
var NotLoginException = class NotLoginException extends _nestjs_common.UnauthorizedException {
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
			[_xlt_token_core.NotLoginType.NOT_TOKEN]: "未提供 Token",
			[_xlt_token_core.NotLoginType.INVALID_TOKEN]: "Token 无效",
			[_xlt_token_core.NotLoginType.TOKEN_TIMEOUT]: "Token 已过期",
			[_xlt_token_core.NotLoginType.TOKEN_FREEZE]: "Token 已被冻结",
			[_xlt_token_core.NotLoginType.BE_REPLACED]: "已被顶下线",
			[_xlt_token_core.NotLoginType.KICK_OUT]: "已被踢下线"
		}[type] ?? "未登录";
	}
};

//#endregion
//#region src/exceptions/not-permission.exception.ts
var NotPermissionException = class extends _nestjs_common.ForbiddenException {
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
var NotRoleException = class extends _nestjs_common.ForbiddenException {
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
var NotSafeException = class extends _nestjs_common.ForbiddenException {
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
	return (0, _xlt_token_core.createExpressContext)(req, normalizeResponse(res));
}
function rethrowCoreAuthException(error) {
	if (error instanceof _xlt_token_core.NotLoginException) throw new NotLoginException(error.type, error.token);
	if (error instanceof _xlt_token_core.NotPermissionException) throw new NotPermissionException(error.permission, error.mode);
	if (error instanceof _xlt_token_core.NotRoleException) throw new NotRoleException(error.role, error.mode);
	if (error instanceof _xlt_token_core.NotSafeException) throw new NotSafeException(error.business);
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
				const permMeta = this.reflector.getAllAndOverride(_xlt_token_core.XLT_PERMISSION_KEY, [handler, cls]);
				if (permMeta) await this.stpPermLogic.checkPermission(result.loginId, permMeta.permissions, permMeta.mode);
				const roleMeta = this.reflector.getAllAndOverride(_xlt_token_core.XLT_ROLE_KEY, [handler, cls]);
				if (roleMeta) await this.stpPermLogic.checkRole(result.loginId, roleMeta.roles, roleMeta.mode);
			}
			if (business) await this.stpLogic.checkSafe(result.token, business);
		} catch (error) {
			rethrowCoreAuthException(error);
		}
		return true;
	}
	requiresLogin(context) {
		const isIgnored = this.reflector.getAllAndOverride(_xlt_token_core.XLT_IGNORE_KEY, [context.getHandler(), context.getClass()]);
		if (this.config.defaultCheck) return !isIgnored;
		return this.reflector.getAllAndOverride(_xlt_token_core.XLT_CHECK_LOGIN_KEY, [context.getHandler(), context.getClass()]) ?? false;
	}
	getBusiness(context) {
		return this.reflector.getAllAndOverride(XLT_CHECK_SAFE_KEY, [context.getHandler(), context.getClass()]);
	}
};
XltTokenGuard = __decorate([
	(0, _nestjs_common.Injectable)(),
	__decorateParam(1, (0, _nestjs_common.Inject)(_xlt_token_core.XLT_TOKEN_CONFIG)),
	__decorateParam(3, (0, _nestjs_common.Optional)()),
	__decorateMetadata("design:paramtypes", [
		typeof (_ref$1 = typeof _nestjs_core.Reflector !== "undefined" && _nestjs_core.Reflector) === "function" ? _ref$1 : Object,
		Object,
		typeof (_ref2$1 = typeof _xlt_token_core.StpLogic !== "undefined" && _xlt_token_core.StpLogic) === "function" ? _ref2$1 : Object,
		typeof (_ref3 = typeof _xlt_token_core.StpPermLogic !== "undefined" && _xlt_token_core.StpPermLogic) === "function" ? _ref3 : Object
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
			if (err instanceof _xlt_token_core.NotLoginException) {
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
		const isIgnored = this.reflector.getAllAndOverride(_xlt_token_core.XLT_IGNORE_KEY, [ctx.getHandler(), ctx.getClass()]);
		if (this.config.defaultCheck) return !isIgnored;
		return this.reflector.getAllAndOverride(_xlt_token_core.XLT_CHECK_LOGIN_KEY, [ctx.getHandler(), ctx.getClass()]) ?? false;
	}
};
XltAbstractLoginGuard = __decorate([
	(0, _nestjs_common.Injectable)(),
	__decorateParam(1, (0, _nestjs_common.Inject)(_xlt_token_core.XLT_TOKEN_CONFIG)),
	__decorateMetadata("design:paramtypes", [
		typeof (_ref = typeof _nestjs_core.Reflector !== "undefined" && _nestjs_core.Reflector) === "function" ? _ref : Object,
		Object,
		typeof (_ref2 = typeof _xlt_token_core.StpLogic !== "undefined" && _xlt_token_core.StpLogic) === "function" ? _ref2 : Object
	])
], XltAbstractLoginGuard);

//#endregion
Object.defineProperty(exports, 'DEFAULT_XLT_TOKEN_CONFIG', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.DEFAULT_XLT_TOKEN_CONFIG;
  }
});
Object.defineProperty(exports, 'JwtStrategy', {
  enumerable: true,
  get: function () {
    return JwtStrategy;
  }
});
exports.LoginId = LoginId;
Object.defineProperty(exports, 'MemoryStore', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.MemoryStore;
  }
});
exports.NotLoginException = NotLoginException;
Object.defineProperty(exports, 'NotLoginType', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.NotLoginType;
  }
});
exports.NotPermissionException = NotPermissionException;
exports.NotRoleException = NotRoleException;
exports.NotSafeException = NotSafeException;
Object.defineProperty(exports, 'RedisStore', {
  enumerable: true,
  get: function () {
    return RedisStore;
  }
});
Object.defineProperty(exports, 'StpLogic', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.StpLogic;
  }
});
Object.defineProperty(exports, 'StpPermLogic', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.StpPermLogic;
  }
});
Object.defineProperty(exports, 'StpUtil', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.StpUtil;
  }
});
exports.TokenValue = TokenValue;
Object.defineProperty(exports, 'UuidStrategy', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.UuidStrategy;
  }
});
exports.XLT_CHECK_SAFE_KEY = XLT_CHECK_SAFE_KEY;
exports.XLT_REDIS_CLIENT = XLT_REDIS_CLIENT;
Object.defineProperty(exports, 'XLT_STP_INTERFACE', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.XLT_STP_INTERFACE;
  }
});
Object.defineProperty(exports, 'XLT_TOKEN_CONFIG', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.XLT_TOKEN_CONFIG;
  }
});
Object.defineProperty(exports, 'XLT_TOKEN_HOOKS', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.XLT_TOKEN_HOOKS;
  }
});
Object.defineProperty(exports, 'XLT_TOKEN_STORE', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.XLT_TOKEN_STORE;
  }
});
Object.defineProperty(exports, 'XLT_TOKEN_STRATEGY', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.XLT_TOKEN_STRATEGY;
  }
});
Object.defineProperty(exports, 'XltAbstractLoginGuard', {
  enumerable: true,
  get: function () {
    return XltAbstractLoginGuard;
  }
});
exports.XltCheckLogin = XltCheckLogin;
exports.XltCheckPermission = XltCheckPermission;
exports.XltCheckRole = XltCheckRole;
exports.XltCheckSafe = XltCheckSafe;
exports.XltIgnore = XltIgnore;
Object.defineProperty(exports, 'XltMode', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.XltMode;
  }
});
Object.defineProperty(exports, 'XltSession', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.XltSession;
  }
});
Object.defineProperty(exports, 'XltTokenGuard', {
  enumerable: true,
  get: function () {
    return XltTokenGuard;
  }
});
Object.defineProperty(exports, 'XltTokenModule', {
  enumerable: true,
  get: function () {
    return XltTokenModule;
  }
});
Object.defineProperty(exports, 'createExpressContext', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.createExpressContext;
  }
});
Object.defineProperty(exports, 'createMockHttpContext', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.createMockHttpContext;
  }
});
Object.defineProperty(exports, 'createXltToken', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.createXltToken;
  }
});
Object.defineProperty(exports, 'matchPermission', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.matchPermission;
  }
});
Object.defineProperty(exports, 'setStpLogic', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.setStpLogic;
  }
});
Object.defineProperty(exports, 'setStpPermLogic', {
  enumerable: true,
  get: function () {
    return _xlt_token_core.setStpPermLogic;
  }
});