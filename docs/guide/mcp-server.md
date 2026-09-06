---
title: xlt-token MCP Server 实现契约
description: 为 xlt-token 设计 MCP Server 时应暴露的当前包、API、示例、测试与安全边界。
---

# MCP Server 实现契约

MCP Server 可以把项目知识、API 索引、示例和诊断工具以结构化方式暴露给 AI 编码代理。对 `xlt-token` 来说，它让代理通过稳定入口读取当前包边界，而不是每次从零扫描仓库。

当前仓库**不包含可运行的 MCP Server 或 MCP 配置文件**。本页定义未来实现的资源和工具契约；MCP 代码应作为独立开发辅助工具，不能进入发布包的运行时依赖。

## 建议暴露的资源

| 资源 | 内容 |
| --- | --- |
| `xlt-token://overview` | 包结构、职责边界、推荐 import |
| `xlt-token://core-api` | `StpLogic`、`StpUtil`、`StpPermLogic`、`XltSession` |
| `xlt-token://nestjs-api` | `XltTokenModule`、Guard、Decorator、JwtStrategy、Redis 兼容包装器 |
| `xlt-token://express-api` | `xltMiddleware`、route helpers、错误处理器 |
| `xlt-token://fastify-api` | 显式 `XltInstance`、`xltFastifyPlugin`、`config.xlt`、请求状态和错误处理器 |
| `xlt-token://token-lifecycle` | `lifecycle` 配置、`refreshToken`、`revoke`、token family 与重放结果 |
| `xlt-token://testing` | 各包测试命令、fixture 位置、E2E 入口 |

## 建议工具

- `search_docs(query)`：搜索 `docs/` 和包 README。
- `read_api(symbol)`：按公共导出读取 API 说明和所属包。
- `list_examples(framework)`：列出 NestJS、Express 或 Fastify 示例入口；未提供示例的框架必须明确返回空结果。
- `recommend_tests(changed_files)`：根据变更文件推荐测试命令。

`recommend_tests` 至少应覆盖以下映射：

| 变更范围 | 推荐命令 |
| --- | --- |
| `packages/core/**` | `pnpm --filter @xlt-token/core test` |
| `packages/store-redis/**` | `pnpm --filter @xlt-token/store-redis test` |
| `packages/nestjs/**` | `pnpm --filter @xlt-token/nestjs test`；请求链路变更再加 `test:e2e` |
| `packages/express/**` | `pnpm --filter @xlt-token/express test`；中间件变更再加 `test:e2e` |
| `packages/fastify/**` | `pnpm --filter @xlt-token/fastify test`；Plugin / Hook 变更再加 `test:e2e` |
| 公共导出、发布或工作区配置 | `pnpm build:workspace` |

## 内容来源

优先使用这些稳定文件作为 MCP 的索引来源：

- `docs/public/llms.txt`
- `docs/README.md`
- `docs/reference/src-reference.md`
- `docs/core/core-api.md`
- `docs/core/configuration.md`
- `docs/adapters/nestjs/guards-and-decorators.md`
- `docs/adapters/nestjs/module-config.md`
- `docs/adapters/express.md`
- `docs/adapters/fastify.md`
- `packages/*/src/index.ts`（公共导出的最终依据）

## 实现与运行建议

实现 MCP 时，`search_docs` 只能读取文档、README、公共导出和示例；不要暴露 `.env`、私有配置、完整 Store 内容或实际 token。`read_api` 应只返回公共 API 与必要的相邻类型，避免把内部实现误作稳定契约。

创建独立 MCP 工具后，可用以下命令验证项目本身。不要为 MCP 文档启动前端服务。

```bash
pnpm install
pnpm build:workspace
pnpm test:workspace
```
