# 文档章节重组设计

## 目标

文档按使用路径重新组织，让读者能从快速开始进入核心能力，再按需查看
Redis Store、框架适配、进阶指南和参考资料。Redis Store 作为独立 npm 包，
在文档中拥有独立的顶级章节。

此次重组不能以缩短篇幅为目标。每个主要入口都必须形成可以独立完成接入的完整
手册，关键配置、行为差异、错误路径和生产注意事项不能只用一句话带过。

## 信息架构

侧边栏按以下顺序组织：

1. 快速开始
2. 核心能力
3. Redis Store
4. 框架适配
5. 进阶指南
6. 参考

现有页面保留原 URL，避免破坏外部链接。此次重组主要调整导航分组、首页入口、
交叉链接和页面内容归属，不迁移与任务无关的文件。

## 快速开始

快速开始负责帮助读者选择 Core、NestJS 或 Express，并说明各入口的安装包、
适用场景和能力边界。页面必须明确：

- 只需要鉴权运行时或接入自定义框架时选择 Core
- 使用 NestJS Module、Guard 和装饰器时选择 NestJS
- 使用 Express middleware 和 route helper 时选择 Express
- 需要分布式会话时额外安装 Redis Store

三个入口都应提供明确的下一步链接，读者不需要先理解 monorepo 结构才能开始。

## 核心能力

Core 章节必须支持 `@xlt-token/core` 完全独立使用，不以 NestJS 或 Express 为前提。
内容至少覆盖：

- 安装、创建实例和配置 `XltTokenConfig`
- `HttpContext` 的职责以及自定义框架桥接
- 登录、校验、登出、踢人和续期
- 权限、角色、Session、多端登录和二级认证
- Token Strategy、Hooks、观测性和异常处理
- `XltTokenStore`、`MemoryStore` 和自定义 Store
- 一个完整的框架无关示例及可运行的验证方式

Core 页面中的示例只能依赖 `@xlt-token/core`；使用 Redis 的示例可以额外依赖
`@xlt-token/store-redis`，但不能隐式依赖 NestJS。

## Redis Store 单页

新增 `/store-redis/` 页面，集中覆盖：

- `@xlt-token/store-redis` 的职责、依赖关系和安装方式
- node-redis 与 ioredis 的选择标准和版本范围
- 客户端连接、错误监听和关闭连接的生命周期
- `RedisStore` 与 `IORedisStore` 的构造方式和完整 API 语义
- `set`、`update`、TTL、永久键、缺失键和 `keys(pattern)` 的 Redis 命令映射
- SCAN 分页、COUNT 行为以及不能使用阻塞式 KEYS 的原因
- ioredis standalone、Sentinel 和 Cluster 的适用方式
- Cluster 下扫描所有 master 节点的行为和可能出现的重复键处理
- Core 独立使用的完整示例
- Express 适配器使用 Redis 的完整示例
- NestJS 通过 `store.useValue` 使用 Redis 的完整示例
- NestJS 旧版 `RedisStore`、`IORedisStore` 和注入令牌的兼容迁移
- 客户端选择、连接复用、超时、前缀、部署和故障排查建议
- 安装、构建和测试命令

页面必须解释每段配置的作用，不能只罗列代码。node-redis 和 ioredis 的差异需要
用表格和独立示例说明，Core、Express、NestJS 三种接入都必须能直接照做。

## NestJS 适配器

NestJS 章节保持多页结构，并完整覆盖：

- 安装和最小 Module 注册
- `forRoot`、`forRootAsync`、`useValue`、`useClass` 和 Provider 组合
- 全局 Guard、白名单与黑名单模式
- 登录、登出、参数装饰器、权限、角色和二级认证
- 自定义 Guard、请求状态同步和异常响应
- MemoryStore 与 Redis Store 的选择和接入
- Fastify 平台差异、应用生命周期和常见错误
- 从旧版 Redis DI 写法迁移到独立 Store 包
- 可执行的 curl 验证流程和测试命令

Redis 客户端内部细节统一链接到 Redis Store 章节，但 NestJS 页面仍保留完整的
Module 配置代码，不能只留下一个跳转链接。

## Express 适配器

Express 章节必须形成独立的完整接入手册，覆盖：

- 安装、创建 Core 实例和最小应用
- middleware 挂载顺序和请求状态同步
- 黑名单、白名单和路由级 helper
- 登录、登出、权限、角色、Session 和二级认证
- 错误处理中间件的顺序、响应结构和自定义方式
- MemoryStore 与 Redis Store 的完整初始化方式
- TypeScript 类型扩展、Router 组合和生产部署注意事项
- 可执行的请求示例、测试命令和常见问题

Redis 命令和客户端差异留在 Redis Store 章节，但 Express 页面必须保留从客户端创建、
连接到传入 `createXltToken` 的完整代码。

## 进阶指南与参考

进阶指南包含架构、迁移、Skills、MCP 和 LLMs 使用方式。参考章节包含源码索引、
公共 API、更新日志和发布信息。教程页面负责解释如何使用，参考页面负责精确列出
接口与导出，避免两者混写。

## 内容去重

`/core/storage` 只讲 `XltTokenStore`、`MemoryStore` 和自定义 Store，并链接到
Redis Store 章节。迁移出去的 Redis 细节必须完整落入新页面，不能直接删除。

NestJS 和 Express 页面保留各自框架所需的完整接入代码，但不重复解释 Redis 命令
映射、客户端版本差异、SCAN 和 Cluster 内部行为。跨页面内容通过明确链接连接，
不使用“参见其他章节”代替当前步骤必需的配置。

## 导航与入口

VitePress 侧边栏增加 `/store-redis/` 分区。文档首页、站点首页、Core 配置页、
Hooks 页面和适配器页面统一链接到新章节。参考文档继续记录完整公共 API，但不作为
主要教程入口。

首页需要直接展示 Core、Redis Store、NestJS 和 Express 四个入口。侧边栏的顶级
顺序必须在所有路径下保持一致，避免进入某个分区后失去其他主要章节入口。

## 验证

运行 `pnpm docs:build` 验证导航、内部链接、代码示例和静态页面生成。检查旧的
`/core/storage` 路径仍可访问，且项目中不存在指向已删除页面的链接。

还需要逐项检查：

- Core 示例不导入 NestJS 或 Express
- Redis Store 页面同时包含 node-redis 和 ioredis 的完整示例
- NestJS 示例包含 Module、Guard、Controller 和 Redis 配置
- Express 示例包含实例、中间件、路由和错误处理器
- 所有安装命令与实际 package peerDependencies 一致
- 所有页面都提供明确的下一步，不形成导航死角
