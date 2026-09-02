# @xlt-token/fastify

[![Cloud Studio Template](https://cs-res.codehub.cn/common/assets/icon-badge.svg)](https://cloudstudio.net/a/35979106969571328?channel=share&sharetype=Markdown)

Fastify plugin adapter for xlt-token. It connects Fastify `request` / `reply` to `@xlt-token/core` and provides login checks, route policies, and JSON error handling through a `preHandler` hook.

The plugin only accepts an explicit `XltInstance`. It never reads the default instance or `StpUtil`, so multiple auth instances can coexist in the same process.

## Installation

```bash
pnpm add fastify @xlt-token/fastify
```

Cookie token source additionally requires `@fastify/cookie`:

```bash
pnpm add @fastify/cookie
```

## Quick Start

```ts
import Fastify from 'fastify';
import { createXltInstance, MemoryStore, XltMode } from '@xlt-token/fastify';
import { xltFastifyPlugin } from '@xlt-token/fastify';

const stpInterface = {
  getPermissionList: async (loginId: string) =>
    loginId === '1001' ? ['user:read', 'order:*'] : [],
  getRoleList: async (loginId: string) => (loginId === '1001' ? ['admin'] : []),
};

const instance = createXltInstance({
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

## Route Policies

Use `ignore` and `policies` in the plugin options. String matchers use path-segment prefix matching: `/api/public` matches `/api/public/docs` and `/api/public?from=web`, but it does not match `/api/publicity`. Every policy may also declare `methods` so it only applies to the listed HTTP methods.

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

## Per-Route config.xlt

The same metadata can be declared per route via Fastify route `config`. When both a policy and `config.xlt` match, `config.xlt` overrides simple fields and merges permission / role lists.

```ts
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

`defaultCheck: false` switches the instance to whitelist mode: routes are public unless they declare `requireLogin` (or permissions / roles / safeBusiness) through a policy or `config.xlt`.

## Cookie Token Source

Enable `isReadCookie` and register `@fastify/cookie` before the xlt-token plugin:

```ts
import cookie from '@fastify/cookie';

const instance = createXltInstance({
  config: { isReadCookie: true, isReadHeader: false },
});

const app = Fastify();
await app.register(cookie);
await app.register(xltFastifyPlugin, { instance });
```

Reading cookies relies on the synchronous `request.cookies` decorator provided by `@fastify/cookie` (v2.x synchronous cookie contract). If `isReadCookie` is enabled but the plugin is missing, the app fails fast on `ready()` with an explicit error.

To write the token back as a cookie, bridge the reply through `createFastifyContext`:

```ts
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

## Multiple Instances

Each plugin registration is bound to its own instance. Register scoped plugins to keep instances isolated:

```ts
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

## Error Handling

By default the plugin replies `401` / `403` JSON directly (same body shape as the Express / NestJS adapters). Set `propagateAuthErrors: true` to let a custom error handler own the response instead:

```ts
import { xltFastifyErrorHandler } from '@xlt-token/fastify';

await app.register(xltFastifyPlugin, { instance, propagateAuthErrors: true });
app.setErrorHandler(xltFastifyErrorHandler());
```

## Exports

- `xltFastifyPlugin`
- `xltFastifyErrorHandler`
- `createFastifyContext`
- `mapXltError`
- `runAuth`
- `matchPolicy`
- `mergeRouteAuthMeta`
- `resolveRouteAuthMeta`
- `resolveRouteConfigMeta`
- `shouldCheckLogin`
- `createXltInstance` / `MemoryStore` / `UuidStrategy` (re-exported from `@xlt-token/core`)

## Documentation

Read the full guide at <https://xiaolangtou.github.io/xlt-token/>.

## License

MIT
