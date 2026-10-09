import { describe, expect, it, vi } from "vitest";
import type { XltAuditEvent } from "@xlt-token/core";
import {
  auditEventAttributes,
  auditEventName,
  createOpenTelemetryEventSink,
} from "../src/index.js";
import { auditEvent } from "./helpers.js";

type OpenTelemetryApi = typeof import("@opentelemetry/api");

interface RecordedCounter {
  name: string;
  options: unknown;
  adds: Array<{ value: number; attributes?: Record<string, string> }>;
}

function createFakeApi(
  config: {
    activeSpan?: { addEvent: ReturnType<typeof vi.fn> };
    failCreateCounter?: boolean;
    failCounterAdd?: boolean;
  } = {},
) {
  const counters: RecordedCounter[] = [];
  const getMeter = vi.fn(() => ({
    createCounter: vi.fn((name: string, counterOptions: unknown) => {
      if (config.failCreateCounter) throw new Error("meter unavailable");
      const counter: RecordedCounter = { name, options: counterOptions, adds: [] };
      counters.push(counter);
      return {
        add: (value: number, attributes?: Record<string, string>) => {
          if (config.failCounterAdd) throw new Error("counter add failed");
          counter.adds.push({ value, attributes });
        },
      };
    }),
  }));
  const getActiveSpan = vi.fn(() => config.activeSpan);

  const api = {
    metrics: { getMeter },
    trace: { getActiveSpan },
  } as unknown as OpenTelemetryApi;

  return { api, counters, getMeter, getActiveSpan };
}

describe("auditEventName / auditEventAttributes", () => {
  it("produces stable event names with the xlt. prefix", () => {
    expect(auditEventName("token.logged_in")).toBe("xlt.token.logged_in");
    expect(auditEventName("token.family_revoked")).toBe("xlt.token.family_revoked");
  });

  it("maps audit fields to stable snake_case attributes", () => {
    const attributes = auditEventAttributes(
      auditEvent({
        loginId: "1001",
        device: "pc",
        reason: "top-up",
        tokenFingerprint: "fp-1",
        previousTokenFingerprint: "fp-0",
        nextTokenFingerprint: "fp-2",
        familyIdFingerprint: "fam-1",
      }),
    );

    expect(attributes).toEqual({
      "xlt.schema_version": 1,
      "xlt.login_id": "1001",
      "xlt.device": "pc",
      "xlt.reason": "top-up",
      "xlt.token_fingerprint": "fp-1",
      "xlt.previous_token_fingerprint": "fp-0",
      "xlt.next_token_fingerprint": "fp-2",
      "xlt.family_id_fingerprint": "fam-1",
    });
  });

  it("drops unknown fields from attributes (sanitization)", () => {
    const suspicious = {
      ...auditEvent(),
      accessToken: "raw-token",
      jwtPayload: { sub: "1001" },
    } as unknown as XltAuditEvent;

    const serialized = JSON.stringify(auditEventAttributes(suspicious));
    expect(serialized).not.toContain("raw-token");
    expect(serialized).not.toContain("jwtPayload");
  });
});

describe("createOpenTelemetryEventSink", () => {
  it("rejects with an install hint when @opentelemetry/api is unavailable", async () => {
    await expect(
      createOpenTelemetryEventSink({}, () => Promise.reject(new Error("Cannot find module"))),
    ).rejects.toThrow(/@opentelemetry\/api/);
  });

  it("records one counter increment per event with the event attribute", async () => {
    const { api, counters } = createFakeApi();
    const sink = await createOpenTelemetryEventSink({}, () => Promise.resolve(api));

    sink.emit?.(auditEvent({ type: "token.logged_in" }));
    sink.emit?.(auditEvent({ type: "token.refreshed" }));

    expect(counters).toHaveLength(1);
    expect(counters[0].name).toBe("xlt.audit.events");
    expect(counters[0].adds).toEqual([
      { value: 1, attributes: { "xlt.event": "token.logged_in" } },
      { value: 1, attributes: { "xlt.event": "token.refreshed" } },
    ]);
  });

  it("adds span events with stable names and sanitized attributes", async () => {
    const activeSpan = { addEvent: vi.fn() };
    const { api } = createFakeApi({ activeSpan });
    const sink = await createOpenTelemetryEventSink({}, () => Promise.resolve(api));

    sink.emit?.(auditEvent({ type: "token.logged_in", loginId: "1001" }));

    expect(activeSpan.addEvent).toHaveBeenCalledTimes(1);
    expect(activeSpan.addEvent).toHaveBeenCalledWith("xlt.token.logged_in", {
      "xlt.schema_version": 1,
      "xlt.login_id": "1001",
    });
  });

  it("does nothing on span events when no span is active", async () => {
    const { api } = createFakeApi();
    const sink = await createOpenTelemetryEventSink({}, () => Promise.resolve(api));

    expect(() => sink.emit?.(auditEvent())).not.toThrow();
  });

  it("skips metrics when metrics: false", async () => {
    const { api, getMeter, counters } = createFakeApi();
    const sink = await createOpenTelemetryEventSink({ metrics: false }, () => Promise.resolve(api));

    sink.emit?.(auditEvent());

    expect(getMeter).not.toHaveBeenCalled();
    expect(counters).toHaveLength(0);
  });

  it("skips span events when spanEvents: false", async () => {
    const activeSpan = { addEvent: vi.fn() };
    const { api, getActiveSpan } = createFakeApi({ activeSpan });
    const sink = await createOpenTelemetryEventSink({ spanEvents: false }, () =>
      Promise.resolve(api),
    );

    sink.emit?.(auditEvent());

    expect(getActiveSpan).not.toHaveBeenCalled();
    expect(activeSpan.addEvent).not.toHaveBeenCalled();
  });

  it("isolates counter failures from span events and reports via onError", async () => {
    const activeSpan = { addEvent: vi.fn() };
    const { api } = createFakeApi({ activeSpan, failCounterAdd: true });
    const onError = vi.fn();
    const sink = await createOpenTelemetryEventSink({ onError }, () => Promise.resolve(api));

    expect(() => sink.emit?.(auditEvent({ loginId: "1001" }))).not.toThrow();

    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toBe("counter add failed");
    expect(activeSpan.addEvent).toHaveBeenCalledTimes(1);
  });

  it("reports span event failures via onError", async () => {
    const activeSpan = {
      addEvent: () => {
        throw new Error("span exporter down");
      },
    };
    const { api } = createFakeApi({ activeSpan });
    const onError = vi.fn();
    const sink = await createOpenTelemetryEventSink({ onError }, () => Promise.resolve(api));

    expect(() => sink.emit?.(auditEvent())).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("keeps the sink usable when the meter cannot create counters", async () => {
    const activeSpan = { addEvent: vi.fn() };
    const { api, counters } = createFakeApi({ activeSpan, failCreateCounter: true });
    const sink = await createOpenTelemetryEventSink({}, () => Promise.resolve(api));

    expect(() => sink.emit?.(auditEvent())).not.toThrow();
    expect(counters).toHaveLength(0);
    expect(activeSpan.addEvent).toHaveBeenCalledTimes(1);
  });

  it("works with the real no-op @opentelemetry/api", async () => {
    const sink = await createOpenTelemetryEventSink();
    expect(() => sink.emit?.(auditEvent({ loginId: "1001" }))).not.toThrow();
  });
});
