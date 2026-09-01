---
title: Cookie 契约决策
description: v2.2 冻结的决策：v2.x 保持同步 HttpCookies 契约、异步迁移评估、Token 来源支持矩阵与 Hono/Elysia 的初始化期拒绝规则。
---

# Cookie 契约决策

> **状态：** v2.2 已冻结的唯一方案（ADR）。团队不再保留备选方案；支持矩阵、文档与运行时校验都必须遵循本决策。
> **决策：** **v2.x 保持同步 Cookie 契约。** 异步迁移推迟到 v3.0 主版本，且必须通过独立 OpenSpec 变更评审后才启动。

## 1. 背景与影响评估（R3.1）

当前契约（`packages/core/src/http/context.ts`）：

```ts
export interface HttpCookies {
  get(name: string): string | null;   // 同步
}
```

若将 `HttpCookies.get` 改为 `Promise<string | null>`，影响面如下：

| 层 | 影响点 | 程度 |
| --- | --- | --- |
| Core | `StpLogic.getTokenValue(ctx)` 的 Header→Cookie→Query 读取链需要逐段 `await`（方法本身已是 async，但接口语义反转） | 中 |
| Core | `HttpContext` 全部实现者（`createExpressContext`、`createMockHttpContext`）需同步改签名 | 中 |
| NestJS | `nest-bridge.ts` 的 cookies 访问器需改为 async；`XltTokenGuard` 调用链不变但类型收窄 | 中 |
| Express | `http/express.ts` 的 `req.cookies` 访问需包 async | 低 |
| 测试 | `createMockHttpContext`、全部 Cookie 相关单测/e2e 的 mock 与断言 | 高（量大） |
| 文档 | 所有提及 Cookie 读取的指南与示例 | 高（量大） |
| 既有自定义 HttpContext 实现 | **breaking**：第三方实现同步接口的代码全部失效 | 高 |

关键结论：同步改异步是一次**破坏性契约变更**（对自定义 HttpContext 实现者必然 breaking），收益却只在"Hono/Elysia 的完整 Cookie 能力（如签名验证）"这一尚未落地的场景。以 v3.0 为界做异步迁移，v2.x 内保持同步。

## 2. 决策与版本策略（R3.2）

**决策：v2.x 保持同步。**

| 维度 | 内容 |
| --- | --- |
| 版本边界 | v2.2 ~ v2.x 所有版本：`HttpCookies.get` 保持 `string \| null` 同步签名 |
| 异步迁移 | 推迟至 v3.0；届时通过独立 OpenSpec 变更评审，设计双写过渡期（同步/异步重载探测），保证迁移路径 |
| 决策一致性 | 后续 Fastify（v2.3）/ Hono（v2.4）适配器的 Cookie 能力都从本决策推导，不单独再议 |
| 反悔条件 | 仅当出现"必须异步 Cookie 才能实现"的主流运行时需求时，提前进入 v3.0 评审；不在未决状态下开发 Hono Cookie 支持 |

## 3. Token 来源支持矩阵（R3.3）

| Token 来源 | NestJS（Express） | NestJS（Fastify） | Express | Fastify 适配器（v2.3 计划） | Hono / Elysia 适配器（v2.4 计划） |
| --- | --- | --- | --- | --- | --- |
| Header（默认） | ✅ | ✅ | ✅ | ✅ | ✅ |
| Query | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cookie | ✅ 需 `cookie-parser` | ✅ 需 `@fastify/cookie` | ✅ 需 `cookie-parser` | ✅ 同步读取（需 `@fastify/cookie`） | ❌ 初始化阶段明确拒绝 |

说明：

- Fastify 的 `request.cookies`（`@fastify/cookie`）是同步对象，满足同步契约，因此 v2.3 Fastify 适配器可支持 Cookie。
- Hono / Elysia 的**完整** Cookie 能力（签名、加密验证）依赖异步流程，与 v2.x 同步契约不兼容。为保证"一次性明确失败"而非"请求期不确定行为"，v2.4 适配器**只支持 Header / Query**。

## 4. 限制行为（R3.4）

Hono / Elysia 适配器在**初始化阶段**（插件注册时，而非请求期间）执行配置校验：

1. 检测到 `isReadCookie: true`（或等价的 Cookie 来源配置）时立即抛错，错误信息包含：
   - 明确的能力边界：`Hono/Elysia adapter only supports Header and Query token sources.`
   - 修复建议：`Set isReadCookie: false and use Header or Query, or use the NestJS/Express/Fastify adapter for Cookie support.`
2. 校验属于**配置级测试**的必测场景（PRD 非功能需求"适配器限制必须有配置级测试"）。
3. 适配器 README、能力矩阵与运行时错误信息三处保持同一表述，避免文档与实现漂移。

## 5. 推导出的适配器义务

| 适配器 | Cookie 义务 |
| --- | --- |
| NestJS / Express（现状） | 无变化，继续支持三种来源 |
| Fastify（v2.3） | Cookie 走同步 `@fastify/cookie`；签名/加密等异步特性不做承诺 |
| Hono / Elysia（v2.4） | 实现初始化期拒绝（§4）；README 的支持矩阵标注 ❌ |
