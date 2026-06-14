# 02 · 架构设计

xlt-token 采用 **「框架无关核心 + 框架适配器」** 的 monorepo 结构。鉴权语义集中在 `@xlt-token/core`；NestJS 集成在 `@xlt-token/nestjs`。

> Express 适配器（`@xlt-token/express`）v1.0.0 已正式发布，提供中间件与路由策略覆盖。Hono / Fastify 等更多框架适配正在规划中。

## 包结构

| 包 | 职责 | 典型 import |
| --- | --- | --- |
| `@xlt-token/core` | 鉴权引擎、HttpContext、Store/Strategy 契约、Hooks、观测性 API | `createXltToken`, `StpLogic`, `MemoryStore` |
| `@xlt-token/nestjs` | Module、Guard、Decorator、RedisStore、JwtStrategy、Nest 异常包装 | `XltTokenModule`, `XltTokenGuard`, `@LoginId()` |
| `@xlt-token/express` | 中间件、路由策略、请求上下文适配 | `xltMiddleware`, `requireLogin`, `checkPermission` |

```
packages/
├── core/          # @xlt-token/core   — 框架零依赖
│   ├── auth/      # StpLogic / StpPermLogic / StpUtil
│   ├── config/    # XltTokenConfig + 存储键
│   ├── http/      # HttpContext + createExpressContext
│   ├── store/     # XltTokenStore + MemoryStore
│   ├── token/     # TokenStrategy + UuidStrategy
│   ├── hooks/     # XltHooks
│   └── factory.ts # createXltToken()
│
├── nestjs/        # @xlt-token/nestjs — NestJS 集成
│   ├── xlt-token.module.ts
│   ├── guards/
│   ├── decorators/
│   ├── store/redis-store.ts   # RedisStore（暂留 nestjs 包）
│   └── token/jwt-strategy.ts    # JwtStrategy（暂留 nestjs 包）
│
└── express/       # @xlt-token/express — Express 中间件
    ├── middleware/ # xltMiddleware / requireLogin / checkPermission / checkRole / checkSafe
    ├── auth/       # runAuth / shouldCheckLogin / resolveRouteAuthMeta
    ├── error/      # xltErrorHandler
    └── context.ts  # createExpressContext
```

## 设计目标

- **框架解耦**：核心层只依赖 `HttpContext` 抽象，不绑定 Express / NestJS 类型
- **可替换**：Token 生成策略、存储后端均通过接口注入
- **双形态 API**：
  - 实例形态 `StpLogic` → 便于测试与依赖注入
  - 静态门面 `StpUtil` → 非 DI 场景（拦截器 / 过滤器 / 脚本）直接调用

## 分层

```
┌────────────────────────────────────────────────────────────┐
│ L3  NestJS 集成（@xlt-token/nestjs）                        │
│     XltTokenModule / XltTokenGuard / @LoginId / @XltIgnore │
├────────────────────────────────────────────────────────────┤
│ L2  HttpContext 适配                                        │
│     createExpressContext(req, res) → HttpContext            │
├────────────────────────────────────────────────────────────┤
│ L1  核心运行时（@xlt-token/core）                           │
│     StpLogic / StpPermLogic / StpUtil / XltSession / Hooks │
├────────────────────────────────────────────────────────────┤
│ L0  抽象接口                                                │
│     XltTokenStore │ TokenStrategy │ StpInterface            │
├────────────────────────────────────────────────────────────┤
│ 实现 MemoryStore │ UuidStrategy │ RedisStore │ JwtStrategy  │
└────────────────────────────────────────────────────────────┘
```

NestJS 用户通过 `XltTokenModule.forRoot(...)` 注册 L0–L3 全部层；仅使用核心 API 时调用 `createXltToken({ ... })` 即可。

## 核心抽象：HttpContext

`StpLogic` 从请求中读取 token、写入登录态，全部通过 `HttpContext` 完成，不再直接依赖框架 Request 类型：

```ts twoslash
interface HttpContext {
  readonly headers: HttpHeaders;
  readonly cookies: HttpCookies;
  readonly query: HttpQuery;
  state: Record<string, unknown>;  // 核心写入 stpLoginId / stpToken / stpSession
  setHeader(name: string, value: string): void;
  setCookie(name: string, value: string, options?: CookieOptions): void;
  raw<T = unknown>(): T;
}
```

Guard 内部流程：`createExpressContext(req, res)` → `stpLogic.checkLogin(httpCtx)` → 将 `httpCtx.state` 映射回 `request.stpLoginId` / `request.stpToken`（保持 1.0 兼容）。

## 核心概念

- **loginId**：业务唯一用户标识。调用 `login(loginId)` 时传入。**不能为空，且不能包含 `:`**（会与存储键分隔符冲突）。
- **token**：`TokenStrategy` 生成的字符串，客户端持有。
- **HttpContext.state**：校验通过后核心层写入 `stpLoginId` / `stpToken`；NestJS 适配器同步到 `request` 供装饰器读取。
- **DI Token**（NestJS）：`XLT_TOKEN_CONFIG` / `XLT_TOKEN_STORE` / `XLT_TOKEN_STRATEGY`，在 `forRoot` 内注册。

## 三类存储键

全部以配置的 `tokenName` 作为前缀（源自 `packages/core/src/auth/stp-logic.ts`）：

| 键模板 | 值 | 用途 |
| --- | --- | --- |
| `${tokenName}:login:token:${token}` | `loginId` 或状态标记 | 通过 token 反查 loginId；被顶号时值为 `BE_REPLACED`；被踢时值为 `KICK_OUT` |
| `${tokenName}:login:session:${loginId}` | `token` | 通过 loginId 反查当前 token；用于顶号、按 loginId 登出 |
| `${tokenName}:login:lastActive:${token}` | `Date.now()` 毫秒字符串 | 仅当 `activeTimeout > 0` 时存在；用于活跃过期判定 |

以默认 `tokenName='authorization'` 为例：

```
authorization:login:token:550e8400-e29b-41d4-a716-446655440000   → "1001"
authorization:login:session:1001                                  → "550e8400-..."
authorization:login:lastActive:550e8400-...                       → "1700000000000"
```

1.1.0 起还支持 **device 维度**的 `session-list` 键，详见 [多端登录](/core/multi-device)。

## 并发 / 共享语义

由 `isConcurrent` 与 `isShare` 两个配置决定 `login(loginId)` 的行为：

| `isConcurrent` | `isShare` | 行为 |
| --- | --- | --- |
| `false` | *（忽略）* | 同 loginId 二次登录 → 旧 token 值置为 `BE_REPLACED`（**顶号**），生成新 token |
| `true` | `true` | 复用旧 token（**多端共享同一 token**） |
| `true` | `false` | 每次登录生成新 token，旧 token 仍然有效（**多端并发独立 token**） |

使用建议：

- **单设备强制（网银风格）**：`isConcurrent=false`
- **移动端 + 桌面端共用一份登录态**：`isConcurrent=true, isShare=true`
- **多端独立、互不影响**：`isConcurrent=true, isShare=false`

## 请求到授权的全链路（NestJS）

```
HTTP Request
    │
    ▼
XltTokenGuard
    │ 1. 读 @XltIgnore / defaultCheck 决定是否放行
    │ 2. createExpressContext(req, res)
    │ 3. StpLogic.checkLogin(httpCtx)
    │     ├─ getTokenValue(httpCtx)     // header → cookie → query
    │     ├─ store.get(tokenKey)        // 反查 loginId
    │     ├─ BE_REPLACED / KICK_OUT → 抛异常
    │     └─ activeTimeout 校验 + 刷新 lastActive
    │ 4. request.stpLoginId = httpCtx.state.stpLoginId
    │    request.stpToken   = httpCtx.state.stpToken
    │ 5.（子类钩子）加载用户信息到 request.user
    ▼
Controller handler
    │
    │ 通过 @LoginId() / @TokenValue() 获取身份
    ▼
Response
```

## 初始化：`createXltToken` 与 `StpUtil`

**NestJS 路径**：`XltTokenModule` 内部注册 `XLT_TOKEN_INIT` Provider，注入完成后调用 `setStpLogic(stpLogic)`，让静态门面 `StpUtil` 能取到实例。

**框架无关路径**：

```ts twoslash
import { createXltToken, StpUtil, MemoryStore } from '@xlt-token/core';

const xlt = createXltToken({
  config: { tokenName: 'authorization' },
  store: new MemoryStore(),
});
// createXltToken 内部已 setStpLogic，StpUtil 立即可用
```

⚠️ **只要未调用 `createXltToken` 或未引入 `XltTokenModule`，调用任何 `StpUtil.xxx()` 都会抛**：
> `StpLogic not initialized. Please ensure XltTokenModule is imported correctly.`

## 下一步

- 具体 API 签名 → [核心 API](/core/core-api)
- 自定义 Store / 策略 → [存储层](/core/storage) / [Token 策略](/core/token-strategy)
- NestJS Guard 与装饰器 → [守卫与装饰器](/adapters/nestjs/guards-and-decorators)
- 从 1.x 升级 → [2.0 迁移指南](/guide/migration-2-0)
- 登录异常处理 → [异常处理](/core/exceptions)
