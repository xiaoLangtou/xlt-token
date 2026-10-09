# @xlt-token/observability

Observability exporters for [xlt-token](https://github.com/xiaoLangtou/xlt-token) audit events. It turns the sanitized `XltAuditEvent` stream produced by Core's `XltEventSink` into structured logs, OpenTelemetry events and metrics — without adding telemetry dependencies to Core.

## Installation

```bash
pnpm add @xlt-token/observability
```

OpenTelemetry support uses `@opentelemetry/api` as an **optional peer dependency**:

```bash
pnpm add @opentelemetry/api
```

## What's inside

| Export | Purpose |
| --- | --- |
| `createLoggerEventSink(options?)` | Emit audit events as structured JSON log records |
| `composeEventSinks(sinks, options?)` | Fan out events to multiple sinks with fault isolation |
| `createOpenTelemetryEventSink(options?)` | Bridge events to OpenTelemetry metrics + span events |
| `createConsoleLogger()` | Default JSON-line console logger |
| `auditEventName(type)` / `auditEventAttributes(event)` | Stable OTel event name / attribute mapping |

## Quick Start

```ts
import { createXltInstance } from "@xlt-token/core";
import { createLoggerEventSink } from "@xlt-token/observability";

const instance = createXltInstance({
  // ...
  eventSink: createLoggerEventSink(), // JSON lines to console
});
```

### Structured logger

Plug in any logger that matches the `StructuredLogger` interface (`logger.info(record)` style — pino, winston, etc.):

```ts
import pino from "pino";
import { createLoggerEventSink } from "@xlt-token/observability";

const sink = createLoggerEventSink({
  logger: pino(), // satisfies StructuredLogger
  severity: { "token.logged_in": "debug" }, // optional per-event override
  onError: (error, event) => console.error("audit log failed", error, event.type),
});
```

Default severity mapping: `token.kicked_out` / `token.replaced` / `token.family_revoked` → `warn`, everything else → `info`.

### Composing sinks

```ts
import { composeEventSinks, createLoggerEventSink, createOpenTelemetryEventSink } from "@xlt-token/observability";

const otelSink = await createOpenTelemetryEventSink();
const sink = composeEventSinks([createLoggerEventSink(), otelSink], {
  onError: (error, event, failedSink, index) => {
    // one failing sink never blocks the others or the auth flow
  },
});
```

### OpenTelemetry

```ts
import { createOpenTelemetryEventSink } from "@xlt-token/observability";

const sink = await createOpenTelemetryEventSink({
  metrics: true,    // Counter "xlt.audit.events" (attribute: "xlt.event")
  spanEvents: true, // span event "xlt.<type>" on the active span
  meterName: "@xlt-token/observability",
});
```

Creation throws a clear install hint when `@opentelemetry/api` is not installed; runtime export failures are isolated and reported via `onError`.

**Metric examples.** The single counter `xlt.audit.events` (attribute `xlt.event`) derives the recommended metrics:

| Metric | Derivation |
| --- | --- |
| Login rate (login success throughput) | `sum(rate(xlt.audit.events{"xlt.event"="token.logged_in"}))` |
| Token refresh count | `sum(increase(xlt.audit.events{"xlt.event"="token.refreshed"}[1h]))` |
| Auth anomaly count | `sum(rate(xlt.audit.events{"xlt.event"=~"token.(kicked_out\|replaced\|family_revoked)"}))` |

Span events are written with the stable name `xlt.<auditEventType>` (e.g. `xlt.token.logged_in`) whenever an active span exists.

**Prometheus / OpenTelemetry Collector wiring.** The sink emits through the `@opentelemetry/api` metrics API — connect it to your own SDK to export:

```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(), // traces → OTel Collector
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(), // metrics (incl. xlt.audit.events) → Collector
    exportIntervalMillis: 15_000,
  }),
});
sdk.start();
```

For a Prometheus pull endpoint, swap the metric exporter for `@opentelemetry/exporter-prometheus` (`PrometheusExporter` exposes `/metrics`); the derivation queries in the table above then run as-is in PromQL.

## Structured log JSON schema

`AUDIT_LOG_SCHEMA = "xlt-token.audit.v1"`. Field names are snake_case and stable:

| Field | Type | Source (`XltAuditEvent`) |
| --- | --- | --- |
| `schema` | `"xlt-token.audit.v1"` | constant |
| `event` | `XltAuditEventType` | `type` |
| `occurred_at` | ISO 8601 string | `occurredAt` |
| `occurred_at_ms` | epoch milliseconds | `occurredAt` |
| `login_id` | string? | `loginId` |
| `device` | string? | `device` |
| `reason` | string? | `reason` |
| `token_fingerprint` | string? | `tokenFingerprint` |
| `previous_token_fingerprint` | string? | `previousTokenFingerprint` |
| `next_token_fingerprint` | string? | `nextTokenFingerprint` |
| `family_id_fingerprint` | string? | `familyIdFingerprint` |

Undefined fields are omitted from the record.

## Sanitization & fault isolation guarantees

- Exporters read **only** the schema fields above; any extra / unknown fields on the event are dropped, so raw tokens can never leak through future event fields.
- Fingerprints are truncated SHA-256 hashes produced by Core — never the raw token.
- Every sink swallows its own failures (sync throws and promise rejections). Auth flow is never affected; failures are observable via `onError`.
- Core keeps zero telemetry dependencies — all exporters live in this package.
