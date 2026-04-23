---
layout: home

hero:
  name: xlt-token
  text: NestJS Token 鉴权库
  tagline: 灵感来源于 Sa-Token · 轻量 · 可插拔 · 零业务侵入
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 核心 API
      link: /core/core-api
    - theme: alt
      text: GitHub
      link: https://github.com/xiaoLangtou/xlt-token

features:
  - icon: ⚡
    title: 开箱即用
    details: forRoot / forRootAsync 一行注册，默认配置即可跑通登录、登出、鉴权、踢人。
  - icon: 🧩
    title: 可插拔架构
    details: Store、Token 策略、登录校验守卫全部可替换，内置 Memory / Redis Store 与 UUID 策略。
  - icon: 🛡️
    title: 守卫 + 装饰器
    details: XltTokenGuard 全局鉴权，@XltIgnore 跳过白名单，@LoginId / @TokenValue 注入用户上下文。
  - icon: 🧠
    title: 丰富的场景覆盖
    details: 顶号登录、踢人下线、活跃过期、多端并发等常见鉴权语义在 Recipes 中已有完整范式。
  - icon: 💾
    title: 灵活存储
    details: 默认 MemoryStore 便于开发，生产推荐 RedisStore，也可实现自定义 Store 对接任何 KV。
  - icon: 📖
    title: 完整中文文档
    details: 配置参考、核心 API、异常矩阵、源码速查与 P1 路线图一站式齐备。
---

## 安装

::: code-group

```bash [pnpm]
pnpm add xlt-token
```

```bash [npm]
npm install xlt-token
```

```bash [yarn]
yarn add xlt-token
```

:::

## 快速导航

| 主题 | 文档 | 适合场景 |
| --- | --- | --- |
| 🚀 快速开始 | [guide/getting-started](/guide/getting-started) | 第一次接入，5 分钟跑通登录/登出 |
| 🏗️ 架构设计 | [guide/architecture](/guide/architecture) | 了解分层、存储键结构、并发语义 |
| ⚙️ 配置参考 | [guide/configuration](/guide/configuration) | 查阅 `XltTokenConfig` 字段、`forRoot` / `forRootAsync` |
| 🧠 核心 API | [core/core-api](/core/core-api) | `StpLogic` / `StpUtil` 所有方法与时序 |
| 🛡️ 守卫与装饰器 | [core/guards-and-decorators](/core/guards-and-decorators) | `XltTokenGuard` / `@LoginId` / `@XltIgnore` |
| 💾 存储层 | [core/storage](/core/storage) | `MemoryStore` / `RedisStore` / 自定义 Store |
| 🎨 Token 策略 | [core/token-strategy](/core/token-strategy) | `uuid` / `simple-uuid` / `random-32`，接入 JWT |
| ⚠️ 异常处理 | [core/exceptions](/core/exceptions) | `NotLoginException` / `NotLoginType` 六种场景 |
| 🧪 场景手册 | [core/recipes](/core/recipes) | 顶号、踢人、活跃过期、多端并发、用户注入等 |
| 📖 源码参考 | [reference/src-reference](/reference/src-reference) | 一站式深度参考（单文件速查） |
| 🗺️ P1 规划 | [roadmap/p1](/roadmap/p1) | 权限与会话阶段的架构、接口、分步实施 |
