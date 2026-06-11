# Core 快速开始

`@xlt-token/core` 提供框架无关的鉴权运行时。它不依赖 NestJS、Express 或其他 HTTP 框架；你只需要把请求适配成 `HttpContext`，再调用 `StpLogic` 或 `StpUtil`。

## 安装

```bash
pnpm add @xlt-token/core
```

## 创建实例

```ts twoslash
import { createXltToken, MemoryStore } from '@xlt-token/core';

const xlt = createXltToken({
  config: {
    tokenName: 'authorization',
    timeout: 7 * 24 * 60 * 60,
  },
  store: new MemoryStore(),
});
```

`createXltToken` 会创建 `StpLogic`、`StpPermLogic`，并初始化静态门面 `StpUtil`。在非 DI 场景中，你可以直接使用 `StpUtil.login(...)`。

## 登录与校验

```ts twoslash
import { createMockHttpContext, createXltToken, MemoryStore } from '@xlt-token/core';

const xlt = createXltToken({
  config: { tokenName: 'authorization' },
  store: new MemoryStore(),
});

const token = await xlt.stpLogic.login('1001');

const ctx = createMockHttpContext({
  headers: {
    authorization: `Bearer ${token}`,
  },
});

const result = await xlt.stpLogic.checkLogin(ctx);

console.log(result.loginId); // "1001"
console.log(ctx.state.stpLoginId); // "1001"
```

`checkLogin` 校验失败时会抛出 core 异常，例如 `NotLoginException`。框架适配器负责把这些异常映射成 HTTP 响应。

## 接入自定义 HTTP 框架

Core 只要求请求对象能被转换成 `HttpContext`：

```ts twoslash
import type { HttpContext } from '@xlt-token/core';

function createMyHttpContext(req: any, res: any): HttpContext {
  const state = req._xltState ??= {};

  return {
    headers: {
      get: (name) => req.headers?.[name.toLowerCase()] ?? null,
    },
    cookies: {
      get: (name) => req.cookies?.[name] ?? null,
    },
    query: {
      get: (name) => req.query?.[name] ?? null,
    },
    state,
    setHeader: (name, value) => {
      res.setHeader(name, value);
    },
    setCookie: (name, value, options) => {
      res.cookie(name, value, options);
    },
    raw: () => req,
  };
}
```

这也是 NestJS、Express 等适配器的核心工作：把框架请求桥接到 `HttpContext`，然后复用同一套鉴权语义。

## 下一步

- 查看完整方法签名：[核心 API](/core/core-api)
- 调整 token、超时和并发策略：[配置参考](/core/configuration)
- 切换存储实现：[存储层](/core/storage)
- 实现自定义 token 生成：[Token 策略](/core/token-strategy)
