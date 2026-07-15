import type { XltAuditEvent, XltEventSink } from "@xlt-token/express";

const events: XltAuditEvent[] = [];

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
