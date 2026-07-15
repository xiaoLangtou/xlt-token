import type { XltAuditEvent } from "./xlt-audit-event.js";

export interface XltEventSink {
  emit?: (event: XltAuditEvent) => void | Promise<void>;
}

export const XLT_EVENT_SINK = "XLT_EVENT_SINK";
