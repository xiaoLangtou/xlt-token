import type { XltAuditEvent, XltEventSink } from "@xlt-token/core";

const events: XltAuditEvent[] = [];

/** 最近 50 条脱敏审计事件，供 /admin/hooks 观测 */
export function getRecentHookEvents() {
  return [...events];
}

export function createAuditEventSink(): XltEventSink {
  return {
    emit: (event) => {
      events.unshift(event);
      if (events.length > 50) events.pop();
      console.log(`[audit:${event.type}]`, event);
    },
  };
}
