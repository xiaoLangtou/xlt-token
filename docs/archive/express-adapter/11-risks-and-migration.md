# 11 · 风险、迁移与待定项

> 返回 [目录](./README.md)

---

## 1. `createExpressContext` 从 core 迁出

| 风险 | 缓解 |
| --- | --- |
| 现有用户从 `@xlt-token/core` 导入 | 保留 **至少一个 minor** 的 deprecated 旧实现 |
| core 构建依赖 adapter 形成环 | core 不反向依赖 adapter；core 暂时保留旧实现并标记 deprecated，后续 breaking 版本删除 |
| Nest 双路径 | Step 7 统一 nestjs → adapter-express |

**Breaking 时间表建议**

| 版本 | 行为 |
| --- | --- |
| `2.0.0-rc` | core 保留 deprecated `createExpressContext` 旧实现 |
| `2.0.0` | 文档改为仅从 adapter 导入 |
| `2.1.0` 或 `3.0.0` | 删除 core 中的 re-export |

---

## 2. Express 中间件顺序

| 风险 | 缓解 |
| --- | --- |
| 全局或 Router 级 `xltMiddleware` 先于 route helper 执行，读不到后续 helper 写入的 meta | 首选 API 改为 `policies` 策略表，由 `xltMiddleware` 在鉴权前解析 |
| 用户误用 `api.use(xltMiddleware); api.get('/public', ignoreAuth(), handler)` | README、playground 与 E2E 只演示策略表；测试加入该反例 |

---

## 3. `cookie-parser` 未安装

| 风险 | 缓解 |
| --- | --- |
| `isReadCookie: true` 但无 `req.cookies` | README 与 10 示例注明 peer 推荐；`cookies.get` 返回 null |

---

## 4. 与 Nest 混用

| 风险 | 缓解 |
| --- | --- |
| 同进程 Nest + 裸 Express 各 `createXltToken` | 文档明确：共享 **同一** `XltTokenContext` 实例；Store 才一致 |
| 两套中间件重复鉴权 | 仅选一种入口（Guard 或 xltMiddleware） |

---

## 5. 异步 Cookie（Hono / Elysia）

Express 适配 **不涉及** `HttpCookies.get` 异步化。

若总架构 Phase 1 后决定 async 化，Express 保持同步包装即可；见 [12-multi-framework-architecture.md](../12-multi-framework-architecture.md) 第四节警告。

---

## 6. 自定义 Router / 嵌套路径

| 风险 | 缓解 |
| --- | --- |
| `req.path` 与 `baseUrl` 组合导致策略不匹配 | `matchPolicy` 使用 `req.originalUrl`；文档示例在策略中包含挂载前缀 |
| 多 Router 嵌套 | 策略 matcher 支持函数，复杂场景可按 `req.baseUrl` / `req.path` 自定义 |

`XltMiddlewareOptions` 必须支持函数 matcher：`(req) => boolean`。

---

## 7. 版本与发布

- adapter 主版本 **跟随 core**（如均为 `2.0.x`）
- Changesets 同仓发布，避免用户装 `core@2.0` + `adapter@1.0` 不兼容组合

---

## 8. 待定 TODO

| 优先级 | 项 |
| --- | --- |
| P0 | README 写死推荐 `xltMiddleware + policies`，不要推荐后置 route helper |
| P1 | `createXltAuthMiddleware` 是否首版就导出 |
| P1 | `e2e/shared` 场景表抽取时机（Step 8 前或后） |
| P2 | 是否提供 `express.Router` 工厂 `createXltRouter(xlt)` 来生成策略表或封装 route 注册 |
| P2 | Redis / JWT 示例是否放在 playground |

---

## 9. 修订时需同步的文件

变更 Express API 时，请同步更新：

- 本目录 `06`、`08`、`10`
- [12-multi-framework-architecture.md](../12-multi-framework-architecture.md) 第七节 7.2
- VitePress 侧边栏（若已上线 Frameworks 页）
