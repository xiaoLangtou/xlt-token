---
title: 状态型 JWT Token 策略
description: 在 xlt-token 中使用状态型 JWT、密钥轮换、kid、算法白名单和 Store 黑名单，兼顾验签与会话撤销能力。
---

# JWT 策略

2.0 将 JWT 策略拆到独立包 `@xlt-token/jwt`。Core 只依赖 `TokenStrategy` 接口；NestJS/Express 通过 `strategy.useValue` 注入已配置好的策略实例。

## 决策表

| 需求 | 推荐 |
| --- | --- |
| 需要服务端踢人、顶号、多端、刷新重放检测 | xlt-token 状态型 token 或状态型 JWT |
| 希望每次请求只验签，不查 Store | 不适合 xlt-token 的完整生命周期语义 |
| 需要密钥轮换、`kid`、算法白名单 | `@xlt-token/jwt` |
| 只需要随机 opaque token | 默认 `UuidStrategy` |

xlt-token 的 JWT 是**状态型 JWT**：JWT 承载身份，Store 承载会话索引、黑名单、刷新家族和撤销状态。

## 安装

```bash
pnpm add @xlt-token/jwt jsonwebtoken
pnpm add -D @types/jsonwebtoken
```

## 配置

```ts
import { JwtStrategy, createJwtStrategyConfig } from '@xlt-token/jwt';
import { XltTokenModule } from '@xlt-token/nestjs';

const jwt = new JwtStrategy(
  createJwtStrategyConfig({
    activeKid: '2026-07',
    keys: [
      { kid: '2026-06', algorithm: 'HS256', secret: process.env.JWT_OLD_SECRET! },
      { kid: '2026-07', algorithm: 'HS256', secret: process.env.JWT_ACTIVE_SECRET! },
    ],
    issuer: 'xlt-token',
    audience: 'web',
  }),
);

XltTokenModule.forRoot({
  strategy: { useValue: jwt },
});
```

## 安全规则

- 签发只使用 `activeKid` 对应的密钥。
- 验证先读取 JWT header 的 `kid`，只用匹配密钥验证。
- `algorithms` 白名单只包含该 `kid` 声明的算法。
- HMAC secret 至少 32 bytes。
- 缺失 `kid`、未知 `kid`、算法不匹配都会拒绝。

## 双密钥轮换顺序

1. 发布包含旧 key 与新 key 的配置，`activeKid` 仍指向旧 key。
2. 等所有实例都具备验证新旧 key 的能力。
3. 切换 `activeKid` 到新 key，新 token 开始带新 `kid`。
4. 等旧 token 全部过期后删除旧 key。

## Payload

`createToken()` 签发：

```json
{
  "sub": "1001",
  "jti": "550e8400-e29b-41d4-a716-446655440000"
}
```

`sub` 是 loginId，`jti` 是会话唯一标识。

## 与刷新生命周期配合

启用 `config.lifecycle.refresh.enabled` 后，`refreshToken(token)` 返回结构化结果：

```ts
const result = await stp.refreshToken(token);

if (result.ok) {
  return result.accessToken;
}

if (result.code === 'TOKEN_REPLAYED') {
  // 要求重新登录
}
```

同一个 token 并发刷新时只允许一个成功，其他请求会触发重放检测并撤销 token family。

## NestJS / Express

NestJS：

```ts
XltTokenModule.forRoot({
  strategy: { useValue: jwt },
});
```

Express / Core：

```ts
const xlt = createXltToken({
  strategy: jwt,
});
```

## 下一步

- Token 策略接口 → [Token 策略](/core/token-strategy)
- 刷新与撤销迁移 → [2.0 迁移指南](/guide/migration-2-0)
- Store 原子契约 → [Store 契约与内存存储](/core/storage)
