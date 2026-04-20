# xlt-token 完整规划 (Roadmap)

> 本文档是整个 `xlt-token` 库的总纲，回答三个问题：
> 1. 这个库最终要做成什么样？
> 2. 一共要实现哪些功能？
> 3. 第一步做什么，后续每步做什么，每步里每个细项具体要写什么代码？

配套文档：
- `01-architecture.md`：架构 / 分层 / 目录 / 配置字段
- `02-stp-logic.md`：核心引擎 StpLogic 的方法级设计

---

## 一、项目定位

- **目标**：在 NestJS 下复刻 Java [`xlt-token`](https://sa-token.cc/) 的**登录鉴权核心**，并逐步扩展到权限、会话、多端、SSO。
- **不做什么**：不做 OAuth2 Provider、不做用户管理 CRUD、不侵入业务表结构。只做"发 token + 存映射 + 校验"。
- **边界**：库只提供能力，具体登录账密校验、用户表、权限表由业务层负责。

---

## 二、功能全景图（最终形态）

按优先级分为 **P0 ~ P3** 四档。本仓库当前只做 P0，其余留接口。

### P0 登录鉴权核心（MVP，必须做）

| 模块 | 功能 | 说明 |
|---|---|---|
| 配置 | `XltTokenConfig` | token 名、超时、读取位置、并发策略等 |
| 存储 | `XltTokenStore` 抽象 + `MemoryStore` | get/set/delete/getTimeout/update/updateTimeout |
| Token 策略 | `TokenStrategy` 抽象 + `UuidStrategy` | 生成 token 字符串 |
| 核心引擎 | `StpLogic` | login / logout / isLogin / checkLogin / kickout / replaced / renewTimeout ...（见 02 文档 14 个方法）|
| 门面 | `StpUtil` | 静态调用入口，业务代码一行拿 loginId |
| 装饰器 | `@XltCheckLogin` / `@XltIgnore` / `@LoginId()` / `@TokenValue()` | 方法/类级鉴权标记 + 参数注入 |
| 守卫 | `XltTokenGuard` | 全局守卫，黑名单模式（默认需登录，`@XltIgnore` 放行）|
| 异常 | `NotLoginException` + `NotLoginType` 枚举 | 带 type 的 401 |
| 模块装配 | `XltTokenModule.forRoot / forRootAsync` | DI 注册 |

### P1 权限与会话（第二阶段）

| 模块 | 功能 |
|---|---|
| 权限接口 | `StpInterface.getPermissionList(loginId) / getRoleList(loginId)` 交由业务实现 |
| 权限装饰器 | `@XltCheckPermission('user:add')` / `@XltCheckRole('admin')` |
| 逻辑运算 | `XltMode.AND` / `XltMode.OR`（多权限组合）|
| Session 对象 | `StpLogic.getSession(loginId)`：附加用户信息、登录设备、登录时间 |
| 注销增强 | 踢人/顶号后记录下线原因，可查询 |

### P2 多端与持久化

| 模块 | 功能 |
|---|---|
| Redis Store | 替换 `MemoryStore`，支持分布式 |
| 多端登录 | `sessionKey` 存数组/Hash，支持 `PC / APP / H5` 同时在线且可独立踢 |
| Device 维度 | `login(id, { device: 'PC' })` → 按设备下线 `logoutByDevice(id, 'PC')` |
| JWT 策略 | `JwtStrategy` 替换 `UuidStrategy`，token 自带 payload |
| AsyncLocalStorage | 免传 req，`StpUtil.getLoginId()` 任意处可调 |

### P3 扩展能力（按需）

| 模块 | 功能 |
|---|---|
| 临时 token | `createTempToken(value, timeout)`，用于短链、验证码 |
| 二级认证 | `openSafe(service, timeout)` / `checkSafe(service)`（如支付前二次验证）|
| 账号封禁 | `disable(loginId, service, time)` / `isDisable` / `untieDisable` |
| 单点登录 (SSO) | Ticket 生成、校验、跨域 |
| OAuth2 Client | 授权码、密码、客户端模式 |
| 注解增强 | `@XltCheckHttpBasic` / `@XltCheckDisable` |
| 日志与审计 | 登录/踢人/续签事件发 EventEmitter，业务订阅落库 |

---

## 三、第一步（P0 之 Step 1）：配置 + Store 基座

> **目标**：把"存东西 / 取东西 / 过期"这一地基打稳。不碰 HTTP、不碰用户。一个 spec 跑通就算本步完成。

当前仓库里 `store/memory-store.ts` / `core/xlt-token-config.ts` 已经存在骨架，第一步就是**把它们补完并通过单测**。

### Step 1 拆解

#### 1.1 `core/xlt-token-config.ts`

- 导出 `XltTokenConfig` interface：字段见 `01-architecture.md` 第六节。
- 导出 `DEFAULT_XLT_TOKEN_CONFIG` 常量（全字段默认值）。
- 导出 InjectionToken：
  - `XLT_TOKEN_CONFIG = Symbol('XLT_TOKEN_CONFIG')`
  - `XLT_TOKEN_STORE  = Symbol('XLT_TOKEN_STORE')`
  - `XLT_TOKEN_STRATEGY = Symbol('XLT_TOKEN_STRATEGY')`
- 导出 `mergeConfig(user?: Partial<XltTokenConfig>): XltTokenConfig`，用户配置 + 默认值合并。
- **不做**：不在这里读环境变量，保持纯函数。

#### 1.2 `store/xlt-token-store.interface.ts`

接口方法（全部返回 `Promise`，哪怕内存实现是同步的也包 Promise）：

| 方法 | 签名 | 说明 |
|---|---|---|
| `get` | `(key: string) => Promise<string \| null>` | 过期或不存在都返回 null |
| `set` | `(key: string, value: string, timeout: number) => Promise<void>` | timeout 秒；-1 表示永不过期 |
| `delete` | `(key: string) => Promise<void>` | 不存在不报错 |
| `update` | `(key: string, value: string) => Promise<void>` | 只改 value，保留原 ttl |
| `getTimeout` | `(key: string) => Promise<number>` | 剩余秒，-1 永久，-2 不存在 |
| `updateTimeout` | `(key: string, timeout: number) => Promise<void>` | 只改 ttl |

**设计要点**：
- 约定 `-2` = 不存在，`-1` = 永久，`>0` = 剩余秒。这套约定对齐 Redis `TTL` 命令，未来换 Redis 无缝。

#### 1.3 `store/memory-store.ts`

- 用 `Map<string, { value: string; expireAt: number | -1 }>` 存数据。
- `expireAt = Date.now() + timeout * 1000`，`timeout === -1` 时 `expireAt = -1`。
- `get` 时惰性清理：若 `expireAt !== -1 && Date.now() > expireAt`，删除并返回 null。
- 同时维护一个 `Map<string, NodeJS.Timeout>` 做主动清理，`set` 时先 `clearTimeout(oldTimer)` 再写新 timer，**这一步是踩坑重点**（见 01 文档第八节）。
- `update` 不重置 timer。
- `updateTimeout` 要：`clearTimeout(oldTimer) → 重算 expireAt → 建新 timer`。

#### 1.4 `store/memory-store.spec.ts`

单测覆盖（用 `jest.useFakeTimers()` 加速）：

1. `set + get` 基本读写
2. `set` 同 key 覆盖，旧 timer 不会误删新值
3. `timeout: 1` 秒后 `get` 返回 null
4. `timeout: -1` 长期不过期
5. `delete` 后 `get` 返回 null，再 `delete` 不报错
6. `update` 只改 value，`getTimeout` 不变
7. `updateTimeout` 重置过期时间
8. `getTimeout` 对不存在的 key 返回 -2，对永久 key 返回 -1

✅ **本步完成标准**：`pnpm test memory-store` 全绿。

---

## 四、后续步骤概览（Step 2 ~ Step 7）

每步都要能独立 `pnpm test` 跑通，避免攒一坨代码再调试。

### Step 2：Token 策略

- `token/token-strategy.interface.ts`：`createToken(loginId, config): string`
- `token/uuid-strategy.ts`：支持 `uuid`（带连字符 36 位）/ `simple-uuid`（32 位无连字符）/ `random-32`（纯随机 32 位 a-z0-9）三种 `tokenStyle`。
- `uuid-strategy.spec.ts`：生成 1000 个 token 去重，长度符合 style。

### Step 3：StpLogic 主流程（login / isLogin / getLoginId / logout）

- 先不实现 `activeTimeout`、不实现并发分支，最朴素跑通。
- 按 `02-stp-logic.md` §4.1 / §4.2 / §4.3 / §4.4 写。
- 单测：登录 → 断言 `tokenKey` / `sessionKey` 都写入；`isLogin(req)` 返回 true；`logout` 后两边都清掉。

### Step 4：互踢 + 哨兵值

- 补 `replaced` / `kickout` / `logoutByLoginId`（02 文档 §4.5~§4.6）。
- `login` 里补 `isConcurrent=false` 分支：老 token 改写为 `BE_REPLACED`。
- 单测：同账号登录两次，第一次拿到的 token 再去 `checkLogin` 应抛 `NotLoginException(BE_REPLACED)`。

### Step 5：守卫 + 装饰器（黑名单模式）

- `decorators/xlt-ignore.decorator.ts`：`SetMetadata('xlt-ignore', true)`，类级/方法级都支持。
- `decorators/xlt-check-login.decorator.ts`：白名单备用（`defaultCheck=false` 时使用），实现同上，元数据键 `xlt-check-login`。
- `guards/xlt-token.guard.ts`：
  - `Reflector.getAllAndOverride('xlt-ignore', [handler, class])` → 命中放行。
  - 否则 `await stpLogic.checkLogin(req)`，把 `loginId / token` 挂到 `req.stpLoginId` 和 `req.stpToken`。
- `xlt-token.module.ts` 里 `APP_GUARD` 注册。
- e2e：一个 `/public` 接口加 `@XltIgnore` → 200；`/private` 不加 → 401。

### Step 6：参数装饰器

- `decorators/login-id.decorator.ts`：`createParamDecorator((_, ctx) => ctx.switchToHttp().getRequest().stpLoginId)`。
- `decorators/token-value.decorator.ts`：同上取 `token`。
- 依赖 Step 5 里把数据挂到了 `req.stpLoginId` 和 `req.stpToken`。
- 单测：controller 方法签名 `foo(@LoginId() id: string)` 能正确拿到 id。

### Step 7：Module 入口 + 全局异常过滤器

- `XltTokenModule.forRoot(config: Partial<XltTokenConfig>)`：注册 3 个 provider（config、store、strategy）+ `StpLogic` + `APP_GUARD`。
- `forRootAsync({ useFactory, inject })`：支持异步读 ConfigService。
- `StpUtil.init(stpLogic)` 在 `OnModuleInit` 钩子里调用，静态持有实例。
- 异常过滤器（可选）：把 `NotLoginException` 统一包装成业务 `Result.fail(401, type, message)` 格式。
- 在 `app.module.ts` 接入一次，跑一个真实请求链路。

---

## 五、验收清单（P0 完成标志）

- [ ] `pnpm test` 全部用例通过（store / strategy / stp-logic 三套 spec）
- [ ] 在 `app.module.ts` 中 `XltTokenModule.forRoot({...})` 成功装配
- [ ] 一个受保护接口：无 header → 401 `NOT_TOKEN`；错误 token → 401 `INVALID_TOKEN`；正常 token → 200
- [ ] `@XltIgnore` 标注的接口裸奔可访问
- [ ] `kickout(loginId)` 后，原 token 请求返回 401 `KICK_OUT`
- [ ] Controller 方法 `@LoginId() id` 能正确注入
- [ ] 旧的 `LoginGuard` / `PermissionGuard` 暂不删除，两套并行，后续迁移

---

## 六、风险与回滚

| 风险 | 预案 |
|---|---|
| 与现有 `LoginGuard` 冲突 | 先不走全局 `APP_GUARD`，只在新 controller 上 `@UseGuards(XltTokenGuard)` 试点 |
| `MemoryStore` 多实例内存不共享 | P0 明确只用于单机；多实例场景直接上 P2 的 Redis Store |
| `StpUtil` 静态引用导致测试互相污染 | 每个 spec `beforeEach` 重新 `StpUtil.init`，或干脆测试里只用注入的 `StpLogic` |
| 配置字段增多难维护 | 所有默认值集中在 `DEFAULT_XLT_TOKEN_CONFIG`，新增字段必须同步更新默认值和文档表格 |

---

## 七、文档维护约定

- 新增配置字段 → 同步改 `01-architecture.md` §6 的表格。
- 新增 StpLogic 方法 → 同步改 `02-stp-logic.md` §3 清单 + §4 伪代码。
- 新增功能阶段 → 在本文 §2 表格里落位。
- 每完成一个 Step，在本文 §4 对应条目前加 ✅。
