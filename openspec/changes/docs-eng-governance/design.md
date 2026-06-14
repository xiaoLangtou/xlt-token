## 背景

项目已发布至 v1.2.0，但文档和工程配置停留在早期状态。本次治理聚焦两类问题：文档内容过期（架构/API/CHANGELOG/README）和仓库生成物噪音（缓存追踪/废弃文件）。

## 目标 / 非目标

**目标：**
- 所有文档内容反映当前 v1.2.0 的项目状态
- 仓库无追踪不必要的缓存文件和废弃配置文件

**非目标：**
- 不进行文档结构重组（保留现有目录布局）
- 不修改 API 行为或代码逻辑

## 决策

1. **架构文档 Express 描述**：将"正在开发中"替换为"v1.0.0 已正式发布"，指向 Express 适配器文档
2. **CHANGELOG v1.1.0**：从 `.github/releases/v1.1.0.md` 提取内容，按 CHANGELOG 格式插入 v1.0.2 与 v1.2.0 之间
3. **src-reference.md 绝对路径**：`@/Volumes/weipengcheng/个人项目/tva/xlt-token/` → `@/<repo-relative-path>`，例如 `@/packages/core/src/auth/stp-logic.ts`
4. **`.vitepress/cache`**：根目录缓存是 VitePress 运行产生的临时文件，不应追踪。加入 `.gitignore` 后执行 `git rm --cached -r .vitepress/cache`
5. **根 `vitest.config.ts`**：各子包已有独立 vitest 配置，根目录配置无人引用，直接删除
6. **`.kiro/`**：目录已不存在，检查 `.gitignore` 是否有对应规则

## 风险

- `src-reference.md` 的路径替换需逐行确认，避免漏改或过改
