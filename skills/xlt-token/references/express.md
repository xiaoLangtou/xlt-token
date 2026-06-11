# Express Adapter

Use `@xlt-token/express` for Express applications. It exports the core APIs plus Express middleware, route helpers, and an error handler.

## Basic Setup

```ts
import express from 'express'
import { createXltToken, MemoryStore, xltErrorHandler, xltMiddleware } from '@xlt-token/express'

const xlt = createXltToken({
  config: {
    tokenName: 'authorization',
    tokenPrefix: 'Bearer ',
    timeout: 60 * 60 * 24 * 7,
    defaultCheck: true
  },
  store: new MemoryStore()
})

const app = express()
app.use(express.json())
app.use(xltMiddleware(xlt, {
  ignore: ['/auth/login', '/public']
}))

app.use(xltErrorHandler())
```

## Login Route

```ts
app.post('/auth/login', async (req, res) => {
  const user = await validateUser(req.body)
  const token = await xlt.stpLogic.login(user.id, { device: req.body.device ?? 'web' })
  res.json({ token })
})

app.get('/auth/me', (req, res) => {
  res.json({ loginId: req.stpLoginId, token: req.stpToken })
})
```

`xltMiddleware` syncs auth state to:

- `req.stpLoginId`
- `req.stpToken`
- `req._xltState`

## DurationInput

All timeout fields in `createXltToken({ config })` and `login({ timeout })`, `renewTimeout`, `openSafe`, `createTempToken` accept `DurationInput`: number (seconds) or relative string like `'30s'`, `'15m'`, `'2h'`, `'7d'`, `'2w'`.

```ts
const xlt = createXltToken({
  config: {
    timeout: '7d',
    activeTimeout: '30m',
  }
})
```

## Route Policies

Use policies when route metadata must be known before the auth middleware runs:

```ts
app.use(xltMiddleware(xlt, {
  ignore: ['/auth/login', '/public'],
  policies: [
    { match: '/admin', roles: { list: ['admin'], mode: XltMode.AND } },
    { match: '/orders', permissions: { list: ['order:read'], mode: XltMode.AND } },
    { match: '/pay', methods: ['POST'], safeBusiness: 'pay' }
  ]
}))
```

String matchers use exact or path-prefix matching. `/api/public` matches `/api/public` and `/api/public/x`, but not `/api/publicity`.

## Guard Modes

`defaultCheck: true`: every route requires login unless ignored.

`defaultCheck: false`: only routes with `requireLogin` require login.

```ts
app.use(xltMiddleware(xlt, {
  policies: [
    { match: '/account', requireLogin: true }
  ]
}))
```

## Route Helpers

Route helpers write metadata to `req._xltRouteMeta`:

```ts
import { checkPermission, checkRole, checkSafe, ignoreAuth, requireLogin } from '@xlt-token/express'

app.get('/public', ignoreAuth(), handler)
app.get('/account', requireLogin(), handler)
app.get('/orders', checkPermission('order:read'), handler)
app.get('/admin', checkRole('admin'), handler)
app.post('/pay', checkSafe('pay'), handler)
```

Prefer `policies` for global middleware setups because policies are resolved before auth. Helpers are useful in composed route chains where metadata is available before auth runs.

## Error Handler

Mount `xltErrorHandler()` after routes. It maps core exceptions to JSON:

- `NotLoginException`: 401 with `code: "NOT_LOGIN"`
- `NotPermissionException`: 403 with `code: "NOT_PERMISSION"`
- `NotRoleException`: 403 with `code: "NOT_ROLE"`
- `NotSafeException`: 403 with `code: "NOT_SAFE"`

Non-xlt-token errors pass through to the next error handler.
