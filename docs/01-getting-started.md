# 01 · 快速开始

xlt-token 由框架无关的 `@xlt-token/core` 和框架适配器组成。选择你正在使用的运行环境，然后进入对应的快速开始。

## 选择环境

| 环境 | 安装 | 入口 |
| --- | --- | --- |
| NestJS | `pnpm add @xlt-token/nestjs @xlt-token/core` | [NestJS 快速开始](/adapters/nestjs/getting-started) |
| Core | `pnpm add @xlt-token/core` | [Core 快速开始](/core/getting-started) |
| Express | `pnpm add @xlt-token/adapter-express @xlt-token/core` | [规划中](/adapters/express) |

## NestJS 在线 Demo

可以直接打开 Cloud Studio 模板运行 NestJS 示例，无需先在本地安装依赖。

[![Cloud Studio Template](https://cs-res.codehub.cn/common/assets/icon-badge.svg)](https://cloudstudio.net/a/35877741980655616?channel=share&sharetype=Markdown)

打开模板后，按模板内的终端提示启动服务，再进入 [NestJS 快速开始](/adapters/nestjs/getting-started) 的客户端调用小节验证接口。

## 怎么选

选择 `NestJS` 时，你会看到模块、Guard、装饰器和参数装饰器。选择 `Core` 时，你会看到框架无关的鉴权运行时和 `HttpContext` 桥接方式。选择 `Express` 时，会进入正在实现的适配器路线页。

后续 Express、Fastify、Hono 等适配器会继续加入这排 tabs。

## 下一步

- 想先跑起来？进入 [NestJS 快速开始](/adapters/nestjs/getting-started)。
- 想理解底层机制？进入 [架构设计](/guide/architecture)。
- 想只用核心能力？进入 [Core 快速开始](/core/getting-started)。
