# Store 契约与内存存储

`@xlt-token/core` 通过 `XltTokenStore` 访问登录态、会话、生命周期和权限缓存。2.0 的 Store 契约以原子条件写入为核心，不再提供 1.x 的 `has/update/updateTimeout/getTimeout/keys` 兼容方法。

## 接口

```ts
export interface XltTokenStore {
  get(key: string): Promise<StoreEntry | null>;
  set(key: string, value: string, ttl: StoreTtl): Promise<void>;
  delete(key: string): Promise<void>;
  getAndDelete(key: string): Promise<StoreEntry | null>;
  setIfAbsent(key: string, value: string, ttl: StoreTtl): Promise<boolean>;
  compareAndSet(key: string, expectedValue: string, nextValue: string, ttl: StoreTtlUpdate): Promise<boolean>;
  compareAndDelete(key: string, expectedValue: string): Promise<boolean>;
  touch(key: string, ttl: StoreTtl): Promise<boolean>;
  scan(pattern: string, options?: StoreScanOptions): Promise<StoreScanResult>;
}
```

## TTL 类型

```ts
import { finiteTtl, keepTtl, persistentTtl } from '@xlt-token/core';

await store.set('k', 'v', finiteTtl(60));
await store.set('k', 'v', persistentTtl());
await store.compareAndSet('k', 'old', 'next', keepTtl());
```

`StoreEntry.expiresAt` 为 Unix 毫秒时间戳；永久键为 `null`。

## 方法语义

| 方法 | 语义 |
| --- | --- |
| `get` | 不存在返回 `null`，存在返回 `{ value, expiresAt }` |
| `set` | 覆盖值和 TTL |
| `delete` | 删除键；不存在也安全完成 |
| `getAndDelete` | 原子读取并删除；并发消费同一键时恰好一个调用拿到条目，其余返回 `null`（v2.2 新增，`consumeTempToken` 的底层语义） |
| `setIfAbsent` | 键不存在才写入，必须原子 |
| `compareAndSet` | 当前值等于 `expectedValue` 才写入，必须原子 |
| `compareAndDelete` | 当前值等于 `expectedValue` 才删除，必须原子 |
| `touch` | 只更新 TTL，键不存在返回 `false` |
| `scan` | 返回一页匹配 key 和下一页 cursor |

## MemoryStore

`MemoryStore` 是测试和本地开发默认实现：

```ts
import { createXltToken, MemoryStore } from '@xlt-token/core';

const xlt = createXltToken({
  store: new MemoryStore(),
});
```

生产多实例请使用 `@xlt-token/store-redis`。Redis 实现使用 Lua / NX / SCAN 保证刷新、撤销和并发登录语义。

## 自定义 Store

自定义实现必须保证条件写入是同一存储节点上的原子操作。不要用“先 get 再 set”的方式模拟 `compareAndSet`，否则刷新 token 时可能无法检测重放。
