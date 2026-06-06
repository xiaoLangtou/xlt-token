# 01 · 目标与范围

> 返回 [目录](./README.md)

---

## 1. 目标

在 `@xlt-token/core` 与 `@xlt-token/nestjs` 已就绪的前提下，新增 **`@xlt-token/express`**，使纯 Express 应用能以 **惯用中间件** 方式接入 xlt-token，并与 NestJS 1.x 行为保持一致。

用户侧期望：

```ts
import express from 'express';
import { createXltToken } from '@xlt-token/core';
import { xltMiddleware, xltErrorHandler } from '@xlt-token/express';

const xlt = createXltToken({ config: { tokenName: 'authorization' } });
const app = express();

app.use(xltMiddleware(xlt, {
  policies: [
    { match: '/public', ignore: true },
  ],
}));
app.get('/public', handler);
app.use(xltErrorHandler());
```

---

## 2. 职责边界

| 层级 | 包 | Express 侧职责 |
| --- | --- | --- |
| L1 | `@xlt-token/core` | `StpLogic` / `StpPermLogic` / `createXltToken` — **不改动** |
| L2 | `@xlt-token/express` | `(req, res)` → `HttpContext`；`state` ↔ `req` 同步 |
| L3 | `@xlt-token/express` | `xltMiddleware`、路由策略表、可选路由级 helper、`xltErrorHandler` |

**本包不做的事**

- 不重复实现 login / logout / kickout / 权限算法
- 不替代 Express 路由或 DI
- 不强制引入 `cookie-parser`（文档说明即可）

---

## 3. 与总架构文档的关系

| 总架构章节 | 本目录对应 |
| --- | --- |
| 四、HttpContext | [05-l2-adapter-layer.md](./05-l2-adapter-layer.md) |
| 六、适配器层 L2 | [05-l2-adapter-layer.md](./05-l2-adapter-layer.md) |
| 七、7.2 Express | [06-l3-integration-api.md](./06-l3-integration-api.md)、[10-usage-examples.md](./10-usage-examples.md) |
| 八、Monorepo 包结构 | [04-package-structure.md](./04-package-structure.md) |
| 九、行为契约 | [09-testing.md](./09-testing.md) |
| 十一、Phase 3 | [08-implementation-steps.md](./08-implementation-steps.md) |

---

## 4. 非目标（Express 范围外）

- Fastify / Koa / Hono 适配（各自独立包）
- 将 Express 路由策略统一成装饰器 DSL
- 在 adapter 内实现 Redis / JWT（仍用 core 或独立 store/strategy 包）

---

## 5. 成功标准

- [ ] `packages/adapter-express` 可独立 build、发布
- [ ] `defaultCheck` + 白名单/黑名单与 `XltTokenGuard` 行为一致
- [ ] 权限 / 角色 / 二级认证可通过策略表表达，并在鉴权前生效
- [ ] 路由级策略在鉴权前可见，不依赖后续 route middleware 写入 meta
- [ ] `req.stpLoginId` / `req.stpToken` 与 Nest 一致
- [ ] Express E2E 覆盖与 Nest 共享的场景表（登录、顶号、踢人、权限）
- [ ] `apps/playground/express` 可本地跑通 demo
