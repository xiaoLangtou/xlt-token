import { describe, expect, it, vi } from "vitest";
import type { XltAuditEvent, XltEventSink } from "@xlt-token/core";
import { composeEventSinks } from "../src/index.js";
import { auditEvent } from "./helpers.js";

const flushMicrotasks = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("composeEventSinks", () => {
  it("dispatches events to every sink in order", () => {
    const calls: string[] = [];
    const sinkA: XltEventSink = { emit: () => void calls.push("a") };
    const sinkB: XltEventSink = { emit: () => void calls.push("b") };
    const sinkC: XltEventSink = { emit: () => void calls.push("c") };

    const composed = composeEventSinks([sinkA, sinkB, sinkC]);
    const event = auditEvent({ loginId: "1001" });
    composed.emit?.(event);

    expect(calls).toEqual(["a", "b", "c"]);
  });

  it("skips sinks without an emit handler", () => {
    const emit = vi.fn();
    const composed = composeEventSinks([{}, { emit } as XltEventSink, { emit } as XltEventSink]);

    expect(() => composed.emit?.(auditEvent())).not.toThrow();
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it("isolates synchronous sink failures and keeps dispatching", () => {
    const onError = vi.fn();
    const goodSink = vi.fn();
    const failingSink: XltEventSink = {
      emit: () => {
        throw new Error("boom");
      },
    };

    const composed = composeEventSinks([failingSink, { emit: goodSink }], { onError });
    const event = auditEvent();

    expect(() => composed.emit?.(event)).not.toThrow();
    expect(goodSink).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    const [error, reportedEvent, sink, index] = onError.mock.calls[0];
    expect((error as Error).message).toBe("boom");
    expect(reportedEvent).toBe(event);
    expect(sink).toBe(failingSink);
    expect(index).toBe(0);
  });

  it("isolates rejected async sinks via onError", async () => {
    const onError = vi.fn();
    const goodSink = vi.fn();
    const failingSink: XltEventSink = {
      emit: () => Promise.reject(new Error("async boom")),
    };

    const composed = composeEventSinks([failingSink, { emit: goodSink }], { onError });
    composed.emit?.(auditEvent());

    await flushMicrotasks();

    expect(goodSink).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toBe("async boom");
  });

  it("swallows sink failures by default (no onError hook)", async () => {
    const goodSink = vi.fn();
    const failingSink: XltEventSink = {
      emit: () => Promise.reject(new Error("async boom")),
    };

    const composed = composeEventSinks([failingSink, { emit: goodSink }]);

    expect(() => composed.emit?.(auditEvent())).not.toThrow();
    await flushMicrotasks();
    expect(goodSink).toHaveBeenCalledTimes(1);
  });

  it("handles an empty sink list", () => {
    const composed = composeEventSinks([]);
    expect(() => composed.emit?.(auditEvent())).not.toThrow();
  });

  it("preserves sink this-binding for method-style emit", () => {
    const seen: unknown[] = [];
    const sink = {
      token: "state-1",
      emit(this: { token: string }, _event: XltAuditEvent) {
        seen.push(this.token);
      },
    } as unknown as XltEventSink;

    composeEventSinks([sink]).emit?.(auditEvent());

    expect(seen).toEqual(["state-1"]);
  });

  it("result stays composable", () => {
    const first = vi.fn();
    const second = vi.fn();

    const composed = composeEventSinks([{ emit: first }]);
    composeEventSinks([composed, { emit: second }]).emit?.(auditEvent());

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
