# xlt-token 源码参考文档

> 版本：`0.1.3`
> 包名：`xlt-token`
> 简介：受 Sa-Token 启发的 NestJS Token 鉴权库，支持多种 Token 策略、可插拔存储（内存 / Redis）、装饰器与全局守卫。
> 源码路径：`src/`

---

## 目录

1. [架构设计](#一架构设计)
2. [快速上手（使用指南）](#二快速上手使用指南)
3. [模块注册 API（XltTokenModule）](#三模块注册-apixlttokenmodule)
4. [配置项（XltTokenConfig）](#四配置项xlttokenconfig)
5. [核心逻辑 API（StpLogic / StpUtil）](#五核心逻辑-apistplogic--stputil)
6. [存储层（XltTokenStore / MemoryStore / RedisStore）](#六存储层xlttokenstore--memorystore--redisstore)
7. [Token 策略（TokenStrategy / UuidStrategy）](#七token-策略tokenstrategy--uuidstrategy)
8. [守卫（XltTokenGuard）](#八守卫xlttokenguard)
9. [装饰器](#九装饰器)
10. [异常与常量](#十异常与常量)
11. [关键流程时序](#十一关键流程时序)
12. [目录结构速查](#十二目录结构速查)

---

## 一、架构设计

### 1.1 设计目标

- **无侵入**：以 NestJS Module/Guard/Decorator 方式集成，业务代码几乎无改动。
- **可替换**：Token 生成策略、存储后端均通过 DI Token 抽象，可自由替换。
- **双形态 API**：
  - **实例形态** `StpLogic`：构造函数注入，便于测试与 DI。
  - **静态门面** `StpUtil`：Service / 拦截器 / 异常过滤器等非 DI 场景直接调用。

### 1.2 分层

```
┌────────────────────────────────────────────┐
│  装饰器层   @XltIgnore / @XltCheckLogin     │
│             @LoginId / @TokenValue         │
├────────────────────────────────────────────┤
│  守卫层     XltTokenGuard（全局登录校验）    │
├────────────────────────────────────────────┤
│  门面层     StpUtil（静态方法）              │
│  业务层     StpLogic（核心引擎）             │
├────────────────────────────────────────────┤
│  抽象接口   TokenStrategy | XltTokenStore   │
├────────────────────────────────────────────┤
│  实现层     UuidStrategy                    │
│            MemoryStore | RedisStore        │
└────────────────────────────────────────────┘
```

### 1.3 核心概念

- **loginId**：业务层的用户唯一标识，由使用者在 `login()` 时传入，不能包含 `:`。
- **token**：由 `TokenStrategy` 生成的字符串，客户端持有。
- **三类存储键**（均以 `tokenName` 为前缀，见 `@/Volumes/weipengcheng/个人项目/tva/xlt-token/src/auth/stp-logic.ts:176-196`）：
  - `tokenKey`   = `${tokenName}:login:token:${token}`      → 值为 `loginId` 或状态标记（`BE_REPLACED` / `KICK_OUT`）
  - `sessionKey` = `${tokenName}:login:session:${loginId}` → 值为 `token`，用于反查当前 token、顶号
  - `lastActiveKey` = `${tokenName}:login:lastActive:${token}` → 值为最后活跃时间戳（毫秒），用于 `activeTimeout` 冻结判定

### 1.4 并发 / 共享语义

由 `isConcurrent` 与 `isShare` 组合决定登录行为（见 `@/Volumes/weipengcheng/个人项目/tva/xlt-token/src/auth/stp-logic.ts:37-44`）：

| isConcurrent | isShare | 行为                                                     |
| ------------ | ------- | -------------------------------------------------------- |
| `false`      | *       | 同 loginId 第二次登录 → 旧 token 置为 `BE_REPLACED`（顶号） |
| `true`       | `true`  | 同 loginId 复用旧 token（token 共享）                      |
| `true`       | `false` | 每次登录生成新 token，旧 token 仍然有效（多端并发）          |

---

## 二、快速上手（使用指南）

### 2.1 安装

```bash
pnpm add xlt-token
# 可选：使用 Redis 存储
pnpm add redis
```

### 2.2 最简集成（内存存储 + 默认 UUID 策略）

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { XltTokenModule, XltTokenGuard } from 'xlt-token';

@Module({
  imports: [
    XltTokenModule.forRoot({
      isGlobal: true,
      config: {
        tokenName: 'authorization',
        timeout: 7 * 24 * 60 * 60, // 7 天
        defaultCheck: true,        // 默认全部接口都要登录
      },
    }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: XltTokenGuard }, // 注册全局守卫
  ],
})
export class AppModule {}
```

### 2.3 登录 / 登出 / 接口使用

```ts
// auth.controller.ts
import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { StpUtil, XltIgnore, LoginId, TokenValue } from 'xlt-token';

@Controller('auth')
export class AuthController {
  @XltIgnore()           // 登录接口本身不需校验
  @Post('login')
  async login(@Body() dto: { username: string; password: string }) {
    // ... 校验账号密码，得到 userId
    const token = await StpUtil.login(dto.username);
    return { token };
  }

  @Post('logout')
  async logout(@TokenValue() token: string) {
    await StpUtil.logout(token);
    return { ok: true };
  }

  @Post('me')
  async me(@LoginId() loginId: string) {
    return { loginId };
  }
}
```

### 2.4 使用 Redis 存储

```ts
import { createClient } from 'redis';
import { XltTokenModule, RedisStore, XLT_REDIS_CLIENT } from 'xlt-token';

@Module({
  imports: [
    XltTokenModule.forRoot({
      isGlobal: true,
      store: { useClass: RedisStore },
      providers: [
        {
          provide: XLT_REDIS_CLIENT,
          useFactory: async () => {
            const client = createClient({ url: 'redis://localhost:6379' });
            await client.connect();
            return client;
          },
        },
      ],
    }),
  ],
})
export class AppModule {}
```

### 2.5 两种守卫模式

由 `defaultCheck` 决定默认行为（见 `@/Volumes/weipengcheng/个人项目/tva/xlt-token/src/guards/xlt-token.guard.ts:28-45`）：

- `defaultCheck: true`（推荐）→ 默认全部校验，使用 `@XltIgnore()` 放行。
- `defaultCheck: false` → 默认全部放行，使用 `@XltCheckLogin()` 开启校验。

---

## 三、模块注册 API（XltTokenModule）

来源：`@/Volumes/weipengcheng/个人项目/tva/xlt-token/src/xlt-token.module.ts`

### 3.1 `XltTokenModuleOptions`

| 字段        | 类型                                                     | 默认值                | 说明                                       |
| ----------- | -------------------------------------------------------- | --------------------- | ------------------------------------------ |
| `config`    | `Partial<XltTokenConfig>`                                | `DEFAULT_XLT_TOKEN_CONFIG` | 运行时配置，会与默认值合并                  |
| `store`     | `{ useClass }` \| `{ useValue }`                          | `MemoryStore`         | 存储实现，必须实现 `XltTokenStore` 接口      |
| `strategy`  | `{ useClass: new (...args) => TokenStrategy }`            | `UuidStrategy`        | Token 生成策略                              |
| `isGlobal`  | `boolean`                                                 | `false`               | 是否注册为全局模块                          |
| `providers` | `Provider[]`                                              | `[]`                  | 追加到模块的额外 Provider（如 Redis Client） |

### 3.2 `XltTokenModule.forRoot(options)`

同步注册。返回标准 `DynamicModule`，导出 `XLT_TOKEN_CONFIG` / `XLT_TOKEN_STORE` / `XLT_TOKEN_STRATEGY` / `StpLogic`。

### 3.3 `XltTokenModule.forRootAsync(options)`

```ts
export interface XltTokenModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: any[]) => Promise<XltTokenModuleOptions> | XltTokenModuleOptions;
  inject?: any[];
  store?: ...;
  strategy?: ...;
  isGlobal?: boolean;
  providers?: Provider[];
}
```

典型用法（从 `ConfigService` 读配置）：

```ts
XltTokenModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (cfg: ConfigService) => ({
    config: { timeout: cfg.get<number>('TOKEN_TTL') },
  }),
  store: { useClass: RedisStore },
});
```

### 3.4 初始化副作用

模块内部注册 `XLT_TOKEN_INIT` Provider，注入完成后会调用 `setStpLogic(stpLogic)`，令 `StpUtil` 静态门面能取到实例。因此 **必须确保 `XltTokenModule` 已被引入** 后，`StpUtil` 才可用。

---

## 四、配置项（XltTokenConfig）

来源：`@/Volumes/weipengcheng/个人项目/tva/xlt-token/src/core/xlt-token-config.ts`

```ts
export interface XltTokenConfig {
  tokenName: string;        // 读取 token 的 header/cookie/query key，也是存储 key 前缀
  timeout: number;          // 会话有效期（秒），-1 永不过期
  activeTimeout: number;    // 活跃过期（秒），-1 关闭；>0 时启用 lastActive 机制
  isConcurrent: boolean;    // 是否允许同账号多端在线
  isShare: boolean;         // 多端在线时是否共享同一 token（isConcurrent=true 时生效）
  tokenStyle: 'uuid' | 'simple-uuid' | 'random-32';
  isReadHeader: boolean;    // 是否从 header 读取 token
  isReadCookie: boolean;    // 是否从 cookie 读取
  isReadQuery: boolean;     // 是否从 query 读取
  tokenPrefix: string;      // header 中 token 前缀，例如 'Bearer '
  defaultCheck: boolean;    // 守卫默认是否校验登录
}
```

**默认值**：

```ts
{
  tokenName: 'authorization',
  timeout: 2592000,         // 30 天
  activeTimeout: -1,
  isConcurrent: true,
  isShare: true,
  tokenStyle: 'uuid',
  isReadHeader: true,
  isReadCookie: false,
  isReadQuery: false,
  tokenPrefix: 'Bearer ',
  defaultCheck: true,
}
```

**DI Tokens**：

- `XLT_TOKEN_CONFIG` → 配置对象
- `XLT_TOKEN_STORE` → 存储实现
- `XLT_TOKEN_STRATEGY` → Token 策略

---

## 五、核心逻辑 API（StpLogic / StpUtil）

### 5.1 `StpLogic`

来源：`@/Volumes/weipengcheng/个人项目/tva/xlt-token/src/auth/stp-logic.ts`

通过 DI 获取：

```ts
constructor(private readonly stp: StpLogic) {}
```

#### 方法列表

| 方法 | 签名 | 说明 |
| ---- | ---- | ---- |
| `login` | `(loginId: string \| number, options?: { timeout?; device?; token? }) => Promise<string>` | 登录并返回纯 token（不含前缀）。`loginId` 不能为空或包含 `:`。 |
| `getTokenValue` | `(req: Request) => Promise<string \| null>` | 按 `isReadHeader / Cookie / Query` 顺序提取 token，并去除 `tokenPrefix`。 |
| `isLogin` | `(req: Request) => Promise<boolean>` | 判断请求是否登录，不抛异常。 |
| `checkLogin` | `(req: Request) => Promise<{ ok; loginId?; token?; reason? }>` | 未登录抛 `NotLoginException`。 |
| `logout` | `(token: string) => Promise<boolean \| null>` | 按 token 登出。token 不存在返回 `null`。 |
| `logoutByLoginId` | `(loginId: string) => Promise<boolean \| null>` | 按 loginId 登出。 |
| `kickout` | `(loginId: string) => Promise<boolean \| null>` | 踢人下线：将 tokenKey 值置为 `KICK_OUT`，触发时返回 `KICK_OUT` 异常。 |
| `renewTimeout` | `(token: string, timeout: number) => Promise<boolean \| null>` | 续签 token / session / lastActive 的过期时间。 |

#### `_resolveLoginId` 判定顺序（内部）

1. 取不到 token → `NOT_TOKEN`
2. tokenKey 查不到 → `INVALID_TOKEN`
3. tokenKey 值为 `BE_REPLACED` → 已被顶下线
4. tokenKey 值为 `KICK_OUT` → 已被踢
5. 开启 `activeTimeout`：
   - 无 lastActive → `TOKEN_FREEZE`
   - 闲置超过 `activeTimeout` 秒 → `TOKEN_TIMEOUT`
   - 否则刷新 lastActive 时间戳

### 5.2 `StpUtil`（静态门面）

来源：`@/Volumes/weipengcheng/个人项目/tva/xlt-token/src/auth/stp-util.ts`

与 `StpLogic` 同名的静态方法，另加：

- `StpUtil.getLoginId(req)` → 直接返回当前 loginId 字符串或 `null`
- `setStpLogic(stpLogic)` / `setModuleRef(moduleRef)` → 模块内部初始化用

> 未初始化或 `XltTokenModule` 未引入时调用任何 `StpUtil` 方法会抛出：
> `StpLogic not initialized. Please ensure XltTokenModule is imported correctly.`

---

## 六、存储层（XltTokenStore / MemoryStore / RedisStore）

### 6.1 `XltTokenStore` 接口

来源：`@/Volumes/weipengcheng/个人项目/tva/xlt-token/src/store/xlt-token-store.interface.ts`

```ts
interface XltTokenStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, timeoutSec: number): Promise<void>;  // timeoutSec = -1 永不过期
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  update(key: string, value: string): Promise<void>;                    // 只改值，不动 TTL，key 不存在抛错
  updateTimeout(key: string, timeoutSec: number): Promise<void>;        // 只改 TTL
  getTimeout(key: string): Promise<number>;                             // -1 永久，-2 不存在，>0 秒数
}
```

### 6.2 `MemoryStore`

来源：`@/Volumes/weipengcheng/个人项目/tva/xlt-token/src/store/memory-store.ts`

- 基于 `Map<string, MemoryEntry>` 实现。
- 采用 **惰性过期 + setTimeout** 双重机制：
  - `setTimeout` 到期自动删除；
  - `peek()` 每次读取前做一次过期校验，兜底定时器漂移。
- `setTimeout` delay 上限 `2^31 - 1` 毫秒（约 24.8 天），超过则仅依赖惰性过期，避免 Node.js 警告。
- 定时器 `.unref()`，不阻塞进程退出。
- **适用范围**：单进程、开发 / 测试、小流量。**多实例请换 Redis**。

### 6.3 `RedisStore`

来源：`@/Volumes/weipengcheng/个人项目/tva/xlt-token/src/store/redis-store.ts`

- 需注入 `XLT_REDIS_CLIENT`，兼容 `redis@4` / `redis@5` 客户端 API。
- 语义映射：
  - `set(key, val, -1)` → `SET key val`
  - `set(key, val, n)` → `SET key val EX n`
  - `update` → `SET key val XX KEEPTTL`（保留 TTL）
  - `updateTimeout(-1)` → `PERSIST`
  - `updateTimeout(n)`  → `EXPIRE key n`
  - `getTimeout` → `TTL`（返回值与接口约定一致：`-2` / `-1` / `>0`）

---

## 七、Token 策略（TokenStrategy / UuidStrategy）

来源：
- `@/Volumes/weipengcheng/个人项目/tva/xlt-token/src/token/token-strategy.interface.ts`
- `@/Volumes/weipengcheng/个人项目/tva/xlt-token/src/token/uuid-strategy.ts`

```ts
interface TokenStrategy {
  generateToken(payload: any): string;   // 自由扩展（如 JWT）
  verifyToken(token: string): any;       // 自由扩展
  createToken(loginId: string, config: XltTokenConfig): string; // 供 StpLogic 调用
}
```

### `UuidStrategy` 支持的 `tokenStyle`

| `tokenStyle`    | 输出示例                                   | 说明                          |
| --------------- | ------------------------------------------ | ----------------------------- |
| `uuid`          | `550e8400-e29b-41d4-a716-446655440000`     | `randomUUID()`，带连字符       |
| `simple-uuid`   | `550e8400e29b41d4a716446655440000`          | 去连字符                       |
| `random-32`     | `f1a3...` 32 字符十六进制                  | `randomBytes(16).toString('hex')`，128 bit 强随机，**推荐** |

> 自定义策略：实现 `TokenStrategy` 并通过 `XltTokenModule.forRoot({ strategy: { useClass: MyStrategy } })` 注册。可用于接入 JWT。

---

## 八、守卫（XltTokenGuard / XltAbstractLoginGuard）

### 8.1 `XltTokenGuard`（零配置开箱即用）

来源：`@/Volumes/weipengcheng/个人项目/tva/xlt-token/src/guards/xlt-token.guard.ts`

- 使用 `Reflector` 读取 `@XltIgnore` / `@XltCheckLogin` 元数据。
- 校验通过后将结果挂载到 `request`：
  - `request.stpLoginId`
  - `request.stpToken`
- 校验失败抛出 `NotLoginException`（继承 `UnauthorizedException`，HTTP 401）。
- 不感知任何业务数据（不会填充 `request.user`）。

注册方式（任选其一）：

```ts
// 1. 全局（推荐）
providers: [{ provide: APP_GUARD, useClass: XltTokenGuard }]

// 2. 控制器 / 方法级
@UseGuards(XltTokenGuard)
```

### 8.2 `XltAbstractLoginGuard`（业务可扩展基类）

来源：`@/Volumes/weipengcheng/个人项目/tva/xlt-token/src/guards/xlt-abstract-login.guard.ts`

抽象类，封装了 token 校验的完整流程，通过**钩子**让业务层接入会话加载、元数据自定义等能力，避免每个项目重复实现一个 `LoginGuard`。

#### 构造函数（子类需 super 调用）

```ts
protected constructor(
  protected readonly reflector: Reflector,
  @Inject(XLT_TOKEN_CONFIG) protected readonly config: XltTokenConfig,
  protected readonly stpLogic: StpLogic,
)
```

三个依赖均为 `protected`，子类可直接访问。

#### 执行流程（`canActivate`）

```
canActivate
  ├─ requiresLogin(ctx)                    // 可重写
  │   └─ 返回 false → 放行
  ├─ stpLogic.checkLogin(request)
  ├─ result.ok === false:
  │     ├─ onAuthFail?.(result, request)   // 可重写
  │     └─ throw NotLoginException(reason ?? NOT_TOKEN)
  └─ result.ok === true:
        ├─ request.stpLoginId = result.loginId
        ├─ request.stpToken   = result.token
        └─ onAuthSuccess?.(result, request) // 可重写
```

#### 可重写成员

| 成员 | 默认行为 | 用途 |
| --- | --- | --- |
| `requiresLogin(ctx)` | 按 `defaultCheck` + `@XltIgnore` / `@XltCheckLogin` 判定 | 替换为项目自有元数据（如 `@RequireLogin`） |
| `onAuthSuccess(result, request)` | 空 | 校验通过后的业务钩子：加载用户信息到 `request.user`、刷新最近活跃时间、审计日志等 |
| `onAuthFail(result, request)` | 空 | 抛 `NotLoginException` 之前的钩子：结构化日志、降级埋点等 |

#### 推荐的子类骨架

```ts
@Injectable()
export class LoginGuard extends XltAbstractLoginGuard {
  constructor(
    reflector: Reflector,
    @Inject(XLT_TOKEN_CONFIG) config: XltTokenConfig,
    stpLogic: StpLogic,
    private readonly redis: RedisService,        // 业务依赖
    private readonly logger: AppLogger,
  ) {
    super(reflector, config, stpLogic);
  }

  protected requiresLogin(ctx: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>('requireLogin', [
        ctx.getClass(),
        ctx.getHandler(),
      ]) ?? false
    );
  }

  protected async onAuthSuccess(result, request) {
    const userRecord = await this.redis.get(`user_info:${result.loginId}`);
    if (!userRecord) throw new UnauthorizedException('用户会话已失效');
    request.user = {
      userId: userRecord.id,
      username: userRecord.username,
      roles: userRecord.roles,
      permissions: userRecord.permissions,
    };
  }

  protected async onAuthFail(result, request) {
    this.logger.warn('auth.failed', { reason: result.reason, traceId: request.traceId });
  }
}
```

#### 选型建议

| 场景 | 选用 |
| --- | --- |
| 仅需 token 校验，通过 `@LoginId()` / `@TokenValue()` 拿数据 | `XltTokenGuard` |
| 需要把用户信息挂到 `request.user`、接自定义权限系统、自定义元数据 | 继承 `XltAbstractLoginGuard` |
| 两套语义并存 | 只注册一个全局守卫，另一方通过 `@UseGuards` 局部使用 |

---

## 九、装饰器

全部来源：`@/Volumes/weipengcheng/个人项目/tva/xlt-token/src/decorators/`

| 装饰器 | 位置 | 作用 |
| ------ | ---- | ---- |
| `@XltIgnore()` | 方法 / 类 | `defaultCheck=true` 模式下放行该路由 |
| `@XltCheckLogin()` | 方法 / 类 | `defaultCheck=false` 模式下开启校验 |
| `@LoginId()` | 参数 | 注入 `request.stpLoginId`（字符串） |
| `@TokenValue()` | 参数 | 注入 `request.stpToken`（字符串） |

示例：

```ts
@Controller('user')
export class UserController {
  @XltIgnore()
  @Get('public')
  pub() { return 'ok'; }

  @Get('me')
  me(@LoginId() id: string, @TokenValue() token: string) {
    return { id, token };
  }
}
```

---

## 十、异常与常量

### 10.1 `NotLoginException`

来源：`@/Volumes/weipengcheng/个人项目/tva/xlt-token/src/exceptions/not-login.exception.ts`

- 继承 `UnauthorizedException`，HTTP 状态码 `401`。
- 响应体：`{ statusCode: 401, type, message }`。
- 附加属性：`type: NotLoginType`、`token?: string`。

### 10.2 `NotLoginType`

来源：`@/Volumes/weipengcheng/个人项目/tva/xlt-token/src/const/index.ts`

| 常量 | 值 | 触发场景 | 默认中文 message |
| ---- | --- | -------- | ---------------- |
| `NOT_TOKEN` | `'NOT_TOKEN'` | 请求未携带 token | 未提供 Token |
| `INVALID_TOKEN` | `'INVALID_TOKEN'` | 服务端 tokenKey 不存在 | Token 无效 |
| `TOKEN_TIMEOUT` | `'TOKEN_TIMEOUT'` | `activeTimeout` 判定闲置过期 | Token 已过期 |
| `TOKEN_FREEZE` | `'TOKEN_FREEZE'` | lastActive 键丢失 | Token 已被冻结 |
| `BE_REPLACED` | `'BE_REPLACED'` | 被顶号（`isConcurrent=false` 二次登录） | 已被顶下线 |
| `KICK_OUT` | `'KICK_OUT'` | `kickout()` 主动踢人 | 已被踢下线 |

### 10.3 元数据 Key

- `XLT_IGNORE_KEY = 'XltIgnore'`
- `XLT_CHECK_LOGIN_KEY = 'XltCheckLogin'`

---

## 十一、关键流程时序

### 11.1 登录 `login(loginId)`

```
StpLogic.login
  ├─ 校验 loginId（非空、不含 ':'）
  ├─ 取 sessionKey(loginId) → oldToken
  ├─ 决策分支:
  │    ├─ !isConcurrent          → 若 oldToken 存在，旧 tokenKey 置 BE_REPLACED；生成新 token
  │    ├─ isConcurrent & isShare → oldToken 存在则复用；否则生成新 token
  │    └─ isConcurrent & !isShare → 直接生成新 token
  ├─ store.set(tokenKey,   loginId, timeout)
  ├─ store.set(sessionKey, token,   timeout)
  ├─ 若 activeTimeout > 0:
  │    store.set(lastActiveKey, now_ms, timeout)
  └─ return token（纯字符串，客户端自行拼 "Bearer "）
```

### 11.2 请求校验 `XltTokenGuard.canActivate`

```
Guard.canActivate
  ├─ 读 defaultCheck + @XltIgnore / @XltCheckLogin → 是否需校验
  ├─ 否 → 直接放行
  └─ 是 → StpLogic.checkLogin(req)
         └─ _resolveLoginId:
              ├─ getTokenValue (header/cookie/query)
              ├─ store.get(tokenKey)
              ├─ 值为 BE_REPLACED / KICK_OUT → 抛异常
              ├─ activeTimeout 校验（lastActive 存在 + 未超时 + 刷新）
              └─ 成功 → 挂载 request.stpLoginId / stpToken
```

### 11.3 踢人 `kickout(loginId)`

```
StpLogic.kickout
  ├─ store.get(sessionKey(loginId)) → token
  ├─ store.update(tokenKey(token), 'KICK_OUT')  // 保留 TTL，只改值
  └─ store.delete(sessionKey(loginId))
```

对应被踢用户下次请求会命中 `_resolveLoginId` 的 `KICK_OUT` 分支并抛 `NotLoginException`。

---

## 十二、目录结构速查

```
src/
├── index.ts                        // 统一导出入口
├── xlt-token.module.ts             // NestJS 动态模块（forRoot / forRootAsync）
├── core/
│   └── xlt-token-config.ts         // 配置类型 + 默认值 + DI Tokens
├── auth/
│   ├── stp-logic.ts                // 核心引擎（DI 实例）
│   ├── stp-util.ts                 // 静态门面
│   ├── stp-logic.spec.ts
│   └── ...
├── store/
│   ├── xlt-token-store.interface.ts
│   ├── memory-store.ts             // 内存实现（惰性过期 + setTimeout）
│   ├── redis-store.ts              // Redis 实现（依赖 XLT_REDIS_CLIENT）
│   └── *.spec.ts
├── token/
│   ├── token-strategy.interface.ts
│   ├── uuid-strategy.ts            // uuid / simple-uuid / random-32
│   └── uuid-strategy.spec.ts
├── guards/
│   ├── xlt-token.guard.ts          // 默认全局登录守卫
│   └── xlt-abstract-login.guard.ts // 业务可扩展的抽象守卫基类
├── decorators/
│   ├── xlt-check-login.decorator.ts
│   ├── xlt-ignore.decorator.ts
│   ├── login-id.decorator.ts
│   └── token-value.decorator.ts
├── exceptions/
│   └── not-login.exception.ts      // 401 未登录异常
└── const/
    └── index.ts                    // NotLoginType 等常量
```

---

## 附：从 `src/index.ts` 导出的公共 API 一览

| 分类 | 导出项 |
| ---- | ------ |
| 模块 | `XltTokenModule`, `XltTokenModuleOptions`, `XltTokenModuleAsyncOptions` |
| 核心 | `StpLogic`, `StpUtil` |
| 配置 | `XltTokenConfig`, `DEFAULT_XLT_TOKEN_CONFIG`, `XLT_TOKEN_CONFIG`, `XLT_TOKEN_STORE`, `XLT_TOKEN_STRATEGY` |
| 存储 | `XltTokenStore`, `MemoryStore`, `RedisStore`, `XLT_REDIS_CLIENT` |
| 策略 | `TokenStrategy`, `UuidStrategy` |
| 装饰器 | `XltCheckLogin`, `XltIgnore`, `LoginId`, `TokenValue` |
| 守卫 | `XltTokenGuard`, `XltAbstractLoginGuard` |
| 异常 | `NotLoginException` |
| 常量 | `NotLoginType` |
