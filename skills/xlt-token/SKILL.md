---
name: xlt-token
description: Use when adding or maintaining xlt-token authentication in TypeScript backend projects. Covers @xlt-token/core plus NestJS, Express, and Fastify adapters; login state, token lifecycle, permissions, sessions, Redis, JWT, and secondary authentication.
---

# xlt-token

xlt-token is a framework-agnostic token authentication library inspired by Sa-Token. Use it to add login state, token lifecycle management, permissions, roles, sessions, multi-device login, secondary authentication, JWT, Redis storage, and framework adapters for NestJS, Express, or Fastify.

Prefer the adapter package that matches the user's framework:

- NestJS: `@xlt-token/nestjs`
- Express: `@xlt-token/express`
- Fastify: `@xlt-token/fastify`
- Framework-agnostic or custom adapters: `@xlt-token/core`
- Compatibility root package: `xlt-token`, equivalent to the NestJS adapter

## Core Rules

1. Keep business user lookup outside xlt-token. The library stores login state and checks auth; the application still validates credentials and loads users.
2. Use `loginId` as the stable business user id. Do not use values containing `:`.
3. Return the raw token from login. The client should send it with the configured prefix, usually `Authorization: Bearer <token>`.
4. Use permissions for fine-grained actions such as `user:read` or `order:create`; use roles for broad categories such as `admin`.
5. Register `stpInterface` before using permission or role checks.
6. Use `@XltIgnore()` or Express `ignore` policies for public routes when `defaultCheck: true`.
7. Use `@XltCheckLogin()` or Express `requireLogin` policies for protected routes when `defaultCheck: false`.
8. Use `openSafe` / `checkSafe` for short-lived secondary authentication windows around sensitive operations.
9. Use Redis storage for production multi-instance deployments. Memory storage is best for local development, tests, or single-process demos.
10. Use `createXltInstance()` and hold its instance handle in Fastify or other multi-instance applications. `StpUtil` and `createXltToken()` bind process-global state, so they are unsuitable for isolated auth instances.
11. Enable `config.lifecycle` only when the application owns a refresh endpoint. Treat a successful `refreshToken()` result as a rotation event and persist its returned token before accepting another refresh.

## Reference Files

Load only the files needed for the user's task:

- [core](references/core.md): framework-agnostic setup, `createXltToken`, `StpLogic`, `StpUtil`, storage, token strategies, sessions, permissions, hooks
- [nestjs](references/nestjs.md): `XltTokenModule`, global guard, decorators, custom guards, Redis, JWT
- [express](references/express.md): `xltMiddleware`, route policies, helpers, error handler, request state
- [fastify](references/fastify.md): explicit `XltInstance`, plugin options, `config.xlt`, request state, error handling
- [recipes](references/recipes.md): common flows such as login/logout, blacklists, multi-device login, secondary auth, temp tokens, online users

## Routing Table

| Task | Load these references |
| --- | --- |
| Add xlt-token to a NestJS app | nestjs, recipes |
| Add xlt-token to an Express app | express, recipes |
| Add xlt-token to a Fastify app | fastify, recipes |
| Use xlt-token without a framework | core, recipes |
| Configure permissions or roles | core, nestjs or express |
| Add Redis storage | core, nestjs |
| Add JWT tokens | core, nestjs |
| Add rotating refresh tokens | core, recipes |
| Implement multi-device login | core, recipes |
| Add secondary authentication | core, recipes, nestjs or express |
| Debug invalid token, kickout, replaced login | core, recipes |
| Explain which package to install | core, nestjs, express |

## Package Installation

NestJS:

```bash
pnpm add @xlt-token/nestjs
```

Express:

```bash
pnpm add @xlt-token/express
```

Fastify:

```bash
pnpm add fastify @xlt-token/fastify
```

Core only:

```bash
pnpm add @xlt-token/core
```

Optional dependencies:

```bash
pnpm add redis
pnpm add jsonwebtoken
```

## Validation

When modifying an application that uses xlt-token, ask the user how they run tests if it is not obvious. For this repository itself, use:

```bash
pnpm --filter @xlt-token/core test
pnpm --filter @xlt-token/nestjs test
pnpm --filter @xlt-token/nestjs test:e2e
pnpm --filter @xlt-token/express test
pnpm --filter @xlt-token/express test:e2e
pnpm --filter @xlt-token/fastify test
pnpm --filter @xlt-token/fastify test:e2e
```
