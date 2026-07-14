---
title: 工程化门禁
description: xlt-token 的支持矩阵、包边界、CI、发布和回退门禁。
---

# 工程化门禁

xlt-token 的工程化目标是让构建、测试、文档和发布流程可重复、可追溯、可回退。Core 保持零框架依赖，适配器保持薄层，存储实现必须通过同一组行为断言。

## 支持矩阵

| 范围 | 当前门禁 |
| --- | --- |
| Node.js | CI 覆盖 Node.js 20 与 22 |
| 包管理器 | `pnpm@10.15.1`，使用 `pnpm install --frozen-lockfile` |
| Core | 不依赖任何框架包，不直接依赖 Redis |
| Redis Store | `redis@4/5` 与 `ioredis@5` 作为可选 peer dependency |
| NestJS | `@nestjs/common` / `@nestjs/core` 10、11、12 |
| Express | Express 4.18+ 与 5.x peer range |

## 包边界

包之间只能通过公开包名导入，不允许跨包相对引用其他包的 `src`。当前允许关系：

| 包 | 允许依赖 |
| --- | --- |
| `@xlt-token/core` | 自身 |
| `@xlt-token/store-redis` | `@xlt-token/core` |
| `@xlt-token/express` | `@xlt-token/core` |
| `@xlt-token/nestjs` | `@xlt-token/core`、`@xlt-token/store-redis` |

本地检查：

```bash
pnpm run check:boundaries
```

新增官方包时，需要同步更新 `scripts/check-package-boundaries.mjs` 的允许关系。

## PR 门禁

每个 PR 必须通过：

```bash
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run check:boundaries
pnpm run test:all
pnpm run build:workspace
```

也可以使用聚合命令：

```bash
pnpm run check:quality
```

格式化和 lint 使用 Oxlint / Oxfmt：

```bash
pnpm run format
pnpm run lint:fix
```

CI 会在 Node.js 20 和 22 上运行同一组门禁，并单独执行文档构建：

```bash
pnpm run docs:build
```

## RC 门禁

进入 RC 前必须完成：

| 门禁 | 要求 |
| --- | --- |
| 兼容矩阵 | Node、NestJS、Express、Redis 相关组合没有阻断失败 |
| 存储一致性 | MemoryStore、RedisStore、IORedisStore 的关键行为一致 |
| 并发与恢复 | 覆盖并发登录、踢人、续签、过期和失败恢复场景 |
| 文档示例 | README、包 README、站点文档中的关键示例与真实 API 一致 |
| 安全检查 | 无已知高危漏洞、无密钥泄漏、无危险默认配置进入 RC |

## Stable 门禁

Stable 发布前必须满足：

- RC 观察至少 7 天。
- 阻断级问题为 0。
- CHANGELOG、迁移说明、安全说明和回退方案齐备。
- 发布产物来自 tag 对应 commit，并保留 GitHub Release 记录。

## 发布与回退

发布稳定版：

```bash
pnpm run publish:dry-run
pnpm run build:workspace
pnpm publish -r --access public --no-git-checks
```

GitHub Release 发布后会触发 npm publish workflow。若发布后发现阻断级问题：

1. 立即在 GitHub Release 和文档中标注风险。
2. 发布修复 patch，优先保持 API 兼容。
3. 如需回退 npm dist-tag，使用 npm 后台或 npm CLI 将 `latest` 指回上一个稳定版本。
4. 在 CHANGELOG 中记录影响范围、规避方式和修复版本。
