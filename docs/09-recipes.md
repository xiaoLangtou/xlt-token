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

---

## 1. 单设备强制登录（顶号）

**配置**：

```ts
XltTokenModule.forRoot({
  config: { isConcurrent: false },
});
```

**效果**：同账号二次登录时，旧 token 的值被改为 `BE_REPLACED`，旧设备下次请求收到 401 `BE_REPLACED`。

**前端处理**：见 [08-exceptions · 前端统一处理](./08-exceptions.md#前端统一处理示例)。

---

## 2. 多端共享一份登录态

**场景**：移动端 App 和 PC 浏览器使用同一份 token。

```ts
XltTokenModule.forRoot({
  config: { isConcurrent: true, isShare: true },
});
```

**效果**：第二次 `login` 返回和第一次**相同**的 token。任何一端 logout 会导致所有端失效。

---

## 3. 多端独立登录

**场景**：不同端各有独立 token，互不影响。

```ts
XltTokenModule.forRoot({
  config: { isConcurrent: true, isShare: false },
});
```

**⚠️ 注意**：当前实现中 `sessionKey` 只保存**最后一个 token**，所以 `logoutByLoginId` 只能登出最新那一个。如果业务需要"一键登出所有设备"，需要自行扩展（例如存 `sessionKey → Set<token>`）。

---

## 4. 活跃超时（长时间未操作自动退出）

**场景**：用户 2 小时无操作自动踢出；但 token 本身 24 小时绝对过期。

```ts
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

## 5. 滑动续期（refresh-token 风格）

在你的 refresh 接口里调 `renewTimeout`：

```ts
@XltIgnore()
@Get('refresh-token')
async refresh(@Query('refreshToken') token: string) {
  const ok = await StpUtil.renewTimeout(token, 7 * 24 * 60 * 60);
  if (!ok) throw new UnauthorizedException('token 无效，请重新登录');
  return { accessToken: token, refreshToken: token };
}
```

**注意**：
- xlt-token 不区分 access / refresh token，这里用同一个 token 做续期
- 若项目需要"短期 access + 长期 refresh"分离模型，建议搭配策略层自己实现一套映射

---

## 6. 管理员踢人下线

```ts
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

完整示例见 [05-guards-and-decorators · 完整示例](./05-guards-and-decorators.md#完整示例白名单--redis-加载用户)。

关键思路：

```ts
protected async onAuthSuccess(result, request) {
  const user = await this.redis.get(`user_info:${result.loginId}`);
  if (!user) throw new UnauthorizedException('用户会话已失效');
  request.user = { userId: user.id, roles: user.roles, permissions: user.permissions };
}
```

在登录服务里同步写入该缓存：

```ts
// login 成功后
const token = await this.stpLogic.login(user.id);
await this.redis.set(`user_info:${user.id}`, JSON.stringify({
  id: user.id, roles: [...], permissions: [...]
}), config.timeout);
```

---

## 8. 同时支持登录/匿名访问的接口

**场景**：商品详情页，登录用户显示"我的评分"，匿名用户只显示公开内容。

```ts
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

⚠️ xlt-token **没有内置此能力**，需要自行扩展。思路：

1. `login` 成功后把 loginId 写入 Redis 的 `online_users` set，登出 / 踢人时移除
2. 用 Redis 的 `SCARD online_users` 查总数、`SMEMBERS online_users` 查列表

示例（封装在你的 AuthService 里）：

```ts
async login(loginId: string) {
  const token = await this.stpLogic.login(loginId);
  await this.redis.sadd('online_users', loginId);
  return token;
}

async logout(token: string) {
  const loginId = await this.stpLogic.getTokenValue({ headers: { authorization: token } } as any);
  await this.stpLogic.logout(token);
  await this.redis.srem('online_users', loginId);
}

async onlineCount() {
  return this.redis.scard('online_users');
}
```

（生产实现需处理掉线、过期清理等边界，可用 Redis 的 `ZSET` + 心跳替代。）

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

```ts
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

## 还缺什么？

如果你的业务场景这里没覆盖，欢迎提 Issue。常见还没写的：

- ☐ 二维码扫码登录
- ☐ 临时 token（一次性，用完即焚）
- ☐ 验证码登录 + 信任设备
- ☐ SSO / OAuth2 接入
