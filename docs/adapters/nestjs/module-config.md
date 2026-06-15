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

## `forRootAsync`

当配置依赖 `ConfigModule` 或其他异步 Provider 时，使用 `forRootAsync`。

```ts twoslash
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import {
  RedisStore,
  XLT_REDIS_CLIENT,
  XltTokenGuard,
  XltTokenModule,
} from '@xlt-token/nestjs';

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
      store: { useClass: RedisStore },
      providers: [
        {
          provide: XLT_REDIS_CLIENT,
          inject: [ConfigService],
          useFactory: async (cfg: ConfigService) => {
            const client = createClient({ url: cfg.get<string>('REDIS_URL') });
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

## 下一步

- 查看所有配置字段：[Core 配置参考](/core/configuration)
- 理解全局守卫行为：[守卫与装饰器](/adapters/nestjs/guards-and-decorators)
- 先跑通完整流程：[NestJS 快速开始](/adapters/nestjs/getting-started)
