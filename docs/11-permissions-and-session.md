# 11 · 权限与会话

`StpInterface` + `StpPermLogic` 提供声明式权限/角色校验；`XltSession` 提供与 token 同生命周期的会话存储。

## 一、权限/角色校验

### 1.1 整体流程

```
HTTP 请求
  ↓
XltTokenGuard
  ├─ 登录校验（checkLogin）
  ├─ 读取 @XltCheckPermission 元数据 → StpPermLogic.checkPermission
  └─ 读取 @XltCheckRole 元数据      → StpPermLogic.checkRole
        ↓
        StpInterface（业务实现）
          ├─ getPermissionList(loginId) → string[]
          └─ getRoleList(loginId)       → string[]
```

### 1.2 实现 `StpInterface`

业务侧实现一个类，从数据库 / 缓存读取用户的权限和角色：

```ts
// stp.service.ts
import { Injectable } from '@nestjs/common';
import { StpInterface } from 'xlt-token';
import { UserService } from '@/module/user/user.service';

@Injectable()
export class StpService implements StpInterface {
  constructor(private readonly userService: UserService) {}

  async getPermissionList(loginId: string): Promise<string[]> {
    const user = await this.userService.findById(loginId);
    return user?.permissions ?? [];
  }

  async getRoleList(loginId: string): Promise<string[]> {
    const user = await this.userService.findById(loginId);
    return user?.roles ?? [];
  }
}
```

### 1.3 注册到 Module

```ts
@Module({
  imports: [
    XltTokenModule.forRoot({
      isGlobal: true,
      stpInterface: StpService,
    }),
  ],
})
export class AppModule {}
```

> 如果 `StpService` 依赖其他 Service，需要确保依赖项也在同一 Module 上下文中可解析（Nest 标准 DI 行为）。

### 1.4 `@XltCheckPermission`

```ts
@XltCheckPermission(permissions: string | string[], options?: { mode: XltMode })
```

| 参数 | 说明 |
| --- | --- |
| `permissions` | 单一权限字符串或数组 |
| `options.mode` | `XltMode.AND`（默认）/ `XltMode.OR` |

```ts
// 单一权限
@XltCheckPermission('user:read')
@Get('users')
list() {}

// 必须同时拥有（AND）
@XltCheckPermission(['user:read', 'user:write'], { mode: XltMode.AND })
@Post('users')
create() {}

// 拥有任一即可（OR）
@XltCheckPermission(['user:export', 'user:print'], { mode: XltMode.OR })
@Get('users/export')
export() {}
```

### 1.5 `@XltCheckRole`

API 与 `@XltCheckPermission` 完全一致，只是底层校验角色而非权限：

```ts
@XltCheckRole('admin')
@Delete(':id')
remove() {}

@XltCheckRole(['admin', 'super'], { mode: XltMode.OR })
@Patch(':id')
sensitive() {}
```

### 1.6 通配符匹配

`StpPermLogic` 内置 `matchPermission` 函数，支持冒号分隔的层级通配：

| 用户拥有 | 装饰器声明 | 匹配 |
| --- | --- | --- |
| `user:*` | `user:read` | ✅ |
| `*` | `任意` | ✅（全权限） |
| `user:read` | `user:read` | ✅ |
| `user:*:export` | `user:order:export` | ✅ |
| `user:read` | `user:write` | ❌ |

```ts
@XltCheckPermission('order:create')   // 用户拥有 'order:*' 即可放行
@Post('order')
create() {}
```

### 1.7 异常映射

| 失败场景 | 抛出 | HTTP 状态 |
| --- | --- | --- |
| `@XltCheckPermission` 校验失败 | `NotPermissionException` | **403** |
| `@XltCheckRole` 校验失败 | `NotRoleException` | **403** |

异常对象暴露公开字段，便于过滤器使用：

```ts
class NotPermissionException extends ForbiddenException {
  permission: string | string[];
  mode: XltMode;
}
```

### 1.8 在 Service 内手动校验

不使用装饰器时也可以直接调用：

```ts
import { StpUtil, XltMode } from 'xlt-token';

// 是否拥有
const ok = await StpUtil.hasPermission('1001', 'user:read');

// 校验（失败抛 NotPermissionException）
await StpUtil.checkPermission('1001', ['user:read', 'user:write'], XltMode.AND);

// 角色同理
const isAdmin = await StpUtil.hasRole('1001', 'admin');
await StpUtil.checkRole('1001', ['admin'], XltMode.OR);
```

也可注入 `StpPermLogic` 走 DI：

```ts
constructor(private readonly permLogic: StpPermLogic) {}

async someMethod() {
  await this.permLogic.checkPermission('1001', 'user:read');
}
```

---

## 二、会话（XltSession）

### 2.1 概念

每个登录账号关联一个 `XltSession`，存储登录期间的扩展数据：

- 用户昵称、头像、最近活跃 IP
- 业务自定义字段（如最近浏览的商品 ID 数组）
- 任何与"一次登录"相关的临时数据

会话与 token 同生命周期：登出 / 被踢 / 被顶后会被清理。

### 2.2 获取 Session

```ts
import { StpUtil } from 'xlt-token';

const session = StpUtil.getSession(loginId);  // 同步返回 XltSession 实例
```

也可注入 `StpLogic`：

```ts
constructor(private readonly stp: StpLogic) {}

doSomething() {
  const session = this.stp.getSession(loginId);
}
```

### 2.3 完整 API

| 方法 | 签名 | 返回 | 说明 |
| --- | --- | --- | --- |
| `set(key, value)` | `(string, any) => Promise<void>` | - | 写入字段，自动序列化 |
| `get(key)` | `<T>(string) => Promise<T \| null>` | 字段值 | 读取，未存在返回 `null` |
| `has(key)` | `(string) => Promise<boolean>` | 是否存在 | |
| `remove(key)` | `(string) => Promise<void>` | - | 删除单个字段 |
| `keys()` | `() => Promise<string[]>` | 所有 key | |
| `clear()` | `() => Promise<void>` | - | 清空整个 session |

### 2.4 使用范例

```ts
const session = StpUtil.getSession(loginId);

// 写入
await session.set('nickname', 'xlt');
await session.set('lastLoginIp', request.ip);
await session.set('cart', [{ id: 1, qty: 2 }]);

// 读取
const nickname = await session.get<string>('nickname');
const cart = await session.get<CartItem[]>('cart');

// 检查
if (await session.has('cart')) {
  // ...
}

// 删除单字段
await session.remove('cart');

// 列出
const allKeys = await session.keys();   // ['nickname', 'lastLoginIp']

// 清空
await session.clear();
```

### 2.5 在 Guard 中预填充

结合 `XltAbstractLoginGuard` 的 `onAuthSuccess` 钩子，校验通过时把 session 数据加载到 `request.user`：

```ts
@Injectable()
export class LoginGuard extends XltAbstractLoginGuard {
  protected async onAuthSuccess(result, request) {
    const session = this.stpLogic.getSession(result.loginId);
    request.user = {
      id: result.loginId,
      nickname: await session.get('nickname'),
      lastIp: await session.get('lastLoginIp'),
    };
  }
}
```

---

## 三、下线原因追溯

被踢 / 被顶后旧 token 失效。库会自动写入下线记录，可查询：

```ts
const record = await StpUtil.getOfflineReason(token);
// { reason: 'KICK_OUT', time: 1714112400000 }
// 或 { reason: 'BE_REPLACED', time: 1714112400000 }
// 或 null（未找到记录）
```

应用场景：

- 前端拿到 401 + `KICK_OUT` 类型时，可以再调用此接口拿到**精确踢人时间**展示给用户
- 审计日志：每次 401 响应同步记录下线时间，方便排查

---

## 四、配置项

`XltTokenConfig` 中权限/会话相关字段：

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `permCacheTimeout` | `-1` | 权限/角色列表缓存秒数（`-1` = 不缓存，每次请求都调 `StpInterface`） |
| `offlineRecordEnabled` | `true` | 是否记录下线原因 |
| `offlineRecordTimeout` | `2592000`（30 天） | 下线记录保留时长（秒） |

```ts
XltTokenModule.forRoot({
  config: {
    permCacheTimeout: 60,         // 缓存权限 60 秒
    offlineRecordEnabled: true,
    offlineRecordTimeout: 86400,  // 下线记录保留 1 天
  },
  stpInterface: StpService,
})
```

---

## 五、最佳实践

- **权限粒度**：建议使用层级冒号格式（`user:read` / `user:write` / `order:export`），方便通配符匹配
- **缓存权重**：`permCacheTimeout` 设 30~120 秒，平衡 RBAC 数据库压力与"权限变更生效时机"
- **角色 vs 权限**：角色用于宽泛分类（admin/user/guest），权限用于精细动作（user:read），不要混用
- **避免在 Guard 里再查权限**：直接用 `@XltCheckPermission`，让校验声明在 Controller 上更直观
- **Session 别存大对象**：每次请求会序列化读写，建议只存索引/ID，详情按需查 DB

---

## 六、下一步

- 异常处理与全局过滤器 → [08 · 异常](./08-exceptions.md)
- 守卫钩子细节 → [05 · 守卫与装饰器](./05-guards-and-decorators.md)
- 完整源码参考 → [SRC-REFERENCE](./SRC-REFERENCE.md)
