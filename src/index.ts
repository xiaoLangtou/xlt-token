// 模块
export { XltTokenModule, XltTokenModuleOptions, XltTokenModuleAsyncOptions } from './xlt-token.module';

// 核心逻辑
export { StpLogic } from './auth/stp-logic';
export { StpUtil } from './auth/stp-util';

// 配置与类型
export {
  XltTokenConfig,
  DEFAULT_XLT_TOKEN_CONFIG,
  XLT_TOKEN_CONFIG,
  XLT_TOKEN_STORE,
  XLT_TOKEN_STRATEGY,
} from './core/xlt-token-config';

// 存储接口与实现
export { XltTokenStore } from './store/xlt-token-store.interface';
export { MemoryStore } from './store/memory-store';
export { RedisStore,XLT_REDIS_CLIENT } from './store/redis-store';


// Token 策略接口与实现
export { TokenStrategy } from './token/token-strategy.interface';
export { UuidStrategy } from './token/uuid-strategy';

// 装饰器
export { XltCheckLogin } from './decorators/xlt-check-login.decorator';
export { XltIgnore } from './decorators/xlt-ignore.decorator';
export { LoginId } from './decorators/login-id.decorator';
export { TokenValue } from './decorators/token-value.decorator';

// 守卫
export { XltTokenGuard } from './guards/xlt-token.guard';
export { XltAbstractLoginGuard } from './guards/xlt-abstract-login.guard';

// 异常
export { NotLoginException } from './exceptions/not-login.exception';

// 常量
export { NotLoginType } from './const/index';


