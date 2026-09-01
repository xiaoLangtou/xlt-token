---
title: 发布检查清单
description: xlt-token 从代码合入到 npm 发布的统一检查清单与 CHANGELOG 维护流程。
---

# 发布检查清单

本清单是 v2.2 起唯一的发布治理入口：每次发布（minor / patch / prerelease）都按同一顺序执行。与 [工程化门禁](./engineering.md) 的关系：门禁定义"长期不变的质量要求"，本清单定义"一次发布的具体步骤"。

发布责任人（Release Manager）负责按下表逐项打勾；任何一项不通过则停止发布，不允许跳过。

## 0. 前置条件

- [ ] 目标版本号已确定，且遵循 semver：新能力 → minor（2.2.0），修复 → patch（2.1.2），不兼容变更 → major。
- [ ] 所有 OpenSpec 活动变更要么已归档，要么明确不进入本次发布（记录决定）。
- [ ] 工作区干净：`git status` 无未提交变更，`pnpm install --frozen-lockfile` 可成功执行。

## 1. 依赖锁定

- [ ] `pnpm-lock.yaml` 与所有 `package.json` 一致（`pnpm install --frozen-lockfile` 通过）。
- [ ] `packageManager` 保持 `pnpm@10.15.1` 固定不变（`check-release-gates.mjs` 会校验）。
- [ ] 所有 workspace 内部依赖使用 `^<发布版本>` 或 `workspace:`，跨包版本号一致。

```bash
pnpm install --frozen-lockfile
node scripts/check-release-gates.mjs
```

## 2. 质量检查

- [ ] 格式检查：`pnpm run format:check` 通过。
- [ ] 静态检查：`pnpm run lint` 通过。
- [ ] 类型检查：`pnpm run typecheck` 通过（含 examples）。
- [ ] 包边界：`pnpm run check:boundaries` 通过。
- [ ] 安全不变量：`pnpm run check:security` 通过（无密钥泄漏、无危险默认配置）。

## 3. 测试覆盖

- [ ] 全量测试：`pnpm run test:all` 通过（core / jwt / store-redis / express / nestjs 的单元 + e2e）。
- [ ] 覆盖率不低于各包 vitest 配置的既有阈值（core 80/90/80/80，store-redis 90/95/75/90 等）。
- [ ] 本版本的验收场景（PRD / OpenSpec tasks）全部有对应测试并通过。

## 4. Breaking Change 评估

- [ ] 逐项过本次变更列表，确认是否存在公开 API 行为变化。
- [ ] 若有：major 版本 + 迁移指南（`docs/guide/migration-X-Y.md`）+ CHANGELOG `Breaking Changes` 小节。
- [ ] 若无：在 CHANGELOG 中显式说明"无 breaking change"。
- [ ] peer dependency 范围变化视为潜在 breaking，需在发布说明中列出。

## 5. 构建产物

- [ ] workspace 构建：`pnpm run build:workspace` 通过。
- [ ] 构建产物包含 ESM / CJS 双入口与 `.d.cts` / `.d.mts` 类型。
- [ ] 产物体积无异常膨胀（对比上一版本 `dist/` 大小）。
- [ ] 冒烟基准：`pnpm run benchmark:smoke` 无数量级回退。

## 6. 发布干跑

- [ ] `pnpm run publish:dry-run` 通过，确认将发布的包与版本列表正确。
- [ ] 根包 `prepublishOnly` 触发的完整构建链路无告警。

## 7. CHANGELOG 与发布说明

- [ ] `CHANGELOG.md` 已包含 `## [X.Y.Z] - YYYY-MM-DD` 小节，格式见下文。
- [ ] `.github/releases/vX.Y.Z.md` 发布说明已按 [RELEASE_TEMPLATE](https://github.com/xiaoLangtou/xlt-token/blob/master/.github/RELEASE_TEMPLATE.md) 编写。
- [ ] `docs/.vitepress/config.mts` 的 `releaseSources` 已加入新版本文件名。
- [ ] 文档构建：`pnpm run docs:build` 通过，新增 / 变更文档已更新并出现在站点导航中。

## 8. 发布执行

- [ ] 在发布分支上打 tag（`vX.Y.Z`），tag 指向的 commit 即发布产物来源。
- [ ] GitHub Release 使用 `.github/releases/vX.Y.Z.md` 内容，发布后触发 npm publish workflow。
- [ ] 发布后验证：npm 上各包版本可安装，`latest` dist-tag 指向新版本。
- [ ] 回退预案：如发现阻断级问题，按 [工程化门禁 · 发布与回退](./engineering.md#发布与回退) 执行。

## CHANGELOG 维护流程

### 方案选择：手动维护（已定）

v2.2 起采用**手动维护 `CHANGELOG.md`**，不引入 Changesets。理由：

1. 仓库已有 `check-release-gates.mjs` 强制校验 CHANGELOG 小节存在（`## [版本号]`），流程已工具化。
2. 发布频率低（月级）、包数量固定（7 个 workspace 包统一版本），自动化的收益不抵配置与维护成本。
3. 手动条目由发布责任人把关，可以保证"用户视角的变更描述"质量（说明影响，而不是罗列 commit）。

### 触发时机

| 时机 | 动作 |
| --- | --- |
| 功能 / 修复 PR 合入 main | 不立即写 CHANGELOG；在 PR 描述中留一句用户可读的变更摘要 |
| 版本号确定（发布分支创建时） | 发布责任人从本版本的合入 PR 与 OpenSpec 归档记录汇总条目，写入 `CHANGELOG.md` 顶部新小节 |
| prerelease（rc / next） | 同样写入 CHANGELOG，标注 prerelease 版本号 |

### 责任人

- **条目编写**：发布责任人（本次发布的执行者）。
- **条目评审**：至少一名维护者在发布 PR 中 review CHANGELOG diff。
- **正确性兜底**：`node scripts/check-release-gates.mjs` 在 `check:release` 中强制校验小节存在，缺失即门禁失败。

### 条目格式

- 小节头：`## [X.Y.Z] - YYYY-MM-DD`。
- 分组：`Breaking Changes`、`Added`、`Fixed`、`Improved`、`Tests`、`Documentation`（按需取用，顺序固定）。
- 每条一行，动词开头，面向用户描述影响；内部重构无用户感知的不写。
- 指向 OpenSpec 归档或 PR 链接（如适用）。

### 发布前校验步骤

```bash
node scripts/check-release-gates.mjs   # 版本一致性 + CHANGELOG 小节存在 + 必需文档存在
pnpm run check:release                 # 上述 + 全量质量门禁 + 干跑 + 文档构建
```

两条命令都通过后，CHANGELOG 才允许随 tag 发布。
