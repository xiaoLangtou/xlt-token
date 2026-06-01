# 04 · 包结构与依赖

> 返回 [目录](./README.md)

---

## 1. Monorepo 位置

```
xlt-token/
├── packages/
│   ├── core/                    # @xlt-token/core
│   ├── nestjs/                  # @xlt-token/nestjs
│   └── adapter-express/         # @xlt-token/adapter-express  ← 新建
├── apps/
│   └── playground/
│       └── express/             # demo
└── e2e/
    └── express.e2e.ts           # 跨框架场景
```

---

## 2. `package.json` 草案

```json
{
  "name": "@xlt-token/adapter-express",
  "version": "0.0.0",
  "type": "module",
  "dependencies": {
    "@xlt-token/core": "workspace:*"
  },
  "peerDependencies": {
    "express": "^4.18.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "express": "^4.22.0",
    "vitest": "workspace:*"
  }
}
```

**说明**

- `express` 仅 peer，不 bundled
- `@types/express` 仅开发期；发布 types 随包输出
- 不依赖 `@xlt-token/nestjs`

---

## 3. 源码目录

```
packages/adapter-express/
├── package.json
├── tsconfig.json
├── tsdown.config.ts
├── vitest.config.ts
└── src/
    ├── index.ts                 # 公共导出
    ├── context.ts               # createExpressContext
    ├── types.ts                 # RouteAuthMeta、Request 增强
    ├── sync-state.ts            # ctx.state → req
    ├── auth/
    │   ├── should-check-login.ts
    │   ├── resolve-route-auth-meta.ts
    │   ├── run-auth.ts
    │   └── match-ignore.ts
    ├── middleware/
    │   ├── xlt-middleware.ts
    │   ├── ignore-auth.ts
    │   ├── require-login.ts
    │   ├── check-permission.ts
    │   ├── check-role.ts
    │   └── check-safe.ts
    └── error/
        ├── map-xlt-error.ts
        └── xlt-error-handler.ts
```

---

## 4. 公共导出（`index.ts`）

```ts
// L2
export { createExpressContext } from './context.js';
export type { ExpressLikeRequest, ExpressLikeResponse } from './context.js';

// L3 — 中间件
export { xltMiddleware } from './middleware/xlt-middleware.js';
export type { XltMiddlewareOptions } from './middleware/xlt-middleware.js';
export { ignoreAuth } from './middleware/ignore-auth.js';
export { requireLogin } from './middleware/require-login.js';
export { checkPermission } from './middleware/check-permission.js';
export { checkRole } from './middleware/check-role.js';
export { checkSafe } from './middleware/check-safe.js';

// L3 — 错误处理
export { xltErrorHandler } from './error/xlt-error-handler.js';

// 编排（高级用法 / 自定义中间件）
export { runAuth } from './auth/run-auth.js';
export { shouldCheckLogin } from './auth/should-check-login.js';
export { resolveRouteAuthMeta } from './auth/resolve-route-auth-meta.js';
export { syncExpressAuthState } from './sync-state.js';

// 类型
export type { AuthMatcher, RouteAuthMeta, RouteAuthPolicy } from './types.js';
```

---

## 5. Turbo / workspace

`pnpm-workspace.yaml` 已包含 `packages/*`，新建目录即可。

当前根 `turbo.json` 已定义通用 `build`、`test`、`test:cov` 任务。新包只需要在自己的 `package.json` 中提供同名 scripts，Turbo 会通过 workspace 依赖图让 `@xlt-token/adapter-express` 的任务依赖 `@xlt-token/core` 的构建产物。

---

## 6. 代码量预估

| 模块 | 行数（约） |
| --- | --- |
| context + types + sync-state | 80 |
| auth 编排 | 60 |
| middleware 族 | 120 |
| error | 50 |
| 单测 | 200 |
| **合计** | ~350–450（不含 E2E） |
