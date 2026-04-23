# 08 · 异常与错误处理

`NotLoginException` 的六种 `reason` 来源 + 前后端配合的最佳实践。

## `NotLoginException`

源码：`src/exceptions/not-login.exception.ts`

- 继承 `UnauthorizedException`，HTTP 状态码 **401**
- 响应体结构：
  ```json
  {
    "statusCode": 401,
    "type": "INVALID_TOKEN",
    "message": "Token 无效"
  }
  ```
- 附加属性：`type: NotLoginType`、`token?: string`

## `NotLoginType`

源码：`src/const/index.ts`

| 常量 | 值 | 触发场景 | 默认中文提示 | 建议前端行为 |
| --- | --- | --- | --- | --- |
| `NOT_TOKEN` | `'NOT_TOKEN'` | 请求未携带 token | 未提供 Token | 跳转登录页 |
| `INVALID_TOKEN` | `'INVALID_TOKEN'` | 服务端 `tokenKey` 不存在（token 错 / 被删 / 绝对超时 TTL 过期） | Token 无效 | 跳转登录页 |
| `TOKEN_TIMEOUT` | `'TOKEN_TIMEOUT'` | `activeTimeout` 启用且用户闲置过久 | Token 已过期 | 跳转登录页，可提示"长时间未操作已退出" |
| `TOKEN_FREEZE` | `'TOKEN_FREEZE'` | `activeTimeout` 启用但 `lastActive` 键不存在（通常是迁移/人为清理） | Token 已被冻结 | 跳转登录页 |
| `BE_REPLACED` | `'BE_REPLACED'` | `isConcurrent=false` 下同账号被二次登录顶下线 | 已被顶下线 | 提示"账号在其他设备登录"，跳转登录页 |
| `KICK_OUT` | `'KICK_OUT'` | 管理员调用 `kickout(loginId)` | 已被踢下线 | 提示"已被管理员强制下线"，跳转登录页 |

> **关键区分**：
> - `INVALID_TOKEN` 是**兜底**（token 服务端查不到，原因可能是错 token、过期 TTL、手动清理）
> - `TOKEN_TIMEOUT` 仅由 **`activeTimeout` 机制**触发
> - `BE_REPLACED` / `KICK_OUT` 是**主动写入状态标记**（而不是 key 消失），用于区分场景

## 判定入口

在 `StpLogic._resolveLoginId`（`src/auth/stp-logic.ts:146-169`）中按顺序判定，优先级从高到低：

```
getTokenValue → NOT_TOKEN
store.get(tokenKey) → INVALID_TOKEN
value === 'BE_REPLACED' → BE_REPLACED
value === 'KICK_OUT' → KICK_OUT
activeTimeout > 0:
  ├─ no lastActive → TOKEN_FREEZE
  └─ idle > activeTimeout → TOKEN_TIMEOUT
```

## 全局异常过滤器（示例）

项目通常有统一响应格式，建议在 `main.ts` 注册一个 `ExceptionFilter` 将 `NotLoginException` 转成你的业务响应：

```ts
import { Catch, ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { NotLoginException } from 'xlt-token';
import { Response } from 'express';

@Catch(NotLoginException)
export class NotLoginExceptionFilter implements ExceptionFilter {
  catch(exception: NotLoginException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const type = (exception as any).type;
    response.status(401).json({
      code: 401,
      type,
      message: this.mapMessage(type),
      data: null,
    });
  }

  private mapMessage(type: string): string {
    switch (type) {
      case 'NOT_TOKEN':      return '未登录';
      case 'INVALID_TOKEN':  return 'token 已失效，请重新登录';
      case 'TOKEN_TIMEOUT':  return '长时间未操作，请重新登录';
      case 'TOKEN_FREEZE':   return '会话已被冻结';
      case 'BE_REPLACED':    return '账号已在其他设备登录';
      case 'KICK_OUT':       return '账号已被管理员下线';
      default:               return '身份校验失败';
    }
  }
}
```

注册：

```ts
// main.ts
app.useGlobalFilters(new NotLoginExceptionFilter());
```

## 前端统一处理（示例）

axios 拦截器里识别 `type` 做差异化提示：

```ts
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const type = err.response.data?.type;
      if (type === 'BE_REPLACED') {
        Message.warning('账号已在其他设备登录');
      } else if (type === 'KICK_OUT') {
        Message.error('已被管理员强制下线');
      }
      router.push('/login');
    }
    return Promise.reject(err);
  },
);
```

## 自定义异常消息（进阶）

若你想修改 `NotLoginException` 自带的中文 message（默认读取 `src/exceptions/not-login.exception.ts` 的 message 映射），有两种做法：

1. **推荐**：在 `ExceptionFilter` 里重新映射（如上例），不改库代码
2. 在业务 Guard（继承 `XltAbstractLoginGuard`）的 `onAuthFail` 钩子内读取 `result.reason`，抛自定义异常

## 常见问题

**Q：`INVALID_TOKEN` 和 `TOKEN_TIMEOUT` 经常混淆？**
A：它们触发机制不同——前者是"服务端记录找不到"，后者是"活跃超时机制判定"。如果没开 `activeTimeout`，你永远只会看到 `INVALID_TOKEN` 而不会看到 `TOKEN_TIMEOUT`。

**Q：绝对过期（`timeout` 到期）触发什么？**
A：`INVALID_TOKEN`。因为 store 的 TTL 到期 → key 消失 → `store.get(tokenKey)` 返回 `null`。

**Q：被顶号的用户，旧 token 为什么还能查到？**
A：顶号只是把 `tokenKey` 的值 `update` 成 `'BE_REPLACED'`，**保留 TTL**。这样用户下次请求就能精确得到 `BE_REPLACED` 原因，而不是笼统的 `INVALID_TOKEN`。

## 下一步

- 搭配 Guard 使用 → [05-guards-and-decorators](./05-guards-and-decorators.md)
- 主动踢人 / 查所有在线用户 → [09-recipes](./09-recipes.md)
