export { AUDIT_LOG_SCHEMA, createConsoleLogger, createLoggerEventSink } from "./logger-sink.js";
export type {
  AuditLogLevel,
  AuditLogRecord,
  LoggerEventSinkOptions,
  StructuredLogger,
} from "./logger-sink.js";

export { composeEventSinks } from "./compose.js";
export type { ComposeEventSinksOptions } from "./compose.js";

export { createOpenTelemetryEventSink } from "./otel-sink.js";
export type { OpenTelemetryApiLoader, OpenTelemetryEventSinkOptions } from "./otel-sink.js";

export { auditEventAttributes, auditEventName, XLT_AUDIT_EVENT_PREFIX } from "./event-names.js";
