# StpLogic 核心引擎详细设计

> `auth/stp-logic.ts`——整个库的大脑。所有对外能力最终都落到这个类的方法上。

## 一、类定位

- **NestJS `@Injectable()` 单例**，无状态（状态全在 Store）。
- 通过构造函数注入三个依赖：`XltTokenConfig` / `XltTokenStore` / `TokenStrategy`。
- 对外暴露 **14 个公共方法**（第一阶段）。
- 所有涉及 Store 的方法返回 `Promise`，即使当前是 MemoryStore 同步也要包 Promise，保持接口一致。

```ts
@Injectable()
class StpLogic {
  constructor(
    @Inject(XLT_TOKEN_CONFIG) private readonly config: XltTokenConfig,
    @Inject(XLT_TOKEN_STORE)  private readonly store: XltTokenStore,
    @Inject(XLT_TOKEN_STRATEGY) private readonly strategy: TokenStrategy,
  ) {}
}
```

## 二、内部工具方法（私有）

### 2.1 Key 生成器

```
tokenKey(token)      → `${config.tokenName}:login:token:${token}`
sessionKey(loginId)  → `${config.tokenName}:login:session:${String(loginId)}`
lastActiveKey(token) → `${config.tokenName}:login:last-active:${token}`
```

**要点**：

- `loginId` 必须 `String()` 一次，防止 number/string 分裂。
- 不要直接暴露 key 格式到外部，只在 StpLogic 内部使用。
- 未来迁 Redis 时格式不变，直接切换 Store 实现即可。

### 2.2 配置快捷访问

不要散落在各方法里 `this.config.xxx`，建一个私有 getter 统一处理默认值兜底：

```
private get effectiveTimeout(): number { return this.config.timeout ?? 2592000 }
private get activeTimeoutOn(): boolean { return (this.config.activeTimeout ?? -1) > 0 }
```

## 三、公共方法清单

| # | 方法 | 作用 | 抛异常 |
|---|---|---|---|
| 1 | `login(loginId, options?)` | 登录签发 Token | 参数非法 |
| 2 | `logout(token)` | 指定 token 下线 | 否 |
| 3 | `logoutByLoginId(loginId)` | 指定账号全端下线 | 否 |
| 4 | `isLogin(req)` | 静默判断是否登录 | 否，返回 boolean |
| 5 | `checkLogin(req)` | 校验，未登录抛异常 | NotLoginException |
| 6 | `getLoginId(req)` | 获取当前登录 ID | NotLoginException |
| 7 | `getLoginIdDefault(req, default)` | 获取，失败返回默认值 | 否 |
| 8 | `getTokenValue(req)` | 从请求提取 token | 否，可能返回 null |
| 9 | `getTokenTimeout(token)` | 查 token 剩余时间 | 否 |
| 10 | `renewTimeout(token, timeout)` | 续签 | 否 |
| 11 | `kickout(loginId)` | 踢人下线 | 否 |
| 12 | `replaced(loginId)` | 顶号（被其他端挤下线） | 否 |
| 13 | `isBanned(loginId)` *(预留)* | 是否被封禁 | 否 |
| 14 | `getTokenInfo(req)` | 调试用，返回完整信息对象 | 否 |

## 四、核心方法伪代码

### 4.1 `login(loginId, options)`

```
输入: loginId (string|number), options?: { timeout?, device?, token? }
输出: token (string)

1. 参数校验:
   - loginId 不能为空 / undefined / null
   - String(loginId) 不能包含冒号 ':' (会破坏 key 结构)
   - 非法则抛 Error('invalid loginId')

2. 计算本次 timeout:
   - const timeout = options.timeout ?? config.timeout

3. 查旧 session:
   - const oldToken = await store.get(sessionKey(loginId))

4. 按并发策略分支:
   a) config.isConcurrent === false:
      - 存在 oldToken 则: await this.replaced(loginId)  // 把旧 token 值改成 'BE_REPLACED'
      - 生成新 token
   b) config.isConcurrent === true && config.isShare === true:
      - oldToken 存在且未过期 → 直接复用, 跳到第 6 步续期
      - 否则生成新 token
   c) config.isConcurrent === true && config.isShare === false:
      - 每次都生成新 token (旧 token 保留, 形成多端并行)
      - 注: 完整多端需要把 sessionKey 的值改成 JSON 数组, 第一阶段可先用覆盖式实现, 留 TODO

5. 生成 token:
   - const token = options.token ?? strategy.createToken(loginId, config)

6. 写入 Store:
   - await store.set(tokenKey(token),  String(loginId), timeout)
   - await store.set(sessionKey(loginId), token,        timeout)

7. 活跃期登记:
   - if activeTimeoutOn: await store.set(lastActiveKey(token), String(Date.now()), timeout)

8. return token
```

### 4.2 `getTokenValue(req)`

```
输入: Express Request
输出: string | null

按顺序尝试, 命中即返回:
1. if config.isReadHeader:
   - const raw = req.headers[config.tokenName.toLowerCase()]
   - raw 可能是 string | string[], 取第一个
   - 若 config.tokenPrefix 且 raw.startsWith(prefix): raw = raw.slice(prefix.length)
   - trim 后非空则返回
2. if config.isReadCookie:
   - req.cookies?.[config.tokenName] (需项目启用 cookie-parser)
3. if config.isReadQuery:
   - req.query?.[config.tokenName]
4. 都没有 → return null
```

### 4.3 `isLogin(req)` / `checkLogin(req)`

两者共用一个内部方法 `_resolveLoginId(req)`，区别只是失败时静默还是抛异常。

```
_resolveLoginId(req): Promise<{ ok: boolean; loginId?: string; token?: string; reason?: NotLoginType }>

1. const token = getTokenValue(req)
   - 为空 → { ok: false, reason: NOT_TOKEN }

2. const loginId = await store.get(tokenKey(token))
   - 为空 → { ok: false, reason: INVALID_TOKEN, token }
   - 值为 'BE_REPLACED' → { ok: false, reason: BE_REPLACED }
   - 值为 'KICK_OUT'    → { ok: false, reason: KICK_OUT }

3. 活跃期检查 (仅 activeTimeoutOn):
   - const lastStr = await store.get(lastActiveKey(token))
   - 为空时: 视为已冻结 → reason: TOKEN_FREEZE
   - const idle = (Date.now() - Number(lastStr)) / 1000
   - idle > config.activeTimeout → { ok: false, reason: TOKEN_FREEZE }
   - 否则刷新 lastActive: store.update(lastActiveKey(token), String(Date.now()))

4. return { ok: true, loginId, token }
```

- `isLogin`: 看 ok 返回 boolean。
- `checkLogin`: ok=false 时抛 `new NotLoginException(reason)`，ok=true 返回 `{ loginId, token }`。
- `getLoginId` / `getLoginIdDefault`: 复用 `_resolveLoginId`，避免重复查 Store。

### 4.4 `logout(token)`

```
1. 若 token 为空 → 直接 return (幂等)
2. const loginId = await store.get(tokenKey(token))
3. await store.delete(tokenKey(token))
4. await store.delete(lastActiveKey(token))   // 无论是否启用都删, 无害
5. if loginId: await store.delete(sessionKey(loginId))
```

### 4.5 `logoutByLoginId(loginId)`

```
1. const token = await store.get(sessionKey(loginId))
2. await store.delete(sessionKey(loginId))
3. if token:
   - await store.delete(tokenKey(token))
   - await store.delete(lastActiveKey(token))
```

### 4.6 `kickout(loginId)` / `replaced(loginId)`

两者逻辑几乎一样，仅标记值不同（便于前端区分"被踢"和"被顶号"）。

```
kickout(loginId):
  const token = await store.get(sessionKey(loginId))
  if !token: return
  await store.update(tokenKey(token), 'KICK_OUT')    // 只改值, 保留过期时间
  await store.delete(sessionKey(loginId))            // 反向映射直接删

replaced(loginId): 同上, 值为 'BE_REPLACED'
```

**为什么不直接删 tokenKey**：删掉的话前端拿到的原因是 `INVALID_TOKEN`（等同于 token 不存在 / 已过期），无法区分"被踢"这种重要提示。用哨兵值可以精准提示用户"您的账号在其他设备登录"。

### 4.7 `renewTimeout(token, timeout)`

```
1. const loginId = await store.get(tokenKey(token))
2. if !loginId: return (已失效, 无需续签)
3. await store.updateTimeout(tokenKey(token),   timeout)
4. await store.updateTimeout(sessionKey(loginId), timeout)
5. if activeTimeoutOn: await store.updateTimeout(lastActiveKey(token), timeout)
```

## 五、NotLoginException 设计

```ts
enum NotLoginType {
  NOT_TOKEN    = 'NOT_TOKEN',     // 请求中没 token
  INVALID_TOKEN = 'INVALID_TOKEN', // token 在服务端找不到
  TOKEN_TIMEOUT = 'TOKEN_TIMEOUT', // 已过期（保留, Store 过期即消失, 实际走 INVALID_TOKEN）
  TOKEN_FREEZE  = 'TOKEN_FREEZE',  // 临时活跃过期
  BE_REPLACED   = 'BE_REPLACED',   // 被顶号
  KICK_OUT      = 'KICK_OUT',      // 被踢下线
}

class NotLoginException extends UnauthorizedException {
  constructor(public readonly type: NotLoginType) {
    super({ code: 401, type, message: MSG_MAP[type] });
  }
}
```

前端拿到 `type` 字段即可精准提示。继承 `UnauthorizedException` 让 Nest 自动走 401。

## 六、单元测试清单（建议）

完成 StpLogic 后，至少覆盖以下用例（用 MemoryStore）：

- `login` 返回非空 token，且能 `getLoginId` 拿回
- `login` 两次同一账号（`isConcurrent=false`）：旧 token 应被标记 `BE_REPLACED`
- `login` 两次同一账号（`isShare=true`）：两次返回同一 token
- `logout` 后 `isLogin` 返回 false
- `kickout` 后 `checkLogin` 抛出 `NotLoginException` 且 `type === KICK_OUT`
- token 从 header / cookie / query 都能读出来
- `tokenPrefix='Bearer '` 时，header `Bearer xxx` 能正确裁前缀
- 过期时间到后 `isLogin` 为 false（用假时钟或 `timeout: 1` + setTimeout）
- `activeTimeout` 启用时，超时不操作会 `TOKEN_FREEZE`

## 七、实现顺序建议

即使只写 StpLogic 本身，也建议分 3 步自测：

1. **先写 login / logout / isLogin / getLoginId**（跳过并发、activeTimeout），用最朴素的实现跑通主流程。
2. **补 kickout / replaced / 反向映射分支**，验证互踢。
3. **补 activeTimeout / renewTimeout**，收尾。

这样每一步都能独立 `npm run test` 验证，不会调试时面对一团乱麻。
