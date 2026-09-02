---
title: 多实例与适配器契约
description: v2.2 冻结、v2.3 已实施的实例化契约：XltInstance 公开 API、适配器输入契约、默认实例兼容策略与迁移方向。
---

# 多实例与适配器契约

> **状态：** v2.3 已实施（OpenSpec 变更 `core-instance-contract` 落地为 Core 公开 API）。
> **实施边界：** `XltInstance` / `createXltInstance` / `setDefaultXltInstance` / `getDefaultXltInstance` 已在 `@xlt-token/core` 发布；适配器只允许依赖显式实例。
> **下游依赖：** v2.3 Fastify 适配器与 v2.4 Hono 适配器只依赖本文档定义的契约，不需要读取 `StpUtil`。

## 1. 问题陈述

`StpUtil` 是一个全静态门面，其背后是 `packages/core/src/auth/stp-util.ts` 中的模块级可变单例：

```ts
let _stpLogic: StpLogic | null = null;
let _stpPermLogic: StpPermLogic | null = null;

export function setStpLogic(stpLogic: StpLogic) { ... }
export function setStpPermLogic(stpPermLogic: StpPermLogic) { ... }
```

`createXltToken()` 每次调用都会**覆盖**该全局单例（factory.ts:45-46）。后果：

1. **多实例互相污染**：同一进程内创建两个实例（如不同 tokenName、不同 Store）时，后创建者抢占 `StpUtil`，先创建者的静态调用全部路由到错误实例。
2. **适配器隐式耦合**：未来 Fastify/Hono 插件若依赖 `StpUtil`，应用嵌入多个 xlt-token 实例时行为不可预测。
3. **测试隔离困难**：并行测试共享同一全局单例，存在交叉污染风险。

## 2. 调用点盘点（R2.1）

对 `StpUtil` 的全部静态依赖做了全仓盘点，结果分四类：

### 2.1 Core 包内部（替换影响：低）

| 位置 | 性质 | 替换影响 |
| --- | --- | --- |
| `packages/core/src/auth/stp-util.ts` | 单例定义 + 静态门面本体 | 契约改造的核心；保留为默认实例语法糖 |
| `packages/core/src/factory.ts:45-46` | 唯一的全局写入点（`setStpLogic` / `setStpPermLogic`） | 改为显式 `setDefaultInstance` 语义或移除隐式写入 |
| `packages/core/src/index.ts` | re-export | 无逻辑影响 |

`StpLogic` / `StpPermLogic` 本身已是普通实例类（构造注入 config + store + strategy + eventSink），**不依赖全局状态**。

### 2.2 NestJS / Express 适配器内部（替换影响：无）

| 位置 | 性质 |
| --- | --- |
| `packages/nestjs/src/index.ts`、`packages/express/src/index.ts` | 仅 re-export，无静态调用 |

两套适配器的运行时组件（`XltTokenGuard`、Express middleware）**已经**通过构造注入的 `StpLogic` 实例工作，`XltTokenModule` 通过 DI 提供实例。适配器内核天然符合目标架构，无需改写。

### 2.3 测试（替换影响：低）

| 位置 | 性质 |
| --- | --- |
| `packages/core/test/auth/stp-util.spec.ts` | 唯一直接测试静态门面的文件；通过 `setStpLogic` 注入 mock |

其余测试（core 单元、NestJS e2e、Express e2e）全部基于 `StpLogic` 实例，无静态依赖。

### 2.4 示例与文档（替换影响：仅演示代码）

| 位置 | 数量 |
| --- | --- |
| `examples/nestjs/src/**`（6 个 controller） | 22 处静态调用 |
| `examples/express/src/routes/**`（6 个路由文件） | 19 处静态调用 |
| `docs/`（core、guide、adapters 各文档） | ~40 处教学示例 |

示例与文档保持 `StpUtil` 写法不变（这正是兼容策略要保证的用法）；多实例章节按新契约演示。

**盘点结论：** 全仓 41 个业务调用点全部位于 examples；核心链路（Core 内核 + 适配器内核）已实例化。这使契约落地的主要工作集中在"默认实例管理规则"，而不是大规模改写。

## 3. 实例化公开契约（R2.2）——v2.3 已实施

以现有 `XltTokenContext`（factory.ts）为基础演进为 `XltInstance`。以下即 `packages/core/src/instance/xlt-instance.ts` 的实际公开 API（草案与实现一致）：

```ts
// packages/core/src/instance/xlt-instance.ts（v2.3 已落地）

import type { XltTokenConfig } from "../config/xlt-token-config.js";
import type { XltTokenStore } from "../store/xlt-token-store.interface.js";
import type { TokenStrategy } from "../token/token-strategy.interface.js";
import type { StpLogic } from "../auth/stp-logic.js";
import type { StpPermLogic } from "../auth/stp-perm-logic.js";

/**
 * 一个完整隔离的 xlt-token 认证实例。
 * 实例间不共享任何可变全局状态；Store 与 Strategy 由使用者显式提供。
 */
export interface XltInstance {
  /** 已归一化的配置快照（只读） */
  readonly config: XltTokenConfig;
  /** 该实例绑定的存储后端 */
  readonly store: XltTokenStore;
  /** 该实例的 token 生成策略（UUID / JWT / 自定义） */
  readonly strategy: TokenStrategy;
  /** 认证逻辑入口：login / logout / kickout / consumeTempToken / ... */
  readonly stpLogic: StpLogic;
  /** 权限逻辑入口：hasPermission / hasRole / ... */
  readonly stpPermLogic: StpPermLogic;
}

export interface CreateInstanceOptions {
  config?: Partial<XltTokenConfigInput>;
  store?: XltTokenStore;          // 缺省 MemoryStore（与现状一致）
  strategy?: TokenStrategy;        // 缺省 UuidStrategy
  stpInterface?: StpInterface;
  eventSink?: XltEventSink;
}

/**
 * 创建一个隔离实例。纯函数语义：不读取、不写入任何全局状态。
 * 预期与 createXltToken() 的唯一差异是不调用 setStpLogic/setStpPermLogic。
 */
export function createXltInstance(options?: CreateInstanceOptions): XltInstance;

/**
 * 显式把某个实例注册为默认实例（StpUtil 的委托目标）。
 * 后注册者覆盖先注册者——与现状一致，但从"隐式副作用"变为"显式声明"。
 */
export function setDefaultXltInstance(instance: XltInstance): void;

/**
 * 读取当前默认实例；未注册时抛出与现状一致的错误。
 */
export function getDefaultXltInstance(): XltInstance;
```

访问边界规则：

| 成员 | 边界 |
| --- | --- |
| `config` | 只读快照；实例创建后不支持原地变更 |
| `store` / `strategy` | 构造时绑定，实例上不再暴露替换方法 |
| `stpLogic` / `stpPermLogic` | 公开业务入口；适配器与业务代码只允许经由实例访问 |
| `StpUtil` | 不在 `XltInstance` 上；它只是"默认实例"的静态语法糖（见 §5） |

## 4. 适配器输入契约（R2.3）

Fastify / Hono / Elysia 的 plugin / middleware **只接收显式实例**，契约不引用任何框架实现类型：

```ts
// packages/core/src/instance/adapter-input.ts（规划路径）

/**
 * 框架适配器的统一输入。只依赖 core 自身类型，
 * 不 import fastify / hono / elysia 的任何符号。
 */
export interface XltAdapterOptions<TInstance extends XltInstance = XltInstance> {
  /** 必填：显式实例。适配器禁止读取默认实例或 StpUtil。 */
  instance: TInstance;
}

// Fastify（v2.3 已实现，@xlt-token/fastify）——使用方负责传入实例：
// fastify.register(xltFastifyPlugin, { instance })
//
// Hono（v2.4 规划）——中间件工厂接收实例：
// app.use("*", xltHonoMiddleware({ instance }))
```

约束：

1. **必填 `instance`**：适配器初始化时校验 `instance` 存在，缺失即抛错（配置级错误在启动阶段暴露，见 [Cookie 契约](./cookie-contract.md)的同类原则）。
2. **零框架类型引用**：契约文件只允许 import `@xlt-token/core` 的类型，保证 Fastify/Hono 插件可以并行开发而互不感知。
3. **禁止隐式回退**：适配器内部任何路径都不读取 `StpUtil` / `getDefaultXltInstance()`。

## 5. 默认实例兼容策略（R2.4）

`StpUtil` 的地位：**默认实例的语法糖，永久（v2.x ~ v3.x）保留**。

- `StpUtil.xxx()` ≡ `getDefaultXltInstance().stpLogic.xxx()`（权限方法委托 `stpPermLogic`）。
- NestJS 的 `XltTokenModule` 继续在初始化 provider 时注册默认实例——**既有 NestJS 代码零改写**。
- 未注册默认实例就调用 `StpUtil` 时，保持现有错误信息（`StpLogic not initialized. Please ensure XltTokenModule is imported correctly.`）。
- 多次 `setDefaultXltInstance` 的覆盖行为与现状 `createXltToken()` 的覆盖行为保持一致，避免引入新的隐式兼容问题。

## 6. 迁移方向（R2.5）

三种用法的边界与建议：

### 6.1 单实例（绝大多数用户，推荐现状即终态）

```ts
// 现状写法继续有效，无需任何迁移
createXltToken({ config: { tokenName: "authorization" }, store });
await StpUtil.login(10001);
```

### 6.2 多实例（同进程隔离）

现状的正确做法：**只使用返回的实例句柄，不碰 StpUtil**。

```ts
const adminAuth = createXltToken({ config: { tokenName: "admin-token" }, store });
const appAuth  = createXltToken({ config: { tokenName: "app-token" }, store: redisStore });

// 永远通过句柄调用：
await adminAuth.stpLogic.login("1");
await appAuth.stpLogic.login("2");
// 危险：StpUtil 现在指向 appAuth（最后创建者），不要在多实例进程中使用 StpUtil
```

**限制（v2.3 起）：** `createXltInstance()` 不再写入全局单例，多实例隔离由类型系统保证；`createXltToken()` 保持"构造默认实例的便捷工厂"语义（等价于 `createXltInstance()` + `setDefaultXltInstance()`），多实例进程中默认实例的指向仍由最后一次 `createXltToken()` / `setDefaultXltInstance()` 显式决定，不要在多实例进程中混用 `StpUtil`。

### 6.3 默认实例与多实例并存

```ts
// 显式声明谁是默认实例：
const appAuth = createXltInstance({ ... });
setDefaultXltInstance(appAuth);          // StpUtil → appAuth
const adminAuth = createXltInstance({ ... }); // 不影响默认实例
await StpUtil.login("u1");               // 路由到 appAuth
await adminAuth.stpLogic.login("u2");    // 路由到 adminAuth
```

| 场景 | 用法 | 限制 |
| --- | --- | --- |
| 单实例 | `createXltToken()` + `StpUtil` | 无 |
| 多实例 | `createXltInstance()` + 实例句柄 `stpLogic` / `stpPermLogic` | 勿混用 `StpUtil` |
| 并存 | `setDefaultXltInstance()` 显式声明默认 | 同一时刻只有一个默认实例 |

### 计划废弃项

- `createXltToken()` 的隐式全局写入：v2.3 起已改为"构造默认实例的便捷工厂"（等价于 `createXltInstance()` + `setDefaultXltInstance()`），语义向后兼容，不构成 breaking change；隐式覆盖行为以 deprecation 文档标注一个主版本。

## 7. 实施路线与门禁

| 阶段 | 内容 | 前置条件 |
| --- | --- | --- |
| v2.2（本文档） | 设计冻结 + 类型草案 + 兼容策略 | 已完成 |
| v2.3 | OpenSpec 变更 `core-instance-contract` 落地（`XltInstance` / `createXltInstance` / `setDefaultXltInstance` / `getDefaultXltInstance`） | 已完成 |
| v2.3 | Fastify 适配器按 §4 契约开发（`@xlt-token/fastify`） | 上一行变更归档 |
| v2.4 | Hono / Elysia 适配器按 §4 契约开发 | 同上 + [Cookie 契约决策](./cookie-contract.md) |
