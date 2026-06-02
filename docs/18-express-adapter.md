# Express 适配器

Express 适配器正在实现中。目标包为 `@xlt-token/adapter-express`，用于把纯 Express 应用接入 xlt-token。

## 计划能力

- `createExpressContext(req, res)`：把 Express 请求桥接为 `HttpContext`
- `xltMiddleware(xlt, options)`：全局登录校验与路由策略
- 路由策略表：`ignore`、`requireLogin`、`permissions`、`roles`、`safeBusiness`
- route helper：`ignoreAuth`、`requireLogin`、`checkPermission`、`checkRole`、`checkSafe`
- `xltErrorHandler()`：把 core 异常映射成 Express JSON 响应

## 当前建议

在 Express 适配器完成前，可以先阅读 [Core 快速开始](/core/getting-started)，了解如何用 `HttpContext` 连接任意 HTTP 框架。

设计草案保留在内部归档文档中：

- [Express adapter 设计总览](./archive/express-adapter/README.md)
- [L2 适配层](./archive/express-adapter/05-l2-adapter-layer.md)
- [L3 集成 API](./archive/express-adapter/06-l3-integration-api.md)
