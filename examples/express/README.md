# Express 完整功能示例

演示 `@xlt-token/express` 的可运行 Express 应用。接口路径尽量与 `examples/nestjs` 保持一致，便于对比 NestJS 装饰器模式与 Express 中间件模式。

## 交互演示页（推荐）

启动服务后打开 **http://localhost:3000/demo/**，可视化操作全部 API，无需 curl。

- 顶部一键 admin / user 登录，实时显示 token
- 按功能分组的场景卡片（权限、角色、二级认证、多端等）
- 右侧 API 日志面板，彩色状态码 + JSON 响应
- 二级认证流程步骤指示、多端 PC/App token 状态

## 启动

```bash
# monorepo 根目录
pnpm install && pnpm build

cd examples/express
pnpm start            # 默认 memory + uuid，http://localhost:3000
pnpm start:whitelist  # 白名单模式（defaultCheck=false）
```

### 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 监听端口 |
| `XLT_DEFAULT_CHECK` | `true` | `false` 启用白名单模式 |

### 演示账号

| 用户名 | 密码 | loginId | 角色 | 权限 |
| --- | --- | --- | --- | --- |
| `admin` | `admin123` | `1001` | admin, super | user:*, order:* |
| `user` | `user123` | `1002` | user | user:read |

## 路由与功能对照

| 路径 | 功能点 |
| --- | --- |
| `POST /auth/login` | 登录、ignore 白名单、多端 device |
| `POST /auth/logout` | 登出当前 token |
| `GET /auth/me` | 当前 loginId / token |
| `POST /auth/renew` | 滑动续期 `renewTimeout` |
| `GET /public/health` | 公开路由 |
| `GET /public/product/:id` | 匿名/登录均可（软检测） |
| `GET /permission/*` | `policies.permissions`、AND/OR、通配符 |
| `GET /role/*` | `policies.roles` |
| `POST /safe/open` `close` `transfer` | 二级认证 `safeBusiness` |
| `POST /device/*` | 多端登录、按设备/token 踢人、`forceLogout` |
| `POST /session/*` | 顶号、踢人、在线统计 |
| `GET /whitelist/*` | 白名单模式（需 `XLT_DEFAULT_CHECK=false`） |
| `GET /profile/me` | 自定义业务中间件填充 `request.user` |
| `GET /admin/*` | 管理员 + Hooks 观测 |
| `POST /temp-token/*` | 临时 Token |

## curl 用例

### 1. 登录 / 登出 / 当前用户

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | jq -r .token)

curl -s http://localhost:3000/auth/me \
  -H "Authorization: Bearer $TOKEN"

curl -s -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

### 2. 权限与角色

```bash
curl -s http://localhost:3000/permission/read -H "Authorization: Bearer $TOKEN"

USER_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"user","password":"user123"}' | jq -r .token)

curl -s http://localhost:3000/permission/delete -H "Authorization: Bearer $USER_TOKEN"
curl -s http://localhost:3000/role/admin-only -H "Authorization: Bearer $USER_TOKEN"
```

### 3. 二级认证

```bash
curl -s -X POST http://localhost:3000/safe/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"amount":100,"to":"alice"}'

curl -s -X POST http://localhost:3000/safe/open \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"business":"pay","timeout":300}'

curl -s -X POST http://localhost:3000/safe/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"amount":100,"to":"alice"}'
```

### 4. 多端登录

```bash
PC=$(curl -s -X POST http://localhost:3000/device/login \
  -H 'Content-Type: application/json' \
  -d '{"loginId":"1001","device":"pc"}' | jq -r .token)

APP=$(curl -s -X POST http://localhost:3000/device/login \
  -H 'Content-Type: application/json' \
  -d '{"loginId":"1001","device":"app"}' | jq -r .token)

curl -s http://localhost:3000/device/me -H "Authorization: Bearer $PC"
curl -s http://localhost:3000/device/me -H "Authorization: Bearer $APP"

curl -s -X POST http://localhost:3000/device/kickout-by-device \
  -H 'Content-Type: application/json' \
  -d '{"loginId":"1001","device":"pc"}'
```

## 源码结构

```
src/
├── main.ts
├── app.ts                         # Express app、xltMiddleware、静态 demo、路由注册
├── config/
│   ├── app-config.ts              # xlt-token 配置、ignore、policies
│   └── audit-hooks.ts             # 生命周期 Hooks
├── stp/
│   └── demo-stp-interface.ts      # 权限/角色数据源
├── middleware/
│   ├── async-handler.ts
│   ├── demo-error-handler.ts
│   └── profile-user.ts            # 自定义业务中间件演示
└── routes/
    ├── auth.ts
    ├── public.ts
    ├── permission.ts
    ├── role.ts
    ├── safe.ts
    ├── device.ts
    ├── session.ts
    ├── whitelist.ts
    ├── profile.ts
    ├── admin.ts
    └── temp-token.ts
```

## Express 接入要点

- 全局挂载 `xltMiddleware(xlt, { ignore, policies })`。
- 公开路由放进 `ignore`。
- 权限、角色、二级认证放进 `policies`，让策略在鉴权前完成解析。
- 业务路由中读取 `req.stpLoginId` 和 `req.stpToken`。
- 末尾挂载 `xltErrorHandler()`，统一输出 401 / 403 JSON。
