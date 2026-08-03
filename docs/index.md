---
layout: home
markdownStyles: false

hero:
  name: xlt-token
  text: 框架无关的轻量 Token 鉴权库
  tagline: Core 零框架依赖，Redis Store 独立安装，NestJS 与 Express 提供完整框架接入。覆盖登录态、权限、多端会话、JWT 与观测性。
  actions:
    - theme: brand
      text: 开始使用
      link: /guide/getting-started
    - theme: alt
      text: NestJS 在线 Demo
      link: https://cloudstudio.net/a/35877741980655616?channel=share&sharetype=Markdown
    - theme: alt
      text: Core 文档
      link: /core/getting-started
    - theme: alt
      text: Redis Store
      link: /store-redis/
    - theme: alt
      text: NestJS 文档
      link: /adapters/nestjs/getting-started
    - theme: alt
      text: Express 文档
      link: /adapters/express
    - theme: alt
      text: GitHub
      link: https://github.com/xiaoLangtou/xlt-token

features:
  - icon: 🧩
    title: 核心 + Store + 适配器
    details: '@xlt-token/core 承载鉴权语义；@xlt-token/store-redis 提供分布式存储；NestJS 和 Express 负责框架接入。'
  - icon: 🚀
    title: 框架接入开箱即用
    details: NestJS 使用 Module / Guard；Express 使用 middleware、路由策略和错误处理器。
  - icon: 🔐
    title: Sa-Token 语义
    details: 顶号、踢人、活跃过期、多端并发等能力原生支持。
  - icon: ✨
    title: 2.x 生命周期能力
    details: 多端 device、二级认证、JWT 密钥轮换、刷新重放检测、审计事件与在线观测。
---
