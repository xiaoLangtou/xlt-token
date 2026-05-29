---
layout: home
markdownStyles: false

hero:
  name: xlt-token
  text: 框架无关的轻量 Token 鉴权库
  tagline: 核心 @xlt-token/core 零框架依赖；NestJS 适配一行接入。覆盖登录态、权限、多端会话、JWT 与观测性。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 架构设计
      link: /guide/architecture
    - theme: alt
      text: GitHub
      link: https://github.com/xiaoLangtou/xlt-token

features:
  - icon: 🧩
    title: 核心 + 适配器
    details: '@xlt-token/core 承载鉴权语义；@xlt-token/nestjs 提供 Module / Guard / Decorator。'
  - icon: 🚀
    title: NestJS 开箱即用
    details: forRoot 一行注册，默认配置跑通登录、鉴权、踢人与登出。
  - icon: 🔐
    title: Sa-Token 语义
    details: 顶号、踢人、活跃过期、多端并发等能力原生支持。
  - icon: ✨
    title: 1.1.0 新能力
    details: 多端 device、二级认证、JWT 黑名单、Hooks 与在线观测。
---
