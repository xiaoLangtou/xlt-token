# P1 权限与会话 — 实现思路及整体架构

> 基于 [10-roadmap-p1.md](../10-roadmap-p1.md) 规划，结合当前源码状态输出的详细实现设计。
>
> 日期：2026-04-24

---

## 一、当前进度盘点

### 已完成的骨架

| 文件 | 状态 | 说明 |
| --- | --- | --- |
| `src/perm/stp-interface.ts` | ✅ | 接口 + DI Token `XLT_STP_INTERFACE` |
| `src/perm/stp-perm-logic.ts` | ⚠️ 空壳 | `hasPermission` 有初步实现但缺通配符；`checkPermission`/`hasRole`/`checkRole` 直接 `return true` |
| `src/const/index.ts` | ✅ | `XltMode.AND/OR`、`XLT_PERMISSION_KEY`、`XLT_ROLE_KEY` |
| `src/core/xlt-token-config.ts` | ✅ | P1 三个新字段已加入（`permCacheTimeout`、`offlineRecordEnabled`、`offlineRecordTimeout`） |

### 未完成

- `StpPermLogic` 通配符匹配、`checkPermission`/`hasRole`/`checkRole` 实际逻辑
- `NotPermissionException` / `NotRoleException` 异常类
- `@XltCheckPermission` / `@XltCheckRole` 装饰器
- `XltTokenGuard` 权限校验分支
- `XltSession` 会话对象
- `StpLogic.getSession()` / 下线记录
- `XltTokenModule` 的 `stpInterface` 注册支持
- `StpUtil` 权限/会话静态门面扩展
- `src/index.ts` 导出更新

---

## 二、整体架构（P0 + P1 合并视图）

```
┌──────────────────────────────────────────────────────────────┐
│  装饰器层                                                      │
│  @XltIgnore / @XltCheckLogin          ← P0                   │
│  @XltCheckPermission / @XltCheckRole  ← P1 新增              │
│  @LoginId / @TokenValue                                       │
├──────────────────────────────────────────────────────────────┤
│  守卫层                                                        │
│  XltTokenGuard                                                │
│    ├─ 登录校验（P0）                                          │
│    └─ 权限/角色校验（P1 增量，同一 Guard 内顺序执行）         │
│  XltAbstractLoginGuard（业务扩展基类，新增 onPermissionDenied）│
├──────────────────────────────────────────────────────────────┤
│  门面层  StpUtil（静态）                                       │
│  引擎层  StpLogic（DI 实例）                                   │
│  权限层  StpPermLogic（P1 新增）                               │
├──────────────────────────────────────────────────────────────┤
│  会话层  XltSession（P1 新增）                                 │
│    └─ StpLogic.getSession(loginId) → XltSession 实例          │
├──────────────────────────────────────────────────────────────┤
│  业务扩展点                                                    │
│  StpInterface（P1 新增，业务实现 getPermissionList/getRoleList）│
├──────────────────────────────────────────────────────────────┤
│  抽象接口  TokenStrategy  |  XltTokenStore                    │
├──────────────────────────────────────────────────────────────┤
│  实现层    UuidStrategy   |  MemoryStore / RedisStore         │
└──────────────────────────────────────────────────────────────┘
```

### 设计原则

- **权限校验在同一个 Guard 中完成**：不额外注册新 Guard，避免 Reflector 重复读取和二次 token 查询
- **所有 P1 功能默认关闭**：不传 `stpInterface` 时权限装饰器不生效，P0 行为零影响
- **Session 与 token 同生命周期**：logout 时同步清理 session-data key

---

## 三、存储键空间（完整）

### P0 已有

```
<tokenName>:login:token:<token>          → loginId | BE_REPLACED | KICK_OUT
<tokenName>:login:session:<loginId>      → token（反向索引）
<tokenName>:login:lastActive:<token>     → 毫秒时间戳
```

### P1 新增

```
<tokenName>:login:session-data:<loginId> → JSON（XltSession 数据，整对象序列化）
<tokenName>:login:offline:<token>        → JSON { reason, time }（下线记录）
```

### P1 可选（permCacheTimeout > 0 时启用，默认关闭）

```
<tokenName>:login:perm-cache:<loginId>   → JSON string[]（权限缓存）
<tokenName>:login:role-cache:<loginId>   → JSON string[]（角色缓存）
```

> `session-data` 与 `session` 是两个不同含义：前者是"附加业务数据"，后者是"loginId → token 的反向索引"。

---

## 四、请求全链路（含权限）

```
HTTP Request
    │
    ▼
XltTokenGuard.canActivate(ctx)
    │
    ├─ 1. @XltIgnore? → 放行
    │
    ├─ 2. StpLogic.checkLogin(req)                    ← P0
    │     ├─ 取 token → 查 store → 校验状态
    │     ├─ 失败 → throw NotLoginException (401)
    │     └─ 成功 → req.stpLoginId / req.stpToken
    │
    ├─ 3. 读 @XltCheckPermission 元数据（Reflector）  ← P1
    │     └─ 有 → StpPermLogic.checkPermission(loginId, perms, mode)
    │            └─ 不通过 → throw NotPermissionException (403)
    │
    ├─ 4. 读 @XltCheckRole 元数据（Reflector）        ← P1
    │     └─ 有 → StpPermLogic.checkRole(loginId, roles, mode)
    │            └─ 不通过 → throw NotRoleException (403)
    │
    └─ 5. 全部通过 → next
         │
         ▼
    Controller handler
         │ @LoginId() / @TokenValue() 注入
         ▼
    Response
```

---

## 五、各模块实现思路

### 5.1 通配符匹配（核心算法）

新建 `src/perm/pattern-match.ts`，独立纯函数，方便单测。

```ts
/**
 * 通配符匹配：'*' 匹配任意段
 *
 * 规则：按 ':' 分段，遇到 '*' 段即视为后续全部匹配
 *
 * | 用户拥有   | 被检查       | 结果 |
 * | ---------- | ------------ | ---- |
 * | user:add   | user:add     | ✅   |
 * | user:*     | user:add     | ✅   |
 * | user:*     | user:edit    | ✅   |
 * | *          | anything     | ✅   |
 * | user:add   | user:delete  | ❌   |
 * | user:add   | user:add:sub | ❌   |
 */
export function matchPermission(pattern: string, target: string): boolean {
  if (pattern === '*') return true;
  if (pattern === target) return true;

  const patternParts = pattern.split(':');
  const targetParts = target.split(':');

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === '*') return true;
    if (patternParts[i] !== targetParts[i]) return false;
  }

  return patternParts.length === targetParts.length;
}
```

与 Sa-Token 行为一致。`*` 只在段级别生效，不做正则。

### 5.2 StpPermLogic 完整实现

```ts
@Injectable()
export class StpPermLogic {
  constructor(
    @Inject(XLT_STP_INTERFACE) private readonly stpInterface: StpInterface,
    @Inject(XLT_TOKEN_STORE) private readonly tokenStore: XltTokenStore,
    @Inject(XLT_TOKEN_CONFIG) private readonly tokenConfig: XltTokenConfig,
  ) {}

  /** 单权限判断（支持通配符） */
  async hasPermission(loginId: string, permission: string): Promise<boolean> {
    if (!loginId || !permission) return false;
    const list = await this.stpInterface.getPermissionList(loginId);
    if (!list || list.length === 0) return false;
    return list.some(p => matchPermission(p, permission));
  }

  /** 批量权限校验，不通过抛 NotPermissionException */
  async checkPermission(loginId: string, permissions: string[], mode: XltMode): Promise<void> {
    if (mode === XltMode.AND) {
      // AND：全部命中才通过
      for (const p of permissions) {
        if (!(await this.hasPermission(loginId, p))) {
          throw new NotPermissionException(p, mode);
        }
      }
    } else {
      // OR：任一命中即通过
      const results = await Promise.all(
        permissions.map(p => this.hasPermission(loginId, p)),
      );
      if (!results.some(Boolean)) {
        throw new NotPermissionException(permissions, mode);
      }
    }
  }

  /** 单角色判断（精确匹配，角色不需要通配符） */
  async hasRole(loginId: string, role: string): Promise<boolean> {
    if (!loginId || !role) return false;
    const list = await this.stpInterface.getRoleList(loginId);
    if (!list || list.length === 0) return false;
    return list.includes(role);
  }

  /** 批量角色校验，不通过抛 NotRoleException */
  async checkRole(loginId: string, roles: string[], mode: XltMode): Promise<void> {
    if (mode === XltMode.AND) {
      for (const r of roles) {
        if (!(await this.hasRole(loginId, r))) {
          throw new NotRoleException(r, mode);
        }
      }
    } else {
      const results = await Promise.all(
        roles.map(r => this.hasRole(loginId, r)),
      );
      if (!results.some(Boolean)) {
        throw new NotRoleException(roles, mode);
      }
    }
  }
}
```

### 5.3 装饰器

`@XltCheckPermission` 和 `@XltCheckRole` 都是 `SetMetadata` 的封装：

```ts
// src/decorators/xlt-check-permission.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { XLT_PERMISSION_KEY, XltMode } from '../const';

export function XltCheckPermission(
  permissions: string | string[],
  options?: { mode?: XltMode },
) {
  const perms = Array.isArray(permissions) ? permissions : [permissions];
  const mode = options?.mode ?? XltMode.AND;
  return SetMetadata(XLT_PERMISSION_KEY, { permissions: perms, mode });
}
```

```ts
// src/decorators/xlt-check-role.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { XLT_ROLE_KEY, XltMode } from '../const';

export function XltCheckRole(
  roles: string | string[],
  options?: { mode?: XltMode },
) {
  const r = Array.isArray(roles) ? roles : [roles];
  const mode = options?.mode ?? XltMode.AND;
  return SetMetadata(XLT_ROLE_KEY, { roles: r, mode });
}
```

### 5.4 XltTokenGuard 升级

在 `canActivate` 中，登录校验通过后增加权限/角色校验：

```ts
@Injectable()
export class XltTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(XLT_TOKEN_CONFIG) private readonly config: XltTokenConfig,
    private readonly stpLogic: StpLogic,
    @Optional() private readonly stpPermLogic?: StpPermLogic,  // P1，可选注入
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.requiresLogin(context)) return true;

    const request = context.switchToHttp().getRequest();
    const result = await this.stpLogic.checkLogin(request);

    request.stpLoginId = result.loginId;
    request.stpToken = result.token;

    // ─── P1 权限校验（仅当 StpPermLogic 可用时） ───
    if (this.stpPermLogic) {
      const handler = context.getHandler();
      const cls = context.getClass();

      const permMeta = this.reflector.getAllAndOverride(XLT_PERMISSION_KEY, [handler, cls]);
      if (permMeta) {
        await this.stpPermLogic.checkPermission(result.loginId!, permMeta.permissions, permMeta.mode);
      }

      const roleMeta = this.reflector.getAllAndOverride(XLT_ROLE_KEY, [handler, cls]);
      if (roleMeta) {
        await this.stpPermLogic.checkRole(result.loginId!, roleMeta.roles, roleMeta.mode);
      }
    }

    return true;
  }

  // requiresLogin 保持不变...
}
```

关键点：`StpPermLogic` 用 `@Optional()` 注入，未注册 `stpInterface` 时为 `undefined`，权限分支不执行，P0 零影响。

### 5.5 XltSession（会话对象）

单 JSON 对象存一个 key，读-改-写模式：

```ts
// src/session/xlt-session.ts
export class XltSession {
  private data: Record<string, unknown> | null = null;

  constructor(
    private loginId: string,
    private store: XltTokenStore,
    private storeKey: string,
    private timeout: number,
  ) {}

  /** 懒加载：首次访问时从 store 读取 */
  private async load(): Promise<Record<string, unknown>> {
    if (this.data !== null) return this.data;
    const raw = await this.store.get(this.storeKey);
    this.data = raw ? JSON.parse(raw) : {};
    return this.data;
  }

  /** 持久化到 store */
  private async save(): Promise<void> {
    await this.store.set(this.storeKey, JSON.stringify(this.data), this.timeout);
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const d = await this.load();
    return (d[key] as T) ?? null;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.load();
    this.data![key] = value;
    await this.save();
  }

  async delete(key: string): Promise<void> {
    await this.load();
    delete this.data![key];
    await this.save();
  }

  async has(key: string): Promise<boolean> {
    const d = await this.load();
    return key in d;
  }

  async keys(): Promise<string[]> {
    return Object.keys(await this.load());
  }

  async clear(): Promise<void> {
    await this.store.delete(this.storeKey);
    this.data = {};
  }
}
```

**实现策略**：整对象序列化为 JSON 存一个 key，每次 `set` 读-改-写。简单可靠，不追求原子性（同一用户同时写入极少）。

**StpLogic 扩展**：

```ts
// src/auth/stp-logic.ts 新增方法
getSession(loginId: string): XltSession {
  const key = `${this.config.tokenName}:login:session-data:${loginId}`;
  return new XltSession(loginId, this.store, key, this.config.timeout);
}

// sessionDataKey 工具方法
private sessionDataKey(loginId: string): string {
  return `${this.config.tokenName}:login:session-data:${loginId}`;
}
```

**生命周期**：`logout` / `logoutByLoginId` / `kickout` 时同步删除 `session-data` key。

### 5.6 下线记录

在 `kickout` 和 `replaced` 方法中，当 `offlineRecordEnabled === true` 时写入：

```ts
// StpLogic 内部
private async writeOfflineRecord(token: string, reason: string): Promise<void> {
  if (!this.config.offlineRecordEnabled) return;
  const key = `${this.config.tokenName}:login:offline:${token}`;
  const record = JSON.stringify({ reason, time: Date.now() });
  await this.store.set(key, record, this.config.offlineRecordTimeout ?? 3600);
}

// kickout 中调用
await this.writeOfflineRecord(token, 'KICK_OUT');

// replaced 中调用
await this.writeOfflineRecord(oldToken, 'BE_REPLACED');
```

新增查询方法：

```ts
async getOfflineReason(token: string): Promise<{ reason: string; time: number } | null> {
  const key = `${this.config.tokenName}:login:offline:${token}`;
  const raw = await this.store.get(key);
  return raw ? JSON.parse(raw) : null;
}
```

### 5.7 Module 注册改造

`XltTokenModuleOptions` 新增 `stpInterface` 字段：

```ts
export interface XltTokenModuleOptions {
  config?: Partial<XltTokenConfig>;
  store?: { useClass } | { useValue };
  strategy?: { useClass };
  stpInterface?: new (...args: any[]) => StpInterface;  // P1 新增
  isGlobal?: boolean;
  providers?: Provider[];
}
```

注册逻辑：

```ts
// forRoot 内部
const stpInterfaceProvider: Provider = options.stpInterface
  ? { provide: XLT_STP_INTERFACE, useClass: options.stpInterface }
  : {
      provide: XLT_STP_INTERFACE,
      useValue: {
        getPermissionList: () => { throw new Error('StpInterface not registered'); },
        getRoleList: () => { throw new Error('StpInterface not registered'); },
      },
    };

// StpPermLogic 始终注册
providers: [
  ...,
  stpInterfaceProvider,
  StpPermLogic,
],
exports: [
  ...,
  StpPermLogic,
],
```

- 提供了 `stpInterface` → 正常注入业务实现
- 未提供 → noop 占位，调用时抛明确错误
- `StpPermLogic` 始终注册，但只在 Guard 读到权限元数据时才被调用

### 5.8 异常类

```ts
// src/exceptions/not-permission.exception.ts
import { ForbiddenException } from '@nestjs/common';
import { XltMode } from '../const';

export class NotPermissionException extends ForbiddenException {
  public readonly permission: string | string[];
  public readonly mode: XltMode;

  constructor(permission: string | string[], mode: XltMode) {
    super({
      statusCode: 403,
      type: 'NOT_PERMISSION',
      message: `缺少权限: ${Array.isArray(permission) ? permission.join(', ') : permission}`,
    });
    this.permission = permission;
    this.mode = mode;
  }
}
```

```ts
// src/exceptions/not-role.exception.ts
import { ForbiddenException } from '@nestjs/common';
import { XltMode } from '../const';

export class NotRoleException extends ForbiddenException {
  public readonly role: string | string[];
  public readonly mode: XltMode;

  constructor(role: string | string[], mode: XltMode) {
    super({
      statusCode: 403,
      type: 'NOT_ROLE',
      message: `缺少角色: ${Array.isArray(role) ? role.join(', ') : role}`,
    });
    this.role = role;
    this.mode = mode;
  }
}
```

### 5.9 StpUtil 门面扩展

```ts
// src/auth/stp-util.ts 新增静态方法
export class StpUtil {
  // ... P0 方法 ...

  /** 判断是否拥有某权限 */
  static async hasPermission(loginId: string, permission: string): Promise<boolean> {
    return getStpPermLogic().hasPermission(loginId, permission);
  }

  /** 校验权限（不通过抛异常） */
  static async checkPermission(loginId: string, permissions: string[], mode: XltMode): Promise<void> {
    return getStpPermLogic().checkPermission(loginId, permissions, mode);
  }

  /** 判断是否拥有某角色 */
  static async hasRole(loginId: string, role: string): Promise<boolean> {
    return getStpPermLogic().hasRole(loginId, role);
  }

  /** 校验角色（不通过抛异常） */
  static async checkRole(loginId: string, roles: string[], mode: XltMode): Promise<void> {
    return getStpPermLogic().checkRole(loginId, roles, mode);
  }

  /** 获取会话对象 */
  static getSession(loginId: string): XltSession {
    return getStpLogic().getSession(loginId);
  }

  /** 查询下线原因 */
  static async getOfflineReason(token: string): Promise<{ reason: string; time: number } | null> {
    return getStpLogic().getOfflineReason(token);
  }
}
```

### 5.10 导出更新

`src/index.ts` 新增导出：

```ts
// P1 权限
export { StpInterface, XLT_STP_INTERFACE } from './perm/stp-interface';
export { StpPermLogic } from './perm/stp-perm-logic';
export { matchPermission } from './perm/pattern-match';
export { XltCheckPermission } from './decorators/xlt-check-permission.decorator';
export { XltCheckRole } from './decorators/xlt-check-role.decorator';
export { NotPermissionException } from './exceptions/not-permission.exception';
export { NotRoleException } from './exceptions/not-role.exception';
export { XltMode } from './const';

// P1 会话
export { XltSession } from './session/xlt-session';
```

---

## 六、实施顺序

| Step | 内容 | 改动文件 | 验收标准 |
| --- | --- | --- | --- |
| **1** | Module 支持 `stpInterface` 注册 + noop 占位 | `xlt-token.module.ts`、`index.ts` | 不传 stpInterface 时 P0 全部测试通过 |
| **2** | `pattern-match.ts` + `StpPermLogic` 完整实现 + 异常类 | `src/perm/`、`src/exceptions/` | 通配符单测、AND/OR 组合单测全过 |
| **3** | 装饰器 + Guard 权限分支 | `src/decorators/`、`src/guards/xlt-token.guard.ts` | 有权限 → 200，无权限 → 403 |
| **4** | `XltSession` + `StpLogic.getSession` + logout 清理 | `src/session/`、`src/auth/stp-logic.ts` | get/set/delete/keys/clear 单测全过 |
| **5** | 下线记录（writeOfflineRecord + getOfflineReason） | `src/auth/stp-logic.ts` | kickout 后查到 KICK_OUT + 时间戳 |
| **6** | `StpUtil` 门面扩展 + `index.ts` 导出 + 文档 | 多文件 | 全量测试无回归 |

---

## 七、兼容性保证

| 场景 | 行为 |
| --- | --- |
| 只用 P0，不传 `stpInterface` | 完全兼容，无任何差异 |
| 用了 `@XltCheckPermission` 但没注册 `stpInterface` | Guard 中 `StpPermLogic` 调用 noop → 抛明确错误 |
| 老配置对象字段缺失 P1 新字段 | 走默认值（`permCacheTimeout=0`、`offlineRecordEnabled=false`） |
| `XltAbstractLoginGuard` 子类 | 新增可选钩子 `onPermissionDenied`，不 override 则透传异常 |

---

## 八、目录结构（P1 完成后）

```
src/
├── index.ts                              # 统一导出（P1 新增导出项）
├── xlt-token.module.ts                   # 新增 stpInterface 注册
├── core/
│   └── xlt-token-config.ts              # P1 配置字段已加入
├── auth/
│   ├── stp-logic.ts                     # 扩展 getSession / getOfflineReason / writeOfflineRecord
│   ├── stp-util.ts                      # 扩展权限/会话静态门面
│   └── stp-logic.spec.ts
├── perm/                                 # P1 新增
│   ├── stp-interface.ts                 # ✅ 已有
│   ├── stp-perm-logic.ts               # 完善实现
│   ├── pattern-match.ts                 # 新建：通配符匹配
│   └── stp-perm-logic.spec.ts           # 新建：单测
├── session/                              # P1 新增
│   ├── xlt-session.ts                   # 新建：会话对象
│   └── xlt-session.spec.ts             # 新建：单测
├── store/
│   ├── xlt-token-store.interface.ts     # 不变
│   ├── memory-store.ts                  # 不变
│   └── redis-store.ts                   # 不变
├── token/
│   ├── token-strategy.interface.ts      # 不变
│   └── uuid-strategy.ts                # 不变
├── guards/
│   ├── xlt-token.guard.ts              # 扩展权限校验分支
│   └── xlt-abstract-login.guard.ts     # 新增 onPermissionDenied 钩子
├── decorators/
│   ├── xlt-ignore.decorator.ts          # 不变
│   ├── xlt-check-login.decorator.ts     # 不变
│   ├── login-id.decorator.ts            # 不变
│   ├── token-value.decorator.ts         # 不变
│   ├── xlt-check-permission.decorator.ts # 新建
│   └── xlt-check-role.decorator.ts      # 新建
├── exceptions/
│   ├── not-login.exception.ts           # 不变
│   ├── not-permission.exception.ts      # 新建
│   └── not-role.exception.ts            # 新建
└── const/
    └── index.ts                         # ✅ XltMode 等已加入
```

---

## 九、关键决策总结

| 决策 | 理由 |
| --- | --- |
| 权限校验合并到 XltTokenGuard，不独立 Guard | 避免重复 token 查询和 Reflector 读取 |
| StpPermLogic 用 @Optional() 注入 | P0 用户不受影响 |
| Session 用单 JSON 对象而非多 key | 简单，数据量小（< 1KB），读一次拿全量 |
| 角色不支持通配符，权限支持 | 角色是身份标识用精确匹配，权限是操作码用层级通配 |
| 下线记录默认关闭 | 避免额外 store 写入开销，需要时 opt-in |
| StpInterface 返回支持同步和异步 | 业务灵活性，StpPermLogic 内统一 await |
