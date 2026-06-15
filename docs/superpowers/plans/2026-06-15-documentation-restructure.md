# Documentation Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the documentation into clear top-level sections and provide detailed, independently usable Core, Redis Store, NestJS, and Express guides.

**Architecture:** Keep existing URLs stable while changing navigation and content ownership. Add one comprehensive Redis Store page, keep framework-specific integration code in adapter guides, and remove only duplicated Redis internals from Core and adapter pages.

**Tech Stack:** VitePress, Markdown, Twoslash, TypeScript examples, pnpm.

---

### Task 1: Rebuild the navigation skeleton

**Files:**
- Modify: `docs/.vitepress/config.mts`
- Modify: `docs/index.md`
- Modify: `docs/README.md`
- Modify: `docs/.vitepress/theme/Home.vue`
- Modify: `docs/guide/getting-started.md`

- [x] Group every sidebar under Quick Start, Core, Redis Store, Framework Adapters, Advanced Guides, and Reference.
- [x] Add direct Core, Redis Store, NestJS, and Express entry points to both home pages.
- [x] Run `pnpm docs:build` and expect a successful VitePress build.

### Task 2: Create the comprehensive Redis Store guide

**Files:**
- Create: `docs/store-redis/index.md`
- Modify: `docs/core/storage.md`
- Modify: `docs/core/configuration.md`
- Modify: `docs/core/hooks-and-observability.md`

- [x] Document package installation, client selection, lifecycle, command mapping, TTL semantics, SCAN, Sentinel, Cluster, key space, debugging, production guidance, and troubleshooting.
- [x] Include complete Core, Express, NestJS, node-redis, ioredis, and compatibility migration examples.
- [x] Reduce `/core/storage` to the store contract, MemoryStore, custom stores, and a detailed handoff to the Redis guide.
- [x] Run `pnpm docs:build` and expect a successful VitePress build.

### Task 3: Complete the Core standalone path

**Files:**
- Modify: `docs/core/getting-started.md`
- Modify: `docs/core/core-api.md`
- Modify: `docs/core/storage.md`
- Modify: `docs/core/recipes.md`

- [x] Expand the Core guide from installation through context bridging, login, validation, logout, permissions, sessions, error handling, lifecycle, and runnable verification.
- [x] Ensure Core examples do not import NestJS or Express.
- [x] Link Redis only as an optional framework-independent store.
- [x] Run Core-related link and import searches, then run `pnpm docs:build`.

### Task 4: Complete NestJS and Express adapter paths

**Files:**
- Modify: `docs/adapters/index.md`
- Modify: `docs/adapters/nestjs/getting-started.md`
- Modify: `docs/adapters/nestjs/module-config.md`
- Modify: `docs/adapters/nestjs/guards-and-decorators.md`
- Modify: `docs/adapters/express.md`

- [x] Keep complete NestJS Module, Guard, Controller, Redis, lifecycle, Fastify, exception, curl, and test examples.
- [x] Keep complete Express instance, middleware, Router, Redis, session, error handler, lifecycle, request, and test examples.
- [x] Replace duplicated Redis internals with precise links without removing framework-required setup.
- [x] Run NestJS and Express documentation searches, then run `pnpm docs:build`.

### Task 5: Update references and verify the whole site

**Files:**
- Modify: `README.md`
- Modify: `docs/guide/architecture.md`
- Modify: `docs/guide/migration-2-0.md`
- Modify: `docs/reference/llms.md`
- Modify: `docs/reference/src-reference.md`
- Modify: `docs/public/llms.txt`

- [x] Point all primary Redis documentation links to `/store-redis/`.
- [x] Keep `/core/storage` valid for the storage contract and MemoryStore.
- [x] Verify package names and install commands against package manifests.
- [x] Run `rg` checks for stale links and framework imports in Core examples.
- [x] Run `git diff --check` and `pnpm docs:build`.
- [x] Commit the completed documentation restructure.
