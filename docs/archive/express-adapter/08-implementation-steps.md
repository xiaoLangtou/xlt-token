# 08 · 分步实施计划

> 返回 [目录](./README.md)  
> 建议按 PR 拆分，每步可独立验收。

---

## 总览

| Step | 内容 | 预估 | 验收 |
| --- | --- | --- | --- |
| 1 | 包脚手架 + 迁入 `createExpressContext` | 0.5 天 | `pnpm build` 通过 |
| 2 | L2 单测 + core 兼容 re-export | 0.5 天 | core + adapter 测试绿 |
| 3 | `runAuth` + `shouldCheckLogin` + `matchIgnore` | 0.5 天 | 单元测试覆盖分支 |
| 4 | `xltMiddleware` + `syncExpressAuthState` | 1 天 | 手动 / 单测验证登录流 |
| 5 | 路由 meta 中间件族 | 0.5 天 | 与 Nest 矩阵用例一致 |
| 6 | `xltErrorHandler` | 0.5 天 | 401/403 body 快照 |
| 7 | nestjs 改依赖 adapter + playground | 1 天 | Nest E2E 仍绿 |
| 8 | Express E2E + 文档站入口 | 1 天 | 共享场景表通过 |

**合计**：约 5–6 人天。

---

## Step 1：创建 `packages/adapter-express`

### 思路

先搭空包，保证 workspace、tsdown、vitest 与 core 的 build 链打通。

### 操作清单

- [ ] `mkdir packages/adapter-express`
- [ ] 复制 `packages/core/package.json` / `tsdown.config.ts` / `tsconfig.json` 作模板并改 `name`
- [ ] `src/index.ts` 临时导出空对象或占位
- [ ] 根 `package.json` / `turbo.json` 如需显式任务则补充
- [ ] `pnpm install`

### 验收

```bash
pnpm --filter @xlt-token/adapter-express build
```

---

## Step 2：迁入 L2 — `createExpressContext`

### 思路

从 `packages/core/src/http/express.ts` 复制到 `adapter-express/src/context.ts`，类型改为 `Request` / `Response`。

### 操作清单

- [ ] 实现 `context.ts`（见 [05-l2-adapter-layer.md](./05-l2-adapter-layer.md)）
- [ ] 实现 `types.ts`、`sync-state.ts`
- [ ] 迁移 `packages/core/src/http/express.spec.ts` → adapter 包
- [ ] core `express.ts` 改为：

```ts
/** @deprecated Import from `@xlt-token/adapter-express` */
export { createExpressContext, type ExpressLikeRequest, type ExpressLikeResponse } from '@xlt-token/adapter-express';
```

- [ ] core `package.json` 增加对 adapter 的 **dev** 或 **optional** 依赖（仅 re-export 构建期需要）— 或 re-export 写在 nestjs/compat，core 直接删除导出（breaking，需 minor 说明）

**推荐**：core 保留 `ExpressLikeRequest` 类型 + deprecated re-export，adapter 为 canonical。

### 验收

- adapter 单测：`createExpressContext` 全绿
- core 现有测试仍绿（仍从 core 导入 deprecated API）

---

## Step 3：鉴权编排 — `runAuth` 等

### 思路

先写纯函数、不碰 HTTP 服务器，mock `XltTokenContext` 与 `HttpContext`。

### 操作清单

- [ ] `auth/should-check-login.ts`
- [ ] `auth/match-ignore.ts`
- [ ] `auth/run-auth.ts`（见 [06-l3-integration-api.md](./06-l3-integration-api.md)）
- [ ] vitest：覆盖 `defaultCheck` true/false × ignore/require 四种组合
- [ ] vitest：`runAuth` 在 mock `checkLogin` throw 时向上抛

### 验收

```bash
pnpm --filter @xlt-token/adapter-express test
```

---

## Step 4：全局中间件 `xltMiddleware`

### 思路

组合 Step 2 + Step 3，对外暴露主入口。

### 操作清单

- [ ] `middleware/xlt-middleware.ts`
- [ ] 导出 `XltMiddlewareOptions`
- [ ] 单测：mock `req`/`res`/`next`，断言 `next()` / `next(err)` / `stpLoginId` 赋值

### 验收

- 无 token 请求 → `next(NotLoginException)`
- `ignore: ['/health']` → 直接 `next()`
- 有效 token（MemoryStore + `createXltToken`）→ `req.stpLoginId` 有值

---

## Step 5：路由 meta 中间件

### 思路

每个 helper 仅写 `req._xltRouteMeta`，单测断言 meta 合并正确。

### 操作清单

- [ ] `ignore-auth.ts`、`require-login.ts`
- [ ] `check-permission.ts`、`check-role.ts`、`check-safe.ts`
- [ ] 集成单测：Router 上 `ignoreAuth` + `xltMiddleware` 顺序（见 [06-l3-integration-api.md](./06-l3-integration-api.md#6-推荐挂载顺序)）

### 验收

行为与 [07-nestjs-parity.md](./07-nestjs-parity.md) 矩阵一致。

---

## Step 6：错误处理

### 操作清单

- [ ] `error/xlt-error-handler.ts`
- [ ] 快照测试 401/403 JSON body

### 验收

```ts
// 伪代码
const err = new NotLoginException(NotLoginType.INVALID_TOKEN, 'tok');
handler(err, req, res, next);
expect(res.statusCode).toBe(401);
```

---

## Step 7：Nest 桥接 + Playground

### 思路

Nest 与 Express 共用 adapter，避免双实现。

### 操作清单

- [ ] `packages/nestjs/package.json` 增加 `@xlt-token/adapter-express` 依赖
- [ ] `nest-bridge.ts`：`import { createExpressContext } from '@xlt-token/adapter-express'`
- [ ] 跑通 `packages/nestjs` 全部 E2E
- [ ] 新建 `apps/playground/express`：
  - `createXltToken` + MemoryStore
  - POST `/auth/login`、GET `/me`、GET `/health` + `ignoreAuth`
  - README 说明启动方式

### 验收

```bash
pnpm --filter @xlt-token/nestjs test:e2e
# playground 手动 curl 登录 /me
```

---

## Step 8：Express E2E + 文档

### 操作清单

- [ ] `e2e/shared/scenarios.ts`（从 nestjs test 抽取场景描述）
- [ ] `e2e/express.e2e.ts`（supertest）
- [ ] VitePress：`docs/.vitepress/config.mts` 增加 Frameworks → Express 链接
- [ ] 可选：将 `docs/express-adapter/README.md` 链入侧边栏

### 验收

- Express E2E 与 Nest 同场景断言一致
- CI `turbo test` 包含 adapter-express

---

## 实施顺序依赖图

```
Step 1 ──► Step 2 ──► Step 3 ──► Step 4
                      │           │
                      └─────┬─────┘
                            ▼
                      Step 5 ──► Step 6
                            │
                            ▼
                      Step 7 ──► Step 8
```

Step 7 可与 Step 5–6 并行（不同开发者），但 Step 7 依赖 Step 2 的 `createExpressContext` 稳定。

---

## 发布检查清单

- [ ] `CHANGELOG` 增加 `@xlt-token/adapter-express` 初始版本
- [ ] README：安装、`peerDependencies`、cookie-parser 说明
- [ ] npm `files` 仅含 `dist`
- [ ] 与 core 主版本对齐（如 core `2.0.0` → adapter `2.0.0`）
