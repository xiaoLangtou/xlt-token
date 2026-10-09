import type { XltAuditEvent, XltAuditEventType, XltEventSink } from "@xlt-token/core";

/**
 * 结构化日志 JSON schema 标识。字段集与语义以 README 中的 schema 表为准，
 * 新增字段必须提升 schema 版本。
 */
export const AUDIT_LOG_SCHEMA = "xlt-token.audit.v1";

export type AuditLogLevel = "debug" | "info" | "warn" | "error";

/**
 * 结构化日志记录。字段名为稳定契约（snake_case），
 * 仅包含 XltAuditEvent 允许的字段——不含原始 Token。
 */
export interface AuditLogRecord {
  schema: typeof AUDIT_LOG_SCHEMA;
  event: XltAuditEventType;
  /** ISO 8601 时间戳 */
  occurred_at: string;
  /** 毫秒时间戳（与 `occurredAt` 一致，便于数值排序） */
  occurred_at_ms: number;
  login_id?: string;
  device?: string;
  reason?: string;
  token_fingerprint?: string;
  previous_token_fingerprint?: string;
  next_token_fingerprint?: string;
  family_id_fingerprint?: string;
}

/**
 * 最小结构化 logger 接口。pino / winston 等常见 logger
 * 的 `logger.info(record)` 风格方法天然满足该接口。
 */
export interface StructuredLogger {
  debug?(fields: AuditLogRecord): void;
  info?(fields: AuditLogRecord): void;
  warn?(fields: AuditLogRecord): void;
  error?(fields: AuditLogRecord): void;
}

const DEFAULT_SEVERITY: Record<XltAuditEventType, AuditLogLevel> = {
  "token.logged_in": "info",
  "token.refreshed": "info",
  "token.logged_out": "info",
  "token.kicked_out": "warn",
  "token.replaced": "warn",
  "token.family_revoked": "warn",
};

export interface LoggerEventSinkOptions {
  /** 目标 logger，默认输出 JSON 行到 console */
  logger?: StructuredLogger;
  /** 按事件类型覆盖日志级别（与默认级别合并） */
  severity?: Partial<Record<XltAuditEventType, AuditLogLevel>>;
  /** 记录失败回调；缺省时错误被吞掉，绝不影响认证流程 */
  onError?: (error: unknown, event: XltAuditEvent) => void;
}

/**
 * 创建输出 JSON 行到 console 的默认 logger。
 */
export function createConsoleLogger(): StructuredLogger {
  const write = (method: "log" | "info" | "warn" | "error" | "debug", fields: AuditLogRecord) => {
    const line = JSON.stringify(fields);
    const fn = console[method] ?? console.log;
    fn.call(console, line);
  };

  return {
    debug: (fields) => write("debug", fields),
    info: (fields) => write("info", fields),
    warn: (fields) => write("warn", fields),
    error: (fields) => write("error", fields),
  };
}

function buildRecord(event: XltAuditEvent): AuditLogRecord {
  const record: AuditLogRecord = {
    schema: AUDIT_LOG_SCHEMA,
    event: event.type,
    occurred_at: new Date(event.occurredAt).toISOString(),
    occurred_at_ms: event.occurredAt,
  };

  if (event.loginId !== undefined) record.login_id = event.loginId;
  if (event.device !== undefined) record.device = event.device;
  if (event.reason !== undefined) record.reason = event.reason;
  if (event.tokenFingerprint !== undefined) record.token_fingerprint = event.tokenFingerprint;
  if (event.previousTokenFingerprint !== undefined) {
    record.previous_token_fingerprint = event.previousTokenFingerprint;
  }
  if (event.nextTokenFingerprint !== undefined) {
    record.next_token_fingerprint = event.nextTokenFingerprint;
  }
  if (event.familyIdFingerprint !== undefined) {
    record.family_id_fingerprint = event.familyIdFingerprint;
  }

  return record;
}

/**
 * 创建结构化日志事件导出器。
 *
 * - 每个 `XltAuditEventType` 都映射到固定字段集（snake_case）
 * - 未知 / 额外字段一律丢弃（脱敏边界）
 * - logger 异常被隔离：不影响认证流程，可通过 `onError` 观测
 */
export function createLoggerEventSink(options: LoggerEventSinkOptions = {}): XltEventSink {
  const logger = options.logger ?? createConsoleLogger();
  const severity = { ...DEFAULT_SEVERITY, ...options.severity };

  return {
    emit: (event: XltAuditEvent): void => {
      try {
        const record = buildRecord(event);
        const level = severity[event.type] ?? "info";
        const writer = logger[level] ?? logger.info;
        writer?.call(logger, record);
      } catch (error) {
        options.onError?.(error, event);
      }
    },
  };
}
