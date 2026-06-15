# xlt-token 迁移指南

> 适用版本：`1.0.0`（monorepo：`@xlt-token/core` + `@xlt-token/nestjs` + `@xlt-token/express`）

## 从旧版 `xlt-token` 单包迁移

若你此前使用：

```ts
import { XltTokenModule, XltTokenGuard, StpUtil, LoginId } from 'xlt-token';
```

请改为显式依赖分包：

```ts
import {
  XltTokenModule,
  XltTokenGuard,
  StpUtil,
  LoginId,
} from '@xlt-token/nestjs';
```

类型与核心 API 也可从 `@xlt-token/core` 导入（nestjs 包会 re-export 常用符号）：

```ts
import type { XltTokenConfig, StpInterface } from '@xlt-token/core';
import { DEFAULT_XLT_TOKEN_CONFIG, MemoryStore } from '@xlt-token/core';
```

仅使用框架无关 API（Express、Koa 等）时：

```ts
import { createXltToken, StpUtil, MemoryStore } from '@xlt-token/core';
```

## 包职责

| 包 | 职责 |
| --- | --- |
| `@xlt-token/core` | 鉴权算法、HttpContext、Store/Strategy 契约、Hooks |
| `@xlt-token/store-redis` | 框架无关的 RedisStore、IORedisStore |
| `@xlt-token/nestjs` | Module、Guard、Decorator、JwtStrategy、Nest 异常包装 |

## 行为变化（内部实现，对外 API 不变）

- Guard 内部通过 `HttpContext` 调用 `StpLogic.checkLogin`
- 登录成功后仍写入 `request.stpLoginId` / `request.stpToken`，`@LoginId()` / `@TokenValue()` 无需改动
- 异常仍为继承 NestJS `UnauthorizedException` / `ForbiddenException` 的包装类

## 安装

```bash
pnpm add @xlt-token/nestjs
pnpm add @xlt-token/store-redis redis
pnpm add jsonwebtoken       # 可选：JwtStrategy
```

`@xlt-token/nestjs` peer 依赖：

- `@nestjs/common`、`@nestjs/core`
- `reflect-metadata`、`rxjs`
- 可选：`jsonwebtoken`

## 常见问题

**Q：自定义 Guard 继承 `XltAbstractLoginGuard` 需要改吗？**  
A：不需要，签名与回调保持不变，仅改 import 路径。

**Q：`StpUtil.login()` 还能在 Controller 里用吗？**  
A：可以。`XltTokenModule` 初始化时仍会 `setStpLogic`。

**Q：Fastify 适配器支持吗？**  
A：Phase 3 规划中；当前 NestJS 默认基于 Express 适配器。
