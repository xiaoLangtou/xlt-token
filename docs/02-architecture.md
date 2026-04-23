# 02 · 架构设计

xlt-token 的分层、核心抽象、存储键布局与并发语义。

## 设计目标

- **无侵入**：NestJS Module / Guard / Decorator 方式集成，业务代码几乎零改动
- **可替换**：Token 生成策略、存储后端均通过 DI Token 抽象
- **双形态 API**：
  - 实例形态 `StpLogic` → 便于测试与依赖注入
  - 静态门面 `StpUtil` → 非 DI 场景（拦截器 / 过滤器 / 脚本）直接调用

## 分层

```
┌────────────────────────────────────────────────────────────┐
│ 装饰器层  @XltIgnore / @XltCheckLogin                       │
│           @LoginId / @TokenValue                           │
├────────────────────────────────────────────────────────────┤
│ 守卫层    XltTokenGuard（默认，零配置）                     │
│           XltAbstractLoginGuard（抽象基类，业务扩展）        │
├────────────────────────────────────────────────────────────┤
│ 门面层    StpUtil（静态方法）                               │
│ 业务层    StpLogic（核心引擎）                              │
├────────────────────────────────────────────────────────────┤
│ 抽象接口  TokenStrategy    |    XltTokenStore              │
├────────────────────────────────────────────────────────────┤
│ 实现层    UuidStrategy                                      │
│           MemoryStore      |    RedisStore                 │
└────────────────────────────────────────────────────────────┘
```

## 核心抽象

| 抽象 | DI Token | 职责 |
| --- | --- | --- |
| 配置 | `XLT_TOKEN_CONFIG` | 运行时配置（`XltTokenConfig`） |
| 存储 | `XLT_TOKEN_STORE` | KV 存储接口（`XltTokenStore`） |
| 策略 | `XLT_TOKEN_STRATEGY` | Token 生成策略（`TokenStrategy`） |

均在 `XltTokenModule.forRoot(...)` / `forRootAsync(...)` 内注册，使用者通过 `@Inject(XXX)` 访问。

## 核心概念

- **loginId**：业务唯一用户标识。调用 `login(loginId)` 时传入。**不能为空，且不能包含 `:`**（会与存储键分隔符冲突）。
- **token**：`TokenStrategy` 生成的字符串，客户端持有。
- **request.stpLoginId / request.stpToken**：守卫校验通过后自动挂载到 `request` 上，供装饰器 `@LoginId()` / `@TokenValue()` 读取。

## 三类存储键

全部以配置的 `tokenName` 作为前缀（源自 `src/auth/stp-logic.ts:176-196`）：

| 键模板 | 值 | 用途 |
| --- | --- | --- |
| `${tokenName}:login:token:${token}` | `loginId` 或状态标记 | 通过 token 反查 loginId；被顶号时值为 `BE_REPLACED`；被踢时值为 `KICK_OUT` |
| `${tokenName}:login:session:${loginId}` | `token` | 通过 loginId 反查当前 token；用于顶号、按 loginId 登出 |
| `${tokenName}:login:lastActive:${token}` | `Date.now()` 毫秒字符串 | 仅当 `activeTimeout > 0` 时存在；用于活跃过期判定 |

以默认 `tokenName='authorization'` 为例：

```
authorization:login:token:550e8400-e29b-41d4-a716-446655440000   → "1001"
authorization:login:session:1001                                  → "550e8400-..."
authorization:login:lastActive:550e8400-...                       → "1700000000000"
```

## 并发 / 共享语义

由 `isConcurrent` 与 `isShare` 两个配置决定 `login(loginId)` 的行为（源自 `src/auth/stp-logic.ts:37-44`）：

| `isConcurrent` | `isShare` | 行为 |
| --- | --- | --- |
| `false` | *（忽略）* | 同 loginId 二次登录 → 旧 token 值置为 `BE_REPLACED`（**顶号**），生成新 token |
| `true` | `true` | 复用旧 token（**多端共享同一 token**） |
| `true` | `false` | 每次登录生成新 token，旧 token 仍然有效（**多端并发独立 token**） |

使用建议：

- **单设备强制（网银风格）**：`isConcurrent=false`
- **移动端 + 桌面端共用一份登录态**：`isConcurrent=true, isShare=true`
- **多端独立、互不影响**：`isConcurrent=true, isShare=false`

## 请求到授权的全链路

```
HTTP Request
    │
    ▼
Guard（XltTokenGuard 或子类）
    │ 1. 读 @XltIgnore / defaultCheck 决定是否放行
    │ 2. StpLogic.checkLogin(req)
    │     ├─ getTokenValue(req)           // 从 header / cookie / query 取
    │     ├─ store.get(tokenKey)          // 反查 loginId
    │     ├─ 值为 BE_REPLACED / KICK_OUT → 抛异常
    │     └─ activeTimeout 校验 + 刷新 lastActive
    │ 3. request.stpLoginId = result.loginId
    │    request.stpToken   = result.token
    │ 4.（子类钩子）加载用户信息到 request.user
    ▼
Controller handler
    │
    │ 通过 @LoginId() / @TokenValue() / @UserInfo() 获取身份
    ▼
Response
```

## 初始化副作用

`XltTokenModule` 内部会注册一个隐藏的 `XLT_TOKEN_INIT` Provider，注入完成后调用 `setStpLogic(stpLogic)`，让静态门面 `StpUtil` 能取到实例。

⚠️ **只要 `XltTokenModule` 未被引入，调用任何 `StpUtil.xxx()` 都会抛**：
> `StpLogic not initialized. Please ensure XltTokenModule is imported correctly.`

如果你在 `main.ts` 的 `bootstrap` 阶段调 `StpUtil`，务必在 `NestFactory.create(...)` **完成后**。

## 目录结构（当前实现）

```
src/
├── index.ts                          // 统一导出入口
├── xlt-token.module.ts               // NestJS 动态模块（forRoot / forRootAsync）
├── core/
│   └── xlt-token-config.ts           // XltTokenConfig 类型 + 默认值 + DI Token
├── auth/
│   ├── stp-logic.ts                  // 核心引擎
│   ├── stp-util.ts                   // 静态门面
│   └── stp-logic.spec.ts
├── store/
│   ├── xlt-token-store.interface.ts  // 存储接口
│   ├── memory-store.ts               // 内存实现
│   ├── redis-store.ts                // Redis 实现
│   └── *.spec.ts
├── token/
│   ├── token-strategy.interface.ts
│   ├── uuid-strategy.ts              // uuid / simple-uuid / random-32
│   └── uuid-strategy.spec.ts
├── guards/
│   ├── xlt-token.guard.ts            // 默认守卫
│   └── xlt-abstract-login.guard.ts   // 业务可扩展抽象基类
├── decorators/
│   ├── xlt-ignore.decorator.ts
│   ├── xlt-check-login.decorator.ts
│   ├── login-id.decorator.ts
│   └── token-value.decorator.ts
├── exceptions/
│   └── not-login.exception.ts        // 401 未登录异常
└── const/
    └── index.ts                      // NotLoginType 等常量
```

## 下一步

- 我想看具体 API → [04-core-api](./04-core-api.md)
- 我想自定义 Store / 策略 → [06-storage](./06-storage.md) / [07-token-strategy](./07-token-strategy.md)
- 我想 handle 各种登录异常 → [08-exceptions](./08-exceptions.md)
