# xlt-token 架构设计

> 一个 NestJS 版的 xlt-token 风格鉴权库。第一阶段只聚焦 **登录鉴权核心**。

## 一、核心设计哲学

- **登录** = 生成 Token 并在服务端记录 `Token → LoginId` 的映射。
- **鉴权** = 从请求中取出 Token，到服务端查映射是否有效。
- **有状态**：不依赖 JWT 自验签，所有权威状态都存在 Store（内存 / Redis）。这样才能实现踢人、封禁、强制下线等有状态操作。
- **Token 只是钥匙**，真正的身份数据在服务端。

## 二、整体分层

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────┐
│  XltTokenGuard (全局守卫)             │ ← 读元数据，决定是否放行
└─────────────────────────────────────┘
    │ 调用
    ▼
┌─────────────────────────────────────┐
│  StpLogic (核心引擎)                 │ ← 登录/登出/校验
└─────────────────────────────────────┘
    │ 依赖[01-architecture.md](01-architecture.md)
    ├──► TokenStrategy   (生成 Token)
    ├──► XltTokenStore    (存储映射)
    └──► XltTokenConfig   (配置)
```

## 三、目录结构

```
src/config/xlt-token/
├── core/
│   └── xlt-token-config.ts          # 配置接口 + 默认值 + InjectionToken
├── store/
│   ├── xlt-token-store.interface.ts # 存储抽象
│   └── memory-store.ts             # 内存实现（默认）
├── token/
│   ├── token-strategy.interface.ts # Token 生成策略抽象
│   └── uuid-strategy.ts            # UUID 策略
├── auth/
│   ├── stp-logic.ts                # ★ 核心引擎
│   └── stp-util.ts                 # 静态门面，业务代码只用这个
├── decorators/
│   ├── xlt-check-login.decorator.ts
│   ├── xlt-ignore.decorator.ts
│   ├── login-id.decorator.ts
│   └── token-value.decorator.ts
├── guards/
│   └── xlt-token.guard.ts
├── exceptions/
│   └── not-login.exception.ts      # 未登录异常（带原因码）
├── xlt-token.module.ts              # forRoot() / forRootAsync() 入口
└── index.ts                        # 对外 barrel
```

## 四、各层职责概览

| 层 | 文件 | 职责 |
|---|---|---|
| 配置 | `core/xlt-token-config.ts` | 定义配置接口、默认值、DI Token |
| 存储 | `store/*` | `get/set/delete/getTimeout/update/updateTimeout` |
| 策略 | `token/*` | 无状态的 Token 字符串生成器 |
| 引擎 | `auth/stp-logic.ts` | 登录、登出、校验、踢人、续签 |
| 门面 | `auth/stp-util.ts` | 静态调用入口（可选） |
| 装饰器 | `decorators/*` | 元数据标记 + 参数注入 |
| 守卫 | `guards/*` | 读元数据，调用 StpLogic，挂数据到 req |
| 异常 | `exceptions/*` | `NotLoginException` 带 type 字段 |
| 模块 | `xlt-token.module.ts` | 装配 DI，支持异步配置 |

## 五、Key 命名规范

| 用途 | 格式 | 举例 |
|---|---|---|
| token → loginId | `{tokenName}:login:token:{token}` | `satoken:login:token:xxxx-xxxx` |
| loginId → token | `{tokenName}:login:session:{loginId}` | `satoken:login:session:1001` |
| token 活跃时间 | `{tokenName}:login:last-active:{token}` | 仅启用 activeTimeout 时写 |

反向映射是实现 "踢人下线 / 不允许多端并发" 的关键。

## 六、配置字段清单

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `tokenName` | string | `satoken` | header/cookie/query 的 key |
| `timeout` | number | `2592000` | Token 有效期（秒），-1 永不过期 |
| `activeTimeout` | number | `-1` | 临时过期（不操作 N 秒失效），-1 关闭 |
| `isConcurrent` | boolean | `true` | 是否允许同一账号多端登录 |
| `isShare` | boolean | `true` | 并发时是否共用 Token |
| `tokenStyle` | string | `uuid` | `uuid` / `simple-uuid` / `random-32` |
| `isReadHeader` | boolean | `true` | 从 Header 读 Token |
| `isReadCookie` | boolean | `false` | 从 Cookie 读 Token |
| `isReadQuery` | boolean | `false` | 从 Query 读 Token |
| `tokenPrefix` | string | `''` | 如 `Bearer `，读取时自动裁掉 |
| `defaultCheck` | boolean | `true` | 默认是否需要登录（黑名单模式） |

## 七、开发里程碑（7 步法）

每一步都应能独立跑通一个最小验证：

1. **配置 + Store 接口 + MemoryStore**：单测 set/get/过期/delete
2. **UuidStrategy**：打印 10 个 token 看唯一性
3. **StpLogic 基础三件套**：`login` + `isLogin` + `getLoginId`（先不做 activeTimeout / 并发）
4. **logout + kickout + 反向映射**：登录两次验证是否互踢
5. **装饰器 + Guard（黑名单模式）**：给 controller 加 `@XltIgnore` 观察行为
6. **参数装饰器**：`@LoginId()` / `@TokenValue()` 注入
7. **forRoot + 接入 app.module + 异常 Filter**：端到端联调

## 八、踩坑清单

- Key 里的 loginId 必须 `String(loginId)`，避免数字 `1` 和字符串 `'1'` 分裂成两条记录。
- `MemoryStore.set` 要先清旧 key 的定时器再写，否则旧 `setTimeout` 会误删新值。
- Header 名称统一 `toLowerCase()` 再比较。
- Guard 里调用异步 Store 必须 `await`。
- `StpUtil` 静态持有 `StpLogic`，要在 `OnModuleInit` 里赋值，避免循环依赖。
- `@XltIgnore` 同时支持类级和方法级，用 `Reflector.getAllAndOverride([handler, class])`。
- 与现有 `LoginGuard` / `PermissionGuard` 先并行，稳定后再迁移。

## 九、第二阶段（本次不做，留接口）

- Redis Store（替换 MemoryStore）
- JWT Strategy（替换 UuidStrategy）
- Session 对象（存附加用户信息）
- `@XltCheckPermission` / `@XltCheckRole` 权限注解
- `AsyncLocalStorage` + `StpUtil.getLoginId()` 免传 req
