import type { XltAuditEvent, XltEventSink } from "@xlt-token/core";

export interface ComposeEventSinksOptions {
  /**
   * 某个 sink 失败时的回调（同步抛出或 Promise 拒绝）。
   * 缺省时错误被吞掉：单个 sink 的故障不影响其他 sink 与认证流程。
   */
  onError?: (error: unknown, event: XltAuditEvent, sink: XltEventSink, index: number) => void;
}

/**
 * 组合多个事件导出器：事件按声明顺序分发给每个 sink。
 *
 * - 单个 sink 的同步异常或 Promise 拒绝都被隔离，不阻断后续 sink
 * - 未定义 `emit` 的 sink 会被跳过
 * - 组合结果本身遵循 `XltEventSink` 契约，可继续参与组合
 */
export function composeEventSinks(
  sinks: XltEventSink[],
  options: ComposeEventSinksOptions = {},
): XltEventSink {
  return {
    emit: (event: XltAuditEvent): void => {
      sinks.forEach((sink, index) => {
        const emit = sink.emit;
        if (!emit) return;

        try {
          const result = emit.call(sink, event);
          if (result instanceof Promise) {
            result.catch((error) => options.onError?.(error, event, sink, index));
          }
        } catch (error) {
          options.onError?.(error, event, sink, index);
        }
      });
    },
  };
}
