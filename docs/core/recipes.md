---
title: Token 鉴权实战场景手册
description: 通过 xlt-token 示例实现顶号、多端登录、活跃超时、滑动续期、踢人、权限校验和匿名接口等常见鉴权场景。
---

# 09 · 场景手册（Recipes）

常见业务场景的实操代码片段。每个 recipe 都可以直接拷贝改造。

## 目录

- [1. 单设备强制登录（顶号）](#1-单设备强制登录顶号)
- [2. 多端共享一份登录态](#2-多端共享一份登录态)
- [3. 多端独立登录](#3-多端独立登录)
- [4. 活跃超时（长时间未操作自动退出）](#4-活跃超时长时间未操作自动退出)
- [5. 滑动续期（refresh-token 风格）](#5-滑动续期refresh-token-风格)
- [6. 管理员踢人下线](#6-管理员踢人下线)
- [7. 登录时附加业务信息到 request.user](#7-登录时附加业务信息到-requestuser)
- [8. 同时支持登录/匿名访问的接口](#8-同时支持登录匿名访问的接口)
- [9. 查询当前在线人数 / 在线列表](#9-查询当前在线人数--在线列表)
- [10. 运维调试：观察存储键](#10-运维调试观察存储键)
- [11. 一次性临时 token（用完即焚）](#11-一次性临时-token用完即焚)

---

## 1. 单设备强制登录（顶号）

**配置**：

```ts twoslash
XltTokenModule.forRoot({
  config: { isConcurrent: false },
});
```

**效果**：同账号二次登录时，旧 token 的值被改为 `BE_REPLACED`，旧设备下次请求收到 401 `BE_REPLACED`。

**前端处理**：见 [异常处理 · 前端统一处理](/core/exceptions#前端统一处理示例)。

---

## 2. 多端共享一份登录态

**场景**：移动端 App 和 PC 浏览器使用同一份 token。

```ts twoslash
XltTokenModule.forRoot({
  config: { isConcurrent: true, isShare: true },
});
```

**效果**：第二次 `login` 返回和第一次**相同**的 token。任何一端 logout 会导致所有端失效。

---

## 3. 多端独立登录

**场景**：不同端各有独立 token，互不影响。

```ts twoslash
XltTokenModule.forRoot({
  config: { isConcurrent: true, isShare: false },
});
```

**⚠️ 注意**：1.1.0 起 `sessionKey` 已支持 `device` 后缀，多端场景请用 `forceLogout` 全端登出，详见 [多端登录](/core/multi-device)。

---

## 4. 活跃超时（长时间未操作自动退出）

**场景**：用户 2 小时无操作自动踢出；但 token 本身 24 小时绝对过期。

```ts twoslash
XltTokenModule.forRoot({
  config: {
    timeout: 24 * 60 * 60,        // 绝对过期 24h
    activeTimeout: 2 * 60 * 60,   // 2h 无操作就冻结
  },
});
```

**效果**：
- 每次请求都会刷新 `lastActive`
- 超过 2h 无请求 → 下次访问收到 `TOKEN_TIMEOUT`
- 超过 24h 无论活跃 → `INVALID_TOKEN`（TTL 到期）

---

## 5. Token 生命周期与刷新

仅需延长当前 token 的 Store TTL 时，在 refresh 接口里调用 `renewTimeout`。这不会签发新 token，JWT 的内嵌 `exp` 也不会改变：

```ts twoslash
@XltIgnore()
@Get('refresh-token')
async refresh(@Query('refreshToken') token: string) {
  const ok = await StpUtil.renewTimeout(token, 7 * 24 * 60 * 60);
  if (!ok) throw new UnauthorizedException('token 无效，请重新登录');
  return { accessToken: token, refreshToken: token };
}
```

**注意**：
需要短期 access token、刷新轮转和重放检测时，启用 `config.lifecycle`，然后调用
`refreshToken`。刷新成功后必须原子地替换客户端保存的 token；旧 token 再次刷新会按
`replayDetection` 策略返回 `TOKEN_REPLAYED`，family 模式会吊销整条 token family。

```ts
const xlt = createXltToken({
  config: {
    lifecycle: {
      expiration: { mode: 'sliding', ttl: '15m', renewWhenRemainingBelow: '3m' },
      refresh: { enabled: true, ttl: '30d', rotate: true, replayDetection: 'family' },
    },
  },
});

const result = await xlt.stpLogic.refreshToken(token);
if (result.ok) {
  return { accessToken: result.accessToken, refreshToken: result.refreshToken };
}
```

`refreshToken` 依赖 Store 的原子 `compareAndSet`。多实例部署必须使用 Redis 或其他满足
Store 原子契约的共享实现；不要把 access 与 refresh token 拆到未经协调的业务存储中。

---

## 6. 管理员踢人下线

```ts twoslash
@Post('admin/kickout/:userId')
@RequireLogin()
async kickout(@Param('userId') userId: string) {
  const ok = await StpUtil.kickout(userId);
  return { ok };
}
```

被踢用户下次请求 → `NotLoginException(KICK_OUT)`。

### `kickout` vs `logoutByLoginId`

- `logoutByLoginId` → 用户下次收到 `INVALID_TOKEN`（看起来像"token 失效"）
- `kickout` → 收到 `KICK_OUT`（明确"被踢"），前端可展示差异化提示

---

## 7. 登录时附加业务信息到 `request.user`

**场景**：Controller 通过 `@UserInfo('userId')` 拿到用户 id、角色、权限。

**方案**：继承 `XltAbstractLoginGuard`，在 `onAuthSuccess` 里从 Redis 加载用户并挂到 `request.user`。

完整示例见 [守卫与装饰器 · 完整示例](/adapters/nestjs/guards-and-decorators#完整示例白名单--redis-加载用户)。

关键思路：

```ts twoslash
protected async onAuthSuccess(result, request) {
  const user = await this.redis.get(`user_info:${result.loginId}`);
  if (!user) throw new UnauthorizedException('用户会话已失效');
  request.user = { userId: user.id, roles: user.roles, permissions: user.permissions };
}
```

在登录服务里同步写入该缓存：

```ts twoslash
// login 成功后
const token = await this.stpLogic.login(user.id);
await this.redis.set(`user_info:${user.id}`, JSON.stringify({
  id: user.id, roles: [...], permissions: [...]
}), config.timeout);
```

---

## 8. 同时支持登录/匿名访问的接口

**场景**：商品详情页，登录用户显示"我的评分"，匿名用户只显示公开内容。

```ts twoslash
@XltIgnore()
@Get('product/:id')
async detail(@Param('id') id: string, @Req() req: Request) {
  const loginId = await StpUtil.getLoginId(req); // 未登录返回 null
  const product = await this.service.getProduct(id);
  if (loginId) {
    product.myRating = await this.service.getUserRating(loginId, id);
  }
  return product;
}
```

`@XltIgnore()` 让该接口不走守卫校验，用 `StpUtil.getLoginId(req)` 软检测身份，**拿不到 token 不抛异常**。

---

## 9. 查询当前在线人数 / 在线列表

1.1.0 起内置观测性 API（`@xlt-token/core`，NestJS 通过 `StpLogic` / `StpUtil` 使用）：

```ts twoslash
import { StpUtil } from '@xlt-token/nestjs';

// 在线用户数（有 session-list 的 loginId 数量）
const count = await StpUtil.getOnlineCount();

// 分页 loginId 列表，默认 page=0, pageSize=100
const loginIds = await StpUtil.getOnlineLoginIds({ page: 0, pageSize: 50 });

// 某用户各端设备详情
const devices = await StpUtil.getDeviceList('1001');
```

管理后台完整示例见 [审计事件与观测性](/core/hooks-and-observability#管理后台示例)。

> 实现依赖 Store 的 `scan(pattern)` 扫描 `session-list:*` 前缀；在线量极大时请降低扫描频率或自建索引。

---

## 10. 运维调试：观察存储键

### Redis

```bash
# 列所有键
redis-cli --scan --pattern 'authorization:login:*'

# 查某个 token 对应的 loginId
redis-cli GET authorization:login:token:550e8400-...

# 查某个 loginId 的当前 token
redis-cli GET authorization:login:session:1001

# 查 TTL（单位秒）
redis-cli TTL authorization:login:token:550e8400-...

# 手动踢人（与调 kickout 等价）
redis-cli SET authorization:login:token:550e8400-... KICK_OUT KEEPTTL
redis-cli DEL authorization:login:session:1001
```

### 日志建议

在 `XltAbstractLoginGuard` 子类的 `onAuthFail` 里打结构化日志：

```ts twoslash
protected async onAuthFail(result, request) {
  this.logger.warn('auth.denied', {
    reason: result.reason,
    token: result.token,
    ip: request.ip,
    path: request.path,
    traceId: request.traceId,
  });
}
```

方便排查"为什么 401"。

---

## 11. 一次性临时 token（用完即焚）

邮件重置密码、邀请注册、一次性下载链接：**首次消费返回业务值并立即销毁**，重复或并发访问拿不到数据。v2.2 起用 `consumeTempToken`（原子消费）：

```ts twoslash
import { StpUtil } from '@xlt-token/nestjs';

// 发邮件时创建，30 分钟有效
const tempToken = await StpUtil.createTempToken(`resetPwd:${userId}`, 1800);

// 用户点击链接 —— 并发双击也只有一个请求能拿到值
const value = await StpUtil.consumeTempToken(tempToken);
if (!value) throw new Error('链接无效、已过期或已被使用');

const [, userId] = value.split(':');
await userService.resetPassword(userId, newPassword);
```

为什么不用 `parseTempToken` + `deleteTempToken`？两次调用之间存在竞态窗口，双击链接时两个请求都可能读到值。`consumeTempToken` 在 Store 层原子完成（MemoryStore 临界段 / Redis Lua），并发下恰好一个调用返回业务值，其余返回 `null`。

详见 [二级认证与临时 Token](/core/secondary-auth#临时-token)。

---

## 还缺什么？

如果你的业务场景这里没覆盖，欢迎提 Issue。常见还没写的：

- ☐ 二维码扫码登录
- ☐ 验证码登录 + 信任设备
- ☐ SSO / OAuth2 接入
