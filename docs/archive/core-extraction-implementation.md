# 任务一：抽离 `@xlt-token/core` · 实现文档

> **状态**：实施规划  
> **前置**：Phase 1 已完成（`pnpm-workspace.yaml`、`turbo.json`、`packages/core` 契约层）  
> **关联**：[multi-framework-architecture.md](./multi-framework-architecture.md) Phase 1  
> **后续**：[nestjs-adapter-implementation.md](./nestjs-adapter-implementation.md)

---

## 1. 目标

把鉴权**语义与运行时**从 NestJS / Express 中剥离，形成**零框架依赖**的核心包：

- 不 import `@nestjs/*`、`express`
- 所有 HTTP 读写只通过 `HttpContext`
- 对外提供 `createXltToken()` 工厂，可在任意 Node 框架使用
- 根包 `xlt-token` 暂时继续 re-export，**1.x 用户 API 不变**

---

## 2. 当前状态（已完成 vs 待做）

| 层级 | 已完成 | 待迁移 |
| --- | --- | --- |
| L0 契约 | config、const、Store/Strategy/Hooks/StpInterface 接口、`matchPermission` | — |
| L0 HTTP | `HttpContext`、`createExpressContext`（ExpressLike 结构类型） | — |
| L1 运行时 | `XltSession` 已在 core（需确认实现完整） | `StpLogic` 完整实现、`StpPermLogic`、`StpUtil` |
| L-1 实现 | — | `MemoryStore`、`RedisStore`、`UuidStrategy`、`JwtStrategy` |
| L1 异常 | — | 纯 JS 的 `XltError` 家族 |
| L1 工厂 | — | `createXltToken()`、`XltTokenContext` |
| 根包残留 | NestJS Module/Guard/Decorator/Exception | `src/auth/*`、`src/perm/*`、`src/store/*`、`src/token/*` 仍是**真实实现** |

**关键观察**：`packages/core/src/auth/stp-logic.ts` 目前只是**接口骨架**，真正 600+ 行实现在 `src/auth/stp-logic.ts`，且仍依赖 `Request` 与 `@Injectable()`。

---

## 3. 总体思路

```
当前                              目标
─────────────────────────────────────────────────────────
src/stp-logic.ts                  @xlt-token/core StpLogic
  ├─ Express Request       →        HttpContext
  └─ @Injectable()         →        普通 class + 构造函数注入

createXltToken() ──→ StpLogic + MemoryStore + UuidStrategy
```

**核心原则：先改签名，再搬文件，最后删 NestJS 装饰器。**

1. **HttpContext 替换 Request** — 只动 `getTokenValue` / `isLogin` / `checkLogin` 三条路径
2. **去掉 `@Injectable()`** — core 用普通 class + 构造函数注入
3. **异常去 NestJS 化** — core 抛纯 `Error` 子类；Nest 层再包装
4. **测试跟着走** — 单测用 `HttpContext` mock，不启动 Nest

---

## 4. 目标包结构

```
packages/core/src/
├── auth/
│   ├── stp-logic.ts          # 完整实现，接受 HttpContext
│   ├── stp-perm-logic.ts
│   └── stp-util.ts           # 静态门面，setStpLogic 内部实现
├── session/
│   └── xlt-session.ts
├── store/
│   ├── xlt-token-store.interface.ts
│   └── memory-store.ts       # 默认实现放 core
├── token/
│   ├── token-strategy.interface.ts
│   └── uuid-strategy.ts
├── perm/
│   ├── stp-interface.ts
│   └── perm-pattern-match.ts
├── exceptions/
│   ├── xlt-error.ts
│   ├── not-login.exception.ts
│   ├── not-permission.exception.ts
│   ├── not-role.exception.ts
│   └── not-safe.exception.ts
├── http/
│   ├── context.ts
│   └── express.ts            # 仅 helper，不依赖 express 包
├── config/ const/ hooks/
├── factory.ts                # createXltToken
└── index.ts
```

**暂不放入 core（Phase 4 独立分包）：**

- `RedisStore` → `@xlt-token/store-redis`
- `JwtStrategy` → `@xlt-token/strategy-jwt`（或暂留 nestjs 包，core 只保留接口）

---

## 5. 分步实施计划

### Step 0：前置决策（1 天）

| 决策项 | 建议 | 影响 |
| --- | --- | --- |
| `HttpCookies.get` 是否 async | **Phase 2 前保持 sync** | 与 Hono/Elysia 冲突，可 2.0 再 breaking |
| Redis/JWT 是否进 core | **不进**，放独立包 | core 保持 zero-dep（除 es-toolkit/uuid） |
| `StpLogic` 是否保留 Nest DI Token | **core 不用 Token**，nestjs 包负责桥接 | 工厂 + Module 两套入口 |

### Step 1：异常体系（0.5 天）

**思路**：core 定义纯 JS 异常，带 `status` / `code` / 业务字段。

```ts
// packages/core/src/exceptions/not-login.exception.ts
export class NotLoginException extends XltError {
  readonly status = 401;
  readonly type: NotLoginType;
  readonly token?: string;
}
```

**验收**：core 单测可 `expect(() => ...).toThrow(NotLoginException)`，无需 Nest TestingModule。

### Step 2：`StpLogic` HttpContext 化（2~3 天，最关键）

**改造点对照表：**

| 方法 | 现在 | 目标 |
| --- | --- | --- |
| `getTokenValue(req: Request)` | 读 `req.headers` / `req.cookies` / `req.query` | 读 `ctx.headers/cookies/query.get()` |
| `checkLogin(req: Request)` | 写 `req.stpLoginId` | 写 `ctx.state.stpLoginId` / `ctx.state.stpToken` |
| 构造函数 | `@Inject(XLT_TOKEN_CONFIG)` | 普通参数 `(config, store, strategy, hooks?)` |

**token 读取顺序（行为契约，必须保持不变）：**

```
header → cookie → query → 剥离 tokenPrefix
```

**伪代码：**

```ts
async getTokenValue(ctx: HttpContext): Promise<string | null> {
  const { tokenName, tokenPrefix, isReadHeader, isReadCookie, isReadQuery } = this.config;
  let raw: string | null = null;

  if (isReadHeader) raw = ctx.headers.get(tokenName);
  if (!raw && isReadCookie) raw = ctx.cookies.get(tokenName);
  if (!raw && isReadQuery) raw = ctx.query.get(tokenName);
  if (!raw) return null;

  return tokenPrefix && raw.startsWith(tokenPrefix)
    ? raw.slice(tokenPrefix.length)
    : raw;
}

async checkLogin(ctx: HttpContext): Promise<AuthResult> {
  const token = await this.getTokenValue(ctx);
  // ... 原有 store 校验逻辑不变 ...
  ctx.state.stpLoginId = loginId;
  ctx.state.stpToken = token;
  return { ok: true, loginId, token };
}
```

**测试策略：**

- 新增 `packages/core/src/http/testing.ts`：`createMockHttpContext({ headers, cookies, query })`
- 把 `src/auth/stp-logic.spec.ts` **整体迁移**到 core，Request mock 改为 HttpContext mock
- JWT / activeTimeout / 二级认证 / 临时 Token 等场景全部保留

### Step 3：迁移 `StpPermLogic` + `StpUtil`（1 天）

- `StpPermLogic`：去掉 `@Injectable`，依赖 `(stpInterface, store, config)`
- `StpUtil`：`setStpLogic` / `setStpPermLogic` 保留，供静态门面使用
- 权限 spec 一并迁入 core

### Step 4：迁移 Store / Strategy 默认实现（1 天）

- `MemoryStore`：去掉 `@Injectable()`，保留在 `@xlt-token/core` 内作为默认 store
- `UuidStrategy`：去掉 Nest 装饰器，依赖 `config` 参数或构造注入

### Step 5：`createXltToken` 工厂（0.5 天）

```ts
export function createXltToken(options: CreateOptions = {}): XltTokenContext {
  const config = { ...DEFAULT_XLT_TOKEN_CONFIG, ...options.config };
  const store = options.store ?? new MemoryStore();
  const strategy = options.strategy ?? new UuidStrategy(config);
  const stpLogic = new StpLogic(config, store, strategy, options.stpInterface, options.hooks);
  const stpPermLogic = new StpPermLogic(options.stpInterface ?? defaultStpInterface, store, config);
  setStpLogic(stpLogic);
  setStpPermLogic(stpPermLogic);
  return { config, store, strategy, stpLogic, stpPermLogic, stpUtil: StpUtil };
}
```

**验收**：不启动 Nest，纯 `createXltToken` + mock HttpContext 跑通 login/checkLogin/logout。

### Step 6：根包瘦身（0.5 天）

根 `src/` 变为**薄 re-export 层**：

```ts
// src/index.ts
export * from '@xlt-token/core';           // 逐步暴露 core API
export { XltTokenModule } from './nestjs'; // 暂留，Phase 2 再拆包
export { MemoryStore, UuidStrategy } from '@xlt-token/core';
```

删除根包中与 core 重复的源码文件。

### Step 7：测试与覆盖率（1 天）

| 包 | 测试位置 | 目标 |
| --- | --- | --- |
| `@xlt-token/core` | `packages/core/src/**/*.spec.ts` | Stmts ≥ 98%（架构文档要求） |
| `xlt-token` | E2E 暂留根 `test/` | 63 个 E2E 全绿 |

**Vitest workspace**（可选）：根 `vitest.workspace.ts` 聚合 core + nestjs 单测。

---

## 6. 验收标准

- [ ] `@xlt-token/core` 的 `package.json` **无** `@nestjs/*`、`express` 依赖
- [ ] `pnpm --filter @xlt-token/core test:cov` ≥ 98% statements
- [ ] `pnpm build:workspace` 成功
- [ ] 根包 E2E 63 用例全绿（此时 nestjs 层仍用旧 Guard，但 StpLogic 来自 core）
- [ ] 对外 `import { StpLogic, StpUtil, MemoryStore } from 'xlt-token'` 行为不变

---

## 7. 风险点

| 风险 | 应对 |
| --- | --- |
| 600 行 StpLogic 迁移引入行为回归 | 先复制再改签名，spec 全绿后再删旧文件 |
| `request.stpLoginId` 与 `ctx.state` 双写期 | Nest Guard 在 checkLogin 后同时写 `req.stpLoginId` 和读 `ctx.state` |
| 根包与 core 重复维护 | 设 CI 检查：根 `src/auth` 不允许存在实现文件 |

---

## 8. 建议 PR 切分

| PR | 范围 | 预估 |
| --- | --- | --- |
| PR-1 | core 异常 + HttpContext mock 工具 | 小 |
| PR-2 | StpLogic HttpContext 化 + spec 迁移 | 大 |
| PR-3 | StpPermLogic / StpUtil / XltSession / MemoryStore / UuidStrategy 迁入 core | 中 |
| PR-4 | createXltToken 工厂 + 根包 re-export 瘦身 | 中 |

> NestJS 适配相关 PR 见 [nestjs-adapter-implementation.md](./nestjs-adapter-implementation.md)。
