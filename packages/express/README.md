# @xlt-token/express

Express middleware adapter for xlt-token. It connects Express `req` / `res` to `@xlt-token/core` and provides login checks, route policies, route helpers, and JSON error handling.

## Installation

```bash
pnpm add express @xlt-token/express
pnpm add -D @types/express
```

## Quick Start

```ts
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
      { match: '/api/order', permissions: { list: ['order:read'], mode: XltMode.AND } },
      { match: '/api/admin', roles: { list: ['admin'], mode: XltMode.AND } },
      { match: '/api/pay', methods: ['POST'], safeBusiness: 'pay' },
    ],
  }),
);

api.post('/auth/login', async (req, res) => {
  const { userId = '1001' } = req.body ?? {};
  const token = await xlt.stpLogic.login(userId);
  res.json({ token });
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

app.use('/api', api);
app.use(xltErrorHandler());

app.listen(3000);
```

## Route Policies

Use `ignore` and `policies` when mounting `xltMiddleware` globally or at router level. Policies run before authentication, so they are the recommended Express integration path.

```ts
api.use(
  xltMiddleware(xlt, {
    ignore: ['/api/auth/login'],
    policies: [
      { match: '/api/me', requireLogin: true },
      { match: '/api/order', permissions: { list: ['order:read'], mode: XltMode.AND } },
      { match: '/api/report', roles: { list: ['admin', 'ops'], mode: XltMode.OR } },
      { match: '/api/pay', methods: ['POST'], safeBusiness: 'pay' },
    ],
  }),
);
```

String matchers use path-segment prefix matching. `/api/public` matches `/api/public/docs` and `/api/public?from=web`, but it does not match `/api/publicity`.

## Route Helpers

The adapter also exports `ignoreAuth()`, `requireLogin()`, `checkPermission()`, `checkRole()`, and `checkSafe()`. These helpers must run before `xltMiddleware` in the same route chain.

```ts
app.get('/public', ignoreAuth(), xltMiddleware(xlt), (_req, res) => {
  res.json({ ok: true });
});

app.get('/order', checkPermission('order:read'), xltMiddleware(xlt), (_req, res) => {
  res.json({ ok: true });
});
```

Do not mount `api.use(xltMiddleware(xlt))` before route helpers and expect those helpers to affect the same request. Express runs middleware in registration order.

## Exports

- `createXltToken`
- `MemoryStore`
- `UuidStrategy`
- `StpLogic`
- `StpPermLogic`
- `StpUtil`
- `XltMode`
- `createExpressContext`
- `xltMiddleware`
- `xltErrorHandler`
- `ignoreAuth`
- `requireLogin`
- `checkPermission`
- `checkRole`
- `checkSafe`
- `runAuth`
- `shouldCheckLogin`
- `resolveRouteAuthMeta`
- `syncExpressAuthState`

## Documentation

Read the full guide at <https://xiaolangtou.github.io/xlt-token/adapters/express>.

## License

MIT
