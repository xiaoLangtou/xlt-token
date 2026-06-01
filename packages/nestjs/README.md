# @xlt-token/nestjs

NestJS integration for [xlt-token](https://github.com/xiaoLangtou/xlt-token).

## Install

```bash
pnpm add @xlt-token/nestjs @xlt-token/core
```

## Usage

```ts
import { Module } from '@nestjs/common';
import { XltTokenModule, XltTokenGuard } from '@xlt-token/nestjs';

@Module({
  imports: [XltTokenModule.forRoot({ isGlobal: true })],
})
export class AppModule {}
```

## Fastify

同时支持 Express 与 Fastify 适配器，守卫与装饰器无需改动。

```ts
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter(),
);
```

- Header / Query 模式开箱即用。
- Cookie 模式需先注册 `@fastify/cookie` 插件，否则无法读写 cookie：

```ts
import fastifyCookie from '@fastify/cookie';
await app.register(fastifyCookie);
```

## Documentation

https://xiaolangtou.github.io/xlt-token/

## License

MIT
