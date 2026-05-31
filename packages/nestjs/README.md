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

## Documentation

https://xiaolangtou.github.io/xlt-token/

## License

MIT
