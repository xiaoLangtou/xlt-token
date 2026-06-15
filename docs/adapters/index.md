# 框架适配器

适配器把框架的 Request 和 Response 转换成 Core 的 `HttpContext`，并提供该框架习惯的
注册、路由声明、请求状态和错误处理方式。鉴权语义仍由 `@xlt-token/core` 执行。

## 可用适配器

| 适配器 | 安装 | 主要能力 | 完整文档 |
| --- | --- | --- | --- |
| NestJS | `pnpm add @xlt-token/nestjs` | Module、DI、Guard、Decorator、Fastify 支持 | [NestJS 快速开始](/adapters/nestjs/getting-started) |
| Express | `pnpm add express @xlt-token/express` | middleware、Router policy、route helper、错误处理 | [Express 完整指南](/adapters/express) |

## NestJS 适合什么项目

NestJS 适配器适合已经使用 Module 和依赖注入管理基础设施的项目。它提供：

- `XltTokenModule.forRoot()` 和 `forRootAsync()`
- `XltTokenGuard` 与自定义 Guard 基类
- 登录 ID、token、权限、角色和二级认证装饰器
- Express 与 Fastify 两个平台的请求桥接
- Core API 和类型的 re-export

NestJS 用户通常从 [快速开始](/adapters/nestjs/getting-started) 跑通登录流程，再阅读
[模块配置](/adapters/nestjs/module-config) 和
[守卫与装饰器](/adapters/nestjs/guards-and-decorators)。

## Express 适合什么项目

Express 适配器不引入 Module 或装饰器。它提供：

- `xltMiddleware()` 统一鉴权
- Router 级 `ignore` 和 `policies`
- `requireLogin()`、`checkPermission()` 等 route helper
- 请求状态的 TypeScript 类型增强
- `xltErrorHandler()` 错误响应

[Express 完整指南](/adapters/express) 从实例创建一直覆盖到生产中间件顺序和测试。

## 其他框架

没有专用适配器时，直接使用 `@xlt-token/core` 并实现 `HttpContext`。完整桥接示例见
[Core 独立使用](/core/getting-started)。

适配器只负责框架边界。自定义适配器不应复制 token 生命周期、权限匹配或 Session
逻辑，而应调用 Core 的 `StpLogic` 和 `StpPermLogic`。

## Redis

Redis Store 不属于任何框架适配器。NestJS、Express 和 Core 都从
`@xlt-token/store-redis` 导入 Store：

[Redis Store 完整指南](/store-redis/)

## 下一步

- NestJS：[快速开始](/adapters/nestjs/getting-started)
- Express：[完整指南](/adapters/express)
- 自定义框架：[Core 独立使用](/core/getting-started)
- 分布式登录态：[Redis Store 完整指南](/store-redis/)
