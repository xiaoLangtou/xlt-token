## Why

xlt-token's JWT mode has critical gaps in its token lifecycle: `logout()` and `logoutByLoginId()` return `null` instead of revoking the JWT via blacklist, and `renewTimeout()` cannot refresh a JWT token's expiration. Multi-device logout semantics are inconsistent — `logoutByLoginId` only targets the `default` device, leaving other sessions alive, and there is no `logoutByDevice` counterpart to `kickoutByDevice`. Publishing declarations are inaccurate: `jsonwebtoken` and `redis` are referenced in `peerDependenciesMeta` but missing from the actual `peerDependencies` list, causing silent install-time omissions for downstream consumers.

## What Changes

- **Fix `logout` in JWT mode**: `logout(token)` and `logoutByLoginId(loginId)` now write to the JWT blacklist (`jwt-blacklist:{jti}`) instead of returning null.
- **Add `logoutByDevice(loginId, device)`**: Public method for voluntarily logging out a specific device session, mirroring `kickoutByDevice` with `LOGOUT` semantics.
- **Fix `logoutByLoginId` semantics**: Iterate all device sessions and revoke each one, rather than only the `default` device.
- **Add `refreshToken(token, timeout?)`**: Issue a new JWT, blacklist the old JWT's jti, update store entries with the new jti, return the fresh token.
- **Fix dependency declarations**: Add `jsonwebtoken` and `redis` to `peerDependencies` in both `packages/nestjs/package.json` and root `package.json` (where missing), keeping them as optional via `peerDependenciesMeta`.
- **Fix `renewTimeout` for JWT mode**: Renew store-side expiration for the session/JWT jti entries instead of returning null.

## Capabilities

### New Capabilities
- `jwt-token-refresh`: JWT token refresh mechanism — `refreshToken()` creates a new JWT, blacklists the old jti, and updates store references atomically.

### Modified Capabilities
<!-- No existing spec files to modify — this is the first spec-driven work. -->

## Impact

- `packages/core/src/auth/stp-logic.ts`: Fix `logout`, `logoutByLoginId`, `renewTimeout` for JWT mode; add `logoutByDevice`, add `refreshToken`.
- `packages/nestjs/package.json`: Add `jsonwebtoken`, `redis` to `peerDependencies`.
- Root `package.json`: Add `jsonwebtoken` to `peerDependencies`.
- Backward compatible for non-JWT users; JWT mode users get corrected behavior.
