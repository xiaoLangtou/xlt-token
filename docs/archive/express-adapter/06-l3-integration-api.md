# 06 · L3 集成层 API

> 返回 [目录](./README.md)

---

## 1. 全局中间件 `xltMiddleware`

### 1.1 签名

```ts
export interface XltMiddlewareOptions {
  /** 路径白名单：字符串前缀或 RegExp，匹配则跳过鉴权 */
  ignore?: Array<string | RegExp>;
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
  → matchIgnore(req.path, options.ignore)? → next()
  → shouldCheckLogin(req, xlt.config)? → next()
  → try runAuth(xlt, httpCtx, req)
       → stpLogic.checkLogin (失败 throw)
       → stpPermLogic 按 meta 校验
       → stpLogic.checkSafe 按 meta
  → syncExpressAuthState(req, httpCtx)
  → next()
  catch → next(err)
```

### 1.3 实现骨架

```ts
export function xltMiddleware(xlt: XltTokenContext, options: XltMiddlewareOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const httpCtx = createExpressContext(req, res);

    if (matchIgnore(req.path, options.ignore)) return next();
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

## 2. 路由级 Meta 中间件

均 **只写** `req._xltRouteMeta`，不调用 `next` 以外的鉴权逻辑。

### 2.1 `ignoreAuth()`

```ts
export function ignoreAuth(): RequestHandler {
  return (req, _res, next) => {
    req._xltRouteMeta = { ...req._xltRouteMeta, ignore: true };
    next();
  };
}
```

### 2.2 `requireLogin()`

```ts
export function requireLogin(): RequestHandler {
  return (req, _res, next) => {
    req._xltRouteMeta = { ...req._xltRouteMeta, requireLogin: true };
    next();
  };
}
```

### 2.3 `checkPermission(permission, mode?)`

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

---

## 3. 编排 `runAuth`

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

## 4. 路径白名单 `matchIgnore`

```ts
export function matchIgnore(path: string, rules?: Array<string | RegExp>): boolean {
  if (!rules?.length) return false;
  return rules.some((rule) => {
    if (typeof rule === 'string') return path === rule || path.startsWith(rule);
    return rule.test(path);
  });
}
```

---

## 5. 错误处理 `xltErrorHandler`

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

## 6. 推荐挂载顺序

```ts
const app = express();
app.use(express.json());
app.use(cookieParser());

// 业务路由（带 meta）
const api = express.Router();
api.get('/public', ignoreAuth(), publicHandler);
api.get('/me', meHandler);
api.delete('/users/:id', requireLogin(), checkPermission('user:delete'), deleteHandler);

app.use('/api', api);

// 鉴权：对 /api 下请求生效（Router 级更清晰）
app.use('/api', xltMiddleware(xlt, { ignore: [] }));

app.use(xltErrorHandler());
```

**注意**：Express 中间件顺序为注册顺序。若 `xltMiddleware` 在 router **之前** 注册，则 **看不到** router 内 `ignoreAuth` 写入的 meta。

**推荐**：

```ts
const api = express.Router();
api.use(xltMiddleware(xlt)); // Router 内第一层
api.get('/public', ignoreAuth(), handler);
api.get('/me', handler);
app.use('/api', api);
```

文档与 playground 采用 **Router 级 xltMiddleware** 作为默认最佳实践。

---

## 7. 自定义鉴权中间件（对标 `XltAbstractLoginGuard`）

```ts
export function createXltAuthMiddleware(
  xlt: XltTokenContext,
  hooks?: {
    onAuthSuccess?: (result: AuthResult, req: Request) => void | Promise<void>;
    onAuthFail?: (err: NotLoginException, req: Request) => void | Promise<void>;
  },
): RequestHandler {
  return async (req, res, next) => {
    const httpCtx = createExpressContext(req, res);
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
