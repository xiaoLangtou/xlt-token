# xlt-token 文档

> 框架无关 Token 鉴权库。核心、Redis Store、NestJS 与 Express 适配器按包解耦。

在线文档：[VitePress 站点](/)（本地：`pnpm docs:dev`）

## 快速导航

| 分区 | 文档 | 适合场景 |
| --- | --- | --- |
| **指南** | [选择接入方式](/guide/getting-started) | 在 Core、NestJS 和后续框架适配器之间选择入口 |
| | [架构设计](/guide/architecture) | 了解 monorepo 分层、HttpContext、存储键 |
| | [工程化门禁](/guide/engineering) | 查看支持矩阵、CI、包边界、发布与回退要求 |
| | [迁移指南](/guide/migration-2-0) | 从旧版单包升级、包职责说明 |
| **Core** | [Core 快速开始](/core/getting-started) | 框架无关地创建 `createXltToken` 实例 |
| | [配置参考](/core/configuration) | 查阅 `XltTokenConfig` 与 `createXltToken` 选项 |
| | [核心 API](/core/core-api) | `StpLogic` / `StpUtil` 所有方法 |
| | [权限与会话](/core/permissions-and-session) | `StpInterface`、`XltSession`、权限装饰器语义 |
| | [Store 契约与内存存储](/core/storage) | `XltTokenStore` / `MemoryStore` / 自定义 Store |
| | [Token 策略](/core/token-strategy) | UUID / JWT 策略与自定义 |
| **Redis Store** | [完整使用指南](/store-redis/) | node-redis、ioredis、Cluster 和三种框架接入 |
| **适配器** | [适配器总览](/adapters) | 查看可用框架适配器 |
| **NestJS** | [快速开始](/adapters/nestjs/getting-started) | 第一次接入 NestJS，5 分钟跑通登录/登出 |
| | [模块配置](/adapters/nestjs/module-config) | `XltTokenModule.forRoot` / `forRootAsync` |
| | [守卫与装饰器](/adapters/nestjs/guards-and-decorators) | `XltTokenGuard`、`@LoginId`、`@XltIgnore` |
| **Express** | [Express 完整指南](/adapters/express) | 在纯 Express 应用中使用中间件、路由策略和错误处理器 |
| **2.x** | [多端登录](/core/multi-device) · [二级认证](/core/secondary-auth) · [JWT](/core/jwt-strategy) · [审计事件](/core/hooks-and-observability) | 当前主版本专题 |
| **进阶** | [异常处理](/core/exceptions) · [场景手册](/core/recipes) | 实战与排错 |
| **参考** | [AI 编码代理指南](/reference/llms) · [更新日志](/reference/changelog) · [源码参考](/reference/src-reference) | AI 入口、发布说明与单文件速查 |

## 包结构与 import

| 能力 | `core` | `store-redis` | `nestjs` | `express` |
| --- | --- | --- | --- | --- |
| `StpLogic` / `createXltToken` | ✅ | — | ✅ re-export | ✅ re-export |
| `MemoryStore` / `UuidStrategy` | ✅ | — | ✅ re-export | ✅ re-export |
| `RedisStore` / `IORedisStore` | — | ✅ | deprecated 包装器 | — |
| Module / Guard / Decorator / JWT | — | — | ✅ | — |
| Middleware / route helper / error handler | — | — | — | ✅ |

**安装**：

```bash
pnpm add @xlt-token/nestjs
pnpm add express @xlt-token/express
pnpm add @xlt-token/store-redis redis
pnpm add jsonwebtoken       # 可选：JwtStrategy
```

**import 约定**：

- Redis 存储实现 → `@xlt-token/store-redis`
- NestJS 集成（Module、Guard、Decorator、JWT）→ `@xlt-token/nestjs`
- Express 集成（Middleware、route helper、错误处理器）→ `@xlt-token/express`
- 框架无关核心（`createXltToken`、类型、自定义 Store 接口）→ `@xlt-token/core`

## 文档约定

- 源码路径使用 monorepo 绝对路径，例：`packages/core/src/auth/stp-logic.ts`
- 涉及 **Redis key** 时会同时给出键名模板与示例

## 其他

- 规划 / 实施 / 架构设计等内部文档：[archive/](./archive/)
- 项目 README：[../README.md](../README.md)
