# NestJS 快速开始

5 分钟跑通最小登录流程：**注册模块 → 登录签发 token → 守卫自动校验 → 登出**。

本章使用 `@xlt-token/nestjs` 跑通 NestJS 登录流程。架构说明见 [架构设计](/guide/architecture)。

## 在线运行 Demo

可以直接打开 Cloud Studio 模板运行 NestJS 示例，无需先在本地安装依赖。

[![Cloud Studio Template](https://cs-res.codehub.cn/common/assets/icon-badge.svg)](https://cloudstudio.net/a/35877741980655616?channel=share&sharetype=Markdown)

打开模板后，按模板内的终端提示启动服务，再回到本章的 [客户端调用](#客户端调用) 小节复制请求进行验证。

## 安装

```bash
pnpm add @xlt-token/nestjs
# 使用 Redis 存储（可选）
pnpm add redis
```

## 最小集成（内存存储）

**适合**：单进程开发环境、小项目、Demo。生产环境请走 [Redis 存储](/core/storage#redisstore)。


```ts twoslash
import type { XltTokenModuleOptions } from '@xlt-token/nestjs'
// ---cut---
const options = {
  isGlobal: true,
  config: {
    tokenName: 'authorization',
    timeout: 7 * 24 * 60 * 60,
  },
} satisfies XltTokenModuleOptions

```

```ts twoslash
// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { XltTokenModule, XltTokenGuard } from '@xlt-token/nestjs';
// ---cut---
@Module({
  imports: [
    XltTokenModule.forRoot({
      isGlobal: true,
      config: {
        tokenName: 'authorization',
        timeout: 7 * 24 * 60 * 60, // 7 天
      },
    }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: XltTokenGuard }, // 全局登录校验
  ],
})
export class AppModule {}
```

默认 `defaultCheck: true` → **所有路由都需要登录**，使用 `@XltIgnore()` 放行公开接口。

## 写一个登录/登出控制器

```ts twoslash
import { Body, Controller, Post } from '@nestjs/common';
import { StpUtil, XltIgnore, LoginId, TokenValue } from '@xlt-token/nestjs';

@Controller('auth')
export class AuthController {
  @XltIgnore()                         // 登录接口本身不需校验
  @Post('login')
  async login(@Body() dto: { username: string; password: string }) {
    // 业务校验账号密码……得到 userId
    const userId = '1001';
    const token = await StpUtil.login(userId);
    return { token };                  // 客户端自行拼接 Bearer 前缀
  }

  @Post('logout')
  async logout(@TokenValue() token: string) {
    await StpUtil.logout(token);
    return { ok: true };
  }

  @Post('me')                          // 默认需要登录
  me(@LoginId() loginId: string) {
    return { loginId };
  }
}
```

## 客户端调用

```bash
# 1. 登录拿到 token
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"xxx"}'
# → { "token": "550e8400-e29b-41d4-a716-446655440000" }

# 2. 带 Bearer 访问需登录接口
curl -X POST http://localhost:3000/auth/me \
  -H 'Authorization: Bearer 550e8400-e29b-41d4-a716-446655440000'
# → { "loginId": "1001" }

# 3. 登出
curl -X POST http://localhost:3000/auth/logout \
  -H 'Authorization: Bearer 550e8400-e29b-41d4-a716-446655440000'
```

## 切到 Redis 存储（生产推荐）

多实例部署 / 需要持久化 → 必须换 Redis。

```ts twoslash
import { createClient } from 'redis';
import { XltTokenModule, RedisStore, XLT_REDIS_CLIENT, XltTokenGuard } from '@xlt-token/nestjs';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    XltTokenModule.forRoot({
      isGlobal: true,
      config: { tokenName: 'authorization', timeout: 604800 },
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
  providers: [{ provide: APP_GUARD, useClass: XltTokenGuard }],
})
export class AppModule {}
```

启动后 `redis-cli KEYS 'authorization:login:*'` 即可看到键（详见 [架构设计 · 三类存储键](/guide/architecture#三类存储键)）。

## 守卫的两种工作模式

由 `defaultCheck` 决定（默认 `true`）：

| 模式 | 语义 | 配合装饰器 |
| --- | --- | --- |
| `defaultCheck: true` | 默认全部校验（黑名单） | `@XltIgnore()` 放行 |
| `defaultCheck: false` | 默认全部放行（白名单） | `@XltCheckLogin()` 开启校验 |

## 需要把用户信息填到 `request.user`？

`XltTokenGuard` **只做 token 校验**，不感知业务。如果你的项目需要：

- 把用户详情（角色/权限）挂到 `request.user`
- 接入自己的元数据键（如 `@RequireLogin()`）
- 校验通过/失败时记录审计日志

请继承 `XltAbstractLoginGuard` 实现自定义 Guard，详见 [守卫与装饰器 · 业务扩展](/adapters/nestjs/guards-and-decorators#xltabstractloginguard业务扩展)。

## 下一步

- 想了解存储键长啥样、并发/共享到底如何决策？→ [架构设计](/guide/architecture)
- 想一次看完所有配置项？→ [模块配置](/adapters/nestjs/module-config)
- 想知道 `login` / `kickout` / `renewTimeout` 的完整签名？→ [核心 API](/core/core-api)
- 遇到 `NotLoginException` 不知道怎么处理？→ [异常处理](/core/exceptions)
