# NestJS 完整功能示例

演示 `@xlt-token/nestjs` 全部能力的可运行 NestJS 应用。

## 交互演示页（推荐）

启动服务后打开 **http://localhost:3000/demo/** — 可视化操作全部 API，无需 curl。

- 顶部一键 admin / user 登录，实时显示 token
- 按功能分组的场景卡片（权限、角色、二级认证、多端…）
- 右侧 API 日志面板，彩色状态码 + JSON 响应
- 二级认证流程步骤指示、多端 PC/App token 状态

## 启动

```bash
# monorepo 根目录
pnpm install && pnpm build

cd examples/nestjs
pnpm start          # 默认 memory + uuid，http://localhost:3000
pnpm start:jwt      # JWT 策略
pnpm start:redis    # Redis 存储（需本地 Redis）
pnpm start:whitelist # 白名单模式（defaultCheck=false）
```

### 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 监听端口 |
| `XLT_DEFAULT_CHECK` | `true` | `false` 启用白名单模式 |
| `XLT_STRATEGY` | `uuid` | `jwt` 切换 JWT 策略 |
| `XLT_STORE` | `memory` | `redis` 切换 Redis 存储 |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis 连接 |
| `JWT_SECRET` | `example-jwt-secret-change-me` | JWT 密钥 |

### 演示账号

| 用户名 | 密码 | loginId | 角色 | 权限 |
| --- | --- | --- | --- | --- |
| `admin` | `admin123` | `1001` | admin, super | user:*, order:* |
| `user` | `user123` | `1002` | user | user:read |

---

## 路由与功能对照

| 路径 | 功能点 |
| --- | --- |
| `POST /auth/login` | 登录、`@XltIgnore`、多端 device |
| `POST /auth/logout` | 登出、`@TokenValue` |
| `GET /auth/me` | `@LoginId` |
| `POST /auth/renew` | 滑动续期 `renewTimeout` |
| `GET /public/health` | 公开路由 |
| `GET /public/product/:id` | 匿名/登录均可（软检测） |
| `GET /permission/*` | `@XltCheckPermission`、AND/OR、通配符 |
| `GET /role/*` | `@XltCheckRole` |
| `POST /safe/open` `close` `transfer` | 二级认证 `@XltCheckSafe` |
| `POST /device/*` | 多端登录、按设备/token 踢人、`forceLogout` |
| `POST /session/*` | 顶号、踢人、在线统计 |
| `GET /whitelist/*` | 白名单模式（需 `XLT_DEFAULT_CHECK=false`） |
| `GET /profile/me` | `XltAbstractLoginGuard` + `request.user` |
| `GET /admin/*` | 管理员 + Hooks 观测 |
| `POST /temp-token/*` | 临时 Token |

---

## curl 用例

### 1. 登录 / 登出 / 当前用户

```bash
# 登录
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | jq -r .token)

# 当前用户
curl -s http://localhost:3000/auth/me \
  -H "Authorization: Bearer $TOKEN"

# 登出
curl -s -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

### 2. 权限与角色

```bash
# admin → 200
curl -s http://localhost:3000/permission/read -H "Authorization: Bearer $TOKEN"

# user 登录
USER_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"user","password":"user123"}' | jq -r .token)

# user 缺 user:delete → 403
curl -s http://localhost:3000/permission/delete -H "Authorization: Bearer $USER_TOKEN"

# 角色：user 访问 admin → 403
curl -s http://localhost:3000/role/admin-only -H "Authorization: Bearer $USER_TOKEN"
```

### 3. 二级认证

```bash
# 未 openSafe → 403 NOT_SAFE
curl -s -X POST http://localhost:3000/safe/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"amount":100,"to":"alice"}'

# 打开安全窗口
curl -s -X POST http://localhost:3000/safe/open \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"business":"pay","timeout":300}'

# 转账 → 200
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

# 两 token 均可访问
curl -s http://localhost:3000/device/me -H "Authorization: Bearer $PC"
curl -s http://localhost:3000/device/me -H "Authorization: Bearer $APP"

# 仅踢 pc
curl -s -X POST http://localhost:3000/device/kickout-by-device \
  -H 'Content-Type: application/json' \
  -d '{"loginId":"1001","device":"pc"}'

# pc → 401 KICK_OUT，app 仍可用
curl -s http://localhost:3000/device/me -H "Authorization: Bearer $PC"
curl -s http://localhost:3000/device/me -H "Authorization: Bearer $APP"
```

### 5. 管理员踢人 / 在线统计

```bash
curl -s http://localhost:3000/session/online-count -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3000/session/online-ids -H "Authorization: Bearer $TOKEN"

curl -s -X POST http://localhost:3000/session/kickout \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"loginId":"1002"}'
```

### 6. 自定义 Guard（request.user）

```bash
curl -s http://localhost:3000/profile/me -H "Authorization: Bearer $TOKEN"
# → { stpLoginId, user: { id, username, loadedBy: 'BusinessLoginGuard' } }
```

### 7. 临时 Token

```bash
TEMP=$(curl -s -X POST http://localhost:3000/temp-token/create \
  -H 'Content-Type: application/json' \
  -d '{"userId":"1001"}' | jq -r .tempToken)

curl -s -X POST http://localhost:3000/temp-token/consume \
  -H 'Content-Type: application/json' \
  -d "{\"tempToken\":\"$TEMP\",\"newPassword\":\"newpass\"}"
```

### 8. 匿名访问商品详情

```bash
# 未登录
curl -s http://localhost:3000/public/product/42

# 带 token 显示 myRating
curl -s http://localhost:3000/public/product/42 -H "Authorization: Bearer $TOKEN"
```

### 9. Hooks 审计（admin）

```bash
curl -s http://localhost:3000/admin/hooks -H "Authorization: Bearer $TOKEN"
```

---

## 源码结构

```
src/
├── main.ts
├── app.module.ts              # forRootAsync + 全局 Guard/Filter
├── config/
│   ├── app-config.service.ts  # 配置中心（JWT/Redis/并发语义）
│   └── audit.hooks.ts         # 生命周期 Hooks
├── stp/
│   └── demo-stp-interface.ts  # 权限/角色数据源
├── guards/
│   ├── business-login.guard.ts
│   └── profile-login.guard.ts   # XltAbstractLoginGuard 演示
├── filters/
│   └── xlt-token-exception.filter.ts
├── auth/                      # 登录登出
├── public/                    # @XltIgnore + 软检测
├── permission/ role/ safe/     # 装饰器
├── device/ session/           # 多端与会话
├── whitelist/                 # defaultCheck=false
├── profile/                   # 自定义 Guard
├── admin/                     # 管理 + Hooks
└── temp-token/                # 临时 Token
```

## 相关文档

- [快速开始](https://xiaolangtou.github.io/xlt-token/guide/getting-started)
- [守卫与装饰器](https://xiaolangtou.github.io/xlt-token/core/guards-and-decorators)
- [场景手册](https://xiaolangtou.github.io/xlt-token/core/recipes)
