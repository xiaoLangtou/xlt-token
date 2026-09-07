# 鉴权，别只看登录

> 建议标签：`TypeScript` `Node.js` `Fastify` `鉴权` `开源`

有一次，我看到一段很熟悉的密码重置代码：先根据链接里的临时 Token 查用户，再把 Token 删掉。它在本地跑得很好，线上也大概率不会出问题——直到有人双击提交，或者网络重试恰好撞在一起。

两次请求都读到了同一个 Token。两次都认为自己有资格重置密码。这个问题不在登录接口，也不在 JWT，而藏在“读取”和“删除”之间那几毫秒里。

做完 xlt-token v2.2 和 v2.3 后，我越来越觉得：认证系统最重要的部分，常常不是把用户放进来，而是把这些边界守住。这次我们做了三件事：让一次性链接真的只能用一次，让一台服务里的多套认证不再串台，以及让 Fastify 项目不用从头拼鉴权中间件。

## 一次性链接，应该只有一次机会

以前处理临时 Token，很容易写成这样：`parseTempToken()` 拿到数据，业务成功后再 `deleteTempToken()`。它看起来合理，但这其实是两个动作。只要两个请求同时进入第一个动作，就会同时拿到业务数据。

v2.2 增加了 `consumeTempToken()`。它不只是一个新名字，而是把“读取 + 销毁”变成一个不能拆开的动作：第一次拿到值，后面的请求只会拿到 `null`。

```ts [src/auth/reset-password.ts]
import { StpUtil } from '@xlt-token/nestjs';

// 发邮件时，创建 30 分钟有效的链接。
const tempToken = await StpUtil.createTempToken(`resetPwd:${userId}`, 1800);
const link = `https://app.example.com/reset-password?t=${tempToken}`;

// 提交新密码时，读取并消费 Token。
const value = await StpUtil.consumeTempToken(tempToken);
if (!value) {
  throw new Error('链接无效、已过期或已被使用');
}

const [, targetUserId] = value.split(':');
await userService.resetPassword(targetUserId, newPassword);
```

这件事不能只靠 Controller 小心一点。xlt-token 把原子语义下沉到 Store：内存存储在同一临界段完成读删，Redis 存储通过原子命令或 Lua 完成同样的工作。无论请求从哪台机器进来，竞争同一个临时 Token 时，只有一个请求能赢。

邀请码、邮箱验证、一次性下载链接也适合这一套模式。业务代码只需要处理“拿到值”或“已经失效”两种结果，不必再为双击、重试和并发补锁。

## 静态 API 很方便，但不能偷偷接管全局

`StpUtil.login()` 这种写法足够直接，单个应用也一直很好用。问题出现在同一 Node.js 进程里跑两套认证时：比如用户端与后台管理端分别需要自己的 Token 名、过期策略和存储。

如果两者都依赖默认实例，后创建的实例就可能覆盖先创建的实例。排查这类问题通常很痛苦，因为代码表面上没有任何一处写着“我正在切换认证域”。

v2.3 的做法是把认证状态放回实例本身。`createXltInstance()` 创建的实例拥有自己的配置、Store、Token 策略、认证逻辑和权限逻辑，并且不会改动默认实例。

```ts [src/auth/instances.ts]
import { createXltInstance, MemoryStore } from '@xlt-token/core';

export const userAuth = createXltInstance({
  config: { tokenName: 'user-token' },
  store: new MemoryStore(),
});

export const adminAuth = createXltInstance({
  config: { tokenName: 'admin-token' },
  store: new MemoryStore(),
});

await userAuth.stpLogic.login('user-1001');
await adminAuth.stpLogic.login('admin-1');
```

这不是要求所有项目立刻告别 `StpUtil`。已有的单认证域项目可以保持原样；当你需要多认证域、插件隔离或者并行测试时，再选择显式实例。静态门面依旧是便利入口，实例 API 则让边界变得可见。

## Fastify 项目，不该再手搓一遍鉴权

另一个经常出现的场景是：项目准备迁到 Fastify，登录倒是容易接入，但权限、角色、Cookie、二级认证、错误响应又得重新组织一次。最终每个项目都有一份长得差不多、细节却不一致的 `preHandler`。

v2.3 提供官方包 `@xlt-token/fastify`，把 Fastify 的 `request` / `reply` 接到 core 的认证语义上。你只要创建实例、注册插件，再声明哪些路由公开、哪些路由需要登录或角色即可。

```bash
pnpm add fastify @xlt-token/fastify
```

```ts [src/app.ts]
import Fastify from 'fastify';
import {
  createXltInstance,
  MemoryStore,
  XltMode,
  xltFastifyPlugin,
} from '@xlt-token/fastify';

const app = Fastify();
const instance = createXltInstance({
  config: { tokenPrefix: '' },
  store: new MemoryStore(),
  stpInterface: {
    getPermissionList: async (loginId) =>
      loginId === '1001' ? ['order:read'] : [],
    getRoleList: async (loginId) =>
      loginId === '1001' ? ['admin'] : [],
  },
});

await app.register(xltFastifyPlugin, {
  instance,
  ignore: ['/api/auth/login', '/api/public'],
  policies: [
    { match: '/api/order', permissions: { list: ['order:read'], mode: XltMode.AND } },
    { match: '/api/admin', roles: { list: ['admin'], mode: XltMode.AND } },
    { match: '/api/pay', methods: ['POST'], safeBusiness: 'pay' },
  ],
});

app.get('/api/me', async (request) => ({
  loginId: request.stpLoginId,
}));
```

插件在 `preHandler` 完成校验，并把本次请求的登录态放到 `request.stpLoginId`、`request.stpToken` 和 `request.stpSession`。同一套声明既能处理“默认都拦住，只放行少数接口”，也能处理“默认放行，只保护关键接口”。

如果 Token 放在 Cookie 中，需要先注册 `@fastify/cookie`。这是 Fastify 的同步 Cookie 契约：依赖没有准备好时，应用会在初始化阶段报出明确错误，不让问题拖到线上请求才出现。

```ts [src/app-cookie.ts]
import cookie from '@fastify/cookie';

await app.register(cookie);
await app.register(xltFastifyPlugin, { instance });
```

更重要的是，Fastify 插件只接收你传入的 `instance`，不会转头去读取 `StpUtil`。所以你可以给 `/user` 和 `/admin` 各注册一个 scope，各用一套认证实例，互相不认识也互不影响。

## 记录认证事件，不记录认证凭证

认证日志还有一个很容易踩的坑：为了排查问题，把完整 Token 或整个请求对象写进日志。排查是方便了，凭证却可能留在日志平台、导出链路和备份里。

xlt-token 用 `XltEventSink` 提供审计边界。事件里可以携带登录 ID、设备、下线原因和 Token 指纹，用于把同一次会话相关的事件串起来；原始 Token、请求对象和 JWT payload 不在默认事件字段中。

```ts [src/observability/auth-audit.ts]
import { createXltInstance, type XltEventSink } from '@xlt-token/core';

const eventSink: XltEventSink = {
  emit(event) {
    auditLogger.info({
      type: event.type,
      loginId: event.loginId,
      device: event.device,
      tokenFingerprint: event.tokenFingerprint,
    });
  },
};

const instance = createXltInstance({ eventSink });
```

你可以在这个边界后接自己的日志或审计系统。OpenTelemetry、日志平台和指标系统的独立导出器仍在后续规划中；当前版本先把“哪些数据可以安全地离开认证模块”这件事定义清楚。

## 写在最后

这次升级没有试图把认证做得更花哨，而是让几个危险但常见的场景更难出错：一次性链接不被并发复用，多套认证不靠隐式全局状态碰运气，Fastify 接入也不必复制一份鉴权逻辑。

如果你正在做密码重置、邀请注册，或者项目正从 Express/NestJS 延伸到 Fastify，v2.2 和 v2.3 的这些能力应该能直接用上。认证的体验当然从登录开始，但真正的可靠性，往往藏在登录之后。

## 相关链接

- [xlt-token GitHub 仓库](https://github.com/xiaoLangtou/xlt-token)
- [Fastify 适配器文档](https://xiaolangtou.github.io/xlt-token/adapters/fastify)
- [二级认证与临时 Token](https://xiaolangtou.github.io/xlt-token/core/secondary-auth)
- [多实例与适配器契约](https://xiaolangtou.github.io/xlt-token/guide/multi-instance-contract)
