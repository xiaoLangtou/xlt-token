# Express 框架适配方案

> **状态**：实施规划  
> **目标包**：`@xlt-token/adapter-express`  
> **目标版本**：`2.0.0`（Phase 3）  
> **关联**：[12-multi-framework-architecture.md](../12-multi-framework-architecture.md) · Phase 3

本目录是 **Express 专属** 的适配设计与实施文档，从总架构文档中拆出，便于按文件分工落地。

---

## 文档索引

| 文件 | 内容 |
| --- | --- |
| [01-overview.md](./01-overview.md) | 目标、范围、与 monorepo 的关系 |
| [02-current-status.md](./02-current-status.md) | 已完成 vs 待建设（对照仓库现状） |
| [03-design-thinking.md](./03-design-thinking.md) | 设计思路：为何用中间件、state、与 core 分工 |
| [04-package-structure.md](./04-package-structure.md) | 包结构、依赖、文件职责 |
| [05-l2-adapter-layer.md](./05-l2-adapter-layer.md) | L2：`createExpressContext`、state 同步 |
| [06-l3-integration-api.md](./06-l3-integration-api.md) | L3：中间件、路由元数据、异常处理 |
| [07-nestjs-parity.md](./07-nestjs-parity.md) | NestJS Guard/Decorator ↔ Express 对照表 |
| [08-implementation-steps.md](./08-implementation-steps.md) | **分步实施计划**（PR 粒度、验收） |
| [09-testing.md](./09-testing.md) | 单测、E2E、行为契约 |
| [10-usage-examples.md](./10-usage-examples.md) | 完整集成示例 |
| [11-risks-and-migration.md](./11-risks-and-migration.md) | 风险、从 core 迁出、兼容策略 |

---

## 阅读顺序建议

1. **产品 / 架构**：`01` → `03` → `07`  
2. **开发落地**：`02` → `04` → `05` → `06` → **`08`**  
3. **联调 / QA**：`09` → `10`  
4. **发布前**：`11`

---

## 修订记录

| 日期 | 内容 |
| --- | --- |
| 2026-05-29 | 初稿：从多框架架构方案拆出 Express 专题目录 |
