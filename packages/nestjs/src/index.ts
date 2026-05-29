// 模块
export { XltTokenModule } from './xlt-token.module';
export type { XltTokenModuleOptions, XltTokenModuleAsyncOptions } from './xlt-token.module';

// 核心逻辑（来自 @xlt-token/core）
export {
  StpLogic,
  StpUtil,
  StpPermLogic,
  XltSession,
  MemoryStore,
  UuidStrategy,
  createXltToken,
  setStpLogic,
  setStpPermLogic,
  type AuthResult,
  type CreateOptions,
  type XltTokenContext,
} from '@xlt-token/core';

// 配置与类型
export type {
  XltTokenConfig,
  DeviceInfo,
  XltTokenStore,
  TokenStrategy,
  StpInterface,
  XltHooks,
  HttpContext,
} from '@xlt-token/core';
export {
  DEFAULT_XLT_TOKEN_CONFIG,
  XLT_TOKEN_CONFIG,
  XLT_TOKEN_STORE,
  XLT_TOKEN_STRATEGY,
  NotLoginType,
  XltMode,
  XLT_STP_INTERFACE,
  matchPermission,
  XLT_TOKEN_HOOKS,
  createExpressContext,
  createMockHttpContext,
} from '@xlt-token/core';

// Redis / JWT 实现（暂留根包）
export { RedisStore, XLT_REDIS_CLIENT } from './store/redis-store';
export { JwtStrategy } from './token/jwt-strategy';

// 装饰器
export { XltCheckLogin } from './decorators/xlt-check-login.decorator';
export { XltIgnore } from './decorators/xlt-ignore.decorator';
export { LoginId } from './decorators/login-id.decorator';
export { TokenValue } from './decorators/token-value.decorator';
export { XltCheckPermission } from './decorators/xlt-check-permission.decorator';
export { XltCheckRole } from './decorators/xlt-check-role.decorator';
export { XltCheckSafe, XLT_CHECK_SAFE_KEY } from './decorators/xlt-check-safe.decorator';

// 守卫
export { XltTokenGuard } from './guards/xlt-token.guard';
export { XltAbstractLoginGuard } from './guards/xlt-abstract-login.guard';

// NestJS 异常包装（对外 API 保持不变）
export { NotLoginException } from './exceptions/not-login.exception';
export { NotPermissionException } from './exceptions/not-permission.exception';
export { NotRoleException } from './exceptions/not-role.exception';
export { NotSafeException } from './exceptions/not-safe.exception';
