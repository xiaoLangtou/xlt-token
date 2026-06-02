//#region src/context.ts
function createExpressContext(req, res) {
	return {
		headers: { get: (name) => req.headers[name.toLowerCase()] ?? null },
		cookies: { get: (name) => req.cookies?.[name] ?? null },
		query: { get: (name) => req.query[name] ?? null },
		state: req._xltState ??= {},
		setHeader: (name, value) => {
			return res.setHeader(name, value);
		},
		setCookie: (name, value, options) => {
			return res.cookie(name, value, options);
		},
		raw: () => req
	};
}

//#endregion
//#region src/middleware/xlt-middleware.ts
var xltMiddleware = class {};

//#endregion
//#region src/middleware/ignore-auth.ts
const ignoreAuth = () => {};

//#endregion
//#region src/middleware/require-login.ts
const requireLogin = () => {};

//#endregion
//#region src/middleware/check-permission.ts
const checkPermission = () => {};

//#endregion
//#region src/middleware/check-role.ts
const checkRole = () => {};

//#endregion
//#region src/middleware/check-safe.ts
const checkSafe = () => {};

//#endregion
//#region src/error/xlt-error-handler.ts
var xltErrorHandler = class {};

//#endregion
//#region src/auth/run-auth.ts
const runAuth = (token) => {};

//#endregion
//#region src/auth/should-check-login.ts
const shouldCheckLogin = () => {};

//#endregion
//#region src/auth/resolve-route-auth-meta.ts
const resolveRouteAuthMeta = () => {};

//#endregion
//#region src/sync-state.ts
function syncExpressAuthState(req, ctx) {
	const loginId = ctx.state.loginId;
	const token = ctx.state.token;
	if (loginId != null) req.loginId = String(loginId);
	if (token != null) req.token = String(token);
}

//#endregion
export { checkPermission, checkRole, checkSafe, createExpressContext, ignoreAuth, requireLogin, resolveRouteAuthMeta, runAuth, shouldCheckLogin, syncExpressAuthState, xltErrorHandler, xltMiddleware };
//# sourceMappingURL=index.mjs.map