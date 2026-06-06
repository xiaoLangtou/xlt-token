# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-06-06

> xlt-token 首个正式大版本发布。`@xlt-token/core`、`@xlt-token/nestjs`、`@xlt-token/express` 统一进入 v1.0.0，适配器包现在可作为业务侧唯一安装入口。

### Added

- **Express 官方适配器**：发布 `@xlt-token/express`，提供 `xltTokenMiddleware()`、`requireLogin()`、`checkPermission()`、`checkRole()`、`checkSafe()` 与策略覆盖能力
- **Express E2E 覆盖**：补齐中间件、路由策略、白名单、权限、角色、二级认证、错误处理、Hooks 与请求辅助方法的端到端测试
- **Express 文档 Twoslash**：`docs/18-express-adapter.md` 的 TypeScript 示例启用 Twoslash 类型校验与提示
- **一包安装体验**：`@xlt-token/nestjs` 与 `@xlt-token/express` re-export core 常用 API，业务项目无需再显式安装 `@xlt-token/core`

### Changed

- **版本统一**：根包、core、nestjs、express 统一为 `1.0.0`
- **安装文档**：NestJS 推荐 `pnpm add @xlt-token/nestjs`，Express 推荐 `pnpm add express @xlt-token/express`
- **包命名**：Express 适配器正式使用 `@xlt-token/express`

### Quality Metrics

- **Express 单测**：53 个用例通过
- **Express E2E**：23 个用例通过
- **NestJS 单测**：29 个用例通过
- **文档构建**：VitePress build 通过

---

## [1.0.0-rc.3] - 2026-05-29

> monorepo 架构正式发布：`@xlt-token/core` + `@xlt-token/nestjs` 分包上线；`xlt-token` 根包改为兼容 re-export。

### Added

- **分包发布**：`@xlt-token/core`（框架无关核心）与 `@xlt-token/nestjs`（NestJS 集成）首次发布到 npm
- **框架无关 API**：`createXltToken()` + `HttpContext` 抽象，支持 Express 等场景接入
- **发布脚本**：`pnpm publish:packages` / `pnpm publish:dry-run`
- **CI 发布工作流**：`.github/workflows/publish.yml`（Release 触发或手动 dispatch）
- **示例项目**：`examples/nestjs` 全功能 Demo（多端 / JWT / 二级认证 / 权限等）

### Changed

- **monorepo 重构**：鉴权语义下沉 `@xlt-token/core`，NestJS Module / Guard / Decorator 上浮 `@xlt-token/nestjs`
- **`xlt-token` 根包**：由 fat bundle 改为 re-export `@xlt-token/nestjs`，安装时自动带上 core / nestjs 依赖
- **文档 2.0**：VitePress 全面更新，新增架构设计 / 迁移指南 / 源码参考
- **README**：同步 monorepo 安装方式与新特性说明

### Migration

```ts
// 旧（仍可用）
import { XltTokenModule, StpUtil } from 'xlt-token';

// 新（推荐）
import { XltTokenModule, StpUtil } from '@xlt-token/nestjs';
```

详见 [迁移指南](https://xiaolangtou.github.io/xlt-token/guide/migration-2-0)。

### Quality Metrics

- **测试规模**：294 用例（207 core 单测 + 24 nestjs 单测 + 63 E2E）
- **core 单测覆盖率**：97.79% Stmts / 91.91% Branch / 96.32% Funcs

---

## [1.0.0-rc.2] - 2026-04-26

> 首个正式版预发布。承诺 API 稳定，欢迎试用反馈，无重大问题后将发布 1.0.0。

### Added

- **E2E 测试基建**（`test/` 目录）
  - 8 个 E2E spec / 37 个用例，覆盖 Guard / 装饰器 / 权限 / 生命周期 / 会话 / forRootAsync / 静态门面 / 模块配置分支
  - 独立 `vitest.e2e.config.ts` 与单测分离
  - 共享 fixtures（`MockStpInterface`、`buildTestApp`、`CustomLoginGuard`）
- **测试报告与覆盖率**
  - 引入 `@vitest/coverage-v8` + `@vitest/ui`，输出 text / html / lcov / json-summary
  - 单测覆盖率阈值：lines 80% / branches 75% / functions 80%
  - 新增脚本：`test:cov` / `test:ui` / `test:e2e:cov` / `test:all` / `test:junit` / `test:e2e:junit`
- **`stp-util.ts` 完整单测**（`src/auth/stp-util.spec.ts`，19 个用例）
- **`LICENSE` 文件**（MIT，与 `package.json` 一致）
- **E2E 方案文档**（`docs/archive/e2e-testing-plan.md`）

### Fixed

- **`XltAbstractLoginGuard.onAuthFail` 死代码 bug**：原实现在 `checkLogin` 抛出异常后才调用钩子，导致 `onAuthFail` 永不触发。改用 try/catch 包裹，先触发钩子再向上抛异常

### Changed

- `package.json` 的 `files` 字段显式加入 `LICENSE` 和 `README.md`
- `.gitignore` 加入 `coverage-e2e/` / `reports/` / `.vitest-cache`
- 内部测试运行器升级配置：单测覆盖率聚焦逻辑层（排除装饰器/Guard/Module/静态门面，由 E2E 覆盖）

### Quality Metrics

- **测试规模**：158 单测 + 37 E2E = **195 个用例全绿**
- **单测覆盖率**：98.20% Stmts / 92.18% Branch / 98.75% Funcs / 98.20% Lines
- **E2E 覆盖率**：95.80% Stmts / 90.80% Branch / 97.43% Funcs / 95.80% Lines
- **Guard / 装饰器**：100% 全维度

---

## [0.2.0] - 2026-04-26

### Added

- **权限校验**：`StpPermLogic` 权限引擎，支持 `hasPermission` / `checkPermission` / `hasRole` / `checkRole`
- **通配符匹配**：`matchPermission()` 支持 `user:*` 匹配 `user:add` 等层级通配
- **权限装饰器**：`@XltCheckPermission` / `@XltCheckRole`，支持 `XltMode.AND` / `XltMode.OR` 组合
- **权限接口**：`StpInterface`（`getPermissionList` / `getRoleList`），业务实现后通过 `stpInterface` 选项注入
- **权限异常**：`NotPermissionException`（403）/ `NotRoleException`（403），继承 `ForbiddenException`
- **会话对象**：`XltSession`，支持 `get` / `set` / `has` / `remove` / `keys` / `clear`
- **会话工厂**：`StpLogic.getSession(loginId)` 返回 `XltSession` 实例，与 token 同生命周期
- **下线记录**：`offlineRecordEnabled` 配置开启后，`kickout` / 顶号时写入下线原因和时间戳
- **下线查询**：`StpLogic.getOfflineRecords(token)` 查询下线原因
- **StpUtil 门面扩展**：新增 `hasPermission` / `checkPermission` / `hasRole` / `checkRole` / `getSession` / `getOfflineReason` 静态方法
- **Guard 权限分支**：`XltTokenGuard` 登录校验通过后自动读取 `@XltCheckPermission` / `@XltCheckRole` 元数据并触发校验
- **抽象守卫钩子**：`XltAbstractLoginGuard` 新增 `onPermissionDenied` 可选钩子
- **配置字段**：`permCacheTimeout` / `offlineRecordEnabled` / `offlineRecordTimeout`
- **Module 支持**：`forRoot` / `forRootAsync` 新增 `stpInterface` 选项

### Fixed

- `perm-pattern-match.ts`：`forEach` + `return` 改为 `for` 循环，修复通配符匹配失效
- `stp-perm-logic.ts`：删除多余 `includes` 判断，修复通配符被拦截
- `stp-perm-logic.ts`：`checkPermission` / `checkRole` 改为不通过时抛异常（`void` 返回）
- `xlt-token.guard.ts`：角色校验元数据 key 从 `XLT_PERMISSION_KEY` 修正为 `XLT_ROLE_KEY`
- `not-permission.exception.ts` / `not-role.exception.ts`：基类从 `UnauthorizedException` 改为 `ForbiddenException`
- `stp-util.ts`：权限方法正确路由到 `StpPermLogic`（新增 `getStpPermLogic()` 辅助函数）
- 所有 interface/type 导出添加 `type` 修饰符，消除 tsdown 构建警告

### Changed

- 所有单元测试统一使用 `@nestjs/testing` 的 `Test.createTestingModule` 模式
- `memory-store.spec.ts`：`jest.useFakeTimers` → `vi.useFakeTimers`
- `stp-logic.spec.ts`：请求 header key 与 `tokenName` 配置对齐，异常断言使用中文 message
- `uuid-strategy.spec.ts`：修正 tokenPrefix 和未知 style 回退的断言

---

## [0.1.5] - 2026-04-20

### P0 登录鉴权核心（已完成）

- `XltTokenModule`：`forRoot` / `forRootAsync` 动态模块注册
- `StpLogic`：核心引擎（login / logout / kickout / checkLogin / renewTimeout）
- `StpUtil`：静态门面
- `XltTokenConfig`：全量配置项 + 默认值
- `MemoryStore` / `RedisStore`：内存 / Redis 存储实现
- `UuidStrategy`：uuid / simple-uuid / random-32 三种 token 风格
- `XltTokenGuard` / `XltAbstractLoginGuard`：全局守卫 + 业务扩展基类
- `@XltIgnore` / `@XltCheckLogin` / `@LoginId` / `@TokenValue`：装饰器
- `NotLoginException`：六种 `NotLoginType` 场景
