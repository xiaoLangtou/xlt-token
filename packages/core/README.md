# @xlt-token/core

Framework-agnostic token authentication core for [xlt-token](https://github.com/xiaoLangtou/xlt-token).

## Install

```bash
pnpm add @xlt-token/core
```

## Usage

```ts
import { createXltToken, MemoryStore, StpUtil } from '@xlt-token/core';

const xlt = createXltToken({ store: new MemoryStore() });
const token = await xlt.stpLogic.login('1001');
```

## Documentation

https://xiaolangtou.github.io/xlt-token/

## License

MIT
