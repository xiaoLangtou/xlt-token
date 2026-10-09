# @xlt-token/inspector

Built-in monitoring console for [xlt-token](https://github.com/xiaoLangtou/xlt-token). Attach it to any app with an explicit `XltInstance` and get a zero-dependency web UI for live audit events, online sessions, and metrics.

- **Single-file page** (vanilla JS, no build chain) served by your app — the package ships it as an exported string.
- **Framework-agnostic data bridge** with structural mount helpers for Fastify and Express; NestJS works with a small controller (see the `examples/nestjs` reference).
- **Read-only by default**; kickout / force-logout actions require `allowMutations: true`.
- **Auth is mandatory**: the bridge refuses to mount without an `auth` callback.
- **Sanitized by design**: device tokens are converted to fingerprints; raw tokens never leave the bridge.

## Installation

```bash
pnpm add @xlt-token/inspector
```

## Quick Start (Fastify)

```ts
import Fastify from "fastify";
import { createXltInstance, MemoryStore } from "@xlt-token/core";
import {
  createEventBufferSink,
  createInspectorBridge,
  mountInspectorOnFastify,
} from "@xlt-token/inspector";

const instance = createXltInstance({ store: new MemoryStore() });
const buffer = createEventBufferSink();

// Buffer belongs to the event pipeline — feed it from the official exporters:
// eventSink: composeEventSinks([buffer.sink, createLoggerEventSink()])

const app = Fastify();
mountInspectorOnFastify(
  app,
  createInspectorBridge({
    instance,
    buffer,
    // REQUIRED: decide who may open the console. `context.bearerToken`
    // carries the Authorization Bearer header when present.
    auth: async (_request, context) => {
      if (!context.bearerToken) return false;
      const loginId = await instance.stpLogic.getLoginIdByToken(context.bearerToken);
      return loginId != null && instance.stpPermLogic.hasRole(String(loginId), "admin");
    },
    // Optional: expose kickout / force-logout actions (default false)
    allowMutations: false,
  }),
  { prefix: "/inspector" }, // default
);

await app.listen({ port: 3000 });
// Open http://localhost:3000/inspector and paste an admin Bearer token.
```

The page asks for a token on first 401/403, keeps it in `localStorage`, and sends it as `Authorization: Bearer <token>`. Cookie-based host auth also works — forward the cookie in your `auth` callback via `request.raw`.

## Express

```ts
import { mountInspectorOnExpress } from "@xlt-token/inspector";

mountInspectorOnExpress(app, bridge, { prefix: "/inspector" });
```

## NestJS

Create a thin controller that delegates to the bridge (full reference in `examples/nestjs/src/inspector/`):

```ts
const bridge = createInspectorBridge({
  instance: () => getDefaultXltInstance(), // lazy resolution
  buffer,
  auth: async (_req, context) => {
    const loginId = await StpUtil.getLoginIdByToken(context.bearerToken ?? "");
    return loginId != null && StpUtil.hasRole(String(loginId), "admin");
  },
});

@Controller("inspector")
class InspectorController {
  @Get() page(@Res() res: Response) { res.type("html").send(INSPECTOR_HTML); }
  // Map each route in BRIDGE_ROUTE_TABLE to bridge.handle(buildInspectorRequest(path, req))
}
```

## Data API

Routes registered under `{prefix}/api` (all gated by `auth`):

| Route | Purpose |
| --- | --- |
| `GET /overview` | Instance config snapshot, online count, buffer stats, `allowMutations` flag |
| `GET /events?after=&limit=` | Incremental audit events (`latest` is the cursor) |
| `GET /metrics` | Login / refresh / logout / anomaly counters derived from the buffer |
| `GET /sessions?page=&pageSize=` | Paginated online login IDs |
| `GET /session-devices?loginId=` | Devices with **fingerprinted** tokens and login time |
| `POST /actions/kickout` | `{ loginId, device? }` — requires `allowMutations` |
| `POST /actions/logout` | `{ loginId }` force logout — requires `allowMutations` |

`buildInspectorRequest(path, req)` + `BRIDGE_ROUTE_TABLE` are exported so any framework (Koa, Hono, raw http) can be wired the same way.

## Event buffer

`createEventBufferSink()` turns the push-only `XltEventSink` stream into an incremental in-memory timeline:

```ts
const buffer = createEventBufferSink({ capacity: 500 });

createXltInstance({
  // ...
  eventSink: composeEventSinks([buffer.sink, createLoggerEventSink()]),
});
```

It pairs naturally with [`@xlt-token/observability`](https://www.npmjs.com/package/@xlt-token/observability) — compose the buffer with logger / OTel sinks.

## Security notes

- The console exposes session and audit data. Always wire `auth` to an admin-level check; the bridge refuses to create without one.
- `allowMutations` defaults to `false` — enable only when the console is behind a trusted guard.
- All tokens are rendered as truncated SHA-256 fingerprints (same scheme as Core audit events).
- `strategy` / `store` names in `/overview` come from `constructor.name` and may vary under minifiers/bundlers.
