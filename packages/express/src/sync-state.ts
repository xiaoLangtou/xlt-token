import { HttpContext } from '@xlt-token/core';
import { ExpressLikeRequest } from './context.js';

export function syncExpressAuthState(req: Request, ctx:HttpContext) {
  const loginId = ctx.state.loginId;
  const token = ctx.state.token;

  if (loginId !=null) {
    (req as ExpressLikeRequest).loginId = String(loginId);
  }

  if (token !=null){
    (req as ExpressLikeRequest).token = String(token);
  }
}
