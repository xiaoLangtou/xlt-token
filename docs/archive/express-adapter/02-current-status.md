# 02 · 现状对照（已完成 vs 待建设）

> 返回 [目录](./README.md)  
> 对照仓库：`packages/core`、`packages/nestjs`（截至 2026-05）

---

## 1. 可直接复用

| 能力 | 位置 | Express 适配如何使用 |
| --- | --- | --- |
| `HttpContext` 接口 | `packages/core/src/http/context.ts` | L2 实现目标形态 |
| `createExpressContext` | `packages/core/src/http/express.ts` | **待迁入** adapter-express；逻辑已验证 |
| `StpLogic.checkLogin(ctx)` | `packages/core/src/auth/stp-logic.ts` | 失败时 **throw** `NotLoginException` |
| `createXltToken()` | `packages/core/src/factory.ts` | Express 应用入口工厂 |
| `StpPermLogic` | `packages/core/src/auth/stp-perm-logic.ts` | `runAuth` 内调用 |
| 元数据 key 常量 | `packages/core/src/const/index.ts` | `XLT_IGNORE_KEY` 等（Express 用 req 元数据替代 Reflector） |
| Nest 参考实现 | `packages/nestjs/src/guards/xlt-token.guard.ts` | 黑/白名单、权限、safe 逻辑 **1:1 平移** |
| Nest HTTP 桥接 | `packages/nestjs/src/http/nest-bridge.ts` | `createNestHttpContext` → `createExpressContext` |

---

## 2. 与架构草案的差异（以实码为准）

| 点 | 架构文档 10.2 草稿 | **当前 core 实码** | Express 适配应遵循 |
| --- | --- | --- | --- |
| `checkLogin` 失败 | 返回 `result.ok === false` | **抛出** `NotLoginException` | 中间件 `try/catch` + `next(err)` |
| `state` 写入 | 文档示例在 `checkLogin` 内写 state | `_resolveLoginId` 已写 `ctx.state.stpLoginId` | 成功后 `syncExpressAuthState` 同步到 `req` |

---

## 3. 待建设清单

| 序号 | 项 | 说明 |
| --- | --- | --- |
| 1 | `packages/adapter-express` 包 | 脚手架、tsdown、workspace |
| 2 | 从 core 迁出 `createExpressContext` | core 保留 deprecated 旧实现，adapter 成为 canonical |
| 3 | `xltMiddleware` | 全局登录校验 |
| 4 | `RouteAuthPolicy` / `resolveRouteAuthMeta` | 在鉴权前按 method + path 解析路由策略 |
| 5 | `ignoreAuth` / `requireLogin` / `checkPermission` / `checkRole` / `checkSafe` | 可选 route-local helper，仅用于与 `xltMiddleware` 同链且位于其前面的场景 |
| 6 | `runAuth` | 编排 checkLogin + 权限 + safe |
| 7 | `xltErrorHandler` | core 异常 → 401/403 JSON |
| 8 | Express `Request` 类型增强 | `stpLoginId`、`stpToken`、`_xltRouteMeta` |
| 9 | `apps/playground/express` | 最小 demo |
| 10 | `e2e/express.e2e.ts` | 共享场景表 |

---

## 4. Phase 前置条件

| Phase | 状态 | 说明 |
| --- | --- | --- |
| Phase 1 core 剥离 | ✅ 已完成 | `packages/core` 含完整 `StpLogic` |
| Phase 2 NestJS 独立 | ✅ 已完成 | `packages/nestjs` + Guard 已 HttpContext 化 |
| Phase 3 Express 适配 | ⏳ 本文档范围 | 新建 `adapter-express` |

---

## 5. 依赖关系图

```
@xlt-token/core
       ↑
@xlt-token/adapter-express  (peer: express)
       ↑（可选，Phase 3 后）
@xlt-token/nestjs           可改为依赖 adapter-express 的 createExpressContext
```

NestJS 与 Express **共享同一套** `HttpContext` 实现，避免 token 读取顺序、state 字段名分叉。
