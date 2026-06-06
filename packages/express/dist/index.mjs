import { NotLoginException, NotPermissionException, NotRoleException, NotSafeException, XltMode } from "@xlt-token/core";

//#region src/context.ts
/**
* 将 Express `req` / `res` 适配为 core 的 `HttpContext`。
*
* `state` 复用挂在 `req._xltState` 上的请求级共享对象，使同一请求多次调用拿到同一引用。
*/
function createExpressContext(req, res) {
	return {
		headers: { get: (name) => req.headers[name.toLowerCase()] ?? null },
		cookies: { get: (name) => req.cookies?.[name] ?? null },
		query: { get: (name) => req.query[name] ?? null },
		state: req._xltState ??= {},
		setHeader: (name, value) => {
			res.setHeader(name, value);
		},
		setCookie: (name, value, options) => {
			if (options) res.cookie(name, value, options);
			else res.cookie(name, value);
		},
		raw: () => req
	};
}

//#endregion
//#region src/auth/resolve-route-auth-meta.ts
/**
* 解析当前请求命中的路由鉴权元数据。
*
* 在 `shouldCheckLogin` 和 `runAuth` 之前调用，使用 `req.originalUrl` 作为匹配目标，
* 避免 Router 嵌套时 `req.path` 丢失挂载前缀。
*
* 当多条策略同时命中时，后声明的策略覆盖前者的简单字段，并合并权限/角色列表，
* 因此用户可先声明 `/api` 默认策略，再声明 `/api/public` 例外。
*/
function resolveRouteAuthMeta(req, options = {}) {
	return [...(options.ignore ?? []).map((match) => ({
		match,
		ignore: true
	})), ...options.policies ?? []].reduce((meta, policy) => {
		if (!matchPolicy(req, policy)) return meta;
		const { match: _match, methods: _methods, ...nextMeta } = policy;
		return mergeRouteAuthMeta(meta, nextMeta);
	}, {});
}
/** 判断单条策略是否命中当前请求。 */
function matchPolicy(req, policy) {
	if (policy.methods?.length) {
		const method = req.method.toUpperCase();
		if (!policy.methods.map((m) => m.toUpperCase()).includes(method)) return false;
	}
	return (Array.isArray(policy.match) ? policy.match : [policy.match]).some((matcher) => {
		if (typeof matcher === "function") return matcher(req);
		if (typeof matcher === "string") return req.originalUrl === matcher || req.originalUrl.startsWith(matcher);
		return matcher.test(req.originalUrl);
	});
}
/**
* 合并两段路由元数据：
* - `ignore` / `requireLogin` / `safeBusiness` 等简单字段：后者覆盖前者
* - `permissions` / `roles`：两者都存在时合并列表，mode 取后者
*/
function mergeRouteAuthMeta(base, next) {
	const merged = {
		...base,
		...next
	};
	if (base.permissions && next.permissions) merged.permissions = {
		list: [...base.permissions.list, ...next.permissions.list],
		mode: next.permissions.mode
	};
	if (base.roles && next.roles) merged.roles = {
		list: [...base.roles.list, ...next.roles.list],
		mode: next.roles.mode
	};
	return merged;
}

//#endregion
//#region src/auth/should-check-login.ts
/**
* 是否需要对当前请求执行登录校验。
*
* 与 NestJS `XltTokenGuard.requiresLogin` 行为一致：
* - 黑名单模式（`defaultCheck === true`）：除被 `ignore` 标记的路由外全部校验
* - 白名单模式（`defaultCheck === false`）：仅校验被 `requireLogin` 标记的路由
*
* 路由元数据由 `resolveRouteAuthMeta` 提前写入 `req._xltRouteMeta`。
*/
function shouldCheckLogin(req, config) {
	const meta = req._xltRouteMeta;
	if (config.defaultCheck) return !meta?.ignore;
	return meta?.requireLogin ?? false;
}

//#endregion
//#region src/auth/run-auth.ts
/**
* 编排登录 + 权限 + 角色 + 二级认证校验。
*
* 与 `XltTokenGuard.canActivate` 中的权限块逻辑等价：
* `checkLogin` 失败时抛出 `NotLoginException`，权限/角色/safe 校验失败时分别抛出对应异常。
*/
async function runAuth(xlt, httpCtx, req) {
	const result = await xlt.stpLogic.checkLogin(httpCtx);
	const meta = req._xltRouteMeta;
	if (meta?.permissions && xlt.stpPermLogic) await xlt.stpPermLogic.checkPermission(result.loginId, meta.permissions.list, meta.permissions.mode);
	if (meta?.roles && xlt.stpPermLogic) await xlt.stpPermLogic.checkRole(result.loginId, meta.roles.list, meta.roles.mode);
	if (meta?.safeBusiness) await xlt.stpLogic.checkSafe(result.token, meta.safeBusiness);
	return result;
}

//#endregion
//#region src/sync-state.ts
/**
* 将鉴权成功后写入 `ctx.state` 的登录态同步到 Express `req` 上。
*
* core 在 `_resolveLoginId` 中写入 `ctx.state.stpLoginId` / `ctx.state.stpToken`，
* 这里对应同步到 `req.stpLoginId` / `req.stpToken`（与 NestJS Guard 字段命名一致）。
*/
function syncExpressAuthState(req, ctx) {
	const loginId = ctx.state.stpLoginId;
	const token = ctx.state.stpToken;
	if (loginId != null) req.stpLoginId = String(loginId);
	if (token != null) req.stpToken = String(token);
}

//#endregion
//#region src/middleware/xlt-middleware.ts
/**
* 全局登录校验中间件。
*
* 执行流程：
* 1. `createExpressContext(req, res)`
* 2. `resolveRouteAuthMeta` → 写入 `req._xltRouteMeta`
* 3. `shouldCheckLogin` 判断是否需要校验，不需要则直接放行
* 4. `runAuth`（登录 + 权限 + 角色 + safe），成功后 `syncExpressAuthState`
* 5. 任意异常通过 `next(err)` 交给 `xltErrorHandler`
*/
function xltMiddleware(xlt, options = {}) {
	return async (req, res, next) => {
		const httpCtx = createExpressContext(req, res);
		req._xltRouteMeta = {
			...req._xltRouteMeta,
			...resolveRouteAuthMeta(req, options)
		};
		if (!shouldCheckLogin(req, xlt.config)) return next();
		try {
			await runAuth(xlt, httpCtx, req);
			syncExpressAuthState(req, httpCtx);
			next();
		} catch (err) {
			next(err);
		}
	};
}

//#endregion
//#region src/middleware/ignore-auth.ts
/**
* 路由级 helper：标记当前路由忽略登录校验（黑名单模式下放行）。
*
* 仅写入 `req._xltRouteMeta`，因此必须在同一条 route chain 中位于 `xltMiddleware` 之前才有效。
* 推荐主路径仍是 `xltMiddleware` 的 `ignore` / `policies` 选项。
*/
function ignoreAuth() {
	return (req, _res, next) => {
		req._xltRouteMeta = {
			...req._xltRouteMeta,
			ignore: true
		};
		next();
	};
}

//#endregion
//#region src/middleware/require-login.ts
/**
* 路由级 helper：标记当前路由需要登录（白名单模式下开启校验）。
*
* 仅写入 `req._xltRouteMeta`，必须位于 `xltMiddleware` 之前才生效。
*/
function requireLogin() {
	return (req, _res, next) => {
		req._xltRouteMeta = {
			...req._xltRouteMeta,
			requireLogin: true
		};
		next();
	};
}

//#endregion
//#region src/middleware/check-permission.ts
/**
* 路由级 helper：声明当前路由所需权限。
*
* 仅写入 `req._xltRouteMeta.permissions`，必须位于 `xltMiddleware` 之前才生效。
*/
function checkPermission(permission, mode = XltMode.AND) {
	return (req, _res, next) => {
		const list = Array.isArray(permission) ? permission : [permission];
		req._xltRouteMeta = {
			...req._xltRouteMeta,
			permissions: {
				list,
				mode
			}
		};
		next();
	};
}

//#endregion
//#region src/middleware/check-role.ts
/**
* 路由级 helper：声明当前路由所需角色。
*
* 仅写入 `req._xltRouteMeta.roles`，必须位于 `xltMiddleware` 之前才生效。
*/
function checkRole(role, mode = XltMode.AND) {
	return (req, _res, next) => {
		const list = Array.isArray(role) ? role : [role];
		req._xltRouteMeta = {
			...req._xltRouteMeta,
			roles: {
				list,
				mode
			}
		};
		next();
	};
}

//#endregion
//#region src/middleware/check-safe.ts
/**
* 路由级 helper：声明当前路由需要二级认证安全窗口。
*
* 仅写入 `req._xltRouteMeta.safeBusiness`，必须位于 `xltMiddleware` 之前才生效。
*/
function checkSafe(business) {
	return (req, _res, next) => {
		req._xltRouteMeta = {
			...req._xltRouteMeta,
			safeBusiness: business
		};
		next();
	};
}

//#endregion
//#region src/error/map-xlt-error.ts
/**
* 将 core 鉴权异常映射为 HTTP 状态码 + JSON body。
* 非 xlt-token 异常返回 `null`，交由调用方继续向后传递。
*/
function mapXltError(err) {
	if (err instanceof NotLoginException) return {
		status: 401,
		body: {
			statusCode: 401,
			code: err.code,
			type: err.type,
			message: err.message,
			token: err.token
		}
	};
	if (err instanceof NotPermissionException) return {
		status: 403,
		body: {
			statusCode: 403,
			code: err.code,
			permission: err.permission,
			mode: err.mode,
			message: err.message
		}
	};
	if (err instanceof NotRoleException) return {
		status: 403,
		body: {
			statusCode: 403,
			code: err.code,
			role: err.role,
			mode: err.mode,
			message: err.message
		}
	};
	if (err instanceof NotSafeException) return {
		status: 403,
		body: {
			statusCode: 403,
			code: err.code,
			business: err.business,
			message: err.message
		}
	};
	return null;
}

//#endregion
//#region src/error/xlt-error-handler.ts
/**
* 四参数 Express 错误中间件，挂在路由链末尾，将 core 鉴权异常转为 401/403 JSON。
* 非 xlt-token 异常透传给下一个错误处理器。
*
* @example
* app.use(xltErrorHandler());
*/
function xltErrorHandler() {
	return (err, _req, res, next) => {
		const mapped = mapXltError(err);
		if (!mapped) {
			next(err);
			return;
		}
		res.status(mapped.status).json(mapped.body);
	};
}

//#endregion
export { checkPermission, checkRole, checkSafe, createExpressContext, ignoreAuth, requireLogin, resolveRouteAuthMeta, runAuth, shouldCheckLogin, syncExpressAuthState, xltErrorHandler, xltMiddleware };
//# sourceMappingURL=index.mjs.map