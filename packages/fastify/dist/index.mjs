import fastifyPlugin from "fastify-plugin";
import { MemoryStore, NotLoginException, NotPermissionException, NotRoleException, NotSafeException, UuidStrategy, createXltInstance } from "@xlt-token/core";

//#region src/context.ts
/**
* 将 Fastify `request` / `reply` 适配为 core 的 `HttpContext`。
*
* - Header / Query 读取直接映射 Fastify 原生对象
* - Cookie 读取依赖 `@fastify/cookie` 提供的同步 `request.cookies`（未注册时读取恒为 null）
* - 写回 header 使用 `reply.header`，写回 cookie 使用 `reply.setCookie`
*
* `state` 挂在 `request._xltState` 上，保证同一请求多次桥接拿到同一引用
* （与 Express 桥接的字段命名一致）。
*/
function createFastifyContext(request, reply) {
	return {
		headers: { get: (name) => {
			const raw = request.headers[name.toLowerCase()];
			if (raw == null) return null;
			return Array.isArray(raw) ? raw[0] ?? null : raw;
		} },
		cookies: { get: (name) => {
			const value = request.cookies?.[name];
			return typeof value === "string" ? value : null;
		} },
		query: { get: (name) => {
			const raw = request.query[name];
			if (raw == null) return null;
			return Array.isArray(raw) ? String(raw[0] ?? "") : String(raw);
		} },
		state: request._xltState ??= {},
		setHeader: (name, value) => {
			reply.header(name, value);
		},
		setCookie: (name, value, options) => {
			const target = reply;
			if (typeof target.setCookie !== "function") throw new Error("xlt-token: writing cookies requires the @fastify/cookie plugin. Register it before writing token cookies.");
			target.setCookie(name, value, options ? toFastifyCookieOptions(options) : void 0);
		},
		raw: () => request
	};
}
/**
* core 的 CookieOptions 字段名与 `@fastify/cookie` 的 setCookie 选项一致
* （maxAge 单位均为秒）。Express 特有的 `signed` 透传后由插件忽略。
*/
function toFastifyCookieOptions(options) {
	return { ...options };
}

//#endregion
//#region src/map-xlt-error.ts
/**
* 将 core 鉴权异常映射为 HTTP 状态码 + JSON body。
*
* 响应体结构与 Express / NestJS 适配器保持一致（`statusCode` / `code` / core 异常 details / `message`）。
* 非 xlt-token 异常返回 `null`，交由调用方继续向后传递。
*/
function mapXltError(err) {
	if (err instanceof NotLoginException) return {
		status: 401,
		body: {
			statusCode: 401,
			code: err.code,
			...err.details,
			message: err.message
		}
	};
	if (err instanceof NotPermissionException) return {
		status: 403,
		body: {
			statusCode: 403,
			code: err.code,
			...err.details,
			message: err.message
		}
	};
	if (err instanceof NotRoleException) return {
		status: 403,
		body: {
			statusCode: 403,
			code: err.code,
			...err.details,
			message: err.message
		}
	};
	if (err instanceof NotSafeException) return {
		status: 403,
		body: {
			statusCode: 403,
			code: err.code,
			...err.details,
			message: err.message
		}
	};
	return null;
}

//#endregion
//#region src/resolve-auth-meta.ts
function matchPathPrefix(path, prefix) {
	const pathname = path.split("?")[0] ?? path;
	return prefix === "/" || pathname === prefix || pathname.startsWith(`${prefix}/`);
}
function matchersOf(policy) {
	return Array.isArray(policy.match) ? policy.match : [policy.match];
}
/** 判断单条策略是否命中当前请求（URL 与 method 均匹配才命中）。 */
function matchPolicy(request, policy) {
	if (policy.methods?.length) {
		const method = request.method.toUpperCase();
		if (!policy.methods.map((m) => m.toUpperCase()).includes(method)) return false;
	}
	return matchersOf(policy).some((matcher) => {
		if (typeof matcher === "function") return matcher(request);
		if (typeof matcher === "string") return matchPathPrefix(request.url, matcher);
		return matcher.test(request.url);
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
/**
* 解析插件级策略命中的路由鉴权元数据。
*
* 使用 `request.url`（含 query 的原始 URL）作为匹配目标，
* 行为与 Express 的 `req.originalUrl` 匹配一致。多条策略命中时后者覆盖前者，
* 可先声明 `/api` 默认策略再声明 `/api/public` 例外。
*/
function resolveRouteAuthMeta(request, options = {}) {
	return [...(options.ignore ?? []).map((match) => ({
		match,
		ignore: true
	})), ...options.policies ?? []].reduce((meta, policy) => {
		if (!matchPolicy(request, policy)) return meta;
		const { match: _match, methods: _methods, ...nextMeta } = policy;
		return mergeRouteAuthMeta(meta, nextMeta);
	}, {});
}
/**
* 路由 `config.xlt` 的运行时读取。
*/
function resolveRouteConfigMeta(request) {
	return (request.routeOptions?.config)?.xlt ?? {};
}
/**
* 是否需要对当前请求执行登录校验。
*
* 与 Express / NestJS 行为一致：
* - 黑名单模式（`defaultCheck === true`）：除 `ignore` 标记外全部校验
* - 白名单模式（`defaultCheck === false`）：仅校验 `requireLogin` 标记的路由
*/
function shouldCheckLogin(meta, defaultCheck) {
	if (defaultCheck) return !meta?.ignore;
	return meta?.requireLogin ?? false;
}

//#endregion
//#region src/run-auth.ts
/**
* 编排登录 + 权限 + 角色 + 二级认证校验。
*
* 与 Express `runAuth` / NestJS `XltTokenGuard.canActivate` 的权限块逻辑等价：
* `checkLogin` 失败抛 `NotLoginException`，权限 / 角色 / safe 校验失败分别抛对应异常。
*/
async function runAuth(instance, httpCtx, meta) {
	const result = await instance.stpLogic.checkLogin(httpCtx);
	if (meta.permissions) await instance.stpPermLogic.checkPermission(result.loginId, meta.permissions.list, meta.permissions.mode);
	if (meta.roles) await instance.stpPermLogic.checkRole(result.loginId, meta.roles.list, meta.roles.mode);
	if (meta.safeBusiness) await instance.stpLogic.checkSafe(result.token, meta.safeBusiness);
	return result;
}

//#endregion
//#region src/plugin.ts
const MISSING_INSTANCE_ERROR = "xltFastifyPlugin requires an explicit XltInstance. Create one with createXltInstance() and pass it via register options: fastify.register(xltFastifyPlugin, { instance }).";
const COOKIE_PLUGIN_MISSING_ERROR = "xlt-token: config.isReadCookie is enabled but the @fastify/cookie plugin is not registered. Register @fastify/cookie before this plugin to enable Cookie token source.";
/**
* 将鉴权成功后的登录态同步到 Fastify request。
*
* core 在 `_resolveLoginId` 中写入 `ctx.state.stpLoginId` / `ctx.state.stpToken`，
* 这里同步到 `request.stpLoginId` / `request.stpToken`（与 Express / NestJS 字段命名一致），
* 并挂载懒加载的 `request.stpSession`。
*/
function syncFastifyAuthState(request, ctx, instance) {
	const loginId = ctx.state.stpLoginId;
	const token = ctx.state.stpToken;
	if (loginId != null) {
		request.stpLoginId = String(loginId);
		request.stpSession = instance.stpLogic.getSession(request.stpLoginId);
	}
	if (token != null) request.stpToken = String(token);
}
async function xltFastify(fastify, options) {
	const instance = options?.instance;
	if (!instance || !instance.stpLogic || !instance.stpPermLogic) throw new Error(MISSING_INSTANCE_ERROR);
	if (instance.config.isReadCookie) fastify.addHook("onReady", async () => {
		if (!fastify.hasPlugin("@fastify/cookie") && !fastify.hasRequestDecorator("cookies")) throw new Error(COOKIE_PLUGIN_MISSING_ERROR);
	});
	fastify.addHook("preHandler", async (request, reply) => {
		const httpCtx = createFastifyContext(request, reply);
		const meta = mergeRouteAuthMeta(resolveRouteAuthMeta(request, options), resolveRouteConfigMeta(request));
		if (!shouldCheckLogin(meta, instance.config.defaultCheck)) return;
		try {
			await runAuth(instance, httpCtx, meta);
			syncFastifyAuthState(request, httpCtx, instance);
		} catch (err) {
			if (options?.propagateAuthErrors) throw err;
			const mapped = mapXltError(err);
			if (mapped) {
				reply.code(mapped.status).send(mapped.body);
				return;
			}
			throw err;
		}
	});
}
/**
* xlt-token 的 Fastify 插件。
*
* 通过 `preHandler` Hook 完成登录 / 权限 / 角色 / 二级认证校验，
* 只接收显式 `XltInstance`，不读取默认实例或 `StpUtil`。
*
* @example
* ```ts
* import Fastify from "fastify";
* import { createXltInstance } from "@xlt-token/core";
* import { xltFastifyPlugin } from "@xlt-token/fastify";
*
* const instance = createXltInstance();
* const app = Fastify();
* await app.register(xltFastifyPlugin, { instance });
* app.get("/me", async (request) => ({ id: request.stpLoginId }));
* ```
*/
const xltFastifyPlugin = fastifyPlugin(xltFastify, { name: "@xlt-token/fastify" });
/**
* Fastify error handler：将 core 鉴权异常转为 401 / 403 JSON，其余透传默认处理。
* 配合 `propagateAuthErrors: true` 使用（插件抛出异常时由它统一回复）。
*
* @example
* ```ts
* app.setErrorHandler(xltFastifyErrorHandler());
* await app.register(xltFastifyPlugin, { instance, propagateAuthErrors: true });
* ```
*/
function xltFastifyErrorHandler() {
	return (error, _request, reply) => {
		const mapped = mapXltError(error);
		if (mapped) {
			reply.code(mapped.status).send(mapped.body);
			return;
		}
		reply.send(error);
	};
}

//#endregion
export { MemoryStore, UuidStrategy, createFastifyContext, createXltInstance, mapXltError, matchPolicy, mergeRouteAuthMeta, resolveRouteAuthMeta, resolveRouteConfigMeta, runAuth, shouldCheckLogin, xltFastifyErrorHandler, xltFastifyPlugin };
//# sourceMappingURL=index.mjs.map