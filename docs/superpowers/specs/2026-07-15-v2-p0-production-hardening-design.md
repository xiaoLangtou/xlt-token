# xlt-token 2.0 P0 Production Hardening Design

## Status

This design defines the P0 release boundary for xlt-token 2.0.0. Version 2.0 removes the 1.x compatibility layer instead of carrying deprecated storage, JWT, hook, or lifecycle APIs forward.

## Goal

xlt-token 2.0 provides deterministic storage semantics, secure token rotation, managed JWT keys, privacy-safe audit events, and repeatable release gates. The release does not add new framework adapters or an authorization policy engine.

## Decisions

The implementation uses a modular architecture:

- `@xlt-token/core` owns authentication state transitions, lifecycle policy, errors, events, and the storage contract.
- `@xlt-token/store-redis` implements the complete contract for node-redis and ioredis, including cluster-safe atomic operations.
- `@xlt-token/jwt` owns JWT signing and verification without depending on NestJS or Express.
- `@xlt-token/store-contract` provides one reusable conformance suite for official and third-party stores.
- Framework adapters consume only public APIs from Core and optional strategy packages.

The repository does not preserve the 1.x `XltTokenStore`, `JwtStrategy`, `jwt.secret`, token-bearing hooks, or nullable refresh result shapes.

## Package Boundaries

```text
@xlt-token/store-contract --> @xlt-token/core
@xlt-token/store-redis    --> @xlt-token/core
@xlt-token/jwt            --> @xlt-token/core
@xlt-token/express        --> @xlt-token/core
@xlt-token/nestjs         --> @xlt-token/core, optional strategy/store packages
xlt-token                 --> @xlt-token/core, @xlt-token/nestjs
```

Core must not import framework, Redis, JWT implementation, telemetry, or test-runner packages. Package-boundary checks reject source-level imports across packages and imports that bypass package exports.

## Storage Contract

### Data model

Every stored value carries an explicit expiry policy:

```ts
export type StoreTtl = { kind: "finite"; seconds: number } | { kind: "persistent" };

export interface StoreEntry {
  value: string;
  expiresAt: number | null;
}
```

Finite TTL values must contain an integer greater than zero. Stores use an injected or system clock to determine `expiresAt`. An entry is unavailable at `now >= expiresAt`.

### Required operations

```ts
export interface XltTokenStore {
  get(key: string): Promise<StoreEntry | null>;
  set(key: string, value: string, ttl: StoreTtl): Promise<void>;
  delete(key: string): Promise<boolean>;
  setIfAbsent(key: string, value: string, ttl: StoreTtl): Promise<boolean>;
  compareAndSet(
    key: string,
    expectedValue: string,
    nextValue: string,
    ttl: StoreTtl | { kind: "keep" },
  ): Promise<boolean>;
  compareAndDelete(key: string, expectedValue: string): Promise<boolean>;
  touch(key: string, ttl: StoreTtl): Promise<boolean>;
  scan(prefix: string, cursor?: string): Promise<{ keys: string[]; cursor: string | null }>;
}
```

`setIfAbsent`, `compareAndSet`, and `compareAndDelete` are atomic for one logical key. Redis implementations use server-side commands or scripts, so read-modify-write races never cross the process boundary. Redis Cluster operations keep each atomic state transition within one hash slot by using a stable hash tag derived from the token family or login ID.

The contract suite verifies expiry boundaries, persistent values, compare failures, concurrent writers, deletion races, cursor scans, and recovery after an operation throws. MemoryStore, RedisStore, and IORedisStore must pass the same assertions.

## Token Lifecycle

### Policy

```ts
export interface TokenLifecycleConfig {
  expiration: {
    mode: "fixed" | "sliding";
    ttl: DurationInput;
    renewWhenRemainingBelow?: DurationInput;
  };
  refresh: {
    enabled: boolean;
    ttl: DurationInput;
    rotate: true;
    replayDetection: "off" | "family";
  };
}
```

Fixed expiration never extends an access token after login and rejects `renewWhenRemainingBelow`. Sliding expiration requires a finite positive TTL and renews server-side state when the remaining TTL is less than or equal to `renewWhenRemainingBelow`. The default threshold is 20% of the configured TTL, rounded down to at least one second. Refresh always rotates the presented token; 2.0 does not support non-rotating refresh.

Each login creates a token family with a random family ID and generation number. A successful refresh atomically consumes generation `n` and creates generation `n + 1`. When replay detection is `family`, reuse of a consumed generation revokes the entire family. When replay detection is `off`, reuse returns a stable failure without changing the active generation.

### Results and revocation

Lifecycle methods return discriminated results instead of `null` or ambiguous booleans:

```ts
export type RefreshResult =
  | { ok: true; token: string; expiresAt: number | null }
  | { ok: false; code: "REFRESH_DISABLED" | "TOKEN_INVALID" | "TOKEN_EXPIRED" | "TOKEN_REPLAYED" | "TOKEN_REVOKED" };

export type RevokeScope = "token" | "family" | "device" | "login";
```

Revocation writes an explicit state transition before removing secondary indexes. A retry observes the same terminal state and succeeds idempotently. Tests cover simultaneous refresh requests, timeout boundaries, partial index cleanup, store failures, and repeated revocation.

## JWT Security

### Package and configuration

`@xlt-token/jwt` exports a framework-independent `JwtStrategy`. The package accepts an explicit key ring:

```ts
export interface JwtKey {
  kid: string;
  algorithm: "HS256" | "HS384" | "HS512" | "RS256" | "RS384" | "RS512";
  signingKey?: string;
  verificationKey: string;
}

export interface JwtStrategyConfig {
  activeKid: string;
  keys: readonly JwtKey[];
  allowedAlgorithms: readonly JwtKey["algorithm"][];
  issuer?: string;
  audience?: string | readonly string[];
}
```

The constructor rejects duplicate or empty `kid` values, a missing active key, an active key without signing material, algorithms outside the allowlist, mixed symmetric/asymmetric key material, and empty secrets. HMAC secrets shorter than 32 bytes are rejected.

Every new JWT contains the active `kid`, `jti`, subject, issued-at time, and configured expiry. Verification reads `kid` before selecting a key, restricts the verifier to the configured algorithm, and rejects tokens without `kid`. Rotation changes `activeKid`; verification keys for the previous key remain until all tokens signed by that key expire.

The NestJS package removes its local JWT implementation and re-exports no JWT class. Applications install and provide `@xlt-token/jwt` explicitly.

## Errors and Audit Events

### Stable errors

Core exports an `XltErrorCode` string enum. Each public failure has a stable code, HTTP status suggestion, and safe public details. Error messages remain descriptive but are not part of the compatibility contract.

The 2.0 error-code set is `TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`, `TOKEN_REPLAYED`, `LOGIN_REPLACED`, `LOGIN_KICKED_OUT`, `PERMISSION_DENIED`, `ROLE_DENIED`, `SAFE_REQUIRED`, `REFRESH_DISABLED`, `STORE_CONFLICT`, and `CONFIG_INVALID`. Adding a code is backward compatible; renaming or changing the meaning of an existing code requires a new major version.

```ts
export interface XltErrorDetails {
  loginType?: string;
  permission?: string;
  role?: string;
  business?: string;
}
```

Error details must not contain raw tokens, JWT payloads, keys, secrets, cookies, or authorization headers.

### Versioned events

Core replaces token-bearing lifecycle hooks with one event sink:

```ts
export type XltAuditEvent = {
  schemaVersion: 1;
  id: string;
  timestamp: number;
  type:
    | "login.succeeded"
    | "token.refreshed"
    | "token.replay_detected"
    | "token.revoked"
    | "logout.succeeded"
    | "safe.opened"
    | "safe.closed";
  loginId: string;
  device?: string;
  reason?: string;
  tokenFingerprint?: string;
};

export interface XltEventSink {
  emit(event: XltAuditEvent): void | Promise<void>;
}
```

`tokenFingerprint` is an irreversible, truncated SHA-256 digest intended only for correlation. Event delivery is best-effort and never changes the authentication result. Core catches sink errors and sends them to an optional diagnostic callback that also receives no secrets.

## Quality and Engineering Gates

### Test layers

- Unit tests cover Core state transitions, JWT validation, errors, and event redaction.
- The shared store contract runs against MemoryStore, RedisStore, and IORedisStore.
- Concurrency tests exercise login replacement, refresh races, revocation races, sliding renewal, and Redis recovery.
- Adapter E2E tests verify the same public error codes and lifecycle behavior in NestJS and Express.
- Documentation examples compile against package exports.

Core enforces at least 90% branch coverage. Other packages retain explicit coverage thresholds based on their adapter surface.

### Benchmarks

A deterministic benchmark suite records login, token verification, refresh, and permission-check throughput for MemoryStore. CI compares the median of multiple samples against a committed baseline. A regression greater than 10% fails the benchmark job unless the pull request updates the baseline with an explicit explanation.

### CI and supply chain

Pull requests run formatting, linting, type checks, package-boundary checks, unit tests, contract tests, E2E tests, coverage, builds, documentation compilation, secret scanning, dependency review, and license checks. The compatibility matrix covers Node.js 20, 22, and 24 plus the supported framework and Redis client majors.

Release workflows use pinned action versions and provenance-enabled npm publishing. Build output, package manifests, checksums, benchmark results, and test reports remain attached to the tagged GitHub release.

### Versioning and release

Changesets defines package versions and changelog entries. The release workflow maps prerelease state to npm tags:

- `2.0.0-next.n` publishes with `next`.
- `2.0.0-rc.n` publishes with `rc`.
- `2.0.0` publishes with `latest` after the RC has remained available for at least seven days.

Rollback moves `latest` to the previous stable release and publishes a corrective patch when package contents are defective. npm package versions remain immutable and are never reused.

## Migration

The migration guide maps every removed 1.x API to its 2.0 replacement. It includes store adapter changes, JWT key-ring setup, lifecycle policy examples, new result handling, event sink migration, package installation changes, and rollback instructions.

The guide explicitly compares stateful opaque tokens with JWT. Opaque tokens remain the default for immediate revocation and simpler key management. JWT is appropriate when independently verifiable claims justify the additional key-rotation and replay-management cost.

## Acceptance Criteria

The P0 scope is complete when all of the following conditions hold:

1. MemoryStore, RedisStore, and IORedisStore pass the same contract and concurrency suite.
2. Fixed and sliding expiry, refresh rotation, family replay detection, and every revocation scope pass clock-boundary and retry tests.
3. JWT key rotation keeps tokens signed by retained keys valid while rejecting missing `kid`, disallowed algorithms, weak keys, and invalid configuration.
4. Every public authentication failure uses a documented stable error code.
5. Audit events cover login, refresh, replay, revocation, logout, and secondary authentication without exposing token material.
6. CI enforces branch coverage, the 10% benchmark limit, package boundaries, security checks, release provenance, and the declared compatibility matrix.
7. The 1.x to 2.0 migration guide and security, release, rollback, and token-selection documentation build successfully.

## Out of Scope

P0 does not add Fastify, Hono, Koa, OpenTelemetry exporters, OAuth/OIDC provider behavior, a management UI, or a policy engine. Those features remain separate follow-up work after the 2.0 production-hardening release.
