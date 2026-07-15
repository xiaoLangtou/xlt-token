---
title: "AI Agent Skills"
description: "Install the xlt-token skill to give AI coding agents deep knowledge of token auth, NestJS and Express integration, permissions, sessions, JWT, Redis, and common recipes."
canonical_url: "https://xiaolangtou.github.io/xlt-token/guide/skills"
last_updated: "2026-06-09"
---

# 22 · AI Agent Skills

> Install the xlt-token skill to give AI coding agents deep knowledge of token auth, NestJS and Express integration, permissions, sessions, JWT, Redis, and common recipes.

## 什么是 Skills？

Skills 是结构化知识文件，用来给 AI 编码代理补充某个库、框架或代码库的上下文。与 MCP server 提供实时工具访问不同，Skill 会被加载进代理上下文，让代理在对话中持续参考这些使用规则和示例。

`xlt-token` 提供一个 **usage skill**：它教 AI 代理如何在 TypeScript 后端项目中正确接入 xlt-token，包括 NestJS、Express、Core API、权限、角色、会话、多端登录、JWT、Redis、审计事件和二级认证。

## Usage

`xlt-token` Skill 覆盖：

- `@xlt-token/nestjs` 的模块注册、全局 Guard、装饰器和异常处理
- `@xlt-token/express` 的中间件、路由策略、helper 和错误处理器
- `@xlt-token/core` 的框架无关用法和自定义适配器
- 登录、登出、踢人、顶号、多端登录和在线用户查询
- 权限、角色、会话、二级认证和临时 token
- Redis Store 独立包、JwtStrategy、审计事件和生产建议

Skill 内部包含 `references/`，AI 代理会按任务选择性读取，避免一次性加载过多上下文。

> [!NOTE]
>
> 安装后，你可以在支持 Skill 调用的代理里输入 `/xlt-token` 来显式唤起这个 Skill。

## Skills CLI

[`skills`](https://skills.sh) CLI 是最简单的安装方式，支持 Cursor、Claude Code、Codex、Windsurf、Cline 等多种 AI 编码代理。

从 GitHub 仓库安装：

```bash
npx skills add xiaoLangtou/xlt-token --skill xlt-token
```

也可以直接指向 Skill 子目录：

```bash
npx skills add https://github.com/xiaoLangtou/xlt-token/tree/master/skills/xlt-token
```

指定目标代理：

```bash
npx skills add xiaoLangtou/xlt-token --skill xlt-token --agent cursor
npx skills add xiaoLangtou/xlt-token --skill xlt-token --agent claude-code
npx skills add xiaoLangtou/xlt-token --skill xlt-token --agent codex
```

安装到全局目录，让所有项目可用：

```bash
npx skills add xiaoLangtou/xlt-token --skill xlt-token --global
```

只列出仓库内可安装的 Skill：

```bash
npx skills add xiaoLangtou/xlt-token --list
```

如果你在本地源码仓库中调试：

```bash
npx skills add ./ --skill xlt-token
```

## Cursor

### Quick Install

点击下面链接可在 Cursor 中安装：

[Install Skill](cursor://anysphere.cursor-deeplink/install-skill?url=https://github.com/xiaoLangtou/xlt-token/tree/master/skills/xlt-token)

### Manual Setup

1. 打开 Cursor，进入 "Settings" > "Skills"
2. 点击 "Add skill"
3. 输入以下 URL：

```text
https://github.com/xiaoLangtou/xlt-token/tree/master/skills/xlt-token
```

## Claude Code

> [!NOTE]
>
> 请先确认已安装 Claude Code。

使用 Claude Code CLI 添加：

```bash
claude skill add https://github.com/xiaoLangtou/xlt-token/tree/master/skills/xlt-token
```

或者使用通用 Skills CLI：

```bash
npx skills add xiaoLangtou/xlt-token --skill xlt-token --agent claude-code
```

## Codex

使用 Skills CLI 安装到 Codex 项目级目录：

```bash
npx skills add xiaoLangtou/xlt-token --skill xlt-token --agent codex
```

也可以手动复制：

```bash
mkdir -p .codex/skills
cp -r node_modules/xlt-token/skills/xlt-token .codex/skills/
```

## Other AI Tools

Skill 文件公开托管在 GitHub，可以在任意支持自定义上下文、规则或 Skill 的 AI 工具中引用：

- Skill entry point: [`skills/xlt-token/SKILL.md`](https://github.com/xiaoLangtou/xlt-token/blob/master/skills/xlt-token/SKILL.md)
- Full skill directory: [`skills/xlt-token/`](https://github.com/xiaoLangtou/xlt-token/tree/master/skills/xlt-token)

## 仓库结构

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

根包 `xlt-token` 会把 `skills/` 一起发布到 npm。安装根包后，使用者也可以从 `node_modules/xlt-token/skills/xlt-token` 手动复制。
