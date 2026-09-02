---
title: xlt-token 快速开始
description: 按 Core、NestJS、Express、Fastify 和 Redis Store 的使用场景选择 xlt-token 接入方式，快速搭建 TypeScript Token 鉴权。
---

# 快速开始

xlt-token 把鉴权核心、Redis 存储和框架适配器拆成独立包。先按运行环境选择入口；
需要多实例共享登录态时，再为任一入口增加 Redis Store。

## 选择环境

| 场景 | 安装 | 文档入口 |
| --- | --- | --- |
| 自定义框架、脚本或只需要鉴权运行时 | `pnpm add @xlt-token/core` | [Core 独立使用](/core/getting-started) |
| NestJS Module、Guard 和装饰器 | `pnpm add @xlt-token/nestjs` | [NestJS 快速开始](/adapters/nestjs/getting-started) |
| Express middleware 和 route helper | `pnpm add express @xlt-token/express` | [Express 完整指南](/adapters/express) |
| 多实例共享会话或需要持久化 | `pnpm add @xlt-token/store-redis redis` | [Redis Store 完整指南](/store-redis/) |

## NestJS 在线 Demo

可以直接打开 Cloud Studio 模板运行 NestJS 示例，无需先在本地安装依赖。

[![Cloud Studio Template](https://cs-res.codehub.cn/common/assets/icon-badge.svg)](https://cloudstudio.net/a/35877741980655616?channel=share&sharetype=Markdown)

打开模板后，按模板内的终端提示启动服务，再进入 [NestJS 快速开始](/adapters/nestjs/getting-started) 的客户端调用小节验证接口。

## 怎么选

选择 Core 时，你直接创建 `XltTokenContext`，并负责把当前请求桥接为
`HttpContext`。选择 NestJS 时，适配器负责 Module 注册、依赖注入、Guard 和装饰器。
选择 Express 时，适配器负责 middleware、Router 策略、请求状态同步和错误处理。

Redis Store 不绑定任何框架。Core、NestJS 和 Express 都可以使用同一个
`RedisStore` 或 `IORedisStore` 实例。

## 下一步

- 想只使用框架无关能力？进入 [Core 独立使用](/core/getting-started)。
- 想先跑通 NestJS？进入 [NestJS 快速开始](/adapters/nestjs/getting-started)。
- 想接入 Express？进入 [Express 完整指南](/adapters/express)。
- 想部署多实例？进入 [Redis Store 完整指南](/store-redis/)。
- 想理解底层机制？进入 [架构设计](/guide/architecture)。
