export type XltAuditEventType =
  | "token.logged_in"
  | "token.refreshed"
  | "token.logged_out"
  | "token.kicked_out"
  | "token.replaced"
  | "token.family_revoked";

export interface XltAuditEvent {
  schemaVersion: 1;
  type: XltAuditEventType;
  occurredAt: number;
  loginId?: string;
  device?: string;
  reason?: string;
  tokenFingerprint?: string;
  previousTokenFingerprint?: string;
  nextTokenFingerprint?: string;
  familyIdFingerprint?: string;
}
