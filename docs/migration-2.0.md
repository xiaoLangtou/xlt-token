# xlt-token 2.0 迁移指南

> 适用版本：`2.0.0`（monorepo：`@xlt-token/core` + `@xlt-token/nestjs` + `xlt-token` compat）

## 对 1.x 用户：零改动

若你当前使用：

```ts
import { XltTokenModule, XltTokenGuard, StpUtil, LoginId } from 'xlt-token';
```

**无需修改任何 import**。根包 `xlt-token` 继续作为兼容层，转发 `@xlt-token/nestjs` 的全部导出。

## 推荐写法（2.0）

新项目或愿意显式依赖时可改为：

```ts
import { XltTokenModule, XltTokenGuard, LoginId } from '@xlt-token/nestjs';
import type { XltTokenConfig, StpInterface } from '@xlt-token/nestjs';
```

仅使用框架无关 API（Express、Koa 等）时：

```ts
import { createXltToken, StpUtil, MemoryStore } from '@xlt-token/core';
```

## 包职责

| 包 | 职责 |
| --- | --- |
| `@xlt-token/core` | 鉴权算法、HttpContext、Store/Strategy 契约 |
| `@xlt-token/nestjs` | Module、Guard、Decorator、Nest 异常包装 |
| `xlt-token` | 1.x 兼容 re-export（= `@xlt-token/nestjs`） |

## 行为变化（内部实现，对外 API 不变）

- Guard 内部通过 `HttpContext` 调用 `StpLogic.checkLogin`，不再直接传 Express `Request`
- 登录成功后仍写入 `request.stpLoginId` / `request.stpToken`，`@LoginId()` / `@TokenValue()` 无需改动
- 异常仍为 `NotLoginException` 等 NestJS 子类，HTTP 401/403 响应格式不变

## peerDependencies

`@xlt-token/nestjs` 需要与 1.x 相同的 NestJS peer：

- `@nestjs/common`、`@nestjs/core`
- `reflect-metadata`、`rxjs`
- 可选：`redis`（RedisStore）、`jsonwebtoken`（JwtStrategy）

## 安装

Monorepo 内使用 workspace；发布后：

```bash
pnpm add xlt-token
# 或
pnpm add @xlt-token/nestjs @xlt-token/core
```

## 常见问题

**Q：自定义 Guard 继承 `XltAbstractLoginGuard` 需要改吗？**  
A：不需要，签名与回调保持不变。

**Q：`StpUtil.login()` 还能在 Controller 里用吗？**  
A：可以。Module 初始化时仍会 `setStpLogic`，静态门面行为不变。

**Q：Fastify 适配器支持吗？**  
A：2.0 Phase 2 仅保证默认 Express 适配器；Fastify 后续独立适配包。
