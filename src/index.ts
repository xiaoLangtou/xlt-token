// 模块
export { XltTokenModule } from './xlt-token.module';
export type { XltTokenModuleOptions, XltTokenModuleAsyncOptions } from './xlt-token.module';

// 核心逻辑
export { StpLogic } from './auth/stp-logic';
export { StpUtil } from './auth/stp-util';

// 配置与类型
export type { XltTokenConfig } from './core/xlt-token-config';
export {
  DEFAULT_XLT_TOKEN_CONFIG,
  XLT_TOKEN_CONFIG,
  XLT_TOKEN_STORE,
  XLT_TOKEN_STRATEGY,
} from './core/xlt-token-config';

// 存储接口与实现
export type { XltTokenStore } from './store/xlt-token-store.interface';
export { MemoryStore } from './store/memory-store';
export { RedisStore, XLT_REDIS_CLIENT } from './store/redis-store';

// Token 策略接口与实现
export type { TokenStrategy } from './token/token-strategy.interface';
export { UuidStrategy } from './token/uuid-strategy';

// 装饰器
export { XltCheckLogin } from './decorators/xlt-check-login.decorator';
export { XltIgnore } from './decorators/xlt-ignore.decorator';
export { LoginId } from './decorators/login-id.decorator';
export { TokenValue } from './decorators/token-value.decorator';
export { XltCheckPermission } from './decorators/xlt-check-permission.decorator';
export { XltCheckRole } from './decorators/xlt-check-role.decorator';

// 守卫
export { XltTokenGuard } from './guards/xlt-token.guard';
export { XltAbstractLoginGuard } from './guards/xlt-abstract-login.guard';

// 异常
export { NotLoginException } from './exceptions/not-login.exception';
export { NotPermissionException } from './exceptions/not-permission.exception';
export { NotRoleException } from './exceptions/not-role.exception';

// 常量
export { NotLoginType, XltMode } from './const/index';

// 权限
export type { StpInterface } from './perm/stp-interface';
export { XLT_STP_INTERFACE } from './perm/stp-interface';
export { StpPermLogic } from './perm/stp-perm-logic';
export { matchPermission } from './perm/perm-pattern-match';

// 会话
export { XltSession } from './session/xlt-session';
