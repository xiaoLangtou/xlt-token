# MCP Server

MCP Server 适合把项目知识、API 索引、示例和诊断工具以结构化方式暴露给 AI 编码代理。对 `xlt-token` 这类 TypeScript 鉴权库来说，MCP 的价值是让代理不用每次从零扫描仓库，而是通过稳定入口读取项目上下文。

## 建议暴露的资源

| 资源 | 内容 |
| --- | --- |
| `xlt-token://overview` | 包结构、职责边界、推荐 import |
| `xlt-token://core-api` | `StpLogic`、`StpUtil`、`StpPermLogic`、`XltSession` |
| `xlt-token://nestjs-api` | `XltTokenModule`、Guard、Decorator、RedisStore、JwtStrategy |
| `xlt-token://express-api` | `xltMiddleware`、route helpers、错误处理器 |
| `xlt-token://testing` | 常用测试命令、fixture 位置、E2E 入口 |

## 建议工具

- `search_docs(query)`：搜索 `docs/` 和包 README。
- `read_api(symbol)`：按符号读取核心 API 说明。
- `list_examples(framework)`：列出 NestJS 或 Express 示例入口。
- `recommend_tests(changed_files)`：根据变更文件推荐测试命令。

## 内容来源

优先使用这些稳定文件作为 MCP 的索引来源：

- `llms.txt`
- `docs/README.md`
- `docs/SRC-REFERENCE.md`
- `docs/04-core-api.md`
- `docs/05-guards-and-decorators.md`
- `docs/12-nestjs-module-config.md`
- `docs/18-express-adapter.md`

## 运行建议

当前仓库还没有内置 MCP Server。实现时建议把它作为独立开发辅助工具，不要让运行时包依赖 MCP 相关代码。

```bash
pnpm install
pnpm build:workspace
pnpm test:workspace
```
