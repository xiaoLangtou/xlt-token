# Skills

Skills 用来让 AI 编码代理按任务加载项目知识，而不是一次性塞入所有上下文。对 `xlt-token` 来说，建议把技能拆成 Core、NestJS、Express 和维护工作四类。

## 推荐 Skills

| Skill | 触发场景 | 重点 |
| --- | --- | --- |
| `xlt-token-core-api` | 修改 `@xlt-token/core` | `StpLogic`、Store、TokenStrategy、权限、会话、Hooks |
| `xlt-token-nestjs-adapter` | 修改 NestJS 集成 | Module、Guard、Decorator、RedisStore、JwtStrategy、E2E |
| `xlt-token-express-adapter` | 修改 Express 集成 | middleware、route helper、错误处理器、请求状态同步 |
| `xlt-token-maintenance` | 构建、测试、发包、文档 | pnpm、Turbo、tsdown、Vitest、文档同步 |

## Skill 内容原则

- `SKILL.md` 只写工作流和决策规则。
- 详细 API 放到 `references/`，按需读取。
- 不重复 README 和完整文档。
- 明确修改后需要运行哪些测试。
- 明确包边界，避免把框架逻辑写进 Core。

## 建议目录

```txt
.codex/
  skills/
    xlt-token-core-api/
      SKILL.md
      references/core-api.md
    xlt-token-nestjs-adapter/
      SKILL.md
      references/nestjs-patterns.md
    xlt-token-express-adapter/
      SKILL.md
      references/express-patterns.md
    xlt-token-maintenance/
      SKILL.md
      references/testing-build-release.md
```

## 验证建议

- Core 行为变更：`pnpm --filter @xlt-token/core test`
- NestJS 集成变更：`pnpm --filter @xlt-token/nestjs test`
- NestJS 请求链路变更：`pnpm --filter @xlt-token/nestjs test:e2e`
- Express 适配器变更：`pnpm --filter @xlt-token/express test`
- 包导出或文档站变更：`pnpm docs:build`
