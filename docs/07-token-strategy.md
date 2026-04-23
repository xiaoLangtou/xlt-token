# 07 · Token 策略

Token 字符串如何生成、内置的三种样式、如何自定义（例如接入 JWT）。

## `TokenStrategy` 接口

源码：`src/token/token-strategy.interface.ts`

```ts
interface TokenStrategy {
  generateToken(payload: any): string;            // 通用生成（自由扩展，如 JWT sign）
  verifyToken(token: string): any;                // 通用校验（自由扩展）
  createToken(loginId: string, config: XltTokenConfig): string;  // StpLogic.login 调用的入口
}
```

`StpLogic` 只调 `createToken`；`generateToken` / `verifyToken` 是给 JWT 这类有"签名/校验"需求的策略预留的扩展点。

## 内置 `UuidStrategy`

源码：`src/token/uuid-strategy.ts`

根据 `config.tokenStyle` 生成不同格式：

| `tokenStyle` | 实现 | 示例 | 长度 | 推荐度 |
| --- | --- | --- | :---: | :---: |
| `uuid`（默认） | `randomUUID()` | `550e8400-e29b-41d4-a716-446655440000` | 36 | ⭐⭐ |
| `simple-uuid` | 去连字符 | `550e8400e29b41d4a716446655440000` | 32 | ⭐⭐⭐ |
| `random-32` | `randomBytes(16).toString('hex')` | `f1a3b2c4d5e6...`（32 字符 hex） | 32 | ⭐⭐⭐⭐⭐ |

### 为什么推荐 `random-32`

- **128 bit 强随机**：`crypto.randomBytes(16)` 使用操作系统熵源，碰撞概率可忽略
- **纯 hex 字符**：URL / Header / Cookie 友好，无需转义
- **比 `uuid` 少 4 字节**：网络传输开销更小
- **不携带版本位**：看不出生成算法，减少信息泄露面

### 选择建议

- 新项目 → 直接 `'random-32'`
- 遗留系统迁移 → 保持原有 `'uuid'`
- 需要 URL-safe 且紧凑 → `'simple-uuid'` 或 `'random-32'`

## 自定义策略（典型：接入 JWT）

### 步骤

1. 实现 `TokenStrategy` 接口
2. 通过 `strategy: { useClass: YourStrategy }` 注入

### 示例：JWT 策略

```ts
import { Injectable, Inject } from '@nestjs/common';
import { TokenStrategy, XltTokenConfig } from 'xlt-token';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtStrategy implements TokenStrategy {
  constructor(@Inject('JWT_SECRET') private readonly secret: string) {}

  createToken(loginId: string, config: XltTokenConfig): string {
    return jwt.sign(
      { sub: loginId },
      this.secret,
      { expiresIn: config.timeout > 0 ? config.timeout : undefined },
    );
  }

  generateToken(payload: any): string {
    return jwt.sign(payload, this.secret);
  }

  verifyToken(token: string): any {
    return jwt.verify(token, this.secret);
  }
}
```

注册：

```ts
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    XltTokenModule.forRoot({
      isGlobal: true,
      strategy: { useClass: JwtStrategy },
      providers: [{ provide: 'JWT_SECRET', useValue: process.env.JWT_SECRET }],
    }),
  ],
})
export class AppModule {}
```

### 注意事项

- **`createToken` 只负责生成**。token 是否仍有效仍由 store 决定（xlt-token 不会解签 JWT 做校验，只会读 Redis）。
- 这意味着：**JWT 模式下依然需要 store**（用于顶号、踢人、logout 等状态语义）。如果你只想要"纯无状态 JWT，服务端不保存状态"，xlt-token 并不是合适的方案。
- 可以把 JWT payload 作为 token 值写入 store，但会比较冗长。一般建议保留"JWT 用于生成 + Redis 用于状态"的组合。

## 策略 vs 存储：该改哪个？

| 需求 | 改策略 | 改存储 | 改配置 |
| --- | --- | --- | --- |
| token 字符串更短 / 更随机 | ✅ | | |
| token 含签名信息（JWT） | ✅ | | |
| 换 Redis / 自研 KV | | ✅ | |
| 改过期时间、tokenName、多端行为 | | | ✅ |

## 下一步

- 看各个 NotLoginType 什么时候触发 → [08-exceptions](./08-exceptions.md)
- 实战场景（顶号、踢人） → [09-recipes](./09-recipes.md)
