# 审计事件与观测性

2.0 用 `XltEventSink` 取代 1.x 的 `XltHooks`。事件对象只包含明确允许的字段和 token 指纹，不包含原始 token、请求对象或 JWT payload。

## 注册事件投递器

```ts
import type { XltEventSink } from '@xlt-token/core';

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

## 事件结构

```ts
interface XltAuditEvent {
  schemaVersion: 1;
  type: 'token.logged_in' | 'token.refreshed' | 'token.logged_out' | 'token.kicked_out' | 'token.replaced' | 'token.family_revoked';
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
await stp.getDeviceList('1001');
await stp.forceLogout('1001');
```

这些 API 依赖 Store 的 `scan(pattern, options)`。生产大规模在线列表建议使用 Redis Store，并控制扫描频率。
