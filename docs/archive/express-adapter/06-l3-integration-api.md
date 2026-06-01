# 06 · L3 集成层 API

> 返回 [目录](./README.md)

---

## 1. 全局中间件 `xltMiddleware`

### 1.1 签名

```ts
export type AuthMatcher = string | RegExp | ((req: Request) => boolean);

export interface RouteAuthPolicy extends RouteAuthMeta {
  /** 匹配 req.originalUrl；字符串规则支持精确匹配和前缀匹配 */
  match: AuthMatcher | AuthMatcher[];
  /** 不传表示匹配所有 HTTP method */
  methods?: string[];
}

export interface XltMiddlewareOptions {
  /** 快捷白名单，会被转换为 { match, ignore: true } */
  ignore?: AuthMatcher[];
  /** 路由级鉴权策略。xltMiddleware 会在鉴权前解析这些规则。 */
  policies?: RouteAuthPolicy[];
}

export function xltMiddleware(
  xlt: XltTokenContext,
  options?: XltMiddlewareOptions,
): RequestHandler;
```

### 1.2 执行流程

```
请求进入
  → createExpressContext(req, res)
  → resolveRouteAuthMeta(req, options) → req._xltRouteMeta
  → shouldCheckLogin(req, xlt.config)? → next()
  → try runAuth(xlt, httpCtx, req)
       → stpLogic.checkLogin (失败 throw)
       → stpPermLogic 按已解析的 meta 校验
       → stpLogic.checkSafe 按已解析的 meta 校验
  → syncExpressAuthState(req, httpCtx)
  → next()
  catch → next(err)
```

### 1.3 实现骨架

```ts
export function xltMiddleware(xlt: XltTokenContext, options: XltMiddlewareOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const httpCtx = createExpressContext(req, res);
    req._xltRouteMeta = {
      ...req._xltRouteMeta,
      ...resolveRouteAuthMeta(req, options),
    };

    if (!shouldCheckLogin(req, xlt.config)) return next();

    try {
      await runAuth(xlt, httpCtx, req);
      syncExpressAuthState(req, httpCtx);
      next();
    } catch (err) {
      next(err);
    }
  };
}
```

---

## 2. 路由策略解析

策略解析必须发生在 `shouldCheckLogin` 和 `runAuth` 之前。适配器使用 `req.originalUrl` 作为默认匹配目标，避免 `Router` 嵌套时 `req.path` 丢失挂载前缀。

### 2.1 `resolveRouteAuthMeta`

```ts
export function resolveRouteAuthMeta(
  req: Request,
  options: XltMiddlewareOptions = {},
): RouteAuthMeta {
  const policies: RouteAuthPolicy[] = [
    ...(options.ignore ?? []).map((match) => ({ match, ignore: true })),
    ...(options.policies ?? []),
  ];

  return policies.reduce<RouteAuthMeta>((meta, policy) => {
    if (!matchPolicy(req, policy)) return meta;
    const { match: _match, methods: _methods, ...nextMeta } = policy;
    return mergeRouteAuthMeta(meta, nextMeta);
  }, {});
}
```

当多条策略同时命中时，后面的策略覆盖前面的简单字段，并合并权限/角色字段。这样用户可以先声明 `/api` 默认策略，再声明 `/api/public` 例外。

### 2.2 匹配规则

```ts
export function matchPolicy(req: Request, policy: RouteAuthPolicy): boolean {
  if (policy.methods?.length && !policy.methods.includes(req.method.toUpperCase())) {
    return false;
  }

  const matchers = Array.isArray(policy.match) ? policy.match : [policy.match];
  return matchers.some((matcher) => {
    if (typeof matcher === 'function') return matcher(req);
    if (typeof matcher === 'string') {
      return req.originalUrl === matcher || req.originalUrl.startsWith(matcher);
    }
    return matcher.test(req.originalUrl);
  });
}
```

---

## 3. 可选路由级 helper

`ignoreAuth()`、`requireLogin()`、`checkPermission()`、`checkRole()`、`checkSafe()` 可以保留为高级用法，但它们不是推荐主路径。它们只写 `req._xltRouteMeta`，因此必须在同一条 route chain 中位于 `xltMiddleware` 之前才有效。

```ts
export function checkPermission(
  permission: string | string[],
  mode: XltMode = XltMode.AND,
): RequestHandler {
  return (req, _res, next) => {
    const list = Array.isArray(permission) ? permission : [permission];
    req._xltRouteMeta = {
      ...req._xltRouteMeta,
      permissions: { list, mode },
    };
    next();
  };
}
```

`checkRole`、`checkSafe` 同理，字段见 `RouteAuthMeta`。

错误用法：

```ts
api.use(xltMiddleware(xlt));
api.get('/public', ignoreAuth(), handler); // ignoreAuth 执行太晚，xltMiddleware 看不到
```

有效但不推荐的高级用法：

```ts
api.get('/public', ignoreAuth(), xltMiddleware(xlt), handler);
```

---

## 4. 编排 `runAuth`

```ts
export async function runAuth(
  xlt: XltTokenContext,
  httpCtx: HttpContext,
  req: Request,
): Promise<AuthResult> {
  const result = await xlt.stpLogic.checkLogin(httpCtx);

  const meta = req._xltRouteMeta;
  if (meta?.permissions && xlt.stpPermLogic) {
    await xlt.stpPermLogic.checkPermission(
      result.loginId!,
      meta.permissions.list,
      meta.permissions.mode,
    );
  }
  if (meta?.roles && xlt.stpPermLogic) {
    await xlt.stpPermLogic.checkRole(
      result.loginId!,
      meta.roles.list,
      meta.roles.mode,
    );
  }
  if (meta?.safeBusiness) {
    await xlt.stpLogic.checkSafe(result.token!, meta.safeBusiness);
  }

  return result;
}
```

与 `XltTokenGuard.canActivate` 中权限块 **逻辑等价**。

---

## 5. 路径白名单 `matchIgnore`

`matchIgnore` 是 `resolveRouteAuthMeta` 的快捷分支。内部可以复用 `matchPolicy`，对外保留便于单测和高级用户调用。

```ts
export function matchIgnore(req: Request, rules?: AuthMatcher[]): boolean {
  if (!rules?.length) return false;
  return rules.some((rule) => {
    if (typeof rule === 'function') return rule(req);
    if (typeof rule === 'string') {
      return req.originalUrl === rule || req.originalUrl.startsWith(rule);
    }
    return rule.test(req.originalUrl);
  });
}
```

---

## 6. 错误处理 `xltErrorHandler`

四参数 Express 错误中间件，挂在链末尾：

```ts
export function xltErrorHandler(): ErrorRequestHandler {
  return (err, _req, res, next) => {
    if (err instanceof NotLoginException) {
      return res.status(401).json({
        statusCode: 401,
        code: err.code,
        type: err.type,
        message: err.message,
        token: err.token,
      });
    }
    if (err instanceof NotPermissionException) {
      return res.status(403).json({
        statusCode: 403,
        code: err.code,
        permission: err.permission,
        mode: err.mode,
        message: err.message,
      });
    }
    // NotRoleException、NotSafeException 同理
    next(err);
  };
}
```

---

## 7. 推荐挂载顺序

```ts
const app = express();
app.use(express.json());
app.use(cookieParser());

const api = express.Router();
api.use(xltMiddleware(xlt, {
  policies: [
    { match: '/api/public', ignore: true },
    { match: '/api/admin', permissions: { list: ['admin:*'], mode: XltMode.AND } },
  ],
}));

api.get('/public', publicHandler);
api.get('/me', meHandler);
api.delete('/admin/users/:id', deleteHandler);

app.use('/api', api);
app.use(xltErrorHandler());
```

文档与 playground 采用 **Router 级 `xltMiddleware` + `policies` 策略表** 作为默认最佳实践。策略中的 `match` 使用挂载后的 `req.originalUrl`，因此示例中包含 `/api` 前缀。

---

## 8. 自定义鉴权中间件（对标 `XltAbstractLoginGuard`）

```ts
export function createXltAuthMiddleware(
  xlt: XltTokenContext,
  options: XltMiddlewareOptions = {},
  hooks?: {
    onAuthSuccess?: (result: AuthResult, req: Request) => void | Promise<void>;
    onAuthFail?: (err: NotLoginException, req: Request) => void | Promise<void>;
  },
): RequestHandler {
  return async (req, res, next) => {
    const httpCtx = createExpressContext(req, res);
    req._xltRouteMeta = {
      ...req._xltRouteMeta,
      ...resolveRouteAuthMeta(req, options),
    };
    try {
      const result = await runAuth(xlt, httpCtx, req);
      syncExpressAuthState(req, httpCtx);
      await hooks?.onAuthSuccess?.(result, req);
      next();
    } catch (err) {
      if (err instanceof NotLoginException) {
        await hooks?.onAuthFail?.(err, req);
      }
      next(err);
    }
  };
}
```
