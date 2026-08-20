# xlt-token 2.0 迁移指南

> 适用范围：从 `1.x` 升级到 `2.x`。2.x 不提供 1.x 后向兼容层，旧 Store、JWT 和 Hooks API 需要按表迁移。

## 安装

```bash
pnpm add @xlt-token/core@^2.1.1
pnpm add @xlt-token/nestjs@^2.1.1        # NestJS
pnpm add @xlt-token/express@^2.1.1       # Express
pnpm add @xlt-token/store-redis@^2.1.1   # Redis Store
pnpm add @xlt-token/jwt@^2.1.1           # JWT 策略
```

## 迁移总览

| 1.x API / 行为 | 2.0 替代 API | 行为差异 | 最小迁移 |
| --- | --- | --- | --- |
| `XltTokenStore.get(): string \| null` | `get(): StoreEntry \| null` | 返回值包含 `value` 与 `expiresAt` | `(await store.get(k))?.value ?? null` |
| `set(key, value, timeoutSec)` | `set(key, value, finiteTtl(sec) / persistentTtl())` | TTL 改为结构化类型 | `store.set(k, v, finiteTtl(60))` |
| `has / update / updateTimeout / getTimeout / keys` | `setIfAbsent / compareAndSet / compareAndDelete / touch / scan` | Store 必须提供原子条件写入和分页扫描 | 见 [Store 契约](/core/storage) |
| NestJS 内置 `JwtStrategy` + `config.jwt.secret` | `@xlt-token/jwt` + `createJwtStrategyConfig()` | JWT 策略从 NestJS 拆出，必须显式配置 `kid` 密钥环 | 见 [JWT 策略](/core/jwt-strategy) |
| `refreshToken(): string \| null` | `refreshToken(): RefreshResult` | 返回结构化成功/失败结果，支持重放检测 | `if (result.ok) result.accessToken` |
| `XltHooks` / `XLT_TOKEN_HOOKS` | `XltEventSink` / `XLT_EVENT_SINK` | 事件只包含 token 指纹，不暴露原始 token | `eventSink: { emit(event) {} }` |
| `NOT_LOGIN` 等泛化错误码 | `TOKEN_INVALID` / `TOKEN_KICKED_OUT` 等稳定错误码 | HTTP 适配器响应不再返回 raw token | 读取 `body.code` 与 `body.type` |

## Store 迁移

```ts
import { finiteTtl, type XltTokenStore } from '@xlt-token/core';

const entry = await store.get(key);
const value = entry?.value ?? null;

await store.set(key, 'value', finiteTtl(60));
await store.compareAndSet(key, 'old', 'next', { kind: 'keep' });
```

自定义 Store 需要实现原子方法。Redis 用户推荐直接使用 `@xlt-token/store-redis` 的 `RedisStore` 或 `IORedisStore`。

## JWT 迁移

```ts
import { JwtStrategy, createJwtStrategyConfig } from '@xlt-token/jwt';

const jwt = new JwtStrategy(
  createJwtStrategyConfig({
    activeKid: '2026-07',
    keys: [
      { kid: '2026-06', algorithm: 'HS256', secret: process.env.JWT_OLD_SECRET! },
      { kid: '2026-07', algorithm: 'HS256', secret: process.env.JWT_ACTIVE_SECRET! },
    ],
    issuer: 'xlt-token',
  }),
);

XltTokenModule.forRoot({
  strategy: { useValue: jwt },
});
```

轮换顺序：

1. 先发布包含旧 key 与新 key 的配置，`activeKid` 仍指向旧 key。
2. 确认所有实例都能验证新旧 key。
3. 切换 `activeKid` 到新 key。
4. 等待历史 token 过期后删除旧 key。

## 刷新结果迁移

```ts
const result = await context.stpLogic.refreshToken(token);

if (!result.ok) {
  switch (result.code) {
    case 'TOKEN_REPLAYED':
      // 触发重放保护：要求用户重新登录
      break;
    case 'TOKEN_EXPIRED':
    case 'TOKEN_REVOKED':
    case 'TOKEN_INVALID':
      break;
  }
} else {
  console.log(result.accessToken);
}
```

## Hooks 迁移为审计事件

```ts
import type { XltEventSink } from '@xlt-token/core';

const eventSink: XltEventSink = {
  emit(event) {
    // event.tokenFingerprint 是 sha256(token).slice(0, 16)
    auditLogger.info(event);
  },
};

createXltToken({ eventSink });
```

事件不会包含原始 token、请求对象或 JWT payload。需要关联 token 时使用 `tokenFingerprint`、`previousTokenFingerprint` 或 `nextTokenFingerprint`。

## 错误响应

2.x HTTP 适配器响应示例：

```json
{
  "statusCode": 401,
  "code": "TOKEN_INVALID",
  "type": "INVALID_TOKEN",
  "message": "Token 无效"
}
```

前端应以 `code` 做稳定分支，以 `type` 区分 `NotLoginType` 细节。
