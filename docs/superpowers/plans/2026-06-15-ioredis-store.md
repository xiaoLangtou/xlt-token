# IORedisStore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an ioredis-specific `XltTokenStore` implementation without changing the existing node-redis integration.

**Architecture:** `IORedisStore` is a separate NestJS injectable with its own `XLT_IOREDIS_CLIENT` token. It translates the common `XltTokenStore` contract into ioredis command arguments and tuple-shaped `SCAN` responses, while `RedisStore` remains unchanged.

**Tech Stack:** TypeScript, NestJS dependency injection, Vitest, pnpm, tsdown, ioredis peer dependency.

---

### Task 1: Add failing IORedisStore contract tests

**Files:**
- Create: `packages/nestjs/test/ioredis-store.spec.ts`

- [ ] **Step 1: Write tests for the public class and command mapping**

Create a Nest testing module that provides `IORedisStore` and a mocked
`XLT_IOREDIS_CLIENT`. Cover `get`, both `set` forms, `delete`, `update`,
`has`, `updateTimeout`, `getTimeout`, and paginated `keys`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter @xlt-token/nestjs test -- ioredis-store.spec.ts
```

Expected: FAIL because `../src/store/ioredis-store` does not exist.

### Task 2: Implement IORedisStore

**Files:**
- Create: `packages/nestjs/src/store/ioredis-store.ts`
- Test: `packages/nestjs/test/ioredis-store.spec.ts`

- [ ] **Step 1: Add the minimal client contract and injectable Store**

Define a structural client type with the Redis commands used by the Store,
export `XLT_IOREDIS_CLIENT`, inject it in `IORedisStore`, and implement every
`XltTokenStore` method using ioredis arguments:

```ts
set(key, value, 'EX', timeoutSec)
set(key, value, 'XX', 'KEEPTTL')
scan(cursor, 'MATCH', pattern, 'COUNT', 100)
```

- [ ] **Step 2: Run the focused test and verify GREEN**

Run:

```bash
pnpm --filter @xlt-token/nestjs test -- ioredis-store.spec.ts
```

Expected: all `IORedisStore` tests pass.

### Task 3: Publish the API and dependency metadata

**Files:**
- Modify: `packages/nestjs/src/index.ts`
- Modify: `packages/nestjs/tsdown.config.ts`
- Modify: `packages/nestjs/package.json`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Export the new Store**

Add:

```ts
export { IORedisStore, XLT_IOREDIS_CLIENT } from './store/ioredis-store.js'
```

- [ ] **Step 2: Add optional ioredis peer dependencies**

Declare `"ioredis": "^5.0.0"` in both public packages and mark it optional in
`peerDependenciesMeta`. Add `ioredis` to the NestJS tsdown `external` list and
refresh the pnpm lockfile metadata.

- [ ] **Step 3: Build the package**

Run:

```bash
pnpm --filter @xlt-token/nestjs build
pnpm build
```

Expected: both packages build and emit declarations containing the new export.

### Task 4: Document both Redis clients

**Files:**
- Modify: `README.md`
- Modify: `docs/core/storage.md`
- Modify: `docs/adapters/nestjs/module-config.md`

- [ ] **Step 1: Update installation and Store lists**

Add `pnpm add ioredis` and list `IORedisStore` beside `RedisStore`.

- [ ] **Step 2: Add an ioredis configuration example**

Document `IORedisStore`, `XLT_IOREDIS_CLIENT`, and `new Redis(...)`, while
keeping the existing node-redis examples intact.

- [ ] **Step 3: Check documentation formatting**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

### Task 5: Regression verification

**Files:**
- Verify all files changed by Tasks 1-4.

- [ ] **Step 1: Run NestJS unit tests**

Run:

```bash
pnpm --filter @xlt-token/nestjs test
```

Expected: all unit tests pass, including existing `RedisStore` tests.

- [ ] **Step 2: Run final builds**

Run:

```bash
pnpm --filter @xlt-token/nestjs build
pnpm build
```

Expected: both builds pass without unresolved ioredis imports.

- [ ] **Step 3: Review the final diff**

Confirm no existing `RedisStore` behavior changed, no frontend service was
started, and all edits trace to ioredis support.
