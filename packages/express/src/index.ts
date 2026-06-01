export { createExpressContext } from './context.js';
export type { ExpressLikeRequest, ExpressLikeResponse } from './context.js';

// 中间件
export { xltMiddleware } from './middleware/xlt-middleware.js';
export type { XltMiddlewareOptions } from './middleware/xlt-middleware.js';
export { ignoreAuth } from './middleware/ignore-auth.js';
export { requireLogin } from './middleware/require-login.js';
export { checkPermission } from './middleware/check-permission.js';
export { checkRole } from './middleware/check-role.js';
export { checkSafe } from './middleware/check-safe.js';

// 错误处理
export { xltErrorHandler } from './error/xlt-error-handler.js';

// 编排（高级用法 / 自定义中间件）
export { runAuth } from './auth/run-auth.js';
export { shouldCheckLogin } from './auth/should-check-login.js';
export { resolveRouteAuthMeta } from './auth/resolve-route-auth-meta.js';
export { syncExpressAuthState } from './sync-state.js';

// 类型
export type { AuthMatcher, RouteAuthMeta, RouteAuthPolicy } from './types.js';
