# xlt-token 文档

> NestJS Token 鉴权库，灵感来源于 Sa-Token。轻量、可插拔、零业务侵入。

## 快速导航

| 主题 | 文档 | 适合场景 |
| --- | --- | --- |
| 🚀 **快速开始** | [01-getting-started](./01-getting-started.md) | 第一次接入，5 分钟跑通登录/登出 |
| 🏗️ **架构设计** | [02-architecture.md](./02-architecture.md) | 了解分层、存储键结构、并发语义 |
| ⚙️ **配置参考** | [03-configuration.md](./03-configuration.md) | 查阅 `XltTokenConfig` 字段、`forRoot` / `forRootAsync` 用法 |
| 🧠 **核心 API** | [04-core-api.md](./04-core-api.md) | `StpLogic` / `StpUtil` 所有方法与时序 |
| 🛡️ **守卫与装饰器** | [05-guards-and-decorators.md](./05-guards-and-decorators.md) | `XltTokenGuard` / `XltAbstractLoginGuard` / `@LoginId` / `@XltIgnore` |
| 💾 **存储层** | [06-storage.md](./06-storage.md) | `MemoryStore` / `RedisStore` / 自定义 Store |
| 🎨 **Token 策略** | [07-token-strategy.md](./07-token-strategy.md) | `uuid` / `simple-uuid` / `random-32`，接入 JWT |
| ⚠️ **异常处理** | [08-exceptions.md](./08-exceptions.md) | `NotLoginException` / `NotLoginType` 六种场景 |
| 🧪 **场景手册** | [09-recipes.md](./09-recipes.md) | 顶号、踢人、活跃过期、多端并发、用户信息注入等 |
| 📖 **源码参考** | [SRC-REFERENCE.md](./SRC-REFERENCE.md) | 一站式深度参考（单文件速查） |
| 🗺️ **P1 规划** | [10-roadmap-p1.md](./10-roadmap-p1.md) | 权限与会话阶段：架构、接口、分步实施 |

## 项目规划

### 当前状态（v1.0）

✅ **P0 登录鉴权核心** - 已完成

| 模块 | 状态 |
| --- | --- |
| 配置系统 | ✅ `XltTokenConfig` 完整配置项 |
| 存储层 | ✅ `MemoryStore` + `RedisStore` + 自定义接口 |
| Token 策略 | ✅ `UuidStrategy`（三种风格）+ 自定义策略支持 |
| 核心引擎 | ✅ `StpLogic` 完整实现（login/logout/kickout 等） |
| 静态门面 | ✅ `StpUtil` 全局调用 |
| 守卫系统 | ✅ `XltTokenGuard` + `XltAbstractLoginGuard` |
| 装饰器 | ✅ `@XltCheckLogin` / `@XltIgnore` / `@LoginId` / `@TokenValue` |
| 异常处理 | ✅ `NotLoginException` + 六种 `NotLoginType` |
| 模块集成 | ✅ `forRoot` / `forRootAsync` |

### 未来规划

📋 **P1 权限与会话** - 规划中（详见 [10-roadmap-p1.md](./10-roadmap-p1.md)）

- 权限接口：`StpInterface.getPermissionList` / `getRoleList`
- 权限装饰器：`@XltCheckPermission` / `@XltCheckRole`（支持 `XltMode.AND/OR` + 通配符）
- Session 对象：`XltSession` 承载用户信息、设备、登录时间、扩展字段
- 注销增强：记录下线原因（`KICK_OUT` / `BE_REPLACED`）与时间戳

📋 **P2 多端与持久化** - 规划中

- 多端登录：PC / APP / H5 独立会话
- Device 维度：按设备登录/登出
- JWT 策略：内置 JWT 实现
- AsyncLocalStorage：无上下文调用

📋 **P3 扩展能力** - 按需实现

- 临时 token：短链、验证码场景
- 二级认证：支付前二次验证
- 账号封禁：临时/永久禁用
- 单点登录 (SSO)：跨域认证
- 日志审计：登录/踢人事件订阅

> 详细历史规划见 [archive/00-roadmap.md](./archive/00-roadmap.md)

## 其他

- 历史设计/实施文档归档于 [archive/](./archive/)
- 项目 README：[../README.md](../README.md)
- npm: `pnpm add xlt-token`

## 文档约定

- 文件路径统一使用从仓库根开始的绝对路径引用，例：`src/auth/stp-logic.ts`
- 代码示例默认使用 TypeScript + Composition 风格的 NestJS
- 涉及**配置字段**时会标注默认值和对应 `DEFAULT_XLT_TOKEN_CONFIG`
- 涉及**Redis key** 时会同时给出键名模板与示例
