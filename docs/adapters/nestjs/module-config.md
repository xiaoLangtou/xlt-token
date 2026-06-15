# NestJS 模块配置

`@xlt-token/nestjs` 通过 `XltTokenModule.forRoot()` 或 `XltTokenModule.forRootAsync()` 接入 NestJS DI 系统。本页只说明 NestJS 模块注册方式；底层配置字段见 [Core 配置参考](/core/configuration)。

## `forRoot`

同步配置适合大多数项目。`isGlobal: true` 会让 `StpLogic`、`StpUtil`、Guard 和相关 Provider 在全局可用。

```ts twoslash
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { XltTokenGuard, XltTokenModule } from '@xlt-token/nestjs';

@Module({
  imports: [
    XltTokenModule.forRoot({
      isGlobal: true,
      config: {
        tokenName: 'authorization',
        timeout: 7 * 24 * 60 * 60,
        defaultCheck: true,
      },
    }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: XltTokenGuard },
  ],
})
export class AppModule {}
```

## 使用 `RedisStore`

多实例部署时应使用 Redis 存储。新项目从 `@xlt-token/store-redis` 创建 Store，
并通过 `store.useValue` 注册。

```ts twoslash
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { createClient } from 'redis';
import { RedisStore } from '@xlt-token/store-redis';
import { XltTokenGuard, XltTokenModule } from '@xlt-token/nestjs';

const redisClient = createClient({ url: process.env.REDIS_URL });
await redisClient.connect();

@Module({
  imports: [
    XltTokenModule.forRoot({
      isGlobal: true,
      config: {
        tokenName: 'authorization',
        timeout: 30 * 24 * 60 * 60,
      },
      store: { useValue: new RedisStore(redisClient) },
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: XltTokenGuard }],
})
export class AppModule {}
```

Store 内部命令、TTL、SCAN、客户端关闭和 Cluster 行为见
[Redis Store 完整指南](/store-redis/)。

## 使用 `IORedisStore`

项目使用 ioredis 时，直接实例化 `IORedisStore`：

```ts twoslash
import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { IORedisStore } from '@xlt-token/store-redis';
import { XltTokenModule } from '@xlt-token/nestjs';

const redisClient = new Redis(process.env.REDIS_URL);

@Module({
  imports: [
    XltTokenModule.forRoot({
      isGlobal: true,
      config: {
        tokenName: 'authorization',
        timeout: 30 * 24 * 60 * 60,
      },
      store: { useValue: new IORedisStore(redisClient) },
    }),
  ],
})
export class AppModule {}
```

安装对应客户端：

```bash
pnpm add @xlt-token/store-redis ioredis
```

## 兼容旧版 NestJS 注入令牌

`@xlt-token/nestjs` 暂时保留 `RedisStore`、`IORedisStore`、
`XLT_REDIS_CLIENT` 和 `XLT_IOREDIS_CLIENT`。这些导出已标记 deprecated，现有项目
可以继续使用，后续大版本再迁移到 `store.useValue`。

兼容包装器内部继承 `@xlt-token/store-redis` 的实现。旧令牌只负责 NestJS 注入，
不会改变 Store 行为。

## `forRootAsync`

当 xlt-token 配置依赖 `ConfigModule` 或其他异步 Provider 时，使用
`forRootAsync`。当前 `store` 在模块注册阶段提供，不会读取 `useFactory` 的返回值；
需要 Redis 时，可以先创建 Store，再把同一个 `useValue` 传给异步配置。

```ts twoslash
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { RedisStore } from '@xlt-token/store-redis';
import { XltTokenGuard, XltTokenModule } from '@xlt-token/nestjs';

const redisClient = createClient({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
});
redisClient.on('error', console.error);
await redisClient.connect();

const redisStore = new RedisStore(redisClient);

@Module({
  imports: [
    XltTokenModule.forRootAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        config: {
          tokenName: cfg.get<string>('TOKEN_NAME', 'authorization'),
          timeout: cfg.get<number>('TOKEN_TTL', 2592000),
          tokenStyle: cfg.get<'random-32'>('TOKEN_STYLE', 'random-32'),
        },
      }),
      store: { useValue: redisStore },
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: XltTokenGuard }],
})
export class AppModule {}
```

如果 Redis URL 也必须由 NestJS `ConfigService` 提供，项目可以在独立 RedisModule
中异步创建客户端和 Store，然后使用兼容 DI 包装器；或者在应用 bootstrap 之前加载
环境配置并构造 `useValue`。不要在请求处理中延迟创建客户端。

## `providers`

`providers` 会附加到动态模块，可用于 Store 或 Strategy 构造函数依赖的业务服务。
它不会自动导出这些 Provider。需要在其他模块复用时，应由业务模块自行提供和导出。

```ts
XltTokenModule.forRoot({
  providers: [AuditService],
  hooks: {
    onLogin(loginId, token, device) {
      console.log('login', { loginId, token, device });
    },
  },
});
```

## 全局与局部模块

`isGlobal: true` 让导出的 Core Provider 在整个应用中可注入，但不会自动注册全局
Guard。全局登录校验仍需要：

```ts
providers: [
  { provide: APP_GUARD, useClass: XltTokenGuard },
]
```

不使用全局 Guard 时，可以在 Controller 或方法上通过 `@UseGuards(XltTokenGuard)`
局部启用。

## 下一步

- 查看所有配置字段：[Core 配置参考](/core/configuration)
- 理解全局守卫行为：[守卫与装饰器](/adapters/nestjs/guards-and-decorators)
- 先跑通完整流程：[NestJS 快速开始](/adapters/nestjs/getting-started)
- 配置 Redis 客户端和生产参数：[Redis Store 完整指南](/store-redis/)
