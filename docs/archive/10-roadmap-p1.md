# P1 规划：权限与会话

> 本文档是 xlt-token **第二阶段（P1）** 的完整规划：回答做什么、怎么做、分几步做。
>
> - 前置：P0（登录鉴权核心）已完成，详见 [SRC-REFERENCE.md](./SRC-REFERENCE.md)
> - 后续：P2（多端与持久化）、P3（扩展能力）参见 [README.md](./README.md#未来规划)

---

## 一、目标与非目标

### 目标（Do）

1. 提供**权限/角色校验**能力，业务只需实现一个接口即可接入。
2. 提供**会话（Session）对象**，承载"一次登录期间"的附加数据（用户信息、设备、登录时间、扩展字段）。
3. 提供**声明式装饰器**：`@XltCheckPermission` / `@XltCheckRole`，支持 AND / OR 组合。
4. **下线原因可追溯**：被踢/被顶后，业务可查询下线时间和原因。
5. 与 P0 **完全兼容**，不破坏现有 API。

### 非目标（Don't）

- 不做用户/角色/权限的 CRUD 和存储（交给业务）
- 不做权限缓存的 TTL 管理（由 `XltTokenStore` 透明处理）
- 不做菜单树、按钮级前端权限映射（前端职责）
- 不在 P1 做多端（留给 P2）

---

## 二、功能清单

| 模块 | 功能 | 新增文件 | 状态 |
| --- | --- | --- | --- |
| 权限接口 | `StpInterface.getPermissionList / getRoleList` | `src/perm/stp-interface.ts` | 📋 |
| 权限引擎 | `StpPermLogic.hasPermission / checkPermission / hasRole / checkRole` | `src/perm/stp-perm-logic.ts` | 📋 |
| 权限装饰器 | `@XltCheckPermission` / `@XltCheckRole` | `src/decorators/xlt-check-permission.decorator.ts` 等 | 📋 |
| 逻辑组合 | `XltMode.AND` / `XltMode.OR` | `src/const/index.ts` 扩展 | 📋 |
| 会话对象 | `XltSession`：get/set/delete/keys | `src/session/xlt-session.ts` | 📋 |
| 会话工厂 | `StpLogic.getSession(loginId)` | `src/auth/stp-logic.ts` 扩展 | 📋 |
| 静态门面 | `StpUtil.hasPermission` / `getSession` 等 | `src/auth/stp-util.ts` 扩展 | 📋 |
| 守卫升级 | `XltTokenGuard` 识别权限元数据并触发校验 | `src/guards/xlt-token.guard.ts` 扩展 | 📋 |
| 异常扩展 | `NotPermissionException` / `NotRoleException` | `src/exceptions/` | 📋 |
| 下线记录 | `OfflineRecord`：原因 + 时间 | 写入 Store，key 带前缀 | 📋 |

---

## 三、整体架构

### 3.1 分层视图（P1 增量）

```
┌─────────────────────────────────────────────────────────┐
│  HTTP 层                                                 │
│  @XltCheckPermission / @XltCheckRole（装饰器，元数据）  │
│  XltTokenGuard（读元数据 → 触发校验，抛异常）            │
└─────────────────────────────────────────────────────────┘
                         ↓ 调用
┌─────────────────────────────────────────────────────────┐
│  权限层（新增）                                           │
│  StpPermLogic                                            │
│    ├─ hasPermission(loginId, p)                          │
│    ├─ checkPermission(loginId, p[], mode)                │
│    ├─ hasRole / checkRole                                │
│    └─ 依赖 → StpInterface（业务实现）                    │
└─────────────────────────────────────────────────────────┘
                         ↓ 业务注入
┌─────────────────────────────────────────────────────────┐
│  业务扩展点                                               │
│  class UserStpInterface implements StpInterface {}       │
│    getPermissionList(loginId) → string[]                 │
│    getRoleList(loginId)       → string[]                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  会话层（新增）                                           │
│  StpLogic.getSession(loginId) → XltSession               │
│  XltSession → 透明读写 Store（键：<name>:login:session-data:<id>）│
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  存储层（复用 P0，键空间扩展）                           │
│  XltTokenStore：新增键前缀，无需修改接口                 │
└─────────────────────────────────────────────────────────┘
```

### 3.2 存储键空间扩展

P0 已有：

```
<tokenName>:login:token:<token>        → loginId（或 BE_REPLACED/KICK_OUT 哨兵）
<tokenName>:login:session:<loginId>    → token（反向索引）
<tokenName>:login:lastActive:<token>   → 时间戳
```

P1 新增：

```
<tokenName>:login:session-data:<loginId>  → JSON（XltSession 内容）
<tokenName>:login:perm-cache:<loginId>    → JSON（权限缓存，可选）
<tokenName>:login:role-cache:<loginId>    → JSON（角色缓存，可选）
<tokenName>:login:offline:<token>         → JSON { reason, time }（下线记录）
```

> 注意：`session-data` 与 `session` 是两个不同含义——前者是"附加业务数据"，后者是"loginId → token 的反向索引"。命名沿用 Sa-Token 习惯，避免与 Web 语义的 session 混淆。

### 3.3 DI 装配

```ts
XltTokenModule.forRoot({
  config: { ... },
  stpInterface: UserStpInterface,  // P1 新增，可选
})
```

- `stpInterface` 不提供时 → 所有权限/角色检查抛 `Error('StpInterface not registered')`
- 提供后 → 注册为 provider（token 为 `XLT_STP_INTERFACE`），`StpPermLogic` 注入使用

---

## 四、核心抽象设计

### 4.1 `StpInterface`（业务扩展点）

```ts
// src/perm/stp-interface.ts
export interface StpInterface {
  /**
   * 返回 loginId 对应的权限码列表
   * @example ['user:add', 'user:delete', 'order:*']
   */
  getPermissionList(loginId: string): Promise<string[]> | string[];

  /**
   * 返回 loginId 对应的角色码列表
   * @example ['admin', 'editor']
   */
  getRoleList(loginId: string): Promise<string[]> | string[];
}

export const XLT_STP_INTERFACE = 'XLT_STP_INTERFACE';
```

### 4.2 `StpPermLogic`（权限引擎）

```ts
// src/perm/stp-perm-logic.ts
@Injectable()
export class StpPermLogic {
  constructor(
    @Inject(XLT_STP_INTERFACE) private stpInterface: StpInterface,
    @Inject(XLT_TOKEN_STORE) private store: XltTokenStore,
    @Inject(XLT_TOKEN_CONFIG) private config: XltTokenConfig,
  ) {}

  // 单权限判断（支持通配符：user:* 匹配 user:add / user:edit）
  async hasPermission(loginId: string, permission: string): Promise<boolean>;

  // 批量 + 模式组合，不通过抛 NotPermissionException
  async checkPermission(loginId: string, permissions: string[], mode: XltMode): Promise<void>;

  async hasRole(loginId: string, role: string): Promise<boolean>;
  async checkRole(loginId: string, roles: string[], mode: XltMode): Promise<void>;
}
```

**通配符规则**（复刻 Sa-Token）：

| 用户拥有 | 被检查 | 是否通过 |
| --- | --- | --- |
| `user:add` | `user:add` | ✅ |
| `user:*` | `user:add` | ✅ |
| `*` | `anything` | ✅ |
| `user:add` | `user:delete` | ❌ |

### 4.3 `XltSession`（会话对象）

```ts
// src/session/xlt-session.ts
export class XltSession {
  constructor(
    private loginId: string,
    private store: XltTokenStore,
    private keyBuilder: (loginId: string) => string,
    private timeout: number,
  ) {}

  async get<T = unknown>(key: string): Promise<T | null>;
  async set(key: string, value: unknown): Promise<void>;
  async delete(key: string): Promise<void>;
  async has(key: string): Promise<boolean>;
  async keys(): Promise<string[]>;
  async clear(): Promise<void>;
}
```

**实现策略**：整对象序列化为 JSON 存一个 key，每次 `set` 读-改-写。简单可靠，不追求原子性（同一用户同时写入极少）。

### 4.4 `XltMode`（逻辑组合）

```ts
// src/const/index.ts 增量
export const XltMode = {
  AND: 'AND',
  OR: 'OR',
} as const;
export type XltMode = typeof XltMode[keyof typeof XltMode];
```

### 4.5 装饰器

```ts
// 方法级 / 类级
@XltCheckPermission('user:add')
@XltCheckPermission(['user:add', 'user:edit'], { mode: XltMode.OR })

@XltCheckRole('admin')
@XltCheckRole(['admin', 'super'], { mode: XltMode.AND })
```

元数据 Key：

```ts
export const XLT_PERMISSION_KEY = 'XltCheckPermission';
export const XLT_ROLE_KEY = 'XltCheckRole';
```

### 4.6 异常

```ts
// src/exceptions/not-permission.exception.ts
export class NotPermissionException extends Error {
  constructor(public readonly permission: string | string[], public readonly mode: XltMode) {
    super(`Not permission: ${permission}`);
  }
}

export class NotRoleException extends Error { /* 同构 */ }
```

业务通过全局异常过滤器统一转换为 HTTP 403。

---

## 五、请求流（含权限）

```
Client → Controller handler
         @XltCheckLogin（可选）
         @XltCheckPermission('user:add')
              ↓
         XltTokenGuard.canActivate(ctx)
           1. @XltIgnore ？→ 放行
           2. 读 token → checkLogin → 拿到 loginId
           3. 读 @XltCheckPermission 元数据
              → stpPermLogic.checkPermission(loginId, perms, mode)
              → 不通过抛 NotPermissionException
           4. 读 @XltCheckRole 元数据
              → stpPermLogic.checkRole(...)
           5. 全部通过 → req.stpLoginId 挂载 → next
```

**关键点**：权限校验在**同一个 Guard** 中完成，不额外注册新的 Guard，避免 Reflector 重复读取。

---

## 六、配置字段增量

```ts
export interface XltTokenConfig {
  // ... P0 字段 ...

  // P1 新增
  permCacheTimeout?: number;  // 权限缓存秒数，0 = 不缓存，-1 = 永久，默认 0
  offlineRecordEnabled?: boolean;  // 是否记录下线原因，默认 false
  offlineRecordTimeout?: number;   // 下线记录保留秒数，默认 3600
}
```

**默认值**：

```ts
permCacheTimeout: 0,
offlineRecordEnabled: false,
offlineRecordTimeout: 3600,
```

---

## 七、分步实施计划

> 每一步都要能独立 `pnpm test` 通过。

### Step 1：StpInterface + XltMode 基础骨架

- 新建 `src/perm/stp-interface.ts`（接口 + DI token）
- `src/const/index.ts` 增加 `XltMode`、`XLT_PERMISSION_KEY`、`XLT_ROLE_KEY`
- `XltTokenModule.forRoot` 支持 `stpInterface` 选项，未提供时注册 noop 占位

**验收**：模块能正常启动，不影响 P0。

### Step 2：StpPermLogic + 通配符匹配

- 新建 `src/perm/stp-perm-logic.ts`
- 实现 `hasPermission` 含通配符匹配函数 `matchPattern(pattern, target)`
- `checkPermission` / `hasRole` / `checkRole` 完整实现
- 新建 `NotPermissionException` / `NotRoleException`
- **单测**：
  - 精确匹配 / 通配符 / 多层通配符（`user:*:list`）
  - AND / OR 组合
  - 业务返回空数组 → 抛异常

### Step 3：权限装饰器 + Guard 接入

- 新建 `src/decorators/xlt-check-permission.decorator.ts`
- 新建 `src/decorators/xlt-check-role.decorator.ts`
- 升级 `XltTokenGuard`：登录校验通过后读权限元数据并调用 `StpPermLogic`
- **e2e 测试**：装饰器标记的接口，无权限 → 403，有权限 → 200

### Step 4：XltSession 对象

- 新建 `src/session/xlt-session.ts`
- `StpLogic.getSession(loginId)` 返回 session 实例（懒加载模式：不存在时不创建）
- `StpUtil.getSession()`（当前请求的 loginId）
- **单测**：get / set / delete / keys / clear 全覆盖

### Step 5：下线记录

- `StpLogic.kickout` / `replaced` 时写 `offline:<token>` key（仅当 `offlineRecordEnabled=true`）
- 新增 `StpLogic.getOfflineReason(token)` 查询
- 对应异常注入 `reason` 字段
- **单测**：踢人后查下线原因能拿到 `KICK_OUT` + 时间戳

### Step 6：文档与示例

- 新建 `docs/11-permission.md`：权限使用手册
- 新建 `docs/12-session.md`：会话使用手册
- `docs/09-recipes.md` 增加：权限场景、用户信息注入（从 session 拿）

---

## 八、与 P0 兼容性策略

| 场景 | 行为 |
| --- | --- |
| 只用 P0，不传 `stpInterface` | 完全兼容，无任何差异 |
| 用了 `@XltCheckPermission` 但没注册 `stpInterface` | 启动时 throw，明确错误而非静默 |
| 老配置对象字段缺失 P1 新字段 | 走默认值（`permCacheTimeout=0` 等于关闭） |
| `XltAbstractLoginGuard` 子类 | 新增 `onPermissionDenied` 钩子（可选 override），默认透传异常 |

---

## 九、关键决策与取舍

### 9.1 权限为什么不内置缓存？

- 业务通常已有用户信息缓存（如登录时写入 Redis），再加一层易不一致
- 提供 `permCacheTimeout` 配置留口子，默认关闭，需要时再开

### 9.2 Session 为什么单 JSON 对象而非多 key？

- 简单，读一次即可拿全量
- 典型场景（用户基础信息、设备、登录时间）数据量小（< 1KB）
- 多 key 方案引入 Hash 结构，`MemoryStore` 需额外维护，`RedisStore` 迁移成本也增加

### 9.3 权限 Guard 为什么不独立？

- 独立 Guard 需要再读 token + 查 loginId → 重复工作
- 权限必然在登录之后，合并到 `XltTokenGuard` 中顺序执行最高效
- 通过 `Reflector.getAllAndOverride` 逐项判断，未标注装饰器的接口零开销

### 9.4 为什么 `StpInterface` 返回支持同步和异步？

- 业务若已在登录时把权限缓存在内存（如 `Map<loginId, string[]>`），同步返回更自然
- `Promise.resolve(value)` 对同步值也能正确处理，两种写法统一在 `StpPermLogic` 内用 `await`

---

## 十、验收清单（P1 完成标志）

- [ ] `StpInterface` 可注入，未注册时有清晰错误提示
- [ ] `@XltCheckPermission('user:add')` + 无权限用户 → 403
- [ ] `@XltCheckPermission(['a', 'b'], { mode: OR })` 任一命中即通过
- [ ] 通配符 `user:*` 能匹配 `user:add`
- [ ] `StpUtil.getSession().set('profile', {...})` 写入后可跨请求读取
- [ ] Session 与 token 同生命周期（logout 后清空）
- [ ] 踢人后可查询 `offlineReason = KICK_OUT`
- [ ] 全部单测 + e2e 通过，P0 测试无回归

---

## 十一、风险与预案

| 风险 | 预案 |
| --- | --- |
| 业务 `getPermissionList` 实现慢（数据库直查） | 文档建议业务方自行缓存；提供 `permCacheTimeout` 选项兜底 |
| 权限码含特殊字符（冒号、星号） | 匹配函数要做正则转义，除 `*` 外全部 literal 匹配 |
| Session 并发写入丢失 | 文档明示"最终一致"语义；需严格原子性时业务应自行使用 Redis 事务 |
| 老用户启用 P1 后默认行为变化 | 所有 P1 开关默认关闭，需显式 opt-in |

---

## 十二、与 Sa-Token 的差异

| 特性 | Sa-Token (Java) | xlt-token P1 |
| --- | --- | --- |
| 权限接口 | `StpInterface` 两方法 | 同名同签 |
| Session | `SaSession` 支持多字段 | `XltSession` 单 JSON |
| 二级认证 | P1 已有 | P3 再做 |
| 临时 token | P1 已有 | P3 再做 |
| 装饰器命名 | `@SaCheckPermission` | `@XltCheckPermission` |
| 逻辑组合 | `SaMode.AND/OR` | `XltMode.AND/OR` |

> 保持 API 语义接近，降低 Java 栈迁移成本；裁剪 Java 生态相关特性（如 Redis 集成细节），让 Node 生态更轻。

---

## 附：目录规划

```
src/
  perm/                          # P1 新增
    stp-interface.ts
    stp-perm-logic.ts
    pattern-match.ts             # 通配符匹配工具
    stp-perm-logic.spec.ts
  session/                       # P1 新增
    xlt-session.ts
    xlt-session.spec.ts
  decorators/
    xlt-check-permission.decorator.ts   # 新增
    xlt-check-role.decorator.ts         # 新增
  exceptions/
    not-permission.exception.ts         # 新增
    not-role.exception.ts               # 新增
  auth/
    stp-logic.ts                 # 扩展 getSession / getOfflineReason
    stp-util.ts                  # 扩展静态门面
  guards/
    xlt-token.guard.ts           # 扩展权限校验分支
  const/
    index.ts                     # 扩展 XltMode 等
  core/
    xlt-token-config.ts          # 扩展 P1 配置字段
```

---

**下一步行动**：确认本规划后，开始 **Step 1（StpInterface 骨架）**。
