// 注入当前用户 ID

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const LoginId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.stpLoginId;
  },
);
