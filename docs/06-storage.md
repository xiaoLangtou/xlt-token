# 06 · 存储层

`XltTokenStore` 接口 + 两种内置实现（`MemoryStore` / `RedisStore`）+ 自定义存储。

## `XltTokenStore` 接口

源码：`src/store/xlt-token-store.interface.ts`

```ts
interface XltTokenStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, timeoutSec: number): Promise<void>;  // timeoutSec = -1 永不过期
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  update(key: string, value: string): Promise<void>;                    // 只改值，保持 TTL；key 不存在抛错
  updateTimeout(key: string, timeoutSec: number): Promise<void>;        // 只改 TTL
  getTimeout(key: string): Promise<number>;                             // -1=永久, -2=不存在, >0=剩余秒数
}
```

`StpLogic` 只与该接口打交道，**换存储只需换实现**，业务代码零改动。

## `MemoryStore`（默认，内存实现）

源码：`src/store/memory-store.ts`

### 特性

- 基于 `Map<string, MemoryEntry>` 实现
- 惰性过期 + `setTimeout` 双重机制：
  - `setTimeout` 到期自动删除
  - 每次读取前做一次过期检查，兜底定时器漂移
- `setTimeout` delay 上限 `2^31 - 1` 毫秒（约 24.8 天）；超过则仅依赖惰性过期，避免 Node.js 警告
- 定时器 `.unref()`，不阻塞进程退出

### 适用范围

✅ 单进程开发/测试、内部工具、Demo
❌ 多实例生产部署、需要持久化（重启丢数据）

### 用法

什么都不配就是它（默认值）：

```ts
XltTokenModule.forRoot({ config: { tokenName: 'authorization' } });
```

显式指定：

```ts
import { MemoryStore } from 'xlt-token';

XltTokenModule.forRoot({
  store: { useClass: MemoryStore },
});
```

## `RedisStore`（生产推荐）

源码：`src/store/redis-store.ts`

### 特性

- 依赖注入 `XLT_REDIS_CLIENT`
- 兼容 `redis@4` / `redis@5` 两套客户端 API
- 多实例共享、天然支持分布式会话

### 语义映射

| 接口方法 | Redis 命令 |
| --- | --- |
| `set(key, val, -1)` | `SET key val` |
| `set(key, val, n)` | `SET key val EX n` |
| `get` | `GET` |
| `delete` | `DEL` |
| `has` | `EXISTS`（结果为 `1` 时 `true`） |
| `update` | `SET key val XX KEEPTTL`（保留 TTL） |
| `updateTimeout(-1)` | `PERSIST` |
| `updateTimeout(n)` | `EXPIRE key n` |
| `getTimeout` | `TTL`（返回值与接口约定一致：`-2 / -1 / >0`） |

### 基本用法

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

### 从 `ConfigService` 读取连接信息（推荐）

```ts
XltTokenModule.forRootAsync({
  isGlobal: true,
  imports: [ConfigModule],
  useFactory: () => ({ config: { timeout: 86400 } }),
  store: { useClass: RedisStore },
  providers: [
    {
      provide: XLT_REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: async (cfg: ConfigService) => {
        const client = createClient({
          url: cfg.get<string>('REDIS_URL'),
          password: cfg.get<string>('REDIS_PASSWORD'),
        });
        client.on('error', (err) => console.error('[Redis] error', err));
        await client.connect();
        return client;
      },
    },
  ],
})
```

### 复用项目已有的 Redis Client

如果项目已有 `RedisModule` 并导出了一个 client token，把它 re-provide 到 `XLT_REDIS_CLIENT` 即可：

```ts
@Module({
  imports: [
    RedisModule,
    XltTokenModule.forRootAsync({
      isGlobal: true,
      imports: [RedisModule],
      useFactory: () => ({ config: {} }),
      store: { useClass: RedisStore },
      providers: [
        {
          provide: XLT_REDIS_CLIENT,
          useExisting: 'REDIS_CLIENT', // 项目里已有的 token
        },
      ],
    }),
  ],
})
export class AppModule {}
```

### 键空间

以默认 `tokenName='authorization'` 为例：

```
authorization:login:token:<token>        → loginId / BE_REPLACED / KICK_OUT
authorization:login:session:<loginId>    → token
authorization:login:lastActive:<token>   → 毫秒时间戳（仅 activeTimeout > 0）
```

可结合 `redis-cli` 快速调试：

```bash
redis-cli --scan --pattern 'authorization:login:*'
redis-cli TTL authorization:login:token:<token>
redis-cli GET authorization:login:session:1001
```

## 自定义 Store

### 步骤

1. 实现 `XltTokenStore` 接口
2. 通过 `store: { useClass: YourStore }` 注入

```ts
import { Injectable } from '@nestjs/common';
import { XltTokenStore } from 'xlt-token';

@Injectable()
export class MyCustomStore implements XltTokenStore {
  async get(key: string): Promise<string | null> { /* ... */ }
  async set(key: string, value: string, timeoutSec: number): Promise<void> { /* ... */ }
  async delete(key: string): Promise<void> { /* ... */ }
  async has(key: string): Promise<boolean> { /* ... */ }
  async update(key: string, value: string): Promise<void> { /* ... */ }
  async updateTimeout(key: string, timeoutSec: number): Promise<void> { /* ... */ }
  async getTimeout(key: string): Promise<number> { /* ... */ }
}
```

### 契约要点（务必遵守，否则 `StpLogic` 行为会异常）

- **`timeoutSec = -1` 必须实现为永不过期**，不能误当作"立即过期"
- **`update` 必须保留 TTL**（只改值）；若 key 不存在应抛错
- **`getTimeout`**：`-2` = key 不存在、`-1` = 永不过期、`>0` = 剩余秒数
- 所有方法都要返回 Promise；同步抛错会逃逸

### 典型场景

- **混合存储**：热点走 Redis、长尾走 MySQL / Dynamo
- **集群路由**：按 loginId 分片到多个 Redis 实例
- **加密存储**：在 `set` / `get` 时做对称加密
- **Mock Store for Test**：实现一份内存版用于 e2e 测试，不依赖外部服务

## 选型建议

| 场景 | 推荐 |
| --- | --- |
| 单机开发、Demo、单元测试 | `MemoryStore` |
| 生产多实例、需要持久化 | `RedisStore` |
| 已有其他 KV 基础设施（Dynamo / Etcd） | 自定义 Store |
| 测试中需要"可观察的 store" | 继承 `MemoryStore` 加钩子 |

## 下一步

- 想换 token 生成方式？→ [07-token-strategy](./07-token-strategy.md)
- 接入 Redis 后如何观察/调试？→ [09-recipes · 运维调试](./09-recipes.md)
