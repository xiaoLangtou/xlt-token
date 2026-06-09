# Recipes

## Login And Logout

Validate credentials in application code, then call `login`:

```ts
const token = await StpUtil.login(user.id, { device: 'web' })
```

Logout by token:

```ts
await StpUtil.logout(token)
```

Logout all or selected sessions:

```ts
await StpUtil.logoutByLoginId(loginId)
await StpUtil.kickoutByDevice(loginId, 'web')
await StpUtil.kickoutByToken(token)
await StpUtil.forceLogout(loginId)
```

## Header Format

Default config expects:

```txt
Authorization: Bearer <token>
```

The login API returns only `<token>`, not the `Bearer ` prefix.

## Token States

`NotLoginException.type` can be:

- `NOT_TOKEN`: no token was provided
- `INVALID_TOKEN`: token is missing from store or failed verification
- `TOKEN_TIMEOUT`: active timeout expired
- `TOKEN_FREEZE`: active timeout metadata is missing
- `BE_REPLACED`: token was replaced by a newer login
- `KICK_OUT`: token was kicked out

Enable offline records when the application needs to show why a user was disconnected:

```ts
{
  offlineRecordEnabled: true,
  offlineRecordTimeout: 3600
}
```

Then query:

```ts
await StpUtil.getOfflineReason(token)
```

## Multi-Device Login

Use devices such as `web`, `mobile`, `admin`, or `default`:

```ts
const token = await StpUtil.login(user.id, { device: 'mobile' })
```

Recommended profiles:

- Single active session per account: `deviceConcurrent: false`
- One token per device: `deviceConcurrent: true`, `isConcurrent: false`
- Multiple independent sessions: `deviceConcurrent: true`, `isConcurrent: true`, `isShare: false`
- Shared token per device: `deviceConcurrent: true`, `isConcurrent: true`, `isShare: true`

## Secondary Authentication

Use for payments, account deletion, secret export, and other sensitive operations:

```ts
await StpUtil.openSafe(token, 'pay', 300)
await StpUtil.checkSafe(token, 'pay')
await StpUtil.closeSafe(token, 'pay')
```

NestJS:

```ts
@XltCheckSafe('pay')
@Post('transfer')
transfer() {}
```

Express:

```ts
{ match: '/transfer', methods: ['POST'], safeBusiness: 'pay' }
```

## Temporary Tokens

Use temporary tokens for invite links, one-time actions, or short-lived verification flows:

```ts
const tempToken = await StpUtil.createTempToken('invite:123', 600)
const value = await StpUtil.parseTempToken(tempToken)
await StpUtil.deleteTempToken(tempToken)
```

## Online Users

```ts
const ids = await StpUtil.getOnlineLoginIds({ page: 0, pageSize: 50 })
const count = await StpUtil.getOnlineCount()
const devices = await StpUtil.getDeviceList(loginId)
```

These APIs depend on the store's `keys(pattern)` implementation. MemoryStore and RedisStore support it.

## Production Checklist

- Use RedisStore or another shared store when running multiple server instances.
- Set a strong JWT secret if using JwtStrategy.
- Do not store passwords, secrets, or large user profiles in `XltSession`.
- Keep permission names stable and hierarchical, such as `user:read`, `user:write`, `order:*`.
- Use `permCacheTimeout` when permission lookups hit a database frequently.
- Add an application-level exception filter or error handler if the default JSON shape needs to match existing APIs.
