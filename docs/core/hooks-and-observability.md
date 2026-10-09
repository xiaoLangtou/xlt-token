---
title: Token 审计事件与观测性
description: 使用 XltEventSink 记录 xlt-token 的登录、登出和会话事件，在不暴露原始 Token 的前提下构建审计与监控。
---

# 审计事件与观测性

2.0 用 `XltEventSink` 取代 1.x 的 `XltHooks`。事件对象只包含明确允许的字段和 token 指纹，不包含原始 token、请求对象或 JWT payload。

## 注册事件投递器

```ts
import type { XltEventSink } from "@xlt-token/core";

const eventSink: XltEventSink = {
  emit(event) {
    auditLogger.info(event);
  },
};

createXltToken({ eventSink });
```

NestJS：

```ts
XltTokenModule.forRoot({
  eventSink,
});
```

## 官方导出器包

[@xlt-token/observability](https://www.npmjs.com/package/@xlt-token/observability) 提供开箱即用的事件导出器，Core 不引入任何遥测依赖：

- `createLoggerEventSink()`：把事件输出为结构化 JSON 日志（schema `xlt-token.audit.v1`，字段名稳定），可接入 pino / winston 等任意满足 `StructuredLogger` 接口的 logger。
- `composeEventSinks(sinks)`：把事件分发给多个导出器，单个导出器故障被隔离，不影响其他导出器与认证流程。
- `createOpenTelemetryEventSink()`（`@opentelemetry/api` 为可选 peer dependency）：Counter `xlt.audit.events`（按 `xlt.event` 属性区分）+ 活跃 Span 事件 `xlt.<type>`；可派生登录速率、刷新次数与认证异常计数。

```ts
import {
  composeEventSinks,
  createLoggerEventSink,
  createOpenTelemetryEventSink,
} from "@xlt-token/observability";

const otelSink = await createOpenTelemetryEventSink();
createXltToken({
  eventSink: composeEventSinks([createLoggerEventSink(), otelSink]),
});
```

所有导出器只读取 schema 允许的字段（指纹与上下文），未知字段一律丢弃，导出数据永不包含原始 Token；导出器异常通过 `onError` 观测，默认吞掉以保证认证主流程不受影响。

## 官方监控台

[@xlt-token/inspector](https://www.npmjs.com/package/@xlt-token/inspector) 提供开箱即用的 Web 监控台（单文件页面，零构建）：实时审计事件流、在线会话（分页 + 设备明细 + 指纹）、登录 / 刷新 / 异常指标卡。

```ts
import { createEventBufferSink, createInspectorBridge, mountInspectorOnFastify } from '@xlt-token/inspector';

const buffer = createEventBufferSink();
createXltToken({
  eventSink: composeEventSinks([buffer.sink, createLoggerEventSink()]),
});

mountInspectorOnFastify(app, createInspectorBridge({
  instance,
  buffer,
  auth: async (_req, ctx) => {
    const loginId = await instance.stpLogic.getLoginIdByToken(ctx.bearerToken ?? '');
    return loginId != null && instance.stpPermLogic.hasRole(String(loginId), 'admin');
  },
  allowMutations: false,
}));
```

安全边界：`auth` 回调为强制项（缺失时创建期报错）；默认只读，踢人 / 强制下线需显式 `allowMutations: true`；设备 token 仅以指纹输出。Express / NestJS 及其他框架的接入方式见包 README 与 `examples/nestjs`。

## 事件结构

```ts
interface XltAuditEvent {
  schemaVersion: 1;
  type:
    | "token.logged_in"
    | "token.refreshed"
    | "token.logged_out"
    | "token.kicked_out"
    | "token.replaced"
    | "token.family_revoked";
  occurredAt: number;
  loginId?: string;
  device?: string;
  reason?: string;
  tokenFingerprint?: string;
  previousTokenFingerprint?: string;
  nextTokenFingerprint?: string;
  familyIdFingerprint?: string;
}
```

指纹算法：`sha256(token).slice(0, 16)`。它用于关联事件，不用于认证。

事件投递是尽力而为：同步抛错或异步 reject 都不会影响登录、登出、踢人或刷新主流程。

## 在线观测 API

`StpLogic` 仍提供在线用户与设备查询：

```ts
await stp.getOnlineLoginIds({ page: 0, pageSize: 100 });
await stp.getOnlineCount();
await stp.getDeviceList("1001");
await stp.forceLogout("1001");
```

这些 API 依赖 Store 的 `scan(pattern, options)`。生产大规模在线列表建议使用 Redis Store，并控制扫描频率。
