# 04 · 核心 API（StpLogic / StpUtil）

所有对外能力最终都由 `StpLogic` 实现，`StpUtil` 是无需注入的静态门面（内部转发到同一 `StpLogic` 实例）。

## 两种形态

| 场景 | 推荐 | 示例 |
| --- | --- | --- |
| Service / Controller（可 DI） | `StpLogic` | `constructor(private stp: StpLogic) {}` |
| 拦截器 / 过滤器 / 脚本 / 工具类（DI 不便） | `StpUtil` | `StpUtil.login(userId)` |

两者方法签名基本一致，`StpUtil` 额外提供了 `getLoginId(req)` 这一便捷方法。

## 方法参考

### `login(loginId, options?)`

**签发 token 并写入存储**。

```ts
login(
  loginId: string | number,
  options?: {
    timeout?: number;   // 本次登录专属有效期（秒），覆盖全局 timeout
    device?: string;    // 预留字段（当前未参与逻辑）
    token?: string;     // 手动指定 token（极少使用，通常留空由策略生成）
  },
): Promise<string>       // 返回纯 token（不含前缀）
```

**行为要点**：

1. 校验 `loginId` 非空、不含 `:`
2. 读 `sessionKey(loginId)` → `oldToken`
3. 根据 `isConcurrent` / `isShare` 决定是复用旧 token、顶号还是生成新 token（见 [02-architecture · 并发语义](./02-architecture.md#并发--共享语义)）
4. 写入 `tokenKey` / `sessionKey`；若 `activeTimeout > 0` 同步写入 `lastActiveKey`

**示例**：

```ts
const token = await this.stp.login(user.id);
// 指定本次登录 1 小时超时（不影响全局配置）
const tempToken = await this.stp.login(user.id, { timeout: 3600 });
```

### `getTokenValue(req)`

**从请求中提取 token**，顺序：`header → cookie → query`，自动剥离 `tokenPrefix`。

```ts
getTokenValue(req: Request): Promise<string | null>
```

通常业务代码不直接用，装饰器 `@TokenValue()` 是它的包装。

### `isLogin(req)`

**静默判断**请求是否登录，**不抛异常**。

```ts
isLogin(req: Request): Promise<boolean>
```

适用场景：同时支持登录/未登录访问的接口，需要分支处理。

### `checkLogin(req)`

**严格校验**，失败抛 `NotLoginException`（HTTP 401）。

```ts
checkLogin(req: Request): Promise<{
  ok: boolean;
  loginId?: string;
  token?: string;
  reason?: NotLoginType;
}>
```

Guard 内部调用的就是它。业务层一般不直接调。

### `logout(token)`

**按 token 登出**。清理 `tokenKey` / `lastActiveKey` / `sessionKey` 三类键。

```ts
logout(token: string): Promise<boolean | null>
```

返回：
- `true` → 登出成功
- `null` → token 为空 / 已不存在

### `logoutByLoginId(loginId)`

**按 loginId 登出**。常用于"管理员强制退出某用户"或 logout API 只有 userId 的场景。

```ts
logoutByLoginId(loginId: string): Promise<boolean | null>
```

### `kickout(loginId)`

**踢人下线**。与 `logoutByLoginId` 的区别：

| | `logoutByLoginId` | `kickout` |
| --- | --- | --- |
| 效果 | 物理删除 tokenKey | 将 tokenKey 值改为 `KICK_OUT`（保留 TTL） |
| 用户下次请求 | `NotLoginType.INVALID_TOKEN` | `NotLoginType.KICK_OUT`（可区分被踢场景给出提示） |
| 场景 | 用户主动登出、账号注销 | 管理员强制下线、风控触发 |

```ts
kickout(loginId: string): Promise<boolean | null>
```

### `renewTimeout(token, timeout)`

**续签 token / session / lastActive 的 TTL**。不改值，只改过期。

```ts
renewTimeout(token: string, timeout: number): Promise<boolean | null>
```

- `timeout` 单位秒，`-1` 永久
- `token` 找不到返回 `null`
- 常用于"refresh-token"接口或"滑动续期"

### `StpUtil.getLoginId(req)`（仅 StpUtil 提供）

```ts
StpUtil.getLoginId(req): Promise<string | null>
```

内部调 `isLogin` + 解析，拿不到返回 `null`，不抛异常。

## `checkLogin` 的内部判定顺序

对应 `_resolveLoginId`（`src/auth/stp-logic.ts:146-169`）：

```
1. getTokenValue(req) 为空 → NOT_TOKEN
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
  │    ├─ !isConcurrent         → oldToken 存在则 update(tokenKey(oldToken), 'BE_REPLACED') → 生成新 token
  │    ├─ isConcurrent & isShare → oldToken 存在则复用，否则生成
  │    └─ isConcurrent & !isShare → 生成新 token
  ├─ store.set(tokenKey, loginId, timeout)
  ├─ store.set(sessionKey, token, timeout)
  ├─ activeTimeout > 0 时 store.set(lastActiveKey, Date.now(), timeout)
  └─ return token
```

### 踢人

```
StpLogic.kickout(loginId)
  ├─ store.get(sessionKey(loginId)) → token
  ├─ store.update(tokenKey(token), 'KICK_OUT')   // 保留 TTL，只改值
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
| `getTokenValue(req)` | ✅ | ✅ | `Promise<string \| null>` |
| `isLogin(req)` | ✅ | ✅ | `Promise<boolean>` |
| `checkLogin(req)` | ✅ | ✅ | `Promise<{ ok, loginId?, token?, reason? }>` |
| `logout(token)` | ✅ | ✅ | `Promise<boolean \| null>` |
| `logoutByLoginId(loginId)` | ✅ | ✅ | `Promise<boolean \| null>` |
| `kickout(loginId)` | ✅ | ✅ | `Promise<boolean \| null>` |
| `renewTimeout(token, timeout)` | ✅ | ✅ | `Promise<boolean \| null>` |
| `getLoginId(req)` | ❌ | ✅ | `Promise<string \| null>` |

## 下一步

- 想看 Guard 如何调 `checkLogin`？→ [05-guards-and-decorators](./05-guards-and-decorators.md)
- 想了解存储实现差异？→ [06-storage](./06-storage.md)
- 各种异常怎么处理？→ [08-exceptions](./08-exceptions.md)
