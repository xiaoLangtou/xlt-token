# Store 契约与内存存储

`@xlt-token/core` 通过 `XltTokenStore` 访问所有登录态数据。Core 不依赖数据库或框架，
默认使用 `MemoryStore`；生产多实例可以额外安装框架无关的
[`@xlt-token/store-redis`](/store-redis/)。

## `XltTokenStore` 接口

源码：`packages/core/src/store/xlt-token-store.interface.ts`

```ts
export interface XltTokenStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, timeoutSec: number): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  update(key: string, value: string): Promise<void>;
  updateTimeout(key: string, timeoutSec: number): Promise<void>;
  getTimeout(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}
```

`StpLogic` 和 `StpPermLogic` 只依赖这份契约。更换 Store 不需要修改登录、权限或
Session 业务代码。

## 方法语义

| 方法 | 必须满足的行为 |
| --- | --- |
| `get` | 键不存在时返回 `null` |
| `set` | 覆盖值和 TTL；`timeoutSec = -1` 表示永久 |
| `delete` | 删除键；不存在时也应安全完成 |
| `has` | 只判断键是否存在 |
| `update` | 只更新值并保留原 TTL；键不存在时抛错 |
| `updateTimeout` | 只修改 TTL；`-1` 改为永久；键不存在时抛错 |
| `getTimeout` | `-2` 不存在，`-1` 永久，非负数为剩余秒数 |
| `keys` | 返回匹配 pattern 的键，用于在线统计和批量会话操作 |

自定义实现必须保持这些语义。尤其不能把 `-1` 当成立即过期，也不能在 `update()`
时重置 TTL。

## `MemoryStore`

`MemoryStore` 是 Core 默认实现，使用进程内 `Map` 保存数据。没有传入 `store` 时，
`createXltToken()` 自动创建它：

```ts twoslash
import { createXltToken } from '@xlt-token/core';

const xlt = createXltToken({
  config: {
    tokenName: 'authorization',
    timeout: 3600,
  },
});
```

也可以显式创建：

```ts twoslash
import { createXltToken, MemoryStore } from '@xlt-token/core';

const store = new MemoryStore();
const xlt = createXltToken({ store });
```

### 过期机制

MemoryStore 同时使用定时删除和惰性检查：

1. 写入有 TTL 的键时安排 `setTimeout`。
2. 读取键时再次检查过期时间，防止定时器延迟。
3. 定时器调用 `.unref()`，不会阻止 Node.js 进程退出。
4. TTL 超过 Node.js 单个定时器上限时，不创建超长定时器，改由读取时清理。

惰性清理意味着过期但从未再次访问的长 TTL 键可能暂时保留在 Map 中。开发和测试
通常可以接受，长期运行且数据量大的生产服务应使用外部 Store。

### 适用范围

| 场景 | 是否推荐 | 原因 |
| --- | --- | --- |
| 单元测试 | 推荐 | 无外部依赖，测试隔离简单 |
| 本地开发和 Demo | 推荐 | 零配置 |
| 单进程内部工具 | 视数据丢失容忍度决定 | 重启会丢失登录态 |
| 多实例部署 | 不推荐 | 实例之间不共享数据 |
| 需要故障恢复 | 不推荐 | 没有持久化 |

## 自定义 Store

自定义 Store 适合数据库、KV 服务、分片 Redis 或已有缓存抽象。实现类不需要任何
NestJS 装饰器：

```ts twoslash [src/database-store.ts]
import type { XltTokenStore } from '@xlt-token/core';

export class DatabaseStore implements XltTokenStore {
  async get(key: string): Promise<string | null> {
    throw new Error('Implement database read');
  }

  async set(key: string, value: string, timeoutSec: number): Promise<void> {
    throw new Error('Implement upsert with expiration');
  }

  async delete(key: string): Promise<void> {
    throw new Error('Implement delete');
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  async update(key: string, value: string): Promise<void> {
    throw new Error('Update the value without changing expiration');
  }

  async updateTimeout(key: string, timeoutSec: number): Promise<void> {
    throw new Error('Update expiration without changing the value');
  }

  async getTimeout(key: string): Promise<number> {
    throw new Error('Return -2, -1, or remaining seconds');
  }

  async keys(pattern: string): Promise<string[]> {
    throw new Error('Return keys that match the prefix pattern');
  }
}
```

传给 Core：

```ts
const xlt = createXltToken({
  store: new DatabaseStore(),
});
```

### `keys(pattern)` 的匹配约定

Core 当前传入的 pattern 主要是以 `*` 结尾的前缀模式，例如：

```text
authorization:login:session-list:*
```

实现可以把末尾 `*` 去掉后执行前缀查询。不要直接把用户输入拼成 SQL；如果 Store
使用数据库，应参数化查询并为键前缀建立索引。

### 一致性和并发

Store 方法会被多个请求并发调用。外部存储实现需要考虑：

- `set` 覆盖值和 TTL 应尽量原子完成。
- `update` 必须在键存在时更新并保留 TTL。
- `updateTimeout` 不能先读值再无条件重写，否则会覆盖并发更新。
- 多实例必须访问同一个逻辑数据源。
- 存储错误应拒绝 Promise，让上层区分基础设施故障和鉴权失败。

## Redis Store

生产多实例通常使用独立的 `@xlt-token/store-redis`。完整文档包括 node-redis、
ioredis、Sentinel、Cluster、TTL、SCAN、Core、NestJS 和 Express 接入：

[进入 Redis Store 完整指南](/store-redis/)

## 下一步

- Core 框架无关接入：[Core 独立使用](/core/getting-started)
- Redis 生产存储：[Redis Store 完整指南](/store-redis/)
- NestJS Store 注册：[NestJS 模块配置](/adapters/nestjs/module-config)
- Express Store 初始化：[Express 完整指南](/adapters/express)
- Store 相关在线统计：[Hooks 与观测性](/core/hooks-and-observability)
- 查看所有核心方法：[核心 API](/core/core-api)
