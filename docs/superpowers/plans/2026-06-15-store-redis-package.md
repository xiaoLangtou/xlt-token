# Store Redis Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move node-redis and ioredis Store implementations into a framework-agnostic `@xlt-token/store-redis` package while preserving the existing NestJS DI API.

**Architecture:** The new package owns all Redis command translation and implements `XltTokenStore` with constructor-injected structural client types. `@xlt-token/nestjs` depends on the new package and keeps deprecated injectable wrapper classes and the existing client tokens.

**Tech Stack:** TypeScript, pnpm workspaces, tsdown, Vitest, NestJS DI.

---

### Task 1: Create failing tests for the framework-agnostic package

**Files:**
- Create: `packages/store-redis/test/redis-store.spec.ts`
- Create: `packages/store-redis/test/ioredis-store.spec.ts`
- Create: `packages/store-redis/vitest.config.ts`

- [ ] **Step 1: Copy the Store behavior expectations into the new package**

The tests import from `../src/index.js`, instantiate each Store directly with a
mock client, and cover all existing Store behavior. The ioredis suite includes
single-node pagination and Cluster master aggregation.

- [ ] **Step 2: Run the new package tests and verify RED**

Run:

```bash
pnpm exec vitest run --config packages/store-redis/vitest.config.ts
```

Expected: FAIL because `packages/store-redis/src/index.ts` does not exist.

### Task 2: Implement the standalone Store package

**Files:**
- Create: `packages/store-redis/src/redis-store.ts`
- Create: `packages/store-redis/src/ioredis-store.ts`
- Create: `packages/store-redis/src/index.ts`
- Create: `packages/store-redis/package.json`
- Create: `packages/store-redis/tsconfig.json`
- Create: `packages/store-redis/tsdown.config.ts`

- [ ] **Step 1: Add structural client types and Store implementations**

`RedisStore` accepts a `RedisClient` in its constructor. `IORedisStore` accepts
an `IORedisClient`. Both implement `XltTokenStore` and contain no NestJS imports.

- [ ] **Step 2: Export the public API**

`src/index.ts` exports:

```ts
export { RedisStore, type RedisClient } from './redis-store.js'
export {
  IORedisStore,
  type IORedisClient,
  type IORedisScanClient,
} from './ioredis-store.js'
```

- [ ] **Step 3: Add package metadata and build configuration**

The package uses version `1.2.0`, depends on `@xlt-token/core`, lists `redis`
and `ioredis` as optional peers, and emits dual ESM/CJS output with declarations.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
pnpm --filter @xlt-token/store-redis test
pnpm --filter @xlt-token/store-redis build
```

Expected: both commands pass.

### Task 3: Convert NestJS Stores into compatibility wrappers

**Files:**
- Modify: `packages/nestjs/src/store/redis-store.ts`
- Modify: `packages/nestjs/src/store/ioredis-store.ts`
- Modify: `packages/nestjs/test/redis-store.spec.ts`
- Modify: `packages/nestjs/test/ioredis-store.spec.ts`

- [ ] **Step 1: Add wrapper inheritance expectations**

Update NestJS tests to assert that DI-resolved Stores are instances of the
corresponding base classes from `@xlt-token/store-redis`. Keep command behavior
tests to prove the wrappers preserve existing semantics.

- [ ] **Step 2: Run NestJS tests and verify RED**

Run:

```bash
pnpm --filter @xlt-token/nestjs test
```

Expected: FAIL because NestJS Stores do not yet extend the standalone classes.

- [ ] **Step 3: Replace duplicated logic with injectable wrappers**

Keep `XLT_REDIS_CLIENT` and `XLT_IOREDIS_CLIENT`. Each NestJS class extends the
standalone class, injects the existing token, calls `super(client)`, and carries
a JSDoc `@deprecated` annotation.

- [ ] **Step 4: Run NestJS tests and verify GREEN**

Run:

```bash
pnpm --filter @xlt-token/nestjs test
```

Expected: all NestJS unit tests pass.

### Task 4: Update workspace dependencies and generated artifacts

**Files:**
- Modify: `packages/nestjs/package.json`
- Modify: `packages/nestjs/tsdown.config.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Generate: `packages/store-redis/dist/**`
- Generate: `packages/nestjs/dist/**`

- [ ] **Step 1: Move Redis peer ownership**

Add `@xlt-token/store-redis` to NestJS dependencies. Remove `redis` and
`ioredis` peers from NestJS and the root compatibility package because the new
package owns them.

- [ ] **Step 2: Refresh the lockfile**

Run:

```bash
pnpm install --lockfile-only
```

Expected: the new workspace importer appears and dependency versions remain
workspace-linked.

- [ ] **Step 3: Build affected packages**

Run:

```bash
pnpm --filter @xlt-token/store-redis build
pnpm --filter @xlt-token/nestjs build
pnpm build
```

Expected: all builds pass and generated declarations expose the intended APIs.

### Task 5: Document direct Core and Express usage

**Files:**
- Modify: `README.md`
- Modify: `docs/core/storage.md`
- Modify: `docs/adapters/express.md`
- Modify: `docs/adapters/nestjs/module-config.md`
- Modify: `docs/guide/architecture.md`
- Modify: `docs/README.md`

- [ ] **Step 1: Update package installation and architecture**

List `@xlt-token/store-redis` as the framework-agnostic Redis implementation
package and show `pnpm add @xlt-token/store-redis redis` or `ioredis`.

- [ ] **Step 2: Add direct constructor examples**

Document `new RedisStore(client)` and `new IORedisStore(client)` for Core and
Express. Keep the NestJS token-based examples under a compatibility heading.

- [ ] **Step 3: Check documentation formatting**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

### Task 6: Verify package boundaries and regressions

**Files:**
- Verify all files changed by Tasks 1-5.

- [ ] **Step 1: Prove the new package has no NestJS dependency**

Run:

```bash
rg -n '@nestjs/' packages/store-redis
```

Expected: no matches.

- [ ] **Step 2: Run unit tests**

Run:

```bash
pnpm --filter @xlt-token/store-redis test
pnpm --filter @xlt-token/nestjs test
pnpm --filter @xlt-token/express test
```

Expected: all tests pass.

- [ ] **Step 3: Run workspace builds and frozen lockfile validation**

Run:

```bash
pnpm build:workspace
pnpm install --lockfile-only --offline --frozen-lockfile
```

Expected: all workspace packages build and the lockfile is current.

- [ ] **Step 4: Review final exports and diff**

Confirm the new package declarations export both Stores and client types,
NestJS declarations retain all four compatibility exports, and no JWT files
changed.
