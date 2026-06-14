## Context

xlt-token has two token modes: UUID-based (stateful, stores token→loginId in the store) and JWT-based (stateless JWT, with a jti-based blacklist for revocation). Currently, several lifecycle operations (`logout`, `logoutByLoginId`, `renewTimeout`) were implemented against the UUID mode only and silently fail (return null) in JWT mode. The multi-device logout semantic is also inconsistent: `logoutByLoginId` only targets the `default` device, while `kickoutByDevice` accepts an explicit device parameter — there's no voluntary `logoutByDevice` counterpart. On the publishing side, `jsonwebtoken` and `redis` are referenced in `peerDependenciesMeta` as optional but are absent from the `peerDependencies` list in both root and nestjs packages, violating the npm specification.

## Goals / Non-Goals

**Goals:**
- `logout(token)` and `logoutByLoginId(loginId)` work correctly in JWT mode by writing to the jti blacklist.
- `logoutByLoginId` revokes all device sessions, not just the default device.
- New `logoutByDevice(loginId, device)` method mirrors `kickoutByDevice` with voluntary-logout semantics.
- New `refreshToken(token, timeout?)` method that issues a new JWT, blacklists the old jti, and updates store references.
- `renewTimeout` works in JWT mode by refreshing store entries linked to the jti.
- `peerDependencies` correctly lists `jsonwebtoken` (^9.0.0) and `redis` (^4.0.0 || ^5.0.0) where used at runtime, all marked optional via `peerDependenciesMeta`.

**Non-Goals:**
- No JWT auto-refresh middleware or interceptor (the caller explicitly requests refresh).
- No changes to the UUID token mode behavior.
- No changes to the `TokenStrategy` interface (it remains framework-agnostic).
- No addition of a new JWT library (keep using `jsonwebtoken`).
- No Redis client type improvements beyond what's needed for correctness.

## Decisions

1. **JWT logout via jti blacklist**: In JWT mode, `logout(token)` will parse the JWT to extract `jti`, write `jti` to `jwt-blacklist:{jti}` with reason `LOGOUT`, and clean up session entries. This is consistent with how `kickout` and `kickoutByDevice` already work. Alternative considered: deleting the session store entry only — rejected because a valid (non-expired) JWT could still be presented and would pass signature verification.

2. **`logoutByLoginId` iterates all devices**: Change from single-device to multi-device logout by fetching the `session-list:{loginId}` and iterating. The method name is ambiguous in the current code (it says "by loginId" but only logs out default device). This aligns with the intuitive expectation that logging out "by loginId" means all sessions for that user.

3. **`logoutByDevice` reuses `kickoutByDevice` internals**: The implementation will be structurally similar to `kickoutByDevice` but using `LOGOUT` as the reason instead of `KICK_OUT`. A new `NotLoginType.LOGOUT` constant could be added for observability, but existing `INVALID_TOKEN` is already sufficient since the store entry is deleted. For the blacklist, we'll use the existing mechanisms.

4. **`refreshToken` as an explicit method**: Not an auto-refresh, since that would require background timers or proxy logic. The caller invokes refresh when they detect a token is near expiry. The method:
   - Verifies the current JWT (must still be valid or recently expired — grace window configurable)
   - Extracts `loginId` and `jti`
   - Blacklists the old `jti`
   - Creates a new JWT with a fresh `jti`
   - Updates session store entries with the new `jti`
   - Returns the new token

5. **`renewTimeout` in JWT mode**: Instead of looking up `tokenKey` (which doesn't exist in JWT mode), it will look up `sessionKey` to get the jti, then update store TTLs for `sessionKey`, `lastActiveKey`, and `jwt-blacklist` expiration (if the token was blacklisted, extending its validity via an extended blacklist TTL would be wrong — but for non-blacklisted active tokens, it extends the session store TTL). The key insight: in JWT mode the JWT itself has a fixed `exp` claim; `renewTimeout` cannot change that. It can only extend the store-side TTL of the session mapping. This is a best-effort operation and will be documented as such.

6. **Dependency declarations pattern**: Follow pnpm/npm convention: all runtime-used packages are in `peerDependencies`; those that are optional are additionally in `peerDependenciesMeta` with `optional: true`. This ensures `npm install` / `pnpm add` warns appropriately and tooling understands the dependency graph.

## Risks / Trade-offs

- **[JWT refresh + exp claim]** The JWT's embedded `exp` claim is immutable once issued. `refreshToken` is the only way to get a new `exp`. `renewTimeout` only affects store-side TTL (session mapping), not the JWT crypto validity. This is by design and will be documented.
- **[Blacklist growth]** Each `logout`/`kickout`/`refreshToken` adds an entry to the JWT blacklist. The blacklist entries have a TTL equal to the original token's timeout, so they auto-clean. Under high refresh rates this is fine. No new concern.
- **[Backward compatibility]** All changes are additive or fix broken behavior (JWT `logout` returning null). Existing UUID mode users see zero behavioral change. No breaking API changes.
