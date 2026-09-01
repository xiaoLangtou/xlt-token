# Redis Store 完整指南

`@xlt-token/store-redis` 为 xlt-token 提供框架无关的 Redis 存储实现。它只依赖
`@xlt-token/core` 的 `XltTokenStore` 契约，因此 Core、NestJS、Express 和自定义
框架都使用同一套 `RedisStore` 或 `IORedisStore`。

本页从客户端选择开始，完整说明连接生命周期、命令语义、TTL、SCAN、Cluster、
框架接入、迁移和故障排查。Store 不负责创建或关闭 Redis 连接，应用必须管理客户端
生命周期。

## 选择 Redis 客户端

包同时支持 node-redis 和 ioredis。业务项目只需要安装实际使用的客户端。

| 客户端 | Store | 支持版本 | 适合场景 |
| --- | --- | --- | --- |
| `redis` | `RedisStore` | `redis@4`、`redis@5` | 新项目、使用 node-redis 官方客户端 |
| `ioredis` | `IORedisStore` | `ioredis@5` | 已有 ioredis 基础设施、Sentinel、Cluster |

两个 Store 都实现 `XltTokenStore`，但客户端 API 不同，不能交叉传入：

```ts
import { createClient } from 'redis';
import Redis from 'ioredis';
import { IORedisStore, RedisStore } from '@xlt-token/store-redis';

const nodeRedisStore = new RedisStore(createClient());
const ioRedisStore = new IORedisStore(new Redis());
```

## 安装

使用 node-redis：

```bash
pnpm add @xlt-token/core @xlt-token/store-redis redis
```

使用 ioredis：

```bash
pnpm add @xlt-token/core @xlt-token/store-redis ioredis
```

NestJS 或 Express 项目把 `@xlt-token/core` 替换为对应适配器即可：

```bash
pnpm add @xlt-token/nestjs @xlt-token/store-redis redis
pnpm add express @xlt-token/express @xlt-token/store-redis redis
```

`redis` 和 `ioredis` 都是 `@xlt-token/store-redis` 的可选 peer dependency。不要为了
消除 peer dependency 提示同时安装两个客户端。

## node-redis

### 创建并连接客户端

node-redis 需要显式调用 `connect()`。在创建 Store 前注册 `error` 监听，避免连接错误
成为未处理事件。

```ts twoslash [src/redis.ts]
import { createClient } from 'redis';
import { RedisStore } from '@xlt-token/store-redis';

export const redisClient = createClient({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
});

redisClient.on('error', (error) => {
  console.error('[redis]', error);
});

await redisClient.connect();

export const redisStore = new RedisStore(redisClient);
```

应用关闭时调用 `quit()`，让客户端发送 `QUIT` 并等待连接正常结束。进程已经进入故障
恢复且无法等待时，可以使用客户端提供的强制断开方法，但正常关停应优先使用
`quit()`。

```ts
process.once('SIGTERM', async () => {
  await redisClient.quit();
});
```

不要在每次 HTTP 请求中创建客户端。一个应用进程通常复用一个客户端和一个 Store
实例。

### 创建 `RedisStore`

构造函数接收一个兼容 node-redis 的客户端：

```ts
const store = new RedisStore(redisClient);
```

Store 不读取 URL、密码、TLS 或重连配置。这些选项全部属于 node-redis 客户端，并由
应用的基础设施配置负责。

## ioredis

### Standalone

ioredis 在构造后默认立即连接。Store 可以直接接收客户端，但仍建议注册错误监听并在
应用关闭时调用 `quit()`。

```ts twoslash [src/ioredis.ts]
import Redis from 'ioredis';
import { IORedisStore } from '@xlt-token/store-redis';

export const redisClient = new Redis(
  process.env.REDIS_URL ?? 'redis://localhost:6379',
);

redisClient.on('error', (error) => {
  console.error('[ioredis]', error);
});

export const redisStore = new IORedisStore(redisClient);
```

如果项目设置 `lazyConnect: true`，必须在开始处理请求前显式连接：

```ts
const client = new Redis(process.env.REDIS_URL, { lazyConnect: true });
await client.connect();

const store = new IORedisStore(client);
```

### Sentinel

Sentinel 客户端使用相同的 Redis 命令接口，可以直接传给 `IORedisStore`：

```ts
const client = new Redis({
  sentinels: [
    { host: '10.0.0.11', port: 26379 },
    { host: '10.0.0.12', port: 26379 },
  ],
  name: 'mymaster',
  password: process.env.REDIS_PASSWORD,
});

const store = new IORedisStore(client);
```

主从切换、重连和只读节点策略由 ioredis 管理。xlt-token Store 只调用通用读写命令。

### Cluster

`IORedisStore` 接受 ioredis `Cluster` 实例：

```ts
import { Cluster } from 'ioredis';
import { IORedisStore } from '@xlt-token/store-redis';

const cluster = new Cluster([
  { host: '10.0.1.11', port: 6379 },
  { host: '10.0.1.12', port: 6379 },
  { host: '10.0.1.13', port: 6379 },
]);

cluster.on('error', (error) => {
  console.error('[redis-cluster]', error);
});

const store = new IORedisStore(cluster);
```

普通键命令由 ioredis 根据 slot 自动路由。`scan(pattern)` 无法只访问一个 slot，因此
Store 会调用 `cluster.nodes('master')`，对每个 master 分别执行分页 SCAN，再按节点
顺序拼接结果。

集群扩缩容或 slot 迁移期间，同一个逻辑键可能短暂出现在多个 master 的扫描结果中。
当前 Store 保留原始结果，不主动去重。业务代码要求严格唯一时使用：

```ts
const keys: string[] = [];
let cursor: string | null = null;

do {
  const page = await store.scan('authorization:login:*', { cursor, count: 100 });
  keys.push(...page.keys);
  cursor = page.cursor;
} while (cursor !== null);

const uniqueKeys = [...new Set(keys)];
```

## Store 契约与命令映射

两个实现暴露相同的方法。node-redis 使用对象式命令选项，ioredis 使用位置参数，但
最终 Redis 语义一致。

| Store 方法 | Redis 命令 | 行为 |
| --- | --- | --- |
| `get(key)` | `GET key` + `TTL key` | 不存在时返回 `null`；存在时返回 `{ value, expiresAt }` |
| `set(key, value, persistentTtl())` | `SET key value` | 写入永久键 |
| `set(key, value, finiteTtl(n))` | `SET key value EX n` | 写入并设置 `n` 秒 TTL |
| `delete(key)` | `DEL key` | 删除键；键不存在也不抛错 |
| `getAndDelete(key)` | Lua（`GET` + `TTL` + `DEL`） | 原子读取并删除，返回 `{ value, expiresAt }`；键不存在返回 `null`（v2.2 新增） |
| `setIfAbsent(key, value, ttl)` | `SET key value NX ...` | 键不存在才写入 |
| `compareAndSet(key, expected, next, keepTtl())` | Lua + `SET key next KEEPTTL` | 当前值匹配才更新并保留 TTL |
| `compareAndSet(key, expected, next, persistentTtl())` | Lua + `SET key next` | 当前值匹配才更新并移除过期时间 |
| `compareAndSet(key, expected, next, finiteTtl(n))` | Lua + `SET key next EX n` | 当前值匹配才更新并设置 TTL |
| `compareAndDelete(key, expected)` | Lua + `DEL key` | 当前值匹配才删除 |
| `touch(key, persistentTtl())` | Lua + `PERSIST key` | 键存在才移除过期时间 |
| `touch(key, finiteTtl(n))` | Lua + `EXPIRE key n` | 键存在才更新 TTL |
| `scan(pattern, options)` | 分页 `SCAN` | 返回一页匹配 key 和下一页 cursor |

### TTL 返回值

`get(key)` 会读取 Redis `TTL` 并换算为 `StoreEntry.expiresAt`：

| 返回值 | 含义 |
| --- | --- |
| `null` | 键不存在 |
| `{ value, expiresAt: null }` | 键存在，但没有过期时间 |
| `{ value, expiresAt: number }` | 键存在，`expiresAt` 为 Unix 毫秒时间戳 |

`persistentTtl()` 在 xlt-token 中表示永久有效；`finiteTtl(0)` 表示立即过期。自定义配置不要把旧版的 `-1` 秒数语义继续传入 Store。

### 条件更新缺失键

`compareAndSet()`、`compareAndDelete()` 和 `touch()` 都要求键已经存在且当前值匹配或可触达。缺失时返回 `false`，因为静默创建新键会破坏 token 状态和 TTL 的一致性。

```ts
const changed = await store.compareAndSet('missing', 'old', 'value', keepTtl());
// changed === false
```

### SCAN 行为

`scan(pattern, { count })` 默认每页使用 `COUNT 100`。`COUNT` 是 Redis 给扫描器的工作量提示，不保证
每页正好返回 100 个键，也不保证没有空页。Store 会持续使用服务器返回的 cursor，
直到 cursor 回到 `0`。

Store 使用 SCAN 而不是 `KEYS`，因为 `KEYS` 会在大键空间中阻塞 Redis 主线程。
SCAN 降低单次阻塞时间，但完整扫描仍会消耗 Redis 和网络资源。在线用户统计等功能
不应以高频率无缓存调用。

Redis SCAN 在扫描期间发生写入时只提供弱一致性：新增键可能未出现，删除键可能已经
出现在结果中。需要强一致清单时，应维护独立索引，而不是依赖全量扫描。

## xlt-token 键空间

默认 `tokenName` 为 `authorization`。常见键包括：

```text
authorization:login:token:<token>
authorization:login:session:<loginId>
authorization:login:session-list:<loginId>
authorization:login:lastActive:<token>
authorization:safe:<token>:<business>
authorization:temp-token:<tempToken>
```

实际键取决于登录模式、多端配置、活跃过期和二级认证功能。修改 `tokenName` 会同时
改变请求 token 名称和存储键前缀；同一 Redis 数据库中部署多个应用时，应为每个应用
配置不同前缀。

使用 `redis-cli` 排查：

```bash
redis-cli --scan --pattern 'authorization:login:*'
redis-cli TTL 'authorization:login:token:<token>'
redis-cli GET 'authorization:login:token:<token>'
redis-cli GET 'authorization:login:session:1001'
```

不要在生产环境执行 `redis-cli KEYS 'authorization:*'`。

## Core 独立使用

Core 不需要 NestJS 或 Express。创建客户端和 Store 后，把实例传给
`createXltToken()`：

```ts twoslash [src/auth.ts]
import { createMockHttpContext, createXltToken } from '@xlt-token/core';
import { RedisStore } from '@xlt-token/store-redis';
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
});

redisClient.on('error', console.error);
await redisClient.connect();

export const xlt = createXltToken({
  config: {
    tokenName: 'authorization',
    timeout: 7 * 24 * 60 * 60,
  },
  store: new RedisStore(redisClient),
});

const token = await xlt.stpLogic.login('1001');
const ctx = createMockHttpContext({
  headers: { authorization: `Bearer ${token}` },
});
const result = await xlt.stpLogic.checkLogin(ctx);

console.log(token, result.loginId);
```

Core 只处理鉴权语义。HTTP 请求中的 header、cookie 和 query 读取仍由应用通过
`HttpContext` 适配，详见 [Core 独立使用](/core/getting-started)。

## Express 接入

Express 使用适配器导出的 `createXltToken()`，但 Store 仍从独立包导入。下面示例
包含客户端、鉴权实例、中间件、登录路由和错误处理器：

```ts twoslash [src/app.ts]
import express from 'express';
import {
  createXltToken,
  xltErrorHandler,
  xltMiddleware,
} from '@xlt-token/express';
import { RedisStore } from '@xlt-token/store-redis';
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
});
redisClient.on('error', console.error);
await redisClient.connect();

const xlt = createXltToken({
  store: new RedisStore(redisClient),
});

const app = express();
app.use(express.json());

app.post('/login', async (req, res) => {
  const token = await xlt.stpLogic.login(String(req.body.userId));
  res.json({ token });
});

app.use(xltMiddleware(xlt, { ignore: ['/login'] }));

app.get('/me', (req, res) => {
  res.json({ loginId: req.stpLoginId });
});

app.use(xltErrorHandler());
```

应用关闭时，先停止接收请求，再关闭 Redis：

```ts
const server = app.listen(3000);

process.once('SIGTERM', () => {
  server.close(async () => {
    await redisClient.quit();
  });
});
```

完整路由策略、权限、Session 和错误响应见 [Express 完整指南](/adapters/express)。

## NestJS 接入

### 推荐：`store.useValue`

新项目直接创建框架无关 Store，再通过 `store.useValue` 注册：

```ts twoslash [src/app.module.ts]
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { createClient } from 'redis';
import { RedisStore } from '@xlt-token/store-redis';
import { XltTokenGuard, XltTokenModule } from '@xlt-token/nestjs';

const redisClient = createClient({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
});
redisClient.on('error', console.error);
await redisClient.connect();

@Module({
  imports: [
    XltTokenModule.forRoot({
      isGlobal: true,
      config: {
        tokenName: 'authorization',
        timeout: 7 * 24 * 60 * 60,
      },
      store: { useValue: new RedisStore(redisClient) },
    }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: XltTokenGuard },
  ],
})
export class AppModule {}
```

如果应用已经有 RedisModule，应复用它创建的客户端，不要再创建第二条连接。可以在
根模块组装 `RedisStore`，或由项目自己的 Provider 工厂创建 Store 后传给
`XltTokenModule`。

### 关闭连接

`XltTokenModule` 不拥有 Redis 客户端，因此不会自动关闭连接。应用可以让生命周期
Provider 关闭前面实际传给 Store 的 `redisClient` 单例：

```ts
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { redisClient } from './redis';

@Injectable()
export class RedisLifecycle implements OnApplicationShutdown {
  async onApplicationShutdown() {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  }
}
```

把 `RedisLifecycle` 注册到根模块 `providers`。项目已有 RedisModule 时，应由该模块
管理连接和关闭钩子，不要重复关闭同一客户端。

同时在 `main.ts` 调用 `app.enableShutdownHooks()`，NestJS 才会响应系统信号并执行
关闭钩子。

### 兼容旧版 NestJS DI

`@xlt-token/nestjs` 暂时继续导出以下 API：

- `RedisStore`
- `IORedisStore`
- `XLT_REDIS_CLIENT`
- `XLT_IOREDIS_CLIENT`

它们是带 `@Injectable()` 和注入令牌的兼容包装器，内部继承独立包实现。旧项目可以
继续运行，但新项目应使用 `@xlt-token/store-redis` 和 `store.useValue`。

旧写法：

```ts
import {
  RedisStore,
  XLT_REDIS_CLIENT,
  XltTokenModule,
} from '@xlt-token/nestjs';

XltTokenModule.forRoot({
  store: { useClass: RedisStore },
  providers: [
    {
      provide: XLT_REDIS_CLIENT,
      useValue: redisClient,
    },
  ],
});
```

新写法：

```ts
import { RedisStore } from '@xlt-token/store-redis';
import { XltTokenModule } from '@xlt-token/nestjs';

XltTokenModule.forRoot({
  store: { useValue: new RedisStore(redisClient) },
});
```

迁移后可以从 NestJS 模块中移除客户端注入令牌，但 Redis 客户端本身仍应由应用统一
创建、监控和关闭。

## 生产配置建议

### 连接复用

- 每个应用进程复用一个客户端，避免按请求创建连接。
- 已有 Redis 基础设施模块时复用现有客户端。
- Sentinel 或 Cluster 的节点发现、重连和 TLS 配置放在客户端层。

### 超时和重连

- 为连接、命令和重连设置符合业务 SLA 的上限。
- Redis 不可用时，Store 命令会拒绝 Promise；不要把鉴权失败误处理为未登录。
- 在应用监控中区分连接错误、命令超时和 xlt-token 鉴权异常。

### 数据隔离

- 不同应用使用不同 `tokenName` 前缀或不同 Redis database。
- Redis Cluster 不支持 database 切换，应使用唯一前缀。
- 不要让业务代码直接修改 xlt-token 键，否则可能破坏 token 与 Session 的关联。

### 持久化与淘汰

- 登录态是否需要 Redis AOF/RDB 取决于故障恢复要求。
- `allkeys-lru` 等淘汰策略可能提前删除仍有效的 token。
- 生产环境应监控内存、淘汰数量、命令延迟和连接数。

### 在线扫描

- `scan(pattern)` 使用 SCAN，但完整遍历仍是完整键空间操作。
- 在线统计应设置调用频率、缓存结果或维护专用索引。
- Cluster 会扫描所有 master，成本约随 master 数量增长。

## 常见问题

### `ClientClosedError`

node-redis 尚未 `connect()`，或应用已经提前关闭连接。确保开始处理请求前完成连接，
并把 `quit()` 放到应用关闭阶段。

### 条件更新返回 `false`

`compareAndSet()`、`compareAndDelete()` 或 `touch()` 返回 `false`，通常表示目标键已经过期、被删除、从未创建，或当前值不等于期望值。该结果不是 Redis 连接错误，应检查 token 生命周期和调用顺序。

### 登录成功但下一次请求立即失效

检查：

1. 多个实例是否连接同一个 Redis 集群和 database。
2. `tokenName` 是否一致。
3. Redis 是否启用了会提前淘汰键的 maxmemory policy。
4. `timeout` 是否被设置为 `0` 或过小值。
5. 客户端是否把 token 前缀和实际 token 一起传入。

### Cluster 扫描结果重复

slot 迁移期间可能出现重复结果。当前 `IORedisStore` 不去重，需要唯一列表时使用
`new Set()`。

### 需要清理全部登录态

先用 `redis-cli --scan --pattern '<tokenName>:*'` 确认范围。生产环境不要直接执行
`KEYS`，也不要在多个应用共用前缀时批量删除。

## 测试与构建

仓库内可以运行：

```bash
pnpm --filter @xlt-token/store-redis test
pnpm --filter @xlt-token/store-redis test:types
pnpm --filter @xlt-token/store-redis build
```

`test:types` 会验证官方 node-redis、ioredis standalone 和 ioredis Cluster 类型可以
直接传给 Store。

## 下一步

- 只使用框架无关核心：[Core 独立使用](/core/getting-started)
- NestJS Module、Guard 和装饰器：[NestJS 快速开始](/adapters/nestjs/getting-started)
- Express middleware 和路由策略：[Express 完整指南](/adapters/express)
- 查看 Store 契约或实现自定义 Store：[Store 契约与内存存储](/core/storage)
