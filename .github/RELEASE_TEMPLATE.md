# Release `vX.Y.Z[-prerelease]`

> 一句话概括：本次发布的核心亮点。

## 🎯 Highlights

- 列 2~4 个最重要的改动，用简短语言
- 对用户价值比实现细节更重要

## ✨ New Features

- **feature A** ([#123](https://github.com/xiaoLangtou/xlt-token/pull/123))
- **feature B** ([@contributor](https://github.com/contributor))

## 🐛 Bug Fixes

- **fix: xxxxxxx** ([#124](...))

## 🔧 Improvements

- 性能优化：X → Y
- 类型收窄：Z

## 📖 Documentation

- 新增文档 / 章节
- 修订的章节

## ⚠️ Breaking Changes

> 仅 major 版本填写。minor / patch 留空或删除此节。

- 改动 1：迁移方式
- 改动 2：迁移方式

## 📦 Installation

```bash
# stable
pnpm add xlt-token@X.Y.Z

# prerelease
pnpm add xlt-token@next
```

## ✅ Quality

- Typecheck: pass
- Package boundaries: pass
- Tests: core / store-redis / express / nestjs pass
- Build: workspace pass
- Docs build: pass
- Coverage: core XX% / express XX% / nestjs XX%

## 🚦 Release Gates

- Channel: `next` / `rc` / `latest`
- RC observation: N days
- Blocking issues: 0
- Migration notes: ready / not applicable
- Security notes: ready / not applicable
- Rollback target: `vPREV`

## ↩️ Rollback Plan

- If a blocking issue is found, publish a patch release or move the npm `latest` dist-tag back to `vPREV`.
- Document the impact, workaround, and fixed version in this release and CHANGELOG.

## 🙏 Contributors

@user1 @user2 ...

## 📚 Resources

- [CHANGELOG](https://github.com/xiaoLangtou/xlt-token/blob/master/CHANGELOG.md)
- [Documentation](https://xiaolangtou.github.io/xlt-token/)
- [Engineering Gates](https://xiaolangtou.github.io/xlt-token/guide/engineering)
- [Migration Guide](https://xiaolangtou.github.io/xlt-token/guide/migration-2-0) <!-- 如适用 -->

---

**Full Changelog**: https://github.com/xiaoLangtou/xlt-token/compare/vPREV...vX.Y.Z
