# xlt-token 2.0 P0 生产加固设计

## 状态

本文档定义 xlt-token 2.0.0 的 P0 发布范围。2.0 版本不再保留已弃用的存储、JWT、Hook 或生命周期 API，也不提供 1.x 兼容层。

## 目标

xlt-token 2.0 提供确定的存储语义、安全的 Token 轮换、可管理的 JWT 密钥、保护隐私的审计事件，以及可重复执行的发布门禁。本次发布不新增框架适配器，也不引入授权策略引擎。

## 核心决策

项目采用模块化架构：

- `@xlt-token/core` 负责认证状态转换、生命周期策略、错误、事件和存储契约。
- `@xlt-token/store-redis` 为 node-redis 和 ioredis 实现完整契约，包括支持 Redis 集群的原子操作。
- `@xlt-token/jwt` 负责 JWT 签发与验证，不依赖 NestJS 或 Express。
- `@xlt-token/store-contract` 为官方和第三方存储提供一套可复用的一致性测试套件。
- 框架适配器只使用 Core 和可选策略包公开的 API。

2.0 将移除 1.x 的 `XltTokenStore`、`JwtStrategy`、`jwt.secret`、携带原始 Token 的 Hook，以及返回 `null` 的刷新结果类型。

## 包边界

```text
@xlt-token/store-contract --> @xlt-token/core
@xlt-token/store-redis    --> @xlt-token/core
@xlt-token/jwt            --> @xlt-token/core
@xlt-token/express        --> @xlt-token/core
@xlt-token/nestjs         --> @xlt-token/core、可选策略包和存储包
xlt-token                 --> @xlt-token/core、@xlt-token/nestjs
```

Core 不得导入框架、Redis、JWT 实现、遥测或测试运行器相关的包。包边界检查必须禁止跨包源码导入，以及绕过包导出入口的内部导入。

## 存储契约

### 数据模型

每个存储值都带有明确的过期策略：

```ts
export type StoreTtl = { kind: "finite"; seconds: number } | { kind: "persistent" };

export interface StoreEntry {
  value: string;
  expiresAt: number | null;
}
```

有限 TTL 的秒数必须是大于零的整数。存储实现使用注入时钟或系统时钟计算 `expiresAt`；当 `now >= expiresAt` 时，该记录必须视为不可用。

### 必需操作

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

`setIfAbsent`、`compareAndSet` 和 `compareAndDelete` 必须针对单个逻辑键提供原子性。Redis 实现使用服务端命令或脚本，避免读、改、写过程跨越进程边界。Redis Cluster 实现使用由 Token 家族 ID 或登录 ID 生成的稳定哈希标签，确保一次原子状态转换涉及的键位于同一哈希槽。

契约测试必须覆盖过期边界、永久记录、比较失败、并发写入、删除竞争、游标扫描，以及操作抛出异常后的恢复。MemoryStore、RedisStore 和 IORedisStore 必须通过完全相同的行为断言。

## Token 生命周期

### 策略

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

固定过期模式不会在登录后延长访问 Token 的有效期，并且拒绝 `renewWhenRemainingBelow` 配置。滑动过期模式要求 TTL 为有限正数；当剩余 TTL 小于或等于 `renewWhenRemainingBelow` 时，系统续签服务端状态。默认阈值为配置 TTL 的 20%，向下取整后最少为 1 秒。刷新操作始终轮换当前 Token；2.0 不支持不轮换的刷新方式。

每次登录都会创建一个 Token 家族，其中包含随机家族 ID 和代次编号。刷新成功时，系统以原子方式消费第 `n` 代 Token，并创建第 `n + 1` 代 Token。当重放检测设为 `family` 时，重复使用已消费的代次会撤销整个 Token 家族。当重放检测设为 `off` 时，重复使用会返回稳定的失败结果，但不会改变当前有效代次。

### 结果与撤销

生命周期方法使用可辨识联合类型返回结果，不再使用 `null` 或含义不明确的布尔值：

```ts
export type RefreshResult =
  | { ok: true; token: string; expiresAt: number | null }
  | { ok: false; code: "REFRESH_DISABLED" | "TOKEN_INVALID" | "TOKEN_EXPIRED" | "TOKEN_REPLAYED" | "TOKEN_REVOKED" };

export type RevokeScope = "token" | "family" | "device" | "login";
```

撤销操作必须先写入明确的状态转换，再删除二级索引。重复执行撤销时，系统应识别相同的终止状态并以幂等方式成功返回。测试必须覆盖同时刷新、超时边界、索引部分清理、存储异常和重复撤销。

## JWT 安全治理

### 包与配置

`@xlt-token/jwt` 导出与框架无关的 `JwtStrategy`。该包使用显式密钥环配置：

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

构造函数必须拒绝以下配置：重复或为空的 `kid`、不存在的活动密钥、缺少签名材料的活动密钥、未列入白名单的算法、混用对称与非对称密钥材料，以及空密钥。HMAC 密钥短于 32 字节时必须拒绝启动。

每个新 JWT 都必须包含活动 `kid`、`jti`、主体、签发时间和配置的过期时间。验证过程先读取 `kid` 选择密钥，再将验证算法限制为该密钥配置的算法；缺少 `kid` 的 Token 必须验证失败。密钥轮换通过修改 `activeKid` 完成，旧验证密钥保留到该密钥签发的所有 Token 全部过期。

NestJS 包移除内部 JWT 实现，也不再重新导出 JWT 类。应用必须显式安装并提供 `@xlt-token/jwt`。

## 错误与审计事件

### 稳定错误

Core 导出字符串枚举 `XltErrorCode`。每种公开失败都必须具备稳定错误码、建议的 HTTP 状态码和安全的公开详情。错误消息保持清晰，但不属于兼容性契约。

2.0 错误码集合包括：`TOKEN_MISSING`、`TOKEN_INVALID`、`TOKEN_EXPIRED`、`TOKEN_REVOKED`、`TOKEN_REPLAYED`、`LOGIN_REPLACED`、`LOGIN_KICKED_OUT`、`PERMISSION_DENIED`、`ROLE_DENIED`、`SAFE_REQUIRED`、`REFRESH_DISABLED`、`STORE_CONFLICT` 和 `CONFIG_INVALID`。新增错误码属于向后兼容变更；重命名错误码或改变现有错误码含义需要发布新的主版本。

```ts
export interface XltErrorDetails {
  loginType?: string;
  permission?: string;
  role?: string;
  business?: string;
}
```

错误详情不得包含原始 Token、JWT 载荷、密钥、Secret、Cookie 或 Authorization 请求头。

### 版本化事件

Core 使用统一事件接收器替代携带原始 Token 的生命周期 Hook：

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

`tokenFingerprint` 是截断后的不可逆 SHA-256 摘要，仅用于关联事件。事件采用尽力投递模式，投递结果不会改变认证操作结果。Core 捕获事件接收器异常，并将异常发送到可选诊断回调；诊断回调同样不得接收敏感信息。

## 质量与工程化门禁

### 测试分层

- 单元测试覆盖 Core 状态转换、JWT 配置校验、错误模型和事件脱敏。
- 共享存储契约测试同时验证 MemoryStore、RedisStore 和 IORedisStore。
- 并发测试覆盖登录顶替、刷新竞争、撤销竞争、滑动续签和 Redis 故障恢复。
- 适配器 E2E 测试验证 NestJS 与 Express 返回一致的公开错误码和生命周期行为。
- 文档示例必须基于包公开导出完成编译。

Core 分支覆盖率不得低于 90%。其他包根据适配器功能范围配置明确的覆盖率阈值。

### 性能基准

确定性基准套件使用 MemoryStore 记录登录、Token 验证、刷新和权限检查的吞吐量。CI 对多个样本的中位数与仓库内基线进行比较。性能退化超过 10% 时，基准任务必须失败；只有在拉取请求中明确说明原因并更新基线后才可接受退化。

### CI 与供应链

拉取请求必须执行格式检查、Lint、类型检查、包边界检查、单元测试、契约测试、E2E 测试、覆盖率检查、构建、文档编译、密钥扫描、依赖审查和许可证检查。兼容矩阵覆盖 Node.js 20、22 和 24，以及支持范围内的框架和 Redis 客户端主版本。

发布流程使用固定版本的 GitHub Action，并通过启用来源证明的方式发布 npm 包。构建产物、包清单、校验和、基准结果和测试报告必须保留在对应标签的 GitHub Release 中。

### 版本与发布

项目使用 Changesets 管理包版本和变更日志。发布流程根据预发布状态选择 npm 标签：

- `2.0.0-next.n` 使用 `next` 标签发布。
- `2.0.0-rc.n` 使用 `rc` 标签发布。
- `2.0.0` 只有在 RC 可用时间不少于 7 天后，才使用 `latest` 标签发布。

回退时，将 `latest` 重新指向上一个稳定版本，并在包内容存在缺陷时发布修复补丁。npm 包版本不可变，也不得重复使用。

## 迁移

迁移指南必须将每个被删除的 1.x API 映射到对应的 2.0 替代方案。指南涵盖存储适配器改造、JWT 密钥环配置、生命周期策略示例、新结果类型处理、事件接收器迁移、安装包变化和回退操作。

指南必须明确比较状态型不透明 Token 与 JWT。不透明 Token 仍是默认方案，适合需要即时撤销和简化密钥管理的场景。只有当独立验证声明带来的收益足以抵消密钥轮换和重放管理成本时，才应选择 JWT。

## 验收标准

满足以下全部条件后，P0 范围才算完成：

1. MemoryStore、RedisStore 和 IORedisStore 通过相同的契约与并发测试套件。
2. 固定过期、滑动过期、刷新轮换、家族级重放检测和所有撤销范围通过时钟边界与重试测试。
3. JWT 密钥轮换期间，保留密钥签发的 Token 继续有效；缺少 `kid`、使用非白名单算法、使用弱密钥或配置无效时必须拒绝处理。
4. 所有公开认证失败都使用文档化的稳定错误码。
5. 审计事件覆盖登录、刷新、重放、撤销、登出和二级认证，并且不暴露 Token 材料。
6. CI 强制执行分支覆盖率、10% 性能回退限制、包边界、安全检查、发布来源证明和声明的兼容矩阵。
7. 1.x 到 2.0 迁移指南、安全说明、发布与回退说明及 Token 选型文档均能成功构建。

## 范围外事项

P0 不新增 Fastify、Hono、Koa、OpenTelemetry 导出器、OAuth/OIDC 身份提供商、管理后台或策略引擎。这些功能需要在 2.0 生产加固版本完成后，作为独立工作继续推进。
