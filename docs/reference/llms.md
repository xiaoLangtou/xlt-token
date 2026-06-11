# AI 编码代理指南

这份页面是给 AI 编码代理使用的项目地图。更紧凑的纯文本入口见 [`llms.txt`](/llms.txt)。

## 项目定位

`xlt-token` 是一个 TypeScript monorepo，提供受 Sa-Token 启发的框架无关 Token 鉴权能力。核心能力包括登录、登出、会话、权限、角色、多端登录、二级认证、JWT、可插拔存储、Token 策略、Hooks，以及 NestJS / Express 适配器。

## 包职责

| 包 | 职责 | 关键入口 |
| --- | --- | --- |
| `@xlt-token/core` | 框架无关鉴权引擎、Store 契约、Token 策略、权限、会话、Hooks、HTTP 上下文、异常 | `packages/core/src/index.ts` |
| `@xlt-token/nestjs` | NestJS Module、Guard、Decorator、RedisStore、JwtStrategy，并 re-export Core | `packages/nestjs/src/index.ts` |
| `@xlt-token/express` | Express middleware、route helper、请求状态同步、错误处理器 | `packages/express/src/index.ts` |
| `xlt-token` | 兼容包，等价于 re-export `@xlt-token/nestjs` | `src/index.ts` |

## 优先阅读

- 项目总览：`README.md`
- 文档导航：`docs/README.md`
- 源码速查：`docs/SRC-REFERENCE.md`
- 架构设计：`guide/architecture.md`
- Core API：`core/core-api.md`
- NestJS 守卫与装饰器：`adapters/nestjs/guards-and-decorators.md`
- NestJS 模块配置：`adapters/nestjs/module-config.md`
- Express 适配器：`adapters/express.md`

## 核心源码入口

- 根包兼容导出：`src/index.ts`
- Core 导出：`packages/core/src/index.ts`
- Core 工厂：`packages/core/src/factory.ts`
- Core 鉴权引擎：`packages/core/src/auth/stp-logic.ts`
- Core 权限引擎：`packages/core/src/auth/stp-perm-logic.ts`
- Core 静态门面：`packages/core/src/auth/stp-util.ts`
- Core HTTP 上下文：`packages/core/src/http/context.ts`
- NestJS 模块：`packages/nestjs/src/xlt-token.module.ts`
- NestJS 全局守卫：`packages/nestjs/src/guards/xlt-token.guard.ts`
- Express 全局中间件：`packages/express/src/middleware/xlt-middleware.ts`

## 编码边界

- 框架无关行为放在 `@xlt-token/core`。
- NestJS DI、Guard、Decorator、RedisStore、JwtStrategy 放在 `@xlt-token/nestjs`。
- Express 中间件、route helper、错误处理器放在 `@xlt-token/express`。
- 各包的 `src/index.ts` 是公共 API 边界，修改导出前要考虑兼容性。
- NestJS decorators 和 Express route helpers 应描述路由鉴权元信息，不要复制 Core 鉴权逻辑。
- `StpLogic` 是登录态和 token 生命周期的实例 API。
- `StpUtil` 是静态门面，必须由框架初始化流程绑定实例后再使用。
- `StpPermLogic` 通过 `StpInterface` 获取权限和角色。
- `XltTokenStore` 实现必须保持 timeout 语义。
- `TokenStrategy` 负责创建 token，JWT 策略还负责校验和 jti 处理。
- `HttpContext` 是框架无关请求抽象。

## 测试与构建

项目使用 `pnpm@10.15.1`、Turbo、tsdown、Vitest。

```bash
pnpm install
pnpm build:workspace
pnpm test:workspace
pnpm --filter @xlt-token/core test
pnpm --filter @xlt-token/nestjs test
pnpm --filter @xlt-token/nestjs test:e2e
pnpm --filter @xlt-token/express test
pnpm --filter @xlt-token/express test:e2e
```

文档本地运行命令：

```bash
pnpm docs:dev
```

## 修改准则

- 修改 Core 鉴权语义时，优先补充或更新 Core 单测。
- 修改 NestJS module / guard / decorator 行为时，补充 NestJS 单测；涉及请求链路时补 E2E。
- 修改 Express middleware / route helper 行为时，补充 Express 单测；涉及完整请求链路时补 E2E。
- 修改公共 API 时，同步 `README.md`、`docs/`、包 README、示例和导出。
- 优先复用现有 fixtures、测试布局和包内模式。
- 不主动启动前端或文档服务；需要预览时只告诉使用者运行 `pnpm docs:dev`。
