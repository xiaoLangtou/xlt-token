# xlt-token 2.0：从 NestJS 单包，到框架无关的 Token 鉴权引擎

> 建议掘金标题：**「NestJS 鉴权库 xlt-token 架构升级：core + 适配器，5 分钟跑通全功能 Demo」**
>
> 建议标签：`NestJS` `TypeScript` `Node.js` `鉴权` `开源`

---

做过后端鉴权的朋友，大概都踩过这些坑：

- JWT 自己拼，踢人、顶号、多端会话得从零写
- Passport 灵活，但 Session / Token 语义得自己搭
- 引入一整套 Auth 框架，又太重，和现有业务耦合深

**xlt-token** 是一个受 Sa-Token 启发的轻量 Token 鉴权库，专注 NestJS 生态。最近它完成了一次重要升级：**把鉴权核心从 NestJS 里「抽」出来，变成框架无关的 `@xlt-token/core`**，NestJS 则作为第一个官方适配器 `@xlt-token/nestjs` 存在。

这篇文章分三部分介绍：

1. xlt-token 从单框架到无框架依赖的演变
2. 新架构怎么用
3. 可运行的使用示例（含交互 Demo）

---

## 一、从单框架到无框架依赖：xlt-token 的演变

### 1.0 时代：一个包搞定 NestJS 接入

早期 xlt-token 以 **单 npm 包 `xlt-token`** 发布，用法非常直接：

```typescript
import { XltTokenModule, XltTokenGuard, StpUtil, LoginId } from 'xlt-token';

@Module({
  imports: [XltTokenModule.forRoot({ isGlobal: true })],
  providers: [{ provide: APP_GUARD, useClass: XltTokenGuard }],
})
export class AppModule {}
```

Controller 里登录、拿用户 ID：

```typescript
@XltIgnore()
@Post('login')
async login() {
  const token = await StpUtil.login('1001');
  return { token };
}

@Get('me')
me(@LoginId() loginId: string) {
  return { loginId };
}
```

**优点很明显**：接入快、API 统一、装饰器好用。

**问题也会随着项目变大而暴露**：

| 痛点 | 表现 |
| --- | --- |
| 框架绑定 | 核心逻辑和 NestJS Module/Guard 缠在一起，Express 中间件、脚本里没法复用 |
| 测试成本高 | 想单测「顶号」「踢人」「活跃过期」，往往得搭 Nest TestingModule |
| 职责边界模糊 | 鉴权算法、HTTP 适配、装饰器元数据混在一个包里 |
| 扩展受限 | 想做 Express/Hono 适配，只能复制核心代码，难以保持一致 |

### 2.0 时代：core + 适配器的 monorepo

xlt-token 升级为 monorepo，拆成两个包：

```
packages/
├── core/      @xlt-token/core    — 框架零依赖的鉴权引擎
└── nestjs/    @xlt-token/nestjs  — NestJS 官方集成层
```

**设计原则：鉴权语义下沉，框架集成上浮。**

分层示意：

```
┌─────────────────────────────────────────┐
│  L3  @xlt-token/nestjs                  │
│      Module / Guard / Decorator         │
├─────────────────────────────────────────┤
│  L2  HttpContext 适配层                  │
│      createExpressContext(req, res)     │
├─────────────────────────────────────────┤
│  L1  @xlt-token/core                    │
│      StpLogic / StpPermLogic / StpUtil  │
├─────────────────────────────────────────┤
│  L0  可插拔契约                          │
│      Store · Strategy · StpInterface    │
└─────────────────────────────────────────┘
```

#### 对现有 NestJS 用户意味着什么？

**好消息：对外 API 基本不变。**

以前：

```typescript
import { XltTokenModule, StpUtil } from 'xlt-token';
```

现在：

```typescript
import { XltTokenModule, StpUtil } from '@xlt-token/nestjs';
```

`@LoginId()`、`@XltIgnore()`、`XltTokenGuard`、`StpUtil.login()` 等用法保持一致，迁移主要是 **改 import 路径**。

#### 1.1.0 能力统一在 core 交付

无论用哪个框架适配器，这些能力都由 `@xlt-token/core` 实现：

- **多端登录**：同一账号 PC / App 独立 token
- **二级认证**：`openSafe` + `@XltCheckSafe`
- **JWT 策略 + 黑名单**
- **生命周期 Hooks**：`onLogin` / `onKickout` / `onReplaced`
- **在线观测**：`getOnlineCount` / `getOnlineLoginIds`

NestJS 用户通过 `StpLogic` / `StpUtil` 透明调用，无感知。

---

## 二、新架构怎么用

### 2.1 先选对包

| 场景 | 安装 | import 来源 |
| --- | --- | --- |
| NestJS 项目 | `pnpm add @xlt-token/nestjs` | `@xlt-token/nestjs` |
| Express / 脚本 / 自研框架 | `pnpm add @xlt-token/core` | `@xlt-token/core` |
| Redis 存储 | 额外 `pnpm add redis` | `RedisStore` from nestjs 包 |
| JWT Token | 额外 `pnpm add jsonwebtoken` | `JwtStrategy` from nestjs 包 |

### 2.2 NestJS 标准接入（3 步）

**Step 1：注册模块 + 全局 Guard**

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { XltTokenModule, XltTokenGuard } from '@xlt-token/nestjs';

@Module({
  imports: [
    XltTokenModule.forRoot({
      isGlobal: true,
      config: {
        tokenName: 'authorization',
        timeout: 7 * 24 * 60 * 60, // 7 天
        defaultCheck: true,          // 默认全部路由需登录
      },
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: XltTokenGuard }],
})
export class AppModule {}
```

**Step 2：写登录 / 登出**

```typescript
import { Controller, Post, Get, Body } from '@nestjs/common';
import { StpUtil, XltIgnore, LoginId, TokenValue } from '@xlt-token/nestjs';

@Controller('auth')
export class AuthController {
  @XltIgnore() // 登录接口本身放行
  @Post('login')
  async login(@Body() dto: { userId: string }) {
    const token = await StpUtil.login(dto.userId);
    return { token };
  }

  @Post('logout')
  async logout(@TokenValue() token: string) {
    await StpUtil.logout(token);
    return { ok: true };
  }

  @Get('me')
  me(@LoginId() loginId: string) {
    return { loginId };
  }
}
```

**Step 3：声明式权限 / 角色（可选）**

实现 `StpInterface` 提供权限数据源，然后：

```typescript
import { XltCheckPermission, XltCheckRole, XltMode } from '@xlt-token/nestjs';

@XltCheckPermission('user:read')
@Get('users')
list() {}

@XltCheckRole(['admin', 'super'], { mode: XltMode.OR })
@Delete(':id')
remove() {}
```

校验失败分别抛 `NotPermissionException`（403）和 `NotRoleException`（403），前端可按 type 分支处理。

### 2.3 生产环境：forRootAsync + Hooks

```typescript
XltTokenModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  stpInterface: AppStpInterface,
  hooks: {
    onLogin: (loginId, token, device) => {
      console.log(`[login] ${loginId} @ ${device}`);
    },
    onKickout: (loginId) => {
      websocket.notify(loginId, '您已被强制下线');
    },
  },
  useFactory: (cfg: ConfigService) => ({
    config: {
      tokenName: cfg.get('TOKEN_NAME'),
      timeout: cfg.get('TOKEN_TIMEOUT'),
    },
  }),
});
```

### 2.4 框架无关：core 直连

不在 NestJS 里？用 `createXltToken`：

```typescript
import { createXltToken, MemoryStore, createExpressContext } from '@xlt-token/core';

const xlt = createXltToken({
  config: { tokenName: 'authorization', timeout: 3600 },
  store: new MemoryStore(),
});

// Express 中间件
app.use(async (req, res, next) => {
  const ctx = createExpressContext(req, res);
  try {
    await xlt.stpLogic.checkLogin(ctx);
    req.stpLoginId = ctx.state.stpLoginId;
    next();
  } catch {
    res.status(401).json({ message: '未登录' });
  }
});
```

**核心抽象一览：**

| 抽象 | 作用 |
| --- | --- |
| `HttpContext` | 统一读写 Header/Cookie，核心不绑定 Express/Fastify |
| `XltTokenStore` | token ↔ loginId 映射（Memory / Redis / 自定义） |
| `TokenStrategy` | 生成 token（UUID / JWT / 自定义） |
| `StpInterface` | 权限与角色数据源 |
| `XltHooks` | 登录、踢人、顶号等生命周期观测 |

---

## 三、使用示例

### 3.1 最小闭环：登录 → 访问 → 登出

```bash
# 登录
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'
# → { "token": "550e8400-...", "loginId": "1001" }

# 带 Bearer 访问
curl http://localhost:3000/auth/me \
  -H 'Authorization: Bearer 550e8400-...'

# 登出
curl -X POST http://localhost:3000/auth/logout \
  -H 'Authorization: Bearer 550e8400-...'
```

### 3.2 权限：同一接口，不同用户不同结果

```bash
# admin → 200
curl http://localhost:3000/permission/read -H 'Authorization: Bearer <admin-token>'

# user 缺 user:delete → 403
curl http://localhost:3000/permission/delete -H 'Authorization: Bearer <user-token>'
```

响应体带 `type: "NOT_PERMISSION"`，前端可精准提示。

### 3.3 二级认证：支付前验证码

```typescript
// 验证码通过后
await StpUtil.openSafe(token, 'pay', 300);

// 敏感接口
@XltCheckSafe('pay')
@Post('transfer')
transfer() { /* 只有 openSafe 窗口内可进入 */ }
```

未开启时返回 403，`type: "NOT_SAFE"`。

### 3.4 多端：PC 和 App 互不影响

```typescript
const pcToken = await StpUtil.login('1001', { device: 'pc' });
const appToken = await StpUtil.login('1001', { device: 'app' });

// 只踢 PC，App 仍在线
await StpUtil.kickoutByDevice('1001', 'pc');
```

被踢端下次请求收到 401，`type: "KICK_OUT"`——和 token 自然过期（`INVALID_TOKEN`）区分开，前端可以展示「已被强制下线」。

### 3.5 交互式全功能 Demo（强烈推荐）

仓库内置 **可运行的 NestJS 完整示例 + 可视化 Playground**，不用手写 curl：

```bash
git clone https://github.com/xiaoLangtou/xlt-token.git
cd xlt-token
pnpm install && pnpm build
cd examples/nestjs
pnpm start
```

浏览器打开：**http://localhost:3000/demo/**

演示页能力：

- 顶部一键 **admin / user 登录**，实时预览 token
- **10 个场景分区**：权限、角色、二级认证、多端踢人、Hooks…
- 右侧 **API 日志面板**，401/403 高亮
- 二级认证流程指示：openSafe → transfer

演示账号：

| 用户名 | 密码 | 角色 |
| --- | --- | --- |
| admin | admin123 | admin, super |
| user | user123 | user |

---

## 写在最后

xlt-token 2.0 的核心变化，不是换了一套 API，而是 **把鉴权引擎从框架里解放出来**：

- NestJS 用户：接入方式几乎不变，换 import 即可
- 非 Nest 用户：可以直接用 `@xlt-token/core`
- 团队：core 层可独立测试，适配器层按需扩展

如果你正在找一套 **轻量、语义清晰、Sa-Token 风格** 的 NestJS Token 方案，不妨 clone 仓库跑一下 Demo：

```bash
pnpm add @xlt-token/nestjs
```

**相关链接：**

- GitHub：https://github.com/xiaoLangtou/xlt-token
- 在线文档：https://xiaolangtou.github.io/xlt-token/
- 交互示例：`examples/nestjs`（`/demo/` 页面）

欢迎 Star、Issue 和 PR。

---

> 发布到掘金时可补充：
> - **封面图**：建议用架构分层示意图或 Demo 页截图
> - **摘要**：xlt-token 完成 2.0 架构升级，拆分为框架无关的 @xlt-token/core 与 NestJS 适配器 @xlt-token/nestjs。本文介绍演变历程、新架构用法，并附带可交互的全功能 Demo。
