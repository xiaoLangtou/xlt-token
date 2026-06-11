# NestJS Adapter

Use `@xlt-token/nestjs` for NestJS applications. It exports the core APIs plus NestJS module, guard, decorators, Redis store, and JWT strategy.

## Basic Setup

```ts
import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { XltTokenGuard, XltTokenModule } from '@xlt-token/nestjs'

@Module({
  imports: [
    XltTokenModule.forRoot({
      isGlobal: true,
      config: {
        tokenName: 'authorization',
        tokenPrefix: 'Bearer ',
        timeout: 60 * 60 * 24 * 7,
        defaultCheck: true
      }
    })
  ],
  providers: [
    { provide: APP_GUARD, useClass: XltTokenGuard }
  ]
})
export class AppModule {}
```

## Login Controller

```ts
import { Body, Controller, Get, Post } from '@nestjs/common'
import { LoginId, StpUtil, TokenValue, XltIgnore } from '@xlt-token/nestjs'

@Controller('auth')
export class AuthController {
  @XltIgnore()
  @Post('login')
  async login(@Body() dto: { username: string; password: string }) {
    const user = await validateUser(dto)
    const token = await StpUtil.login(user.id, { device: 'web' })
    return { token }
  }

  @Post('logout')
  async logout(@TokenValue() token: string) {
    await StpUtil.logout(token)
    return { ok: true }
  }

  @Get('me')
  me(@LoginId() loginId: string) {
    return { loginId }
  }
}
```

## DurationInput

All timeout fields in `config` and `login({ timeout })`, `renewTimeout`, `openSafe`, `createTempToken` accept `DurationInput`: a number (seconds), or a relative string like `'30s'`, `'15m'`, `'2h'`, `'7d'`, `'2w'`. The internal Store always receives normalized seconds.

```ts
XltTokenModule.forRoot({
  config: {
    timeout: '7d',   // 7 天
    activeTimeout: '30m',  // 30 分钟闲置冻结
  }
})
```

## Guard Modes

Black-list mode, the default:

```ts
{ defaultCheck: true }
```

All routes require login unless decorated with `@XltIgnore()`.

White-list mode:

```ts
{ defaultCheck: false }
```

Routes are public unless decorated with `@XltCheckLogin()`.

## Permission And Role Decorators

Register `stpInterface` in the module:

```ts
XltTokenModule.forRoot({
  stpInterface: DemoStpInterface
})
```

Use decorators:

```ts
@XltCheckPermission('order:create')
@Post('orders')
createOrder() {}

@XltCheckRole(['admin', 'super'], { mode: XltMode.OR })
@Get('admin')
adminOnly() {}
```

## Secondary Authentication

```ts
@XltCheckSafe('pay')
@Post('transfer')
transfer() {}
```

Open the safe window after the user completes a secondary challenge:

```ts
await StpUtil.openSafe(token, 'pay', 300)
```

## Redis Store

```ts
import { RedisStore, XLT_REDIS_CLIENT, XltTokenModule } from '@xlt-token/nestjs'
import { createClient } from 'redis'

XltTokenModule.forRoot({
  store: { useClass: RedisStore },
  providers: [
    {
      provide: XLT_REDIS_CLIENT,
      useFactory: async () => {
        const client = createClient({ url: 'redis://localhost:6379' })
        await client.connect()
        return client
      }
    }
  ]
})
```

## JWT Strategy

Install `jsonwebtoken`, then configure `JwtStrategy`:

```ts
import { JwtStrategy, XltTokenModule } from '@xlt-token/nestjs'

XltTokenModule.forRoot({
  strategy: { useClass: JwtStrategy },
  config: {
    jwt: {
      secret: process.env.JWT_SECRET!
    }
  }
})
```

JWT mode uses `jti` blacklisting for kickout and replacement. Use a shared store such as Redis in production.

## Custom Login Guard

Extend `XltAbstractLoginGuard` when the application needs to load business user data onto the request after token validation:

```ts
@Injectable()
export class BusinessLoginGuard extends XltAbstractLoginGuard {
  protected async onAuthSuccess(result, request) {
    request.user = await users.findById(result.loginId)
  }
}
```
