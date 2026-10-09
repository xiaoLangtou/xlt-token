import type { XltAuditEvent, XltEventSink } from "@xlt-token/core";
import { auditEventAttributes, auditEventName } from "./event-names.js";

type OpenTelemetryApi = typeof import("@opentelemetry/api");

export type OpenTelemetryApiLoader = () => Promise<OpenTelemetryApi>;

const defaultLoader: OpenTelemetryApiLoader = () => import("@opentelemetry/api");

export interface OpenTelemetryEventSinkOptions {
  /** 是否上报审计事件计数指标（默认开启） */
  metrics?: boolean;
  /** 是否把审计事件写入当前活跃 Span（默认开启） */
  spanEvents?: boolean;
  /** Meter 名称，默认 `@xlt-token/observability` */
  meterName?: string;
  /** 导出失败回调；缺省时错误被吞掉，绝不影响认证流程 */
  onError?: (error: unknown, event: XltAuditEvent) => void;
}

const COUNTER_NAME = "xlt.audit.events";
const COUNTER_DESCRIPTION = "xlt-token audit event count by event type";
const METRIC_EVENT_ATTRIBUTE = "xlt.event";

type EventCounter = { add(value: number, attributes?: Record<string, string>): void };

/**
 * 创建 OpenTelemetry 事件导出器（`@opentelemetry/api` 为可选 peer dependency）。
 *
 * 指标：单一 Counter `xlt.audit.events`，按 `xlt.event` 属性区分事件类型，
 * 可派生登录成功率（`token.logged_in` 速率）、Token 刷新次数（`token.refreshed`）、
 * 认证异常计数（`token.kicked_out` / `token.replaced` / `token.family_revoked` 之和）。
 *
 * 追踪：当存在活跃 Span 时，事件以 `xlt.<type>` Span 事件写入，
 * 属性只包含 schema 允许的字段（指纹），不含原始 Token。
 *
 * 失败隔离：指标与 Span 事件分别隔离，单个失败不互相影响，
 * 更不会影响认证结果。未安装 `@opentelemetry/api` 时创建阶段抛出明确错误。
 */
export async function createOpenTelemetryEventSink(
  options: OpenTelemetryEventSinkOptions = {},
  loadApi: OpenTelemetryApiLoader = defaultLoader,
): Promise<XltEventSink> {
  let api: OpenTelemetryApi;
  try {
    api = await loadApi();
  } catch {
    throw new Error(
      'createOpenTelemetryEventSink requires "@opentelemetry/api". Install it with: pnpm add @opentelemetry/api',
    );
  }

  const { metrics = true, spanEvents = true, meterName = "@xlt-token/observability" } = options;

  let counter: EventCounter | undefined;
  if (metrics) {
    try {
      counter = api.metrics.getMeter(meterName).createCounter(COUNTER_NAME, {
        description: COUNTER_DESCRIPTION,
      }) as unknown as EventCounter;
    } catch {
      counter = undefined;
    }
  }

  return {
    emit: (event: XltAuditEvent): void => {
      if (counter) {
        try {
          counter.add(1, { [METRIC_EVENT_ATTRIBUTE]: event.type });
        } catch (error) {
          options.onError?.(error, event);
        }
      }

      if (spanEvents) {
        try {
          api.trace
            .getActiveSpan()
            ?.addEvent(auditEventName(event.type), auditEventAttributes(event));
        } catch (error) {
          options.onError?.(error, event);
        }
      }
    },
  };
}
