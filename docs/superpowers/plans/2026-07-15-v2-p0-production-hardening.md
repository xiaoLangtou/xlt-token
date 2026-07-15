# xlt-token 2.0 P0 生产加固实施计划

> **面向智能代理执行者：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行。本计划使用复选框跟踪进度。

**目标：** 完成 xlt-token 2.0 的存储一致性、Token 生命周期、JWT 安全治理、可观测错误模型和工程化 P0 门禁。

**架构：** Core 负责状态转换和公共契约，Redis 包负责原子存储实现，新增 JWT 包负责框架无关的密钥治理，新增存储契约包复用行为测试。NestJS 和 Express 只适配 Core 的公开错误与生命周期 API。

**技术栈：** TypeScript、pnpm workspace、Vitest、tsdown、Turborepo、Oxlint、Oxfmt、jsonwebtoken、GitHub Actions、Changesets。

## 全局约束

- 目标版本为 `2.0.0`，不保留 1.x 存储、JWT、Hook 或生命周期兼容层。
- Core 不得依赖框架、Redis、JWT 实现、遥测或测试运行器包。
- MemoryStore、RedisStore 和 IORedisStore 必须通过同一套契约断言。
- Core 分支覆盖率不得低于 90%。
- 性能相对基线退化超过 10% 时 CI 必须失败。
- 不启动任何前端或文档开发服务。

---

### 任务 1：强制原子存储契约与 MemoryStore

**文件：**

- 修改：`packages/core/src/store/xlt-token-store.interface.ts`
- 修改：`packages/core/src/store/memory-store.ts`
- 修改：`packages/core/src/index.ts`
- 新增测试：`packages/core/test/store/memory-store.contract.spec.ts`
- 修改测试：`packages/core/test/store/memory-store.spec.ts`

**接口：**

- 产出：`StoreTtl`、`StoreEntry`、`StoreScanResult` 和设计文档中定义的 `XltTokenStore`。
- 产出：`finiteTtl(seconds)`、`persistentTtl()` 和 `keepTtl()`，用于消除魔法值。
- 依赖：无。

- [ ] **步骤 1：写入失败的 MemoryStore 原子与过期测试**

```ts
it("只允许一个并发调用 setIfAbsent 成功", async () => {
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      store.setIfAbsent("lock", String(index), finiteTtl(60)),
    ),
  );
  expect(results.filter(Boolean)).toHaveLength(1);
});

it("compareAndSet 比较失败时不改变值和 TTL", async () => {
  await store.set("key", "v1", finiteTtl(60));
  await expect(store.compareAndSet("key", "wrong", "v2", keepTtl())).resolves.toBe(false);
  await expect(store.get("key")).resolves.toMatchObject({ value: "v1" });
});
```

- [ ] **步骤 2：运行测试并确认因新接口不存在而失败**

运行：`pnpm --filter @xlt-token/core test -- test/store/memory-store.contract.spec.ts`

预期：TypeScript 或 Vitest 报告 `setIfAbsent`、`compareAndSet` 或 TTL helper 不存在。

- [ ] **步骤 3：实现新存储类型和 MemoryStore 原子操作**

```ts
export type StoreTtl = { kind: "finite"; seconds: number } | { kind: "persistent" };
export type StoreTtlUpdate = StoreTtl | { kind: "keep" };
export interface StoreEntry { value: string; expiresAt: number | null }
export interface StoreScanResult { keys: string[]; cursor: string | null }
```

MemoryStore 在同一个同步临界段内完成比较和写入。所有公开 Promise 方法在首次 `await` 之前完成 Map 状态转换，从而保证单进程原子性。

- [ ] **步骤 4：运行存储测试、类型检查与格式检查**

运行：`pnpm --filter @xlt-token/core test -- test/store`

运行：`pnpm --filter @xlt-token/core typecheck`

预期：全部通过。

- [ ] **步骤 5：提交任务 1**

```bash
git add packages/core/src/store packages/core/src/index.ts packages/core/test/store
git commit -m "feat(core): define atomic store contract"
```

### 任务 2：共享契约包与 Redis 原子实现

**文件：**

- 新增：`packages/store-contract/package.json`
- 新增：`packages/store-contract/tsconfig.json`
- 新增：`packages/store-contract/tsdown.config.ts`
- 新增：`packages/store-contract/src/index.ts`
- 新增：`packages/store-contract/src/store-contract.ts`
- 修改：`packages/store-redis/src/redis-store.ts`
- 修改：`packages/store-redis/src/ioredis-store.ts`
- 修改：`packages/store-redis/test/redis-store.spec.ts`
- 修改：`packages/store-redis/test/ioredis-store.spec.ts`
- 修改：`packages/store-redis/package.json`
- 修改：`scripts/check-package-boundaries.mjs`

**接口：**

- 消费：任务 1 的 `XltTokenStore`、`StoreTtl` 和 helper。
- 产出：`defineStoreContract(name, createStore)`，其中 `createStore` 返回隔离的 `XltTokenStore`。

- [ ] **步骤 1：新增共享契约并先接入旧 Redis 实现**

```ts
export function defineStoreContract(
  name: string,
  createStore: () => Promise<XltTokenStore> | XltTokenStore,
): void {
  describe(name, () => {
    it("keeps one winner for concurrent setIfAbsent", async () => {
      const store = await createStore();
      const results = await Promise.all(
        Array.from({ length: 20 }, (_, index) =>
          store.setIfAbsent("{contract}:lock", String(index), finiteTtl(30)),
        ),
      );
      expect(results.filter(Boolean)).toHaveLength(1);
    });
  });
}
```

- [ ] **步骤 2：运行 Redis 包测试并确认旧客户端接口不满足契约**

运行：`pnpm --filter @xlt-token/store-redis test`

预期：测试因缺少原子方法、返回类型或 `eval` 能力而失败。

- [ ] **步骤 3：使用 Redis 命令与 Lua 实现完整契约**

`setIfAbsent` 使用 `SET key value NX EX seconds`。`compareAndSet`、`compareAndDelete` 和需要保留 TTL 的更新使用单键 Lua 脚本；脚本只操作传入的一个 Redis key，因此兼容 Cluster。`scan` 每次返回一页和下一游标，不在一次调用中扫描整个集群。

- [ ] **步骤 4：在 MemoryStore、RedisStore 和 IORedisStore 上运行相同契约**

运行：`pnpm --filter @xlt-token/core test -- test/store`

运行：`pnpm --filter @xlt-token/store-redis test`

运行：`pnpm run check:boundaries`

预期：全部通过。

- [ ] **步骤 5：提交任务 2**

```bash
git add packages/store-contract packages/store-redis scripts/check-package-boundaries.mjs
git commit -m "feat(store): add shared atomic contract"
```

### 任务 3：生命周期配置与状态模型

**文件：**

- 新增：`packages/core/src/lifecycle/token-lifecycle.ts`
- 新增：`packages/core/src/lifecycle/token-state.ts`
- 修改：`packages/core/src/config/xlt-token-config.ts`
- 修改：`packages/core/src/time/duration.ts`
- 修改：`packages/core/src/config/xlt-token-keys.ts`
- 修改：`packages/core/src/index.ts`
- 新增测试：`packages/core/test/lifecycle/token-lifecycle.spec.ts`
- 修改测试：`packages/core/test/time/duration.spec.ts`

**接口：**

- 产出：`TokenLifecycleConfig`、`NormalizedTokenLifecycleConfig`、`RefreshResult`、`RevokeScope`、`TokenFamilyState`。
- 产出：`normalizeTokenLifecycleConfig(input)`。
- 消费：任务 1 的 TTL 类型。

- [ ] **步骤 1：编写配置边界失败测试**

```ts
it("拒绝 fixed 模式中的续签阈值", () => {
  expect(() => normalizeTokenLifecycleConfig({
    expiration: { mode: "fixed", ttl: "30m", renewWhenRemainingBelow: "5m" },
    refresh: { enabled: true, ttl: "7d", rotate: true, replayDetection: "family" },
  })).toThrowError(expect.objectContaining({ code: "CONFIG_INVALID" }));
});

it("为 sliding 模式计算 20% 默认阈值", () => {
  expect(normalizeTokenLifecycleConfig({
    expiration: { mode: "sliding", ttl: 100 },
    refresh: { enabled: false, ttl: "7d", rotate: true, replayDetection: "off" },
  }).expiration.renewWhenRemainingBelow).toBe(20);
});
```

- [ ] **步骤 2：运行测试并确认新配置不存在**

运行：`pnpm --filter @xlt-token/core test -- test/lifecycle/token-lifecycle.spec.ts`

预期：测试因模块或导出不存在而失败。

- [ ] **步骤 3：实现配置规范化、状态类型和键生成器**

`TokenFamilyState` 包含 `familyId`、`loginId`、`device`、`generation`、`status`、`accessExpiresAt` 和 `refreshExpiresAt`。键生成器用 `{familyId}` 哈希标签生成家族状态键和代次消费键。

- [ ] **步骤 4：运行生命周期配置测试与 Core 类型检查**

运行：`pnpm --filter @xlt-token/core test -- test/lifecycle test/time`

运行：`pnpm --filter @xlt-token/core typecheck`

预期：全部通过。

- [ ] **步骤 5：提交任务 3**

```bash
git add packages/core/src/lifecycle packages/core/src/config packages/core/src/time packages/core/src/index.ts packages/core/test/lifecycle packages/core/test/time
git commit -m "feat(core): define token lifecycle policy"
```

### 任务 4：刷新轮换、重放检测与统一撤销

**文件：**

- 新增：`packages/core/src/lifecycle/token-lifecycle-service.ts`
- 修改：`packages/core/src/auth/stp-logic.ts`
- 修改：`packages/core/src/auth/stp-util.ts`
- 修改：`packages/core/src/factory.ts`
- 修改：`packages/core/src/token/token-strategy.interface.ts`
- 新增测试：`packages/core/test/lifecycle/token-lifecycle-service.spec.ts`
- 修改测试：`packages/core/test/auth/stp-logic.spec.ts`
- 删除测试：`packages/core/test/auth/stp-logic.jwt.spec.ts`

**接口：**

- 消费：任务 1 的原子存储契约和任务 3 的生命周期模型。
- 产出：`refreshToken(token): Promise<RefreshResult>`。
- 产出：`revoke(target, scope): Promise<RevokeResult>`，重复撤销返回成功且 `alreadyRevoked: true`。

- [ ] **步骤 1：编写并发刷新与重放失败测试**

```ts
it("并发刷新只有一个成功且重放会撤销家族", async () => {
  const token = await logic.login("u1", { device: "pc" });
  const [first, second] = await Promise.all([
    logic.refreshToken(token),
    logic.refreshToken(token),
  ]);
  expect([first, second].filter((result) => result.ok)).toHaveLength(1);
  expect([first, second].find((result) => !result.ok)).toMatchObject({
    ok: false,
    code: "TOKEN_REPLAYED",
  });
});
```

- [ ] **步骤 2：运行测试并确认旧刷新逻辑不能满足并发语义**

运行：`pnpm --filter @xlt-token/core test -- test/lifecycle/token-lifecycle-service.spec.ts`

预期：旧 `refreshToken` 返回 `string | null`，测试失败。

- [ ] **步骤 3：实现原子刷新状态机、滑动续签和统一撤销**

刷新先验证家族状态，再通过 `compareAndSet` 将当前 generation 从 `active` 转为 `consumed`。失败分支重新读取状态并区分重放、撤销和过期。家族级重放检测通过原子状态更新将家族标记为 `revoked`。

- [ ] **步骤 4：运行 Core 生命周期、认证和会话测试**

运行：`pnpm --filter @xlt-token/core test`

运行：`pnpm --filter @xlt-token/core typecheck`

预期：全部通过，旧 JWT 专属 Core 测试已由策略无关生命周期测试替代。

- [ ] **步骤 5：提交任务 4**

```bash
git add packages/core/src packages/core/test
git commit -m "feat(core): add rotating token lifecycle"
```

### 任务 5：独立 JWT 包与密钥轮换

**文件：**

- 新增：`packages/jwt/package.json`
- 新增：`packages/jwt/tsconfig.json`
- 新增：`packages/jwt/tsdown.config.ts`
- 新增：`packages/jwt/vitest.config.ts`
- 新增：`packages/jwt/src/index.ts`
- 新增：`packages/jwt/src/jwt-strategy.ts`
- 新增：`packages/jwt/src/jwt-config.ts`
- 新增测试：`packages/jwt/test/jwt-strategy.spec.ts`
- 删除：`packages/nestjs/src/token/jwt-strategy.ts`
- 删除：`packages/nestjs/test/jwt-strategy.spec.ts`
- 修改：`packages/nestjs/src/index.ts`
- 修改：`packages/nestjs/package.json`
- 修改：`scripts/check-package-boundaries.mjs`

**接口：**

- 消费：Core 的 `TokenStrategy` 和生命周期 Token 元数据。
- 产出：设计文档定义的 `JwtKey`、`JwtStrategyConfig` 和 `JwtStrategy`。

- [ ] **步骤 1：编写配置校验与轮换失败测试**

```ts
it("新 activeKid 签发 Token，旧密钥仍可验证历史 Token", () => {
  const oldToken = oldStrategy.createToken("u1", config);
  const rotated = new JwtStrategy({ ...keyRing, activeKid: "new" });
  const newToken = rotated.createToken("u1", config);
  expect(rotated.verifyToken(oldToken).sub).toBe("u1");
  expect(decodeProtectedHeader(newToken).kid).toBe("new");
});

it.each(["missing-kid", "disallowed-algorithm", "weak-secret"])(
  "拒绝 %s",
  (fixture) => expect(() => createFixture(fixture)).toThrowError("CONFIG_INVALID"),
);
```

- [ ] **步骤 2：运行 JWT 包测试并确认包尚不存在**

运行：`pnpm --filter @xlt-token/jwt test`

预期：pnpm 报告找不到匹配包或测试模块不存在。

- [ ] **步骤 3：实现 key ring、kid 选择和算法白名单**

验证时先使用 `decode(token, { complete: true })` 读取 Header，只用匹配 `kid` 的 `verificationKey` 调用 `verify`，并传入单元素 `algorithms` 白名单。签发只使用 `activeKid` 对应的 `signingKey`。

- [ ] **步骤 4：移除 NestJS JWT 实现并运行相关测试**

运行：`pnpm --filter @xlt-token/jwt test`

运行：`pnpm --filter @xlt-token/jwt typecheck`

运行：`pnpm --filter @xlt-token/nestjs test`

运行：`pnpm run check:boundaries`

预期：全部通过。

- [ ] **步骤 5：提交任务 5**

```bash
git add packages/jwt packages/nestjs scripts/check-package-boundaries.mjs
git commit -m "feat(jwt): add managed key ring strategy"
```

### 任务 6：稳定错误码与脱敏审计事件

**文件：**

- 修改：`packages/core/src/exceptions/xlt-error.ts`
- 修改：`packages/core/src/exceptions/not-login.exception.ts`
- 修改：`packages/core/src/exceptions/not-permission.exception.ts`
- 修改：`packages/core/src/exceptions/not-role.exception.ts`
- 修改：`packages/core/src/exceptions/not-safe.exception.ts`
- 新增：`packages/core/src/events/xlt-audit-event.ts`
- 新增：`packages/core/src/events/xlt-event-sink.ts`
- 删除：`packages/core/src/hooks/xlt-hooks.interface.ts`
- 修改：`packages/core/src/auth/stp-logic.ts`
- 修改：`packages/core/src/factory.ts`
- 修改：`packages/express/src/error/map-xlt-error.ts`
- 修改：`packages/express/src/error/xlt-error-handler.ts`
- 修改：`packages/nestjs/src/xlt-token.module.ts`
- 新增测试：`packages/core/test/events/xlt-audit-event.spec.ts`
- 修改测试：`packages/express/test/xlt-error-handler.spec.ts`
- 修改测试：`packages/nestjs/test/lifecycle.e2e-spec.ts`

**接口：**

- 产出：`XltErrorCode`、`XltErrorDetails`、`XltAuditEvent`、`XltEventSink` 和 `XLT_EVENT_SINK`。
- 删除：`XltHooks` 和 `XLT_TOKEN_HOOKS`。

- [ ] **步骤 1：编写错误稳定性与事件脱敏失败测试**

```ts
it("刷新事件不包含原始 Token", async () => {
  const events: XltAuditEvent[] = [];
  const token = await logic.login("u1");
  await logic.refreshToken(token);
  expect(JSON.stringify(events)).not.toContain(token);
  expect(events).toContainEqual(expect.objectContaining({
    schemaVersion: 1,
    type: "token.refreshed",
    loginId: "u1",
  }));
});
```

- [ ] **步骤 2：运行事件和错误测试并确认旧 Hook 暴露 Token**

运行：`pnpm --filter @xlt-token/core test -- test/events`

预期：测试因事件接口不存在而失败。

- [ ] **步骤 3：实现稳定错误枚举、指纹和尽力投递事件**

Token 指纹使用 `createHash("sha256").update(token).digest("hex").slice(0, 16)`。事件对象只从明确允许的字段构造，不展开错误、请求或 JWT payload。

- [ ] **步骤 4：运行 Core、Express 与 NestJS 测试**

运行：`pnpm --filter @xlt-token/core test`

运行：`pnpm --filter @xlt-token/express test`

运行：`pnpm --filter @xlt-token/nestjs test`

预期：全部通过，适配器响应使用相同错误码。

- [ ] **步骤 5：提交任务 6**

```bash
git add packages/core packages/express packages/nestjs
git commit -m "feat(core): add stable errors and audit events"
```

### 任务 7：2.0 版本、迁移与公开文档

**文件：**

- 修改：`package.json`
- 修改：`packages/*/package.json`
- 修改：`examples/*/package.json`
- 修改：`pnpm-lock.yaml`
- 新增：`docs/guide/migration-2-0-p0.md`
- 修改：`docs/core/storage.md`
- 修改：`docs/core/jwt-strategy.md`
- 修改：`docs/core/hooks-and-observability.md`
- 修改：`docs/core/configuration.md`
- 修改：`docs/guide/engineering.md`
- 修改：`README.md`
- 修改：`CHANGELOG.md`

**接口：**

- 消费：任务 1 至 6 的最终公开 API。
- 产出：所有 workspace 包版本 `2.0.0` 和完整 1.x 迁移映射。

- [ ] **步骤 1：新增迁移示例的类型测试**

```ts
const result = await context.stpLogic.refreshToken(token);
if (!result.ok) {
  switch (result.code) {
    case "TOKEN_REPLAYED":
      break;
  }
}
```

- [ ] **步骤 2：运行文档类型测试并确认旧示例不再编译**

运行：`pnpm run typecheck`

预期：引用旧存储、JWT 或 Hook API 的示例失败。

- [ ] **步骤 3：更新版本、依赖范围、文档和迁移表**

迁移表逐项列出 1.x API、2.0 替代 API、行为差异和最小迁移代码。JWT 文档必须包含状态型 Token 与 JWT 决策表，以及双密钥轮换顺序。

- [ ] **步骤 4：运行类型检查和文档构建**

运行：`pnpm run typecheck`

运行：`pnpm run docs:build`

预期：全部通过。

- [ ] **步骤 5：提交任务 7**

```bash
git add package.json packages examples pnpm-lock.yaml docs README.md CHANGELOG.md
git commit -m "docs: add xlt-token 2.0 migration"
```

### 任务 8：覆盖率、基准、安全与发布自动化

**文件：**

- 修改：`packages/core/vitest.config.ts`
- 新增：`benchmarks/core.bench.ts`
- 新增：`benchmarks/baseline.json`
- 新增：`scripts/check-benchmark.mjs`
- 新增：`.changeset/config.json`
- 新增：`.changeset/README.md`
- 修改：`.github/workflows/ci.yml`
- 修改：`.github/workflows/publish.yml`
- 新增：`.github/workflows/security.yml`
- 修改：`package.json`
- 修改：`turbo.json`

**接口：**

- 产出：`pnpm benchmark`、`pnpm benchmark:check`、`pnpm changeset` 和来源证明发布流程。

- [ ] **步骤 1：先启用 90% Core 分支覆盖率并运行门禁**

```ts
coverage: {
  thresholds: { branches: 90, functions: 90, lines: 90, statements: 90 },
}
```

运行：`pnpm --filter @xlt-token/core test:cov`

预期：若覆盖不足则失败，并据报告补充缺失分支测试，不降低阈值。

- [ ] **步骤 2：添加确定性基准与 10% 比较器**

```json
{
  "loginOpsPerSecond": 1,
  "verifyOpsPerSecond": 1,
  "refreshOpsPerSecond": 1,
  "permissionOpsPerSecond": 1
}
```

比较器计算当前中位数相对基线的比例；任何指标 `< 0.9` 时退出码为 1。

- [ ] **步骤 3：添加 Changesets、安全检查与发布通道**

CI 增加 Node.js 20、22、24 矩阵、契约测试、基准、文档示例、依赖审查、许可证与密钥扫描。发布任务根据 semver prerelease 标识选择 `next`、`rc` 或 `latest`，并启用 npm provenance。

- [ ] **步骤 4：运行全部本地门禁**

运行：`pnpm run format`

运行：`pnpm run format:check`

运行：`pnpm run lint`

运行：`pnpm run typecheck`

运行：`pnpm run check:boundaries`

运行：`pnpm run test:all`

运行：`pnpm run build:workspace`

运行：`pnpm run docs:build`

运行：`pnpm run benchmark:check`

预期：全部通过。若 E2E 因沙箱禁止监听端口而失败，记录明确的环境限制，并确保单元、契约、类型与构建验证通过。

- [ ] **步骤 5：提交任务 8**

```bash
git add .changeset .github benchmarks scripts package.json turbo.json packages/core/vitest.config.ts
git commit -m "ci: enforce xlt-token 2.0 release gates"
```
