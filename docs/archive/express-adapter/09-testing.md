# 09 · 测试与验收

> 返回 [目录](./README.md)

---

## 1. 测试分层

| 层级 | 范围 | 工具 |
| --- | --- | --- |
| 单元测试 | L2 context、L3 纯函数、middleware（mock req/res） | Vitest |
| 集成测试 | `runAuth` + 真实 `createXltToken` + MemoryStore | Vitest |
| E2E | HTTP 全链路 | Vitest + supertest |
| 契约测试 | 与 Nest 共享场景表 | `e2e/shared/` |

目标覆盖率：adapter 包 **≥ 90%**（与总架构第十二章一致）。

---

## 2. 单元测试清单

### 2.1 `createExpressContext`

| 用例 | 断言 |
| --- | --- |
| 读取 header | `authorization: Bearer x` → getTokenValue 可得 `x` |
| 读取 cookie | `req.cookies[tokenName]` |
| 读取 query | `?authorization=tk` |
| state 引用 | 两次调用同一 `req`，`state` 引用相等 |
| setCookie | `res.cookie` 被调用 |

### 2.2 `shouldCheckLogin`

| defaultCheck | meta | 期望 |
| --- | --- | --- |
| true | 无 | 校验 |
| true | ignore | 跳过 |
| false | 无 | 跳过 |
| false | requireLogin | 校验 |

### 2.3 `resolveRouteAuthMeta` / `matchIgnore`

- 精确路径 `/health`
- 前缀 `/public/`
- RegExp `^/api/docs`
- function matcher `(req) => req.method === 'POST'`
- `methods` 限制只匹配指定 HTTP method
- 多条 policy 命中时，后声明的 `ignore` / `requireLogin` 覆盖前声明策略

### 2.4 `xltMiddleware`

- 跳过 ignore 路径或 ignore policy → `next` 无 err
- 无 token → `next(err)` 且 `err instanceof NotLoginException`
- 有效 token → `req.stpLoginId` 定义
- 命中权限 policy → 调用 `stpPermLogic.checkPermission`
- 命中 safe policy → 调用 `stpLogic.checkSafe`

### 2.5 `xltErrorHandler`

- `NotLoginException` → 401 + body.type
- `NotPermissionException` → 403 + body.permission
- 未知错误 → `next(err)` 透传

---

## 3. E2E 共享场景（与 Nest 对齐）

建议在 `e2e/shared/scenarios.ts` 定义：

| 场景 ID | 描述 | 关键断言 |
| --- | --- | --- |
| `login-logout` | 登录拿 token，访问 `/me`，登出后再访问 | 401 `NOT_TOKEN` / `INVALID_TOKEN` |
| `kickout` | A 登录，kickout，A 再请求 | 401 `KICK_OUT` |
| `be-replaced` | 非并发登录顶号 | 401 `BE_REPLACED` |
| `active-timeout` | `activeTimeout` 超时 | 401 `TOKEN_TIMEOUT` |
| `ignore-route` | `/public` 无 token 可访问 | 200 |
| `permission-deny` | 无权限访问管理接口 | 403 |
| `permission-allow` | 有权限访问 | 200 |

Express setup 模板：

```ts
function createExpressApp(xlt: XltTokenContext) {
  const app = express();
  app.use(express.json());
  const api = express.Router();
  api.use(xltMiddleware(xlt, {
    policies: [
      { match: '/api/public', ignore: true },
      { match: '/api/admin', permissions: { list: ['admin:*'], mode: XltMode.AND } },
    ],
  }));
  // 注册路由...
  app.use('/api', api);
  app.use(xltErrorHandler());
  return app;
}
```

Nest setup 保持现有 `Test.createTestingModule`，**断言函数共用**。

---

## 4. 行为契约自检（第九章）

| 契约 | 测试方式 |
| --- | --- |
| token 顺序 header → cookie → query | 单测 mock 三种来源优先级 |
| state 字段名 | 登录后 `ctx.state` 与 `req.stpLoginId` 一致 |
| defaultCheck + ignore/require | `resolveRouteAuthMeta` + `shouldCheckLogin` 矩阵 |
| route helper 顺序陷阱 | 反例 E2E，证明后置 helper 不能作为推荐模式 |
| 异常含 `type` | E2E 快照 body |
| Session API | E2E `xlt.stpLogic.getSession` |
| Hooks | E2E mock `onLogin` 被调用 |

---

## 5. CI 集成

```yaml
# 概念性任务
- pnpm --filter @xlt-token/core test
- pnpm --filter @xlt-token/express test
- pnpm --filter @xlt-token/nestjs test:e2e
- pnpm e2e:express  # 根脚本聚合
```

`turbo.json` 使用当前仓库的通用 `test` 任务即可。新包提供 `test` script 后，`turbo run test` 会按 workspace 依赖图调度。

---

## 6. 验收签字表

| 项 | 负责人 | 状态 |
| --- | --- | --- |
| adapter 单测 ≥ 90% | — | ⬜ |
| Nest E2E 回归无退化 | — | ⬜ |
| Express E2E 共享场景全过 | — | ⬜ |
| playground 文档可运行 | — | ⬜ |
| 与 07-nestjs-parity 矩阵人工走查 | — | ⬜ |
