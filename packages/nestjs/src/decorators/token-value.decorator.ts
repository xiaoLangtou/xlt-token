// 注入当前 Token

import { createParamDecorator, ExecutionContext } from '@nestjs/common';


/**
 * 注入当前 Token
 * @constructor
 */
export const TokenValue = createParamDecorator((data: any, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.stpToken;
});
