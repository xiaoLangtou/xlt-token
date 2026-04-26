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
    details: XltTokenGuard 全局鉴权；@XltIgnore / @XltCheckLogin / @LoginId / @TokenValue 五件套覆盖典型场景。
  - icon: 🔑
    title: 权限/角色校验
    details: 实现 StpInterface 即可启用 @XltCheckPermission / @XltCheckRole，支持 AND/OR 与通配符（user:*）。
  - icon: 🗂️
    title: 会话与下线追溯
    details: XltSession 承载登录期间的扩展数据；被踢/被顶后可查询下线原因和时间。
  - icon: 🧠
    title: 丰富的场景覆盖
    details: 顶号登录、踢人下线、活跃过期、多端并发等常见鉴权语义在 Recipes 中已有完整范式。
  - icon: 💾
    title: 灵活存储
    details: 默认 MemoryStore 便于开发，生产推荐 RedisStore，也可实现自定义 Store 对接任何 KV。
  - icon: 🧪
    title: 质量保障
    details: 195 个测试用例（158 单测 + 37 E2E），单测覆盖率 98%+，E2E 覆盖率 95%+。
  - icon: 📖
    title: 完整中文文档
    details: 配置参考、核心 API、异常矩阵、源码速查与权限/会话指南一站式齐备。
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
| 🛡️ 守卫与装饰器 | [core/guards-and-decorators](/core/guards-and-decorators) | `XltTokenGuard` / `@LoginId` / `@XltIgnore` 等六大装饰器 |
| 🔑 权限与会话 | [core/permissions-and-session](/core/permissions-and-session) | `StpInterface` / `@XltCheckPermission` / `@XltCheckRole` / `XltSession` |
| 💾 存储层 | [core/storage](/core/storage) | `MemoryStore` / `RedisStore` / 自定义 Store |
| 🎨 Token 策略 | [core/token-strategy](/core/token-strategy) | `uuid` / `simple-uuid` / `random-32`，接入 JWT |
| ⚠️ 异常处理 | [core/exceptions](/core/exceptions) | `NotLoginException` / `NotPermissionException` / `NotRoleException` |
| 🧪 场景手册 | [core/recipes](/core/recipes) | 顶号、踢人、活跃过期、多端并发、用户注入等 |
| 📖 源码参考 | [reference/src-reference](/reference/src-reference) | 一站式深度参考（单文件速查） |
