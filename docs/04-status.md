# xlt-token 现状分析与配置指南

> 生成时间：2026-04-20 | 最后更新：2026-04-20

---

## 零、项目定位（重要）

**xlt-token 是一个面向 NestJS 生态的独立 npm 包**，目标是复刻 Java Sa-Token 的登录鉴权核心。

### 定位带来的架构约束

| 约束 | 说明 |
|---|---|
| **零业务依赖** | 库内部不能依赖任何业务代码（`User`、`RedisService`、`ConfigService` 等均不能 import） |
| **`forRoot / forRootAsync` 必须实现** | 这是 NestJS 生态库的标准接口，使用方通过它传入配置，不能硬编码 |
| **`peerDependencies` 而非 `dependencies`** | `@nestjs/common`、`@nestjs/core` 等 NestJS 包必须放 `peerDependencies`，避免版本冲突 |
| **Store 接口必须可替换** | 库只提供 `MemoryStore`（开箱即用）+ `XltTokenStore` 接口，使用方自行实现 `RedisStore` 注入 |
| **不注册 `APP_GUARD`** | 库本身不应强制全局守卫，由使用方在自己的 `AppModule` 中决定是否注册 `XltTokenGuard` |
| **barrel 导出完整** | `index.ts` 必须导出所有公开 API，使用方 `import { StpLogic, XltIgnore } from 'xlt-token'` 即可 |

### 当前状态与定位的差距

> 当前代码还嵌在业务项目的 `src/config/xlt-token/` 目录下，尚未抽离为独立包。
> 在正式发布前，需要先在业务项目中验证功能完整性，再抽包发布。

---

## 一、配置说明

### 1.1 配置字段

| 字段 | 默认值 | 作用 |
|---|---|---|
| `tokenName` | `authorization` | HTTP header / cookie / query 中读取 token 的键名 |
| `timeout` | `2592000`（30 天） | token 有效期（秒） |
| `activeTimeout` | `-1` | 滑动过期秒数，`-1` 表示不启用 |
| `isConcurrent` | `true` | 是否允许同账号多端同时在线（`false` = 后登录踢前面的） |
| `isShare` | `true` | 同账号多次登录是否共享同一 token（配合 `isConcurrent=true` 使用） |
| `tokenStyle` | `uuid` | token 格式：`uuid` / `simple-uuid` / `random-32` |
| `isReadHeader` | `true` | 是否从 HTTP Header 读取 token |
| `isReadCookie` | `false` | 是否从 Cookie 读取 |
| `isReadQuery` | `false` | 是否从 URL Query 读取 |
| `tokenPrefix` | `Bearer ` | Header 中 token 的前缀（读取时自动剥离，生成 token 时不携带） |
| `defaultCheck` | `true` | 守卫默认模式：`true`=黑名单（`@XltIgnore` 跳过）；`false`=白名单（`@XltCheckLogin` 开启） |

### 1.2 标准接入方式（库发布后的使用方写法）

```typescript
// app.module.ts（使用方）
@Module({
  imports: [
    XltTokenModule.forRoot({
      tokenName: 'authorization',
      timeout: 2592000,
      tokenStyle: 'random-32',
    }),
  ],
})
export class AppModule {}

// 异步配置（读取环境变量）
XltTokenModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    timeout: config.get('TOKEN_TIMEOUT'),
  }),
  inject: [ConfigService],
})
```

### 1.3 自定义 Store（使用方替换 RedisStore）

```typescript
// 使用方自己实现 XltTokenStore 接口，注入到库中
XltTokenModule.forRoot({
  store: { useClass: RedisStore },  // 使用方提供
})
```

> **当前状态**：`forRoot / forRootAsync` 尚未实现，Store 还是写死的 `MemoryStore`，这是最优先要改的。

---

## 二、已完成功能清单 ✅

### P0 核心层

| 模块 | 文件 | 状态 |
|---|---|---|
| 配置接口与默认值 | `core/xlt-token-config.ts` | ✅ |
| 存储抽象接口 | `store/xlt-token-store.interface.ts` | ✅ |
| 内存存储实现 | `store/memory-store.ts` | ✅ 含定时器管理、32 位溢出保护 |
| 内存存储单测 | `store/memory-store.spec.ts` | ✅ |
| Token 策略抽象接口 | `token/token-strategy.interface.ts` | ✅ |
| UUID 策略实现 | `token/uuid-strategy.ts` | ✅ 支持三种 style |
| UUID 策略单测 | `token/uuid-strategy.spec.ts` | ✅ |
| 核心引擎 | `auth/stp-logic.ts` | ✅ login / logout / logoutByLoginId / kickout / renewTimeout / checkLogin / isLogin / getTokenValue |
| 核心引擎单测 | `auth/stp-logic.spec.ts` | ✅ |
| 常量与枚举 | `const/index.ts` | ✅ `NotLoginType` + metadata key |
| 异常类 | `exceptions/not-login.exception.ts` | ✅ 带 type + 描述映射 |
| 装饰器 × 4 | `decorators/` | ✅ `@XltCheckLogin` / `@XltIgnore` / `@LoginId()` / `@TokenValue()` |
| 全局守卫 | `guards/xlt-token.guard.ts` | ✅ 黑/白名单双模式，挂 `req.stpLoginId` / `req.stpToken` |

### 业务验证（在 Xlt-Admin-Backend 中完成接入）

| 集成点 | 状态 |
|---|---|
| `AuthService.login` 使用 `stpLogic.login(userId)` | ✅ |
| `AuthService.logout` 使用 `stpLogic.logoutByLoginId` | ✅ |
| `AuthService.refreshToken` 使用 `stpLogic.renewTimeout` | ✅ |
| `LoginGuard` 使用 `stpLogic.checkLogin` 校验请求 | ✅ |
| 移除 `@nestjs/jwt` 全部依赖 | ✅ |

---

## 三、未完成功能清单 ❌

### 🔴 P0 收尾（发包前必须完成）

| 优先级 | 模块 | 现状 | 待做 |
|---|---|---|---|
| **P0.1** | `xlt-token.module.ts` | 🔴 无 `forRoot`，Store 写死 | 实现 `forRoot(config)` / `forRootAsync({ useFactory, inject })`；Store 由外部注入 |
| **P0.2** | `auth/stp-util.ts` | 🔴 空文件 | 实现静态门面 `StpUtil.getLoginId()` / `StpUtil.checkLogin()`，配合 `AsyncLocalStorage` 免传 req |
| **P0.3** | `index.ts` barrel 导出 | 🔴 空文件 | 统一导出所有公开 API，使用方 `import { StpLogic } from 'xlt-token'` 即可 |
| **P0.4** | 移除 `@Global()` | 🟡 当前模块有 `@Global()` | 库不应强制全局，`forRoot` 内部决定是否全局；或让使用方自己决定 |
| **P0.5** | `APP_GUARD` 注册方式 | 🟡 当前在业务的 `AppModule` 中注册 | 库文档说明使用方如何注册，库本身不强制注册 |

### 🔴 P0 发包工程化（npm 发布必须）

| 项目 | 说明 |
|---|---|
| **抽离为独立包** | 从 `src/config/xlt-token` 迁移到独立 repo 或 monorepo 子包 |
| **`package.json` 配置** | `name`、`version`、`main`、`types`、`exports`、`peerDependencies`（`@nestjs/common`、`@nestjs/core`、`reflect-metadata`） |
| **构建配置** | `tsup` 或 `tsdown` 打包，输出 `dist/`，生成 `.d.ts` 声明文件 |
| **README.md** | 安装、快速开始、配置字段、API 文档 |
| **CHANGELOG.md** | 版本记录 |
| **CI/CD** | GitHub Actions：PR 跑测试，tag 触发发布到 npm |

### 🟡 P1 权限与会话

| 模块 | 作用 |
|---|---|
| **`StpInterface` 业务接口** | 使用方实现 `getPermissionList(loginId)` / `getRoleList(loginId)` 注入给库 |
| **`@XltCheckPermission('user:add')`** | 方法级权限校验装饰器 |
| **`@XltCheckRole('admin')`** | 方法级角色校验装饰器 |
| **`XltMode.AND` / `XltMode.OR`** | 多权限/角色逻辑组合 |
| **会话对象** | `StpLogic.getSession(loginId)`：附加用户信息、登录设备、登录时间 |

### 🟡 P2 多端与可选 Store

| 模块 | 作用 |
|---|---|
| **多端登录** | `login(id, { device: 'PC' })` / `logoutByDevice(id, 'PC')` |
| **Device 维度踢人** | 按设备独立管理 token |
| **`AsyncLocalStorage`** | 免传 `req`，`StpUtil.getLoginId()` 任意地方可用 |
| **JwtStrategy（可选）** | 可替换 `UuidStrategy`，token 自带 payload |

### 🟢 P3 扩展能力（按需）

| 模块 | 作用 |
|---|---|
| **临时 token** | `createTempToken(value, timeout)` |
| **二级认证** | `openSafe` / `checkSafe` |
| **账号封禁** | `disable` / `isDisable` / `untieDisable` |
| **单点登录（SSO）** | Ticket 生成、校验、跨域 |
| **日志与审计** | 登录/踢人/续签事件发 `EventEmitter` |

---

## 四、下一步行动（按优先级）

| 步骤 | 任务 | 预估工作量 | 说明 |
|---|---|---|---|
| **Step 1** | 实现 `XltTokenModule.forRoot / forRootAsync`，Store 改为外部注入 | 1h | 🔴 发包前必须，核心架构改动 |
| **Step 2** | 完善 `index.ts` barrel 导出 | 0.5h | 🔴 发包前必须 |
| **Step 3** | 实现 `StpUtil` 静态门面 | 1h | 🟡 简化业务调用 |
| **Step 4** | 迁移到 `XltTokenGuard` 全局守卫，废弃业务层 `LoginGuard` | 1h | 🟡 统一守卫，减少维护成本 |
| **Step 5** | 抽离独立包 + 构建配置（`tsup`/`tsdown`）+ `peerDependencies` | 2h | 🔴 发布 npm 必须 |
| **Step 6** | README + CI/CD 发布流水线 | 1h | 🔴 发布 npm 必须 |
| **Step 7** | 权限装饰器 `@XltCheckPermission` / `@XltCheckRole`（P1） | 3h | 🟡 有权限校验需求再做 |

---

## 五、注意事项 ⚠️

### 5.1 当前 `MemoryStore` 的限制

- **单机单进程可用**，适合开发调试。
- **不能用于生产多实例部署**：进程间内存不共享，同一用户在不同实例登录会互相覆盖。
- 正式生产前，使用方需自行实现 `RedisStore` 并通过 `forRoot({ store: { useClass: RedisStore } })` 注入。

### 5.2 `@Global()` 的问题

- 当前 `XltTokenModule` 带 `@Global()` 是在业务项目中的临时方案。
- 作为 npm 库，**不应强制 `@Global()`**，这会影响使用方模块隔离。应在 `forRoot` 实现时提供 `isGlobal` 选项（默认 `false`），由使用方选择。

### 5.3 token 前缀处理

- `tokenPrefix: 'Bearer '` 只用于**读取时剥离前缀**，不用于生成 token（`UuidStrategy.createToken` 已不拼接前缀）。
- 返回给客户端的 token 是纯 UUID，前端请求时自行在 header 中添加 `Bearer ` 前缀。
