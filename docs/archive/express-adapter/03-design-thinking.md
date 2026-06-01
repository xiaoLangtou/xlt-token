# 03 · 设计思路

> 返回 [目录](./README.md)

---

## 1. 为什么 Express 用中间件而不是 Guard

Express 没有内置的「路由守卫」或反射元数据系统。idiomatic 做法是：

- **全局**：`app.use(xltMiddleware(xlt))` — 对标 Nest `APP_GUARD` + `XltTokenGuard`
- **路由级**：在 `xltMiddleware` 的策略表里声明 `ignore` / `requireLogin` / `permissions` — 对标 `@XltIgnore()` 等装饰器

思路：**不发明 Express 版装饰器**，用「请求进入时按 method + path 解析策略」复刻 Reflector 行为。后续路由中间件可以作为高级用法，但首选 API 必须保证策略在鉴权前可见。

---

## 2. 为什么保留 `HttpContext` 而不是直接用 `req`

| 若直接用 `req` | 用 `HttpContext` |
| --- | --- |
| `StpLogic` 绑死 Express 类型 | core 零框架依赖 |
| 多框架要复制鉴权逻辑 | 各适配器只写 ~100 行胶水 |
| 测试必须 mock Express | 测试用 `createMockHttpContext` |

Express 适配器职责仅是：**把 Express 原生能力映射到最小读/写契约**（header / cookie / query / setHeader / setCookie）。

---

## 3. `state` 与 `req.stpLoginId` 双写

核心在 `checkLogin` 成功后将登录态写入 `ctx.state`：

```ts
ctx.state.stpLoginId = loginId;
ctx.state.stpToken = token;
```

Express 用户习惯读 `req.stpLoginId`（与 Nest 1.0 一致）。因此 L3 在鉴权成功后执行 **同步**：

```ts
req.stpLoginId = ctx.state.stpLoginId as string;
req.stpToken = ctx.state.stpToken as string;
```

`_xltState` 与 `req.stpLoginId` 指向同一业务数据，避免「只写 state、handler 读不到 req」的割裂。

---

## 4. 路由策略：`RouteAuthPolicy`

Nest 用 `Reflector.getAllAndOverride(XLT_IGNORE_KEY, [handler, class])`。

Express 无稳定的 handler 反射对象。适配器采用 **策略表**，在 `xltMiddleware` 执行时根据 `req.method` 与 `req.originalUrl` 解析出本次请求的 meta：

```ts
type AuthMatcher = string | RegExp | ((req: Request) => boolean);

interface RouteAuthMeta {
  ignore?: boolean;
  requireLogin?: boolean;
  permissions?: { list: string[]; mode: XltMode };
  roles?: { list: string[]; mode: XltMode };
  safeBusiness?: string;
}

interface RouteAuthPolicy extends RouteAuthMeta {
  match: AuthMatcher | AuthMatcher[];
  methods?: string[];
}
```

`xltMiddleware` 先调用 `resolveRouteAuthMeta(req, options.policies)`，再把结果写入 `req._xltRouteMeta`，最后执行 `shouldCheckLogin` 与 `runAuth`。因此 ignore、权限、角色和 safe 都在鉴权前可见。

---

## 5. 为什么不把 route helper 作为主方案

Express 中间件按注册顺序执行。如果用户这样写：

```ts
api.use(xltMiddleware(xlt));
api.get('/public', ignoreAuth(), handler);
api.post('/pay', checkPermission('order:pay'), handler);
```

`xltMiddleware` 会先于 `ignoreAuth()` 和 `checkPermission()` 执行，因此它看不到这些 helper 写入的 `req._xltRouteMeta`。这会导致公开路由无法放行，权限、角色和 safe 也不会生效。

因此首版必须把策略放到 `xltMiddleware` options 中，或提供一个封装顺序的 Router 工厂。普通 helper 中间件只能作为高级用法，且必须在同一条 route chain 中位于 `xltMiddleware` 之前：

```ts
api.get('/public', ignoreAuth(), xltMiddleware(xlt), handler);
```

这种写法容易漏挂鉴权中间件，不作为文档推荐路径。

## 6. `defaultCheck` 黑白名单思路

与 `XltTokenGuard.requiresLogin` 相同：

```ts
function shouldCheckLogin(req: Request, config: XltTokenConfig): boolean {
  const meta = req._xltRouteMeta ?? {};
  if (config.defaultCheck) return !meta.ignore;
  return meta.requireLogin ?? false;
}
```

| `defaultCheck` | 路由无策略 | `ignore: true` | `requireLogin: true` |
| --- | --- | --- | --- |
| `true`（默认） | 校验 | 跳过 | 校验 |
| `false` | 跳过 | 跳过 | 校验 |

---

## 7. 异常走 Express 四参数错误中间件

core 抛 `NotLoginException` 等 **纯 Error 子类**。Express 惯用：

```ts
try {
  await runAuth(...);
  next();
} catch (err) {
  next(err);
}
```

由 `xltErrorHandler` 映射为 `res.status(401).json({ type, ... })`，与 Nest `UnauthorizedException` 响应体对齐。

---

## 8. `createExpressContext` 从 core 迁出的理由

| 留在 core | 迁到 adapter-express |
| --- | --- |
| Nest 可直接 `import { createExpressContext } from '@xlt-token/core'` | 违反「core 零框架依赖」原则 |
| 实现已是 ExpressLike 结构类型，非真零依赖 | 包边界清晰，符合 [12-multi-framework-architecture.md](../12-multi-framework-architecture.md) |

迁移策略：adapter 为 **canonical**；core 保留旧实现并标记 `@deprecated` 至少一个 minor，避免 core 反向依赖 adapter。见 [11-risks-and-migration.md](./11-risks-and-migration.md)。

---

## 9. 与 NestJS 共用适配器

`@xlt-token/nestjs` 的 `createNestHttpContext` 应改为：

```ts
export { createExpressContext as createNestHttpContext } from '@xlt-token/adapter-express';
```

保证 Nest（Express 模式）与纯 Express **同一 HttpContext 实现**，E2E 行为一致。
