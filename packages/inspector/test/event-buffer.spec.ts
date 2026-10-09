import { describe, expect, it } from "vitest";
import type { XltAuditEvent } from "@xlt-token/core";
import { createEventBufferSink } from "../src/index.js";

const event = (overrides: Partial<XltAuditEvent> = {}): XltAuditEvent => ({
  schemaVersion: 1,
  type: "token.logged_in",
  occurredAt: 1728300000000,
  ...overrides,
});

describe("createEventBufferSink", () => {
  it("assigns incremental seq cursors and keeps newest-first order", () => {
    const buffer = createEventBufferSink();
    buffer.sink.emit?.(event());
    buffer.sink.emit?.(event({ type: "token.refreshed" }));

    const { events, latest } = buffer.snapshot(0);
    expect(latest).toBe(2);
    expect(events.map((entry) => entry.seq)).toEqual([2, 1]);
    expect(events[0]).toMatchObject({ type: "token.refreshed", schemaVersion: 1 });
  });

  it("returns only entries newer than the cursor", () => {
    const buffer = createEventBufferSink();
    buffer.sink.emit?.(event());
    buffer.sink.emit?.(event());
    buffer.sink.emit?.(event());

    const { events, latest } = buffer.snapshot(2);
    expect(events.map((entry) => entry.seq)).toEqual([3]);
    expect(latest).toBe(3);
  });

  it("trims to capacity and keeps counting seq", () => {
    const buffer = createEventBufferSink({ capacity: 3 });
    for (let i = 0; i < 5; i++) buffer.sink.emit?.(event());

    const { events } = buffer.snapshot(0);
    expect(events).toHaveLength(3);
    expect(events.map((entry) => entry.seq)).toEqual([5, 4, 3]);

    const stats = buffer.stats();
    expect(stats).toMatchObject({ tracked: 3, capacity: 3, latest: 5 });
  });

  it("clamps the snapshot limit", () => {
    const buffer = createEventBufferSink();
    for (let i = 0; i < 10; i++) buffer.sink.emit?.(event());

    expect(buffer.snapshot(0, 0).events).toHaveLength(1);
    expect(buffer.snapshot(0, 1000).events).toHaveLength(10);
  });

  it("aggregates per-type stats", () => {
    const buffer = createEventBufferSink();
    buffer.sink.emit?.(event({ type: "token.logged_in" }));
    buffer.sink.emit?.(event({ type: "token.logged_in" }));
    buffer.sink.emit?.(event({ type: "token.kicked_out" }));

    expect(buffer.stats().byType).toEqual({
      "token.logged_in": 2,
      "token.kicked_out": 1,
    });
  });
});
