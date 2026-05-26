# xlt-token 1.1：给 NestJS 补上 Sa-Token 式鉴权能力

> 建议标签：`NestJS` `TypeScript` `鉴权` `Sa-Token` `JWT` `Redis`

---

## 一、项目背景 + 项目介绍

### 背景：NestJS 鉴权常见痛点

在 NestJS 项目里做登录鉴权，很多人会遇到同一组问题：

- **Guard + Session/JWT 各写一套**，顶号、踢人、活跃过期要自己拼 Redis 键
- **多端登录语义绕不清**：PC 和 App 能不能同时在线？同端能不能顶号？
- **敏感操作**（转账、改密）只有一级登录，缺少「二次确认」机制
- **运维侧**查在线用户、强制下线、审计登录事件，往往要重复造轮子

Java 生态有 **Sa-Token** 把这些问题封装成统一 API；Node 侧长期缺少一个 **NestJS 原生、语义对齐、可插拔** 的同类方案。

### xlt-token 是什么？

**xlt-token** 是一个面向 NestJS 的轻量 Token 鉴权库，灵感来自 Sa-Token，MIT 开源。

| 链接 | 地址 |
| --- | --- |
| 在线文档 | https://xiaolangtou.github.io/xlt-token/ |
| GitHub | https://github.com/xiaoLangtou/xlt-token |
| npm | `pnpm add xlt-token` |

**核心设计：**

- **可插拔**：Store（内存 / Redis）、Token 策略（UUID / JWT）均可替换
- **双形态 API**：`StpLogic` 依赖注入 + `StpUtil` 静态门面
- **声明式开发**：Guard + 装饰器（`@XltIgnore`、`@LoginId`、`@XltCheckPermission` 等）
- **与 1.0 兼容**：1.1 新能力全部 opt-in，老项目升级不破坏现有 API

---

## 二、项目如何使用（5 分钟接入）

### 安装

```bash
pnpm add xlt-token
# 生产多实例建议
pnpm add redis
```

### 注册模块 + 全局守卫

```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { XltTokenModule, XltTokenGuard } from 'xlt-token';

@Module({
  imports: [
    XltTokenModule.forRoot({
      isGlobal: true,
      config: {
        tokenName: 'authorization',
        timeout: 7 * 24 * 60 * 60,
      },
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: XltTokenGuard }],
})
export class AppModule {}
```

### 登录 / 登出 / 取当前用户

```ts
import { Controller, Post, Body } from '@nestjs/common';
import { StpUtil, XltIgnore, LoginId, TokenValue } from 'xlt-token';

@Controller('auth')
export class AuthController {
  @XltIgnore()
  @Post('login')
  async login(@Body() dto: { username: string }) {
    const token = await StpUtil.login(dto.username);
    return { token };
  }

  @Post('logout')
  async logout(@TokenValue() token: string) {
    await StpUtil.logout(token);
    return { ok: true };
  }

  @Post('me')
  me(@LoginId() loginId: string) {
    return { loginId };
  }
}
```

默认 `defaultCheck: true`：**所有接口需登录**，公开路由加 `@XltIgnore()` 即可。

客户端请求时带上 Header：

```http
Authorization: Bearer <token>
```

更多配置、Redis 存储、异步 `forRootAsync` 见[在线文档 · 快速开始](https://xiaolangtou.github.io/xlt-token/guide/getting-started)。

---

## 三、本版本做了哪些内容（1.1 四大方向）

1.1 的实现设计（`13-1.1.0-implementation-design.md`）按 **四个 Milestone** 落地，与 Roadmap 对齐：

| 方向 | 解决什么问题 | 主要交付 |
| --- | --- | --- |
| **① 多端登录** | PC / App 能否共存、同端能否顶号 | `device` 参数、`deviceConcurrent`、设备列表与按端踢人 |
| **② 二级认证 + 临时 Token** | 敏感操作二次确认、邮件链接一次性授权 | `openSafe` / `@XltCheckSafe`、`createTempToken` 系列 |
| **③ JWT Strategy** | 既要 JWT 验签，又要踢人/顶号/活跃过期 | 内置 `JwtStrategy` + jti 黑名单 |
| **④ Hooks + 观测性** | 在线用户、强制下线、登录审计 | `keys()` 扫描、`getOnlineLoginIds`、生命周期 Hooks |

**设计原则（贯穿全版本）：**

- 与 1.0 API **完全兼容**，新字段/新 API 均为可选
- 不传 `device` 时等价 `device: 'default'`，旧 session 键可迁移
- 不绑业务：权限数据仍由 `StpInterface` 实现，库不做 CRUD

---

## 四、功能点 · 怎么用 · 完成了什么

### 4.1 多端登录

**完成了什么：**

- Session 键升级为 `session:${loginId}:${device}`，并增加 `session-list` 设备索引
- 新增 `deviceConcurrent`，与 `isConcurrent` / `isShare` 组合控制互踢范围
- 提供 `getDeviceList`、`kickoutByDevice`、`kickoutByToken`、`forceLogout`

**典型配置 — PC 与 App 互不影响：**

```ts
XltTokenModule.forRoot({
  config: {
    deviceConcurrent: true,
    isConcurrent: true,
    isShare: false,
  },
});
```

**怎么用：**

```ts
// 登录时指定设备
const pcToken = await stp.login(userId, { device: 'pc' });
const appToken = await stp.login(userId, { device: 'app' });

// 管理端：查设备、踢指定端
const devices = await stp.getDeviceList(userId);
await stp.kickoutByDevice(userId, 'pc');  // 只踢 PC
await stp.forceLogout(userId);             // 全端下线
```

📄 详见文档：[14 · 多端登录](https://xiaolangtou.github.io/xlt-token/core/multi-device)

---

### 4.2 二级认证（Safe）+ 临时 Token

**完成了什么：**

- 存储键：`safe:${token}:${business}` 标记安全窗口；`temp-token:${tempToken}` 存业务 payload
- 新增 `NotSafeException`（403）、装饰器 `@XltCheckSafe`
- Guard 在 `checkLogin` 成功后自动消费 Safe 元数据

**二级认证 — 转账前验证码：**

```ts
// Step 1：验证通过后打开 300 秒窗口
await stp.openSafe(token, 'pay', 300);

// Step 2：敏感接口
@XltCheckSafe('pay')
@Post('transfer')
transfer() { /* 未 openSafe 则 403 */ }
```

**临时 Token — 邮件重置密码：**

```ts
const tempToken = await stp.createTempToken(`resetPwd:${userId}`, 1800);
const link = `https://app.com/reset?t=${tempToken}`;

// 用户点链接
const value = await stp.parseTempToken(tempToken);
await stp.deleteTempToken(tempToken);  // 一次性消费
```

📄 详见文档：[15 · 二级认证](https://xiaolangtou.github.io/xlt-token/core/secondary-auth)

---

### 4.3 内置 JWT Strategy

**完成了什么：**

- 新增 `JwtStrategy`：payload 约定 `sub`（loginId）+ `jti`（会话 ID）
- 鉴权路径：本地 `verifyToken` + 查 `jwt-blacklist:${jti}`（被踢/被顶才写黑名单）
- 保留 xlt-token 语义：顶号、踢人、活跃过期仍由 Store 控制（**有状态 JWT**，非纯无状态）

**怎么用：**

```ts
import { XltTokenModule, JwtStrategy } from 'xlt-token';

XltTokenModule.forRoot({
  strategy: { useClass: JwtStrategy },
  config: {
    jwt: {
      secret: process.env.JWT_SECRET!,
      algorithm: 'HS256',
    },
    timeout: 86400,
  },
});
```

需自行安装：`pnpm add jsonwebtoken`

📄 详见文档：[16 · JWT 策略](https://xiaolangtou.github.io/xlt-token/core/jwt-strategy)

---

### 4.4 Hooks + 在线观测

**完成了什么：**

- Store 接口扩展 `keys(pattern)`（Redis 用 SCAN，避免 KEYS 阻塞）
- `getOnlineLoginIds` / `getOnlineCount` 扫描 `session-list:*`
- Hooks：`onLogin` / `onKickout` 等，异常不影响主流程

**怎么用：**

```ts
XltTokenModule.forRoot({
  hooks: {
    onLogin: (loginId, token, device) => {
      audit.log('login', { loginId, device });
    },
    onKickout: (loginId, token) => {
      websocket.notify(loginId, '您已被强制下线');
    },
  },
});

// 运维 API
const count = await stp.getOnlineCount();
const users = await stp.getOnlineLoginIds({ page: 0, pageSize: 50 });
```

📄 详见文档：[17 · Hooks 与观测性](https://xiaolangtou.github.io/xlt-token/core/hooks-and-observability)

---

### 4.5 1.0 能力回顾（本版本继续可用）

| 能力 | 用法要点 |
| --- | --- |
| 顶号 / 踢人 | `isConcurrent: false` 顶号；`kickout()` 返回 `KICK_OUT` 而非笼统 401 |
| 活跃过期 | `activeTimeout` + 每次请求刷新 `lastActive` |
| 权限 / 角色 | `@XltCheckPermission` / `@XltCheckRole` + 实现 `StpInterface` |
| 会话扩展 | `StpUtil.getSession(loginId).set(key, value)` |
| 自定义 Guard | 继承 `XltAbstractLoginGuard`，重写 `onAuthSuccess` 加载 `request.user` |

---

## 五、可靠性：测试怎么保障这些功能

我们不为「能跑通 Demo」买单，**每个 Milestone 都有对应单测 / E2E**。

### 测试规模（当前实测）

| 指标 | 数值 |
| --- | --- |
| **用例总数** | **274** |
| 单测 | 211（10 个 spec） |
| E2E | 63（11 个 spec） |
| 单测覆盖率 | **96.03%** Stmts / 91.97% Branch |
| E2E 覆盖率 | **96.08%** Stmts / 91.39% Branch |

### 1.1 功能与测试对应关系

| 功能模块 | 单测 | E2E |
| --- | --- | --- |
| 多端登录 / session-list | `stp-logic.spec.ts` | `multi-device.e2e-spec.ts`（13 用例） |
| 二级认证 + 临时 Token | `stp-logic.spec.ts` | `secondary-auth.e2e-spec.ts`（7 用例） |
| JWT + 黑名单 | `stp-logic.jwt.spec.ts`（13 用例） | `jwt.e2e-spec.ts`（6 用例） |
| Store `keys()` 扫描 | `memory-store` / `redis-store` spec | 在线列表场景 |
| Guard / 装饰器 | 各模块单测 | `app-guard` / `permission` / `custom-guard` 等 |
| 模块注册 / 静态门面 | `xlt-token.module` spec | `forroot-async` / `static-facade` |

核心文件 `stp-logic.ts` 单测 **70+ 用例**，覆盖 login 分支、JWT 分支、Safe、临时 Token、活跃过期等路径。

### 本地一键验证

```bash
pnpm test          # 211 单测
pnpm test:e2e      # 63 E2E
pnpm test:cov      # 覆盖率报告
```

文档站代码块已接入 **Twoslash**，悬停即可看类型，和测试一起保证「文档示例 ≠ 假代码」。

---

## 结语

xlt-token 1.0 把 **NestJS + Sa-Token 语义** 的地基打好；1.1 补齐了生产里最常要的四个能力：**多端、Safe、JWT、观测性**。

如果你也在 NestJS 里维护鉴权层，欢迎：

- ⭐ Star：https://github.com/xiaoLangtou/xlt-token
- 📖 文档：https://xiaolangtou.github.io/xlt-token/
- 💬 Issue 反馈场景需求

**一行 `forRoot`，剩下的交给库。**

---

**建议封面文案：** NestJS 鉴权库 xlt-token 1.1 · 多端 · JWT · 二级认证 · 274 测试用例
