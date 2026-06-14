## Why

`RedisStore.keys()` 使用 `number` 类型的 cursor 调用 `redisClient.scan()`，但 ioredis 兼容的 Redis 客户端（^5.0.0、^6.0.0）要求 cursor 参数为 `string | Buffer`，运行时报错 `"arguments[1]" must be of type "string | Buffer", got number instead`，导致 `getOnlineLoginIds` / `getOnlineCount` 等依赖 `keys()` 的方法不可用。

## What Changes

- 修复 `packages/nestjs/src/store/redis-store.ts` 中 `keys()` 方法的 cursor 类型：`let cursor = 0` → `let cursor = "0"`，`while (cursor !== 0)` → `while (cursor !== "0")`

## Capabilities

### New Capabilities

<!-- No new capabilities -- this is a bug fix -->

### Modified Capabilities

<!-- No spec-level changes -- this is an implementation fix -->

## Impact

- `packages/nestjs/src/store/redis-store.ts`: 仅 `keys()` 方法内部的两处 cursor 类型修正
- 无 API 变更，无 breaking changes
