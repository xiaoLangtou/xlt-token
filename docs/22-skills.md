# 22 · AI Agent Skills

`xlt-token` 在仓库中内置了面向 AI 编码代理的 Skill，帮助使用者在 NestJS、Express 或自定义框架中正确接入鉴权能力。

Skill 目录：

```txt
skills/
├── index.json
└── xlt-token/
    ├── SKILL.md
    └── references/
        ├── core.md
        ├── nestjs.md
        ├── express.md
        └── recipes.md
```

## 适用场景

当你让 AI 编码代理完成以下任务时，可以使用 `xlt-token` Skill：

- 在 NestJS 项目中接入 `@xlt-token/nestjs`
- 在 Express 项目中接入 `@xlt-token/express`
- 使用 `@xlt-token/core` 构建自定义适配器
- 配置登录、登出、权限、角色、会话、多端登录
- 配置 RedisStore、JwtStrategy、二级认证和 Hooks
- 从已有手写 token 鉴权迁移到 xlt-token

## 安装到 AI 工具

不同 AI 工具的 Skill 目录不同。你可以把仓库内的 `skills/xlt-token` 复制到目标工具的项目级 Skill 目录。

例如 Codex / Claude Code 常见项目级目录：

```bash
mkdir -p .codex/skills
cp -r node_modules/xlt-token/skills/xlt-token .codex/skills/
```

如果你直接从 GitHub 使用源码仓库：

```bash
mkdir -p .codex/skills
cp -r skills/xlt-token .codex/skills/
```

也可以安装到全局 Skill 目录，让多个项目共享。

## Skill 内容

`SKILL.md` 只保留触发说明、核心规则和路由表。更详细的内容拆到 `references/` 中，AI 会按任务选择性读取：

| 文件 | 内容 |
| --- | --- |
| `references/core.md` | `createXltToken`、`StpLogic`、`StpUtil`、Store、Strategy、Session、Hooks |
| `references/nestjs.md` | `XltTokenModule`、全局 Guard、装饰器、Redis、JWT、自定义 Guard |
| `references/express.md` | `xltMiddleware`、路由策略、helper、错误处理、请求状态同步 |
| `references/recipes.md` | 登录登出、多端登录、二级认证、临时 token、在线用户、生产检查 |

## 发布说明

根包 `xlt-token` 会把 `skills/` 一起发布到 npm，使用者安装根包后可以从 `node_modules/xlt-token/skills/xlt-token` 复制。

如果使用者只安装分包（如 `@xlt-token/nestjs` 或 `@xlt-token/express`），也可以从 GitHub 仓库复制同一个 Skill。
