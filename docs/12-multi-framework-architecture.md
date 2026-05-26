# xlt-token · 多框架适配架构方案

> **状态**：规划草案
> **目标版本**：`2.0.0`
> **关系**：本文档承接 [10-roadmap-1.1.0.md](../10-roadmap-1.1.0.md) 之后的下一阶段架构演进。1.x 系列专注于功能补齐（二级认证、多端、JWT、观测性），2.0 系列专注于**框架解耦**——让 xlt-token 从「NestJS 专属库」演进为「核心 + 多适配器」的全 Node.js 框架鉴权方案。

本文是一份把 `xlt-token` 从 NestJS 专属库演进为「框架无关 + 多适配器」库的系统架构设计。整体借鉴 `better-auth` / `lucia-auth` / `iron-session` / `pinia` 这类「核心 + 适配器」分包模式，并保持与 1.0 版本 API 语义一致。

---

## 一、设计目标与原则


| 原则               | 说明                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------ |
| **框架零依赖核心**      | `@xlt-token/core` 只依赖标准库与 `WHATWG` 抽象，不感知任何 Web 框架                                   |
| **一致的语义层**       | `login` / `logout` / `kickout` / `checkLogin` / `XltSession` 等核心 API 在所有框架下行为一致      |
| **idiomatic 适配** | 每个框架按自己的最佳实践集成（NestJS 用 Guard、Express 用 middleware、Hono 用 middleware、Fastify 用 hook） |
| **渐进迁移**         | 现有 NestJS 用户升级到新版本时，导入路径与 API 保持兼容（`xlt-token` 自动转发到 `@xlt-token/nestjs`）            |
| **可插拔依赖**        | Store / Strategy / StpInterface 仍由用户通过手动 DI 注入，核心不绑死任何容器                             |
| **最小化抽象**        | 不发明"统一中间件层"，只抽象 HTTP 读写最小必要面                                                         |


**非目标**

- 不做跨框架的统一路由/装饰器层
- 不替代各框架自己的 DI / 中间件机制
- 不在核心层做任何 HTTP 解析（Cookie/Query 解析由适配器负责，复用框架原生能力）

---

## 二、当前耦合点诊断

对照 `src/` 目录，把代码按耦合度分三层：

```
┌──────────────────────────────────────────────────────────────────┐
│ 强耦合 NestJS（必须移到 @xlt-token/nestjs）                       │
│  - src/xlt-token.module.ts           Dynamic Module               │
│  - src/guards/xlt-token.guard.ts     CanActivate                  │
│  - src/guards/xlt-abstract-login.guard.ts                         │
│  - src/decorators/*.ts               createParamDecorator         │
│  - src/exceptions/*.ts               extends UnauthorizedException │
├──────────────────────────────────────────────────────────────────┤
│ 弱耦合 NestJS（仅参数类型用了 NestJS 的 Request）                  │
│  - src/auth/stp-logic.ts             checkLogin(req: Request)     │
│  - src/auth/stp-util.ts              静态门面                      │
├──────────────────────────────────────────────────────────────────┤
│ 已经框架无关（直接抽到 @xlt-token/core）                          │
│  - src/store/*                       存储接口与实现                │
│  - src/token/*                       Token 策略                    │
│  - src/core/xlt-token-config.ts      配置类型与默认值              │
│  - src/const/index.ts                NotLoginType / XltMode 常量   │
└──────────────────────────────────────────────────────────────────┘
```

**关键观察**：`StpLogic` 真正用到 Request 的只有「读 header / cookie / query」这一个操作。这意味着只要抽象出一个最小的「读请求 / 写响应」契约，核心层就能彻底解耦。

---

## 三、整体架构分层

```
┌──────────────────────────────────────────────────────────────────────────┐
│  L3  框架集成 Integration                                                 │
│      （idiomatic API：Guard / Middleware / Hook / Plugin）                 │
│  ┌─────────────┬─────────────┬────────────┬───────────┬───────────────┐  │
│  │  nestjs     │  express    │  fastify   │  hono     │  elysia / h3  │  │
│  └─────────────┴─────────────┴────────────┴───────────┴───────────────┘  │
├──────────────────────────────────────────────────────────────────────────┤
│  L2  框架适配 Adapter                                                     │
│      （HttpContext 实现 + 响应写回 + 异常映射）                            │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  ExpressAdapter / KoaAdapter / FastifyAdapter / HonoAdapter / ...   │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────┤
│  L1  核心运行时 Core Runtime                                              │
│      （StpLogic / StpPermLogic / XltSession / 异常 / 静态门面）            │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  HttpContext 接口  ──  StpLogic  ──  StpPermLogic  ──  Hooks        │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────┤
│  L0  抽象接口 Contracts                                                   │
│      XltTokenStore │ TokenStrategy │ StpInterface │ XltTokenConfig        │
├──────────────────────────────────────────────────────────────────────────┤
│  L-1 实现 Implementations（可独立分包）                                   │
│      memory-store · redis-store · ioredis-store · jwt-strategy · ...      │
└──────────────────────────────────────────────────────────────────────────┘
```

**职责边界（严格遵守）**

- **L0 / L-1**：纯数据 / 算法 / 抽象，不感知 HTTP
- **L1**：所有跨框架的鉴权语义都在这里，只通过 `HttpContext` 接口操作请求
- **L2**：把任意框架的 `(req, res)` 实例包装成 `HttpContext`，把核心抛的异常映射成框架响应
- **L3**：给用户提供框架原生写法（Guard / Decorator / Middleware / Hook）

---

## 四、核心抽象：HttpContext

这是整套架构的关键。所有框架差异都收敛在这一个接口上。

```ts twoslash
// @xlt-token/core
export interface HttpContext {
  readonly headers: HttpHeaders;
  readonly cookies: HttpCookies;
  readonly query: HttpQuery;

  state: Record<string, unknown>;

  setHeader(name: string, value: string): void;
  setCookie(name: string, value: string, options?: CookieOptions): void;

  raw<T = unknown>(): T;
}

export interface HttpHeaders {
  get(name: string): string | null;
}
export interface HttpCookies {
  get(name: string): string | null;
}
export interface HttpQuery {
  get(name: string): string | null;
}
```

**为什么不用 WHATWG Request？**

- 现代框架（Hono / Elysia / Next.js）原生用 `Request`，但 Express / Koa / NestJS（Express 模式）/ Fastify 不是
- 把所有框架强行转 `Request` 会损失原生能力（如 Fastify 的 schema、Express 的 `req.cookies`）
- 自定义最小接口最灵活，每个适配器复用框架原生解析逻辑

`**state` 字段的设计**

替代当前直接挂到 `request.stpLoginId / stpToken` 的做法：

```ts twoslash
ctx.state.stpLoginId = '1001';
ctx.state.stpToken   = 'xxx';
ctx.state.stpSession = session;
```

然后由各框架的集成层把它映射到框架习惯的位置：


| 框架      | 映射后                                       |
| ------- | ----------------------------------------- |
| Express | `req.stpLoginId` / `req.stpToken`         |
| Koa     | `ctx.state.stpLoginId`                    |
| Fastify | `request.stpLoginId`（用 `decorateRequest`） |
| Hono    | `c.set('stpLoginId', ...)`                |
| Elysia  | `derive(() => ({ stpLoginId }))`          |
| NestJS  | `request.stpLoginId`（兼容 1.0）              |


---

## 五、核心运行时 API（L1）

`StpLogic` 重构后只接受 `HttpContext`，不再依赖任何框架类型：

```ts twoslash
// @xlt-token/core
export class StpLogic {
  constructor(
    private readonly config: XltTokenConfig,
    private readonly store: XltTokenStore,
    private readonly strategy: TokenStrategy,
    private readonly stpInterface?: StpInterface,
    private readonly hooks?: XltHooks,
  ) {}

  login(loginId: string | number, options?: LoginOptions): Promise<string>;
  logout(token: string): Promise<boolean | null>;
  logoutByLoginId(loginId: string): Promise<boolean | null>;
  kickout(loginId: string): Promise<boolean | null>;
  renewTimeout(token: string, timeout: number): Promise<boolean | null>;

  getTokenValue(ctx: HttpContext): Promise<string | null>;
  isLogin(ctx: HttpContext): Promise<boolean>;
  checkLogin(ctx: HttpContext): Promise<AuthResult>;

  getSession(loginId: string): XltSession;
  getOfflineReason(token: string): Promise<OfflineRecord | null>;
}

export interface AuthResult {
  ok: boolean;
  loginId?: string;
  token?: string;
  reason?: NotLoginType;
}
```

**工厂函数（替代 NestJS 的 `forRoot`）**

```ts twoslash
// @xlt-token/core
export function createXltToken(options: CreateOptions): XltTokenContext {
  return {
    config,
    store,
    strategy,
    stpLogic,
    stpPermLogic,
    stpUtil,
  };
}

export interface CreateOptions {
  config?: Partial<XltTokenConfig>;
  store?: XltTokenStore;
  strategy?: TokenStrategy;
  stpInterface?: StpInterface;
  hooks?: XltHooks;
}
```

`StpUtil` 静态门面在 `createXltToken` 内自动调 `setStpLogic`，保持 1.0 用法不变。

**异常重构（去 NestJS 化）**

```ts twoslash
// @xlt-token/core
export class XltError extends Error {
  readonly code: string;
  readonly status: number;
}
export class NotLoginException extends XltError {
  readonly type: NotLoginType;
  readonly token?: string;
  status = 401;
}
export class NotPermissionException extends XltError {
  readonly permission: string | string[];
  readonly mode: XltMode;
  status = 403;
}
export class NotRoleException extends XltError { /* ... */ }
```

每个适配器负责把这些异常翻译成框架响应（NestJS 适配器里再包一层继承 `UnauthorizedException`，保持向后兼容）。

---

## 六、适配器层（L2）

每个适配器只需要 ~100 行代码，做三件事：

1. 把框架的 `(req, res)` 包装成 `HttpContext`
2. 提供 `runAuth(ctx, opts)` 助手（封装 `checkLogin + 元数据判定 + 异常抛出`）
3. 把核心异常映射到框架响应

```ts twoslash
// @xlt-token/adapter-express
import type { Request, Response } from 'express';
import { HttpContext } from '@xlt-token/core';

export function createExpressContext(req: Request, res: Response): HttpContext {
  return {
    headers: { get: (n) => (req.headers[n.toLowerCase()] as string) ?? null },
    cookies: { get: (n) => req.cookies?.[n] ?? null },
    query:   { get: (n) => (req.query?.[n] as string) ?? null },
    state: (req as any).state ??= {},
    setHeader: (n, v) => res.setHeader(n, v),
    setCookie: (n, v, o) => res.cookie(n, v, o ?? {}),
    raw: () => req as any,
  };
}
```

```ts twoslash
// @xlt-token/adapter-fastify
import type { FastifyRequest, FastifyReply } from 'fastify';

export function createFastifyContext(req: FastifyRequest, reply: FastifyReply): HttpContext {
  return {
    headers: { get: (n) => (req.headers[n.toLowerCase()] as string) ?? null },
    cookies: { get: (n) => (req as any).cookies?.[n] ?? null },
    query:   { get: (n) => (req.query as any)?.[n] ?? null },
    state: (req as any).state ??= {},
    setHeader: (n, v) => reply.header(n, v),
    setCookie: (n, v, o) => reply.setCookie(n, v, o ?? {}),
    raw: () => req as any,
  };
}
```

```ts twoslash
// @xlt-token/adapter-hono
import type { Context } from 'hono';

export function createHonoContext(c: Context): HttpContext {
  return {
    headers: { get: (n) => c.req.header(n) ?? null },
    cookies: { get: (n) => c.req.cookie(n) ?? null },
    query:   { get: (n) => c.req.query(n) ?? null },
    state: (c as any)._xltState ??= {},
    setHeader: (n, v) => c.header(n, v),
    setCookie: (n, v, o) => c.cookie(n, v, o as any),
    raw: () => c,
  };
}
```

---

## 七、框架集成层（L3）

每个框架按自己的最佳实践提供 idiomatic API。下面是各框架的典型用法。

### 7.1 NestJS

保持 1.0 完全兼容（Guard + Decorator + Module）：

```ts twoslash
import { XltTokenModule, XltTokenGuard, LoginId } from '@xlt-token/nestjs';

@Module({
  imports: [XltTokenModule.forRoot({ config: { tokenName: 'authorization' } })],
  providers: [{ provide: APP_GUARD, useClass: XltTokenGuard }],
})
export class AppModule {}

@Controller('auth')
class AuthController {
  @Get('me') me(@LoginId() id: string) { return { id }; }
}
```

内部实现：`XltTokenGuard.canActivate(ctx)` → `createExpressContext(req, res)` → `stpLogic.checkLogin(httpCtx)`。

### 7.2 Express

```ts twoslash
import express from 'express';
import { createXltToken } from '@xlt-token/core';
import { xltMiddleware } from '@xlt-token/express';

const xlt = createXltToken({ config: { tokenName: 'authorization' } });

const app = express();
app.use(xltMiddleware(xlt, { defaultCheck: true }));

app.post('/auth/login', async (req, res) => {
  const token = await xlt.stpLogic.login('1001');
  res.json({ token });
});

app.get('/me', (req, res) => {
  res.json({ loginId: req.stpLoginId });
});
```

`xltMiddleware` 返回一个 Express 中间件，内部读取路由上的元数据（通过 `req.xltIgnore` 之类的扩展机制，或者用户手动指定路径白名单）。

### 7.3 Koa

```ts twoslash
import Koa from 'koa';
import { xltMiddleware } from '@xlt-token/koa';

const app = new Koa();
app.use(xltMiddleware(xlt));

app.use(async (ctx) => {
  if (ctx.path === '/me') {
    ctx.body = { loginId: ctx.state.stpLoginId };
  }
});
```

### 7.4 Fastify

```ts twoslash
import Fastify from 'fastify';
import { xltPlugin } from '@xlt-token/fastify';

const app = Fastify();
await app.register(xltPlugin, { xlt, defaultCheck: true });

app.get('/me', { config: { xltAuth: true } }, async (req) => ({
  loginId: req.stpLoginId,
}));
```

Fastify 用 `decorateRequest` + `addHook('preHandler')` 实现，配合 route-level config 做白名单/黑名单。

### 7.5 Hono

```ts twoslash
import { Hono } from 'hono';
import { xltMiddleware, requireLogin } from '@xlt-token/hono';

const app = new Hono();
app.use('*', xltMiddleware(xlt));

app.get('/me', requireLogin(), (c) => c.json({
  loginId: c.get('stpLoginId'),
}));
```

### 7.6 Elysia / Bun

```ts twoslash
import { Elysia } from 'elysia';
import { xltPlugin } from '@xlt-token/elysia';

new Elysia()
  .use(xltPlugin(xlt))
  .get('/me', ({ stpLoginId }) => ({ stpLoginId }), { xltAuth: true })
  .listen(3000);
```

### 7.7 H3 / Nitro / Nuxt

```ts twoslash
import { defineEventHandler } from 'h3';
import { xltMiddleware, useStpLoginId } from '@xlt-token/h3';

export default defineEventHandler(async (event) => {
  await xltMiddleware(xlt)(event);
  const loginId = useStpLoginId(event);
  return { loginId };
});
```

---

## 八、Monorepo 包结构

```
xlt-token/                                    # 仓库根（pnpm workspace + turbo）
├── packages/
│   ├── core/                                  # @xlt-token/core   ⭐ 框架无关核心
│   │   └── src/
│   │       ├── auth/  (stp-logic, stp-perm-logic, stp-util)
│   │       ├── session/  (xlt-session)
│   │       ├── store/  (interface, memory-store)
│   │       ├── token/  (interface, uuid-strategy)
│   │       ├── http/   (HttpContext 接口与 helpers)
│   │       ├── exceptions/  (XltError 家族，纯 JS Error)
│   │       ├── config/  (XltTokenConfig + defaults)
│   │       ├── const/   (NotLoginType / XltMode)
│   │       └── factory.ts  (createXltToken)
│   │
│   ├── store-redis/                           # @xlt-token/store-redis    （redis v4/v5）
│   ├── store-ioredis/                         # @xlt-token/store-ioredis  （ioredis）
│   ├── strategy-jwt/                          # @xlt-token/strategy-jwt   （JWT 策略）
│   │
│   ├── adapter-express/                       # @xlt-token/adapter-express
│   ├── adapter-koa/                           # @xlt-token/adapter-koa
│   ├── adapter-fastify/                       # @xlt-token/adapter-fastify
│   ├── adapter-hono/                          # @xlt-token/adapter-hono
│   ├── adapter-elysia/                        # @xlt-token/adapter-elysia
│   ├── adapter-h3/                            # @xlt-token/adapter-h3
│   │
│   ├── nestjs/                                # @xlt-token/nestjs   ⭐ 1.0 兼容入口
│   │   └── src/
│   │       ├── xlt-token.module.ts
│   │       ├── guards/
│   │       ├── decorators/
│   │       └── exceptions/  (继承 UnauthorizedException 包装核心异常)
│   │
│   └── compat/                                # xlt-token (legacy) → re-export @xlt-token/nestjs
│
├── apps/
│   ├── docs/                                  # VitePress 文档
│   └── playground/
│       ├── nestjs/                            # 各框架 demo
│       ├── express/
│       ├── fastify/
│       └── hono/
│
├── e2e/                                       # 跨框架统一 E2E 用例
│   ├── shared/   (rest 场景：登录、踢人、顶号、权限)
│   ├── nestjs.e2e.ts
│   ├── express.e2e.ts
│   ├── fastify.e2e.ts
│   └── hono.e2e.ts
│
├── pnpm-workspace.yaml
├── turbo.json
└── tsdown.config.ts
```

**包依赖关系**

```
@xlt-token/core             ⬅ 0 框架依赖
  │
  ├── @xlt-token/store-redis
  ├── @xlt-token/strategy-jwt
  ├── @xlt-token/adapter-express   ⬅ peer: express
  ├── @xlt-token/adapter-koa       ⬅ peer: koa
  ├── @xlt-token/adapter-fastify   ⬅ peer: fastify
  ├── @xlt-token/adapter-hono      ⬅ peer: hono
  ├── @xlt-token/adapter-elysia    ⬅ peer: elysia
  ├── @xlt-token/adapter-h3        ⬅ peer: h3
  │
  └── @xlt-token/nestjs            ⬅ 依赖 adapter-express + peer: @nestjs/common/core
            │
            └── xlt-token (legacy npm name 兼容包)
```

---

## 九、跨框架统一行为契约

为了保证"一次学会，所有框架都能用"，所有适配器**必须**遵守以下契约（写入 spec 测试中）：


| 契约              | 描述                                                            |
| --------------- | ------------------------------------------------------------- |
| **token 读取顺序**  | `header → cookie → query`，剥离 `tokenPrefix`                    |
| **state 字段名**   | `stpLoginId` / `stpToken` / `stpSession`                      |
| **黑/白名单语义**     | `defaultCheck` 配置项，配合 `requireAuth()` / `ignoreAuth()` helper |
| **异常映射**        | `NotLoginException` → 401 + JSON body（含 `type` 字段）            |
| **权限校验**        | 同一份 `StpPermLogic`，仅装饰器/元数据机制不同                               |
| **Session API** | `XltSession` 完全一致                                             |
| **Hook 触发时机**   | `onLogin/onLogout/onKickout/onReplaced` 在 `StpLogic` 内统一触发    |


所有跨框架 E2E 共享同一组测试场景（顶号、踢人、活跃过期、权限校验等），只换 setup。

---

## 十、关键代码示意

### 10.1 核心 `StpLogic.checkLogin`（去 NestJS 化）

```ts twoslash
async checkLogin(ctx: HttpContext): Promise<AuthResult> {
  const token = await this.getTokenValue(ctx);
  if (!token) return { ok: false, reason: NotLoginType.NOT_TOKEN };

  const value = await this.store.get(this.tokenKey(token));
  if (!value)                  return { ok: false, token, reason: NotLoginType.INVALID_TOKEN };
  if (value === 'BE_REPLACED') return { ok: false, token, reason: NotLoginType.BE_REPLACED };
  if (value === 'KICK_OUT')    return { ok: false, token, reason: NotLoginType.KICK_OUT };

  if (this.config.activeTimeout > 0) {
    const lastActive = await this.store.get(this.lastActiveKey(token));
    if (!lastActive) return { ok: false, token, reason: NotLoginType.TOKEN_FREEZE };
    if (Date.now() - Number(lastActive) > this.config.activeTimeout * 1000)
      return { ok: false, token, reason: NotLoginType.TOKEN_TIMEOUT };
    await this.store.update(this.lastActiveKey(token), String(Date.now()));
  }

  ctx.state.stpLoginId = value;
  ctx.state.stpToken = token;
  return { ok: true, loginId: value, token };
}
```

### 10.2 Express 中间件

```ts twoslash
export function xltMiddleware(xlt: XltTokenContext, options: ExpressOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ctx = createExpressContext(req, res);
    const route = matchRoute(req, options);
    if (route?.ignore) return next();

    const result = await xlt.stpLogic.checkLogin(ctx);
    if (!result.ok) return next(new NotLoginException(result.reason!, result.token));

    (req as any).stpLoginId = result.loginId;
    (req as any).stpToken = result.token;
    next();
  };
}
```

### 10.3 NestJS Guard（基于核心 + adapter-express）

```ts twoslash
@Injectable()
export class XltTokenGuard implements CanActivate {
  constructor(
    @Inject(XLT_TOKEN_CONTEXT) private readonly xlt: XltTokenContext,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.shouldIgnore(ctx)) return true;

    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const httpCtx = createExpressContext(req, res);

    const result = await this.xlt.stpLogic.checkLogin(httpCtx);
    if (!result.ok) throw new NestNotLoginException(result.reason!, result.token);

    req.stpLoginId = result.loginId;
    req.stpToken = result.token;
    return true;
  }
}
```

---

## 十一、迁移路径（4 个阶段）

### Phase 1 · 核心剥离（不破坏 1.0 用户）

- 在当前仓库新建 `packages/core`
- 把 `src/auth` / `src/store` / `src/token` / `src/core` / `src/const` 搬过去
- 引入 `HttpContext` 接口与 `createExpressContext` 内部 helper
- 当前 `src/` 仍然存在，只是内部转调 `@xlt-token/core`
- **对外 API 完全不变**

### Phase 2 · NestJS 包独立

- 新建 `packages/nestjs`，把 Module / Guard / Decorator / NestException 移过去
- 当前 `xlt-token` 包变成 thin re-export，全部从 `@xlt-token/nestjs` 转发
- 发 `1.2.0`：用户什么都不改就能继续工作

### Phase 3 · 多框架适配器

- 实现 `adapter-express` / `adapter-koa` / `adapter-fastify` / `adapter-hono`
- 每个适配器配套 README、demo、E2E
- 发 `2.0.0-rc.0`：多框架矩阵正式可用

### Phase 4 · 周边生态

- 拆出 `@xlt-token/store-redis`、`@xlt-token/strategy-jwt`
- 加入 `@xlt-token/adapter-elysia` / `adapter-h3`
- 发 `2.0.0` 稳定版

每个阶段都不破坏前一阶段的 API。

---

## 十二、测试与发布策略

**测试**

- `@xlt-token/core` 维持 98%+ 单测覆盖率（绝大多数测试不需要改）
- 每个适配器包 ≥ 90% 单测覆盖率，全部走 `HttpContext` mock
- `e2e/shared/` 写一份"鉴权场景宝典"，每个框架的 E2E 调它跑完所有场景
- Vitest workspace 模式聚合所有包测试

**发布**

- Turborepo + pnpm workspace + Changesets
- 单仓多包，每个适配器独立版本号
- 主版本号对齐 core（避免用户在不同适配器间踩版本不一致）
- 用 `tsdown` 统一打包（ESM-first + CJS 兼容）

**文档**

- VitePress 文档加 sidebar group："Frameworks"，每个框架一个独立子页
- 每个适配器的 README 用同一套模板（安装/集成/示例/差异点）

---

## 十三、与 1.0 的兼容性矩阵


| 1.0 用法                                       | 2.0 行为                       |
| -------------------------------------------- | ---------------------------- |
| `import { XltTokenModule } from 'xlt-token'` | 仍然可用，转发到 `@xlt-token/nestjs` |
| `StpUtil.login(...)`                         | 完全兼容                         |
| `@XltIgnore()` / `@LoginId()`                | 完全兼容                         |
| `request.stpLoginId` / `request.stpToken`    | 完全兼容（NestJS 适配器仍会挂到 req）     |
| 自定义 Store / Strategy                         | 完全兼容（接口不变）                   |
| `XltAbstractLoginGuard`                      | 完全兼容                         |


---

## 十四、风险与权衡


| 风险                           | 缓解                                                                   |
| ---------------------------- | -------------------------------------------------------------------- |
| 包数量膨胀（10+ 包）                 | Turborepo 缓存 + Changesets 联动发布，单次开发只动 2~3 个包                         |
| `HttpContext` 抽象漏掉框架特性       | 提供 `ctx.raw()` 逃生口；适配器可在 `ctx.state` 上扩展自有字段                         |
| 用户混用多适配器（如 NestJS + Express） | 文档明确：同一进程只用一套适配器；多套时各自 `createXltToken` 实例                           |
| 文档分散难维护                      | 共享 "Core API" / "Recipes" 章节，每个框架只写差异部分                              |
| 1.0 用户升级阻力                   | Phase 1/2 完全 API 兼容，2.0 升级仅需 `pnpm add @xlt-token/nestjs` 再改导入路径（可选） |


---

## 十五、后续 TODO

- 调研 `HttpContext` 是否需要 async 化（Hono / Elysia 部分 API 是异步获取 cookie）
- 评估 `@xlt-token/core` 是否需要拆 `core-runtime` 与 `core-types` 两包，降低 zero-dep 检查难度
- 输出"从 1.x 升级到 2.0 的迁移指南"草稿
- 在 `apps/playground/` 起一个最小框架矩阵跑通登录/踢人/顶号三场景，验证抽象是否漏接口
- 与社区讨论命名：是否需要更通用的 brand（如 `auth-anywhere`）以吸引 NestJS 以外用户

---

**修订记录**


| 日期         | 内容                                |
| ---------- | --------------------------------- |
| 2026-05-18 | 初稿：分层、HttpContext、各框架集成示例、迁移 4 阶段 |


