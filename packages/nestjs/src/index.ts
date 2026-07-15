// 模块
export { XltTokenModule } from "./xlt-token.module.js";
export type { XltTokenModuleOptions, XltTokenModuleAsyncOptions } from "./xlt-token.module.js";

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
} from "@xlt-token/core";

// 配置与类型
export type {
  XltTokenConfig,
  DeviceInfo,
  XltTokenStore,
  TokenStrategy,
  StpInterface,
  XltHooks,
  HttpContext,
} from "@xlt-token/core";
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
} from "@xlt-token/core";

// Redis / JWT 实现
export { RedisStore, XLT_REDIS_CLIENT } from "./store/redis-store.js";
export { IORedisStore, XLT_IOREDIS_CLIENT } from "./store/ioredis-store.js";
export {
  JwtStrategy,
  createJwtStrategyConfig,
  type JwtAlgorithm,
  type JwtAudience,
  type JwtKey,
  type JwtKeyInput,
  type JwtStrategyConfig,
  type JwtStrategyConfigInput,
  type XltJwtPayload,
} from "@xlt-token/jwt";

// 装饰器
export { XltCheckLogin } from "./decorators/xlt-check-login.decorator.js";
export { XltIgnore } from "./decorators/xlt-ignore.decorator.js";
export { LoginId } from "./decorators/login-id.decorator.js";
export { TokenValue } from "./decorators/token-value.decorator.js";
export { XltCheckPermission } from "./decorators/xlt-check-permission.decorator.js";
export { XltCheckRole } from "./decorators/xlt-check-role.decorator.js";
export { XltCheckSafe, XLT_CHECK_SAFE_KEY } from "./decorators/xlt-check-safe.decorator.js";

// 守卫
export { XltTokenGuard } from "./guards/xlt-token.guard.js";
export { XltAbstractLoginGuard } from "./guards/xlt-abstract-login.guard.js";

// NestJS 异常包装（对外 API 保持不变）
export { NotLoginException } from "./exceptions/not-login.exception.js";
export { NotPermissionException } from "./exceptions/not-permission.exception.js";
export { NotRoleException } from "./exceptions/not-role.exception.js";
export { NotSafeException } from "./exceptions/not-safe.exception.js";
