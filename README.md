# xlt-token

> NestJS token authentication library inspired by Sa-Token

[![npm version](https://badge.fury.io/js/xlt-token.svg)](https://www.npmjs.com/package/xlt-token)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

xlt-token 是一个为 NestJS 设计的轻量级 token 认证库，灵感来源于 Java 的 Sa-Token。它提供了灵活的 token 管理、会话控制、多端登录支持，以及可插拔的存储策略。

## 特性

- 🔐 **灵活的 Token 管理** - 支持登录、登出、续签、踢人下线等完整生命周期
- 🌐 **多端登录** - 支持同账号多设备同时在线，可配置互踢模式
- 💾 **可插拔存储** - 内置内存存储，支持自定义 Redis 存储实现
- 🎨 **Token 策略** - 支持多种 token 格式（UUID、Simple UUID、随机字符串）
- 🎯 **装饰器支持** - `@XltIgnore`、`@XltCheckLogin`、`@LoginId()`、`@TokenValue()`
- 🛡️ **全局守卫** - 黑名单/白名单双模式，默认安全
- 🔧 **零业务依赖** - 纯粹的认证库，不依赖任何业务代码
- 📦 **TypeScript** - 完整的类型定义

## 安装

```bash
pnpm add xlt-token
# 或
npm install xlt-token
# 或
yarn add xlt-token
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
        tokenStyle: 'simple-uuid',
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
| `store` | `{ useClass } \| { useValue }` | `MemoryStore` | 自定义存储实现 |
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
| `checkLogin(req)` | `req: Request` | `Promise<{ ok, loginId?, token? }>` | 校验登录（未登录抛异常） |
| `getTokenValue(req)` | `req: Request` | `Promise<string \| null>` | 获取 token 值 |

### StpUtil（静态门面）

所有方法与 `StpLogic` 相同，但无需注入，直接静态调用：

```ts
import { StpUtil } from 'xlt-token';

await StpUtil.login(userId);
await StpUtil.logout(token);
const loginId = await StpUtil.getLoginId(req);
```

### 装饰器

| 装饰器 | 作用 | 参数 |
|---|---|---|
| `@XltIgnore()` | 忽略登录校验 | 无 |
| `@XltCheckLogin()` | 强制校验登录 | 无 |
| `@LoginId()` | 注入当前登录用户 ID | 无 |
| `@TokenValue()` | 注入当前 token 值 | 无 |

### 自定义 Store

实现 `XltTokenStore` 接口：

```ts
import { XltTokenStore } from 'xlt-token';

export class RedisStore implements XltTokenStore {
  async get(key: string): Promise<string | null> {
    // 从 Redis 读取
  }

  async set(key: string, value: string, timeoutSec: number): Promise<void> {
    // 写入 Redis
  }

  async delete(key: string): Promise<void> {
    // 删除
  }

  async has(key: string): Promise<boolean> {
    // 判断存在
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
  store: { useClass: RedisStore },
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

- [Sa-Token](https://sa-token.cc/) - 灵感来源
- [NestJS](https://nestjs.com/) - NestJS 官方文档
