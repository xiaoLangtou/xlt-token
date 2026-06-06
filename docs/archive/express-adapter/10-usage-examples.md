# 10 · 使用示例

> 返回 [目录](./README.md)

---

## 1. 最小可运行应用

```ts
import express from 'express';
import cookieParser from 'cookie-parser';
import { createXltToken } from '@xlt-token/core';
import {
  xltMiddleware,
  xltErrorHandler,
} from '@xlt-token/express';

const xlt = createXltToken({
  config: {
    tokenName: 'authorization',
    tokenPrefix: 'Bearer ',
    defaultCheck: true,
  },
});

const app = express();
app.use(express.json());
app.use(cookieParser());

const api = express.Router();
api.use(xltMiddleware(xlt, {
  policies: [
    { match: '/api/auth/login', ignore: true, methods: ['POST'] },
    { match: '/api/health', ignore: true },
  ],
}));

api.post('/auth/login', async (req, res) => {
  const token = await xlt.stpLogic.login(req.body.userId);
  res.json({ token });
});

api.get('/health', (_req, res) => {
  res.json({ ok: true });
});

api.get('/me', (req, res) => {
  res.json({
    loginId: req.stpLoginId,
    token: req.stpToken,
  });
});

app.use('/api', api);
app.use(xltErrorHandler());

app.listen(3000);
```

---

## 2. 登录与携带 Token

```bash
# 登录
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userId":"1001"}'

# 访问受保护接口
curl -s http://localhost:3000/api/me \
  -H 'authorization: Bearer <token>'
```

---

## 3. `defaultCheck: false`（白名单模式）

```ts
const xlt = createXltToken({
  config: { defaultCheck: false },
});

api.use(xltMiddleware(xlt, {
  policies: [
    { match: '/api/admin', requireLogin: true },
  ],
}));

// 仅显式标记的路由需要登录
api.get('/admin', adminHandler);
api.get('/public', publicHandler); // 无需 token
```

---

## 4. 权限与二级认证

```ts
import {
  xltMiddleware,
} from '@xlt-token/express';
import { XltMode } from '@xlt-token/core';

api.use(xltMiddleware(xlt, {
  policies: [
    {
      match: '/api/pay',
      methods: ['POST'],
      requireLogin: true,
      permissions: { list: ['order:pay', 'wallet:use'], mode: XltMode.AND },
      safeBusiness: 'pay',
    },
  ],
}));

api.post('/pay', async (req, res) => {
  res.json({ ok: true, userId: req.stpLoginId });
});
```

需在 `createXltToken` 时注入 `stpInterface`（权限数据源），与 Nest 配置相同。

---

## 5. 业务内直接调用 core API

中间件只负责「当前请求的登录态」；登出、踢人、Session 等仍用 `xlt.stpLogic`：

```ts
api.post('/auth/logout', async (req, res) => {
  const token = req.stpToken!;
  await xlt.stpLogic.logout(token);
  res.json({ ok: true });
});

api.post('/admin/kickout/:id', async (req, res) => {
  await xlt.stpLogic.kickout(req.params.id);
  res.json({ ok: true });
});
```

`/auth/logout` 与 `/admin/kickout/:id` 的登录和权限要求应写在 `xltMiddleware` 的 `policies` 中。不要在 `api.use(xltMiddleware)` 后面依赖 route helper 写入鉴权 meta。

---

## 6. 自定义鉴权（对标 `XltAbstractLoginGuard`）

```ts
import { createXltAuthMiddleware } from '@xlt-token/express';

api.use(
  createXltAuthMiddleware(
    xlt,
    { policies: [{ match: '/api/profile', requireLogin: true }] },
    {
      onAuthFail: async (err, req) => {
        console.warn('auth fail', req.path, err.type);
      },
    },
  ),
);
```

---

## 7. 与静态门面 `StpUtil` 共用

`createXltToken` 已调用 `setStpLogic`，可在非请求上下文使用：

```ts
import { StpUtil } from '@xlt-token/core';

// 定时任务：清理会话等
await StpUtil.logout(token);
```

请求内优先读 `req.stpLoginId`，避免重复 `checkLogin`。

---

## 8. 常见错误响应

未登录（401）：

```json
{
  "statusCode": 401,
  "code": "NOT_LOGIN",
  "type": "INVALID_TOKEN",
  "message": "Token 无效",
  "token": "xxx"
}
```

无权限（403）：

```json
{
  "statusCode": 403,
  "code": "NOT_PERMISSION",
  "permission": "user:delete",
  "mode": "AND",
  "message": "..."
}
```
