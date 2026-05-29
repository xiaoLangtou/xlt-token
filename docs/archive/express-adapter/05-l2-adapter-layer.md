# 05 · L2 适配层：`HttpContext` 桥接

> 返回 [目录](./README.md)

---

## 1. 职责

L2 只做三件事：

1. `createExpressContext(req, res)` → `HttpContext`
2. 保证同一请求内 `state` 引用唯一（`_xltState`）
3. 提供 `syncExpressAuthState` 将 core 写入的 state 同步到 `req`

**不做**：登录校验、权限判断、JSON 响应。

---

## 2. `createExpressContext` 实现要点

```ts
import type { Request, Response } from 'express';
import type { HttpContext } from '@xlt-token/core';

export function createExpressContext(req: Request, res: Response): HttpContext {
  const state = ((req as ExpressRequest)._xltState ??= {});

  return {
    headers: {
      get: (name) => (req.headers[name.toLowerCase()] as string) ?? null,
    },
    cookies: {
      get: (name) => (req as ExpressRequest).cookies?.[name] ?? null,
    },
    query: {
      get: (name) => (req.query?.[name] as string) ?? null,
    },
    state,
    setHeader: (name, value) => { res.setHeader(name, value); },
    setCookie: (name, value, options) => { res.cookie(name, value, options ?? {}); },
    raw: () => req,
  };
}
```

### 2.1 Header 大小写

Express `req.headers` 键为小写；`getTokenValue` 使用 `config.tokenName.toLowerCase()`，与 core 一致。

### 2.2 Cookie

- 依赖用户安装 `cookie-parser` 后才有 `req.cookies`
- 未安装时 `cookies.get` 返回 `null`，不抛错

### 2.3 Query

`req.query[name]` 可能为 `string | string[]`；适配器取 **string**  cast，与当前 core `express.ts` 行为一致。

### 2.4 `state` 生命周期

```ts
req._xltState ??= {};
```

同一 `req` 上多次 `createExpressContext` 必须返回 **同一** `state` 对象引用。

---

## 3. `syncExpressAuthState`

```ts
import type { Request } from 'express';
import type { HttpContext } from '@xlt-token/core';

export function syncExpressAuthState(req: Request, ctx: HttpContext): void {
  const loginId = ctx.state.stpLoginId;
  const token = ctx.state.stpToken;
  if (loginId != null) (req as ExpressRequest).stpLoginId = String(loginId);
  if (token != null) (req as ExpressRequest).stpToken = String(token);
}
```

在 `runAuth` / `xltMiddleware` 成功路径末尾调用。

---

## 4. TypeScript 类型增强（`types.ts`）

```ts
import type { XltMode } from '@xlt-token/core';

export interface RouteAuthMeta {
  ignore?: boolean;
  requireLogin?: boolean;
  permissions?: { list: string[]; mode: XltMode };
  roles?: { list: string[]; mode: XltMode };
  safeBusiness?: string;
}

export interface ExpressRequest {
  _xltState?: Record<string, unknown>;
  _xltRouteMeta?: RouteAuthMeta;
  stpLoginId?: string;
  stpToken?: string;
}

declare global {
  namespace Express {
    interface Request {
      _xltState?: Record<string, unknown>;
      _xltRouteMeta?: RouteAuthMeta;
      stpLoginId?: string;
      stpToken?: string;
    }
  }
}
```

用户项目 `tsconfig` 需能解析本包类型；或通过 `/// <reference types="@xlt-token/adapter-express" />` 引入。

---

## 5. 从 core 迁移步骤（摘要）

详见 [11-risks-and-migration.md](./11-risks-and-migration.md)。

1. 复制 `packages/core/src/http/express.ts` → `adapter-express/src/context.ts`
2. 收紧类型为 `Request` / `Response`
3. core 改为 `export { createExpressContext } from '@xlt-token/adapter-express'` + `@deprecated`
4. nestjs `nest-bridge.ts` 改 import 路径

---

## 6. 单测要点

| 用例 | 断言 |
| --- | --- |
| header 读取 | `headers.get('authorization')` |
| cookie / query | mock `req.cookies` / `req.query` |
| state 稳定性 | 两次 `createExpressContext` 的 `state ===` |
| setHeader / setCookie | mock `res` 被调用 |

使用 `vitest` + 手写 mock `req`/`res`，无需 supertest。
