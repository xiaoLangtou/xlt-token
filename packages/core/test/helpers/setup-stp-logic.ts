import type { XltTokenConfig } from "../../src/config/xlt-token-config.js";
import { DEFAULT_XLT_TOKEN_CONFIG } from "../../src/config/xlt-token-config.js";
import type { XltEventSink } from "../../src/events/xlt-event-sink.js";
import { StpLogic } from "../../src/auth/stp-logic.js";
import { MemoryStore } from "../../src/store/memory-store.js";
import { UuidStrategy } from "../../src/token/uuid-strategy.js";
import type { TokenStrategy } from "../../src/token/token-strategy.interface.js";

export function createStpLogic(
  options: {
    config?: Partial<XltTokenConfig>;
    eventSink?: XltEventSink;
    strategy?: TokenStrategy;
    store?: MemoryStore;
  } = {},
) {
  const config: XltTokenConfig = { ...DEFAULT_XLT_TOKEN_CONFIG, ...options.config };
  const store = options.store ?? new MemoryStore();
  const strategy = options.strategy ?? new UuidStrategy();
  const logic = new StpLogic(config, store, strategy, options.eventSink ?? {});
  return { logic, store, config, strategy };
}
