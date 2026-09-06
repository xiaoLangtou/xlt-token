# xlt-token 全库代码审查报告

- **审查日期**：2026-09-05
- **审查工具**：OpenCodeReview v1.11.5（委托模式：OCR 负责文件筛选与规则解析）+ CodeRabbit CLI v0.7.6（交叉验证）
- **审查范围**：`ocr scan` 全量扫描 403 个变更文件，按规则筛选出 215 个可审查文件（约 17,000 行源码），排除 Markdown / dist 构建产物 / lockfile / 测试报告
- **审查规则**：OCR 系统规则组（ts/js/mjs 代码质量与安全、package.json 依赖、GitHub Actions 安全、JSON/YAML 键拼写）+ 全量扫描通用规则（正确性 / 安全 / 性能 / 可维护性）

## 总览

| 审查单元 | Critical | Warning | Info |
|---|---:|---:|---:|
| packages/core | 1 | 12 | 11 |
| packages/fastify | 2 | 1 | 7 |
| examples（express / nestjs） | 1 | 6 | 9 |
| packages/express | 0 | 6 | 11 |
| packages/jwt + store-contract + store-redis | 0 | 2 | 6 |
| packages/nestjs | 0 | 3 | 9 |
| scripts + CI workflows + 根配置 | 0 | 7 | 6 |
| docs 主题（Vue / CSS） | 0 | 5 | 13 |
| **合计** | **4** | **42** | **72** |

> 另：CodeRabbit 对全部 31 个未提交变更文件的 diff 审查发现 4 个 minor（均为文档与 Fastify 适配器不一致，见附录 A）；OCR diff 模式发现 1 个 info（根 package.json description 未提及 Fastify，见附录 A #5）。

---

## 一、Critical（4）

### C1. Fastify 适配器：URL 编码绕过全部鉴权策略
- **位置**：`packages/fastify/src/resolve-auth-meta.ts:26-33`
- **问题**：策略匹配使用未解码的原始 `request.url`，而 find-my-way 在路由时先对路径做 `decodeURI`（fastify 5 / find-my-way 9 与 fastify 4.10+ / find-my-way 8 均如此）。已用 `app.inject` 实证复现：
  - 白名单模式（`defaultCheck: false`）下注册 `policies: [{ match: "/admin", requireLogin: true }]`，请求 `/%61dmin/panel` 匿名返回 200 + 数据；
  - 黑名单模式下 `/api/orde%72/list` 绕过 `permissions` 校验拿到 200（仅登录检查仍生效）；
  - 附带 fail-closed 问题：`ignore: ["/api/public"]` 的公开路由在 URL 被编码时误返 401。
- **修复方向**：匹配前按 find-my-way 的 `safeDecodeURI` 语义（`try { decodeURI(url) } catch`）归一化路径并剥离 query；现有 `packages/fastify/test/` 无任何 URL 编码场景用例，需补单测。Express 适配器因路由器不解码静态路径而是 fail-closed，不受此影响，但修复时建议统一两个适配器的路径归一化逻辑。

### C2. Fastify 白名单模式：仅声明 permissions / roles / safeBusiness 的策略被静默跳过
- **位置**：`packages/fastify/src/resolve-auth-meta.ts:101-106`（`shouldCheckLogin` 白名单分支只认 `requireLogin`）+ `packages/fastify/src/plugin.ts:71`（在 `runAuth` 之前提前 return）
- **问题**：README.md:102 承诺「除非路由声明了 requireLogin（或 permissions / roles / safeBusiness）」才公开，但实证 `defaultCheck: false` 时注册 `{ match: "/api/order", permissions: ... }`，匿名请求与零权限用户均返回 200 —— 权限/角色/safe 校验从未执行。属文档承诺的安全契约被运行时违背，认证绕过。
- **修复方向**：`shouldCheckLogin` 白名单分支改为 `requireLogin || permissions != null || roles != null || safeBusiness != null`。
- **协同影响（重要）**：`packages/express/src/auth/should-check-login.ts:13-21` 与 NestJS `xlt-token.guard.ts` 存在同语义问题（express 侧确认：白名单模式下 `checkPermission` 等中间件一并被跳过），需三个适配器协同修复并同步更新文档。

### C3. Core：单设备登出 / 踢人误删账号级共享 Session 数据
- **位置**：`packages/core/src/auth/stp-logic.ts:418`（`logout`）、`:508`（`kickout`）
- **问题**：两者均为单设备操作，却无条件执行 `delete(sessionDataKey(loginId))`，而该 key 是整个账号跨设备共享的会话数据（`getSession` 的存储）。默认 `deviceConcurrent: true` 下多端在线是常态，任一设备登出即清空其他在线设备的全部 Session 数据。对比 `logoutByDevice` / `kickoutByDevice` 均不删除该 key，行为不一致，确认为遗漏而非设计。

### C4. Examples：无凭据即可为任意用户签发全权限 token
- **位置**：`examples/express/src/routes/device.ts:8-15`、`session.ts:8-15,17-24`（ignore 列表见 `config/app-config.ts:74-76`）；`examples/nestjs/src/device/device.controller.ts:7-12`、`session/session.controller.ts:10-15,17-23`
- **问题**：多端登录/顶号演示路由被 `@XltIgnore` / ignore 列表完全放行，请求体传任意 `loginId`（如 "1001"）即可换取有效 token，全程无需密码；`DemoStpInterface` 按 loginId 返回角色权限，该 token 可直接通过 `/role/admin-only`、`/permission/delete` 等全部校验，等于未授权管理员登录。
- **修复方向**：改为复用密码校验，或在页面与代码注释显著标注「仅演示、生产禁止」。

---

## 二、Warning（42）

### packages/core（12）

| # | 位置 | 问题 |
|---|---|---|
| W1 | `stp-logic.ts:80,118-119` | login 互踢为 check-then-act，无 CAS/锁；并发登录可产生两个并存的有效 token，互踢语义被破坏 |
| W2 | `stp-logic.ts:163-174,1038-1049` | session-list 读全量 JSON → 内存改 → 整体回写，无原子性；并发登录丢更新，设备列表丢记录，进而 forceLogout / kickoutAllDevices 遗漏设备 |
| W3 | `stp-logic.ts:482-516,182-204` | kickout 与 _kickoutAllDevices 不从 session-list 移除条目（对比 kickoutByToken/ByDevice 均会移除），设备列表永久残留、getOnlineCount 虚高 |
| W4 | `stp-logic.ts:96-106` | isShare 复用旧 token 前不校验有效性（不查 tokenKey 是否 KICK_OUT、JWT 是否进黑名单），可能把拿到即 401 的死 token 返回客户端 |
| W5 | `stp-logic.ts:189` | deviceConcurrent=false + JWT 模式下，_kickoutAllDevices 逐个 verifyToken 无 try/catch；session-list 中一个过期 token 即令该账号后续所有登录持续抛 TokenExpiredError（叠加 W3 成为持久性故障） |
| W6 | `stp-logic.ts:612-630` | opaque 模式 refreshToken 未为新 token 写 lastActiveKey；activeTimeout>0 时刷新后的新 token 永远 TOKEN_FREEZE，用户被迫重新登录 |
| W7 | `stp-logic.ts:417,715` | 非 JWT 分支操作 sessionKey 未带 device：logout 清理错设备（残留），renewTimeout 对非 default 设备 touch 不存在的 key 抛异常（接口 500） |
| W8 | `stp-logic.ts:1047` | _removeFromSessionList 用 ttl=-1 回写，实际效果是 session-list 永不过期（与注释「继承原 TTL」相反）；幽灵在线永久统计，MemoryStore 无界内存增长 |
| W9 | `xlt-session.ts:28-33,73-86` | XltSession 跨实例读改写全量覆盖，并发 set 丢更新（每次调用 new 新实例，stp-logic.ts:728） |
| W10 | `stp-perm-logic.ts:63-68,78-83` | checkPermission/checkRole 传空数组 + AND 模式时 `Promise.all([]).every(Boolean)` 为 true，静默放行。鉴权库对畸形输入应显式抛错 |
| W11 | `http/express.ts:22,24` | 多值 header（string[]）经假 cast 传入 getTokenValue 后 `.startsWith` 抛 TypeError；query 的 `as string` 同类隐患（http/testing.ts:16-18 已正确处理 Array.isArray，应对齐） |
| W12 | `stp-logic.ts:187-203,441-470,910-915` | 循环内独立异步操作串行 await（接 Redis 时 RTT 叠加明显，forceLogout 还重复拉设备列表，整体 O(n²)），应 Promise.all |

### packages/fastify（1）

| # | 位置 | 问题 |
|---|---|---|
| W1 | `index.ts:21-23`（对照 README.md:25） | README 快速开始示例引用 `XltMode`，但入口未导出（express 侧 index.ts:27 有导出），按文档照抄直接编译失败。补 `export { XltMode } from "@xlt-token/core"` |

### packages/express（6）

| # | 位置 | 问题 |
|---|---|---|
| W1 | `resolve-route-auth-meta.ts:6`、`match-ignore.ts:6` | 路径匹配大小写敏感，而 Express 默认 caseSensitive: false：白名单模式下 `/API/ADMIN` 可绕过 requireLogin 策略；黑名单模式下 ignore 规则失配致公共路由误 401 |
| W2 | `resolve-route-auth-meta.ts:48`、`match-ignore.ts:21` | 正则规则直接 test 含查询串的 originalUrl：未锚定正则可被 `?next=/login/` 查询串误命中跳过鉴权；`/health$/` 遇 `/health?x=1` 永不命中。应统一先取 pathname |
| W3 | `resolve-route-auth-meta.ts:6`、`match-ignore.ts:6` | 带尾斜杠的前缀规则（如 `/api/`）永远无法命中子路径（既不等于也不满足 startsWith('/api//')），保护/忽略策略静默失效。应归一化尾部 `/` |
| W4 | `middleware/xlt-middleware.ts:29-32` | resolveRouteAuthMeta（含用户 matcher 函数）在 try 块外执行；Express 4 不捕获 async 中间件 rejection，matcher 抛错即 unhandled rejection（Node 15+ 崩溃进程）。应纳入 try/catch → next(err) |
| W5 | `resolve-route-auth-meta.ts:36-39` | methods 过滤不处理 HEAD→GET 语义（Express 的 GET 路由同时服务 HEAD），方法级策略可被 HEAD 请求绕过 |
| W6 | `error/xlt-error-handler.ts:12-18` | 错误处理中间件缺 `res.headersSent` 保护，响应已开始写出后再 status().json() 抛 ERR_HTTP_HEADERS_SENT 并从错误中间件逃逸 |

### packages/jwt + store-redis（2）

| # | 位置 | 问题 |
|---|---|---|
| W1 | `jwt-config.ts:108-119` | assertStrongHmacSecret 只识别 string/Buffer；用户传入合法的 `KeyObject`（crypto.createSecretKey）强密钥被误报 weak HMAC 抛错。应对 KeyObject 用 symmetricKeySize |
| W2 | `redis-store.ts:27-36`、`ioredis-store.ts:32-41` | get() 的 GET→TTL 两步串行竞态：key 恰好过期时 TTL=-2 被统一映射为「永不过期」，刚过期的会话/黑名单条目被当作仍有效。ttl===-2 应返回 null |

### packages/nestjs（3）

| # | 位置 | 问题 |
|---|---|---|
| W1 | `guards/xlt-token.guard.ts:29` | `if (!requiresLogin) return true` —— defaultCheck:false 且路由未标 @XltCheckLogin 时，权限/角色/二级认证元数据被静默忽略（与 C2 同语义，三适配器协同修复） |
| W2 | `guards/xlt-abstract-login.guard.ts:82-90` | onPermissionDenied 钩子全仓库无调用点，子类实现后永不执行，误导性 API |
| W3 | `xlt-token.module.ts:37,129` | forRootAsync 的 useFactory 类型声明返回完整 Options，实现只解构 config；工厂返回的 store/strategy 等被静默丢弃，照类型写会在生产静默回退 MemoryStore（重启丢数据）。应收窄类型或运行时抛错 |

### scripts + CI workflows（7）

| # | 位置 | 问题 |
|---|---|---|
| W1 | `.gitignore:2` | 根 `/dist` 规则未覆盖 `packages/*/dist`，已验证 49 个构建产物（index.cjs/.mjs/.d.mts 等）被 git 跟踪；publish.yml:39 的 --no-git-checks 很可能是在绕过此问题。改为 `**/dist` |
| W2 | `.github/workflows/ci.yml:17,41` | quality / docs job 缺 timeout-minutes，vitest 僵死将无限占用 runner |
| W3 | `.github/workflows/deploy-docs.yml:23,49` | build / deploy job 缺 timeout-minutes |
| W4 | `.github/workflows/publish.yml:17` | publish job 缺 timeout-minutes（发布流水线尤其应有明确超时） |
| W5 | `.github/workflows/ci.yml:28` | 第三方 action `pnpm/action-setup@v4` 未 pin 到 commit SHA |
| W6 | `.github/workflows/deploy-docs.yml:30` | 同 W5；该 workflow 持有 id-token: write（Pages OIDC），风险更高 |
| W7 | `.github/workflows/publish.yml:24` | 同 W5；该 workflow 持有 id-token: write 并执行 npm 发布，SHA pin 优先级最高 |

### examples（6）

| # | 位置 | 问题 |
|---|---|---|
| W1 | `examples/express/public/demo/app.js:91`（nestjs 副本相同） | addLog 用 innerHTML 拼接，`path` 未转义（仅 bodyText 经 escapeHtml），path 可含用户输入（#productId 输入框拼进 URL），存在 self-XSS 注入点；示例会被复制，应统一 escapeHtml 或用 textContent |
| W2 | `examples/nestjs/src/public/public.controller.ts:21` | 未登录访问 /public/product/:id 必然 500：StpUtil.getLoginId 未捕获，core 抛的 NotLoginException 与 nestjs 过滤器 catch 的异常类不同。express 版有 try/catch，Nest 版应补齐 |
| W3 | `examples/express/src/routes/session.ts:26-42`、`device.ts:26-42`（nestjs 侧同） | 踢人等敏感管理操作只要求登录，无 admin 角色校验也无归属校验，任意登录用户可踢掉 admin 会话 |
| W4 | `examples/express/src/routes/temp-token.ts:9-19`（nestjs 侧同） | /temp-token/create 未鉴权且接受任意 userId，签发 resetPwd 临时 token —— 按 userId 直接签发等于任意账号重置入口，应标注真实场景约束 |
| W5 | `examples/express/src/routes/auth.ts:45,58`、`device.ts:20,47`、`safe.ts:15,24`（nestjs 侧同） | whitelist 模式下 stpToken/stpLoginId 未判空：openSafe 无保护，会用 "undefined" 写入真实安全窗口记录。取值处应先判空返回 401 |
| W6 | `examples/nestjs/package.json:26-27,31-34` | jsonwebtoken、redis 同时声明在 devDependencies 和 optionalDependencies（重复声明），且实际是运行时依赖（app-config.service.ts:73 动态 import）；--omit=optional 生产安装直接跑不起来 |

### docs 主题（5）

| # | 位置 | 问题 |
|---|---|---|
| W1 | `docs/.vitepress/theme/components/ChangelogTimeline.vue:42-97` | RELEASE_FILES 只收录到 v2.1.0，缺 v2.2.0/v2.3.0（config.mts releaseSources 已包含），页面 "Latest" 错误显示 v2.1.0 |
| W2 | `ChangelogTimeline.vue:249-254,256-261` | escapeHtml 不转义 `"`，inlineMarkdown 把 URL 原样内插进 href，`[x](javascript:alert(1))` 可生成可执行伪协议链接（内容源为项目自身 GitHub raw，维护者可信，故 Warning 非 Critical）。应转义引号并白名单校验 http(s) 协议 |
| W3 | `CopyPage.vue:53-65` | downloadMarkdown 无 try/catch，GitHub raw 不可达时点击下载抛 unhandled rejection，用户无反馈 |
| W4 | `docs/.vitepress/twoslash.ts:10` | FILE_IMPORTS 导入已不存在的 `XltHooks`（2.0 已用 XltEventSink 取代）；一旦使用该 include，config.mts:51 的 noErrors: true 会静默吞掉报错 |
| W5 | `SiteHeader.vue:76` | 版本下拉硬编码显示 "v1.0.0-rc.3"，当前为 v2.3.0 |

---

## 三、Info（72，摘录）

### 死代码 / 未使用
- `packages/core/src/auth/stp-logic.ts:1004-1028` — 私有方法 `replaced()` 全仓库无调用点（登录顶号实际走 `_replacedToken`）
- `packages/core/src/session/xlt-session.ts:8` — 私有属性 `loginId` 从未读取
- `packages/express/src/auth/match-ignore.ts:13` — `matchIgnore` 包内无运行时调用点且未导出（注释所称「对外保留」实际不可达）
- `packages/express/src/auth/match-ignore.ts:5`、`resolve-route-auth-meta.ts:5`、`packages/fastify/src/resolve-auth-meta.ts:10` — `split("?")[0] ?? path` 的 `?? path` 永不执行
- `packages/express/src/context.ts:4-11` — ExpressLikeRequest/Response 包内零使用，与 core 同名接口重复
- `packages/express/src/types.ts:25-30` — ExpressRequest 接口未使用未导出
- `packages/nestjs/src/store/memory-store.ts`、`token/uuid-strategy.ts` — 纯 re-export shim，包内无 import、exports map 不暴露
- `packages/nestjs/src/guards/xlt-abstract-login.guard.ts` — requiresLogin 与 result 类型与 xlt-token.guard.ts 逐行重复
- `turbo.json` + devDependencies `turbo@^2.5.4` — 全仓无 turbo run 调用，死配置（含 6 个平台二进制）
- `packages/nestjs/tsdown.config.ts:22` + package.json — `uuid` 声明为运行时依赖与 external 但 src 无引用（UuidStrategy 由 core 提供）
- `Layout.vue:29-31` 注释死代码 + `DocHeader.vue` 整个 31 行组件无引用
- `docs/.vitepress/twoslash/tsconfig.json:14-16` — paths 键 "xlt-token" 为旧包名残留，该文件未被构建引用
- `custom.css:683-685` `.c-t/.c-b/.c-n`、`doc.css:876-879` `.VPImage.logo` — 无效样式
- `Home.vue:113` `xlt-anim--4` 类被 `xlt-preview--float` 的 animation 简写覆盖，完全无效

### 重复代码（可提取）
- `packages/express/src/auth/match-ignore.ts:4-7` 与 `resolve-route-auth-meta.ts:4-7` — matchPathPrefix 逐字重复（W1-W3 修复需两处同步）
- `packages/express/src/error/map-xlt-error.ts:18-64`、`packages/fastify/src/map-xlt-error.ts:19-68` — 四个 instanceof 分支同构，可表驱动
- `packages/store-redis/src/redis-store.ts` vs `ioredis-store.ts` — 三个 Lua 脚本与编排逻辑逐字重复，双份维护易漂移
- `packages/core/src/auth/stp-perm-logic.ts:26-54` — getPermissionList/getRoleList 除 key 生成器外完全相同
- `packages/nestjs/src/exceptions/not-login.exception.ts:19-41` — 错误码/文案映射表与 core 逐字相同

### 规范类
- `==` / `!=` 使用：`packages/core/src/http/testing.ts:17`；`packages/express/src/sync-state.ts:14,18`；`packages/fastify/src/context.ts:33,49`、`plugin.ts:36`
- `any` 未注明原因：`stp-logic.ts:866,1086`、`ioredis-store.ts:22`、`token-value.decorator.ts:9`、`xlt-token.guard.ts:50,59`、`xlt-abstract-login.guard.ts:69,79,89`、`nest-bridge.ts:24,56`、`profile.controller.ts:15`、`business-login.guard.ts:28,46`
- 嵌套三元：`jwt-config.ts:109-114`、`examples/express/src/routes/auth.ts:24-29`、`middleware/profile-user.ts:18-24`、`demo/app.js:73-74`、`nestjs auth.controller.ts:12-17`、`business-login.guard.ts:31-37`

### 健壮性 / 语义
- `stp-logic.ts:164,186,544,745,757,1042` 等多处 `JSON.parse` 无容错，存储值损坏即主流程 500
- `stp-logic.ts:518-644` — lifecycle 配置 `rotate` / `replayDetection` 声明但 refreshToken 从未读取，配置后行为不变
- `stp-logic.ts:647-649` — revoke() 除 family 外的 scope 静默返回成功，实际未撤销
- `stp-logic.ts:891-893,902` — 手拼 session-list key 与 XltTokenKeys 硬编码耦合；分页为全库 scan 后内存切片
- `jwt-strategy.ts:85-90` — timeout=0 语义与 core 相反（JWT 侧产出永久 token，core 侧立即过期）
- `redis-store.ts:44`、`ioredis-store.ts:49` — `finiteTtl(0)` 合法输入会被 Redis 以 invalid expire time 拒绝，store 层未校验
- `redis-store.ts:28-35` — get() 固定两次串行 RTT，可用 pipeline 合并（顺带消除 W2 竞态）
- `packages/fastify/src/resolve-auth-meta.ts:90` — request.routeOptions 自 fastify 4.10 引入而 peer 声明 ^4.0.0，旧 v4 上 config.xlt 静默失效
- `packages/fastify/src/plugin.ts:37-42` — 直接赋值 request 属性未用 decorateRequest，热路径 hidden class 退化
- `xlt-token.guard.ts:25,46` — @Optional() stpPermLogic 缺失时权限校验静默跳过无告警
- `deploy-docs.yml:13-16` — 顶层 permissions 对 build job 过宽，应下沉到 deploy job
- `publish.yml:8-10` — workflow_dispatch 的 required 不生效，tag 为空时生成无效 refs/tags/；缺 concurrency 串行化，并发触发会 EPUBLISHCONFLICT
- `.gitignore:45-46,50-51` — .claude 与 .codex 重复列出
- `scripts/check-package-boundaries.mjs:79-114` — 循环内异步 IO 全串行，可 Promise.all
- `packages/core/src/const/index.ts:29` — `XLT_ROLE_KEY = "xltCheckRole"` 命名风格与同组不一致（对外序列化 key，改需兼容流程）
- `stp-logic.ts:112` — login() JWT 分支 verifyToken 异常未归一化（与 _resolveLoginIdJwt 不一致）

### 文档站内容与工程演进脱节
- `Home.vue:77,54-58` — hero 徽标写死 "v1.2.1 · Core + Redis + Adapters"、"274 测试用例 / 96%+" 快照过期
- `SiteHeader.vue:12-43` — 顶部 tabs 缺 Fastify 入口
- `Home.vue:11 / CopyPage.vue:34,62 / SupportProjectModal.vue:39` — setTimeout 未在卸载时清理
- `ChangelogTimeline.vue:213-217` — 表格分隔行 `includes('---')` 判断过宽，含 --- 的数据行被静默丢弃
- `ChangelogTimeline.vue:119-129` — 并行 fetch 9 个 raw 文件无超时，挂起时状态永远停留「正在同步」
- `SupportProjectModal.vue:46-192` — dialog 无 Escape 关闭/焦点管理；`109-137` 展示伪造的 stars/forks 数据
- `SiteHeader.vue:328` — GitHub 图标依赖 api.iconify.design 外网，与站内镜像化决策不一致
- `examples/nestjs/src/main.ts:23` — bootstrap() 未处理 rejection
- `demo/app.js:303-305` — clipboard.writeText 未处理 Promise rejection
- demo 明文口令（admin123/user123）硬编码 4 处、默认 JWT secret 兜底值、token 存 localStorage —— 均为 demo 常见做法，建议集中定义并标注「仅演示」

---

## 四、已验证无问题的关键面（正面确认）

- **JWT 安全**：alg:none / RS-HS 混淆已三重防护（kid 白名单 + 强制 alg 一致 + verify 显式 algorithms）；密钥轮换保留全部 kid 旧 token 可验
- **Redis 原子性**：getAndDelete / compareAndSet / touch 均 Lua 单脚本原子，20 路并发契约测试覆盖
- **临时 token 原子消费**：`consumeTempToken` 用 `getAndDelete`，无竞态
- **refreshToken 重放防护**：family 状态 CAS 推进，失败即 revoke
- **无敏感信息泄露**：审计事件只输出 token 的 SHA-256 截断指纹；异常响应 body 不含 token；workflow secrets 均经 env 传入未 echo
- 无 eval / Function 构造器 / 原生原型修改；拼写检查未发现错误；JSON/YAML 键拼写正常
- GitHub Actions：无 pull_request_target 误用、无脚本注入面、官方 action major tag 符合豁免

---

## 五、修复优先级建议

1. **P0（立即）**：C1、C2 —— fastify 鉴权绕过，含 express / nestjs 同语义 `shouldCheckLogin` 协同修复，并补 URL 编码、白名单 permissions-only、HEAD 方法三类回归单测
2. **P1（高）**：C3；core 的认证语义 Warning（W1 互踢竞态、W2/W3 session-list 原子性与残留、W5 持久登录故障、W6 TOKEN_FREEZE、W8 幽灵在线）；jwt W1（KeyObject 误拒）
3. **P2（中）**：CI 加固（dist 出库、timeout、SHA pin）；examples C4 / W1-W5；fastify W1 导出补齐；docs 主题 W1-W5
4. **P3（低）**：Info 级重构（重复代码提取、死代码清理、any/== 规范）与文档站内容同步

---

## 附录 A：变更 diff 审查结果（CodeRabbit + OCR diff 模式）

针对本次未提交的 v2.3.0 变更（31 个文件）：

| # | 位置 | 级别 | 问题 |
|---|---|---|---|
| 1 | `docs/reference/llms.md:59` | minor | Fastify 边界条目后的路由元数据规则未覆盖 Fastify 路由元数据 |
| 2 | `docs/core/recipes.md:92` | minor | renewTimeout 示例被呈现为「刷新令牌轮换」流程，实际是同 token 续期，术语与行为不一致 |
| 3 | `docs/guide/architecture.md:10` | minor | 架构页的框架集成描述、包表格和包树未包含 packages/fastify |
| 4 | `llms.txt:56` | minor | JwtStrategy 归属指引同时列在 @xlt-token/jwt 与 @xlt-token/nestjs 下，应明确单一 owner |
| 5 | `package.json:3` | info | 根包 description 仍为 "with NestJS and Express integrations"，未提及 Fastify |
| 6 | 全部 package.json / pnpm-lock.yaml | 通过 | 版本 2.3.0 升级一致、无 latest/*、无重复声明、无密钥泄露 |
