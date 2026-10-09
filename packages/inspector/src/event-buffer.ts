import type { XltAuditEvent, XltEventSink } from "@xlt-token/core";

/** 带自增序号的审计事件；`seq` 是增量拉取游标 */
export interface EventBufferEntry extends XltAuditEvent {
  seq: number;
}

export interface EventBufferSnapshot {
  /** seq > afterSeq 的事件（新→旧） */
  events: EventBufferEntry[];
  /** 当前最大 seq，作为下一次 after */
  latest: number;
}

export interface EventBufferStats {
  tracked: number;
  capacity: number;
  latest: number;
  byType: Record<string, number>;
}

export interface EventBuffer {
  /** 挂进任意 eventSink 组合的 XltEventSink */
  readonly sink: XltEventSink;
  snapshot(afterSeq: number, limit?: number): EventBufferSnapshot;
  stats(): EventBufferStats;
}

export interface EventBufferOptions {
  /** 环形缓冲容量（保留最近 N 条），默认 500 */
  capacity?: number;
}

/**
 * 审计事件环形缓冲：把 push-only 的 `XltEventSink` 事件流
 * 变成可增量查询的内存时间线，供监控台轮询。
 * 事件由 Core 保证脱敏（仅含 token 指纹），buffer 不做二次处理。
 */
export function createEventBufferSink(options: EventBufferOptions = {}): EventBuffer {
  const capacity = Math.max(1, Math.floor(options.capacity ?? 500));
  const events: EventBufferEntry[] = [];
  let seq = 0;

  return {
    sink: {
      emit: (event: XltAuditEvent) => {
        events.unshift({ ...event, seq: ++seq });
        if (events.length > capacity) events.pop();
      },
    },
    snapshot: (afterSeq: number, limit = 100): EventBufferSnapshot => {
      const cappedLimit = Math.min(Math.max(1, limit), capacity);
      return {
        events: events.filter((entry) => entry.seq > afterSeq).slice(0, cappedLimit),
        latest: seq,
      };
    },
    stats: (): EventBufferStats => {
      const byType: Record<string, number> = {};
      for (const entry of events) byType[entry.type] = (byType[entry.type] ?? 0) + 1;
      return { tracked: events.length, capacity, latest: seq, byType };
    },
  };
}
