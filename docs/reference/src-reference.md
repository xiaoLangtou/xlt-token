---
title: xlt-token 源码 API 参考
description: 按当前公共导出快速定位 xlt-token 的 Core、Store、NestJS、Express、Fastify 与 JWT 源码入口。
---

# xlt-token 源码 API 参考

这份页面按当前 `v2.3` 包边界组织。公共 API 以每个包的 `src/index.ts` 为准；内部实现可以演进，不能作为兼容性承诺。

## 包与入口

| 包 | 职责 | 公共入口 | 关键实现 |
| --- | --- | --- | --- |
| `@xlt-token/core` | 鉴权语义、Store 契约、Token 策略、生命周期、权限、Session、HTTP 抽象 | `packages/core/src/index.ts` | `auth/stp-logic.ts`、`instance/xlt-instance.ts` |
| `@xlt-token/store-redis` | node-redis / ioredis Store | `packages/store-redis/src/index.ts` | `redis-store.ts`、`ioredis-store.ts` |
| `@xlt-token/jwt` | `kid` 轮换 JWT 策略 | `packages/jwt/src/index.ts` | `jwt-strategy.ts`、`jwt-config.ts` |
| `@xlt-token/nestjs` | Module、Guard、Decorator、NestJS 异常封装 | `packages/nestjs/src/index.ts` | `xlt-token.module.ts`、`guards/`、`decorators/` |
| `@xlt-token/express` | Middleware、路由策略、错误处理 | `packages/express/src/index.ts` | `middleware/xlt-middleware.ts`、`auth/run-auth.ts` |
| `@xlt-token/fastify` | 显式实例 Plugin、`preHandler`、路由策略 | `packages/fastify/src/index.ts` | `plugin.ts`、`resolve-auth-meta.ts` |
| `xlt-token` | NestJS 兼容导出 | `src/index.ts` | 根包构建入口 |

## Core

### 实例边界

- `createXltToken(options)`：创建实例并注册全局 `StpUtil`。适合单认证域应用。
- `createXltInstance(options)`：创建隔离实例，不写入全局状态。适合 Fastify、插件化或同进程多认证域。
- `setDefaultXltInstance(instance)` / `getDefaultXltInstance()`：显式管理静态门面的绑定目标。

Core 的主要服务是 `StpLogic`（登录、登出、校验、Session、临时 token、生命周期）与
`StpPermLogic`（权限、角色）。业务应用负责账号凭证校验与用户资料加载。

### 生命周期与 Store

`config.lifecycle` 开启后，`refreshToken(token)` 用 token family 实现旋转和重放检测；
`revoke(target, 'family')` 吊销 family。实现 Store 时必须支持原子 `compareAndSet`、
`compareAndDelete` 与 `getAndDelete`，否则刷新轮转和一次性临时 token 不具备并发安全性。

`XltTokenKeys` 统一生成状态键。生命周期键使用 hash tag：
`{tokenName}:lifecycle:{familyId}:state` 与
`{tokenName}:lifecycle:{familyId}:generation:{generation}`，方便 Redis Cluster 中相关键落在同一 slot。

## 适配器

| 适配器 | 初始化方式 | 路由元数据 | 请求成功后的状态 |
| --- | --- | --- | --- |
| NestJS | `XltTokenModule.forRoot()` + `XltTokenGuard` | Decorator | `@LoginId()` / `@TokenValue()` |
| Express | `createXltToken()` + `xltMiddleware()` | helper 或 `policies` | `req.stpLoginId`、`req.stpToken`、`req.stpSession` |
| Fastify | `createXltInstance()` + `xltFastifyPlugin` | `policies` 或 `config.xlt` | `request.stpLoginId`、`request.stpToken`、`request.stpSession` |

Fastify Plugin 只接受显式 `instance`，不会读取 `StpUtil`。启用 Cookie token 来源时，应用必须先注册 `@fastify/cookie`。

## 文档与测试入口

- Core API： [核心 API](/core/core-api)
- 生命周期配置： [配置参考](/core/configuration#token-生命周期)
- NestJS： [快速开始](/adapters/nestjs/getting-started)
- Express： [完整指南](/adapters/express)
- Fastify： [完整指南](/adapters/fastify)
- Redis： [Redis Store](/store-redis/)

| 变更范围 | 验证命令 |
| --- | --- |
| Core | `pnpm --filter @xlt-token/core test` |
| Redis Store | `pnpm --filter @xlt-token/store-redis test` |
| NestJS | `pnpm --filter @xlt-token/nestjs test`；请求链路再加 `test:e2e` |
| Express | `pnpm --filter @xlt-token/express test`；中间件再加 `test:e2e` |
| Fastify | `pnpm --filter @xlt-token/fastify test`；Plugin / Hook 再加 `test:e2e` |
| 公开导出或工作区 | `pnpm build:workspace` |
