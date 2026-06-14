## ADDED Requirements

### Requirement: 架构文档同步

`docs/guide/architecture.md` 中的 Express 适配器状态 SHALL 更新为"已发布"，而非"正在开发中"。

#### Scenario: 架构文档反映 Express 现状
- **WHEN** 开发者阅读架构文档
- **THEN** Express 适配器不再标注"正在开发中"
- **AND** 提及其正式发布版本号

### Requirement: CHANGELOG 完整性

CHANGELOG.md SHALL 包含所有已发布版本的条目，包括 v1.1.0。

#### Scenario: CHANGELOG 包含 v1.1.0
- **WHEN** 查阅 CHANGELOG.md
- **THEN** v1.1.0 条目存在于 v1.0.2 与 v1.2.0 之间

### Requirement: 文档路径正确性

`docs/reference/src-reference.md` SHALL 使用仓库相对路径而非本机绝对路径。

#### Scenario: src-reference.md 路径可移植
- **WHEN** 其他开发者打开 src-reference.md
- **THEN** 所有 `@/Volumes/weipengcheng/` 路径已替换为 `@/packages/...` 相对路径

### Requirement: 缓存不追踪

`.vitepress/cache` 目录 SHALL NOT 被 git 追踪。

#### Scenario: 根目录 VitePress 缓存被忽略
- **WHEN** 执行 `git status`
- **THEN** `.vitepress/cache/` 下的文件不再出现
- **AND** `.gitignore` 包含 `.vitepress/cache` 规则
