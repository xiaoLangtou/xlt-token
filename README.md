# xlt-token

> 框架无关 Token 鉴权库，灵感来源于 Sa-Token。核心 `@xlt-token/core` 零框架依赖；NestJS 适配 `@xlt-token/nestjs` 一行接入。

[![npm version](https://badge.fury.io/js/xlt-token.svg)](https://www.npmjs.com/package/xlt-token)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docs](https://img.shields.io/badge/docs-online-16a34a?logo=vitepress&logoColor=white)](https://xiaolangtou.github.io/xlt-token/)

📖 **在线文档**: https://xiaolangtou.github.io/xlt-token/

xlt-token 是一个轻量级 token 认证库，提供灵活的 token 管理、会话控制、多端登录、权限校验，以及可插拔的存储与策略。鉴权语义集中在 `@xlt-token/core`；Redis 实现在 `@xlt-token/store-redis`；JWT 策略在 `@xlt-token/jwt`；NestJS 集成（Module、Guard、Decorator）在 `@xlt-token/nestjs`。

## 特性

- 🧩 **核心 + 实现 + 适配器** - Core、Redis Store 与框架适配器按包解耦
- 🔐 **灵活的 Token 管理** - 支持登录、登出、续签、踢人下线等完整生命周期
- 🌐 **多端登录** - 支持按 `device` 独立会话，可配置互踢 / 顶号 / 共享 token
- 💾 **内置存储** - 内置内存存储和 Redis 存储实现，开箱即用
- 🎨 **Token 策略** - UUID / Simple UUID / 随机字符串，以及 JWT 策略（jti 黑名单）
- 🔒 **二级认证** - Safe 安全窗口 + `@XltCheckSafe`，适用于支付确认等敏感操作
- 📡 **审计事件** - 登录 / 刷新 / 踢人 / 顶号 / 登出事件脱敏投递，支持在线用户查询
- 🛡️ **全局守卫** - 黑名单 / 白名单双模式，默认安全
- 🧩 **可扩展守卫** - `XltAbstractLoginGuard` 抽象基类，通过 `onAuthSuccess` / `onAuthFail` 注入业务会话
- 🎯 **声明式装饰器** - `@XltIgnore` / `@XltCheckLogin` / `@LoginId` / `@TokenValue` / `@XltCheckPermission` / `@XltCheckRole` / `@XltCheckSafe`
- 🔑 **权限 / 角色校验** - `StpPermLogic` 引擎，支持 AND / OR 模式 + 通配符匹配（`user:*`）
- 🗂️ **会话对象** - `XltSession` 承载登录期间扩展数据，与 token 同生命周期
- 📜 **下线追溯** - 被踢 / 被顶后可查询下线时间和原因
- 🔧 **零业务依赖** - 纯粹的认证库，不依赖任何业务代码
- 📦 **TypeScript** - 完整的类型定义
- ⚡ **静态门面** - `StpUtil` 静态方法，无需注入即可使用
- 🧪 **质量保障** - 332 个测试用例（253 core 单测 + 79 E2E），core 单测覆盖率 98%+

## 安装

**推荐**（显式依赖分包）：

```bash
pnpm add @xlt-token/nestjs
# 或
npm install @xlt-token/nestjs
```

**兼容写法**（`xlt-token` 根包 re-export `@xlt-token/nestjs`，旧项目可继续 `import from 'xlt-token'`）：

```bash
pnpm add xlt-token
```

Redis 存储按客户端选择安装：

```bash
pnpm add @xlt-token/store-redis redis
# 或
pnpm add @xlt-token/store-redis ioredis
```

其他可选依赖：

```bash
pnpm add @xlt-token/jwt jsonwebtoken       # JwtStrategy
```

## 包结构

| 包 | 职责 | 典型 import |
| --- | --- | --- |
| `@xlt-token/core` | 鉴权引擎、HttpContext、Store / Strategy 契约、审计事件 | `createXltToken`, `StpLogic`, `MemoryStore` |
| `@xlt-token/store-redis` | 框架无关的 node-redis / ioredis Store | `RedisStore`, `IORedisStore` |
| `@xlt-token/jwt` | kid 密钥轮换 JWT 策略 | `JwtStrategy`, `createJwtStrategyConfig` |
| `@xlt-token/nestjs` | Module、Guard、Decorator | `XltTokenModule`, `XltTokenGuard`, `@LoginId()` |
| `@xlt-token/express` | Express 中间件、路由策略、错误处理 | `xltMiddleware`, `xltErrorHandler` |
| `xlt-token` | 兼容包，等价于 `@xlt-token/nestjs` | `XltTokenModule`, `StpUtil` |

- NestJS 集成 → `@xlt-token/nestjs`（或 `xlt-token`）
- 框架无关核心（Express 中间件、脚本、自定义适配）→ `@xlt-token/core`

## 快速开始

### 1. 注册模块

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { XltTokenModule, XltTokenGuard } from '@xlt-token/nestjs';

@Module({
  imports: [
    XltTokenModule.forRoot({
      isGlobal: true,
      config: {
        tokenName: 'authorization',
        timeout: 2592000,      // 30 天
        tokenStyle: 'uuid',
        tokenPrefix: 'Bearer ',
      },
    }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: XltTokenGuard }, // 全局登录校验
  ],
})
export class AppModule {}
```

默认 `defaultCheck: true` → 所有路由都需要登录，使用 `@XltIgnore()` 放行公开接口。

### 2. 登录

```ts
// auth.service.ts
import { Injectable } from '@nestjs/common';
import { StpLogic } from '@xlt-token/nestjs';

@Injectable()
export class AuthService {
  constructor(private readonly stpLogic: StpLogic) {}

  async login(userId: string) {
    const token = await this.stpLogic.login(userId);
    return { token };
  }
}
```

### 3. 使用守卫

```ts
// user.controller.ts
import { Controller, Get, Post } from '@nestjs/common';
import { XltIgnore, LoginId } from '@xlt-token/nestjs';

@Controller('user')
export class UserController {
  @XltIgnore()  // 忽略登录校验
  @Post('login')
  async login() {
    // 登录逻辑
  }

  @Get('profile')
  async getProfile(@LoginId() loginId: string) {
    return { userId: loginId };
  }
}
```

### 4. 使用静态门面（可选）

```ts
import { StpUtil } from '@xlt-token/nestjs';

// 无需注入，直接调用
const token = await StpUtil.login(userId);
const loginId = await StpUtil.getLoginId(req);
```

### 5. 框架无关用法（可选）

非 NestJS 场景（Express 中间件、脚本等）可直接使用 core：

```ts
import { createXltToken, MemoryStore, createExpressContext } from '@xlt-token/core';

const xlt = createXltToken({ store: new MemoryStore() });

app.use(async (req, res, next) => {
  const ctx = createExpressContext(req, res);
  if (await xlt.stpLogic.isLogin(ctx)) {
    req.userId = ctx.state.stpLoginId;
  }
  next();
});
```

## 配置选项

### XltTokenModule.forRoot()

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `config` | `Partial<XltTokenConfig>` | - | 配置选项（见下表） |
| `store` | `{ useClass } \| { useValue }` | `MemoryStore` | 存储实现；Redis Store 从独立包安装 |
| `strategy` | `{ useClass } \| { useValue }` | `UuidStrategy` | Token 策略（UUID 策略或 `@xlt-token/jwt` 的 `JwtStrategy` 实例） |
| `isGlobal` | `boolean` | `false` | 是否全局模块 |
| `stpInterface` | `class` | 内置 stub | 权限 / 角色数据源 |
| `eventSink` | `XltEventSink` | - | 接收脱敏审计事件，用于日志、指标和消息推送 |
| `providers` | `Provider[]` | `[]` | 追加 Provider（如 `XLT_REDIS_CLIENT`） |

### XltTokenConfig

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `tokenName` | `string` | `'authorization'` | HTTP header / cookie / query 中读取 token 的键名 |
| `timeout` | `number` | `2592000` (30 天) | token 有效期（秒），`-1` 表示永不过期 |
| `activeTimeout` | `number` | `-1` | 滑动过期秒数，`-1` 表示不启用 |
| `isConcurrent` | `boolean` | `true` | 是否允许同账号多端同时在线 |
| `isShare` | `boolean` | `true` | 同账号多次登录是否共享同一 token |
| `deviceConcurrent` | `boolean` | `true` | 是否允许不同 `device` 共存 |
| `tokenStyle` | `'uuid' \| 'simple-uuid' \| 'random-32'` | `'uuid'` | token 格式（UUID 策略下生效） |
| `isReadHeader` | `boolean` | `true` | 是否从 HTTP Header 读取 token |
| `isReadCookie` | `boolean` | `false` | 是否从 Cookie 读取 |
| `isReadQuery` | `boolean` | `false` | 是否从 URL Query 读取 |
| `tokenPrefix` | `string` | `'Bearer '` | Header 中 token 的前缀（读取时自动剥离） |
| `defaultCheck` | `boolean` | `true` | 全局守卫默认模式：`true`=黑名单，`false`=白名单 |
| `offlineRecordEnabled` | `boolean` | `false` | 是否记录被踢 / 被顶的下线原因 |
| `offlineRecordTimeout` | `number` | `3600` | 下线记录保留秒数 |
| `permCacheTimeout` | `number` | `0` | 权限 / 角色列表缓存秒数（`0` = 不缓存） |
| `tokenLifecycle` | `TokenLifecycleConfig` | - | refresh token 轮转、复用检测与 token family 生命周期配置 |

## API 文档

> 完整 API 见 [在线文档 · 核心 API](https://xiaolangtou.github.io/xlt-token/core/core-api)。

### StpLogic

| 方法 | 参数 | 返回值 | 说明 |
|---|---|---|---|
| `login(loginId, options?)` | `loginId: string \| number`, `options: { timeout?, device?, token? }` | `Promise<string>` | 登录，返回 token |
| `logout(token)` | `token: string` | `Promise<boolean \| null>` | 登出（通过 token） |
| `logoutByLoginId(loginId)` | `loginId: string` | `Promise<boolean \| null>` | 登出（通过 loginId） |
| `kickout(loginId)` | `loginId: string` | `Promise<boolean \| null>` | 踢人下线 |
| `renewTimeout(token, timeout)` | `token: string`, `timeout: number` | `Promise<boolean \| null>` | 续签 token |
| `isLogin(req)` | `req: Request` | `Promise<boolean>` | 判断是否登录 |
| `checkLogin(req)` | `req: Request` | `Promise<{ ok, loginId?, token?, reason? }>` | 校验登录（未登录抛异常） |
| `getTokenValue(req)` | `req: Request` | `Promise<string \| null>` | 获取 token 值 |
| `openSafe(token, business, timeout)` | - | `Promise<void>` | 打开二级认证安全窗口 |
| `checkSafe(token, business)` | - | `Promise<void>` | 校验安全窗口（无效抛 `NotSafeException`） |
| `closeSafe(token, business)` | - | `Promise<void>` | 关闭安全窗口 |

### StpUtil（静态门面）

所有方法与 `StpLogic` 相同，但无需注入，直接静态调用：

```ts
import { StpUtil } from '@xlt-token/nestjs';

const token = await StpUtil.login(userId);
await StpUtil.logout(token);
await StpUtil.kickout(userId);
await StpUtil.renewTimeout(token, 3600);

const isLogin = await StpUtil.isLogin(req);
const loginId = await StpUtil.getLoginId(req);
const tokenValue = await StpUtil.getTokenValue(req);
```

### 装饰器

| 装饰器 | 作用 | 参数 |
|---|---|---|
| `@XltIgnore()` | 忽略登录校验（黑名单模式下放行） | 无 |
| `@XltCheckLogin()` | 强制校验登录（白名单模式下开启） | 无 |
| `@LoginId()` | 注入当前登录用户 ID（参数装饰器） | 无 |
| `@TokenValue()` | 注入当前 token 值（参数装饰器） | 无 |
| `@XltCheckPermission(perms, options?)` | 校验权限 | `perms: string \| string[]`，`options?: { mode: XltMode }` |
| `@XltCheckRole(roles, options?)` | 校验角色 | `roles: string \| string[]`，`options?: { mode: XltMode }` |
| `@XltCheckSafe(business)` | 校验二级认证安全窗口 | `business: string` |

### 权限 / 角色校验

#### 1. 实现 `StpInterface` 业务接口

```ts
// stp.service.ts
import { Injectable } from '@nestjs/common';
import { StpInterface } from '@xlt-token/nestjs';

@Injectable()
export class StpService implements StpInterface {
  async getPermissionList(loginId: string): Promise<string[]> {
    return ['user:read', 'user:write', 'order:*'];
  }

  async getRoleList(loginId: string): Promise<string[]> {
    return ['admin'];
  }
}
```

#### 2. 注册到 Module

```ts
XltTokenModule.forRoot({
  isGlobal: true,
  stpInterface: StpService,
})
```

#### 3. 在 Controller 上使用

```ts
import { XltCheckPermission, XltCheckRole, XltMode } from '@xlt-token/nestjs';

@Controller('order')
export class OrderController {
  @XltCheckPermission('order:read')
  @Get()
  list() {}

  @XltCheckPermission(['order:read', 'order:write'], { mode: XltMode.AND })
  @Post()
  create() {}

  @XltCheckRole(['admin', 'super'], { mode: XltMode.OR })
  @Delete(':id')
  remove() {}
}
```

权限校验失败抛出 `NotPermissionException`（HTTP **403**），角色校验失败抛 `NotRoleException`（HTTP **403**）。

### JWT 策略

xlt-token 的 JWT 模式是「**有状态 JWT**」——JWT 携带身份，Store 负责踢人、顶号、多端索引：

```ts
import { createJwtStrategyConfig, JwtStrategy } from '@xlt-token/jwt';
import { XltTokenModule } from '@xlt-token/nestjs';

const jwtStrategy = new JwtStrategy(
  createJwtStrategyConfig({
    keys: [
      {
        kid: '2026-07',
        alg: 'HS256',
        secret: process.env.JWT_SECRET!,
        status: 'active',
      },
    ],
  }),
);

XltTokenModule.forRoot({
  strategy: { useValue: jwtStrategy },
  config: {
    timeout: 86400,
  },
})
```

详见 [JWT 策略文档](https://xiaolangtou.github.io/xlt-token/core/jwt-strategy)。

### 二级认证（Safe）

用户在已登录后，还需完成额外验证才能在有限时间窗口内执行敏感操作：

```ts
import { StpUtil, XltCheckSafe, TokenValue } from '@xlt-token/nestjs';

// 验证通过后打开安全窗口
await StpUtil.openSafe(token, 'pay', 300);

// 装饰器自动校验
@XltCheckSafe('pay')
@Post('transfer')
transfer() {}
```

详见 [二级认证文档](https://xiaolangtou.github.io/xlt-token/core/secondary-auth)。

### 审计事件与观测性

通过 `forRoot({ eventSink })` 注册事件接收器，用于审计日志、指标和消息推送。事件只包含 token 指纹，不暴露原始 token：

```ts
XltTokenModule.forRoot({
  eventSink: {
    emit: async (event) => {
      logger.info({
        type: event.type,
        loginId: event.loginId,
        device: event.device,
        tokenFingerprint: event.tokenFingerprint,
      });
    },
  },
})
```

详见 [审计事件文档](https://xiaolangtou.github.io/xlt-token/core/hooks-and-observability)。

### 会话管理（XltSession）

```ts
import { StpUtil } from '@xlt-token/nestjs';

const session = StpUtil.getSession(loginId);
await session.set('nickname', 'xlt');
const nickname = await session.get<string>('nickname');
```

### 下线原因追溯

```ts
const record = await StpUtil.getOfflineReason(token);
// { reason: 'KICK_OUT' | 'BE_REPLACED', time: 1714112400000 }
```

### 异常处理

| 异常 | HTTP 状态 | 触发场景 |
| --- | --- | --- |
| `NotLoginException` | 401 | 未登录 / token 无效 / 被顶 / 被踢 / 冻结 / 超时 |
| `NotPermissionException` | 403 | `@XltCheckPermission` 校验失败 |
| `NotRoleException` | 403 | `@XltCheckRole` 校验失败 |
| `NotSafeException` | 403 | `@XltCheckSafe` / `checkSafe` 校验失败 |

`NotLoginException` 提供 `NotLoginType` 常量用于区分登录失败场景：

```ts
import { NotLoginException, NotLoginType } from '@xlt-token/nestjs';

try {
  await stpLogic.checkLogin(req);
} catch (e) {
  if (e instanceof NotLoginException) {
    switch (e.message) {
      case NotLoginType.NOT_TOKEN: break;
      case NotLoginType.INVALID_TOKEN: break;
      case NotLoginType.TOKEN_TIMEOUT: break;
      case NotLoginType.TOKEN_FREEZE: break;
      case NotLoginType.BE_REPLACED: break;
      case NotLoginType.KICK_OUT: break;
    }
  }
}
```

### 使用 Redis 存储

完整说明见 [Redis Store 文档](https://xiaolangtou.github.io/xlt-token/store-redis/)。

```ts
import { Module } from '@nestjs/common';
import { XltTokenModule } from '@xlt-token/nestjs';
import { RedisStore } from '@xlt-token/store-redis';
import { createClient } from 'redis';

const redisClient = createClient({ url: 'redis://localhost:6379' });
await redisClient.connect();

@Module({
  imports: [
    XltTokenModule.forRoot({
      store: { useValue: new RedisStore(redisClient) },
    }),
  ],
})
export class AppModule {}
```

### 自定义 Store

实现 `XltTokenStore` 接口（定义于 `@xlt-token/core`）：

```ts
import { XltTokenStore } from '@xlt-token/core';

export class CustomStore implements XltTokenStore {
  async get(key: string): Promise<string | null> { /* ... */ }
  async set(key: string, value: string, timeoutSec: number): Promise<void> { /* ... */ }
  async delete(key: string): Promise<void> { /* ... */ }
  async has(key: string): Promise<boolean> { /* ... */ }
  async update(key: string, value: string): Promise<void> { /* ... */ }
  async updateTimeout(key: string, timeoutSec: number): Promise<void> { /* ... */ }
  async getTimeout(key: string): Promise<number> { /* ... */ }
}
```

### 全局守卫

```ts
import { APP_GUARD } from '@nestjs/core';
import { XltTokenGuard } from '@xlt-token/nestjs';

@Module({
  providers: [{ provide: APP_GUARD, useClass: XltTokenGuard }],
})
export class AppModule {}
```

`XltTokenGuard` 只做 token 校验并把 `loginId` / `token` 挂到 `request.stpLoginId` / `request.stpToken`，不涉及业务。

### 自定义登录 Guard（`XltAbstractLoginGuard`）

如需在校验通过后加载 `request.user`、记录审计日志、或使用自有元数据键（如 `@RequireLogin()`），继承 `XltAbstractLoginGuard` 并重写钩子即可：

```
canActivate
  ├─ requiresLogin(ctx)          // 可重写：替换元数据策略
  │   └─ 否 → 直接放行
  ├─ stpLogic.checkLogin(request)
  ├─ !ok → onAuthFail(result, request)   // 可重写
  │         throw NotLoginException
  └─ ok  → request.stpLoginId / stpToken 赋值
           → onAuthSuccess(result, request) // 可重写：业务会话加载
```

```ts
import { ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  XltAbstractLoginGuard,
  XLT_TOKEN_CONFIG,
  XltTokenConfig,
  StpLogic,
} from '@xlt-token/nestjs';

@Injectable()
export class LoginGuard extends XltAbstractLoginGuard {
  constructor(
    reflector: Reflector,
    @Inject(XLT_TOKEN_CONFIG) config: XltTokenConfig,
    stpLogic: StpLogic,
    private readonly redis: RedisService,
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
    request.user = userRecord;
  }
}
```

## 异步配置

```ts
import { ConfigService } from '@nestjs/config';
import { XltTokenModule } from '@xlt-token/nestjs';

XltTokenModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    config: {
      timeout: config.get('TOKEN_TIMEOUT'),
      tokenStyle: config.get('TOKEN_STYLE'),
    },
  }),
  inject: [ConfigService],
})
```

## 从旧版迁移

若你此前使用 `import { ... } from 'xlt-token'`，可继续工作（根包 re-export），或改为显式依赖：

```ts
// 旧
import { XltTokenModule, StpUtil } from 'xlt-token';

// 新（推荐）
import { XltTokenModule, StpUtil } from '@xlt-token/nestjs';
```

完整迁移说明见 [迁移指南](https://xiaolangtou.github.io/xlt-token/guide/migration-2-0)。

## 社区交流群

欢迎扫码加入 Xlt-token 交流群，与作者和其他用户交流使用心得、反馈问题。

<img src="./img.png" alt="Xlt-token 交流群" width="300" />

## License

MIT

## 相关链接

- [在线文档](https://xiaolangtou.github.io/xlt-token/) - 完整使用指南与 API 参考
- [示例项目](./examples/nestjs/) - 可运行的 NestJS Demo
- [Sa-Token](https://sa-token.cc/) - 灵感来源
- [NestJS](https://nestjs.com/) - NestJS 官方文档
