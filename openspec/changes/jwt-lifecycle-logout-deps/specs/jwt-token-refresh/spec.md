## ADDED Requirements

### Requirement: JWT token refresh

The system SHALL provide a `refreshToken(token, timeout?)` method on `StpLogic` that replaces an existing JWT with a new one, invalidating the old JWT via the jti blacklist.

The method MUST:
- Accept the current JWT string and an optional new `timeout` duration
- Verify the current JWT is valid (not expired, not already blacklisted)
- Extract `loginId` and `jti` from the current JWT
- Write the old `jti` to the JWT blacklist with a reason (e.g., `TOKEN_REFRESH`)
- Clear old store entries referencing the old `jti` (lastActiveKey, sessionKey jti reference)
- Generate a new JWT with a fresh `jti` via the configured `TokenStrategy`
- Update session store entries to reference the new `jti` 
- Return the new JWT string

#### Scenario: Successful refresh of valid JWT
- **WHEN** a valid JWT is passed to `refreshToken(token)`
- **THEN** a new JWT is returned with a different `jti`
- **AND** the old JWT's `jti` is written to the blacklist
- **AND** the new JWT passes `isLogin` / `checkLogin`

#### Scenario: Refresh of already-blacklisted JWT
- **WHEN** a JWT that has been blacklisted is passed to `refreshToken(token)`
- **THEN** the method returns `null` or raises an appropriate error

#### Scenario: Refresh of expired JWT
- **WHEN** a JWT whose `exp` claim is in the past is passed to `refreshToken(token)`
- **THEN** the method returns `null` (expired JWT cannot be verified)

#### Scenario: Refresh with custom timeout
- **WHEN** `refreshToken(token, '7d')` is called with a custom timeout
- **THEN** the new JWT's `exp` claim reflects the custom timeout
- **AND** the store-side session TTL is set to the custom timeout

### Requirement: JWT mode logout

In JWT mode, `logout(token)` SHALL extract the JWT payload to get `jti`, write `jti` to the JWT blacklist, and clear session-related store entries, instead of returning null.

`logoutByLoginId(loginId)` in JWT mode SHALL iterate all device sessions listed in `session-list:{loginId}`, extract each token's `jti`, blacklist each `jti`, and clean up store entries for all devices.

#### Scenario: JWT mode logout by token
- **WHEN** `logout(token)` is called with a valid JWT token
- **THEN** the JWT is added to the blacklist
- **AND** subsequent `isLogin` requests with that token return false with reason `INVALID_TOKEN`
- **AND** the session store entries for the token are cleared

#### Scenario: JWT mode logout by loginId (multi-device)
- **WHEN** `logoutByLoginId(loginId)` is called and the user has 2 active devices (pc, app)
- **THEN** both device sessions are terminated
- **AND** both tokens are added to the blacklist
- **AND** the user's online count decreases accordingly

### Requirement: Voluntary device logout

The system SHALL provide a `logoutByDevice(loginId, device)` method on `StpLogic` that voluntarily terminates a specific device session.

The method MUST:
- Look up the session for the given `loginId` and `device`
- In JWT mode: blacklist the token's jti
- In UUID mode: update the token store entry to indicate invalidation
- Remove the session from the session list
- Remove the device entry from `session-list`
- Fire the `onLogout` hook

#### Scenario: Logout specific device while others remain
- **WHEN** `logoutByDevice('user1', 'pc')` is called and the user has pc and app sessions
- **THEN** the pc session is terminated
- **AND** the app session remains valid
- **AND** subsequent `isLogin` with the pc token returns false
- **AND** `isLogin` with the app token returns true

### Requirement: JWT mode renewTimeout

In JWT mode, `renewTimeout(token, timeout)` SHALL extend the TTL of store entries associated with the token's jti (session mapping, last active, etc.), instead of returning null.

The JWT's embedded `exp` claim cannot be changed; this only affects store-side expiration for session lookup and activity tracking.

#### Scenario: renewTimeout extends session TTL in JWT mode
- **WHEN** `renewTimeout(token, 7200)` is called on a valid JWT
- **THEN** the session store entry's TTL is extended to 7200 seconds
- **AND** the method returns `true`
