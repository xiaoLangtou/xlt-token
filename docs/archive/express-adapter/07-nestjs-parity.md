# 07 · 与 NestJS 语义对齐

> 返回 [目录](./README.md)  
> 参考：`packages/nestjs/src/guards/xlt-token.guard.ts`

---

## 1. 总对照表

| NestJS（1.x / @xlt-token/nestjs） | Express（@xlt-token/adapter-express） |
| --- | --- |
| `XltTokenModule.forRoot()` | `createXltToken()` |
| `APP_GUARD` + `XltTokenGuard` | `xltMiddleware(xlt)` |
| `@XltIgnore()` | `policies: [{ match, ignore: true }]` 或 `options.ignore` |
| `@XltCheckLogin()` | `policies: [{ match, requireLogin: true }]`（`defaultCheck: false` 时） |
| `@XltCheckPermission()` | `policies: [{ match, permissions }]` |
| `@XltCheckRole()` | `policies: [{ match, roles }]` |
| `@XltCheckSafe()` | `policies: [{ match, safeBusiness }]` |
| `@LoginId()` | `req.stpLoginId` |
| `@TokenValue()` | `req.stpToken` |
| `NotLoginException`（Nest HTTP） | `xltErrorHandler` → 401 JSON |
| `XltAbstractLoginGuard` | `createXltAuthMiddleware` + hooks |
| `createNestHttpContext` | `createExpressContext` |

---

## 2. `defaultCheck` 逻辑对照

**Nest — `XltTokenGuard.requiresLogin`：**

```ts
if (isIgnored) return false; // 不校验
if (config.defaultCheck) return true;
return shouldCheck ?? false;
```

**Express — `shouldCheckLogin`：**

```ts
if (meta.ignore) return false;
if (config.defaultCheck) return true;
return meta.requireLogin ?? false;
```

行为矩阵一致，见 [03-design-thinking.md](./03-design-thinking.md#6-defaultcheck-黑白名单思路)。

---

## 3. 鉴权执行顺序对照

| 步骤 | Nest `XltTokenGuard` | Express `runAuth` |
| --- | --- | --- |
| 1 | `checkLogin(httpCtx)` | 同左 |
| 2 | `req.stpLoginId = result.loginId` | `syncExpressAuthState` |
| 3 | `checkPermission`（若有 meta） | 先解析策略表，再读 `req._xltRouteMeta.permissions` |
| 4 | `checkRole`（若有 meta） | 先解析策略表，再读 `req._xltRouteMeta.roles` |
| 5 | `checkSafe`（若有 business） | 先解析策略表，再读 `req._xltRouteMeta.safeBusiness` |

异常均通过 `rethrowCoreAuthException`（Nest）或 `next(err)`（Express）向上抛。

---

## 4. Token 读取与 state 字段

| 契约 | Nest | Express |
| --- | --- | --- |
| 读取顺序 | core `getTokenValue` | 同左（共用 HttpContext） |
| state 字段 | `ctx.state.stpLoginId` | 同左 |
| 对外字段 | `request.stpLoginId` | `req.stpLoginId` |

---

## 5. 无法在 Express 直接等价的能力

| Nest 能力 | Express 替代建议 |
| --- | --- |
| `Reflector` 类级 + 方法级 meta 合并 | `policies` 通过前缀策略 + 更具体策略覆盖表达；必要时用函数 matcher |
| `ExecutionContext` / 非 HTTP | 不适用；仅 HTTP 场景 |
| 全局 `APP_GUARD` 自动作用于所有 Controller | 需显式 `app.use` 或 Router `use` |
| 参数装饰器 `@LoginId()` | 直接读 `req.stpLoginId` |

---

## 6. E2E 对齐要求

同一 **场景表**（登录、顶号、踢人、`activeTimeout`、权限 AND/OR）在 Nest 与 Express 上：

- HTTP status 相同
- body 含 `type`（NotLogin）或 `permission`（NotPermission）字段一致
- 成功响应中 `loginId` 一致

场景表定义于 `e2e/shared/`（待建），Express 用例见 [09-testing.md](./09-testing.md)。
