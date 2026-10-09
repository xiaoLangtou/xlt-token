import { describe, expect, it, vi } from "vitest";
import type { XltAuditEvent } from "@xlt-token/core";
import { AUDIT_LOG_SCHEMA, createConsoleLogger, createLoggerEventSink } from "../src/index.js";
import { auditEvent } from "./helpers.js";

const ALL_EVENT_TYPES: XltAuditEvent["type"][] = [
  "token.logged_in",
  "token.refreshed",
  "token.logged_out",
  "token.kicked_out",
  "token.replaced",
  "token.family_revoked",
];

function createRecordingLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("createLoggerEventSink", () => {
  it("maps every audit event type to the stable JSON schema", () => {
    const logger = createRecordingLogger();
    const sink = createLoggerEventSink({ logger });

    for (const type of ALL_EVENT_TYPES) {
      sink.emit?.(auditEvent({ type, loginId: "1001", device: "pc" }));
    }

    for (const type of ALL_EVENT_TYPES) {
      const expectedLevel = ["token.kicked_out", "token.replaced", "token.family_revoked"].includes(
        type,
      )
        ? "warn"
        : "info";
      const calls = expectedLevel === "warn" ? logger.warn.mock.calls : logger.info.mock.calls;
      const record = calls.find((call) => call[0].event === type)?.[0];

      expect(record).toBeDefined();
      expect(record).toMatchObject({
        schema: AUDIT_LOG_SCHEMA,
        event: type,
        occurred_at: new Date(1728300000000).toISOString(),
        occurred_at_ms: 1728300000000,
        login_id: "1001",
        device: "pc",
      });
    }
  });

  it("emits JSON lines with the default console logger", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const sink = createLoggerEventSink();
      sink.emit?.(auditEvent({ loginId: "1001" }));

      expect(infoSpy).toHaveBeenCalledTimes(1);
      const record = JSON.parse(infoSpy.mock.calls[0][0] as string);
      expect(record).toMatchObject({ schema: AUDIT_LOG_SCHEMA, event: "token.logged_in" });
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("routes security-relevant events to warn with the default console logger", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const sink = createLoggerEventSink();
      sink.emit?.(auditEvent({ type: "token.family_revoked" }));

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).not.toHaveBeenCalled();
    } finally {
      infoSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it("keeps only schema fields and drops unknown event fields (sanitization)", () => {
    const logger = createRecordingLogger();
    const sink = createLoggerEventSink({ logger });

    const suspicious = {
      ...auditEvent({
        type: "token.logged_in",
        loginId: "1001",
        tokenFingerprint: "abcdef0123456789",
      }),
      accessToken: "raw-access-token",
      jwt: "raw-jwt",
      cookies: { authorization: "raw-jwt" },
      extraField: "keep-me-out",
    } as unknown as XltAuditEvent;

    sink.emit?.(suspicious);

    const record = logger.info.mock.calls[0][0];
    expect(record).toEqual({
      schema: AUDIT_LOG_SCHEMA,
      event: "token.logged_in",
      occurred_at: new Date(1728300000000).toISOString(),
      occurred_at_ms: 1728300000000,
      login_id: "1001",
      token_fingerprint: "abcdef0123456789",
    });
    expect(JSON.stringify(record)).not.toContain("raw-access-token");
    expect(JSON.stringify(record)).not.toContain("raw-jwt");
    expect(JSON.stringify(record)).not.toContain("keep-me-out");
  });

  it("maps token rotation fingerprints to the log record", () => {
    const logger = createRecordingLogger();
    const sink = createLoggerEventSink({ logger });

    sink.emit?.(
      auditEvent({
        type: "token.refreshed",
        tokenFingerprint: "fp-new",
        previousTokenFingerprint: "fp-old",
        nextTokenFingerprint: "fp-new",
        familyIdFingerprint: "fam-1",
      }),
    );

    expect(logger.info.mock.calls[0][0]).toMatchObject({
      event: "token.refreshed",
      token_fingerprint: "fp-new",
      previous_token_fingerprint: "fp-old",
      next_token_fingerprint: "fp-new",
      family_id_fingerprint: "fam-1",
    });
  });

  it("omits undefined optional fields", () => {
    const logger = createRecordingLogger();
    const sink = createLoggerEventSink({ logger });

    sink.emit?.(auditEvent({ type: "token.logged_out", loginId: "1001" }));

    const record = logger.info.mock.calls[0][0];
    expect(record).not.toHaveProperty("device");
    expect(record).not.toHaveProperty("reason");
    expect(record).not.toHaveProperty("token_fingerprint");
    expect(record).not.toHaveProperty("previous_token_fingerprint");
    expect(record).not.toHaveProperty("next_token_fingerprint");
    expect(record).not.toHaveProperty("family_id_fingerprint");
  });

  it("supports per-event severity overrides", () => {
    const logger = createRecordingLogger();
    const sink = createLoggerEventSink({
      logger,
      severity: { "token.logged_in": "error", "token.refreshed": "debug" },
    });

    sink.emit?.(auditEvent({ type: "token.logged_in" }));
    sink.emit?.(auditEvent({ type: "token.refreshed" }));
    sink.emit?.(auditEvent({ type: "token.logged_out" }));

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it("falls back to info when the logger misses the level method", () => {
    const logger = { info: vi.fn() };
    const sink = createLoggerEventSink({ logger });

    sink.emit?.(auditEvent({ type: "token.kicked_out" }));

    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it("writes debug and error levels to matching console methods", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const sink = createLoggerEventSink({
        logger: createConsoleLogger(),
        severity: { "token.logged_in": "debug", "token.refreshed": "error" },
      });

      sink.emit?.(auditEvent({ type: "token.logged_in" }));
      sink.emit?.(auditEvent({ type: "token.refreshed" }));

      expect(debugSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      debugSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("falls back to console.log when the console level method is missing", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const originalDebug = console.debug;
    (console as { debug?: unknown }).debug = undefined;
    try {
      createConsoleLogger().debug?.({
        schema: AUDIT_LOG_SCHEMA,
        event: "token.logged_in",
        occurred_at: new Date(1728300000000).toISOString(),
        occurred_at_ms: 1728300000000,
      });

      expect(logSpy).toHaveBeenCalledTimes(1);
    } finally {
      (console as { debug?: unknown }).debug = originalDebug;
      logSpy.mockRestore();
    }
  });

  it("isolates logger failures and reports them via onError", () => {
    const failure = new Error("logger disk full");
    const onError = vi.fn();
    const sink = createLoggerEventSink({
      logger: {
        info: () => {
          throw failure;
        },
      },
      onError,
    });
    const event = auditEvent({ loginId: "1001" });

    expect(() => sink.emit?.(event)).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(failure, event);
  });
});
