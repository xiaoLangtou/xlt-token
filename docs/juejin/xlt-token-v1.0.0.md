# xlt-token v1.0.0 正式发布：一个轻量、可插拔、框架友好的 Token 鉴权库

> 建议掘金标题：**「xlt-token v1.0.0 正式发布：NestJS / Express 一包接入的 Token 鉴权库」**
>
> 建议标签：`Node.js` `TypeScript` `NestJS` `Express` `鉴权`

---

**xlt-token v1.0.0 正式发布了。**

这是 xlt-token 的第一个正式大版本，也代表它从早期 NestJS 单包实验，走到了一个更稳定的形态：核心能力框架无关，NestJS 和 Express 都有官方适配器，业务项目可以用一个适配器包完成接入。

如果你正在写 Node.js 后端，并且不想从零维护登录态、踢人、顶号、多端登录、权限校验和二级认证，xlt-token 可以作为一个轻量选择。它受 Sa-Token 启发，但面向 TypeScript 和现代 Node.js 项目设计。

---

## 为什么做 xlt-token

后端鉴权经常从一个简单需求开始：登录后生成 token，请求时校验 token。业务一旦继续增长，问题很快会变复杂。

你可能需要支持多端登录，让 PC 和 App 的登录态互不干扰。你可能需要实现顶号、踢人、下线原因、在线用户统计。你也可能需要把某些高风险操作放进二级认证，并且让权限和角色校验保持统一。

xlt-token 把这些能力收进一个专门的 Token 鉴权库里。业务代码只关心「谁登录了」「有没有权限」「当前 token 是否安全」，底层的 token 存储、策略、生命周期和框架适配由库处理。

---

## v1.0.0 带来了什么

v1.0.0 是一次正式版本整理。它不只是把版本号从 rc 切到 stable，也把安装方式、包边界、Express 适配器和文档一起收拢到了可发布状态。

核心变化包括：

- `@xlt-token/core` 成为框架无关鉴权引擎。
- `@xlt-token/nestjs` 成为 NestJS 官方接入包。
- `@xlt-token/express` 成为 Express 官方接入包。
- NestJS / Express 用户只需要安装对应适配器包。
- Express 文档补齐 Twoslash，示例代码可以参与类型校验。
- Express 单测和 E2E 覆盖关键登录鉴权流程。

这意味着用户不再需要同时安装 `@xlt-token/core` 和适配器包。适配器会依赖 core，并 re-export 常用核心 API。

---

## 安装方式更简单

NestJS 项目只安装 NestJS 适配器：

```bash
pnpm add @xlt-token/nestjs
```

Express 项目安装 Express 本身和适配器：

```bash
pnpm add express @xlt-token/express
```

如果你在自研框架、脚本、RPC 服务或非 HTTP 场景里使用 xlt-token，可以直接安装 core：

```bash
pnpm add @xlt-token/core
```

这个分层让普通业务接入更轻，也让底层能力可以被其他框架复用。

---

## NestJS：保留熟悉的装饰器体验

NestJS 适配器提供 Module、Guard 和装饰器。你可以把登录校验放到全局 Guard，再用 `@XltIgnore()` 放行登录接口。

```ts [src/app.module.ts]
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { XltTokenGuard, XltTokenModule } from '@xlt-token/nestjs';

@Module({
  imports: [
    XltTokenModule.forRoot({
      isGlobal: true,
      config: {
        tokenName: 'authorization',
        defaultCheck: true,
        timeout: 7 * 24 * 60 * 60,
      },
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: XltTokenGuard }],
})
export class AppModule {}
```

Controller 中直接使用 `StpUtil` 登录，并通过参数装饰器读取当前登录信息。

```ts [src/auth.controller.ts]
import { Body, Controller, Get, Post } from '@nestjs/common';
import { LoginId, StpUtil, XltIgnore } from '@xlt-token/nestjs';

@Controller('auth')
export class AuthController {
  @XltIgnore()
  @Post('login')
  async login(@Body() body: { userId: string }) {
    const token = await StpUtil.login(body.userId);
    return { token };
  }

  @Get('me')
  me(@LoginId() loginId: string) {
    return { loginId };
  }
}
```

权限和角色校验也可以保持声明式。

```ts [src/user.controller.ts]
import { Controller, Delete, Get, Param } from '@nestjs/common';
import { XltCheckPermission, XltCheckRole } from '@xlt-token/nestjs';

@Controller('users')
export class UserController {
  @XltCheckPermission('user:read')
  @Get()
  list() {
    return [];
  }

  @XltCheckRole('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return { id };
  }
}
```

---

## Express：中间件和路由策略组合

Express 适配器提供的是更贴近 Express 风格的 API。你先注册 `xltTokenMiddleware()`，再按路由添加登录、权限、角色或二级认证策略。

```ts [src/app.ts]
import express from 'express';
import {
  requireLogin,
  StpUtil,
  xltTokenMiddleware,
} from '@xlt-token/express';

const app = express();

app.use(express.json());
app.use(xltTokenMiddleware({
  config: {
    tokenName: 'authorization',
    defaultCheck: true,
  },
  excludes: ['/auth/login'],
}));

app.post('/auth/login', async (req, res) => {
  const token = await StpUtil.login(req.body.userId);
  res.json({ token });
});

app.get('/profile', requireLogin(), async (req, res) => {
  const loginId = await req.xltToken.getLoginId();
  res.json({ loginId });
});

export { app };
```

路由策略可以继续叠加，适合把鉴权规则留在路由声明附近。

```ts [src/admin.ts]
import { Router } from 'express';
import {
  checkPermission,
  checkRole,
  checkSafe,
  requireLogin,
} from '@xlt-token/express';

const router = Router();

router.post(
  '/pay',
  requireLogin(),
  checkSafe('pay', 300),
  checkPermission('order:pay'),
  (req, res) => {
    res.json({ ok: true });
  },
);

router.delete(
  '/users/:id',
  requireLogin(),
  checkRole('admin'),
  (req, res) => {
    res.json({ ok: true, id: req.params.id });
  },
);

export { router };
```

这种设计没有引入装饰器，也不要求业务改变 Express 的组织方式。你依然可以使用普通中间件、Router 和错误处理函数。

---

## core：真正的框架无关层

`@xlt-token/core` 不依赖 NestJS 或 Express。它围绕 `HttpContext`、`Store`、`TokenStrategy` 和 `StpLogic` 提供统一鉴权语义。

这使 xlt-token 可以在不同框架中保持一致行为。适配器只负责把框架请求对象转换成 core 认识的上下文，并把异常交给框架处理。

```ts [src/auth.ts]
import { createXltToken, MemoryStore } from '@xlt-token/core';

const { stpLogic } = createXltToken({
  config: {
    tokenName: 'authorization',
    timeout: 7 * 24 * 60 * 60,
  },
  store: new MemoryStore(),
});

const token = await stpLogic.login('user-1');
const loginId = await stpLogic.getLoginIdByToken(token);

console.log({ token, loginId });
```

如果你需要接入 Koa、Fastify、自研网关或定时任务，可以直接基于 core 做适配。NestJS 和 Express 适配器就是这种分层的官方实现。

---

## v1.0.0 的稳定边界

v1.0.0 对外承诺的是核心鉴权语义稳定。登录、登出、token 校验、权限校验、角色校验、多端登录、二级认证、Hooks、Store 和 Strategy 这些 API 会作为长期基础继续演进。

适配器层也进入正式可用状态。NestJS 适合需要 Module、Guard、Decorator 的项目；Express 适合偏中间件风格、希望把策略写在路由附近的项目。

后续版本会继续围绕更多框架适配、存储实现、文档体验和测试覆盖推进。v1.0.0 的目标不是做一个庞大的认证平台，而是提供一套稳定、清晰、可组合的 Token 鉴权基础设施。

---

## 快速选择

如果你的项目是 NestJS，直接使用：

```bash
pnpm add @xlt-token/nestjs
```

如果你的项目是 Express，直接使用：

```bash
pnpm add express @xlt-token/express
```

如果你正在写框架适配器或自研运行时，使用：

```bash
pnpm add @xlt-token/core
```

xlt-token v1.0.0 是这个项目的正式起点。它把核心、适配器、文档和测试一起整理到了第一个稳定大版本，也为后续更多 Node.js 框架接入打下基础。
