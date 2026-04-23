# xlt-token

> NestJS token authentication library inspired by Sa-Token

[![npm version](https://badge.fury.io/js/xlt-token.svg)](https://www.npmjs.com/package/xlt-token)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docs](https://img.shields.io/badge/docs-online-16a34a?logo=vitepress&logoColor=white)](https://xiaolangtou.github.io/xlt-token/)

📖 **在线文档**: https://xiaolangtou.github.io/xlt-token/

xlt-token 是一个为 NestJS 设计的轻量级 token 认证库，灵感来源于 Java 的 Sa-Token。它提供了灵活的 token 管理、会话控制、多端登录支持，以及可插拔的存储策略。

## 特性

- 🔐 **灵活的 Token 管理** - 支持登录、登出、续签、踢人下线等完整生命周期
- 🌐 **多端登录** - 支持同账号多设备同时在线，可配置互踢模式
- 💾 **内置存储** - 内置内存存储和 Redis 存储实现，开箱即用
- 🎨 **Token 策略** - 支持多种 token 格式（UUID、Simple UUID、随机字符串）
- 🎯 **装饰器支持** - `@XltIgnore`、`@XltCheckLogin`、`@LoginId()`、`@TokenValue()`
- 🛡️ **全局守卫** - 黑名单/白名单双模式，默认安全
- 🧩 **可扩展守卫** - 提供 `XltAbstractLoginGuard` 抽象基类，通过钩子注入业务会话（如加载用户信息到 `request.user`）
- 🔧 **零业务依赖** - 纯粹的认证库，不依赖任何业务代码
- 📦 **TypeScript** - 完整的类型定义
- ⚡ **静态门面** - 提供 StpUtil 静态方法，无需注入即可使用

## 安装

```bash
pnpm add xlt-token
# 或
npm install xlt-token
# 或
yarn add xlt-token
```

如需使用 Redis 存储，还需安装 redis 包：

```bash
pnpm add redis
```

## 快速开始

### 1. 注册模块

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { XltTokenModule } from 'xlt-token';

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
})
export class AppModule {}
```

### 2. 登录

```ts
// auth.service.ts
import { Injectable } from '@nestjs/common';
import { StpLogic } from 'xlt-token';

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
import { Controller, Get } from '@nestjs/common';
import { XltIgnore, LoginId } from 'xlt-token';

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
import { StpUtil } from 'xlt-token';

// 无需注入，直接调用
const token = await StpUtil.login(userId);
const loginId = await StpUtil.getLoginId(req);
```

## 配置选项

### XltTokenModule.forRoot()

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `config` | `Partial<XltTokenConfig>` | - | 配置选项（见下表） |
| `store` | `{ useClass } \| { useValue }` | `MemoryStore` | 存储实现（内置 MemoryStore 和 RedisStore） |
| `strategy` | `{ useClass }` | `UuidStrategy` | 自定义 token 策略 |
| `isGlobal` | `boolean` | `false` | 是否全局模块 |

### XltTokenConfig

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `tokenName` | `string` | `'authorization'` | HTTP header / cookie / query 中读取 token 的键名 |
| `timeout` | `number` | `2592000` (30 天) | token 有效期（秒） |
| `activeTimeout` | `number` | `-1` | 滑动过期秒数，`-1` 表示不启用 |
| `isConcurrent` | `boolean` | `true` | 是否允许同账号多端同时在线 |
| `isShare` | `boolean` | `true` | 同账号多次登录是否共享同一 token |
| `tokenStyle` | `'uuid' \| 'simple-uuid' \| 'random-32'` | `'uuid'` | token 格式 |
| `isReadHeader` | `boolean` | `true` | 是否从 HTTP Header 读取 token |
| `isReadCookie` | `boolean` | `false` | 是否从 Cookie 读取 |
| `isReadQuery` | `boolean` | `false` | 是否从 URL Query 读取 |
| `tokenPrefix` | `string` | `'Bearer '` | Header 中 token 的前缀（读取时自动剥离） |
| `defaultCheck` | `boolean` | `true` | 全局守卫默认模式：`true`=黑名单，`false`=白名单 |

## API 文档

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

### StpUtil（静态门面）

所有方法与 `StpLogic` 相同，但无需注入，直接静态调用：

```ts
import { StpUtil } from 'xlt-token';

// 登录
const token = await StpUtil.login(userId);

// 登出
await StpUtil.logout(token);
await StpUtil.logoutByLoginId(userId);

// 踢人下线
await StpUtil.kickout(userId);

// 续签 token
await StpUtil.renewTimeout(token, 3600);

// 判断是否登录
const isLogin = await StpUtil.isLogin(req);

// 校验登录（未登录抛异常）
const result = await StpUtil.checkLogin(req);

// 获取当前登录用户 ID
const loginId = await StpUtil.getLoginId(req);

// 获取当前 token 值
const tokenValue = await StpUtil.getTokenValue(req);
```

### 装饰器

| 装饰器 | 作用 | 参数 |
|---|---|---|
| `@XltIgnore()` | 忽略登录校验 | 无 |
| `@XltCheckLogin()` | 强制校验登录 | 无 |
| `@LoginId()` | 注入当前登录用户 ID | 无 |
| `@TokenValue()` | 注入当前 token 值 | 无 |

### 异常处理

库提供了 `NotLoginException` 异常和 `NotLoginType` 常量用于处理登录失败场景：

```ts
import { NotLoginException, NotLoginType } from 'xlt-token';

try {
  await stpLogic.checkLogin(req);
} catch (e) {
  if (e instanceof NotLoginException) {
    switch (e.message) {
      case NotLoginType.NOT_TOKEN:
        // 请求中没 token
        break;
      case NotLoginType.INVALID_TOKEN:
        // token 在服务端找不到
        break;
      case NotLoginType.TOKEN_TIMEOUT:
        // token 已过期
        break;
      case NotLoginType.TOKEN_FREEZE:
        // 临时活跃过期
        break;
      case NotLoginType.BE_REPLACED:
        // 被顶号
        break;
      case NotLoginType.KICK_OUT:
        // 被踢下线
        break;
    }
  }
}
```

### 使用 Redis 存储

库已内置 RedisStore 实现，只需提供 Redis 客户端即可使用：

```ts
import { Module } from '@nestjs/common';
import { XltTokenModule, RedisStore, XLT_REDIS_CLIENT } from 'xlt-token';
import { createClient } from 'redis';

@Module({
  imports: [
    XltTokenModule.forRoot({
      store: { useClass: RedisStore },
      providers: [
        {
          provide: XLT_REDIS_CLIENT,
          useFactory: async () => {
            const client = createClient({
              url: 'redis://localhost:6379',
            });
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

### 自定义 Store

如需实现自定义存储，实现 `XltTokenStore` 接口：

```ts
import { XltTokenStore } from 'xlt-token';

export class CustomStore implements XltTokenStore {
  async get(key: string): Promise<string | null> {
    // 自定义读取逻辑
  }

  async set(key: string, value: string, timeoutSec: number): Promise<void> {
    // 自定义写入逻辑
  }

  async delete(key: string): Promise<void> {
    // 自定义删除逻辑
  }

  async has(key: string): Promise<boolean> {
    // 自定义存在判断
  }

  async update(key: string, value: string): Promise<void> {
    // 更新值（不改动过期时间）
  }

  async updateTimeout(key: string, timeoutSec: number): Promise<void> {
    // 更新过期时间
  }

  async getTimeout(key: string): Promise<number> {
    // 获取过期时间
  }
}
```

使用自定义 Store：

```ts
XltTokenModule.forRoot({
  store: { useClass: CustomStore },
})
```

### 全局守卫

在 `AppModule` 中注册全局守卫：

```ts
import { APP_GUARD } from '@nestjs/core';
import { XltTokenGuard } from 'xlt-token';

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: XltTokenGuard,
    },
  ],
})
export class AppModule {}
```

`XltTokenGuard` 只做 token 校验并把 `loginId` / `token` 挂到 `request.stpLoginId` / `request.stpToken`，不涉及业务。

### 自定义登录 Guard（`XltAbstractLoginGuard`）

如果你需要在校验通过后把用户信息加载到 `request.user`、记录审计日志、使用自己的元数据键（如 `@RequireLogin()`），请继承 `XltAbstractLoginGuard`，仅重写你关心的钩子即可。token 校验、异常抛出、默认元数据（`@XltIgnore` / `@XltCheckLogin`）解析已在基类完成。

#### 生命周期

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

#### 可重写成员

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `requiresLogin(ctx)` | `boolean` | 判定当前路由是否需要校验。默认读 `@XltIgnore` / `@XltCheckLogin` 配合 `defaultCheck`。重写后可接入项目自有元数据（如 `@RequireLogin`） |
| `onAuthSuccess(result, request)` | `void \| Promise<void>` | 校验通过后触发，常用于加载用户信息到 `request.user` |
| `onAuthFail(result, request)` | `void \| Promise<void>` | 异常抛出前触发，可记录日志、埋点等 |
| `reflector` / `config` / `stpLogic` | `protected` | 子类可直接使用 |

#### 示例：加载用户到 `request.user`（白名单模式）

```ts
import { ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { XltAbstractLoginGuard, XLT_TOKEN_CONFIG, XltTokenConfig, StpLogic } from 'xlt-token';
import { RedisService } from '@/config/modules/redis.service';

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

  /** 改用项目自己的 @RequireLogin() 白名单 */
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

注册为全局守卫（与 `XltTokenGuard` 二选一）：

```ts
providers: [{ provide: APP_GUARD, useClass: LoginGuard }]
```

## 异步配置

使用 `forRootAsync` 支持异步配置：

```ts
import { ConfigService } from '@nestjs/config';

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

## License

MIT

## 相关链接

- [在线文档](https://xiaolangtou.github.io/xlt-token/) - 完整使用指南与 API 参考
- [Sa-Token](https://sa-token.cc/) - 灵感来源
- [NestJS](https://nestjs.com/) - NestJS 官方文档
