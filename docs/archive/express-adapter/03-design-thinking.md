# 03 · 设计思路

> 返回 [目录](./README.md)

---

## 1. 为什么 Express 用中间件而不是 Guard

Express 没有内置的「路由守卫」或反射元数据系统。idiomatic 做法是：

- **全局**：`app.use(xltMiddleware(xlt))` — 对标 Nest `APP_GUARD` + `XltTokenGuard`
- **路由级**：在路由定义前挂 `ignoreAuth()` / `requireLogin()` / `checkPermission()` — 对标 `@XltIgnore()` 等装饰器

思路：**不发明 Express 版装饰器**，用「前置中间件写 meta + 全局中间件读 meta」复刻 Reflector 行为。

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

## 4. 路由元数据：`req._xltRouteMeta`

Nest 用 `Reflector.getAllAndOverride(XLT_IGNORE_KEY, [handler, class])`。

Express 无 handler 对象，采用 **请求级 meta 对象**：

```ts
interface RouteAuthMeta {
  ignore?: boolean;
  requireLogin?: boolean;
  permissions?: { list: string[]; mode: XltMode };
  roles?: { list: string[]; mode: XltMode };
  safeBusiness?: string;
}
```

各 helper 中间件只负责 **合并写入** `req._xltRouteMeta`；`xltMiddleware` 在 `checkLogin` 前读取并决定 `shouldCheckLogin`。

**中间件顺序约定**（重要）：

```
app.use(xltMiddleware(xlt));     // 全局，读 meta
app.get('/x', ignoreAuth(), fn); // 路由级 meta 须在 xlt 之后、handler 之前生效
```

更稳妥写法：路由级 meta 中间件写在 **该路由链最前面**：

```ts
app.get('/public', ignoreAuth(), handler);
// ignoreAuth 先于 handler 执行；xltMiddleware 已在更上层执行过 —— 需约定 xlt 在路由匹配后仍能读到 meta
```

**推荐模式**：全局 `xltMiddleware` 放在 **路由注册之后不可行**；应使用「先注册路由 meta，再统一鉴权」或「xltMiddleware 内根据 `req.route?.path` + 全局 ignore 表」组合。

**最终采用**（与 Nest 语义一致）：

1. 全局 `xltMiddleware` 对所有请求执行
2. 路由在注册时把 meta **挂到 layer stack**：`router.get(path, ignoreAuth(), checkPermission(), handler)`
3. `ignoreAuth` 等必须在 **同一路由** 的 handler 之前；`xltMiddleware` 作为 `app.use` 时，在 Express 4 中先于 router 执行 —— **meta 中间件需把标记写在 `req` 上，且 xlt 在 router 之前无法看到后续 route 的 meta**

**解决办法**：将 `xltMiddleware` 挂载在 **router 级别** 或拆成两层：

- **方案 A（推荐）**：`app.use(xltMiddleware)` + 路由 meta 使用 `req._xltRouteMeta`，且 **每个 Router 上** `router.use(xltMiddleware)`，保证顺序为 `meta → xlt → handler`
- **方案 B**：仅依赖 `options.ignore` 路径表 + 显式 `requireLogin()` 路由（`defaultCheck: false` 时）

实施文档 [08-implementation-steps.md](./08-implementation-steps.md) 采用 **方案 A 变体**：全局 middleware 在 `next()` 前读取 **已执行过的** 同请求内 meta——通过把 `ignoreAuth` 放在 **子 router** 且 `router.use(xltMiddleware)` 解决顺序问题；根 app 文档示例用 `Router` 说明。

简化 **MVP**：全局 `xltMiddleware` + `options.ignore` 路径白名单；`ignoreAuth()` 设置 `req._xltRouteMeta.ignore = true`，并要求用户将需忽略的路由注册在 **带 `ignoreAuth` 的 Router** 内，且该 Router `use(xltMiddleware)` 在 `ignoreAuth` 之后——详见 [06-l3-integration-api.md](./06-l3-integration-api.md)。

---

## 5. `defaultCheck` 黑白名单思路

与 `XltTokenGuard.requiresLogin` 相同：

```ts
function shouldCheckLogin(req: Request, config: XltTokenConfig): boolean {
  const meta = req._xltRouteMeta ?? {};
  if (config.defaultCheck) return !meta.ignore;
  return meta.requireLogin ?? false;
}
```

| `defaultCheck` | 路由未标 meta | `ignoreAuth()` | `requireLogin()` |
| --- | --- | --- | --- |
| `true`（默认） | 校验 | 跳过 | 校验 |
| `false` | 跳过 | 跳过 | 校验 |

---

## 6. 异常走 Express 四参数错误中间件

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

## 7. `createExpressContext` 从 core 迁出的理由

| 留在 core | 迁到 adapter-express |
| --- | --- |
| Nest 可直接 `import { createExpressContext } from '@xlt-token/core'` | 违反「core 零框架依赖」原则 |
| 实现已是 ExpressLike 结构类型，非真零依赖 | 包边界清晰，符合 [12-multi-framework-architecture.md](../12-multi-framework-architecture.md) |

迁移策略：adapter 为 **canonical**；core **deprecated re-export** 至少一个 minor。见 [11-risks-and-migration.md](./11-risks-and-migration.md)。

---

## 8. 与 NestJS 共用适配器

`@xlt-token/nestjs` 的 `createNestHttpContext` 应改为：

```ts
export { createExpressContext as createNestHttpContext } from '@xlt-token/adapter-express';
```

保证 Nest（Express 模式）与纯 Express **同一 HttpContext 实现**，E2E 行为一致。
