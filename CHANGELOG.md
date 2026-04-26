# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0-rc.1] - 2026-04-26

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
