# Fastify 完整功能示例

演示 `@xlt-token/fastify` 的可运行 Fastify 应用：显式 `XltInstance`、Plugin + 路由策略、Cookie Token 来源，以及通过 `@xlt-token/observability` 输出脱敏审计日志。

## 快速开始

```bash
# 在 monorepo 根目录
pnpm install
pnpm build

# 启动示例（默认：UUID 策略 + MemoryStore + Header Token）
# 脚本会先执行 tsc 构建，再用 node 运行 dist 产物
cd examples/fastify
pnpm start
```

默认监听 `http://localhost:3000`。

## 环境变量开关

| 变量 | 取值 | 说明 |
| --- | --- | --- |
| `XLT_STRATEGY` | `uuid`（默认）/ `jwt` | Token 策略；JWT 使用 HS256 + `JWT_SECRET` |
| `XLT_STORE` | `memory`（默认）/ `redis` | 存储后端；redis 需要 `REDIS_URL` 可连接 |
| `XLT_IS_READ_COOKIE` | `true` / 关闭 | 开启 Cookie Token 来源（依赖 `@fastify/cookie`） |
| `REDIS_URL` | 默认 `redis://127.0.0.1:6379` | Redis 连接地址 |
| `JWT_SECRET` | 默认内置测试密钥 | 生产环境必须替换（HS256 至少 32 字节） |
| `PORT` | 默认 `3000` | 监听端口 |

快捷脚本：

```bash
pnpm start:jwt      # JWT 策略
pnpm start:redis    # Redis 存储
pnpm start:cookie   # Cookie Token 来源
```

## Cookie 前置条件

应用已注册 `@fastify/cookie`；`Xlt_IS_READ_COOKIE=true` 时，插件会校验该前置条件——
未注册 `@fastify/cookie` 而开启 `isReadCookie` 会在**注册阶段直接报错**，不会静默失效。
Cookie 模式下登录接口会把裸 token 写入名为 `authorization` 的 HttpOnly Cookie。

## curl 用例

```bash
# 1. 登录（公开路由）
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userId":"1001"}' | jq -r .token)

# 2. 需登录接口
curl http://localhost:3000/api/user/me -H "Authorization: Bearer $TOKEN"

# 3. 角色校验（1001 拥有 admin 角色）
curl http://localhost:3000/api/admin/stats -H "Authorization: Bearer $TOKEN"

# 4. 权限校验（1001 拥有 order:read）
curl http://localhost:3000/api/order -H "Authorization: Bearer $TOKEN"

# 5. 二级认证：先开窗口再访问
curl -X POST http://localhost:3000/api/safe/open-pay -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:3000/api/safe/pay -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"amount":100}'

# 6. 路由级 config.xlt 策略
curl http://localhost:3000/api/cfg/me -H "Authorization: Bearer $TOKEN"

# 7. 登出
curl -X POST http://localhost:3000/api/auth/logout -H "Authorization: Bearer $TOKEN"

# 8. 公开路由（ignore）
curl http://localhost:3000/api/public/health
```

Cookie 模式（`pnpm start:cookie`）下，登录后携带 `--cookie-jar`：

```bash
curl -s -c jar.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' -d '{"userId":"1001"}' > /dev/null
curl -s -b jar.txt http://localhost:3000/api/user/me
```

## 功能覆盖清单

- [x] 显式 `XltInstance`（不依赖 `StpUtil` 全局状态）
- [x] `xltFastifyPlugin` + `preHandler` 认证流程
- [x] 快捷白名单 `ignore` 与插件级 `policies`（权限 / 角色 / 二级认证 / methods）
- [x] 路由级 `config.xlt` 策略（`requireLogin` / `roles` OR 模式）
- [x] UUID 与 JWT 双策略（环境变量切换）
- [x] MemoryStore 与 RedisStore（环境变量切换）
- [x] Cookie Token 来源（`@fastify/cookie` 前置校验 + HttpOnly Cookie 写入）
- [x] `request.stpLoginId` / `request.stpToken` / `request.stpSession` 类型扩展
- [x] 脱敏审计事件 → 结构化 JSON 日志（`@xlt-token/observability`）
