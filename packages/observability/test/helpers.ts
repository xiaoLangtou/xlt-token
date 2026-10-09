import type { XltAuditEvent } from "@xlt-token/core";

export function auditEvent(overrides: Partial<XltAuditEvent> = {}): XltAuditEvent {
  return {
    schemaVersion: 1,
    type: "token.logged_in",
    occurredAt: 1728300000000,
    ...overrides,
  };
}
