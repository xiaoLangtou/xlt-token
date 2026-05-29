# xlt-token 示例

本目录提供 **NestJS** 集成示例，演示 `@xlt-token/nestjs` 与 `@xlt-token/core` 的全部能力。

| 示例 | 说明 |
| --- | --- |
| [nestjs/](./nestjs/) | **完整功能演示** + [交互演示页](http://localhost:3000/demo/) |

## 快速开始

```bash
# 在 monorepo 根目录
pnpm install
pnpm build

# 启动示例
cd examples/nestjs
pnpm start
```

默认监听 `http://localhost:3000`，详见 [nestjs/README.md](./nestjs/README.md) 中的 curl 用例。

## 功能覆盖清单

- [x] 最小登录 / 登出 / `@LoginId` / `@TokenValue`
- [x] 全局 `XltTokenGuard` + `@XltIgnore` / `@XltCheckLogin`
- [x] 自定义 `XltAbstractLoginGuard`（`request.user`）
- [x] `@XltCheckPermission` / `@XltCheckRole`（`stpInterface`）
- [x] 二级认证 `@XltCheckSafe` + `openSafe` / `closeSafe`
- [x] 临时 Token（邮件链接场景）
- [x] 多端登录 / 按设备踢人 / 按 token 踢人
- [x] 顶号 / 共享登录态 / 活跃超时 / 续期
- [x] 管理员踢人 / 在线统计
- [x] 匿名可访问接口（软检测登录态）
- [x] 生命周期 Hooks
- [x] `forRootAsync` 异步配置
- [x] JWT 策略（环境变量切换）
- [x] Redis 存储（环境变量切换）
- [x] 统一异常过滤器
