# Express 适配器

[![Cloud Studio Template](https://cs-res.codehub.cn/common/assets/icon-badge.svg)](https://cloudstudio.net/a/35979106969571328?channel=share&sharetype=Markdown)

`@xlt-token/express` 为纯 Express 应用提供中间件、路由策略和错误处理器。它把 Express 的 `req` / `res` 转换为 core 的 `HttpContext`，再复用 `@xlt-token/core` 中的登录、权限、角色和二级认证语义。

适配器适合不使用 NestJS 的 Express 项目。如果你使用 NestJS，请优先阅读 [NestJS 快速开始](/adapters/nestjs/getting-started)。

## 安装

安装 Express 适配器。`@xlt-token/core` 会随适配器自动安装；`express` 是 peer dependency，业务项目需要自己安装。

```bash
pnpm add express @xlt-token/express
pnpm add -D @types/express
```

## Redis 存储

Express 适配器可以直接使用框架无关的 `@xlt-token/store-redis`。应用负责创建和连接
Redis 客户端，再把 Store 实例传给 `createXltToken`。

```bash
pnpm add @xlt-token/store-redis redis
```

```ts twoslash [src/xlt.ts]
import { createXltToken } from '@xlt-token/express';
import { RedisStore } from '@xlt-token/store-redis';
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (error) => {
  console.error('[redis]', error);
});
await redisClient.connect();

export const xlt = createXltToken({
  store: new RedisStore(redisClient),
});
```

使用 ioredis 时，安装 `ioredis` 并替换 Store：

```ts twoslash [src/xlt-ioredis.ts]
import { createXltToken } from '@xlt-token/express';
import { IORedisStore } from '@xlt-token/store-redis';
import Redis from 'ioredis';

export const xlt = createXltToken({
  store: new IORedisStore(new Redis(process.env.REDIS_URL)),
});
```

每个应用进程复用一个客户端，不要在 middleware 或路由中创建连接。node-redis、
ioredis、Cluster、TTL、SCAN 和关闭连接的完整说明见
[Redis Store 完整指南](/store-redis/)。

## 最小应用

先创建一个 `XltTokenContext`，再把 `xltMiddleware` 挂到 Router 或应用上。`xltErrorHandler()` 需要放在路由之后，用于把 core 异常转换为 JSON 响应。

```ts twoslash [src/app.ts]
import express from 'express';
import {
  createXltToken,
  MemoryStore,
  XltMode,
  xltErrorHandler,
  xltMiddleware,
  type StpInterface,
} from '@xlt-token/express';

const stpInterface: StpInterface = {
  getPermissionList: async (loginId) =>
    loginId === '1001' ? ['user:read', 'order:*'] : [],
  getRoleList: async (loginId) => (loginId === '1001' ? ['admin'] : []),
};

const xlt = createXltToken({
  config: { tokenPrefix: '' },
  store: new MemoryStore(),
  stpInterface,
});

const app = express();
app.use(express.json());

const api = express.Router();

api.use(
  xltMiddleware(xlt, {
    ignore: ['/api/auth/login', '/api/public'],
    policies: [
      { match: '/api/admin', permissions: { list: ['admin:write'], mode: XltMode.AND } },
      { match: '/api/order', permissions: { list: ['order:read'], mode: XltMode.AND } },
      { match: '/api/role-admin', roles: { list: ['admin'], mode: XltMode.AND } },
      { match: '/api/pay', safeBusiness: 'pay' },
    ],
  }),
);

api.post('/auth/login', async (req, res) => {
  const { userId = '1001' } = req.body ?? {};
  const token = await xlt.stpLogic.login(userId);
  res.json({ token });
});

api.post('/auth/logout', async (req, res) => {
  await xlt.stpLogic.logout(req.stpToken!);
  res.json({ ok: true });
});

api.get('/public', (_req, res) => {
  res.json({ ok: true });
});

api.get('/me', (req, res) => {
  res.json({ id: req.stpLoginId, token: req.stpToken });
});

api.get('/order', (_req, res) => {
  res.json({ ok: true });
});

api.post('/pay', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', api);
app.use(xltErrorHandler());

export { app, xlt };
```

中间件顺序不能随意交换：

1. `express.json()` 等 body parser 放在业务路由前。
2. `xltMiddleware()` 放在需要鉴权的路由前。
3. 登录等公开路由通过 `ignore` 或 `ignoreAuth()` 放行。
4. `xltErrorHandler()` 放在所有路由之后。
5. 业务自己的兜底错误处理中间件放在 `xltErrorHandler()` 之后。

启动服务时使用普通 Express 写法。

```ts twoslash [src/main.ts]
import { app } from './app';

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
```

## 中间件流程

`xltMiddleware(xlt, options)` 在一次请求中执行以下步骤：

1. 调用 `createExpressContext(req, res)`，把 Express 请求桥接为 `HttpContext`。
2. 根据 `ignore` 和 `policies` 解析当前请求的路由鉴权元数据。
3. 根据 `defaultCheck`、`ignore` 和 `requireLogin` 判断是否需要登录校验。
4. 调用 `checkLogin`，再按元数据执行权限、角色和二级认证校验。
5. 校验成功后，把 `stpLoginId` 和 `stpToken` 同步到 Express `req`。
6. 校验失败时调用 `next(err)`，交给 `xltErrorHandler()` 或你的自定义错误中间件处理。

## 路由策略

推荐使用 `xltMiddleware` 的 `ignore` 和 `policies` 选项声明路由鉴权规则。策略在鉴权之前解析，因此它适合 Router 级或全局中间件。

```ts twoslash [src/auth-policies.ts]
import express from 'express';
import { createXltToken, XltMode, xltMiddleware } from '@xlt-token/express';

const xlt = createXltToken();
const api = express.Router();
// ---cut---
api.use(
  xltMiddleware(xlt, {
    ignore: ['/api/auth/login', /^\/api\/public/],
    policies: [
      { match: '/api/admin', permissions: { list: ['admin:write'], mode: XltMode.AND } },
      { match: '/api/report', roles: { list: ['admin', 'ops'], mode: XltMode.OR } },
      { match: '/api/pay', methods: ['POST'], safeBusiness: 'pay' },
    ],
  }),
);
```

`match` 支持字符串、正则、函数或它们组成的数组。字符串按路径段前缀匹配：`/api/public` 会匹配 `/api/public/docs` 和 `/api/public?from=web`，不会匹配 `/api/publicity`。

多条策略命中同一个请求时，后声明的策略覆盖简单字段，并合并权限和角色列表。这个规则适合先声明默认策略，再声明更具体的例外。

```ts twoslash [src/policy-override.ts]
import express from 'express';
import { createXltToken, xltMiddleware } from '@xlt-token/express';

const xlt = createXltToken();
const api = express.Router();
// ---cut---
api.use(
  xltMiddleware(xlt, {
    policies: [
      { match: '/api', requireLogin: true },
      { match: '/api/public', ignore: true, requireLogin: false },
    ],
  }),
);
```

## 黑名单和白名单模式

`defaultCheck` 控制默认是否校验登录。

| 模式 | 配置 | 默认行为 | 路由例外 |
| --- | --- | --- | --- |
| 黑名单模式 | `defaultCheck: true` | 所有路由需要登录 | `ignore: true` 放行 |
| 白名单模式 | `defaultCheck: false` | 所有路由放行 | `requireLogin: true` 校验 |

黑名单模式适合大多数后台接口。白名单模式适合只有少量接口需要登录的公开应用。

```ts twoslash [src/whitelist.ts]
import express from 'express';
import { createXltToken, xltMiddleware } from '@xlt-token/express';

const api = express.Router();
// ---cut---
const xlt = createXltToken({
  config: { defaultCheck: false, tokenPrefix: '' },
});

api.use(
  xltMiddleware(xlt, {
    policies: [
      { match: '/api/me', requireLogin: true },
      { match: '/api/order', requireLogin: true },
    ],
  }),
);
```

## 路由级 helper

适配器也提供 `ignoreAuth()`、`requireLogin()`、`checkPermission()`、`checkRole()` 和 `checkSafe()`。这些 helper 只写入当前请求的 `_xltRouteMeta`，因此必须在同一条 route chain 中位于 `xltMiddleware` 之前。

```ts twoslash [src/route-helpers.ts]
import express from 'express';
import {
  checkPermission,
  checkRole,
  checkSafe,
  createXltToken,
  ignoreAuth,
  requireLogin,
  xltMiddleware,
} from '@xlt-token/express';

const app = express();
const xlt = createXltToken();
// ---cut---
app.get('/public', ignoreAuth(), xltMiddleware(xlt), (_req, res) => {
  res.json({ ok: true });
});

app.get('/me', requireLogin(), xltMiddleware(xlt), (req, res) => {
  res.json({ id: req.stpLoginId });
});

app.get('/order', checkPermission('order:read'), xltMiddleware(xlt), (_req, res) => {
  res.json({ ok: true });
});

app.get('/admin', checkRole('admin'), xltMiddleware(xlt), (_req, res) => {
  res.json({ ok: true });
});

app.post('/pay', checkSafe('pay'), xltMiddleware(xlt), (_req, res) => {
  res.json({ ok: true });
});
```

不要在 `api.use(xltMiddleware(xlt))` 之后依赖 route helper。Express 会先执行 `xltMiddleware`，此时 helper 还没有写入元数据。

```ts twoslash [src/wrong-order.ts]
import express from 'express';
import { createXltToken, ignoreAuth, xltMiddleware } from '@xlt-token/express';

const api = express.Router();
const xlt = createXltToken();
// ---cut---
api.use(xltMiddleware(xlt));

// 不推荐：ignoreAuth 在 xltMiddleware 之后执行，无法影响本次鉴权。
api.get('/public', ignoreAuth(), (_req, res) => {
  res.json({ ok: true });
});
```

Router 级接入时，优先使用 `policies`。route helper 适合少量单路由显式链式声明。

## 读取登录状态

登录校验成功后，适配器会把 core 写入的请求状态同步到 Express `req`。

```ts twoslash [src/profile.ts]
import express from 'express';

const api = express.Router();
// ---cut---
api.get('/me', (req, res) => {
  res.json({
    loginId: req.stpLoginId,
    token: req.stpToken,
  });
});
```

TypeScript 项目可以直接读取这些字段，因为适配器会声明 Express `Request` 类型增强。字段类型如下：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `req.stpLoginId` | `string | undefined` | 当前登录 ID |
| `req.stpToken` | `string | undefined` | 当前请求解析出的 token |
| `req._xltRouteMeta` | `RouteAuthMeta | undefined` | 当前请求的鉴权元数据 |
| `req._xltState` | `Record<string, unknown> | undefined` | `HttpContext.state` 的 Express 挂载点 |

## Session

`XltSession` 按 loginId 保存业务数据。登录校验通过后，从 `req.stpLoginId` 创建当前用户
Session：

```ts twoslash [src/profile.ts]
import express from 'express';
import { createXltToken } from '@xlt-token/express';

const xlt = createXltToken();
const api = express.Router();
// ---cut---
api.put('/profile/theme', async (req, res) => {
  const session = xlt.stpLogic.getSession(req.stpLoginId!);
  await session.set('theme', String(req.body.theme));
  res.json({ ok: true });
});

api.get('/profile/theme', async (req, res) => {
  const session = xlt.stpLogic.getSession(req.stpLoginId!);
  const theme = await session.get<string>('theme');
  res.json({ theme });
});
```

不要跨请求缓存 `XltSession` 实例。它会缓存首次读取的数据，每个请求重新调用
`getSession()` 才能看到其他请求的更新。Redis Store 会让 Session 在多个 Express
实例间共享。

## 二级认证

`safeBusiness` 会在登录成功后调用 `stpLogic.checkSafe(token, business)`。用户需要先打开对应业务的安全窗口。

```ts twoslash [src/pay.ts]
import express from 'express';
import { createXltToken } from '@xlt-token/express';

const xlt = createXltToken();
const api = express.Router();
// ---cut---
api.post('/auth/open-pay-safe', async (req, res) => {
  await xlt.stpLogic.openSafe(req.stpToken!, 'pay', 300);
  res.json({ ok: true });
});

api.post('/pay', (_req, res) => {
  res.json({ ok: true });
});
```

使用策略表声明二级认证：

```ts twoslash [src/pay-policy.ts]
import express from 'express';
import { createXltToken, xltMiddleware } from '@xlt-token/express';

const xlt = createXltToken();
const api = express.Router();
// ---cut---
api.use(
  xltMiddleware(xlt, {
    policies: [{ match: '/api/pay', methods: ['POST'], safeBusiness: 'pay' }],
  }),
);
```

## 错误响应

`xltErrorHandler()` 会处理 core 抛出的鉴权异常。非 xlt-token 异常会继续传给后续错误处理中间件。

| 异常 | HTTP 状态码 | `code` |
| --- | --- | --- |
| `NotLoginException` | `401` | `NOT_LOGIN` |
| `NotPermissionException` | `403` | `NOT_PERMISSION` |
| `NotRoleException` | `403` | `NOT_ROLE` |
| `NotSafeException` | `403` | `NOT_SAFE` |

未携带 token 时，响应体类似下面这样：

```json
{
  "statusCode": 401,
  "code": "NOT_LOGIN",
  "type": "NOT_TOKEN",
  "message": "未提供 Token"
}
```

你也可以不用 `xltErrorHandler()`，改为在自己的错误中间件中识别 core 异常并返回统一响应。

自定义处理器必须保留四参数签名，否则 Express 不会把它识别为错误处理中间件：

```ts twoslash [src/error-handler.ts]
import type { ErrorRequestHandler } from 'express';
import { XltError } from '@xlt-token/express';

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof XltError) {
    res.status(error.status).json({
      code: error.code,
      message: error.message,
    });
    return;
  }

  next(error);
};
```

Redis 连接失败不是 `XltError`。应继续交给基础设施错误处理和监控，不能返回
`NOT_LOGIN`。

## 客户端验证

启动应用后，可以用下面的请求验证完整流程：

```bash
# 登录并从响应中复制 token
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userId":"1001"}'

TOKEN='<登录响应中的 token>'

# 读取当前用户
curl http://localhost:3000/api/me \
  -H "Authorization: Bearer $TOKEN"

# 登出
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"

# 旧 token 应返回 401
curl -i http://localhost:3000/api/me \
  -H "Authorization: Bearer $TOKEN"
```

命令假设默认 `tokenPrefix: 'Bearer '`。示例最小应用把前缀配置为空时，应把 Header
改为 `Authorization: $TOKEN`。

## 应用关闭

MemoryStore 不需要关闭。使用 Redis 时，先停止接收新请求，等待已有请求结束，再关闭
客户端：

```ts twoslash [src/main.ts]
import { app } from './app';
import { redisClient } from './redis';

const server = app.listen(3000);

process.once('SIGTERM', () => {
  server.close(async () => {
    await redisClient.quit();
  });
});
```

生产环境还应处理 `SIGINT`，并为关停设置平台允许的最大等待时间。

## 生产建议

- 在反向代理后部署时，按项目需要配置 `trust proxy`，但不要信任客户端伪造的身份头。
- `xltMiddleware()` 应挂在需要保护的 Router 上，避免静态资源和健康检查产生额外
  Store 请求。
- `ignore` 和 `policies` 使用应用实际看到的路径；Router 挂载前缀会影响匹配结果，
  应通过 e2e 测试确认。
- 多实例使用 Redis Store；MemoryStore 只适合单进程和测试。
- 权限列表来自外部服务时，合理设置 `permCacheTimeout`，并设计权限变更后的失效策略。
- 错误日志不要记录完整 token。需要关联请求时记录 token 摘要或业务 trace ID。

## 常见问题

### 登录接口返回 401

登录路由被默认黑名单策略保护。把路径加入 `ignore`，或在同一路由链中把
`ignoreAuth()` 放在 `xltMiddleware()` 前。

### route helper 不生效

helper 在 `xltMiddleware()` 之后执行，元数据写入太晚。调整 route chain 顺序，或改用
Router 级 `policies`。

### `req.stpLoginId` 是 `undefined`

当前路由没有经过成功的登录校验，或者业务处理器运行在 middleware 之前。确认
`xltMiddleware()` 的挂载位置和 `defaultCheck` 配置。

### 自定义错误处理中间件不执行

确认函数有 `(error, req, res, next)` 四个参数，并且注册在路由之后。

## API 参考

| API | 说明 |
| --- | --- |
| `createExpressContext(req, res)` | 把 Express 请求和响应桥接为 `HttpContext` |
| `xltMiddleware(xlt, options?)` | 执行登录、权限、角色和二级认证校验 |
| `xltErrorHandler()` | 把 core 异常映射为 Express JSON 响应 |
| `ignoreAuth()` | 当前 route chain 忽略登录校验 |
| `requireLogin()` | 当前 route chain 强制登录校验 |
| `checkPermission(permission, mode?)` | 当前 route chain 需要权限 |
| `checkRole(role, mode?)` | 当前 route chain 需要角色 |
| `checkSafe(business)` | 当前 route chain 需要二级认证安全窗口 |
| `runAuth(xlt, httpCtx, req)` | 高级 API：手动编排鉴权流程 |
| `shouldCheckLogin(req, config)` | 高级 API：判断当前请求是否需要登录 |
| `resolveRouteAuthMeta(req, options?)` | 高级 API：解析当前请求命中的策略元数据 |
| `syncExpressAuthState(req, httpCtx)` | 高级 API：把 `HttpContext.state` 同步到 Express `req` |

## 测试

Express 适配器包含单元测试和 e2e 测试。e2e 使用 `supertest` 验证真实 Express 请求链路。

```bash
pnpm --filter @xlt-token/express test
pnpm --filter @xlt-token/express test:e2e
pnpm --filter @xlt-token/express test:cov
pnpm --filter @xlt-token/express test:e2e:cov
```

`test:e2e` 会在本机临时监听端口，这是 `supertest` 的正常行为。

## 下一步

- 查看 [适配器总览](/adapters)，了解各框架的接入方式。
- 查看 [Core 配置参考](/core/configuration)，配置 token 名称、并发登录和有效期。
- 查看 [权限与会话](/core/permissions-and-session)，实现 `StpInterface`。
- 查看 [二级认证](/core/secondary-auth)，了解 safe 窗口和临时 token。
- 查看 [Redis Store 完整指南](/store-redis/)，配置生产多实例存储。
