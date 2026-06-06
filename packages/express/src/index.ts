export { createExpressContext } from './context.js';
export type { ExpressLikeRequest, ExpressLikeResponse } from './context.js';

// 核心逻辑（来自 @xlt-token/core）
export {
  createXltToken,
  MemoryStore,
  UuidStrategy,
  StpLogic,
  StpPermLogic,
  StpUtil,
  XltSession,
  setStpLogic,
  setStpPermLogic,
} from '@xlt-token/core';
export type {
  AuthResult,
  CreateOptions,
  XltTokenContext,
} from '@xlt-token/core';

// 配置、常量与类型
export {
  DEFAULT_XLT_TOKEN_CONFIG,
  XLT_TOKEN_CONFIG,
  XLT_TOKEN_STORE,
  XLT_TOKEN_STRATEGY,
  XLT_STP_INTERFACE,
  XLT_TOKEN_HOOKS,
  NotLoginType,
  XltMode,
  matchPermission,
  createMockHttpContext,
} from '@xlt-token/core';
export type {
  CookieOptions,
  DeviceInfo,
  HttpContext,
  JwtConfig,
  StpInterface,
  TokenStrategy,
  XltHooks,
  XltTokenConfig,
  XltTokenStore,
} from '@xlt-token/core';

// Core 异常
export {
  XltError,
  NotLoginException,
  NotPermissionException,
  NotRoleException,
  NotSafeException,
} from '@xlt-token/core';

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
