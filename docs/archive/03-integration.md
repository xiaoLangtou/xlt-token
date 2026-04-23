# 03 - 接入方案

## 一、现状分析

| 组件 | 现有方案 | xlt-token 替代 |
|---|---|---|
| **登录凭证** | JWT (`JwtService.sign`) → accessToken + refreshToken | `StpLogic.login(userId)` → 返回 opaque token |
| **登录校验守卫** | `LoginGuard` — 解析 JWT + 查 Redis 缓存 | `XltTokenGuard` — 调 `StpLogic.checkLogin(req)` |
| **获取当前用户** | `@UserInfo('userId')` — 从 `req.user`（JWT payload）取 | `@LoginId()` — 从 `req.stpLoginId`（Store 查出的 loginId）取 |
| **跳过校验** | `@RequireLogin()` 装饰器（opt-in） | `@XltIgnore()` 装饰器（opt-out，`defaultCheck=true` 时默认拦截） |
| **Token 存储** | JWT 无状态 + Redis 存用户信息缓存 | `XltTokenStore`（MemoryStore → 后续切 RedisStore） |
| **退出** | 删 Redis 用户缓存 | `StpLogic.logout(token)` / `logoutByLoginId(loginId)` |
| **权限** | `PermissionGuard` + Casbin | **不变**，xlt-token 不接管权限层 |

---

## 二、准备工作（共 6 项）

### 2.1 实现 `NotLoginException`

- **位置**：`exceptions/not-login.exception.ts`
- **职责**：继承 `UnauthorizedException`，携带 `NotLoginType` 类型字段
- **目的**：替代 `checkLogin` 中直接 throw 的 `UnauthorizedException`，让异常过滤器能区分具体原因（被顶号 / 被踢出 / token 过期等），返回不同的前端提示

### 2.2 实现 `XltTokenGuard`

- **位置**：`guards/xlt-token.guard.ts`
- **职责**：
  - 实现 `CanActivate`
  - 用 `Reflector` 读取 `@XltIgnore()` 元数据，命中则放行
  - `defaultCheck=true` 时默认拦截所有路由；`defaultCheck=false` 时需配合其他装饰器
  - 调用 `StpLogic.checkLogin(req)` 拿到 `loginId` 和 `token`
  - 将结果挂到 `req.stpLoginId` 和 `req.stpToken` 上，供后续装饰器/管道使用
- **与现有 `LoginGuard` 的关系**：并行共存，先接入新守卫做验证，确认稳定后再替换旧守卫

### 2.3 实现三个装饰器

| 装饰器 | 位置 | 职责 |
|---|---|---|
| `@XltIgnore()` | `decorators/xlt-ignore.decorator.ts` | `SetMetadata('xlt-ignore', true)`，标记路由跳过 `XltTokenGuard` |
| `@LoginId()` | `decorators/login-id.decorator.ts` | `createParamDecorator`，从 `req.stpLoginId` 取当前登录用户 ID |
| `@TokenValue()` | `decorators/token-value.decorator.ts` | `createParamDecorator`，从 `req.stpToken` 取当前 token 值 |

### 2.4 改造 `AuthService.login` 接入 `StpLogic`

- **改动点**：
  - 注入 `StpLogic`
  - 验证用户名密码通过后，调 `stpLogic.login(userId)` 得到 token
  **- 不再调 `jwtService.sign` 生成 accessToken/refreshToken（或暂**时保留 refreshToken 逻辑，后续用 `renewTimeout` 替代）
  - 返回 `{ token }` 代替 `{ accessToken, refreshToken }`
- **`AuthService.logout`**：调 `stpLogic.logoutByLoginId(userId)` 替代删 Redis 缓存
- **用户信息**：`checkLogin` 只返回 `loginId`，用户详细信息（roles、permissions）仍需从数据库/Redis 查。可在 Guard 中查一次挂到 `req.user` 上，保持 `PermissionGuard` 和 `@UserInfo()` 不变

### 2.5 注册 `XltTokenModule` 到 `AppModule`

- **改动**：`app.module.ts` 的 `imports` 中加入 `XltTokenModule`
- **注册守卫**：在 `providers` 中加一个新的 `APP_GUARD → XltTokenGuard`
- **灰度策略**：
  - **Phase 1**：`XltTokenGuard` 的 `defaultCheck` 设为 `false`，只在少量测试路由上手动用装饰器启用
  - **Phase 2**：确认稳定后，`defaultCheck` 改为 `true`，用 `@XltIgnore()` 标记公开路由（login、captcha、register 等）
  - **Phase 3**：移除旧 `LoginGuard` + JWT 相关逻辑

### 2.6 扩展 Express Request 类型声明

- 在 `login.guard.ts` 或单独的 `typings/express.d.ts` 中扩展：

```ts
declare module 'express' {
  interface Request {
    stpLoginId?: string;
    stpToken?: string;
  }
}
```

---

## 三、接入顺序

```
Step 1  实现 NotLoginException、XltIgnore、LoginId、TokenValue（纯工具，无副作用）
   ↓
Step 2  实现 XltTokenGuard（依赖 Step 1 + StpLogic）
   ↓
Step 3  XltTokenModule 注入 AppModule，defaultCheck=false 灰度
   ↓
Step 4  写一个测试 Controller（如 /test/xlt-login、/test/xlt-check）验证完整链路
   ↓
Step 5  改造 AuthService.login / logout 接入 StpLogic
   ↓
Step 6  前端适配新 token 格式（header 从 Bearer JWT → st: uuid）
   ↓
Step 7  defaultCheck=true，公开路由加 @XltIgnore()，移除旧 LoginGuard
```

---

## 四、暂不需要改的

- **`PermissionGuard`**：权限校验和 token 认证是解耦的，只要 `req.user` 上有 roles/permissions 就能继续工作
- **`MemoryStore`**：开发阶段用内存够了，生产切 Redis 是后续独立任务
- **refreshToken**：xlt-token 用 `renewTimeout` 替代，但可以在 Phase 3 再处理
