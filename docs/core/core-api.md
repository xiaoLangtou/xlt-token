# 04 · 核心 API（StpLogic / StpUtil）

> 包：`@xlt-token/core`（NestJS 用户通过 `@xlt-token/nestjs` re-export 使用）

所有对外能力最终都由 `StpLogic` 实现，`StpUtil` 是无需注入的静态门面（内部转发到同一 `StpLogic` 实例）。

## 两种形态

| 场景 | 推荐 | 示例 |
| --- | --- | --- |
| Service / Controller（可 DI） | `StpLogic` | `constructor(private stp: StpLogic) {}` |
| 拦截器 / 过滤器 / 脚本 / 工具类（DI 不便） | `StpUtil` | `StpUtil.login(userId)` |

两者方法签名基本一致。NestJS 场景下 `StpUtil.getLoginId(req)` 仍接受 Express `Request`（内部转为 `HttpContext`）；直接使用 core 时请传 `HttpContext`。

## 方法参考

### `login(loginId, options?)`

**签发 token 并写入存储**。

```ts twoslash
login(
  loginId: string | number,
  options?: {
    timeout?: DurationInput;  // 本次登录有效期，支持 '30m', '2h', '7d' 等或数字秒数
    device?: string;          // 设备标识，见多端登录文档
    token?: string;           // 手动指定 token（极少使用，通常留空由策略生成）
  },
): Promise<string>             // 返回纯 token（不含前缀）
```

**行为要点**：

1. 校验 `loginId` 非空、不含 `:`
2. 读 `sessionKey(loginId)` → `oldToken`
3. 根据 `isConcurrent` / `isShare` 决定是复用旧 token、顶号还是生成新 token（见 [架构 · 并发语义](/guide/architecture#并发--共享语义)）
4. 写入 `tokenKey` / `sessionKey`；若 `activeTimeout > 0` 同步写入 `lastActiveKey`

**示例**：

```ts twoslash
const token = await this.stp.login(user.id);
// 指定本次登录 1 小时超时（不影响全局配置），支持相对时间字符串
const tempToken = await this.stp.login(user.id, { timeout: '1h' });
```

### `getTokenValue(ctx)`

**从请求中提取 token**，顺序：`header → cookie → query`，自动剥离 `tokenPrefix`。

```ts twoslash
getTokenValue(ctx: HttpContext): Promise<string | null>
```

NestJS 中 Guard 内部通过 `createExpressContext(req, res)` 构造 `HttpContext`。业务代码通常不直接调用，装饰器 `@TokenValue()` 是它的包装。

### `isLogin(ctx)`

**静默判断**请求是否登录，**不抛异常**。

```ts twoslash
isLogin(ctx: HttpContext): Promise<boolean>
```

适用场景：同时支持登录/未登录访问的接口，需要分支处理。

### `checkLogin(ctx)`

**严格校验**，失败抛 `NotLoginException`（401）。

```ts twoslash
checkLogin(ctx: HttpContext): Promise<AuthResult>
// AuthResult = { ok: boolean; loginId?; token?; reason?: NotLoginType }
```

成功后写入 `ctx.state.stpLoginId` / `ctx.state.stpToken`。Guard 内部调用此方法，业务层一般不直接调。

### `logout(token)`

**按 token 登出**。清理 `tokenKey` / `lastActiveKey` / `sessionKey` 三类键。

```ts twoslash
logout(token: string): Promise<boolean | null>
```

返回：
- `true` → 登出成功
- `null` → token 为空 / 已不存在

### `logoutByLoginId(loginId)`

**按 loginId 登出**。常用于"管理员强制退出某用户"或 logout API 只有 userId 的场景。

```ts twoslash
logoutByLoginId(loginId: string): Promise<boolean | null>
```

### `kickout(loginId)`

**踢人下线**。与 `logoutByLoginId` 的区别：

| | `logoutByLoginId` | `kickout` |
| --- | --- | --- |
| 效果 | 物理删除 tokenKey | 将 tokenKey 值改为 `KICK_OUT`（保留 TTL） |
| 用户下次请求 | `NotLoginType.INVALID_TOKEN` | `NotLoginType.KICK_OUT`（可区分被踢场景给出提示） |
| 场景 | 用户主动登出、账号注销 | 管理员强制下线、风控触发 |

```ts twoslash
kickout(loginId: string): Promise<boolean | null>
```

### `renewTimeout(token, timeout)`

**续签 token / session / lastActive 的 TTL**。不改值，只改过期。

```ts twoslash
renewTimeout(token: string, timeout: DurationInput): Promise<boolean | null>
```

- `timeout` 支持相对时间字符串（如 `'30m'`）或数字秒数，`-1` 永久
- `token` 找不到返回 `null`
- 常用于"refresh-token"接口或"滑动续期"

### 其他支持 DurationInput 的方法

以下方法的 `timeout` 参数同样支持相对时间字符串：

- `openSafe(token, business, timeout: DurationInput)` — 见 [二级认证](/core/secondary-auth)
- `createTempToken(value, timeout: DurationInput)` — 见 [二级认证](/core/secondary-auth)

类型 `DurationInput = number | \`${number}s\` | \`${number}m\` | \`${number}h\` | \`${number}d\` | \`${number}w\``

### `StpUtil.getLoginId(req)`（仅 StpUtil 提供）

```ts twoslash
StpUtil.getLoginId(req): Promise<string | null>
```

内部调 `isLogin` + 解析，拿不到返回 `null`，不抛异常。

## `checkLogin` 的内部判定顺序

对应 `_resolveLoginId`（`packages/core/src/auth/stp-logic.ts`）：

```
1. getTokenValue(ctx) 为空 → NOT_TOKEN
2. store.get(tokenKey) 不存在 → INVALID_TOKEN
3. 值为 BE_REPLACED → BE_REPLACED（顶号）
4. 值为 KICK_OUT → KICK_OUT（被踢）
5. activeTimeout > 0:
   ├─ lastActive 不存在 → TOKEN_FREEZE
   ├─ (now - lastActive) > activeTimeout → TOKEN_TIMEOUT
   └─ 未超时 → 刷新 lastActive → 通过
6. 通过 → { ok: true, loginId, token }
```

> 注意：`TOKEN_TIMEOUT` 只在 `activeTimeout` 机制下触发。**绝对 timeout 过期**走的是"存储层 TTL 到期 → key 消失 → `INVALID_TOKEN`"。

## 关键流程时序

### 登录

```
StpLogic.login(loginId, options?)
  ├─ 校验 loginId 合法性
  ├─ store.get(sessionKey(loginId)) → oldToken
  ├─ 决策：
  │    ├─ !isConcurrent         → oldToken 存在则 compareAndSet(tokenKey(oldToken), loginId, 'BE_REPLACED', keepTtl()) → 生成新 token
  │    ├─ isConcurrent & isShare → oldToken 存在则复用，否则生成
  │    └─ isConcurrent & !isShare → 生成新 token
  ├─ store.set(tokenKey, loginId, finiteTtl(timeout))
  ├─ store.set(sessionKey, token, finiteTtl(timeout))
  ├─ activeTimeout > 0 时 store.set(lastActiveKey, Date.now(), finiteTtl(timeout))
  └─ return token
```

### 踢人

```
StpLogic.kickout(loginId)
  ├─ store.get(sessionKey(loginId)) → token
  ├─ compareAndSet(tokenKey(token), loginId, 'KICK_OUT', keepTtl())   // 保留 TTL，只改值
  └─ store.delete(sessionKey(loginId))
```

被踢用户下次请求触发 `_resolveLoginId` 第 4 步 → 抛 `NotLoginException(KICK_OUT)`。

### 登出

```
StpLogic.logout(token)
  ├─ store.get(tokenKey(token)) → loginId
  ├─ loginId 为空 → return null
  ├─ store.delete(tokenKey(token))
  ├─ store.delete(lastActiveKey(token))
  └─ store.delete(sessionKey(loginId))
```

## 完整方法一览

| 方法 | `StpLogic` | `StpUtil` | 返回 |
| --- | :---: | :---: | --- |
| `login(loginId, options?)` | ✅ | ✅ | `Promise<string>` |
| `getTokenValue(ctx)` | ✅ | ✅¹ | `Promise<string \| null>` |
| `isLogin(ctx)` | ✅ | ✅¹ | `Promise<boolean>` |
| `checkLogin(ctx)` | ✅ | ✅¹ | `Promise<AuthResult>` |
| `logout(token)` | ✅ | ✅ | `Promise<boolean \| null>` |
| `logoutByLoginId(loginId)` | ✅ | ✅ | `Promise<boolean \| null>` |
| `kickout(loginId)` | ✅ | ✅ | `Promise<boolean \| null>` |
| `renewTimeout(token, timeout)` | ✅ | ✅ | `Promise<boolean \| null>` |
| `openSafe(token, business, timeout)` | ✅ | ✅ | `Promise<void>` |
| `createTempToken(value, timeout)` | ✅ | ✅ | `Promise<string>` |
| `parseTempToken(tempToken)` | ✅ | ✅ | `Promise<string \| null>` |
| `deleteTempToken(tempToken)` | ✅ | ✅ | `Promise<void>` |
| `getLoginId(req)` | ❌ | ✅ | `Promise<string \| null>` |
| `logoutByDevice(loginId, device)` | ✅ | ✅ | `Promise<boolean \| null>` |
| `refreshToken(token, timeout?)` | ✅ | ✅ | `Promise<RefreshResult>` |

¹ `StpUtil` 的 `getTokenValue` / `isLogin` / `checkLogin` 在 NestJS 中仍接受 Express `Request`，内部自动包装为 `HttpContext`。

> **JWT 模式差异**：`logout`、`logoutByLoginId`、`logoutByDevice` 在 JWT 模式下通过 jti 黑名单吊销 token，而非删除 tokenKey（JWT 模式不存在 tokenKey）。`renewTimeout` 在 JWT 模式下延长 Store TTL（JWT 内嵌的 `exp` 不可修改）。`refreshToken` 需要启用 `config.lifecycle.refresh.enabled`，成功返回 `{ ok: true, accessToken, family }`，失败返回 `{ ok: false, code }`。

## 下一步

- 想看 Guard 如何调 `checkLogin`？→ [守卫与装饰器](/adapters/nestjs/guards-and-decorators)
- 多端登录与 device API → [多端登录](/core/multi-device)
- 二级认证与临时 Token → [二级认证](/core/secondary-auth)
- JWT 模式 → [JWT 策略](/core/jwt-strategy)
- 审计事件与在线列表 → [审计事件与观测性](/core/hooks-and-observability)
- 想实现自定义 Store？→ [Store 契约与内存存储](/core/storage)
- 想使用 Redis？→ [Redis Store 完整指南](/store-redis/)
- 各种异常怎么处理？→ [异常处理](/core/exceptions)
