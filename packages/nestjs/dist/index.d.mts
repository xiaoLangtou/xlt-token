import * as _nestjs_common0 from "@nestjs/common";
import { CanActivate, ExecutionContext, ForbiddenException, ModuleMetadata, Provider, UnauthorizedException } from "@nestjs/common";
import { AuthResult, CreateOptions, DEFAULT_XLT_TOKEN_CONFIG, DeviceInfo, DurationInput, HttpContext, MemoryStore, NotLoginType, NotLoginType as NotLoginType$1, StpInterface, StpInterface as StpInterface$1, StpLogic, StpLogic as StpLogic$1, StpPermLogic, StpPermLogic as StpPermLogic$1, StpUtil, TokenStrategy, TokenStrategy as TokenStrategy$1, UuidStrategy, XLT_STP_INTERFACE, XLT_TOKEN_CONFIG, XLT_TOKEN_HOOKS, XLT_TOKEN_STORE, XLT_TOKEN_STRATEGY, XltHooks, XltHooks as XltHooks$1, XltMode, XltMode as XltMode$1, XltSession, XltTokenConfig, XltTokenConfig as XltTokenConfig$1, XltTokenConfigInput, XltTokenContext, XltTokenStore, XltTokenStore as XltTokenStore$1, createExpressContext, createMockHttpContext, createXltToken, matchPermission, setStpLogic, setStpPermLogic } from "@xlt-token/core";
import { Reflector } from "@nestjs/core";

//#region src/xlt-token.module.d.ts
interface XltTokenModuleOptions {
  config?: Partial<XltTokenConfigInput>;
  store?: {
    useClass: new (...args: any[]) => XltTokenStore$1;
  } | {
    useValue: XltTokenStore$1;
  };
  strategy?: {
    useClass: new (...args: any[]) => TokenStrategy$1;
  };
  isGlobal?: boolean;
  providers?: Provider[];
  stpInterface?: new (...args: any[]) => StpInterface$1;
  hooks?: XltHooks$1;
}
interface XltTokenModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: any[]) => Promise<XltTokenModuleOptions> | XltTokenModuleOptions;
  inject?: any[];
  store?: {
    useClass: new (...args: any[]) => XltTokenStore$1;
  } | {
    useValue: XltTokenStore$1;
  };
  strategy?: {
    useClass: new (...args: any[]) => TokenStrategy$1;
  };
  isGlobal?: boolean;
  providers?: Provider[];
  stpInterface?: new (...args: any[]) => StpInterface$1;
  hooks?: XltHooks$1;
}
declare class XltTokenModule {
  private static readonly stpLogicProvider;
  private static readonly stpPermLogicProvider;
  private static readonly initProvider;
  private static readonly moduleExports;
  static forRoot(options?: XltTokenModuleOptions): {
    module: typeof XltTokenModule;
    providers: Provider[];
    exports: (string | typeof StpLogic$1 | typeof StpPermLogic$1)[];
    global: boolean;
  };
  static forRootAsync(options: XltTokenModuleAsyncOptions): {
    module: typeof XltTokenModule;
    imports: (_nestjs_common0.Type<any> | _nestjs_common0.DynamicModule | Promise<_nestjs_common0.DynamicModule> | _nestjs_common0.ForwardReference<any>)[];
    providers: (_nestjs_common0.Type<any> | _nestjs_common0.ClassProvider<any> | _nestjs_common0.ValueProvider<any> | _nestjs_common0.FactoryProvider<any> | _nestjs_common0.ExistingProvider<any> | {
      provide: string;
      useFactory: (...args: any[]) => Promise<XltTokenConfig$1>;
      inject: any[];
    })[];
    exports: (string | typeof StpLogic$1 | typeof StpPermLogic$1)[];
    global: boolean;
  };
  private static createStoreProvider;
  private static createStrategyProvider;
  private static createStpInterfaceProvider;
  private static createHooksProvider;
}
//#endregion
//#region src/store/redis-store.d.ts
declare const XLT_REDIS_CLIENT = "XLT_REDIS_CLIENT";
declare class RedisStore implements XltTokenStore$1 {
  private readonly redisClient;
  constructor(redisClient: any);
  get(key: string): Promise<string | null>;
  set(key: string, value: string, timeoutSec: number): Promise<void>;
  delete(key: string): Promise<void>;
  update(key: string, value: string): Promise<void>;
  has(key: string): Promise<boolean>;
  updateTimeout(key: string, timeoutSec: number): Promise<void>;
  getTimeout(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}
//#endregion
//#region src/token/jwt-strategy.d.ts
type XltJwtPayload = Record<string, any> & {
  sub: string;
  jti: string;
};
declare class JwtStrategy implements TokenStrategy$1<XltJwtPayload> {
  private readonly config;
  constructor(config: XltTokenConfig$1);
  private ensureJwtConfig;
  createToken(loginId: string, config: XltTokenConfig$1, options?: {
    timeout?: DurationInput;
  }): string;
  generateToken(payload: any): string;
  verifyToken(token: string): XltJwtPayload;
}
//#endregion
//#region src/decorators/xlt-check-login.decorator.d.ts
/**
 * 登录校验装饰器
 * @constructor
 */
declare const XltCheckLogin: () => _nestjs_common0.CustomDecorator<string>;
//#endregion
//#region src/decorators/xlt-ignore.decorator.d.ts
declare const XltIgnore: () => _nestjs_common0.CustomDecorator<string>;
//#endregion
//#region src/decorators/login-id.decorator.d.ts
/**
 * 注入当前用户 ID
 * @constructor
 */
declare const LoginId: (...dataOrPipes: unknown[]) => ParameterDecorator;
//#endregion
//#region src/decorators/token-value.decorator.d.ts
/**
 * 注入当前 Token
 * @constructor
 */
declare const TokenValue: (...dataOrPipes: any[]) => ParameterDecorator;
//#endregion
//#region src/decorators/xlt-check-permission.decorator.d.ts
/**
 * 权限检查装饰器
 * @param {string | string[]} permissions 权限列表
 * @param {Object} [options] 模式选项
 * @param {XltMode} [options.mode] 模式选项
 * @constructor
 */
declare const XltCheckPermission: (permissions: string | string[], options?: {
  mode: XltMode$1;
}) => _nestjs_common0.CustomDecorator<string>;
//#endregion
//#region src/decorators/xlt-check-role.decorator.d.ts
/**
 * 角色检查装饰器
 * @param {string | string[]} roles 角色列表
 * @param {Object} [options] 模式选项
 * @param {XltMode} [options.mode] 模式选项
 * @constructor
 */
declare const XltCheckRole: (roles: string | string[], options?: {
  mode: XltMode$1;
}) => _nestjs_common0.CustomDecorator<string>;
//#endregion
//#region src/decorators/xlt-check-safe.decorator.d.ts
declare const XLT_CHECK_SAFE_KEY = "XLT_CHECK_SAFE";
declare const XltCheckSafe: (business: string) => _nestjs_common0.CustomDecorator<string>;
//#endregion
//#region src/guards/xlt-token.guard.d.ts
declare class XltTokenGuard implements CanActivate {
  private readonly reflector;
  private readonly config;
  private readonly stpLogic;
  private readonly stpPermLogic?;
  constructor(reflector: Reflector, config: XltTokenConfig$1, stpLogic: StpLogic$1, stpPermLogic?: StpPermLogic$1 | undefined);
  canActivate(context: ExecutionContext): Promise<boolean>;
  private requiresLogin;
  private getBusiness;
}
//#endregion
//#region src/guards/xlt-abstract-login.guard.d.ts
declare abstract class XltAbstractLoginGuard implements CanActivate {
  protected readonly reflector: Reflector;
  protected readonly config: XltTokenConfig$1;
  protected readonly stpLogic: StpLogic$1;
  protected constructor(reflector: Reflector, config: XltTokenConfig$1, stpLogic: StpLogic$1);
  canActivate(ctx: ExecutionContext): Promise<boolean>;
  protected requiresLogin(ctx: ExecutionContext): boolean;
  protected onAuthSuccess?(result: {
    ok: boolean;
    loginId?: string | undefined;
    token?: string | undefined;
    reason?: NotLoginType$1 | undefined;
  }, request: any): void | Promise<void>;
  protected onAuthFail?(result: {
    ok: boolean;
    loginId?: string | undefined;
    token?: string | undefined;
    reason?: NotLoginType$1 | undefined;
  }, request: any): void | Promise<void>;
  protected onPermissionDenied?(result: {
    ok: boolean;
    loginId?: string | undefined;
    token?: string | undefined;
    reason?: NotLoginType$1 | undefined;
  }, request: any): void | Promise<void>;
}
//#endregion
//#region src/exceptions/not-login.exception.d.ts
declare class NotLoginException extends UnauthorizedException {
  readonly type: NotLoginType$1;
  readonly token: string | undefined;
  constructor(type: NotLoginType$1, token?: string);
  private static describeType;
}
//#endregion
//#region src/exceptions/not-permission.exception.d.ts
declare class NotPermissionException extends ForbiddenException {
  readonly permission: string | string[];
  readonly mode: XltMode$1;
  constructor(permission: string | string[], mode: XltMode$1);
}
//#endregion
//#region src/exceptions/not-role.exception.d.ts
declare class NotRoleException extends ForbiddenException {
  readonly role: string | string[];
  readonly mode: XltMode$1;
  constructor(role: string | string[], mode: XltMode$1);
}
//#endregion
//#region src/exceptions/not-safe.exception.d.ts
declare class NotSafeException extends ForbiddenException {
  readonly business: string;
  constructor(business: string);
}
//#endregion
export { type AuthResult, type CreateOptions, DEFAULT_XLT_TOKEN_CONFIG, type DeviceInfo, type HttpContext, JwtStrategy, LoginId, MemoryStore, NotLoginException, NotLoginType, NotPermissionException, NotRoleException, NotSafeException, RedisStore, type StpInterface, StpLogic, StpPermLogic, StpUtil, type TokenStrategy, TokenValue, UuidStrategy, XLT_CHECK_SAFE_KEY, XLT_REDIS_CLIENT, XLT_STP_INTERFACE, XLT_TOKEN_CONFIG, XLT_TOKEN_HOOKS, XLT_TOKEN_STORE, XLT_TOKEN_STRATEGY, XltAbstractLoginGuard, XltCheckLogin, XltCheckPermission, XltCheckRole, XltCheckSafe, type XltHooks, XltIgnore, XltMode, XltSession, type XltTokenConfig, type XltTokenContext, XltTokenGuard, XltTokenModule, type XltTokenModuleAsyncOptions, type XltTokenModuleOptions, type XltTokenStore, createExpressContext, createMockHttpContext, createXltToken, matchPermission, setStpLogic, setStpPermLogic };
//# sourceMappingURL=index.d.mts.map