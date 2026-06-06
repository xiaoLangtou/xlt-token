import type { RequestHandler } from 'express';
import { DEMO_USERS } from '../stp/demo-stp-interface';

const userCache = new Map<string, { id: string; username: string }>();

export function cacheUserOnLogin(loginId: string, username: string) {
  userCache.set(loginId, { id: loginId, username });
}

export const loadProfileUser: RequestHandler = (req, _res, next) => {
  const loginId = req.stpLoginId;
  if (!loginId) {
    next();
    return;
  }

  const cached = userCache.get(loginId);
  const username =
    cached?.username ??
    (loginId === DEMO_USERS.admin.loginId ? 'admin' : loginId === DEMO_USERS.user.loginId ? 'user' : loginId);

  (req as typeof req & { user?: Record<string, unknown> }).user = {
    id: loginId,
    username,
    loadedBy: 'loadProfileUser',
  };

  next();
};
