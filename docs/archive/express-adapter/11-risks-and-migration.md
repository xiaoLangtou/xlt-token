# 11 · 风险、迁移与待定项

> 返回 [目录](./README.md)

---

## 1. `createExpressContext` 从 core 迁出

| 风险 | 缓解 |
| --- | --- |
| 现有用户从 `@xlt-token/core` 导入 | 保留 **至少一个 minor** 的 deprecated re-export |
| core 构建依赖 adapter 形成环 | re-export 使用 **types-only** 或文档要求先装 adapter；或 Phase 3.1 再删 core 导出 |
| Nest 双路径 | Step 7 统一 nestjs → adapter-express |

**Breaking 时间表建议**

| 版本 | 行为 |
| --- | --- |
| `2.0.0-rc` | core 导出 deprecated `createExpressContext` |
| `2.0.0` | 文档改为仅从 adapter 导入 |
| `2.1.0` 或 `3.0.0` | 删除 core 中的 re-export |

---

## 2. Express 中间件顺序

| 风险 | 缓解 |
| --- | --- |
| 全局 `xltMiddleware` 在 router 前注册，读不到 `ignoreAuth` meta | 文档 **强制推荐** Router 级 `api.use(xltMiddleware)`；示例见 [10-usage-examples.md](./10-usage-examples.md) |
| 用户误用顺序 | playground 与 E2E 仅演示推荐写法 |

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
| `req.path` 与 `baseUrl` 组合导致 ignore 不匹配 | `matchIgnore` 使用 `req.originalUrl` 或文档说明仅匹配 `path` |
| 多 Router 嵌套 | 每级 Router 自行 `use(xltMiddleware)` 或仅顶层一次 |

**待定**：是否在 `XltMiddlewareOptions` 增加 `match: (req) => boolean` 自定义函数。

---

## 7. 版本与发布

- adapter 主版本 **跟随 core**（如均为 `2.0.x`）
- Changesets 同仓发布，避免用户装 `core@2.0` + `adapter@1.0` 不兼容组合

---

## 8. 待定 TODO

| 优先级 | 项 |
| --- | --- |
| P0 | Router 级 vs App 级 middleware 在 README 二选一写死为推荐 |
| P1 | `createXltAuthMiddleware` 是否首版就导出 |
| P1 | `e2e/shared` 场景表抽取时机（Step 8 前或后） |
| P2 | 是否提供 `express.Router` 工厂 `createXltRouter(xlt)` 封装顺序 |
| P2 | Redis / JWT 示例是否放在 playground |

---

## 9. 修订时需同步的文件

变更 Express API 时，请同步更新：

- 本目录 `06`、`08`、`10`
- [12-multi-framework-architecture.md](../12-multi-framework-architecture.md) 第七节 7.2
- VitePress 侧边栏（若已上线 Frameworks 页）
