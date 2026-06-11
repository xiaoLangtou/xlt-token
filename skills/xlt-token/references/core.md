# Core Usage

Use `@xlt-token/core` when the user needs framework-agnostic auth logic, a custom adapter, or direct access to `StpLogic`.

## Setup

```ts
import { createXltToken, MemoryStore } from '@xlt-token/core'

const xlt = createXltToken({
  config: {
    tokenName: 'authorization',
    tokenPrefix: 'Bearer ',
    timeout: 60 * 60 * 24 * 7,
    defaultCheck: true
  },
  store: new MemoryStore()
})
```

`createXltToken()` returns `config`, `store`, `strategy`, `stpLogic`, `stpPermLogic`, and `stpUtil`. It also initializes the static `StpUtil` facade.

## Request Context

The core engine reads HTTP data through `HttpContext`, not framework request types. Use `createExpressContext(req, res)` for Express-like objects, or implement `HttpContext` for custom frameworks.

Core writes request state to:

- `ctx.state.stpLoginId`
- `ctx.state.stpToken`
- `ctx.state.stpSession` when used by adapters

## Login State

```ts
const token = await xlt.stpLogic.login(user.id, { device: 'web' })
const result = await xlt.stpLogic.checkLogin(httpCtx)
await xlt.stpLogic.logout(token)
```

`loginId` must be a non-empty string or number and cannot contain `:`.

All timeout parameters accept `DurationInput`: a number (seconds), or a string like `'30s'`, `'15m'`, `'2h'`, `'7d'`, `'2w'`. Special values `0` (immediate) and `-1` (never) are accepted as numbers only. This applies to `config.timeout`, `config.activeTimeout`, `config.permCacheTimeout`, `config.offlineRecordTimeout`, `login({ timeout })`, `renewTimeout(token, timeout)`, `openSafe(token, biz, timeout)`, and `createTempToken(value, timeout)`.

## Token Reading

Default config reads the token from the `authorization` header and strips the `Bearer ` prefix.

Useful config:

```ts
{
  tokenName: 'authorization',
  tokenPrefix: 'Bearer ',
  isReadHeader: true,
  isReadCookie: false,
  isReadQuery: false
}
```

## Multi-Device Semantics

`device` defaults to `default`.

- `deviceConcurrent: false`: a new login kicks all devices for the same login id.
- `isConcurrent: false`: a new login replaces the old token for the same device.
- `isConcurrent: true, isShare: true`: reuse the existing token for the same device.
- `isConcurrent: true, isShare: false`: create a new token while old tokens remain valid.

Useful APIs:

```ts
await xlt.stpLogic.getDeviceList(loginId)
await xlt.stpLogic.kickoutByDevice(loginId, 'web')
await xlt.stpLogic.kickoutByToken(token)
await xlt.stpLogic.forceLogout(loginId)
```

## Permissions And Roles

Register `stpInterface`:

```ts
const xlt = createXltToken({
  stpInterface: {
    async getPermissionList(loginId) {
      return ['user:read', 'order:*']
    },
    async getRoleList(loginId) {
      return ['admin']
    }
  }
})
```

Use `StpPermLogic` or `StpUtil`:

```ts
await xlt.stpPermLogic.checkPermission(loginId, ['order:create'], XltMode.AND)
await xlt.stpPermLogic.checkRole(loginId, ['admin'], XltMode.AND)
```

Permission wildcard matching supports patterns like `order:*` and `*`.

## Sessions

`XltSession` stores JSON data under the login id and follows token timeout semantics:

```ts
const session = xlt.stpLogic.getSession(loginId)
await session.set('profile', { name: 'Ada' })
const profile = await session.get('profile')
```

## Secondary Authentication

Use safe windows for sensitive operations:

```ts
await xlt.stpLogic.openSafe(token, 'pay', 300)
await xlt.stpLogic.checkSafe(token, 'pay')
await xlt.stpLogic.closeSafe(token, 'pay')
```

## Temporary Tokens

```ts
const tempToken = await xlt.stpLogic.createTempToken('invite:123', 600)
const value = await xlt.stpLogic.parseTempToken(tempToken)
await xlt.stpLogic.deleteTempToken(tempToken)
```

## Hooks

Use hooks for audit logging and observability:

```ts
createXltToken({
  hooks: {
    onLogin(loginId, token, device) {},
    onLogout(loginId, token, reason) {},
    onKickout(loginId, token) {},
    onReplaced(loginId, oldToken, newToken) {}
  }
})
```

Hook errors are caught and logged; they do not block auth flows.
