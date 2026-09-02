# xlt-token 下一阶段执行路线图

> **规划日期：** 2026-09-01  
> **基线版本：** v2.1.1  
> **状态：** v2.2 已交付（2026-09-01）；v2.3 待立项

xlt-token 下一阶段先解决会影响所有适配器的架构决策，再交付框架适配器。多实例隔离与 Cookie 契约不直接增加用户功能，但会决定 Fastify、Hono 和后续运行时的实现方式，因此必须在 v2.2 冻结，避免后续返工。

## 目标与边界

本路线图以 v2.x 的非破坏性扩展为目标。Core 保持框架零依赖；框架集成、可观测性与存储实现通过独立 workspace 包提供。

本阶段不建设用户、角色或权限 CRUD，不提供管理后台，也不将项目扩展为 OAuth2/OIDC 服务端。OAuth2/OIDC 客户端与管理 API 属于后续可选能力。

## 当前项目进度表

| 能力域 | 当前状态 | 已交付内容 | 下一步 |
| --- | --- | --- | --- |
| Core 鉴权 | 已完成 | 登录、登出、续签、权限/角色、二级认证、临时 Token、临时 Token 原子消费、会话对象 | 维持回归与文档 |
| Token 生命周期 | 已完成 | access/refresh 生命周期、轮换、重放检测、Token family 撤销 | 维持回归与文档 |
| JWT | 已完成 | 独立包、`kid` 密钥轮换、算法白名单、黑名单撤销 | v2.5 评估 JWKS 与密钥运维 |
| 存储 | 已完成 | MemoryStore、node-redis、ioredis、原子 Store 契约（含 v2.2 `getAndDelete` 原子读取删除） | v2.5 Store 生态扩展 |
| NestJS | 已完成 | Module、Guard、Decorator，兼容 Nest Fastify 平台 | 维护兼容层 |
| Express | 已完成 | 中间件、路由策略、错误处理器 | 维护与 Core 的行为一致性 |
| 多实例与适配器契约 | v2.2 已完成（设计冻结） | 调用点盘点、`XltInstance` 类型草案、适配器输入契约、默认实例兼容策略与迁移方向（[多实例与适配器契约](../guide/multi-instance-contract.md)） | v2.3 前提交 `core-instance-contract` OpenSpec 变更并实施 |
| Cookie 契约 | v2.2 已决策 | **v2.x 保持同步 `HttpCookies.get`**，异步迁移推迟 v3.0；支持矩阵与 Hono/Elysia 初始化期拒绝规则（[Cookie 契约决策](../guide/cookie-contract.md)） | v2.4 Hono 按决策实现 |
| 原生 Fastify | 未开始 | 无独立包 | v2.3 交付 `@xlt-token/fastify` |
| 可观测性导出 | 基础已完成 | `XltEventSink` 提供脱敏审计事件 | v2.3 提供 OTel、日志与指标示例 |
| Hono | 未开始 | 无独立包 | v2.4 按 Cookie 决策交付 |
| 发布治理 | v2.2 已完成 | 三项 OpenSpec 变更归档、发布检查清单、CHANGELOG 手动维护流程（[发布检查清单](../guide/release-checklist.md)） | 每次发布按清单执行 |

## 优先级清单

| 优先级 | 功能 | 说明 |
| --- | --- | --- |
| P0 | 发布治理收口（限时 1–2 天） | 归档三项 OpenSpec 变更，补齐发布检查与变更日志流程；时间盒到期即收口。 |
| P0 | 多实例隔离与适配器契约设计 | 定义可注入实例接口，消除新适配器对 `StpUtil` 全局静态状态的依赖。 |
| P0 | Cookie 契约决策 | 明确 `HttpCookies` 是否异步；同步方案下，Hono/Elysia 仅支持 Header/Query。 |
| P1 | 临时 Token 原子消费与 Store 接口标准化 | 定义读取即销毁的统一 Store 操作。 |
| P1 | 原生 Fastify 适配器 | 基于已定实例化契约提供独立 `@xlt-token/fastify`。 |
| P1 | 可观测性导出器 | 复用 `XltEventSink`，提供 OTel、结构化日志和指标示例。 |
| P2 | Hono 适配器 | 基于 v2.2 契约与 Cookie 决策实现，并明确能力边界。 |
| P2 | 会话管理增强 | 支持按设备、时间、IP 查询与批量下线。 |
| P2 | JWT 密钥管理增强 | 支持 JWKS、密钥轮换监控、按 `kid` 失效与审计。 |
| P3 | 存储生态 | 增加 PostgreSQL、MongoDB、KeyDB/Valkey。 |
| P3 | 安全策略扩展 | 增加限流、失败计数、设备指纹和异常会话检测扩展点。 |
| P4 | 身份提供商集成 | 提供 OAuth2/OIDC 客户端集成。 |
| P4 | 管理端能力 | 提供独立管理 API 与示例，不内置业务后台。 |

## 版本节奏

```text
v2.2  发布治理 + 架构决策（多实例契约 / Cookie 决策）
      + 临时 Token 原子消费（含 Store 接口标准化）

v2.3  原生 Fastify + 可观测性导出器

v2.4  Hono（按 v2.2 决策交付）+ 会话管理增强

v2.5  JWKS/密钥运维 + 更多 Store

v2.6  安全策略扩展

v3.0  身份提供商集成 + 管理端能力；仅在异步 Cookie 契约无法在 v2.x 兼容时纳入 HttpContext breaking change
```

## 架构依赖关系

```text
发布治理 ──────────────────────────────────────────┐
多实例与适配器契约 ──┬──► 原生 Fastify ────────────┤
Cookie 契约决策 ─────┼──► Hono ────────────────────┤──► 发布
Store 原子读取并删除 ─┴──► 临时 Token 原子消费 ─────┤
XltEventSink ───────────► 可观测性导出器 ──────────┘
```

## v2.2 任务清单

v2.2 先解决架构约束，再交付低耦合的临时 Token 原子消费。除发布治理外，每项任务必须形成独立 OpenSpec 变更；Fastify/Hono 实现必须等待两项架构决定冻结。

### 发布治理收口（限时 1–2 天）✅ 已完成（2026-09-01）

- [x] 归档 `docs-eng-governance`、`fix-redis-store-cursor-type`、`jwt-lifecycle-logout-deps` 三项已完成 OpenSpec 变更。
- [x] 制定版本发布检查清单：依赖锁定、测试覆盖、breaking change 标注、构建与发布干跑。
- [x] 补齐 CHANGELOG 生成或维护流程，并确定手动维护或 Changesets 的责任边界。
- [x] 在第 2 个工作日结束时关闭本项；未完成的优化转为独立 backlog。

**验收条件：** 三项变更均被归档；发布检查清单可用于一次完整发布；CHANGELOG 维护责任明确。→ **已达成**：归档目录 `openspec/changes/archive/2026-09-01-*`，delta specs 同步到 `openspec/specs/`；清单见 [发布检查清单](../guide/release-checklist.md)（v2.2 发布已按清单全量走通，含发布干跑）；CHANGELOG 采用手动维护，触发时机 / 责任人 / 发布前校验已固化。

### 多实例隔离与适配器契约设计 ✅ 已完成（2026-09-01）

`createXltToken()` 当前会设置 `StpUtil` 的全局静态实例。新适配器应接收显式实例，而不是依赖该全局状态；`StpUtil` 仍作为默认实例的语法糖保留给现有 NestJS 用户。

- [x] 梳理 `StpUtil` 的全部全局静态调用点，产出依赖清单。
- [x] 设计 `XltInstance` 或 `createXltAuth()` 工厂接口，以及默认实例管理规则。
- [x] 定义 Fastify/Hono 的统一调用契约，先形成类型草案与伪代码，不依赖具体适配器实现。
- [x] 设计 `StpUtil` 默认实例兼容层，确保现有 NestJS 用法不发生破坏性变化。
- [x] 编写迁移文档草稿，记录新旧写法、可共存范围和计划废弃项。

**验收条件：** 设计文档包含公开接口、生命周期、默认实例规则、多实例示例和兼容性矩阵；Fastify/Hono 可以只依赖该契约开始开发。→ **已达成**：见 [多实例与适配器契约](../guide/multi-instance-contract.md)（§2 调用点盘点：全仓 41 个业务调用点均在 examples，适配器内核零静态依赖；§3 `XltInstance` 类型草案；§4 适配器输入契约零框架类型引用；§5 默认实例兼容；§6 迁移方向）。

### Cookie 契约决策 ✅ 已完成（2026-09-01）

`HttpCookies.get` 当前为同步接口，而 Hono/Elysia 的完整 Cookie 能力通常是异步的。该决定必须在 v2.2 固化，且不支持的 Cookie 模式不能静默失效。

| 方案 | 结果 | 版本影响 |
| --- | --- | --- |
| v2.x 保持同步 | Hono/Elysia 仅支持 Header/Query；Cookie 模式在初始化时显式拒绝 | 非破坏性 |
| 提前采用异步契约 | Core、NestJS、Express 与未来适配器统一异步 Cookie 读取 | 需要兼容方案或 v3.0 |

- [x] 评估将 `HttpCookies.get` 改为异步对 NestJS、Express 与 Core 调用链的影响面。
- [x] 选择同步或异步契约，并把理由、受影响 API 与版本策略写入 design 文档。
- [x] 若维持同步，在 Hono/Elysia 适配器初始化时检测 Cookie 配置并明确拒绝不支持模式。
- [x] 在适配器 README、能力矩阵和运行时错误中明确 Cookie 限制。

**验收条件：** 团队记录唯一的契约决定；每个新适配器都能由该决定推导支持矩阵；不支持的配置在初始化阶段得到明确反馈。→ **已达成**：**决策为 v2.x 保持同步**（异步迁移推迟至 v3.0），见 [Cookie 契约决策](../guide/cookie-contract.md)（§1 影响评估、§3 支持矩阵、§4 初始化期拒绝规则与错误文案——实现义务已写入 v2.4 Hono 任务清单）。

### 临时 Token 原子消费与 Store 接口标准化 ✅ 已完成（2026-09-01）

临时 Token 的“读取后再删除”不能保证一次性语义。Core 通过 `consumeTempToken()` 暴露业务 API，Store 通过原子读取并删除操作提供底层语义，未来 PostgreSQL、MongoDB 与 Redis 实现必须遵守同一契约。

- [x] 在 Store 契约中定义原子读取并删除方法及返回值语义，例如 `getAndDelete(key): Promise<StoreEntry \| null>`；最终命名在 proposal 中冻结。
- [x] 为 MemoryStore、RedisStore、IORedisStore 实现同一语义；Redis 使用 `GETDEL` 或 Lua 保证原子性。
- [x] 在 `StpLogic` 与 `StpUtil` 增加 `consumeTempToken(tempToken): Promise<string \| null>`。
- [x] 编写并发消费测试，断言同一 Token 仅一个调用方获得业务值。
- [x] 补齐过期、重复消费、JWT 策略和 Store 契约回归测试。
- [x] 更新二级认证、Core API、场景手册与示例。

**验收条件：** 并发消费同一 Token 时恰好一个调用返回原始业务值，其余调用返回 `null`；所有 Store 通过同一套契约测试；既有读取和删除 API 保持不变。→ **已达成**：方法名冻结为 `getAndDelete`（OpenSpec 变更 `temp-token-atomic-consume`）；Redis 实现用 Lua（`GET`+`TTL`+`DEL`，兼容全部支持 EVAL 的版本且保留 `expiresAt` 语义）；并发/过期/重复/JWT 一致性测试齐备（core 254 单测含 20 并发单赢家断言，三 Store 接入 `@xlt-token/store-contract` 同一套契约测试）；文档与示例已切换为原子消费写法。

### v2.2 进度表

| 阶段 | 计划内容 | 依赖 | 状态 |
| --- | --- | --- | --- |
| 第 1 周 | 发布治理时间盒；多实例调用点盘点；Cookie 影响评估；Store 原子 API proposal | 无 | ✅ 已完成 |
| 第 2 周 | 冻结多实例与 Cookie 决策；完成临时 Token API/Store 实现和并发测试 | 第 1 周决策 | ✅ 已完成 |
| 第 3 周 | 迁移文档草稿、适配器契约类型草案、临时 Token 文档与全量回归 | 决策与实现完成 | ✅ 已完成 |
| 发布门禁 | 质量检查、发布干跑、CHANGELOG 与 v2.2 发布说明 | 全部 v2.2 任务 | ✅ 已完成（`release:check` 全链路 + 7 包发布干跑通过，版本 2.2.0，CHANGELOG 与 `.github/releases/v2.2.0.md` 就绪） |

## v2.3 任务清单

### 原生 Fastify 适配器

- [ ] 基于 v2.2 实例契约创建 `@xlt-token/fastify` 包骨架。
- [ ] 使用 Fastify Hook 接入认证流程，并确定 `onRequest` 与 `preHandler` 的职责边界。
- [ ] 提供路由级权限配置 API，并与 Express/NestJS 的权限、角色和 Safe 语义一致。
- [ ] 补齐 `package.json`、构建、CI 与独立发布流程。
- [ ] 提供示例项目、README、类型扩展与 E2E。

**验收条件：** 纯 Fastify 项目不依赖 NestJS 即可接入；适配器只使用显式 `XltInstance`；支持矩阵遵循 v2.2 的 Cookie 决策。

### 可观测性导出器

- [ ] 基于 `XltEventSink` 定义 OpenTelemetry Span/Trace 事件映射。
- [ ] 定义结构化日志 JSON schema 与稳定字段名。
- [ ] 提供指标示例：登录成功率、Token 刷新次数、认证异常事件计数。
- [ ] 提供 Prometheus 或 OpenTelemetry Collector 对接示例。
- [ ] 为脱敏、事件覆盖与导出器异常隔离编写回归测试。

**验收条件：** 导出器不向 Core 引入遥测依赖；不输出原始 Token；每种审计事件均有稳定映射和示例。

## v2.4 任务清单

### Hono 适配器

- [ ] 基于 v2.2 实例契约与 Cookie 决策创建 `@xlt-token/hono`。
- [ ] 添加边缘运行时兼容性测试，覆盖 Cloudflare Workers、Deno Deploy 等目标运行时。
- [ ] 在 README 首屏给出能力声明；Cookie 受限时明确仅支持 Header/Query。
- [ ] 覆盖登录、权限、角色、Safe、JWT、错误响应和平台差异 E2E。

**验收条件：** 包的运行时依赖与支持范围和 v2.2 决策一致；不支持的模式在初始化时明确报错；边缘测试矩阵稳定通过。

### 会话管理增强

- [ ] 设计按设备、时间、IP 查询的会话 API 与隐私边界。
- [ ] 增加按用户和按设备的批量下线 API。
- [ ] 定义会话列表分页、过滤与排序参数。
- [ ] 为 Redis 与 MemoryStore 的扫描性能和一致性增加契约与集成测试。

**验收条件：** 查询 API 不暴露原始 Token；分页语义在所有 Store 一致；批量下线有审计事件与回归测试。

## v2.5 任务清单

### JWT 密钥管理增强（JWKS）

- [ ] 实现 JWKS 端点读取与缓存，支持 TTL 与按 `kid` 索引。
- [ ] 增加密钥轮换监控，检测 JWKS 更新并自动刷新缓存。
- [ ] 增加按 `kid` 的 Token 失效能力，使撤销记录与 `kid` 关联。
- [ ] 增加密钥使用审计，记录用于签发或验证的 `kid`，但不记录原始 Token。
- [ ] 在 design 中确定 JWKS 端点不可用时的安全策略，包括缓存有效期、拒绝条件与可观测性；实现必须遵循该策略。

**验收条件：** JWKS 缓存、轮换、按 `kid` 撤销和审计均有单元与集成测试；端点不可用时的行为可预测、可观测且由设计文档明确规定。

### 存储生态

- [ ] 定义 Store 能力矩阵，列出原子消费、TTL、分页扫描、批量操作与事务支持情况。
- [ ] 实现 PostgreSQL Store，并使用事务保证原子性。
- [ ] 实现 MongoDB Store，并使用 `findOneAndDelete` 等原子操作。
- [ ] 实现 KeyDB/Valkey Store，复用 Redis 协议兼容层并验证差异点。
- [ ] 用同一套 Store 一致性测试运行所有实现。
- [ ] 编写官方参考实现文档，说明自定义 Store 的接入方式。

**验收条件：** 每个官方 Store 都声明能力矩阵并通过适用的共享契约测试；不支持的语义在初始化和文档中明确说明。

## v2.6 任务清单

### 安全策略扩展

- [ ] 设计请求级限流扩展点，支持令牌桶、滑动窗口等可插拔策略。
- [ ] 增加登录失败计数器，支持按用户/IP 维度统计和锁定策略配置。
- [ ] 增加设备指纹采集与比对机制，并定义隐私与数据保留边界。
- [ ] 增加异常会话检测扩展点，例如异地登录与并发会话数异常。
- [ ] 将安全异常与现有 `XltEventSink` 打通，异常触发时产生脱敏事件。

**验收条件：** 所有策略默认 opt-in；安全事件不含原始认证凭据；每种策略包含关闭、阈值与审计测试。

## v3.0 任务清单

v3.0 提供主版本 breaking change 窗口。只有 v2.2 的 Cookie 决策无法用 v2.x 兼容方案实现时，才把 `HttpContext` 异步 Cookie 迁移纳入 v3.0。

### 身份提供商集成

- [ ] 实现 OAuth2 客户端集成，支持 Authorization Code 流程。
- [ ] 实现 OIDC 客户端集成，支持 ID Token 校验与 userinfo 端点对接。
- [ ] 提供 GitHub、Google 与企业内部 SSO 等常见 Provider 示例。
- [ ] 在边界文档中明确项目只提供 Client，不提供 OIDC Server。

### 管理端能力

- [ ] 提供独立于业务系统的在线会话查询 API。
- [ ] 提供审计事件查询与导出 API。
- [ ] 提供 Token family 状态查询 API，作为轮转链路可视化的数据源。
- [ ] 提供管理端示例项目；该项目只作为参考实现，不内置到认证库。

### HttpContext 契约变更（按需触发）

- [x] 若 v2.2 选择同步 Cookie 契约，则记录触发条件并保持本项未启动。→ **v2.2 已选择同步契约**（见 [Cookie 契约决策](../guide/cookie-contract.md)），本项保持未启动；触发条件：出现"必须异步 Cookie 才能实现"的主流运行时需求时，提前进入 v3.0 评审。
- [ ] 若 v2.2 选择异步 Cookie 契约，则将 `HttpCookies.get` 改为返回 `Promise`。（不适用——已选择同步）
- [ ] 评估并升级 NestJS、Express、Fastify 与 Hono 适配器。
- [ ] 提供 v2 到 v3 迁移指南；在可行时提供 codemod。

**验收条件：** v3 的 breaking change 有完整迁移路径；每个适配器的 Cookie 行为一致并经过跨框架回归测试。

## 执行规则

- 每个功能项先创建独立 OpenSpec proposal、design、specs 与 tasks，再进入实现。
- Fastify 和 Hono 不得在多实例契约与 Cookie 决策冻结前开始编码。
- 每个发布项必须包含单元测试、至少一个框架集成测试、文档、CHANGELOG 与发布干跑。
- 不启动前端或文档开发服务。需要验证时，只执行现有测试、类型检查、构建和发布干跑命令。
