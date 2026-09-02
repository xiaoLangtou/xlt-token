---
title: Fastify Token 鉴权集成
description: 在 Fastify 项目中使用 xlt-token 配置实例、请求上下文和路由鉴权，构建可复用的 Token 登录态能力。
---

# Fastify 适配器

`@xlt-token/fastify` 为纯 Fastify 应用提供官方认证插件。它把 Fastify 的 `request` / `reply` 转换为 core 的 `HttpContext`，再复用 `@xlt-token/core` 中的登录、权限、角色和二级认证语义。

插件只接收显式 `XltInstance`（通过 `createXltInstance()` 创建），不读取默认实例或 `StpUtil`，因此同一进程内可以隔离地运行多个认证实例。如果你使用 NestJS（含 Nest Fastify 平台），请优先阅读 [NestJS 快速开始](/adapters/nestjs/getting-started)。

## 安装

安装 Fastify 适配器。`@xlt-token/core` 会随适配器自动安装；`fastify` 是 peer dependency，业务项目需要自己安装。

```bash
pnpm add fastify @xlt-token/fastify
```

Cookie Token 来源额外依赖 `@fastify/cookie`（见下文 [Cookie Token 来源](#cookie-token-来源)）：

```bash
pnpm add @fastify/cookie
```

## Redis 存储

Fastify 适配器可以直接使用框架无关的 `@xlt-token/store-redis`。应用负责创建和连接 Redis 客户端，再把 Store 实例传给 `createXltInstance`。

```ts twoslash [src/xlt.ts]
import { createXltInstance } from '@xlt-token/core';
import { RedisStore } from '@xlt-token/store-redis';
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (error) => {
  console.error('[redis]', error);
});
await redisClient.connect();

export const instance = createXltInstance({
  store: new RedisStore(redisClient),
});
```

node-redis、ioredis、Cluster、TTL、SCAN 和关闭连接的完整说明见
[Redis Store 完整指南](/store-redis/)。

## 最小应用

先创建一个 `XltInstance`，再把 `xltFastifyPlugin` 注册到应用。插件通过 `preHandler` Hook 完成鉴权，鉴权成功后把登录态写入 `request.stpLoginId` / `request.stpToken` / `request.stpSession`。

```ts twoslash [src/app.ts]
import Fastify from 'fastify';
import { createXltInstance, MemoryStore, XltMode } from '@xlt-token/fastify';
import { xltFastifyPlugin } from '@xlt-token/fastify';

const stpInterface = {
  getPermissionList: async (loginId: string) =>
    loginId === '1001' ? ['user:read', 'order:*'] : [],
  getRoleList: async (loginId: string) => (loginId === '1001' ? ['admin'] : []),
};

export const instance = createXltInstance({
  config: { tokenPrefix: '' },
  store: new MemoryStore(),
  stpInterface,
});

const app = Fastify();

await app.register(xltFastifyPlugin, {
  instance,
  ignore: ['/api/auth/login', '/api/public'],
  policies: [
    { match: '/api/order', permissions: { list: ['order:read'], mode: XltMode.AND } },
    { match: '/api/admin', roles: { list: ['admin'], mode: XltMode.AND } },
    { match: '/api/pay', methods: ['POST'], safeBusiness: 'pay' },
  ],
});

app.post('/api/auth/login', async (request) => {
  const { userId = '1001' } = (request.body ?? {}) as { userId?: string };
  return { token: await instance.stpLogic.login(userId) };
});

app.get('/api/public', async () => ({ ok: true }));

app.get('/api/me', async (request) => ({
  id: request.stpLoginId,
  token: request.stpToken,
  hasSession: request.stpSession != null,
}));

await app.listen({ port: 3000 });
```

`instance` 是必填项：缺失时插件在注册阶段直接抛错，不会静默回退到默认实例。配置含义与 `createXltToken()` 完全一致（`config` / `store` / `strategy` / `stpInterface` / `eventSink`），见 [Core API](/core/core-api)。

## 路由策略

`ignore` 与 `policies` 在插件注册时声明，作用于匹配到的路由。字符串匹配器按路径段前缀匹配：`/api/public` 命中 `/api/public/docs` 与 `/api/public?from=web`，但不会命中 `/api/publicity`。每条策略可以用 `methods` 限定 HTTP 方法。

```ts
await app.register(xltFastifyPlugin, {
  instance,
  ignore: ['/api/auth/login'],
  policies: [
    { match: '/api/me', requireLogin: true },
    { match: '/api/order', permissions: { list: ['order:read'], mode: XltMode.AND } },
    { match: '/api/report', roles: { list: ['admin', 'ops'], mode: XltMode.OR } },
    { match: '/api/pay', methods: ['POST'], safeBusiness: 'pay' },
  ],
});
```

策略声明在鉴权之前解析，语义与 Express 的 Router policy 一致：

- `defaultCheck: true`（黑名单模式，默认）：除 `ignore` 标记外全部校验登录
- `defaultCheck: false`（白名单模式）：默认放行，只有声明 `requireLogin`（或权限 / 角色 / safe）的路由才校验

## 路由级 config.xlt

同样的元数据可以在单个路由的 `config` 上声明。路由同时命中插件策略与 `config.xlt` 时，`config.xlt` 的简单字段覆盖策略，权限 / 角色列表合并（mode 取路由声明）。

```ts twoslash
app.get(
  '/api/cfg/order',
  { config: { xlt: { permissions: { list: ['order:read'], mode: XltMode.AND } } } },
  async () => ({ ok: true }),
);

app.get(
  '/api/cfg/open',
  { config: { xlt: { ignore: true } } },
  async () => ({ ok: true }),
);
```

## Token 来源

Token 读取顺序与 Core 一致：Header → Cookie → Query（由 `isReadHeader` / `isReadCookie` / `isReadQuery` 开关控制）。

Header 与 Query 直接映射 Fastify 原生对象。Cookie 读取依赖 `@fastify/cookie` 提供的同步 `request.cookies` 装饰器，符合 v2.x 的同步 Cookie 契约。

### Cookie Token 来源

启用 `isReadCookie` 时必须先注册 `@fastify/cookie`：

```ts twoslash [src/app-cookie.ts]
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { createXltInstance } from '@xlt-token/core';
import { xltFastifyPlugin } from '@xlt-token/fastify';

const instance = createXltInstance({
  config: { isReadCookie: true, isReadHeader: false },
});

const app = Fastify();
await app.register(cookie);
await app.register(xltFastifyPlugin, { instance });
```

未注册 `@fastify/cookie` 时：

- 启用 `isReadCookie` 的应用在 `ready()` 阶段直接报错（快速失败，不带病启动）
- 写回 cookie（`setCookie`）时抛出明确错误

登录后把 token 写回 cookie，通过 `createFastifyContext` 桥接 reply：

```ts twoslash
import { createFastifyContext } from '@xlt-token/fastify';

app.post('/login', async (request, reply) => {
  const token = await instance.stpLogic.login('1001');
  createFastifyContext(request, reply).setCookie('authorization', token, {
    httpOnly: true,
    path: '/',
  });
  return { ok: true };
});
```

## 多实例

每次插件注册绑定一个显式实例。把插件注册进不同 scope 即可实现实例隔离（不同 tokenName / Store 互不污染）：

```ts twoslash
const userAuth = createXltInstance({ config: { tokenName: 'user-token' } });
const adminAuth = createXltInstance({ config: { tokenName: 'admin-token' } });

await app.register(
  async (scope) => {
    await scope.register(xltFastifyPlugin, { instance: userAuth });
    scope.get('/me', async (request) => ({ id: request.stpLoginId }));
  },
  { prefix: '/user' },
);

await app.register(
  async (scope) => {
    await scope.register(xltFastifyPlugin, { instance: adminAuth });
    scope.get('/me', async (request) => ({ id: request.stpLoginId }));
  },
  { prefix: '/admin' },
);
```

实例契约的完整说明见 [多实例与适配器契约](/guide/multi-instance-contract)。

## 错误处理

默认行为：鉴权失败时插件直接回复 `401` / `403` JSON，响应体结构与 Express / NestJS 适配器一致（`statusCode` / `code` / core 异常 details / `message`）。

设置 `propagateAuthErrors: true` 后，插件把异常抛给 Fastify 的 error handler，由应用统一回复：

```ts twoslash
import { xltFastifyErrorHandler } from '@xlt-token/fastify';

await app.register(xltFastifyPlugin, { instance, propagateAuthErrors: true });
app.setErrorHandler(xltFastifyErrorHandler());
```

## 导出清单

- `xltFastifyPlugin` — Fastify 插件
- `xltFastifyErrorHandler` — 与 `propagateAuthErrors` 配套的错误处理器
- `createFastifyContext` — `request` / `reply` → `HttpContext` 桥接
- `mapXltError` — core 异常 → HTTP 状态码 + JSON body
- `runAuth` — 登录 + 权限 + 角色 + safe 编排
- `matchPolicy` / `mergeRouteAuthMeta` / `resolveRouteAuthMeta` / `resolveRouteConfigMeta` / `shouldCheckLogin` — 策略解析工具
- `createXltInstance` / `MemoryStore` / `UuidStrategy` — 来自 `@xlt-token/core` 的 re-export

## 下一步

- 实例与配置语义 → [Core API](/core/core-api)
- 多实例契约 → [多实例与适配器契约](/guide/multi-instance-contract)
- Cookie 契约决策 → [Cookie 契约](/guide/cookie-contract)
- 分布式登录态 → [Redis Store 完整指南](/store-redis/)
