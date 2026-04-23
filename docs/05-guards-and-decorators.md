# 05 · 守卫与装饰器

两种内置守卫（`XltTokenGuard` / `XltAbstractLoginGuard`）+ 四个装饰器的完整说明。

## 守卫：怎么选？

| 场景 | 选用 |
| --- | --- |
| 只需 token 校验，配合 `@LoginId()` / `@TokenValue()` 拿数据 | **`XltTokenGuard`**（直接用） |
| 需要加载用户详情到 `request.user`、记审计日志、使用自定义元数据键 | **继承 `XltAbstractLoginGuard`** |
| 项目同时需要两种语义 | 全局只挂一个，另一个通过 `@UseGuards()` 局部使用 |

## `XltTokenGuard`（默认守卫）

**职责**：

1. 按 `defaultCheck` + `@XltIgnore` / `@XltCheckLogin` 决定是否需校验
2. 调 `StpLogic.checkLogin(request)`
3. 失败抛 `NotLoginException`（HTTP 401）
4. 成功后挂到 `request`：
   - `request.stpLoginId`
   - `request.stpToken`

**注册（全局）**：

```ts
import { APP_GUARD } from '@nestjs/core';
import { XltTokenGuard } from 'xlt-token';

@Module({
  providers: [{ provide: APP_GUARD, useClass: XltTokenGuard }],
})
export class AppModule {}
```

**局部使用**：

```ts
@UseGuards(XltTokenGuard)
@Controller('admin')
export class AdminController {}
```

**⚠️ 限制**：不会填充 `request.user`，不会调 Redis 校验业务会话。如果需要这些功能，继承下面的抽象守卫。

## `XltAbstractLoginGuard`（业务扩展基类）

抽象类，封装了 token 校验的完整流程，通过**钩子**让业务层接入会话加载、元数据自定义等能力，避免每个项目重复实现一个 `LoginGuard`。

### 构造函数

```ts
protected constructor(
  protected readonly reflector: Reflector,
  @Inject(XLT_TOKEN_CONFIG) protected readonly config: XltTokenConfig,
  protected readonly stpLogic: StpLogic,
)
```

三个依赖均为 `protected`，子类可直接访问。

### 执行流程

```
canActivate(ctx)
  ├─ requiresLogin(ctx)                    // 可重写
  │    └─ false → 放行
  ├─ stpLogic.checkLogin(request)
  ├─ !ok:
  │    ├─ onAuthFail?.(result, request)    // 可重写（钩子）
  │    └─ throw NotLoginException
  └─ ok:
       ├─ request.stpLoginId = result.loginId
       ├─ request.stpToken   = result.token
       └─ onAuthSuccess?.(result, request)  // 可重写（钩子）
```

### 可重写成员

| 成员 | 默认行为 | 用途 |
| --- | --- | --- |
| `requiresLogin(ctx)` | 按 `defaultCheck` + `@XltIgnore` / `@XltCheckLogin` 判定 | 改用项目自有元数据（如 `@RequireLogin`） |
| `onAuthSuccess(result, request)` | 空 | 校验通过后的业务钩子：加载用户信息到 `request.user`、刷新最近活跃时间等 |
| `onAuthFail(result, request)` | 空 | 抛异常前的钩子：结构化日志、埋点 |

### 完整示例（白名单 + Redis 加载用户）

```ts
import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { XltAbstractLoginGuard, XLT_TOKEN_CONFIG, XltTokenConfig, StpLogic } from 'xlt-token';
import { RedisService } from '@/config/modules/redis.service';
import { AppLogger } from '@/common/logger/app.logger.service';

@Injectable()
export class LoginGuard extends XltAbstractLoginGuard {
  constructor(
    reflector: Reflector,
    @Inject(XLT_TOKEN_CONFIG) config: XltTokenConfig,
    stpLogic: StpLogic,
    private readonly redis: RedisService,
    private readonly logger: AppLogger,
  ) {
    super(reflector, config, stpLogic);
  }

  /** 走项目自有的 @RequireLogin() 白名单 */
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
    this.logger.warn('auth.failed', {
      reason: result.reason,
      traceId: request.traceId,
    });
  }
}
```

注册为全局守卫（与 `XltTokenGuard` 二选一）：

```ts
@Module({
  providers: [{ provide: APP_GUARD, useClass: LoginGuard }],
})
export class AppModule {}
```

## 装饰器

### `@XltIgnore()`

**配合 `defaultCheck: true`（黑名单模式）放行某个路由**。

```ts
@XltIgnore()
@Post('login')
login() { /* ... */ }
```

可以加在方法或类上（类级别放行整个控制器）。

### `@XltCheckLogin()`

**配合 `defaultCheck: false`（白名单模式）开启校验**。

```ts
@XltCheckLogin()
@Get('me')
me() { /* ... */ }
```

### `@LoginId()`

注入 `request.stpLoginId`（字符串）。未登录时为 `undefined`。

```ts
@Get('me')
me(@LoginId() loginId: string) {
  return { loginId };
}
```

### `@TokenValue()`

注入 `request.stpToken`（字符串，已剥离 `Bearer ` 前缀）。

```ts
@Post('logout')
logout(@TokenValue() token: string) {
  return StpUtil.logout(token);
}
```

### 四个装饰器总览

| 装饰器 | 用在哪 | 作用 | 依赖什么 |
| --- | --- | --- | --- |
| `@XltIgnore()` | 方法 / 类 | `defaultCheck=true` 下放行 | Reflector 读元数据 |
| `@XltCheckLogin()` | 方法 / 类 | `defaultCheck=false` 下开启校验 | Reflector 读元数据 |
| `@LoginId()` | 参数 | 注入 `request.stpLoginId` | 守卫已校验通过 |
| `@TokenValue()` | 参数 | 注入 `request.stpToken` | 守卫已校验通过 |

⚠️ `@LoginId` / `@TokenValue` 依赖守卫挂到 `request` 上的字段。**如果你没注册全局守卫，或该路由没经过 Guard**（如标注了 `@XltIgnore()`），它们会是 `undefined`。

## 常见坑

- **全局守卫 + 登录接口本身**：一定要给 `/auth/login`、`/auth/captcha` 等加 `@XltIgnore()`（黑名单模式下），否则自己登录都会被 401。
- **`defaultCheck` 默认是 `true`**：新项目接入时，**没标任何装饰器的接口全部要登录**。
- **自定义 Guard 与 `XltTokenGuard` 不要同时挂成全局**：会重复校验，浪费 Redis 调用。

## 下一步

- 想知道各类 401 的具体 reason → [08-exceptions](./08-exceptions.md)
- 踢人/顶号完整流程 → [09-recipes](./09-recipes.md)
