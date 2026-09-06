# Fastify Adapter

Use `@xlt-token/fastify` with Fastify 4 or 5. The adapter binds a Fastify plugin to an explicit
`XltInstance`; it does not read `StpUtil` or the default instance.

## Setup

```ts
import Fastify from 'fastify'
import { createXltInstance } from '@xlt-token/core'
import { xltFastifyPlugin } from '@xlt-token/fastify'

const instance = createXltInstance({
  config: { tokenPrefix: '' },
  stpInterface: {
    getPermissionList: async () => ['order:read'],
    getRoleList: async () => ['user'],
  },
})

const app = Fastify()
await app.register(xltFastifyPlugin, {
  instance,
  ignore: ['/auth/login', '/public'],
  policies: [
    { match: '/orders', permissions: { list: ['order:read'], mode: 'AND' } },
    { match: '/pay', methods: ['POST'], safeBusiness: 'pay' },
  ],
})
```

With the default `defaultCheck: true`, every route is protected except `ignore` routes. With
`defaultCheck: false`, routes are public until a policy or `config.xlt` sets `requireLogin`.

## Route Metadata

Use plugin `policies` for prefix, regex, method, or request-function matching. Use `config.xlt`
for a single route. When both match, route metadata overrides simple fields and merges permission
and role lists.

```ts
app.get('/orders', {
  config: { xlt: { permissions: { list: ['order:read'], mode: 'AND' } } },
}, async (request) => ({ loginId: request.stpLoginId }))

app.get('/health', {
  config: { xlt: { ignore: true } },
}, async () => ({ ok: true }))
```

After authentication, the plugin writes `request.stpLoginId`, `request.stpToken`, and lazy
`request.stpSession`. Route handlers should use the bound `instance.stpLogic` for login, logout,
refresh, and session operations.

## Cookies And Errors

When `config.isReadCookie` is enabled, register `@fastify/cookie` before `xltFastifyPlugin`.
The plugin verifies this at `ready()` time. Use `createFastifyContext(request, reply).setCookie()`
to write a token cookie.

By default auth failures receive adapter JSON responses. Set `propagateAuthErrors: true` and install
`app.setErrorHandler(xltFastifyErrorHandler())` when the application owns the error response shape.
