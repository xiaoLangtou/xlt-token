# 文档章节重组设计

## 目标

文档按使用路径重新组织，让读者能从快速开始进入核心能力，再按需查看
Redis Store、框架适配、进阶指南和参考资料。Redis Store 作为独立 npm 包，
在文档中拥有独立的顶级章节。

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

## Redis Store 单页

新增 `/store-redis/` 页面，集中覆盖：

- 包职责和安装方式
- node-redis 的 `RedisStore`
- ioredis 的 `IORedisStore`
- ioredis Cluster 扫描行为
- Core、Express 和 NestJS 接入
- NestJS 旧版 DI 导出的兼容说明
- 客户端选择和生产注意事项

页面以框架无关用法为主，框架接入部分只解释实例如何传给对应入口。

## 内容去重

`/core/storage` 只讲 `XltTokenStore`、`MemoryStore` 和自定义 Store，并链接到
Redis Store 章节。NestJS 和 Express 页面保留最短可用示例或入口说明，不再重复
Redis 客户端差异、Cluster 行为和完整兼容说明。

## 导航与入口

VitePress 侧边栏增加 `/store-redis/` 分区。文档首页、站点首页、Core 配置页、
Hooks 页面和适配器页面统一链接到新章节。参考文档继续记录完整公共 API，但不作为
主要教程入口。

## 验证

运行 `pnpm docs:build` 验证导航、内部链接、代码示例和静态页面生成。检查旧的
`/core/storage` 路径仍可访问，且项目中不存在指向已删除页面的链接。
