# 适配器总览

适配器负责把具体框架的 Request / Response 转换成 core 可理解的 `HttpContext`，再提供该框架惯用的接入方式。

## 可用适配器

| 适配器 | 包 | 状态 | 文档 |
| --- | --- | --- | --- |
| NestJS | `@xlt-token/nestjs` | 可用 | [快速开始](/adapters/nestjs/getting-started) |
| Express | `@xlt-token/express` | 可用 | [Express 适配器](/adapters/express) |

## 选择方式

如果你正在构建 NestJS 应用，直接使用 NestJS 适配器。它提供模块注册、全局 Guard、装饰器和参数装饰器。

如果你正在构建 Express 应用，可以使用 Express 适配器。它提供中间件、路由策略、route helper 和错误处理器。

如果你正在接入其他框架，可以先阅读 [Core 快速开始](/core/getting-started)，理解 `HttpContext` 的桥接方式。

## 下一步

- NestJS 项目：[NestJS 快速开始](/adapters/nestjs/getting-started)
- Express 项目：[Express 适配器](/adapters/express)
- 框架无关集成：[Core 快速开始](/core/getting-started)
- 架构分层：[架构设计](/guide/architecture)
