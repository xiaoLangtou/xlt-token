import { createEventBufferSink } from "@xlt-token/inspector";

/**
 * 演示用审计事件缓冲（@xlt-token/inspector 提供）。
 * 同一份缓冲同时供 /observability 快速面板与 /inspector 官方监控台消费。
 */
export const demoEventBuffer = createEventBufferSink({ capacity: 200 });
