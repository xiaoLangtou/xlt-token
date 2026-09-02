---
title: TypeScript Token 鉴权 Core 快速开始
description: 使用 @xlt-token/core 在自定义框架、脚本、Serverless、WebSocket 或测试中创建框架无关的 Token 鉴权运行时。
---

# Core 独立使用

`@xlt-token/core` 是框架无关的鉴权运行时。它不依赖 NestJS、Express 或任何 HTTP
服务器，可以直接用于脚本、自研框架、Serverless handler、WebSocket 网关和测试。

Core 负责 token 生命周期、登录态、权限、角色、Session、多端登录和二级认证。应用
负责两件事：

1. 创建并长期复用一个 `XltTokenContext`。
2. 把当前请求转换为 `HttpContext`，再调用 Core API。

## 安装

```bash
pnpm add @xlt-token/core
```

默认 Store 是进程内 `MemoryStore`，默认 Token Strategy 是 `UuidStrategy`，因此最小
使用不需要其他依赖。

## 创建鉴权实例

```ts twoslash [src/auth.ts]
import { createXltToken } from '@xlt-token/core';

export const xlt = createXltToken({
  config: {
    tokenName: 'authorization',
    tokenPrefix: 'Bearer ',
    timeout: '7d',
    activeTimeout: '30m',
    isConcurrent: true,
    isShare: true,
  },
});
```

`createXltToken()` 返回 `XltTokenContext`：

| 字段 | 作用 |
| --- | --- |
| `config` | 规范化后的完整配置 |
| `store` | 当前 `XltTokenStore` |
| `strategy` | 当前 `TokenStrategy` |
| `stpLogic` | 登录、校验、登出、多端、Session 和二级认证 |
| `stpPermLogic` | 权限与角色校验 |
| `stpUtil` | 指向同一实例的静态门面 |

在同一个进程中，建议显式传递 `xlt` 或 `stpLogic`。`StpUtil` 是全局静态门面，后一次
`createXltToken()` 会更新它引用的实例；多租户或同进程多配置场景不要依赖静态门面。

## 最小登录流程

登录只需要业务系统已经确认的 `loginId`。Core 不负责校验用户名和密码。

```ts twoslash
import { createMockHttpContext, createXltToken } from '@xlt-token/core';

const xlt = createXltToken();

// 账号密码校验由业务系统完成。
const token = await xlt.stpLogic.login('1001');

const ctx = createMockHttpContext({
  headers: {
    authorization: `Bearer ${token}`,
  },
});

const result = await xlt.stpLogic.checkLogin(ctx);

console.log(result.loginId); // "1001"
console.log(result.token); // 原始 token
console.log(ctx.state.stpLoginId); // "1001"
console.log(ctx.state.stpToken); // 原始 token
```

`login()` 返回不带前缀的 token。客户端发请求时根据配置拼接 `Bearer `。如果把
`tokenPrefix` 配置为空字符串，请求头直接发送 token。

## 登录选项

单次登录可以覆盖超时、设备和 token：

```ts
const token = await xlt.stpLogic.login('1001', {
  timeout: '2h',
  device: 'mobile',
});
```

| 选项 | 说明 |
| --- | --- |
| `timeout` | 本次登录有效期，支持秒数和 `30m`、`2h`、`7d` |
| `device` | 设备标识，默认 `default` |
| `token` | 使用业务指定 token；必须保证安全和唯一 |

并发、共享和多端行为由 `isConcurrent`、`isShare`、`deviceConcurrent` 共同决定，
详见 [多端登录](/core/multi-device)。

## 实现 `HttpContext`

Core 从 `HttpContext` 读取 header、cookie 和 query，并把登录结果写入请求级
`state`。适配器必须让同一次请求中的所有 Core 调用共享同一个 `state` 对象。

```ts twoslash [src/http-context.ts]
import type { CookieOptions, HttpContext } from '@xlt-token/core';

interface MyRequest {
  headers: Record<string, string | undefined>;
  cookies: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
  xltState?: Record<string, unknown>;
}

interface MyResponse {
  setHeader(name: string, value: string): void;
  setCookie(name: string, value: string, options?: CookieOptions): void;
}

export function createMyHttpContext(
  request: MyRequest,
  response: MyResponse,
): HttpContext {
  const state = request.xltState ??= {};

  return {
    headers: {
      get(name) {
        return request.headers[name.toLowerCase()] ?? null;
      },
    },
    cookies: {
      get(name) {
        return request.cookies[name] ?? null;
      },
    },
    query: {
      get(name) {
        return request.query[name] ?? null;
      },
    },
    state,
    setHeader(name, value) {
      response.setHeader(name, value);
    },
    setCookie(name, value, options) {
      response.setCookie(name, value, options);
    },
    raw() {
      return request;
    },
  };
}
```

### Header、Cookie 和 Query 顺序

`getTokenValue(ctx)` 按以下顺序读取：

1. Header：`isReadHeader: true`
2. Cookie：`isReadCookie: true`
3. Query：`isReadQuery: true`

前一种来源读到 token 后不会继续读取。Query token 容易进入访问日志和浏览器历史，
默认关闭；只有协议无法设置 header 或 cookie 时才建议开启。

## 在请求处理器中校验

自定义框架的 middleware 可以保持下面的结构：

```ts twoslash [src/auth-middleware.ts]
import {
  NotLoginException,
  type HttpContext,
  type XltTokenContext,
} from '@xlt-token/core';

export async function authenticate(
  xlt: XltTokenContext,
  ctx: HttpContext,
) {
  try {
    const auth = await xlt.stpLogic.checkLogin(ctx);
    return {
      loginId: auth.loginId!,
      token: auth.token!,
    };
  }
  catch (error) {
    if (error instanceof NotLoginException) {
      return {
        status: error.status,
        code: error.code,
        type: error.type,
        message: error.message,
      };
    }
    throw error;
  }
}
```

Store 连接错误、JSON 解析错误等基础设施异常不属于 `NotLoginException`，必须继续
抛出并交给应用的统一错误处理器。不要把所有异常都转换成 401。

## 登出、踢人和续期

```ts
await xlt.stpLogic.logout(token);
await xlt.stpLogic.logoutByLoginId('1001');

await xlt.stpLogic.kickout('1001', 'mobile');
await xlt.stpLogic.kickoutByToken(token);

await xlt.stpLogic.renewTimeout(token, '12h');
```

`logout` 删除正常登录态；`kickout` 会记录被踢状态，使旧 token 校验时得到
`KICK_OUT`。同设备顶号会得到 `BE_REPLACED`。完整状态含义见
[异常处理](/core/exceptions)。

## 权限与角色

创建实例时传入 `StpInterface`。Core 在需要校验时按 loginId 获取权限和角色：

```ts twoslash [src/auth.ts]
import { createXltToken, XltMode } from '@xlt-token/core';

const xlt = createXltToken({
  config: {
    permCacheTimeout: '5m',
  },
  stpInterface: {
    async getPermissionList(loginId) {
      return loginId === '1001'
        ? ['user:read', 'order:*']
        : [];
    },
    async getRoleList(loginId) {
      return loginId === '1001' ? ['admin'] : [];
    },
  },
});

await xlt.stpPermLogic.checkPermission(
  '1001',
  ['order:read', 'user:read'],
  XltMode.AND,
);

await xlt.stpPermLogic.checkRole(
  '1001',
  ['admin', 'ops'],
  XltMode.OR,
);
```

权限支持 `order:*` 形式的通配匹配，角色使用精确匹配。`permCacheTimeout: 0` 表示不
缓存；正数表示缓存秒数；`-1` 表示永久缓存。权限变化需要立即生效时应关闭缓存或主动
删除对应缓存键。

## Session

Session 按 loginId 保存业务数据，与单个 HTTP 请求无关：

```ts
const session = xlt.stpLogic.getSession('1001');

await session.set('displayName', 'Alice');
await session.set('tenantId', 'tenant-a');

const displayName = await session.get<string>('displayName');
const keys = await session.keys();

await session.remove('tenantId');
await session.clear();
```

一个 `XltSession` 实例会缓存首次读取的数据。跨请求不要长期复用同一个 Session
对象，否则可能看不到其他请求写入的新值；每次业务操作重新调用 `getSession()`。

## 二级认证

用户完成密码、短信或 WebAuthn 等二次校验后，打开业务安全窗口：

```ts
await xlt.stpLogic.openSafe(token, 'payment', '5m');
await xlt.stpLogic.checkSafe(token, 'payment');
await xlt.stpLogic.closeSafe(token, 'payment');
```

Core 只记录安全窗口，不执行真实的二次验证。应用必须先验证用户提交的凭据，再调用
`openSafe()`。详细流程见 [二级认证](/core/secondary-auth)。

## 切换 Redis Store

Core 可以直接使用独立的 Redis Store，不需要任何框架适配器：

```ts twoslash [src/auth.ts]
import { createXltToken } from '@xlt-token/core';
import { RedisStore } from '@xlt-token/store-redis';
import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
});
client.on('error', console.error);
await client.connect();

export const xlt = createXltToken({
  store: new RedisStore(client),
});
```

客户端生命周期、ioredis、Sentinel、Cluster 和生产配置见
[Redis Store 完整指南](/store-redis/)。

## 可运行的脚本示例

创建 `src/demo.ts`：

```ts twoslash [src/demo.ts]
import {
  createMockHttpContext,
  createXltToken,
  NotLoginException,
} from '@xlt-token/core';

const xlt = createXltToken({
  config: {
    tokenName: 'authorization',
    tokenPrefix: 'Bearer ',
    timeout: '1h',
  },
});

const token = await xlt.stpLogic.login('1001');
console.log('token:', token);

const ctx = createMockHttpContext({
  headers: {
    authorization: `Bearer ${token}`,
  },
});

const auth = await xlt.stpLogic.checkLogin(ctx);
console.log('loginId:', auth.loginId);

await xlt.stpLogic.logout(token);

try {
  await xlt.stpLogic.checkLogin(ctx);
}
catch (error) {
  if (error instanceof NotLoginException) {
    console.log('after logout:', error.type);
  }
  else {
    throw error;
  }
}
```

使用项目已有的 TypeScript 执行器运行，例如：

```bash
pnpm add -D tsx
pnpm exec tsx src/demo.ts
```

预期依次看到 token、`loginId: 1001` 和登出后的 `INVALID_TOKEN`。项目已经有其他
TypeScript 执行器时无需安装 `tsx`，也不需要为 xlt-token 启动 HTTP 服务。

## 测试建议

单元测试使用 `MemoryStore` 和 `createMockHttpContext()`，每个测试重新创建实例：

```ts
it('logs in and authenticates a request', async () => {
  const xlt = createXltToken();
  const token = await xlt.stpLogic.login('1001');
  const ctx = createMockHttpContext({
    headers: { authorization: `Bearer ${token}` },
  });

  await expect(xlt.stpLogic.checkLogin(ctx)).resolves.toMatchObject({
    loginId: '1001',
  });
});
```

Redis 集成测试应使用独立 database 或唯一 `tokenName`，并在测试结束后清理键和关闭
客户端。

## 下一步

- 完整配置字段：[配置参考](/core/configuration)
- 登录、登出和状态 API：[核心 API](/core/core-api)
- 权限、角色和 Session：[权限与会话](/core/permissions-and-session)
- Store 契约和自定义实现：[Store 契约与内存存储](/core/storage)
- 分布式登录态：[Redis Store 完整指南](/store-redis/)
- 使用 NestJS：[NestJS 快速开始](/adapters/nestjs/getting-started)
- 使用 Express：[Express 完整指南](/adapters/express)
