import type { XltAuditEvent } from "@xlt-token/core";

/** OTel 事件名 / Span 事件名统一前缀 */
export const XLT_AUDIT_EVENT_PREFIX = "xlt.";

/**
 * 稳定的 OTel 事件名：`xlt.<auditEventType>`，例如 `xlt.token.logged_in`。
 */
export function auditEventName(type: string): string {
  return `${XLT_AUDIT_EVENT_PREFIX}${type}`;
}

/**
 * 把审计事件映射为稳定的 OTel 属性集合。
 *
 * 只输出 schema 允许的字段（指纹与上下文），未知字段一律丢弃，
 * 保证导出数据不携带原始 Token 或请求上下文。
 */
export function auditEventAttributes(event: XltAuditEvent): Record<string, string | number> {
  const attributes: Record<string, string | number> = {
    "xlt.schema_version": event.schemaVersion,
  };

  if (event.loginId !== undefined) attributes["xlt.login_id"] = event.loginId;
  if (event.device !== undefined) attributes["xlt.device"] = event.device;
  if (event.reason !== undefined) attributes["xlt.reason"] = event.reason;
  if (event.tokenFingerprint !== undefined) {
    attributes["xlt.token_fingerprint"] = event.tokenFingerprint;
  }
  if (event.previousTokenFingerprint !== undefined) {
    attributes["xlt.previous_token_fingerprint"] = event.previousTokenFingerprint;
  }
  if (event.nextTokenFingerprint !== undefined) {
    attributes["xlt.next_token_fingerprint"] = event.nextTokenFingerprint;
  }
  if (event.familyIdFingerprint !== undefined) {
    attributes["xlt.family_id_fingerprint"] = event.familyIdFingerprint;
  }

  return attributes;
}
