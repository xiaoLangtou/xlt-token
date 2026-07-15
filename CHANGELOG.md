# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-07-15

### Breaking Changes

- `XltTokenStore` 升级为原子契约：`get` 返回 `StoreEntry`，TTL 使用 `finiteTtl` / `persistentTtl` / `keepTtl`，并新增 `setIfAbsent`、`compareAndSet`、`compareAndDelete`、`touch`、`scan`
- JWT 策略拆分为 `@xlt-token/jwt`，使用 `kid` 密钥环、算法白名单和 `activeKid` 签发；NestJS 不再内置 `jwt.secret` 配置式策略
- `refreshToken` 返回 `RefreshResult`，支持 token family、轮换刷新、重放检测和撤销语义
- `XltHooks` / `XLT_TOKEN_HOOKS` 移除，替换为脱敏 `XltEventSink` / `XLT_EVENT_SINK`
- 错误码稳定化：`TOKEN_INVALID`、`TOKEN_KICKED_OUT`、`PERMISSION_DENIED`、`SAFE_REQUIRED` 等会出现在 Core 和 HTTP 适配器响应中

### Added

- 新增 `@xlt-token/jwt` 独立包
- 新增 `@xlt-token/store-contract` 契约测试包
- 新增 2.0 迁移指南、JWT 密钥轮换文档、Store 原子契约文档和审计事件文档

### Migration

请阅读 [2.0 迁移指南](./docs/guide/migration-2-0.md)。

## [1.2.1] - 2026-06-15

### Added

- 新增 `@xlt-token/store-redis` 独立包，为 Core、Express、NestJS 和自定义框架提供统一的 `RedisStore` 与 `IORedisStore`
- `IORedisStore` 支持 ioredis standalone、Sentinel 和 Cluster；Cluster 扫描会遍历所有 master 节点
- 新增官方 node-redis、ioredis standalone 和 ioredis Cluster 客户端类型兼容测试

### Fixed

- 修复 Redis Store 被耦合在 `@xlt-token/nestjs` 中，导致只安装 Core 或 Express 时无法直接复用 Redis 的问题
- 修复 node-redis `SCAN` cursor 在不同客户端版本中可能返回字符串或数字时的类型兼容问题
- 修复 ioredis 重载 `set` 方法无法满足 Store 客户端结构类型的问题
- 修正文档中 Redis 仍归属于 NestJS、生产示例使用阻塞式 `KEYS` 和部分过时链接的问题

### Changed

- `@xlt-token/nestjs` 保留 `RedisStore`、`IORedisStore` 和两个客户端注入令牌作为 deprecated 兼容包装器
- 根包和 NestJS 包不再直接声明 `redis` / `ioredis` peer dependency；Redis 客户端依赖由 `@xlt-token/store-redis` 管理
- 文档按快速开始、Core、Redis Store、框架适配、进阶指南和参考重新组织
- 所有公共包版本统一升级到 `1.2.1`

### Compatibility

- 无破坏性变更。现有 NestJS DI 写法继续可用
- 新项目推荐从 `@xlt-token/store-redis` 导入 Store，并使用构造函数传入 Redis 客户端

---

## [1.2.0] - 2026-06-14

### Added

- JWT 模式 `logout(token)` 新增 JWT 黑名单分支，解析 JWT 提取 jti、黑名单化、清理会话存储
- `logoutByLoginId(loginId)` 遍历所有设备会话逐一吊销，而非仅 default 设备
- 新增 `logoutByDevice(loginId, device)` 方法，支持 JWT / UUID 双模式自愿登出指定设备
- 新增 `refreshToken(token, timeout?)` 方法（仅 JWT 模式）：旧 jti 加入黑名单，签发新 JWT，更新会话存储
- JWT 模式 `renewTimeout(token, timeout)` 延长 sessionKey 和 lastActiveKey 的 Store TTL

### Fixed

- 修复 JWT 模式下 `logout` / `logoutByLoginId` 返回 `null` 的问题
- 修复 `RedisStore.keys()` 中 SCAN 命令 cursor 类型为数字导致的 `@redis/client` v5/v6 报错：改用字符串类型并显式转换 `reply.cursor`
- 修复 `@xlt-token/nestjs` 和根包中 `jsonwebtoken` / `redis` 缺失 `peerDependencies` 声明的问题
- 修复 `_resolveLoginIdJwt` 无法识别非 `KICK_OUT` / `BE_REPLACED` 的黑名单值的问题（新增兜底返回 `INVALID_TOKEN`）

### Changed

- 所有发布包版本升级到 `1.2.0`：`xlt-token`、`@xlt-token/core`、`@xlt-token/nestjs`、`@xlt-token/express`
- `@xlt-token/nestjs` 内部依赖 `@xlt-token/core` 升级到 `^1.2.0`
- `@xlt-token/express` 内部依赖 `@xlt-token/core` 升级到 `^1.2.0`

---

## [1.1.0] - 2026-06-11

> 本版本聚焦相对时间 DurationInput、JWT 单次登录超时、代码质量提升与 AI Agent 支持。

### Added

- **相对时间 DurationInput**：配置和 API 中的时长参数支持可读字符串（`'30m'`、`'2h'`、`'7d'`），保留数字秒数兼容：`DurationInput = number | \`${number}s\` | \`${number}m\` | \`${number}h\` | \`${number}d\` | \`${number}w\``，支持小数 `'1.5h'` = 5400 秒
- **JWT 单次登录超时**：`TokenStrategy.createToken` 新增可选参数 `options?.timeout`，JWT Strategy 使用 `options?.timeout ?? config.timeout` 生成 `exp`，与 Store TTL 保持一致
- **Docs 结构重构**：扁平编号文档迁移到 `guide/`、`core/`、`adapters/`、`reference/` 子目录，移除 `public/raw/` 冗余副本
- **AI Agent Skills**：项目新增 `skills/` 目录，包含 xlt-token AI Agent 工作流指南与参考文件

### Changed

- **TokenStrategy 泛型化**：`TokenStrategy<T = any>`，`JwtStrategy` 使用 `TokenStrategy<XltJwtPayload>` 获得类型安全的 `verifyToken` 返回值
- **Module 配置类型修复**：`XltTokenModuleOptions.config` 改为 `Partial<XltTokenConfigInput>`，消除类型不一致
- **JWT 非空断言消除**：`config.jwt!` 替换为 `ensureJwtConfig()` 并带清晰错误提示
- **`_resolveLoginIdJwt` 异常收窄**：仅捕获 `JsonWebTokenError`/`TokenExpiredError`/`NotBeforeError`，意外异常上抛
- **`MemoryStore` 长 TTL 警告**：超过 ~24.85 天的定时器添加 `console.warn` 提示
- **`DEFAULT_XLT_TOKEN_CONFIG` 冻结**：使用 `Object.freeze` 防止意外修改
- **`stp-perm-logic` 去重**：AND/OR 分支合并，消除重复 `Promise.all`
- **`factory.ts` 作用域修复**：`defaultStpInterface` 移到 `createXltToken` 函数内部
- **`NormalizeDurationOptions` 导出修复**：改为 `export type` 消除 `tsdown` 警告

### Test Coverage

```
Core:  241 tests passed (+10)
NestJS: 32 tests passed
E2E:    72 tests passed (+4)
```

### Documentation

- 文档目录重构为 `guide/`、`core/`、`adapters/`、`reference/`
- `configuration.md` 新增 DurationInput 章节和表格
- `core-api.md` 新增 DurationInput API 说明和类型

---

## [1.0.2] - 2026-06-08

### Added

- 支持 CJS / ESM 双入口发布。`xlt-token`、`@xlt-token/core`、`@xlt-token/express`、`@xlt-token/nestjs` 现在均提供 `dist/index.mjs`、`dist/index.cjs`、`dist/index.d.mts` 与 `dist/index.d.cts`。
- `@xlt-token/nestjs` 与根包 peer dependency 增加 NestJS v12 支持：`@nestjs/common` / `@nestjs/core` 支持 `^10.0.0 || ^11.0.0 || ^12.0.0`。

### Fixed

- 修复 ESM 项目中可能出现的运行时报错：`The requested module '@xlt-token/core' does not provide an export named 'XltTokenConfig'`。
- 将仅类型使用的导入改为 `import type`，避免 TypeScript interface 被错误打进 ESM runtime import。
- 修复 `RedisStore` 中 `XltTokenStore` 的类型导入方式。

### Changed

- 新增统一的 dual package exports 生成逻辑，确保每次 `tsdown build` 后都保持正确的 CJS / ESM exports。
- 所有发布包版本升级到 `1.0.2`，示例包版本升级到 `0.0.1`。
- 停止跟踪 `packages/*/node_modules`，后续由 `.gitignore` 正常忽略。

---

## [1.0.1] - 2026-06-06

### Fixed

- 修复发布包中残留 `workspace:*` 依赖的问题。`@xlt-token/express`、`@xlt-token/nestjs` 与根包现在使用 npm 可解析的 `@xlt-token/core@^1.0.1` 依赖范围，独立项目执行 `pnpm install` 不再报 `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND`。

---

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
