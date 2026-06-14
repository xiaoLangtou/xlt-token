## 1. 同步过期文档

- [x] 1.1 更新 `docs/guide/architecture.md`：修改 Express 适配器"正在开发中"描述为"v1.0.0 已正式发布"
- [x] 1.2 更新 `README.md`：测试数量更新为 Core 253 / E2E 79
- [x] 1.3 补充 `CHANGELOG.md`：从 `.github/releases/v1.1.0.md` 提取内容，插入 v1.0.2 与 v1.2.0 之间
- [x] 1.4 修复 `docs/core/core-api.md` 中 JWT 支持范围的矛盾描述
- [x] 1.5 修复 `docs/reference/src-reference.md`：将 `@/Volumes/weipengcheng/` 绝对路径替换为 `@/packages/` 相对路径

## 2. 清理仓库生成物

- [x] 2.1 将 `.vitepress/cache` 加入 `.gitignore`，执行 `git rm --cached -r .vitepress/cache`
- [x] 2.2 删除根目录已废弃的 `vitest.config.ts`
- [x] 2.3 确认 `.kiro/`：目录已不存在，无追踪无 gitignore 规则，无需清理
