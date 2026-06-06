import { Router } from 'express';
import { StpUtil } from '@xlt-token/express';
import { cacheUserOnLogin } from '../middleware/profile-user';
import { asyncHandler } from '../middleware/async-handler';
import { HttpError } from '../middleware/demo-error-handler';
import { DEMO_USERS } from '../stp/demo-stp-interface';

export function createAuthRouter() {
  const router = Router();

  router.post('/login', asyncHandler(async (req, res) => {
    const { username, password, device = 'default' } = req.body as {
      username?: string;
      password?: string;
      device?: string;
    };

    const user =
      username === 'admin' || username === DEMO_USERS.admin.loginId
        ? DEMO_USERS.admin
        : username === 'user' || username === DEMO_USERS.user.loginId
          ? DEMO_USERS.user
          : null;

    if (!user || user.password !== password) {
      throw new HttpError(401, '用户名或密码错误');
    }

    const token = await StpUtil.login(user.loginId, { device });
    cacheUserOnLogin(user.loginId, username ?? user.loginId);

    res.json({ token, loginId: user.loginId, device });
  }));

  router.post('/logout', asyncHandler(async (req, res) => {
    await StpUtil.logout(req.stpToken!);
    res.json({ ok: true });
  }));

  router.get('/me', (req, res) => {
    res.json({ loginId: req.stpLoginId, token: req.stpToken });
  });

  router.post('/renew', asyncHandler(async (req, res) => {
    const timeout = 7 * 24 * 60 * 60;
    const ok = await StpUtil.renewTimeout(req.stpToken!, timeout);
    if (!ok) throw new HttpError(401, 'token 无效');
    res.json({ ok: true, timeout });
  }));

  router.get('/protected-by-check-login', (req, res) => {
    res.json({ loginId: req.stpLoginId, mode: 'whitelist' });
  });

  return router;
}
