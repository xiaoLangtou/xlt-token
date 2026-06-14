## 为什么

项目迭代到 v1.2.0 后，部分文档和工程配置未同步更新。架构文档中 Express 适配器仍标注"开发中"，CHANGELOG 遗漏了 v1.1.0，src-reference.md 包含本机绝对路径导致其他开发者无法使用，`.vitepress/cache`（根目录）被 git 追踪造成噪音，根目录残留已废弃的 `vitest.config.ts`。

## 变更内容

### 同步过期文档
- 架构文档 `docs/guide/architecture.md` 更新：Express 适配器已发布，移除"正在开发中"描述
- README 更新测试数量（Core 253 / E2E 79）
- CHANGELOG 补充缺失的 v1.1.0 条目
- 修复 `docs/core/core-api.md` 中 JWT 支持范围的矛盾描述
- 修复 `docs/reference/src-reference.md` 中的本机绝对路径（`@/Volumes/weipengcheng/...`）改为仓库相对路径

### 清理仓库生成物
- 停止追踪根目录 `.vitepress/cache`，将其加入 `.gitignore`
- 统一 VitePress 缓存忽略规则：同时忽略 `docs/.vitepress/cache` 和根 `.vitepress/cache`
- 明确 `.kiro/` 是否需要纳入版本控制
- 删除已废弃的根 `vitest.config.ts`

## 影响范围

- `docs/guide/architecture.md` — Express 适配器状态更新
- `README.md` — 测试数量更新
- `CHANGELOG.md` — 补充 v1.1.0
- `docs/core/core-api.md` — JWT 描述修正
- `docs/reference/src-reference.md` — 绝对路径替换
- `.gitignore` — 新增 `.vitepress/cache`
- `.vitepress/cache` — 停止追踪
- `vitest.config.ts` — 删除
- `.kiro/` — 确认是否需要版本控制
